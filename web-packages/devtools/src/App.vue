<script lang="ts" setup>
import { AGUILayoutType } from "@advjs/gui/client";

const defaultLayout: AGUILayoutType = {
  name: 'root',
  type: 'vertical',
  children: [
    {
      type: 'horizontal',
      name: 'left',
      size: 75,
      children: [
        {
          type: 'vertical',
          name: 'top',
          size: 64,
          children: [
            {
              name: 'hierarchy',
              size: 25,
              min: 20,
              max: 80,
            },
            {
              // main scene
              name: 'scene',
              size: 75,
            },
          ],
        },
        {
          name: 'left-bottom',
          size: 36,
        },
      ],
    },
    {
      name: 'right',
      size: 25,
      min: 20,
      max: 50,
    },
  ],
}
</script>

<template>
  <main class="h-screen w-screen">
    <AGUILayout :layout="defaultLayout">
      <template #right>
        <!-- <PanelInspector /> -->
      </template>

      <template #hierarchy>
        <PanelHierarchy />
      </template>

      <template #scene>
        <PanelScene />
      </template>

      <template #left-bottom>
        <PanelProject />
      </template>
    </AGUILayout>
  </main>
</template>
