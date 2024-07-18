const container = document.getElementById('J-container');
let player: any;

window.addEventListener('message', async event => {
  const { type, json, playerOptions, currentTime, speed } = event.data;

  switch (type) {
    case 'init': {
      player = new window.ge.Player({
        container,
        ...playerOptions,
        onItemClicked: (item: any) => console.info(`item ${item.name} has been clicked`, item),
      });

      break;
    }
    case 'play': {
      player.destroyCurrentCompositions();
      const scene = await player.loadScene(json, {
        autoplay: false,
        speed,
      });

      console.debug(`pre-player 渲染模式：${player.renderer.engine.gpuCapability.type}`);
      compatibleCalculateItem(scene);
      void player.gotoAndPlay(currentTime);

      break;
    }
    case 'pause': {
      if (player.hasPlayable) {
        player.pause();
      }

      break;
    }
    case 'resume': {
      void player.resume();

      break;
    }
  }
});

export function compatibleCalculateItem (composition: any) {
  composition.items.forEach((item: any) => {
    if (window.ge.VFXItem.isNull(item) && item.endBehavior === window.ge.spec.EndBehavior.destroy) {
      item.endBehavior = window.ge.spec.EndBehavior.freeze;
    }
  });
}
