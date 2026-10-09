/**
 * 返回数组中绝对值最大元素的索引
 * @param numbers 数值数组
 * @returns 绝对值最大元素的索引
 */
export function getAbsMaxIndex (numbers: number[]) {
  let resultIndex = 0;
  let max: number;

  numbers.forEach((number, index) => {
    if (index === 0) {
      max = Math.abs(number);
    } else {
      const absNumber = Math.abs(number);

      if (max < absNumber) {
        max = absNumber;
        resultIndex = index;
      }
    }
  });

  return resultIndex;
}
