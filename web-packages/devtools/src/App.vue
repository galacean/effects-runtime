<template>
  <main class="h-screen w-screen">
    <AGUILayout>
      <template #right>
        <!-- <PanelInspector /> -->
      </template>

      <template #left-top>
        <PanelHierarchy />
      </template>

      <PanelScene />

      <template #left-bottom>
        <PanelProject />
      </template>
    </AGUILayout>
  </main>
</template>
