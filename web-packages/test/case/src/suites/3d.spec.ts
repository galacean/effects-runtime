import '@galacean/effects-plugin-model';
import { runFrameSuite } from '../framework/runner/frame-suite-runner';
import { profileRegistry } from '../profiles';

profileRegistry.getByGroup('3d').forEach(runFrameSuite);
