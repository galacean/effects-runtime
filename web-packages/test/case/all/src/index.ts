const urlList = [
  '/case/all/src/2d_inspire.html?webgl=1',
  '/case/all/src/2d_inspire.html?webgl=2',
  '/case/all/src/2d_other.html',
  '/case/all/src/3d.html',
  '/case/all/src/spine.html',
];

(async () => {
  const origin = window.location.origin;

  for (let i = 0; i < urlList.length; i++) {
    const url = urlList[i];
    const offset = i * 150;
    let features = 'popup=true';

    features += ', width=512';
    features += ', height=512';
    features += ', top=' + offset;
    features += ', left=' + offset;
    window.open(origin + url, 'mywindow' + i, features);
    await new Promise(resolve => {
      window.setTimeout(resolve, 3000);
    });
  }
})();
