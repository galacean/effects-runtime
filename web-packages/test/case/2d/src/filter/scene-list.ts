export default {
  distortion: {
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*rEYJT47ECfwAAAAAAAAAAAAADlB4AQ',
    name: '扭曲',
    pass: true,
  },
  /* 需要打开父子节点颜色继承兼容代码的项目 */
  // delay: {
  //   url: 'https://mdn.alipayobjects.com/mars/afts/file/A*gk9bRYP5lDsAAAAAAAAAAAAADlB4AQ',
  //   name: '运动延迟',
  //   pass: true,
  // },
  /* ***************************** */
  gaussian: {
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*knVJTqJHrcEAAAAAAAAAAAAADlB4AQ',
    name: '高斯模糊',
    pass: true,
  },
  bloom: {
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*9IytQIW9BIMAAAAAAAAAAAAADlB4AQ',
    name: '发光  ',
    pass: true,
  },
  move: {
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*cToXSYDYhGUAAAAAAAAAAAAADlB4AQ',
    name: '镜头移动',
    pass: true,
  },
  // 为了解决android上的问题数据模板图片更新的提前了一帧，导致帧对比失败，待帧对比升级
  test1: {
    url: 'https://mdn.alipayobjects.com/mars/afts/file/A*kq3RR6188zIAAAAAAAAAAAAADlB4AQ',
    name: '数据模板案例',
    pass: true,
    accumRatioThreshold: 3e-4,
    pixelDiffThreshold: 5,
  },
};

