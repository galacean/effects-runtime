import { math } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';

const colors = [new math.Color(.196, .196, .196, 1), new math.Color(.153, .153, .153, 1)];

export function checkerboard (control: Control, x: number, y: number, width: number, height: number, cell = 10): void {
  for (let row = 0; row < Math.ceil(height / cell); row++) {
    for (let column = 0; column < Math.ceil(width / cell); column++) {
      control.fillRect(x + column * cell, y + row * cell, Math.min(cell, width - column * cell), Math.min(cell, height - row * cell), colors[(row + column) % 2]);
    }
  }
}
