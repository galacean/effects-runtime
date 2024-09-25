import type { Engine } from '@galacean/effects';
import { Component, effectsClass, spec } from '@galacean/effects';
import { AudioPlayer } from './audio-player';

@effectsClass(spec.DataType.AudioComponent)
export class AudioComponent extends Component {
  audioPlayer: AudioPlayer;
  private isVideoPlay = false;

  constructor (engine: Engine) {
    super(engine);
  }

  override onStart (): void {
    super.onStart();
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);
    const { time } = this.item;

    if (time >= 0 && !this.isVideoPlay) {
      this.audioPlayer.play();
      this.isVideoPlay = true;
    }
  }

  override fromData (data: any): void {
    super.fromData(data);
    const { endBehavior, duration, start } = this.item;
    const { options } = data;

    this.audioPlayer = new AudioPlayer({ audio: options.audio.data, endBehavior, duration, start }, this.engine);
    this.audioPlayer.pause();

  }

  override onEnable (): void {
    super.onEnable();
    // this.audioPlayer.play();
  }

  override onDestroy (): void {
    super.onDestroy();
    //this.audioPlayer.destroy();
  }

  /**
   * 设置音量
   * @param volume - 音量
   */
  setVolume (volume: number): void {
    this.audioPlayer.setVolume(volume);
  }

  /**
   * 获取当前音频的播放时刻
   */
  getCurrentTime (): number {
    return this.audioPlayer.getCurrentTime();
  }

  /**
   * 设置是否静音
   * @param muted - 是否静音
   */
  setMuted (muted: boolean): void {
    this.audioPlayer.setMuted(muted);
  }

  /**
   * 设置是否循环播放
   * @param loop - 是否循环播放
   */
  setLoop (loop: boolean): void {
    this.audioPlayer.setLoop(loop);
  }

  /**
   * 设置播放速率
   * @param rate - 播放速率
   */
  setPlaybackRate (rate: number): void {
    this.audioPlayer.setPlaybackRate(rate);
  }
}
