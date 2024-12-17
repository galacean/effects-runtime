const urlList = [
  '/case/2d.html',
  '/case/3d.html',
  '/case/spine.html',
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
