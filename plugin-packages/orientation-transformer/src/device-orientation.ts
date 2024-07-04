import { assertExist } from '@galacean/effects';
import { angleLimit, type AngleType } from './utils/angle-limit';
import { isIOS, isMiniProgram } from './utils/device';
import { Filtering } from './utils/filtering';

type JSBridgeParam = {
  x: number,
  y: number,
  z: number,
};

type WindVaneParams = {
  x: number,
  y: number,
  z: number,
};

const useJSBridge = isIOS() && typeof window.AlipayJSBridge !== 'undefined';
const useWindVane = typeof window.WindVane !== 'undefined';

export type DeviceOrientationOptions = {
  X?: boolean,
  Y?: boolean,
  /**
   * 监听时间片段（一秒30帧）
   */
  interval?: number,
  /**
   * 使用 requestAnimationFrame 对齐
   */
  useRequestAnimationFrame?: boolean,
  /**
   * bate 角度使用相对初始化的
   */
  relativeBeta?: boolean,
  /**
   * gamma 角度使用相对初始化的
   */
  relativeGamma?: boolean,
  /**
   * 限制 3d 角度范围
   */
  validRange: {
    /**
     * 相对范围
     */
    alpha: number[],
    /**
     * 上下翻转
     */
    beta: number[],
    /**
     * 左右翻转
     */
    gamma: number[],
  },
  /**
   * 稳定区间
   */
  stableRange: number,
};

// 默认参数
const defaultOptions = {
  X: true,
  Y: true,
  interval: Math.floor(1000 / 30),
  useRequestAnimationFrame: true,
  relativeBeta: false,
  relativeGamma: false,
  validRange: {
    alpha: [-60, 60],
    beta: [-60, 180],
    gamma: [-89, 89],
  },
  stableRange: 3,
};

export class DeviceOrientation {
  private options: Required<DeviceOrientationOptions>;
  private lastX = 0;
  private lastY = 0;
  private prevAcceler = {
    x: 0,
    y: 0,
    z: 0,
  };
  private stoped = false;
  private readonly filterX: Filtering;
  private readonly filterY: Filtering;
  private watchListener?: (e: DeviceOrientationEvent | Event) => void;

  constructor (options: Record<string, any> = {}) {
    // 模拟简单的 deep merge
    const validRange = { ...defaultOptions.validRange, ...options.validRange };
    const mergeOptions = { ...defaultOptions, ...options };

    mergeOptions.validRange = validRange;
    this.options = mergeOptions;

    const { stableRange } = this.options;

    this.filterX = new Filtering({ stableRange });
    this.filterY = new Filtering({ stableRange });
  }

