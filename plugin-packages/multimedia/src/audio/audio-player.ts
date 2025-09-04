import type { Engine } from '@galacean/effects';
import { spec } from '@galacean/effects';

interface AudioSourceInfo {
  source?: AudioBufferSourceNode,
  audioContext?: AudioContext,
  gainNode?: GainNode,
}

export interface AudioPlayerOptions {
  endBehavior: spec.EndBehavior,
  duration: number,
}

export class AudioPlayer {
  audio?: HTMLAudioElement;
  audioSourceInfo: AudioSourceInfo = {};
  private pendingOffset = 0;
  private isSupportAudioContext = !!window['AudioContext'];
  private options: AudioPlayerOptions = {
    endBehavior: spec.EndBehavior.destroy,
    duration: 0,
  };
  private destroyed = false;
  private started = false;
  private initialized = false;
  private currentVolume = 1;

  constructor (
    private engine: Engine,
    audio?: AudioBuffer | HTMLAudioElement,
  ) {
    if (audio) {
      this.setAudioSource(audio);
    }
  }

  /**
   * 设置音频资源
   * @param audio - 音频资源
   */
  setAudioSource (audio: AudioBuffer | HTMLAudioElement) {
    if (this.audio || this.audioSourceInfo.source) {
      this.dispose();
    }
    if (audio instanceof AudioBuffer) {
      const audioContext = new AudioContext();
      const gainNode = audioContext.createGain();

      gainNode.connect(audioContext.destination);

      const source = audioContext.createBufferSource();

      source.buffer = audio;
      source.connect(gainNode);

      this.audioSourceInfo = {
        source,
        audioContext,
        gainNode,
      };
    } else {
      this.audio = audio;
    }
    if (this.started) {
      this.play();
    }
  }

  getCurrentTime (): number {
    if (this.isSupportAudioContext) {
      const { audioContext } = this.audioSourceInfo;

      return audioContext?.currentTime || 0;
    } else {
      return this.audio?.currentTime || 0;
    }
  }

