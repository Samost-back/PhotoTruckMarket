(() => {
  const CFG = window.BARREL_CONFIG;
  const TEMPLATES_DIR = 'templates';

  const $ = (id) => document.getElementById(id);
  const drop = $('drop');
  const fileInput = $('fileInput');
  const btnGenerate = $('generate');
  const btnDownloadAll = $('downloadAll');
  const btnClear = $('clear');
  const btnToggleLog = $('toggleLog');
  const logOverlay = $('logOverlay');
  const btnCloseLog = $('closeLog');
  const logEl = $('log');
  const statsEl = $('stats');
  const resultsEl = $('results');

  let barrelFiles = [];
  let generated = [];
  let templateCache = null;

  function resolveValue(code) {
    const last3 = code.slice(-3);
    if (
      code.charAt(0) === '7' &&
      CFG.KG_PREFIX7_MAP &&
      Object.prototype.hasOwnProperty.call(CFG.KG_PREFIX7_MAP, last3)
    ) {
      return { unit: 'kg', value: CFG.KG_PREFIX7_MAP[last3] };
    }
    if (Object.prototype.hasOwnProperty.call(CFG.KG_MAP, last3)) {
      return { unit: 'kg', value: CFG.KG_MAP[last3] };
    }
    if (Object.prototype.hasOwnProperty.call(CFG.LITERS_MAP, last3)) {
      return { unit: 'l', value: CFG.LITERS_MAP[last3] };
    }
    return null;
  }

  function findTemplateNames(mapping) {
    return Object.entries(CFG.TEMPLATES)
      .filter(([, c]) => c.unit === mapping.unit && c.value === mapping.value)
      .map(([name]) => name);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load ${url}`));
      img.src = url;
    });
  }

  async function loadTemplates() {
    if (templateCache) return templateCache;
    templateCache = {};
    for (const name of Object.keys(CFG.TEMPLATES)) {
      let loaded = false;
      for (const ext of CFG.TEMPLATE_EXTS) {
        const url = `${TEMPLATES_DIR}/${name}.${ext}`;
        try {
          templateCache[name] = await loadImage(url);
          loaded = true;
          break;
        } catch (_) {}
      }
      if (!loaded) {
        log(`template missing: ${name}.{${CFG.TEMPLATE_EXTS.join('|')}}`, 'err');
      }
    }
    return templateCache;
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('invalid image'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('file read error'));
      reader.readAsDataURL(file);
    });
  }

  async function compose(templateImg, barrelImg, pos) {
    const canvas = document.createElement('canvas');
    canvas.width = templateImg.naturalWidth;
    canvas.height = templateImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(templateImg, 0, 0);

    // Cover the product area with white before placing new image
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pos.left, pos.top, pos.width, pos.height);

    const bw = barrelImg.naturalWidth;
    const bh = barrelImg.naturalHeight;
    const scale = Math.min(pos.width / bw, pos.height / bh);
    const w = bw * scale;
    const h = bh * scale;
    const x = pos.left + (pos.width - w) / 2;
    const y = pos.top + (pos.height - h) / 2;
    ctx.drawImage(barrelImg, x, y, w, h);

    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', CFG.JPG_QUALITY)
    );
  }

  function log(msg, cls = '') {
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = msg;
    logEl.appendChild(div);
  }

  function clearResults() {
    generated.forEach((g) => URL.revokeObjectURL(g.url));
    generated = [];
    resultsEl.innerHTML = '<div class="empty">Ще нічого не згенеровано</div>';
    logEl.innerHTML = '';
    logOverlay.classList.remove('open');
    statsEl.textContent = '';
    btnDownloadAll.disabled = true;
    btnToggleLog.disabled = true;
  }

  function renderCard(item) {
    const empty = resultsEl.querySelector('.empty');
    if (empty) empty.remove();
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="thumb"><img src="${item.url}" alt="${item.outName}" /></div>
      <div class="meta">
        <span class="name" title="${item.folderPath}">${item.outName}</span>
        <a href="${item.url}" download="${item.outName}">Скачати</a>
      </div>
    `;
    resultsEl.appendChild(card);
  }

  /** Extract relative folder path from webkitRelativePath */
  function getFolderPath(file) {
    const rel = file.webkitRelativePath || file.name;
    const parts = rel.split('/');
    if (parts.length <= 1) return '';
    // remove root folder name and filename, keep middle dirs
    return parts.slice(1, -1).join('/');
  }

  function setBarrelFiles(files) {
    barrelFiles = Array.from(files).filter((f) => {
      return /\.(png|jpe?g|webp)$/i.test(f.name);
    });
    btnGenerate.disabled = barrelFiles.length === 0;
    const folderName = barrelFiles.length && barrelFiles[0].webkitRelativePath
      ? barrelFiles[0].webkitRelativePath.split('/')[0]
      : '';
    statsEl.textContent = barrelFiles.length
      ? `Папка: ${folderName || '—'} | Файлів: ${barrelFiles.length}`
      : '';
  }

  fileInput.addEventListener('change', (e) => setBarrelFiles(e.target.files));

  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('drag');
    })
  );

  drop.addEventListener('drop', async (e) => {
    const items = e.dataTransfer?.items;
    if (!items) return;

    const allFiles = [];
    const entries = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) entries.push(entry);
    }

    if (entries.length > 0 && entries.some((e) => e.isDirectory)) {
      for (const entry of entries) {
        await readEntryRecursive(entry, '', allFiles);
      }
      barrelFiles = allFiles.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name));
      btnGenerate.disabled = barrelFiles.length === 0;
      const folderName = entries[0].name || '—';
      statsEl.textContent = barrelFiles.length
        ? `Папка: ${folderName} | Файлів: ${barrelFiles.length}`
        : '';
    } else if (e.dataTransfer?.files) {
      setBarrelFiles(e.dataTransfer.files);
    }
  });

  function readAllEntries(reader) {
    return new Promise((resolve) => {
      const all = [];
      (function readBatch() {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(all);
          } else {
            all.push(...batch);
            readBatch();
          }
        });
      })();
    });
  }

  async function readEntryRecursive(entry, path, result) {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          Object.defineProperty(file, '_relativePath', {
            value: path ? path + '/' + file.name : file.name,
            writable: false,
          });
          result.push(file);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await readAllEntries(reader);
      for (const child of entries) {
        await readEntryRecursive(
          child,
          path ? path + '/' + entry.name : entry.name,
          result
        );
      }
    }
  }

  /** Get the subfolder path for a file (from folder upload or drag&drop) */
  function getSubfolder(file) {
    // drag&drop folder: _relativePath stored manually
    if (file._relativePath) {
      const parts = file._relativePath.split('/');
      return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    }
    // webkitdirectory input: webkitRelativePath = "rootFolder/sub/file.png"
    if (file.webkitRelativePath) {
      const parts = file.webkitRelativePath.split('/');
      // skip root folder name, take middle parts
      return parts.length > 2 ? parts.slice(1, -1).join('/') : '';
    }
    return '';
  }

  btnClear.addEventListener('click', () => {
    setBarrelFiles([]);
    fileInput.value = '';
    clearResults();
  });

  btnGenerate.addEventListener('click', async () => {
    btnGenerate.disabled = true;
    clearResults();

    const templates = await loadTemplates();
    let ok = 0, skipped = 0, failed = 0;

    for (const file of barrelFiles) {
      const code = file.name.replace(/\.[^.]+$/, '');
      if (code.length < 3) {
        log(`[skip] ${file.name}: код < 3 символів`, 'skip');
        skipped++;
        continue;
      }
      const mapping = resolveValue(code);
      if (!mapping) {
        log(`[skip] ${file.name}: ${code.slice(-3)} немає у мапінгу`, 'skip');
        skipped++;
        continue;
      }
      const tplNames = findTemplateNames(mapping);
      if (tplNames.length === 0) {
        log(`[skip] ${file.name}: немає шаблону для ${mapping.unit}=${mapping.value}`, 'skip');
        skipped++;
        continue;
      }

      let barrelImg;
      try {
        barrelImg = await fileToImage(file);
      } catch (err) {
        log(`[err] ${file.name}: ${err.message}`, 'err');
        failed++;
        continue;
      }

      const subfolder = getSubfolder(file);

      for (const tplName of tplNames) {
        if (!templates[tplName]) {
          failed++;
          continue;
        }
        const outName = `${tplName}_${code}.jpg`;
        const folderPath = subfolder ? `${subfolder}/${outName}` : outName;
        try {
          const blob = await compose(templates[tplName], barrelImg, CFG.TEMPLATES[tplName]);
          const url = URL.createObjectURL(blob);
          const item = { outName, folderPath, subfolder, blob, url };
          generated.push(item);
          renderCard(item);
          log(`[ok]  ${folderPath}`, 'ok');
          ok++;
        } catch (err) {
          log(`[err] ${outName}: ${err.message}`, 'err');
          failed++;
        }
      }
    }

    statsEl.textContent = `Готово. ok=${ok} skipped=${skipped} failed=${failed}`;
    btnGenerate.disabled = barrelFiles.length === 0;
    btnDownloadAll.disabled = generated.length === 0;
    btnToggleLog.disabled = false;
  });

  btnDownloadAll.addEventListener('click', async () => {
    if (generated.length === 0) return;
    btnDownloadAll.disabled = true;
    btnDownloadAll.textContent = 'Зберігаю...';

    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

      for (const g of generated) {
        let targetDir = dirHandle;

        // Create subfolders if needed
        if (g.subfolder) {
          const parts = g.subfolder.split('/');
          for (const part of parts) {
            targetDir = await targetDir.getDirectoryHandle(part, { create: true });
          }
        }

        const fileHandle = await targetDir.getFileHandle(g.outName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(g.blob);
        await writable.close();
      }

      statsEl.textContent = `Збережено ${generated.length} файлів у папку`;
    } catch (err) {
      if (err.name !== 'AbortError') {
        statsEl.textContent = `Помилка збереження: ${err.message}`;
      }
    }

    btnDownloadAll.textContent = 'Скачати все';
    btnDownloadAll.disabled = false;
  });

  btnToggleLog.addEventListener('click', () => {
    logOverlay.classList.add('open');
  });

  btnCloseLog.addEventListener('click', () => {
    logOverlay.classList.remove('open');
  });

  logOverlay.addEventListener('click', (e) => {
    if (e.target === logOverlay) logOverlay.classList.remove('open');
  });

})();
