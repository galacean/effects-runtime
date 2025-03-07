export class MaskRefManager {
  currentRef: number;

  constructor (initRef?: number) {
    this.currentRef = initRef || 0;
  }

  distributeRef () {
    return ++this.currentRef;
  }
}

