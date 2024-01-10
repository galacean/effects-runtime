import { ref } from 'vue';
import type { Trees } from '@advjs/gui';

export * from './ge';
export const treeData = ref<Trees>([
  {
    name: 'Level one 1',
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
  {
    name: 'Level one 2',
    visible: true,
    children: [
      {
        name: 'Level two 2-1',
        visible: true,
        children: [
          {
            name: 'Level three 2-1-1',
          },
        ],
      },
      {
        name: 'Level two 2-2',
        children: [
          {
            name: 'Level three 2-2-1',
          },
        ],
      },
    ],
  },
  {
    name: 'Level one 3',
    expanded: true,
    children: [
      {
        name: 'Level two 3-1',
        expanded: true,
        children: [
          {
            name: 'Level three 3-1-1',
            selectable: true,
          },
          {
            name: 'Level three 3-1-2 Long Name Long Name Long Name Long Name Long Name Long Name',
            selectable: true,
          },
        ],
      },
      {
        name: 'Level two 3-2',
        visible: false,
        children: [
          {
            name: 'Level three 3-2-1',
          },
        ],
      },
    ],
  },
]);
