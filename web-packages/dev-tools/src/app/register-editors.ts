import inspireList from '../examples/data/inspire-list';
import '../features/animation-clip/animation-clip-editor';
import '../features/animation-graph/index';
import '../features/assets/editors/runtime-asset-editor';
import '../features/assets/runtime/runtime-assets-panel';
import { configureCompositionCatalog } from '../features/compositions/composition-browser-panel';
import '../features/content-browser/index';
import '../features/hierarchy/index';
import '../features/inspector/index';
import '../features/scene/viewport/index';
import '../features/sequencer/index';

configureCompositionCatalog(Object.values(inspireList));
