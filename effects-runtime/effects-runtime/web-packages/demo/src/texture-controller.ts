/* eslint-disable no-console */
// 调试模式开关
const DEBUG = true;

enum MainStage { Listening, Input, Stop }
enum TexFadeStage { Hidden, FadingIn, Showing, FadingOut }

interface TexState {
  x: number,                     // 横向位置
  stage: TexFadeStage,           // 当前透明阶段
  alpha: number,                 // 当前透明度
  time: number,                  // 当前阶段内时间
  life: number,                  // 累计生存时间
  startedAt: number,             // 全局计时起始
  duration: number,              // 整体存在时长
}

export class TextureController {
  textures: TexState[] = [];
  mainStage: MainStage = MainStage.Listening;
  pendingLoop: boolean = false;
  timer: number = 0;
  volumeThreshold: number = 0.1; // 降低阈值提高灵敏度

  // 第一阶段参数
  listeningDuration = 3.4;
  movingDistance = 200;
  fadeInMs = 0.6;
  fadeOutStart = 2.4;
  fadeOutEnd = 3.4;

  // 第二阶段参数
  inputDuration = 2.4;
  inputDistance = 400;
  textureInterval = 0.5; // 第二张纹理的生成时间(秒)
  fadeInA = 0.4;
  fadeOutStartA = 1.9; // A消隐期开始
  fadeOutB = 1.9; // B消隐起始（纹理2）

  onStage: (stage: MainStage) => void = () => {};
  onUpdate: (textures: TexState[]) => void = () => {};

  constructor () {}

  resetToListening (now: number) {
    // eslint-disable-next-line no-console
    console.log('重置到监听阶段');
    this.mainStage = MainStage.Listening;
    this.pendingLoop = false;
    this.timer = 0;

    // 确保textures数组被正确初始化
    this.textures = [{
      x: 0,
      stage: TexFadeStage.FadingIn,
      alpha: 0,
      time: 0,
      life: 0,
      startedAt: now,
      duration: this.listeningDuration,
    }];

    // eslint-disable-next-line no-console
    console.log('初始化textures:', this.textures);
    this.onStage(MainStage.Listening);
  }

  triggerInputStage (now: number) {
    // eslint-disable-next-line no-console
    console.log('触发输入阶段');
    this.mainStage = MainStage.Input;
    this.pendingLoop = false;
    this.timer = 0;
    this.textures = [{
      x: 0,
      stage: TexFadeStage.FadingIn,
      alpha: 0,
      time: 0,
      life: 0,
      startedAt: now,
      duration: this.inputDuration,
    }];
    this.onStage(MainStage.Input);
  }

  stop () {
    this.mainStage = MainStage.Stop;
    this.textures = [];
    this.onStage(MainStage.Stop);
  }

  update (delta: number, volume: number, now: number) {
    this.timer += delta;

    // 第一阶段：监听逻辑
    if (this.mainStage === MainStage.Listening) {
      const t = this.timer;

      if (!this.textures.length) {
        return;
      }
      const tex = this.textures[0];

      tex.life += delta;
      tex.x = this.movingDistance - (t / this.listeningDuration) * this.movingDistance;

      if (t <= this.fadeInMs) {
        tex.stage = TexFadeStage.FadingIn;
        tex.alpha = t / this.fadeInMs;
      } else if (t > this.fadeInMs && t < this.fadeOutStart) {
        tex.stage = TexFadeStage.Showing;
        tex.alpha = 1;
      } else if (t >= this.fadeOutStart && t <= this.fadeOutEnd) {
        tex.stage = TexFadeStage.FadingOut;
        tex.alpha = 1 - (t - this.fadeOutStart) / (this.fadeOutEnd - this.fadeOutStart);
      } else if (t > this.fadeOutEnd) {
        tex.alpha = 0;
      }

      // 音量判断触发第二阶段
      if (t >= this.fadeOutStart && t < this.fadeOutEnd) {
        if (volume > this.volumeThreshold) {
          this.pendingLoop = true;
          // eslint-disable-next-line no-console
          console.log(`音量${volume}超过阈值${this.volumeThreshold}, 准备进入输入阶段`);
        } else {
          this.pendingLoop = false;
        }
      }

      if (t > this.fadeOutEnd) {
        if (this.pendingLoop) {
          this.triggerInputStage(now);
        } else {
          this.resetToListening(now);
        }
      }
    } else if (this.mainStage === MainStage.Input) {
    // 第二阶段：纹理叠加逻辑
      const tA = this.timer;

      if (!this.textures.length) {
        return;
      }
      const texA = this.textures[0];

      texA.life = tA;
      texA.x = this.inputDistance - (tA / texA.duration) * this.inputDistance;

      if (tA < this.fadeInA) {
        texA.alpha = tA / this.fadeInA;
      } else if (tA < this.fadeOutStartA) {
        texA.alpha = 1;
      } else if (tA < texA.duration) {
        texA.alpha = 1 - (tA - this.fadeOutStartA) / (texA.duration - this.fadeOutStartA);
      } else {
        texA.alpha = 0;
      }

      // 在0.5s时生成第二纹理
      if (!this.textures[1] && tA >= this.textureInterval) {
        if (typeof DEBUG !== 'undefined' && DEBUG) {
          // eslint-disable-next-line no-console
          if (DEBUG) {
            console.log(`生成第二纹理，当前时间: ${tA.toFixed(2)}s`);
          }
        }
        this.textures[1] = {
          x: 0,
          stage: TexFadeStage.FadingIn,
          alpha: 0,
          time: 0,
          life: 0,
          startedAt: now,
          duration: this.inputDuration,
        };
      }

      const texB = this.textures[1];

      if (texB) {
        const tB = tA - this.textureInterval;

        texB.life = tB;
        texB.x = this.inputDistance - (tB / texB.duration) * this.inputDistance;

        if (tB < 0) {
          texB.alpha = 0;
        } else if (tB < this.textureInterval) {
          texB.alpha = tB / this.textureInterval;
        } else if (tB < this.fadeOutB) {
          texB.alpha = 1;
        } else if (tB < texB.duration) {
          texB.alpha = 1 - (tB - this.fadeOutB) / (texB.duration - this.fadeOutB);
        } else {
          texB.alpha = 0;
        }
      }

      // 在1.9s时检测音量
      if (tA >= this.fadeOutStartA && !this.pendingLoop) {
        this.pendingLoop = volume > this.volumeThreshold;
        if (DEBUG) {
          // eslint-disable-next-line no-console
          if (DEBUG) {
            console.log(`音量检测: ${volume.toFixed(2)} > ${this.volumeThreshold} = ${this.pendingLoop}`);
          }
        }
      }

      // 动画结束处理
      if (tA >= this.inputDuration) {
        if (this.pendingLoop) {
          this.triggerInputStage(now);
          if (DEBUG) {
            // eslint-disable-next-line no-console
            if (DEBUG) {
              console.log('触发新的输入阶段循环');
            }
          }
        } else {
          this.stop();
          if (DEBUG) {
            // eslint-disable-next-line no-console
            if (DEBUG) {
              console.log('动画结束');
            }
          }
        }
      }
    }

    this.onUpdate(this.textures);
  }
}
