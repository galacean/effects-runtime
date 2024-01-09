<script lang="ts" setup>
import { ref } from 'vue'

const tabList = ref([
  { title: 'Scene', key: 'scene', icon: 'i-ri-grid-line' },
])
</script>

<template>
  <AGUIPanel class="panel-scene flex-1" h="full" w="full">
    <AGUITabs :list="tabList" :default-index="2">
      <AGUITabPanel h="full" :unmount="false" relative>
        <slot name="scene" />
      </AGUITabPanel>

      <slot />
    </AGUITabs>
  </AGUIPanel>
</template>
