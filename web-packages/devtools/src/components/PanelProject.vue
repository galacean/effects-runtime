<script lang="ts" setup>
import { FSDirItem, FSItem } from '@advjs/gui';
import { ref, watch } from 'vue';
import { curDir, onFileDblClick, onFileDrop, onRootFolderSelect } from "../gui/project-gui";
import { compileScript } from 'vue/compiler-sfc';
import { EffectsPackageData } from '@galacean/effects';

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

function onFSItemChange(item: FSItem) {
  if (item.name.endsWith(".json")) {
    (item.handle as FileSystemFileHandle).getFile().then((file: File) => {
      const fileReader = new FileReader();

      fileReader.onload = async () => {
        if (typeof fileReader.result !== 'string') {
          return;
        }
        const data = JSON.parse(fileReader.result) as EffectsPackageData;
        if (data.fileSummary && data.fileSummary.assetType === "Texture") {
          //@ts-expect-error
          item.icon = data.exportObjects[0].source;
        }
      }
      fileReader.readAsText(file);
    });
  };
}

</script>

<template>
  <AGUIPanel w="full" h="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <AGUIAssetsExplorer v-model:cur-dir="curDir" v-model:root-dir="rootDir" :onFileDrop="onFileDrop"
          :onFileDblClick="onFileDblClick" :onFSItemChange="onFSItemChange" />
        <slot name="project" />
      </AGUITabPanel>
      <AGUITabPanel>
        <slot name="console" />
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
