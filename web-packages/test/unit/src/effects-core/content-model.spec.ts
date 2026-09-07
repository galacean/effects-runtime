import type { ContentDatabaseFile, EditorAssetInfo } from '../../../../imgui-demo/src/editor/content';
import { ContentBrowserModel } from '../../../../imgui-demo/src/panels/content-model';

const { expect } = chai;

function asset (id: string, typeName: string, path: string): EditorAssetInfo {
  return { id, typeName, path, lastModified: 1 };
}

function file (path: string, typeName: string): ContentDatabaseFile {
  return {
    name: path.slice(path.lastIndexOf('/') + 1),
    path,
    typeName,
    lastModified: 1,
    handle: {} as FileSystemFileHandle,
  };
}

describe('ContentBrowserModel', () => {
  it('builds the Content hierarchy without loading assets', () => {
    const model = new ContentBrowserModel();

    model.setSnapshot(
      ['Content', 'Content/Empty', 'Content/Materials'],
      [asset('texture', 'Texture', 'Content/Textures/Cloud.json')],
    );

    expect(model.getFolder('Content/Empty')).not.equals(undefined);
    expect(model.getFolder('Content/Textures')).not.equals(undefined);
    expect(model.getItems('', new Set()).map(item => item.name)).deep.equals([
      'Empty',
      'Materials',
      'Textures',
    ]);

    model.navigate('Content/Textures');
    expect(model.getItems('', new Set()).map(item => item.name)).deep.equals(['Cloud.json']);
  });

  it('searches recursively in the current folder and applies type filters', () => {
    const model = new ContentBrowserModel();

    model.setSnapshot(['Content'], [
      asset('cloud', 'Texture', 'Content/Environment/Cloud.json'),
      asset('stone', 'Material', 'Content/Environment/Materials/Stone.json'),
      asset('clip', 'AnimationClip', 'Content/Characters/Walk.json'),
    ]);

    expect(model.getItems('stone', new Set()).map(item => item.path)).deep.equals([
      'Content/Environment/Materials/Stone.json',
    ]);
    expect(model.getItems('', new Set(['Texture'])).map(item => item.kind === 'asset' ? item.info.typeName : item.kind)).deep.equals([
      'Texture',
    ]);
    expect(model.getItems('cloud', new Set(['Material']))).deep.equals([]);
  });

  it('keeps non-asset files in the Content view', () => {
    const model = new ContentBrowserModel();

    model.setSnapshot(['Content'], [], [
      file('Content/demo.scene.json', 'Scene'),
      file('Content/readme.txt', 'TXT File'),
    ]);

    expect(model.getItems('', new Set()).map(item => item.name)).deep.equals([
      'demo.scene.json',
      'readme.txt',
    ]);
    expect(model.getItems('', new Set(['Scene'])).map(item => item.path)).deep.equals([
      'Content/demo.scene.json',
    ]);
  });

  it('keeps backward and forward navigation history', () => {
    const model = new ContentBrowserModel();

    model.setSnapshot([
      'Content',
      'Content/A',
      'Content/A/Child',
      'Content/B',
    ], []);

    expect(model.navigate('Content/A')).equals(true);
    expect(model.navigate('Content/A/Child')).equals(true);
    expect(model.getBreadcrumbs().map(folder => folder.name)).deep.equals(['Content', 'A', 'Child']);
    expect(model.navigateBackward()).equals(true);
    expect(model.currentPath).equals('Content/A');
    expect(model.navigateForward()).equals(true);
    expect(model.currentPath).equals('Content/A/Child');
    expect(model.navigateUp()).equals(true);
    expect(model.currentPath).equals('Content/A');
    expect(model.canNavigateForward).equals(false);
  });

  it('keeps matching folder ancestors visible while filtering the tree', () => {
    const model = new ContentBrowserModel();

    model.setSnapshot(['Content', 'Content/Characters', 'Content/Characters/Heroes'], []);

    expect(model.getVisibleFolders('heroes').map(folder => folder.path)).deep.equals([
      'Content/Characters/Heroes',
      'Content/Characters',
      'Content',
    ]);
  });
});
