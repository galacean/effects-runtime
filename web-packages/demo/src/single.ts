import { Player } from '@galacean/effects';
import inspireList from './assets/inspire-list';

// 动态文本
// const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*40vJRJf5nAAAAAAAAAAAAAAADlB4AQ';
// 动态换图
const json = 'https://mdn.alipayobjects.com/mars/afts/file/A*T1U4SqWhvioAAAAAAAAAAAAADlB4AQ';
const container = document.getElementById('J-container');

(async () => {
  try {
    const player = new Player({
      container,
    });

    await player.loadScene('https://mdn.alipayobjects.com/mars/afts/file/A*s4IgQru1WyEAAAAAAAAAAAAADlB4AQ', {
      variables: {
        'text1-bold': 'text1-bold',
        'text1': '1111111111111',
        'btnText4': '2222',
        'avatar1': 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*st1QSIvJEBcAAAAAAAAAAAAADt_KAQ/original',
        'avatar2': 'https://mdn.alipayobjects.com/huamei_uj3n0k/afts/img/A*oelLS68rL4kAAAAAAAAAAAAADt_KAQ/original',
      },
    });
  } catch (e) {
    console.error('biz', e);
  }
})();
