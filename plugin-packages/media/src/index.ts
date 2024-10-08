import { registerPlugin, VFXItem } from '@galacean/effects-core';
import { VideoLoader } from './video/video-loader';
import { AudioLoader } from './audio/audio-loader';

export * from './video/video-component';
export * from './audio/audio-component';
export * from './audio/audio-player';
registerPlugin('video', VideoLoader, VFXItem, true);
registerPlugin('audio', AudioLoader, VFXItem, true);
