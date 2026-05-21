import '@galacean/effects-plugin-spine';
import { runFrameSuite } from '../framework/runner/frame-suite-runner';
import { profileRegistry } from '../profiles';

profileRegistry.getByGroup('spine').forEach(runFrameSuite);
