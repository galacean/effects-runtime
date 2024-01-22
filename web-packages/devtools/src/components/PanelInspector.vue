<script lang="ts" setup>
import { ref } from 'vue'

const tabList = ref([
  { title: 'Inspector', key: 'inspector', icon: 'i-ri-information-fill' },
])
</script>

<template>
  <AGUIPanel h="full" w="full">
    <AGUITabs :list="tabList">
      <AGUITabPanel>
        <InspectorView />
      </AGUITabPanel>
    </AGUITabs>
  </AGUIPanel>
</template>
