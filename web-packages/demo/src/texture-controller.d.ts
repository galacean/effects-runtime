export enum MainStage { Listening, Input, Stop }
export enum TexFadeStage { Hidden, FadingIn, Showing, FadingOut }

export interface TexState {
  x: number;
  stage: TexFadeStage;
  alpha: number;
  time: number;
  life: number;
  startedAt: number;
  duration: number;
}

export declare class TextureController {
  textures: TexState[];
  mainStage: MainStage;
  pendingLoop: boolean;
  timer: number;
  volumeThreshold: number;

  listeningDuration: number;
  movingDistance: number;
  fadeInMs: number;
  fadeOutStart: number;
  fadeOutEnd: number;

  inputDuration: number;
  inputDistance: number;
  textureInterval: number;
  fadeInA: number;
  fadeOutStartA: number;
  fadeOutB: number;

  onStage: (stage: MainStage) => void;
  onUpdate: (textures: TexState[]) => void;

  constructor();
  resetToListening(now: number): void;
  triggerInputStage(now: number): void;
  stop(): void;
  update(delta: number, volume: number, now: number): void;
}
