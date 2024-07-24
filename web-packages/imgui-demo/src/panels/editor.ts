export class Editor {
  onInspectorGUI () {

  }
}

export const editorStore = new Map<Function, new () => Editor>();
export function editor (ComponentType: Function) {
  return (target: any, context?: unknown) => {
    if (editorStore.get(ComponentType)) {
      console.warn(`Class ${target} 重复注册`);
    }
    editorStore.set(ComponentType, target);
  };
}