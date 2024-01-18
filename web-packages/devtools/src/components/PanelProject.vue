<script lang="ts" setup>
import { ref } from 'vue';
import { curDir, onFileDrop, onRootFolderSelect } from "../gui/project-gui";
import { FSDirItem } from '@advjs/gui';
import { watch } from 'vue';

const tabList = ref([
  { title: 'Project', key: 'project', icon: 'i-ri-folder-line' },
  { title: 'Console', key: 'console', icon: 'i-ri-terminal-box-line' },
])

const rootDir = ref<FSDirItem>()
watch(rootDir, async () => {
  await onRootFolderSelect(rootDir.value!.handle);
})
</script>

<template>
  <AGUIPanel w="full" h="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <AGUIAssetsExplorer v-model:cur-dir="curDir" v-model:root-dir="rootDir" :onFileDrop="onFileDrop" />
        <slot name="project" />
      </AGUITabPanel>
      <AGUITabPanel>
        <slot name="console" />
      </AGUITabPanel>
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
