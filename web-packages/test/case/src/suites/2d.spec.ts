import '@galacean/effects-plugin-rich-text';
import '@galacean/effects-plugin-orientation-transformer';
import { runFrameSuite } from '../framework/runner/frame-suite-runner';
import { profileRegistry } from '../profiles';

profileRegistry.getByGroup('2d').forEach(runFrameSuite);