  setCurrentTime (time: number) {
    const t = Math.max(0, time);

    if (this.isSupportAudioContext) {
      const { audioContext, source, gainNode } = this.audioSourceInfo;

      if (!audioContext || !gainNode) {
        this.pendingOffset = t;

        return;
      }

      const buffer = source?.buffer;

      if (!buffer) {
        this.pendingOffset = t;

        return;
      }

      const maxDuration = this.options.duration && this.options.duration > 0
        ? this.options.duration
        : buffer.duration;
      const offset = Math.min(t, maxDuration);

      // 保险起见，先停掉旧 source，吞掉异常（旧节点是否成功 stop 不影响后续逻辑）
      // eslint-disable-next-line no-empty
      try { source?.stop(); } catch {}

      // 由于BufferSource只能start一次，所以创建新的 BufferSource，并继承旧参数
      const newSource = audioContext.createBufferSource();

      newSource.buffer = buffer;
      newSource.connect(gainNode);
      newSource.playbackRate.value = source?.playbackRate.value ?? 1;
      newSource.loop = source?.loop ?? false;
      newSource.loopStart = source?.loopStart ?? 0;
      newSource.loopEnd = source?.loopEnd ?? maxDuration;

      this.audioSourceInfo.source = newSource;
      this.pendingOffset = offset;

      // 如果之前已经播放过，则立即从新位置开始
      if (this.started) {
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(e => this.engine.renderErrors.add(e));
        }
        try {
          newSource.start(0, offset);
        } catch (e) {
          this.engine.renderErrors.add(e as Error);
        }
      }
    } else {
      if (this.audio) {
        const dur = Number.isFinite(this.audio.duration) ? this.audio.duration : undefined;
        const clamped = dur ? Math.min(t, dur) : t;

        this.audio.currentTime = clamped;
      }
    }
  }

  play (): void {
    if (this.isSupportAudioContext) {
      const { audioContext, source, gainNode } = this.audioSourceInfo;

      if (!audioContext || !gainNode) {return;}

      const buffer = source?.buffer;

      if (!buffer) {return;}

      const maxDuration = this.options.duration && this.options.duration > 0 ? this.options.duration : buffer.duration;

      // 保险起见，先停掉旧 source，吞掉异常（旧节点是否成功 stop 不影响后续逻辑）
      // eslint-disable-next-line no-empty
      try { source?.stop(); } catch {}

      // 由于BufferSource只能start一次，所以新建一个BufferSource
      const newSource = audioContext.createBufferSource();

      newSource.buffer = buffer;
      newSource.connect(gainNode);

      // 继承旧的播放参数
      newSource.playbackRate.value = source?.playbackRate.value ?? 1;

      if (this.options.endBehavior === spec.EndBehavior.restart) {
        newSource.loop = true;
        newSource.loopStart = 0;
        newSource.loopEnd = maxDuration;
      } else {
        newSource.loop = source?.loop ?? false;
        newSource.loopStart = source?.loopStart ?? 0;
        newSource.loopEnd = source?.loopEnd ?? maxDuration;
      }
      this.audioSourceInfo.source = newSource;

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => this.engine.renderErrors.add(e));
      }

      try {
        newSource.start(0, this.pendingOffset || 0);
        this.pendingOffset = 0;
        this.started = true;
      } catch (e) {
        this.engine.renderErrors.add(e as Error);
      }
    } else {
      if (this.audio) {
        this.audio.loop = this.options.endBehavior === spec.EndBehavior.restart;
        this.audio.play().catch(e => this.engine.renderErrors.add(e));
        this.started = true;
      }
    }
  }

  pause (): void {
    if (this.isSupportAudioContext) {
      const { source, audioContext } = this.audioSourceInfo;

      if (!audioContext) {
        return;
      }
      if (audioContext.currentTime > 0 && this.started) {
        source?.stop();
      }
    } else {
      this.audio?.pause();
    }
  }

  setVolume (volume: number): void {
    if (this.isSupportAudioContext) {
      const { gainNode } = this.audioSourceInfo;

      if (gainNode) {
        gainNode.gain.value = volume;
        this.currentVolume = volume;
      }
    } else {
      if (this.audio) {
        this.audio.volume = volume;
        this.currentVolume = volume;
      }
    }
  }

  setPlaybackRate (rate: number): void {
    if (this.isSupportAudioContext) {
      const { source } = this.audioSourceInfo;

      if (source) {
        source.playbackRate.value = rate;
      }
    } else {
      if (this.audio) {
        this.audio.playbackRate = rate;
      }
    }
  }

  setLoop (loop: boolean): void {
    if (this.isSupportAudioContext) {
      const { source } = this.audioSourceInfo;

      if (!source) {
        this.engine.renderErrors.add(new Error('Audio source is not found.'));
      } else {
        source.loop = loop;
      }
    } else {
      if (this.audio) {
        this.audio.loop = loop;
      }
    }
  }

  setOptions (options: AudioPlayerOptions): void {
    if (this.initialized) {
      return;
    }
    this.options = options;
    this.initialized = true;
  }

  setMuted (muted: boolean): void {
    if (this.isSupportAudioContext) {
      const { gainNode } = this.audioSourceInfo;
      const value = muted ? 0 : this.currentVolume;

      if (gainNode) {
        gainNode.gain.value = value;
      }
    } else {
      if (this.audio) {
        this.audio.muted = muted;
      }
    }
  }

  dispose (): void {
    if (this.destroyed) {
      return;
    }
    if (this.isSupportAudioContext) {
      const { audioContext, source } = this.audioSourceInfo;

      if (this.started) {
        source?.stop();
      }
      audioContext?.close().catch(e => {
        this.engine.renderErrors.add(e);
      });
    } else {
      this.audio?.pause();
    }
    this.destroyed = true;
  }
}
