(() => {
  if (typeof Math.fround === 'undefined') {
    Math.fround = (function (array) {
      return function (x: number) {
        return array[0] = x, array[0];
      };
    })(new Float32Array(1));
  }
})();

export { };
