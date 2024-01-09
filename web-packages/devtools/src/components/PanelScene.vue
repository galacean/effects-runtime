<script lang="ts" setup>
import { nextTick, onMounted, ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { initGEPlayer } from '../utils/ge';

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

  container.value.addEventListener('resize', () => {

  })
})
</script>

<template>
  <AGUIPanel ref="panelRef" class="panel-scene flex-1" h="full" w="full">
    <AGUITabs :list="tabList" :default-index="2">
      <!-- <AGUITabPanel h="full" :unmount="false" relative>
        <slot name="scene" />
      </AGUITabPanel> -->
      <canvas id="galacean-effects-canvas" ref="galaceanEffectsCanvas" />

      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>

<style>
#galacean-effects-canvas {
  width: 100%;
  height: 100%;
}
</style>
