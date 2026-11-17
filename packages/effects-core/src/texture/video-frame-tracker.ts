/**
 * Tracks pending frames per texture; the engine still controls frame submission.
 */
export class VideoFrameTracker {
  private dirty = true;
  private disposed = false;
  private callbackId: number | null = null;
  private usesVideoFrameCallback = false;

  constructor (readonly video: HTMLVideoElement) {
    video.addEventListener('loadeddata', this.invalidate);
    video.addEventListener('seeked', this.invalidate);
    this.requestFrame();
  }

  shouldUpload (): boolean {
    return this.dirty || !this.usesVideoFrameCallback;
  }

  markUploaded (): void {
    this.dirty = false;
  }

  dispose (): void {
    this.disposed = true;
    const { video, callbackId } = this;

    if (callbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
      try {
        video.cancelVideoFrameCallback(callbackId);
      } catch {
        // The disposed guard also handles containers whose cancellation API fails.
      }
    }
    this.callbackId = null;
    video.removeEventListener('loadeddata', this.invalidate);
    video.removeEventListener('seeked', this.invalidate);
  }

  private invalidate = (): void => {
    this.dirty = true;
  };

  private onVideoFrame = (): void => {
    if (this.disposed) {
      return;
    }
    this.callbackId = null;
    this.dirty = true;
    this.requestFrame();
  };

  private requestFrame (): void {
    const { video } = this;

    if (typeof video.requestVideoFrameCallback !== 'function') {
      return;
    }
    try {
      this.callbackId = video.requestVideoFrameCallback(this.onVideoFrame);
      this.usesVideoFrameCallback = true;
    } catch {
      this.callbackId = null;
      this.usesVideoFrameCallback = false;
    }
  }
}
