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
    audio: AudioBuffer | HTMLAudioElement,
    private engine: Engine,
  ) {
    this.setAudioSource(audio);
  }

  /**
   * 设置音频资源
   * @param audio - 音频资源
   */
  setAudioSource (audio: AudioBuffer | HTMLAudioElement) {
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
    this.started = false;
  }

  getCurrentTime (): number {
    if (this.isSupportAudioContext) {
      const { audioContext } = this.audioSourceInfo;

      return audioContext?.currentTime || 0;
    } else {
      return this.audio?.currentTime || 0;
    }
  }

  play (): void {
    if (this.isSupportAudioContext) {
      const { audioContext, source } = this.audioSourceInfo;

      if (source && audioContext) {
        switch (this.options.endBehavior) {
          case spec.EndBehavior.destroy:
          case spec.EndBehavior.freeze:
            source.start(0);

            break;
          case spec.EndBehavior.restart:
            source.loop = true;
            source.loopStart = 0;
            source.loopEnd = this.options.duration;
            source.start(0);

            break;
          default:
            break;
        }
      }
      this.started = true;
    } else {
      this.audio?.play().catch(e => {
        this.engine.renderErrors.add(e);
      });
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

      source?.stop();
      audioContext?.close().catch(e => {
        this.engine.renderErrors.add(e);
      });
    } else {
      this.audio?.pause();
    }
    this.destroyed = true;
  }
}
