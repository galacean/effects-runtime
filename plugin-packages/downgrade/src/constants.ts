/**
 * 部分手机厂商和 iPhone 机型列表
 */
export const infoList = {
  vender: [
    'SAMSUNG',
  ],
  iPhone: [
    { name: 'iPhone 15 Pro Max', model: 'iPhone16,2', width: 1290, height: 2796 },
    { name: 'iPhone 15 Pro', model: 'iPhone16,1', width: 1179, height: 2556 },
    { name: 'iPhone 15 Plus', model: 'iPhone15,5', width: 1290, height: 2796 },
    { name: 'iPhone 15', model: 'iPhone15,4', width: 1179, height: 2556 },
    { name: 'iPhone 14 Pro Max', model: 'iPhone15,3', width: 1290, height: 2796 },
    { name: 'iPhone 14 Pro', model: 'iPhone15,2', width: 1179, height: 2556 },
    { name: 'iPhone 14 Plus', model: 'iPhone14,8', width: 1284, height: 2778 },
    { name: 'iPhone 14', model: 'iPhone14,7', width: 1170, height: 2532 },
    { name: 'iPhone 13 Pro Max', model: 'iPhone14,3', width: 1284, height: 2778 },
    { name: 'iPhone 13 Pro', model: 'iPhone14,2', width: 1170, height: 2532 },
    { name: 'iPhone 13', model: 'iPhone14,5', width: 1170, height: 2532 },
    { name: 'iPhone 13 mini', model: 'iPhone14,4', width: 1080, height: 2340 },
    { name: 'iPhone SE (3rd gen)', model: 'iPhone14,6', width: 750, height: 1334 },
    { name: 'iPhone 12 Pro Max', model: 'iPhone13,4', width: 1284, height: 2778 },
    { name: 'iPhone 12 Pro', model: 'iPhone13,3', width: 1170, height: 2532 },
    { name: 'iPhone 12', model: 'iPhone13,2', width: 1170, height: 2532 },
    { name: 'iPhone 12 mini', model: 'iPhone13,1', width: 1080, height: 2340 },
    { name: 'iPhone 11 Pro Max', model: 'iPhone12,5', width: 1242, height: 2688 },
    { name: 'iPhone 11 Pro', model: 'iPhone12,3', width: 1125, height: 2436 },
    { name: 'iPhone 11', model: 'iPhone12,1', width: 828, height: 1792 },
    { name: 'iPhone SE (2nd gen)', model: 'iPhone12,8', width: 750, height: 1334 },
    { name: 'iPhone XR', model: 'iPhone11,8', width: 828, height: 1792 },
    { name: 'iPhone XS Max', model: 'iPhone11,6', width: 1242, height: 2688 },
    { name: 'iPhone XS', model: 'iPhone11,2', width: 1125, height: 2436 },
    { name: 'iPhone X', model: 'iPhone10,3', width: 1125, height: 2436 },
    { name: 'iPhone 8 Plus', model: 'iPhone10,2', width: 1080, height: 1920 },
    { name: 'iPhone 8', model: 'iPhone10,1', width: 750, height: 1334 },
    { name: 'iPhone 7 Plus', model: 'iPhone9,2', width: 1080, height: 1920 },
    { name: 'iPhone 7', model: 'iPhone9,1', width: 750, height: 1334 },
    { name: 'iPhone 6s Plus', model: 'iPhone8,2', width: 1080, height: 1920 },
    { name: 'iPhone 6s', model: 'iPhone8,1', width: 750, height: 1334 },
    { name: 'iPhone SE (1st gen)', model: 'iPhone8,4', width: 640, height: 1136 },
    { name: 'iPhone 6 Plus', model: 'iPhone7,1', width: 1080, height: 1920 },
    { name: 'iPhone 6', model: 'iPhone7,2', width: 750, height: 1334 },
    { name: 'iPhone 5C', model: 'iPhone5,3', width: 640, height: 1136 },
    { name: 'iPhone 5S', model: 'iPhone6,1', width: 640, height: 1136 },
    { name: 'iPhone 5', model: 'iPhone5,1', width: 640, height: 1136 },
    { name: 'iPhone 4S', model: 'iPhone4,1', width: 640, height: 960 },
    { name: 'iPhone 4', model: 'iPhone3,1', width: 640, height: 960 },
    { name: 'iPhone 3GS', model: 'iPhone2,1', width: 320, height: 480 },
    { name: 'iPhone 3G', model: 'iPhone1,2', width: 320, height: 480 },
    { name: 'iPhone 1st gen', model: 'iPhone1,1', width: 320, height: 480 },
  ],
};

/**
 * 被降级的硬件机型列表
 */
export const downgradeModels = {
  android: [
    'OPPO R9s Plus',
    'GM1910',
    'V1824A',
    'V1916A', // checked
    'SM-G9650', // checked
    'V1936A',
    'MI9 PRO 5G', // checked
    'REDMI K20',
    'V1914A',
    'GM1900',
    'RMX1971',
    'SM-A6060',
    'SM-G9600', // checked
    'V1922A',
    'PBAM00', // checked
    'PCAM10', // checked
    'PACT00', // checked
    'PBBM00',
    'PCEM00',
    'V1818A', // checked
    'vivo X6A',
    'vivo X6Plus A',
  ],
  iPhone: [
    'iPhone8,4',
    'iPhone8,2',
    'iPhone8,1',
    'iPhone7,2',
    'iPhone7,1',
    'iPhone6,2',
    'iPhone6,1',
    'iPhone5,4',
    'iPhone5,3',
    'iPhone5,2',
    'iPhone5,1',
    'iPhone4,3',
    'iPhone4,2',
    'iPhone4,1',
    'iPhone3,3',
    'iPhone3,2',
    'iPhone3,1',
    'iPhone2,1',
    'iPhone1,2',
    'iPhone1,1',
  ],
};

/**
 * 被降级的系统版本列表
 */
export const downgradeVersions = {
  android: [],
  iOS: [
    '16.7',
    '16.7.1',
    '16.7.2',
    '16.7.3',
    '16.7.4',
    '16.7.5',
    '16.7.6',
  ],
};

/**
 * 微信开发环境机型名称替换表
 */
export const devtoolNameMap: Record<string, Record<string, string>> = {
  wechat: {
    'iPhone 6/7/8': 'iPhone 8',
    'iPhone 6/7/8 Plus': 'iPhone 8 Plus',
    'iPhone 12/13 mini': 'iPhone 13 mini',
    'iPhone 12/13 (Pro)': 'iPhone 13 Pro',
    'iPhone 12/13 Pro Max': 'iPhone 13 Pro Max',
  },
};
