import type { Asset } from '@galacean/effects';
import { effectsClass, RendererComponent, spec } from '@galacean/effects';
import { AudioPlayer } from './audio-player';

@effectsClass(spec.DataType.AudioComponent)
export class AudioComponent extends RendererComponent {
  audioPlayer: AudioPlayer;

  private isVideoPlay = false;
  private threshold = 0.03;

  override onUpdate (dt: number): void {
    super.onUpdate(dt);

    const { time, duration, endBehavior } = this.item;

    this.audioPlayer.setOptions({
      duration,
      endBehavior,
    });

    if (time >= 0 && !this.isVideoPlay) {
      this.audioPlayer.play();
      this.isVideoPlay = true;
    }

    if (Math.abs(time - duration) < this.threshold) {
      if (endBehavior === spec.EndBehavior.destroy) {
        this.audioPlayer.pause();
      }
    }
  }

  override fromData (data: spec.AudioComponentData): void {
    super.fromData(data);

    const { options } = data;
    const { playbackRate = 1, muted = false, volume = 1 } = options;

    const audioAsset = this.engine.findObject<Asset<HTMLAudioElement | AudioBuffer>>(options.audio);

    this.audioPlayer = new AudioPlayer(audioAsset.data, this.engine);
    this.audioPlayer.pause();
    this.setPlaybackRate(playbackRate);
    this.setMuted(muted);
    this.setVolume(volume);
  }

  /**
   * 设置音频资源
   * @param audio - 音频资源
   */
  setAudioSource (audio: HTMLAudioElement | AudioBuffer): void {
    this.audioPlayer.setAudioSource(audio);
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

  override onDisable (): void {
    super.onDisable();

    this.audioPlayer.pause();
  }

  override dispose (): void {
    super.dispose();

    this.audioPlayer.dispose();
  }
}
