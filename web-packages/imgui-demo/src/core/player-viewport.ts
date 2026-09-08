import type { Player } from '@galacean/effects';

/** Docked panels may temporarily have no drawable content area. */
export function resizePlayerViewport (player: Player, width: number, height: number): boolean {
  width = Math.floor(width);
  height = Math.floor(height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return false;
  }
  const container = player.container;

  if (!container) {return false;}
  const previousWidth = container.style.width;
  const previousHeight = container.style.height;
  const nextWidth = width + 'px';
  const nextHeight = height + 'px';

  container.style.width = nextWidth;
  container.style.height = nextHeight;
  if (container.clientWidth < 1 || container.clientHeight < 1) {
    container.style.width = previousWidth;
    container.style.height = previousHeight;

    return false;
  }
  if (previousWidth !== nextWidth || previousHeight !== nextHeight) {
    player.resize();
  }

  return true;
}
