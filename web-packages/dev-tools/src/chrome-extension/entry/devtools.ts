import { devtoolsChrome } from '../bridge/chrome-api';
import type { DevtoolsPanelWindow } from '../bridge/chrome-api';

devtoolsChrome().devtools.panels.create('Effects', '', 'panel.html', panel => {
  let view: DevtoolsPanelWindow | undefined;

  panel.onShown.addListener(window => { view = window; view.effectsDevtoolsPanelVisible = true; view.effectsDevtoolsPanel?.setVisible(true); });
  panel.onHidden.addListener(() => { if (view) { view.effectsDevtoolsPanelVisible = false; view.effectsDevtoolsPanel?.setVisible(false); } });
});
