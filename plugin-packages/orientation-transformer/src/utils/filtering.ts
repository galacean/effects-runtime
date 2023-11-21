/**
 * 稳定区间
 */
const STABLE_RANGE = 3;
/**
 * 每次增幅的最大值
 */
const MAX_CHANGE = 5;
/**
 * 每次增幅的最小值
 */
const MIN_CHANGE = 1;
/**
 * 数据缓存队列的长度
 */
const VALUE_POOL_LENGTH = 5;

/**
 *
 */
type FilteringOptions = {
  /**
   * 稳定区间
   */
  stableRange?: number,
  /**
   * 最大变幅
   */
  maxChange?: number,
};

/**
 * 滤波方法
 */
export class Filtering {
  private lastValue = 0;
  private valuePool: number[] = [];

  constructor (
    private readonly options: FilteringOptions = {} as FilteringOptions,
  ) { }

  /**
   * 0deg 左右保持一定的稳定区间 STABLE_RANGE
   * - 小于 STABLE_RANGE 的算 0
   * - 大于 STABLE_RANGE 的减去 STABLE_RANGE
   * @param value - 输入值
   * @returns
   */
  stableFix (value: number) {
    const stableRange = this.options.stableRange || STABLE_RANGE;

    if (Math.abs(value) < stableRange) {
      return 0;
    }

    return value > stableRange ? value - stableRange : value + stableRange;
  }

  /**
   * 变幅限制
   * - 最大变化 MAX_CHANGE
   * - 最小变化 MIN_CHANGE
   * @param value
   * @returns
   */
  changeLimit (value: number) {
    const lastValue = this.lastValue;
    let result = value;

    if (Math.abs(value - lastValue) > MAX_CHANGE) {
      result = lastValue < value ? lastValue + MAX_CHANGE : lastValue - MAX_CHANGE;
    }
    if (Math.abs(value - lastValue) < MIN_CHANGE) {
      result = lastValue;
    }
    this.lastValue = result;

    return result;
  }

  linearRegressionMedian (value: number) {
    // 在队列中装载数据，达到队列阀值长度时开始计算
    this.valuePool.push(value);
    let result;

    if (this.valuePool.length >= VALUE_POOL_LENGTH) {
      result = getLinearRegressionFixedVal(this.valuePool);
      this.valuePool.shift();
    } else {
      result = this.lastValue;
    }

    return result;
  }
}

// 计算出线性回归参数
function linearRegression (x: number[], y: number[]) {
  const result: Record<string, number> = {};
  const n = y.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (let i = 0; i < y.length; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += (x[i] * y[i]);
    sumXX += (x[i] * x[i]);
    sumYY += (y[i] * y[i]);
  }

  const avgX = sumX / n;
  const avgY = sumY / n;

  result['a'] = (sumXY - n * avgX * avgY) / (sumXX - n * avgX * avgX);
  result['b'] = avgY - result.a * avgX;
  result['miss'] = Math.pow((n * sumXY - sumX * sumY) / Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY)), 2);

  return result;
}

// 生成线性回归函数 F(x) = ax + b
function createLinearRegressionFx (values: number[]) {
  const x: number[] = [];
  const y: number[] = [];

  values.forEach((item, index) => {
    x.push(index); // 数据是连续的，所以直接取数组下标为 x
    y.push(item);
  });
  const key = linearRegression(x, y);

  return (x: number) => {
    return key.a * x + key.b;
  };
}

// 获取线性回归后的中位数
function getLinearRegressionFixedVal (valuePool: number[]) {
  const fx = createLinearRegressionFx(valuePool);

  // 这个迭代修正很重要
  valuePool = valuePool.map((item, index) => {
    return fx(index);
  });

  return fx(valuePool.length / 2);
}
