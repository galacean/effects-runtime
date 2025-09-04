import type { Asset } from '@galacean/effects';
import { effectsClass, RendererComponent, spec } from '@galacean/effects';
import { AudioPlayer } from './audio-player';

@effectsClass(spec.DataType.AudioComponent)
export class AudioComponent extends RendererComponent {
  audioPlayer: AudioPlayer;

  private isVideoPlay = false;
  private threshold = 0.03;

  override onAwake (): void {
    super.onAwake();

    this.item.composition?.on('play', () => {
      this.audioPlayer.play();
    });

    this.item.composition?.on('pause', () => {
      this.audioPlayer.pause();
    });

    this.item.composition?.on('goto', (option: { time: number }) => {
      if (option.time > 0) {
        const { endBehavior, start, duration } = this.item;

        if (endBehavior === spec.EndBehavior.freeze || endBehavior === spec.EndBehavior.restart) {
          this.audioPlayer.setCurrentTime((option.time - start) % duration);
        } else {
          if (option.time >= duration) {
            this.onDisable();
          } else {
            this.audioPlayer.setCurrentTime(option.time - start);
          }
        }
      }
    });
  }

  override onUpdate (dt: number): void {
    super.onUpdate(dt);

    const { duration, endBehavior } = this.item;

    this.audioPlayer.setOptions({
      duration,
      endBehavior,
    });
  }

  override fromData (data: spec.AudioComponentData): void {
    super.fromData(data);

    const { options } = data;
    const { playbackRate = 1, muted = false, volume = 1 } = options;
    let audio: AudioBuffer | HTMLAudioElement | undefined = undefined;

    if (options.audio) {
      const audioAsset = this.engine.findObject<Asset<HTMLAudioElement | AudioBuffer>>(options.audio);

      audio = audioAsset.data;
    }

    this.audioPlayer = new AudioPlayer(this.engine, audio);
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
