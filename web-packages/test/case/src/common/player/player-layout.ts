export type PlayerLayoutResult = {
  mount: HTMLDivElement,
  canvas: HTMLCanvasElement,
};

type CreatePlayerLayoutOptions = {
  width: number,
  height: number,
  isOldVersion: boolean,
};

export function createPlayerLayout (options: CreatePlayerLayoutOptions): PlayerLayoutResult {
  const { width, height, isOldVersion } = options;
  const mount = document.createElement('div');
  const canvas = document.createElement('canvas');

  mount.style.position = 'fixed';
  mount.style.width = `${width}px`;
  mount.style.height = `${height}px`;
  mount.style.backgroundColor = 'black';
  mount.style.right = isOldVersion ? '0px' : `${width + 1}px`;
  mount.style.bottom = '0px';

  mount.appendChild(canvas);
  document.body.appendChild(mount);

  return {
    mount,
    canvas,
  };
}
