export type Profile = 0 | 1 | 2 | 3;

interface TexState {
  id: number;
  startedAt: number;
  profile: Profile;
  batchId?: number;
}

export interface ControllerParams {
  textureCount: number;
  slots: Array<{ startedAt: number; profile: Profile }>;
  stop: null | { active: true; time: number; affectListening: boolean; affectInput: boolean };
  phase: Phase;
}

export enum Phase { 
  Listening, 
  Input, 
  Stop 
}

export class TextureControllerNew {
  private readonly MAX_TEXTURES = 4;
  private readonly DURATION = { LB: 3.417, LG: 3.458, IA: 3.7, IB: 3.7 };
  private readonly INPUTB = { fadeIn: 0.7417, fadeOutStart: 2.2003, fadeOutEnd: 2.9253 };
  private readonly SPAWN_B_DELAY = 0.733;

  phase: Phase = Phase.Listening;
  private nextId = 1;
  private textures: TexState[] = [];
  private groupStart = 0;
  private enterAt: number | null = null;
  private batchId = 0;
  private chainArmed = false;
  private stopActive = false;
  private spawnBAt: number | null = null;
  private lastVolume = 0;
  private volumeThreshold = 0.1;

  private params: ControllerParams = { textureCount: 0, slots: [], stop: null, phase: Phase.Listening };

  constructor(initialVolumeThreshold?: number) {
    if (typeof initialVolumeThreshold === 'number') this.volumeThreshold = initialVolumeThreshold;
    this.resetToListening(performance.now() / 1000);
  }

  setVolumeThreshold(v: number) { this.volumeThreshold = v; }
  getParams(): ControllerParams { return this.params; }

  resetToListening(now: number) {
    this.phase = Phase.Listening;
    this.groupStart = now;
    this.enterAt = null;
    this.batchId = 0;
    this.chainArmed = false;
    this.stopActive = false;
    this.spawnBAt = null;

    this.params.stop = null;

    this.textures = [
      { id: this.nextId++, startedAt: now, profile: 0 },
      { id: this.nextId++, startedAt: now, profile: 1 },
    ];
    this.rebuildParams(now);
  }

  private stop(now: number) {
    if (this.phase !== Phase.Input || this.stopActive) return;
    this.stopActive = true;
    this.phase = Phase.Stop;
    this.chainArmed = false;
    this.spawnBAt = null;

    this.params.stop = { active: true, time: now, affectListening: false, affectInput: true };
    this.rebuildParams(now);
  }

  update(delta: number, volume: number, now: number) {
    this.lastVolume = volume;

    if (this.phase === Phase.Listening && this.enterAt == null && volume >= this.volumeThreshold) {
      this.enterAt = Math.max(this.groupStart + 2.75, now);
    }
    if (this.phase === Phase.Listening && this.enterAt != null && now >= this.enterAt) {
      this.enterInput(now);
    }

    const groupEnd = this.groupStart + Math.max(this.DURATION.LB, this.DURATION.LG);
    if (this.phase === Phase.Listening && now >= groupEnd) {
      volume >= this.volumeThreshold ? this.enterInput(now) : this.resetToListening(now);
    }

    if (this.phase === Phase.Input && !this.stopActive && this.spawnBAt != null && now >= this.spawnBAt) {
      this.textures.push({ id: this.nextId++, startedAt: now, profile: 3, batchId: this.batchId });
      this.spawnBAt = null;
    }

    if (this.phase === Phase.Input && this.chainArmed && !this.stopActive) {
      const B = this.textures.find(t => t.profile === 3 && t.batchId === this.batchId);
      if (B) {
        const halfDisplay = (this.INPUTB.fadeOutStart - this.INPUTB.fadeIn) * 0.5;
        const absStart = B.startedAt + this.INPUTB.fadeOutStart - halfDisplay;
        const absEnd = B.startedAt + this.INPUTB.fadeOutEnd;
        if (now >= absStart && now < absEnd && volume >= this.volumeThreshold) {
          this.chainArmed = false;
          this.enterInput(now);
        }
      }
    }

    if (this.phase === Phase.Input && !this.stopActive && volume < this.volumeThreshold) {
      this.stop(now);
    }

    this.textures = this.textures.filter(t => {
      const elapsed = now - t.startedAt;
      const d = t.profile === 0 ? this.DURATION.LB :
                t.profile === 1 ? this.DURATION.LG :
                t.profile === 2 ? this.DURATION.IA : this.DURATION.IB;
      return elapsed < d;
    });

    const hasInput = this.textures.some(t => t.profile >= 2);
    if (this.phase === Phase.Input && !hasInput && this.spawnBAt == null && !this.stopActive) {
      this.resetToListening(now);
    }

    this.rebuildParams(now);
  }

  private enterInput(now: number) {
    this.phase = Phase.Input;
    this.batchId += 1;
    this.enterAt = null;
    this.chainArmed = true;
    this.stopActive = false;

    this.textures.push({ id: this.nextId++, startedAt: now, profile: 2, batchId: this.batchId });
    this.spawnBAt = now + this.SPAWN_B_DELAY;

    this.params.stop = null;
    this.rebuildParams(now);
  }

  private rebuildParams(now: number) {
    const inputs = this.textures.filter(t => t.profile >= 2).sort((a, b) => b.startedAt - a.startedAt);
    const listenings = this.textures.filter(t => t.profile <= 1).sort((a, b) => b.startedAt - a.startedAt);
    const renderSet = inputs.concat(listenings).slice(0, this.MAX_TEXTURES).sort((a, b) => a.startedAt - b.startedAt);

    this.params.textureCount = renderSet.length;
    this.params.slots = renderSet.map(t => ({ startedAt: t.startedAt, profile: t.profile }));
    this.params.phase = this.phase;
  }
}
