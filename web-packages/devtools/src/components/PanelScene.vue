<script lang="ts" setup>
import { VFXItem, generateGUID } from '@galacean/effects';
import { nextTick, onMounted, ref } from 'vue';
import { assetDatabase } from '../utils';
import { composition, initGEPlayer } from '../utils/ge';

const tabList = ref([
  { title: 'Scene', key: 'scene', icon: 'i-ri-grid-line' },
])

const galaceanEffectsCanvas = ref<HTMLCanvasElement>()
const container = ref<HTMLElement>()
onMounted(async () => {
  if (!galaceanEffectsCanvas.value)
    return

  const canvas = galaceanEffectsCanvas.value

  container.value = canvas.parentElement!
  console.log(container.value)

  canvas.width = canvas.parentElement!.clientWidth
  canvas.height = canvas.parentElement!.clientHeight

  await nextTick()
  initGEPlayer(canvas)

  container.value.addEventListener('resize', () => { });

  // 阻止默认的拖拽行为
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    canvas.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e: any) {
    e.preventDefault();
    e.stopPropagation();
  }

  canvas.addEventListener("drop", async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const fileUUID = e.dataTransfer?.getData('fileUUID');
    if (fileUUID) {
      const value = window.AGUI_DRAGGING_ITEM_MAP.get(fileUUID);
      window.AGUI_DRAGGING_ITEM_MAP.delete(fileUUID);
      const fileHandle = value.handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const effectsPackage = await assetDatabase.loadPackageFile(file);
      if(!(effectsPackage?.exportObjects[0] instanceof VFXItem)){
        return;
      }
      const vfxItem = effectsPackage!.exportObjects[0] as VFXItem;

      composition.addItem(vfxItem);
      (effectsPackage!.exportObjects[1] as VFXItem).setParent(vfxItem);
      composition.items.push(effectsPackage!.exportObjects[1] as VFXItem);
      vfxItem.setInstanceId(generateGUID());
      for (const component of vfxItem.components) {
        component.setInstanceId(generateGUID());
      }
    }
  });

})
</script>

<template>
  <AGUIPanel ref="panelRef" class="panel-scene flex-1" h="full" w="full">
    <AGUITabs :list="tabList" :default-index="2">
      <!-- <AGUITabPanel h="full" :unmount="false" relative>
        <slot name="scene" />
      </AGUITabPanel> -->
      <canvas id="galacean-effects-canvas" class="w-full! h-full!" ref="galaceanEffectsCanvas" />
      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
