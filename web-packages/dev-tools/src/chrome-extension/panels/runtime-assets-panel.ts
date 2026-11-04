import type { Engine } from '@galacean/effects';
import type { Control } from '@galacean/effects-plugin-gui';
import { EditorWindow } from '../../framework/windows/editor-window';
import type { RuntimeConnection } from '../bridge/runtime-connection';
import { AssetView } from '../../ui/asset-view/asset-view';
import type { AssetIcon } from '../../ui/icons/asset-icons';
import { editorColors } from '../../ui/theme/control-theme';
import { ASSET_TYPE_COLORS } from '../../ui/icons/asset-icons';
import { append, column, expand, margin } from '../../ui/controls/layout';
import { EditorSearchField } from '../../ui/controls/search-field';

export class ConnectedAssetsPanel extends EditorWindow {
  private assetsView!: AssetView;
  private search!: EditorSearchField;
  private signature = '';

  constructor (private readonly connection: RuntimeConnection) { super(); this.title = 'Runtime Assets'; this.open(); }
  protected override createContent (engine: Engine): Control {
    const content = column(engine);

    this.search = new EditorSearchField(engine, 'Search assets'); this.search.on('textChanged', () => this.refresh());
    append(content, margin(engine, this.search, 8, 6));
    this.assetsView = append(content, expand(new AssetView(engine, {
      selected: id => this.connection.snapshot.selectedId === id,
      choose: id => { this.connection.select(id); this.assetsView.refresh(); },
      open: id => { this.connection.select(id); this.connection.command({ type: 'log' }); }, context: () => {}, rename: () => {}, drag: () => null,
      canDrop: () => false, drop: () => {}, key: () => {},
    })));
    this.assetsView.emptyText = 'No runtime assets';
    this.assetsView.configure('tiles', 64);

    return content;
  }
  refresh (): void {
    if (!this.assetsView) { return; }
    const query = this.search.text.toLocaleLowerCase();
    const assets = this.connection.snapshot.assets.filter(asset => (asset.name + ' ' + asset.type).toLocaleLowerCase().includes(query));
    const signature = JSON.stringify(assets);

    if (signature !== this.signature) {
      this.signature = signature;
      this.assetsView.setItems(assets.map(asset => {
        const name = asset.type.toLocaleLowerCase();
        const icon: AssetIcon = name.includes('texture') ? 'texture' : name.includes('material') ? 'material' : name.includes('shader') ? 'shader' : name.includes('animation') || name.includes('playable') ? 'animationClip' : name.includes('sprite') ? 'sprite' : name.includes('geometry') ? 'geometry' : 'project';

        return { ...asset, type: asset.type, icon, accent: icon === 'project' ? editorColors.muted : ASSET_TYPE_COLORS[icon], tooltip: asset.name + '\n' + asset.summary };
      }));
    } else { this.assetsView.refresh(); }
  }
}