  watch (callback: (x: number, y: number, data: AngleType) => void) {
    if (typeof callback !== 'function') {
      return;
    }
    // 目前只能绑定一个方法，此处可以扩展成一个方法队列
    if (this.watchListener) {
      return;
    }

    let timefragment = 0; // 时间片计时
    let nowts = 0; // 当前时间
    // 初始化角度，作为单独一个用户的空间旋转的参照
    let referGamma = NaN, referBeta = NaN, referAlpha = NaN;
    let alpha: number;
    let beta: number;
    let gamma: number;
    let isInValidDegRange;
    let x: number; // 最终输出的 x
    let y: number; // 最终输出的 y
    const handleWatch = (e: Pick<DeviceOrientationEvent, 'alpha' | 'beta' | 'gamma'>) => {
      if (this.stoped) {
        return;
      }
      alpha = e.alpha!; // 垂直于屏幕的轴 0 ~ 360
      beta = e.beta!; // 横向 X 轴 -180 ~ 180
      gamma = e.gamma!; // 纵向 Y 轴 -90 ~ 90

      isInValidDegRange = angleLimit.call(this, {
        alpha,
        beta,
        gamma,
      }, this.options.validRange);

      // 对 alpha beta gamma 初始化位置
      if (isNaN(referAlpha)) {
        referAlpha = alpha || 0;
      }
      if (isNaN(referGamma)) {
        referGamma = gamma;
        this.filterX.lastValue = gamma;
      }
      if (isNaN(referBeta)) {
        referBeta = beta;
        this.filterY.lastValue = beta;
      }
      if (isInValidDegRange) {
        // 最终结果值
        if (this.options.X) {
          x = this.options.relativeGamma ? gamma - referGamma : gamma;
          x = this.filterX.stableFix(x);
          x = this.filterX.changeLimit(x);
          x = this.filterX.linearRegressionMedian(+x);
        } else {
          x = 0;
        }
        if (this.options.Y) {
          y = this.options.relativeBeta ? beta - referBeta : beta;
          y = this.filterY.stableFix(y);
          y = this.filterY.changeLimit(y);
          y = this.filterY.linearRegressionMedian(+y);
        } else {
          y = 0;
        }

        if (this.isValid(x, y)) {
          if (this.options.useRequestAnimationFrame) {
            window.requestAnimationFrame(() => {
              callback(x, y, { alpha, beta: y - referBeta, gamma: x - referGamma });
            });
          } else {
            callback(x, y, { alpha, beta: y - referBeta, gamma: x - referGamma });
          }
          this.lastX = x;
          this.lastY = y;
        }
      }
    };

    // 针对不同平台绑定不同事件
    this.stoped = false;
    if (useWindVane) {
      switchWindVane(true, this.options.interval);
      this.watchListener = (e: Event) => {
        if ('param' in e) {
          const { x, y, z } = e.param as WindVaneParams;

          // 即使手机没动，也会不停触发，所以这里加个判断，值相等则不调用回调
          if (x === this.prevAcceler.x && y === this.prevAcceler.y && z === this.prevAcceler.z) {
            return;
          }
          this.prevAcceler = { x, y, z };
          const evt = {
            alpha: +z * 180,
            beta: +y * -90,
            gamma: +x * 90,
          };

          handleWatch(evt);
        }
      };
      document.addEventListener('motion.gyro', this.watchListener, false);
    } else if (useJSBridge && !isMiniProgram()) {
      switchIOSEvent(true, this.options.interval / 1000);
      this.watchListener = (e: Event) => {
        if (e && 'data' in e) {
          /*
          data:
          {
            data: {
              x: 0.0, // gamma -1 ~ 1
              y: 0.0, // beta -1 ~ 1
              z: 0.0, // alpha
            }
          }
          */
          const { x, y, z } = e.data as JSBridgeParam;
          const evt = {
            alpha: z * 180,
            beta: y * -90,
            gamma: x * 90,
          };

          handleWatch(evt);
        }
      };
      document.addEventListener('accelerometerChange', this.watchListener, false);
    } else {
      this.watchListener = (e: DeviceOrientationEvent | Event) => {
        nowts = new Date().getTime();
        // 控制时间片
        if (nowts - timefragment >= this.options.interval) {
          timefragment = nowts;
          handleWatch(e as DeviceOrientationEvent);
        }
      };
      window.addEventListener('deviceorientation', this.watchListener, false);
    }
  }

  unWatch () {
    assertExist(this.watchListener);
    if (useWindVane) {
      switchWindVane(false);
      document.removeEventListener('motion.gyro', this.watchListener);
    } else if (useJSBridge) {
      switchIOSEvent(false);
      document.removeEventListener('accelerometerChange', this.watchListener);
    } else {
      window.removeEventListener('deviceorientation', this.watchListener);
    }
    this.stoped = true;
    this.watchListener = undefined;
  }

  pause () {
    this.stoped = true;
    if (useJSBridge) {
      switchIOSEvent(false);
    }
  }

  continue () {
    this.stoped = false;
    if (useJSBridge) {
      switchIOSEvent(true, this.options.interval / 1000);
    }
  }

  private isValid (x: number, y: number) {
    // 判断是否和上次的值一样，检测有没有变
    return this.lastX !== x || this.lastY !== y;
  }
}

// 开启/关闭 iOS 的陀螺仪监听
function switchIOSEvent (open: boolean, interval?: number) {
  window.AlipayJSBridge.call(
    'watchShake',
    {
      monitorGyroscope: false,
      monitorAccelerometer: !!open,
      interval: !open ? 10 : parseFloat(interval!.toFixed(3)),
    },
    () => { }
  );
}

function switchWindVane (open: boolean, interval?: number) {
  const params = {
    // 是开启还是关闭陀螺仪的监听
    on: open,
    // 陀螺仪事件的时间间隔
    frequency: interval,
  };

  window.WindVane.call('WVMotion', 'listenGyro', params, (e: Event) => {
    console.info('Call WVMotion success.');
  }, (e: Event) => {
    console.error(`Call WVMotion failed: ${JSON.stringify(e)}.`);
  });
}
