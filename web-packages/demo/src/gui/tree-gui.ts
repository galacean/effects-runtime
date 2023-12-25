// @ts-expect-error
import { createBUI, reactive } from '@advjs/blender-ui/dist/blender-ui.umd.cjs';
import type { Composition, VFXItem, VFXItemContent } from '@galacean/effects';

export class TreeGui {
  private composition: Composition;
  private guiProps: any;

  constructor () {
    this.guiProps = reactive({
      title: 'TEST',
      panels: [
        {
          type: 'tree',
          title: 'Hierarchy',
          onNodeExpand (nodes: any) {
            // console.log(nodes);
          },
          onNodeActivate (node: any) {
            // eslint-disable-next-line no-console
            console.log(node.item.name, node.item.id, node.item);
            // console.log(node);
          },
          // onNodeCollapse (nodes) {
          //   console.log(nodes);
          // },
          // onNodeHide (nodes) {
          //   console.log(nodes);
          // },
          data: [
            {
              name: 'Level one 1',
              expanded: true,
              children: [
                {
                  name: 'Level two 1-1',
                  children: [
                    {
                      name: 'Level three 1-1-1',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const props = this.guiProps;
    const bui = createBUI({ props });

    setInterval(this.updateTreeGUI, 500);
  }

  setComposition (composition: Composition) {
    this.composition = composition;
  }

  private updateTreeGUI = () => {
    if (this.composition) {
      this.guiProps.panels[0].data = [this.addTreeData(this.composition.rootItem, this.guiProps.panels[0].data[0])];
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
