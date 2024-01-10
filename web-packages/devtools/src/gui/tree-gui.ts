import type { Composition, VFXItem, VFXItemContent } from '@galacean/effects';
import { treeData } from '../utils';

export class TreeGui {
  activeItem: VFXItem<VFXItemContent>;
  panel: any;
  private composition: Composition;

  constructor () {
    this.panel =
    {
      type: 'tree',
      title: 'Hierarchy',
      onNodeExpand (nodes: any) {
        // console.log(nodes);
      },
      onNodeActivate: (node: any) => {
        this.activeItem = node.item;
      },
      // onNodeCollapse (nodes) {
      //   console.log(nodes);
      // },
      // onNodeHide (nodes) {
      //   console.log(nodes);
      // },
    };
  }

  setComposition (composition: Composition) {
    this.composition = composition;
    treeData.value[0].expanded = true;
  }

  update = () => {
    if (this.composition) {
      treeData.value = [this.addTreeData(this.composition.rootItem, treeData.value[0])];
    }
  };

  private addTreeData (item: VFXItem<VFXItemContent>, oldTreeData: any) {
    const treeData: any = {};

    treeData.name = item.name;
    treeData.id = item.id;
    treeData.children = [];
    treeData.item = item;
    if (oldTreeData) {
      treeData.expanded = oldTreeData.expanded;
    }
    for (const child of item.children) {
      let childOldTreeData;

      if (oldTreeData && oldTreeData.children) {
        for (const childData of oldTreeData.children) {
          if (childData.id === child.id) {
            childOldTreeData = childData;
          }
        }
      }
      treeData.children.push(this.addTreeData(child, childOldTreeData));
    }

    return treeData;
  }
}
