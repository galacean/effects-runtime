import { Player, RendererComponent, TextComponent } from '@galacean/effects';
import '@galacean/effects-plugin-multimedia';

const container = document.getElementById('J-container');

(async () => {
  const player = new Player({
    container,
    interactive: true,
  });

  const composition = await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*2tyvSqaKJxMAAAAAAAAAAAAAelB4AQ');
  const sceneRendererComponents: RendererComponent[] = [];
  const hitResText = composition.getItemByName('text')?.getComponent(TextComponent);

  player.canvas.addEventListener('mousemove', e=>{
    const [x, y] = getHitTestCoord(e);
    const hitRes = composition.hitTest(x, y, true);

    hitResText?.setText('Text');

    for (const shape of sceneRendererComponents) {
      for (const material of shape.materials) {
        material.color.set(1, 1, 1, 1);
      }
    }

    if (hitRes[0]) {
      const shape = composition.getItemByName(hitRes[0].name)!.getComponent(RendererComponent);

      hitResText?.setText(shape.item.name);
      if (!sceneRendererComponents.includes(shape)) {
        sceneRendererComponents.push(shape);
      }

      for (const material of shape.materials) {
        material.color.set(38 / 255, 187 / 255, 255 / 255, 1);
      }
    }
  });
})();

function getHitTestCoord (e: MouseEvent) {
  const canvas = e.target as HTMLCanvasElement;
  const bounding = canvas.getBoundingClientRect();
  const x = ((e.clientX - bounding.left) / bounding.width) * 2 - 1;
  const y = 1 - ((e.clientY - bounding.top) / bounding.height) * 2;

  return [x, y];
}
