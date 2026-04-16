const BARREL_CONFIG = {
  TEMPLATES: {
    liters_1:     { unit: 'l', value: '1 л',   left: 238, top:  28, width: 200, height: 340 },
    'liters_1.5': { unit: 'l', value: '1.5 л', left: 260, top:  70, width: 180, height: 310 },
    liters_4:     { unit: 'l', value: '4 л',   left: 200, top:  55, width: 290, height: 325 },
    liters_5:     { unit: 'l', value: '5 л',   left: 190, top:  24, width: 310, height: 360 },
    liters_20:    { unit: 'l', value: '20 л',  left: 170, top:  25, width: 340, height: 370 },
    liters_60:    { unit: 'l', value: '60 л',  left: 200, top:  25, width: 270, height: 360 },
    liters_208:   { unit: 'l', value: '208 л', left: 210, top:  25, width: 260, height: 350 },

    'kg_0.4':     { unit: 'kg', value: '0.4 кг', left: 228, top:  24, width: 220, height: 340 },
    'kg_0.5':     { unit: 'kg', value: '0.5 кг', left: 209, top:  14, width: 240, height: 360 },
    'kg_0.6':     { unit: 'kg', value: '0.6 кг', left: 230, top:  40, width: 220, height: 340 },
    'kg_0.9':     { unit: 'kg', value: '0.9 кг', left: 222, top:  24, width: 220, height: 340 },
    kg_15:        { unit: 'kg', value: '15 кг',  left: 202, top:  25, width: 260, height: 340 },
    kg_25:        { unit: 'kg', value: '25 кг',  left: 170, top: -6, width: 340, height: 410 },
  },

  KG_MAP: {
    '400': '0.4 кг',
    '500': '0.5 кг',
    '600': '0.6 кг',
    '900': '0.9 кг',
    '015': '15 кг',
    '025': '25 кг',
  },
  LITERS_MAP: {
    '001': '1 л',
    '015': '1.5 л',
    '004': '4 л',
    '005': '5 л',
    '020': '20 л',
    '060': '60 л',
    '208': '208 л',
  },

  TEMPLATE_EXTS: ['png', 'jpg', 'jpeg'],
  JPG_QUALITY: 0.9,
};

if (typeof window !== 'undefined') {
  window.BARREL_CONFIG = BARREL_CONFIG;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BARREL_CONFIG;
}
