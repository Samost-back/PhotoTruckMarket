(() => {
  const CFG = window.BARREL_CONFIG;
  const TEMPLATES_DIR = 'templates';
  const LS_KEY = 'barrel_positions_v1';

  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    for (const [k, v] of Object.entries(saved)) {
      if (CFG.TEMPLATES[k]) Object.assign(CFG.TEMPLATES[k], v);
    }
  } catch (_) {}

  const $ = (id) => document.getElementById(id);
  const drop = $('drop');
  const fileInput = $('fileInput');
  const btnGenerate = $('generate');
  const btnZip = $('downloadZip');
  const btnClear = $('clear');
  const logEl = $('log');
  const statsEl = $('stats');
  const resultsEl = $('results');

  let barrelFiles = [];
  let generated = [];
  let templateCache = null;

  function resolveValue(last3) {
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
    logEl.style.display = 'block';
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = msg;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function clearResults() {
    generated.forEach((g) => URL.revokeObjectURL(g.url));
    generated = [];
    resultsEl.innerHTML = '<div class="empty">Ще нічого не згенеровано</div>';
    logEl.innerHTML = '';
    logEl.style.display = 'none';
    statsEl.textContent = '';
    btnZip.disabled = true;
  }

  function renderCard(item) {
    const empty = resultsEl.querySelector('.empty');
    if (empty) empty.remove();
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="thumb"><img src="${item.url}" alt="${item.name}" /></div>
      <div class="meta">
        <span class="name" title="${item.name}">${item.name}</span>
        <a href="${item.url}" download="${item.name}">Скачати</a>
      </div>
    `;
    resultsEl.appendChild(card);
  }

  function setBarrelFiles(files) {
    barrelFiles = Array.from(files).filter((f) => {
      if (f.type && f.type.startsWith('image/')) return true;
      return /\.(png|jpe?g|webp)$/i.test(f.name);
    });
    btnGenerate.disabled = barrelFiles.length === 0;
    statsEl.textContent = barrelFiles.length
      ? `Вибрано файлів: ${barrelFiles.length}`
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
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files) setBarrelFiles(e.dataTransfer.files);
  });

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
      const last3 = code.slice(-3);
      const mapping = resolveValue(last3);
      if (!mapping) {
        log(`[skip] ${file.name}: ${last3} немає у мапінгу`, 'skip');
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

      for (const tplName of tplNames) {
        if (!templates[tplName]) {
          failed++;
          continue;
        }
        const outName = `${tplName}_${code}.jpg`;
        try {
          const blob = await compose(templates[tplName], barrelImg, CFG.TEMPLATES[tplName]);
          const url = URL.createObjectURL(blob);
          const item = { name: outName, blob, url };
          generated.push(item);
          renderCard(item);
          log(`[ok]  ${outName}`, 'ok');
          ok++;
        } catch (err) {
          log(`[err] ${outName}: ${err.message}`, 'err');
          failed++;
        }
      }
    }

    statsEl.textContent = `Готово. ok=${ok} skipped=${skipped} failed=${failed}`;
    btnGenerate.disabled = barrelFiles.length === 0;
    btnZip.disabled = generated.length === 0;
  });

  btnZip.addEventListener('click', async () => {
    if (generated.length === 0) return;
    btnZip.disabled = true;
    const zip = new JSZip();
    for (const g of generated) zip.file(g.name, g.blob);
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barrels_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    btnZip.disabled = false;
  });

  const tunerBtn = $('toggleTuner');
  const tuner = $('tuner');
  const tplSel = $('tunerTpl');
  const barrelSel = $('tunerBarrel');
  const controlsEl = $('tunerControls');
  const canvas = $('tunerCanvas');
  const btnExport = $('tunerExport');
  const btnReset = $('tunerReset');

  function savePositions() {
    const snap = {};
    for (const [k, v] of Object.entries(CFG.TEMPLATES)) {
      snap[k] = { left: v.left, top: v.top, width: v.width, height: v.height };
    }
    localStorage.setItem(LS_KEY, JSON.stringify(snap));
  }

  function populateTplSel() {
    tplSel.innerHTML = '';
    for (const name of Object.keys(CFG.TEMPLATES)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${name} (${CFG.TEMPLATES[name].value})`;
      tplSel.appendChild(opt);
    }
  }

  function populateBarrelSel() {
    barrelSel.innerHTML = '';
    if (barrelFiles.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = '— завантажте PNG вище —';
      opt.disabled = true;
      barrelSel.appendChild(opt);
      return;
    }
    barrelFiles.forEach((f, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = f.name;
      barrelSel.appendChild(opt);
    });
  }

  async function renderTuner() {
    const tplName = tplSel.value;
    if (!tplName) return;
    const pos = CFG.TEMPLATES[tplName];
    const tpls = await loadTemplates();
    const tplImg = tpls[tplName];
    if (!tplImg) return;

    canvas.width = tplImg.naturalWidth;
    canvas.height = tplImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(tplImg, 0, 0);

    if (barrelFiles.length && barrelSel.value !== '') {
      const idx = Number(barrelSel.value);
      const file = barrelFiles[idx];
      if (file) {
        try {
          const b = await fileToImage(file);
          const scale = Math.min(pos.width / b.naturalWidth, pos.height / b.naturalHeight);
          const w = b.naturalWidth * scale;
          const h = b.naturalHeight * scale;
          const x = pos.left + (pos.width - w) / 2;
          const y = pos.top + (pos.height - h) / 2;
          ctx.drawImage(b, x, y, w, h);
        } catch (_) {}
      }
    }

    ctx.strokeStyle = 'rgba(255,0,0,0.8)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.left, pos.top, pos.width, pos.height);
    ctx.setLineDash([]);
  }

  function buildControls() {
    const tplName = tplSel.value;
    if (!tplName) return;
    const pos = CFG.TEMPLATES[tplName];
    controlsEl.innerHTML = '';
    const fields = [
      { key: 'left',   min: 0, max: 1000 },
      { key: 'top',    min: 0, max: 1000 },
      { key: 'width',  min: 10, max: 1000 },
      { key: 'height', min: 10, max: 1000 },
    ];
    fields.forEach(({ key, min, max }) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
          <span>${key}</span>
          <span id="v_${key}" style="color:var(--accent); font-weight:600;">${pos[key]}</span>
        </div>
        <input type="range" id="r_${key}" min="${min}" max="${max}" value="${pos[key]}" style="width:100%;" />
        <input type="number" id="n_${key}" min="${min}" max="${max}" value="${pos[key]}" style="width:100%; margin-top:4px; padding:6px; background:var(--bg-2); color:var(--text); border:1px solid var(--border); border-radius:6px;" />
      `;
      controlsEl.appendChild(wrap);
      const range = wrap.querySelector(`#r_${key}`);
      const num = wrap.querySelector(`#n_${key}`);
      const vLabel = wrap.querySelector(`#v_${key}`);
      const onChange = (val) => {
        const n = Number(val);
        if (!Number.isFinite(n)) return;
        pos[key] = n;
        range.value = n;
        num.value = n;
        vLabel.textContent = n;
        savePositions();
        renderTuner();
      };
      range.addEventListener('input', (e) => onChange(e.target.value));
      num.addEventListener('input', (e) => onChange(e.target.value));
    });
  }

  tunerBtn.addEventListener('click', () => {
    const visible = tuner.style.display !== 'none';
    tuner.style.display = visible ? 'none' : 'block';
    if (!visible) {
      populateTplSel();
      populateBarrelSel();
      buildControls();
      renderTuner();
    }
  });

  tplSel.addEventListener('change', () => { buildControls(); renderTuner(); });
  barrelSel.addEventListener('change', renderTuner);

  btnExport.addEventListener('click', () => {
    const lines = Object.entries(CFG.TEMPLATES).map(([name, c]) => {
      const key = /^[a-z_][a-z0-9_]*$/i.test(name) ? name : `'${name}'`;
      return `    ${key}: { unit: '${c.unit}', value: '${c.value}', left: ${c.left}, top: ${c.top}, width: ${c.width}, height: ${c.height} },`;
    });
    const snippet = `TEMPLATES: {\n${lines.join('\n')}\n  },`;
    navigator.clipboard.writeText(snippet).then(
      () => alert('Конфіг скопійовано в буфер. Вставте в config.js → BARREL_CONFIG.TEMPLATES'),
      () => {
        prompt('Скопіюйте вручну:', snippet);
      }
    );
  });

  btnReset.addEventListener('click', () => {
    if (!confirm('Скинути всі позиції до значень із config.js?')) return;
    localStorage.removeItem(LS_KEY);
    location.reload();
  });

  window.addEventListener('barrels-updated', () => {
    if (tuner.style.display !== 'none') {
      populateBarrelSel();
      renderTuner();
    }
  });
  fileInput.addEventListener('change', () => window.dispatchEvent(new Event('barrels-updated')));
  drop.addEventListener('drop', () => setTimeout(() => window.dispatchEvent(new Event('barrels-updated')), 0));
})();
