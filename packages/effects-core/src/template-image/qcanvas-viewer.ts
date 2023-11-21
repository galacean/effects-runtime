import type { QText } from './qtext';

class QCanvasViewer {
  width: number;
  height: number;
  background: HTMLImageElement;
  scaleX: number;
  scaleY: number;
  renderCanvas: HTMLCanvasElement;
  renderContext: CanvasRenderingContext2D;
  textList: QText[] = [];
  devicePixelRatio: number;
  flipY: boolean;

  constructor (
    canvas: string | HTMLCanvasElement,
    width: number,
    height: number,
    scaleX?: number,
    scaleY?: number,
    flipY?: boolean,
  ) {
    let renderCanvas: HTMLCanvasElement;

    if (typeof canvas === 'string') {
      renderCanvas = document.getElementById(canvas) as HTMLCanvasElement;
    } else {
      renderCanvas = canvas;
    }

    // canvas缩放比例
    this.scaleX = scaleX ?? 1.0;
    this.scaleY = scaleY ?? 1.0;
    this.flipY = flipY ?? false;
    // 保存传入canvas宽度和高度信息
    this.width = width;
    this.height = height;

    // canvas的css尺寸
    renderCanvas.style.width = `${width * this.scaleX}px`;
    renderCanvas.style.height = `${height * this.scaleY}px`;

    // canvas的画布尺寸
    // const devicePixelRatio = window.devicePixelRatio ?? 1.0;
    const devicePixelRatio = 1;

    this.devicePixelRatio = devicePixelRatio;
    renderCanvas.width = devicePixelRatio * width * this.scaleX;
    renderCanvas.height = devicePixelRatio * height * this.scaleY;

    renderCanvas.className = 'lower-canvas';
    // renderCanvas.style.position = 'absolute';

    this.renderCanvas = renderCanvas;
    this.renderContext = this.renderCanvas.getContext('2d') as CanvasRenderingContext2D;

    // 画布坐标系需要进行比缩放（）
    this.renderContext.scale(devicePixelRatio * this.scaleX, devicePixelRatio * this.scaleY);
  }

  initDimension (width: number, height: number, scaleX?: number, scaleY?: number) {
    this.width = width;
    this.height = height;
    this.scaleX = scaleX ?? 1.0;
    this.scaleY = scaleY ?? 1.0;
    this.renderCanvas.style.width = `${width * this.scaleX}px`;
    this.renderCanvas.style.height = `${height * this.scaleY}px`;

    // 改变canvas的尺寸会导致重置画布的所有状态
    const devicePixelRatio = this.devicePixelRatio;

    this.renderCanvas.width = devicePixelRatio * width * this.scaleX;
    this.renderCanvas.height = devicePixelRatio * height * this.scaleY;

    if (this.flipY) {
      this.renderContext.translate(0, this.height);
      this.renderContext.scale(1, -1);
    }
    this.renderContext.scale(devicePixelRatio * this.scaleX, devicePixelRatio * this.scaleY);
  }

  clearText () {
    this.textList = [];
  }

  clearCanvasWithContext (ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, this.width, this.height);
  }

  clearCanvas () {
    this.clearCanvasWithContext(this.renderContext);
  }

  addObject (text: QText) {
    text.init(this);
    this.textList.push(text);
  }

  render () {
    // 清空画布
    this.clearCanvasWithContext(this.renderContext);

    this.renderContext.fillStyle = 'rgba(255, 255, 255, 0.0039)';
    this.renderContext.fillRect(0, 0, this.width, this.height);

    const image = this.background;

    if (image && image.width !== undefined && image.height !== undefined) {
      this.renderContext.drawImage(image, 0, 0, image.width, image.height, 0, 0, this.width, this.height);
    }

    for (let i = 0; i < this.textList.length; ++i) {
      this.renderContext.save();
      const text = this.textList[i];

      text.update();
      text.render();
      this.renderContext.restore();
    }
  }
}

export { QCanvasViewer };
