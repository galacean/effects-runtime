<script lang="ts" setup>
import { ref } from 'vue'
import { Toast } from '@advjs/gui'
import type { AGUIPropertiesPanelProps, Vector3 } from '@advjs/gui'
import { components } from '../../gui/inspector-gui';
import {useStorage} from '@vueuse/core'

const defaultOpenItems = [
  'Transform',
  "EffectComponent",
  "SpriteComponent",
  "ParticleSystemRenderer",
  "Material"
];

const vector3 = ref<Vector3>({
  x: 0,
  y: 0,
  z: 0,
})

const openItems = useStorage<string[]>('inspector:open-items', components.value.map(item => item.title))
</script>

<template>
  <AGUIAccordion v-model="openItems" type="multiple">
    <AGUIPropertiesPanel v-for="item in components" :key="item.title" :item="item" />
    <!-- <AGUIAccordionItem
      :item="{
        icon: 'i-ri-cloud-line',
        title: 'test',
      }"
    >
      <AGUIForm>
        <AGUIFormItem label="Default">
          <AGUIInputVector v-model="vector3" />
        </AGUIFormItem>

        <AGUIFormItem label="Default">
          <AGUICheckbox />
        </AGUIFormItem>
        <AGUIFormItem label="Checked" description="Checked Checkbox">
          <AGUICheckbox checked />
        </AGUIFormItem>
        <AGUIFormItem label="Disabled">
          <AGUICheckbox disabled />
        </AGUIFormItem>
      </AGUIForm>
    </AGUIAccordionItem> -->
  </AGUIAccordion>
</template>
