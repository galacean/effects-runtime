<script lang="ts" setup>
import { FSDirItem } from '@advjs/gui';
import { ref, watch } from 'vue';
import { curDir, onFileDblClick, onFileDrop, onRootFolderSelect } from "../gui/project-gui";

const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-line' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-line' },
])

const rootDir = ref<FSDirItem>()
watch(rootDir, async () => {
  await onRootFolderSelect(rootDir.value!.handle);
})

// export const a = {
//   onFileDblClick:()=>{},
// }
// a.onFileDblClick = ()=>{
// }
</script>

<template>
  <AGUIPanel w="full" h="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <AGUIAssetsExplorer 
          v-model:cur-dir="curDir"
          v-model:root-dir="rootDir"
          :onFileDrop="onFileDrop"
          :onFileDblClick="onFileDblClick" 
        />
        <slot name="project" />
      </AGUITabPanel>
      <AGUITabPanel>
        <slot name="console" />
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
