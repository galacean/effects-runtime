<script lang="ts" setup>
import { treeData, treeGui } from '../utils';
</script>

<template>
  <AGUITree class="w-full h-full" :data="treeData" v-bind="treeGui.panel" />
</template>
