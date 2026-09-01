import { registerPlugin } from '@galacean/effects';
import { GUIPlugin } from './plugin';

export * from './core';
export * from './components';
export * from './layout/enums';
export * from './layout/box-container';
export * from './layout/grid-container';
export * from './layout/margin-container';
export * from './layout/center-container';
export * from './layout/aspect-ratio-container';
export * from './layout/panel-container';
export * from './layout/separator';
export * from './scroll/enums';
export * from './scroll/range';
export * from './scroll/scroll-bar';
export * from './scroll/scroll-container';
export * from './theme';
export * from './controls';
export * from './plugin';

registerPlugin('gui', GUIPlugin);

/** GUI plugin package version. Importing this package registers the GUI runtime and native fallback theme. */
export const version = __VERSION__;
