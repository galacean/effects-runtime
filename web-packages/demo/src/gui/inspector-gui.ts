import { ItemBehaviour, RendererComponent, type VFXItem, type VFXItemContent } from '@galacean/effects';

export class InspectorGui {
  gui: any;
  item: VFXItem<VFXItemContent>;
  itemDirtyFlag = false;

  guiControllers: any[] = [];

  constructor () {
    //@ts-expect-error
    this.gui = new dat.GUI();
    this.gui.addFolder('Inspector');
    // setInterval(this.updateInspector, 500);
  }

  update = ()=> {
    if (this.item && this.itemDirtyFlag) {
      this.guiControllers = [];
      this.gui.destroy();
      //@ts-expect-error
      this.gui = new dat.GUI();
      this.gui.add(this.item, 'name');

      const transformFolder = this.gui.addFolder('Transform');
      const positionFolder = transformFolder.addFolder('Position');
      const rotationFolder = transformFolder.addFolder('Rotation');
      const scaleFolder = transformFolder.addFolder('Scale');

      transformFolder.open();
      positionFolder.open();
      rotationFolder.open();
      scaleFolder.open();

      // @ts-expect-error
      this.guiControllers.push(positionFolder.add(this.item.transform.position, 'x').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(positionFolder.add(this.item.transform.position, 'y').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(positionFolder.add(this.item.transform.position, 'z').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));

      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(this.item.transform.rotation, 'x').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(this.item.transform.rotation, 'y').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(rotationFolder.add(this.item.transform.rotation, 'z').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));

      // @ts-expect-error
      this.guiControllers.push(scaleFolder.add(this.item.transform.scale, 'x').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(scaleFolder.add(this.item.transform.scale, 'y').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));
      // @ts-expect-error
      this.guiControllers.push(scaleFolder.add(this.item.transform.scale, 'z').step(0.05).onChange(()=>{this.item.transform.dirtyFlags.localData = true;}));

      for (const component of this.item.components) {
        const folder = this.gui.addFolder(component.constructor.name);

        if (component instanceof RendererComponent || component instanceof ItemBehaviour) {
          const controller = folder.add(component, '_enabled');

          this.guiControllers.push(controller);
        }

        if (component.constructor.name === 'TimelineComponent') {
          const controller = folder.add(component, 'time');
          const controller2 = folder.add(component, 'reusable');

          this.guiControllers.push(controller);
          this.guiControllers.push(controller2);
        }

        folder.open();
      }

      this.itemDirtyFlag = false;
    }

    for (const controller of this.guiControllers) {
      controller.updateDisplay();
    }
  };

  setItem (item: VFXItem<VFXItemContent>) {
    if (this.item === item) {
      return;
    }
    this.item = item;
    this.itemDirtyFlag = true;
  }
}