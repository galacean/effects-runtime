import inspireList from '../assets/inspire-list';

import { Application, Assets, Container, Sprite, Graphics, Text } from 'pixijs';

const json = inspireList.WuFu1.url;

(async () => {
  const app = new Application({
    width: 512,
    height: 512,
    backgroundColor: 0x1099bb,
  });

  document.body.appendChild(app.view as HTMLCanvasElement);
  console.log(app);

  // Load textures
  await Assets.load([
    'https://pixijs.com/assets/bg_rotate.jpg',
    'https://pixijs.com/assets/bg_scene_rotate.jpg',
    'https://pixijs.com/assets/light_rotate_2.png',
    'https://pixijs.com/assets/light_rotate_1.png',
    'https://pixijs.com/assets/panda.png',
  ]);

  const bg = Sprite.from('https://pixijs.com/assets/bg_rotate.jpg');

  bg.anchor.set(0.5);

  bg.x = app.screen.width / 2;
  bg.y = app.screen.height / 2;

  app.stage.addChild(bg);

  const container = new Container();

  container.x = app.screen.width / 2;
  container.y = app.screen.height / 2;

  // Add a bunch of sprites
  const bgFront = Sprite.from('https://pixijs.com/assets/bg_scene_rotate.jpg');

  bgFront.anchor.set(0.5);

  const light2 = Sprite.from('https://pixijs.com/assets/light_rotate_2.png');

  light2.anchor.set(0.5);

  const light1 = Sprite.from('https://pixijs.com/assets/light_rotate_1.png');

  light1.anchor.set(0.5);

  const panda = Sprite.from('https://pixijs.com/assets/panda.png');

  panda.anchor.set(0.5);

  container.addChild(bgFront, light2, light1, panda);

  app.stage.addChild(container);

  // Let's create a moving shape mask
  const thing = new Graphics();

  app.stage.addChild(thing);
  thing.x = app.screen.width / 2;
  thing.y = app.screen.height / 2;

  container.mask = thing;

  let count = 0;

  app.stage.on('pointertap', () => {
    if (!container.mask) {
      container.mask = thing;
    } else {
      container.mask = null;
    }
  });

  // Animate the mask
  app.ticker.add(() => {
    bg.rotation += 0.01;
    bgFront.rotation -= 0.01;

    light1.rotation += 0.02;
    light2.rotation += 0.01;

    panda.scale.x = 1 + Math.sin(count) * 0.04;
    panda.scale.y = 1 + Math.cos(count) * 0.04;

    count += 0.1;

    thing.clear();
    thing.moveTo(-120 + Math.sin(count) * 20, -100 + Math.cos(count) * 20);
    thing.lineTo(120 + Math.cos(count) * 20, -100 + Math.sin(count) * 20);
    thing.lineTo(120 + Math.sin(count) * 20, 100 + Math.cos(count) * 20);
    thing.lineTo(-120 + Math.cos(count) * 20, 100 + Math.sin(count) * 20);
    // thing.fill({ color: 0x8bc5ff, alpha: 0.4 });
    thing.rotation = count * 0.1;
  });
  // const assets = new Assets();
  // await assets.load(json);

  // const sprite = new Sprite(assets.get(json));
  // app.stage.addChild(sprite);

})();
