// @ts-nocheck

window.Mars.registerFilters(window.MarsFilters.filters);

const container = document.getElementById('J-container');
let player;

window.addEventListener('message', async event => {
  const { type, json, playerOptions, currentTime, speed } = event.data;

  switch (type) {
    case 'init': {
      player = new window.Mars.MarsPlayer({
        container,
        ...playerOptions,
        onItemClicked: item => console.info(`item ${item.name} has been clicked`, item),
      });

      break;
    }
    case 'play': {
      const scene = await player.loadSceneAsync(json);

      console.debug(`pre-player 渲染模式：${player.renderer.gpu.type}`);
      void player.play(scene, { currentTime, speed });

      break;
    }
    case 'pause': {
      if (player.hasPlayable) {
        player.pause();
      }

      break;
    }
    case 'resume': {
      player?.resumeAsync();

      break;
    }
  }
});
