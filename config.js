const BARREL_CONFIG = {
  TEMPLATES: {
    liters_1:     { unit: 'l', value: '1 л',   left: 260, top:  60, width: 180, height: 320 },
    'liters_1.5': { unit: 'l', value: '1.5 л', left: 260, top:  70, width: 180, height: 310 },
    liters_4:     { unit: 'l', value: '4 л',   left: 200, top:  55, width: 290, height: 325 },
    liters_5:     { unit: 'l', value: '5 л',   left: 200, top:  40, width: 290, height: 340 },
    liters_20:    { unit: 'l', value: '20 л',  left: 210, top:  80, width: 260, height: 290 },
    liters_60:    { unit: 'l', value: '60 л',  left: 210, top:  25, width: 270, height: 360 },
    liters_208:   { unit: 'l', value: '208 л', left: 200, top:  15, width: 280, height: 370 },
  },

  KG_MAP: {
    '400': '0.4 кг',
    '500': '0.5 кг',
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
