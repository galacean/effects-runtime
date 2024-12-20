import { Player } from '@galacean/effects';
import { getAdapter, type OrientationAdapterAcceler } from '@galacean/effects-plugin-orientation-transformer';

const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*GbiuQIresOsAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');
const betaInput = document.querySelector('input[name="beta"]') as HTMLInputElement;
const gammaInput = document.querySelector('input[name="gamma"]') as HTMLInputElement;

(async () => {
  const adapter = getAdapter();
  const player = new Player({
    container,
    pixelRatio: window.devicePixelRatio,
    interactive: true,
  });

  betaInput.addEventListener('input', () => { handleInputChange(adapter); });
  gammaInput.addEventListener('input', () => { handleInputChange(adapter); });
  await player.loadScene(json);
})();

function handleInputChange (adapter: OrientationAdapterAcceler) {
  adapter.dispatchMotion({
    x: +betaInput.value / 100,
    y: +gammaInput.value / 100,
    beta: +betaInput.value / 100,
    gamma: +gammaInput.value / 100,
  });
  document.getElementById('J-info')!.innerText = `[info] x: ${betaInput.value}, y: ${gammaInput.value}`;
}
