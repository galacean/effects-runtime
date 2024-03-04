/**
 * 双状态 Set，用于保存前一帧和当前帧的信息
 */
export class TwoStatesSet<T> {
  /**
   * 当前帧 Set
   */
  now: Set<T>;
  /**
   * 前一帧 Set
   */
  last: Set<T>;

  constructor () {
    this.now = new Set();
    this.last = new Set();
  }

  /**
   * 清空 last 和 now
   */
  clear () {
    this.now.clear();
    this.last.clear();
  }

  /**
   * 状态前进，当前变成 last，now 被清空
   */
  forward () {
    const temp = this.last;

    this.last = this.now;
    this.now = temp;
    this.now.clear();
  }

  /**
   * 遍历当前帧新加的元素
   * @param callbackfn - 增加新元素的回调
   */
  forAddedItem (callbackfn: (value: T) => void) {
    this.now.forEach(item => {
      if (!this.last.has(item)) {
        callbackfn(item);
      }
    });
  }

  /**
   * 遍历当前帧删除的元素
   * @param callbackfn - 删除旧元素的回调
   */
  forRemovedItem (callbackfn: (value: T) => void) {
    this.last.forEach(item => {
      if (!this.now.has(item)) {
        callbackfn(item);
      }
    });
  }

}
