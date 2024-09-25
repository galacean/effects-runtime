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

  // eslint-disable-next-line compat/compat
  private isSupportAudioContext = !!window.AudioContext;
  private options: AudioPlayerOptions = {
    endBehavior: spec.EndBehavior.destroy,
    duration: 0,
  };

  static fromAudio (audio: string, engine: Engine): void {
  }

  constructor (audio: AudioBuffer | HTMLAudioElement, private engine: Engine) {

    if (audio instanceof AudioBuffer) {
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);

      const source = audioCtx.createBufferSource();

      source.buffer = audio;
      source.connect(gainNode);

      source.connect(audioCtx.destination);

      this.audioSourceInfo = {
        source,
        audioContext: audioCtx,
        gainNode,
      };
    } else {
      this.audio = audio;
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
      if (audioContext.currentTime > 0) {
        source?.stop();
      }
    } else {
      this.audio?.pause();
    }
  }

  setVolume (volume: number): void {
    if (this.isSupportAudioContext) {
      const { gainNode } = this.audioSourceInfo;

      gainNode?.gain.setValueAtTime(volume, 0);
    } else {
      if (this.audio) {
        this.audio.volume = volume;
      }
    }
  }

  setPlaybackRate (rate: number): void {
    if (this.isSupportAudioContext) {
      const { source } = this.audioSourceInfo;

      source?.playbackRate.setValueAtTime(rate, 0);
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
    this.options = options;
  }

  setMuted (muted: boolean): void {
    if (this.isSupportAudioContext) {
      const { gainNode } = this.audioSourceInfo;

      gainNode?.gain.setValueAtTime(muted ? 0 : 1, 0);
    } else {
      if (this.audio) {
        this.audio.muted = muted;
      }
    }
  }
}
