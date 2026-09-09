import { Component, Composition, CompositionComponent, Player, Plugin, VFXItem, registerPlugin, unregisterPlugin } from '@galacean/effects';

const { expect } = chai;

describe('core/components/lifecycle', () => {
  let player: Player;
  let composition: Composition;
  let events: string[];

  class Probe extends Component {
    override onAwake () { events.push(`${this.item.name}:awake`); }
    override onStart () { events.push(`${this.item.name}:start`); }
    override onEnable () { events.push(`${this.item.name}:enable`); }
    override onDisable () { events.push(`${this.item.name}:disable`); }
    override onDestroy () { events.push(`${this.item.name}:destroy`); }
    override onUpdate () { events.push(`${this.item.name}:update`); }
    override onLateUpdate () { events.push(`${this.item.name}:late`); }
    override onPreRender () { events.push(`${this.item.name}:render`); }
  }

  function item (name: string, parent?: VFXItem) {
    const node = new VFXItem(player.engine);

    node.name = name;
    if (parent) {
      node.setParent(parent);
    }

    return node;
  }

  beforeEach(() => {
    events = [];
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
    composition = new Composition(player.engine);
  });

  afterEach(() => {
    unregisterPlugin('component-lifecycle');
    player.dispose();
  });

  it('separates item initialization from hierarchy and component initialization', () => {
    const parent = item('parent');
    const child = item('child', parent);
    const parentProbe = parent.addComponent(Probe);
    const childProbe = child.addComponent(Probe);

    for (const object of [parent, child, parentProbe, childProbe]) {
      object.unregisterObject();
    }
    parent.initialize();
    expect(parent.isRegistered).equals(true);
    expect(child.isRegistered).equals(false);
    expect(parentProbe.isRegistered).equals(false);
    expect(childProbe.isRegistered).equals(false);
    expect(events).deep.equals([]);
    parent.initializeHierarchy();
    expect(events).deep.equals(['parent:awake', 'child:awake']);
    for (const object of [parent, child, parentProbe, childProbe]) {
      expect(object.isRegistered).equals(true);
      expect(player.engine.objectInstance[object.getInstanceId()]).equals(object);
    }
    parent.initializeHierarchy();
    expect(events).deep.equals(['parent:awake', 'child:awake']);
    parent.dispose();
  });

  it('registers and unregisters through the object only once', () => {
    const node = item('node');

    node.unregisterObject();
    chai.spy.on(player.engine, 'addInstance');
    chai.spy.on(player.engine, 'removeInstance');
    node.registerObject();
    node.registerObject();
    expect(node.isRegistered).equals(true);
    expect(player.engine.addInstance).to.have.been.called.once;
    node.unregisterObject();
    node.unregisterObject();
    expect(node.isRegistered).equals(false);
    expect(player.engine.removeInstance).to.have.been.called.once;
    expect(player.engine.objectInstance[node.getInstanceId()]).equals(undefined);
    node.dispose();
  });

  it('preserves registration state when changing an instance ID', () => {
    const node = item('node');
    const originalID = node.getInstanceId();
    const registeredID = '11111111111141118111111111111112';
    const unregisteredID = '11111111111141118111111111111113';

    node.setInstanceId(registeredID);
    expect(node.isRegistered).equals(true);
    expect(player.engine.objectInstance[originalID]).equals(undefined);
    expect(player.engine.objectInstance[registeredID]).equals(node);
    node.unregisterObject();
    node.setInstanceId(unregisteredID);
    expect(node.isRegistered).equals(false);
    expect(player.engine.objectInstance[registeredID]).equals(undefined);
    expect(player.engine.objectInstance[unregisteredID]).equals(undefined);
    node.registerObject();
    expect(player.engine.objectInstance[unregisteredID]).equals(node);
    node.dispose();
  });

  it('keeps registration flags consistent when clearing the engine lookup table', () => {
    const node = item('node');

    player.engine.clearResources();
    expect(node.isRegistered).equals(false);
    expect(player.engine.objectInstance[node.getInstanceId()]).equals(undefined);
    node.registerObject();
    expect(node.isRegistered).equals(true);
    expect(player.engine.objectInstance[node.getInstanceId()]).equals(node);
    node.dispose();
  });

  it('initializes inactive and disabled components before play without starting them', () => {
    const node = item('node');
    const probe = node.addComponent(Probe);

    probe.enabled = false;
    node.setActive(false);
    node.setParent(composition.sceneRoot);
    composition.root.beginPlay();
    expect(events).deep.equals(['node:awake']);
    node.setActive(true);
    expect(events).deep.equals(['node:awake']);
    probe.enabled = true;
    expect(events).deep.equals(['node:awake', 'node:start', 'node:enable']);
    probe.enabled = false;
    probe.enabled = true;
    expect(events.slice(3)).deep.equals(['node:disable', 'node:enable']);
  });

  it('begins children before their parent and starts all sibling components before enabling', () => {
    const parent = item('parent');
    const child = item('child', parent);

    parent.addComponent(Probe);
    parent.addComponent(Probe);
    child.addComponent(Probe);
    events = [];
    parent.setParent(composition.sceneRoot);
    expect(events).deep.equals([
      'parent:awake', 'parent:awake', 'child:awake',
      'child:start', 'child:enable', 'parent:start', 'parent:start', 'parent:enable', 'parent:enable',
    ]);
  });

  it('uses the same order for components added during play', () => {
    composition.root.beginPlay();
    const node = item('node', composition.sceneRoot);

    node.addComponent(Probe);
    expect(events).deep.equals(['node:awake', 'node:start', 'node:enable']);
  });

  it('delegates the owning-item API to setParent and links the component only once', () => {
    const node = item('node', composition.sceneRoot);
    const probe = new Probe(player.engine);

    chai.spy.on(probe, 'setParent');
    probe.setVFXItem(node);
    probe.setVFXItem(node);
    expect(probe.setParent).to.have.been.called.twice;
    expect(node.components.filter(component => component === probe)).length(1);
    expect(events).deep.equals(['node:awake', 'node:start', 'node:enable']);
  });

  it('disables before detaching and only re-enables when reattaching a running component', () => {
    const first = item('first', composition.sceneRoot);
    const second = item('second', composition.sceneRoot);
    const probe = first.addComponent(Probe);

    events = [];
    probe.setVFXItem(null);
    expect(events).deep.equals(['first:disable']);
    expect(probe.item).equals(null);
    expect(first.components).not.includes(probe);
    expect(probe.isDuringPlay).equals(true);
    expect(probe.isRegistered).equals(true);
    expect(composition.sceneTicking.update.components).not.includes(probe);
    probe.setVFXItem(second);
    expect(events).deep.equals(['first:disable', 'second:enable']);
    expect(second.components.filter(component => component === probe)).length(1);
  });

  it('does not synthesize Disable or Enable when moving directly between running items', () => {
    const first = item('first', composition.sceneRoot);
    const second = item('second', composition.sceneRoot);
    const probe = first.addComponent(Probe);

    events = [];
    probe.setParent(second);
    expect(events).deep.equals([]);
    expect(first.components).not.includes(probe);
    expect(second.components.filter(component => component === probe)).length(1);
    composition.sceneTicking.update.tick(16);
    expect(events).deep.equals(['second:update']);
  });

  it('matches first-attachment behavior for an enabled component on an inactive running item', () => {
    const node = item('node', composition.sceneRoot);

    node.setActive(false);
    const probe = node.addComponent(Probe);

    // First attachment checks the component's enabled flag rather than the item's active flag.
    expect(events).deep.equals(['node:awake', 'node:start', 'node:enable']);
    expect(probe.isActiveAndEnabled).equals(false);
  });

  it('sets one-shot flags before calling user code', () => {
    class Reentrant extends Probe {
      override onAwake () {
        super.onAwake();
        this.item.initializeHierarchy();
      }
      override onStart () {
        super.onStart();
        this.start();
      }
    }
    const node = item('node');

    node.addComponent(Reentrant);
    node.setParent(composition.sceneRoot);
    composition.root.beginPlay();
    expect(events).deep.equals(['node:awake', 'node:start', 'node:enable']);
  });

  it('skips a component removed by another Awake callback', () => {
    const node = item('node');

    class RemoveSibling extends Probe {
      override onAwake () {
        super.onAwake();
        sibling.dispose();
      }
    }
    node.addComponent(RemoveSibling);
    const sibling = node.addComponent(Probe);

    node.setParent(composition.sceneRoot);
    composition.root.beginPlay();
    expect(events).deep.equals(['node:awake', 'node:start', 'node:enable']);
  });

  it('does not enable a component that disables itself in Start', () => {
    class DisableInStart extends Probe {
      override onStart () {
        super.onStart();
        this.enabled = false;
      }
    }
    const node = item('node');

    node.addComponent(DisableInStart);
    node.setParent(composition.sceneRoot);
    expect(events).deep.equals(['node:awake', 'node:start']);
  });

  it('changes only the current item when toggling active', () => {
    const parent = item('parent', composition.sceneRoot);
    const child = item('child', parent);
    const inactive = item('inactive');

    parent.addComponent(Probe);
    const childProbe = child.addComponent(Probe);

    inactive.setActive(false);
    inactive.addComponent(Probe);
    inactive.setParent(parent);
    composition.root.beginPlay();
    events = [];
    parent.setActive(false);
    expect(child.isActive).equals(true);
    expect(childProbe.isActiveAndEnabled).equals(true);
    expect(childProbe.isEnableCalled).equals(true);
    composition.sceneTicking.update.tick(16);
    parent.setActive(true);
    expect(inactive.isActive).equals(false);
    expect(events).deep.equals(['parent:disable', 'child:update', 'parent:enable']);
  });

  it('hides all existing descendants when a composition component is disabled', () => {
    const parent = item('parent', composition.sceneRoot);
    const gate = parent.addComponent(CompositionComponent);
    const child = item('child', parent);
    const nested = item('nested', child);

    child.addComponent(Probe);
    nested.addComponent(Probe);
    gate.enabled = false;
    expect(child.isActive).equals(false);
    expect(nested.isActive).equals(false);
    events = [];
    composition.sceneTicking.update.tick(16);
    composition.sceneTicking.preRender.tick(0);
    expect(events).deep.equals([]);
    gate.enabled = true;
    expect(events).deep.equals(['child:enable', 'nested:enable']);
    expect(child.isActive).equals(true);
    expect(nested.isActive).equals(true);
  });

  it('lets each composition component activate and deactivate its descendants', () => {
    const parent = item('parent', composition.sceneRoot);
    const outer = parent.addComponent(CompositionComponent);
    const nested = item('nested', parent);
    const inner = nested.addComponent(CompositionComponent);
    const child = item('child', nested);

    child.addComponent(Probe);
    events = [];
    inner.enabled = false;
    expect(child.isActive).equals(false);
    inner.enabled = true;
    expect(child.isActive).equals(true);
    expect(events).deep.equals(['child:disable', 'child:enable']);
    events = [];
    outer.enabled = false;
    expect(nested.isActive).equals(false);
    expect(child.isActive).equals(false);
    outer.enabled = true;
    expect(nested.isActive).equals(true);
    expect(child.isActive).equals(true);
    expect(events).deep.equals(['child:disable', 'child:enable']);
  });

  it('preserves activation when reparenting under an inactive item', () => {
    const inactive = item('inactive', composition.sceneRoot);
    const node = item('node', composition.sceneRoot);

    inactive.setActive(false);
    node.addComponent(Probe);
    composition.root.beginPlay();
    events = [];
    node.setParent(inactive);
    expect(node.isActive).equals(true);
    expect(node.getComponent(Probe).isActiveAndEnabled).equals(true);
    node.setParent(composition.sceneRoot);
    expect(events).deep.equals([]);
  });

  it('moves an entire subtree between composition tick registries', () => {
    const other = new Composition(player.engine);
    const parent = item('parent', composition.sceneRoot);
    const child = item('child', parent);

    child.addComponent(Probe);
    composition.root.beginPlay();
    other.root.beginPlay();
    events = [];
    parent.setParent(other.sceneRoot);
    expect(child.composition).equals(other);
    expect(events).deep.equals(['child:disable', 'child:enable']);
    events = [];
    composition.sceneTicking.update.tick(16);
    expect(events).deep.equals([]);
    other.sceneTicking.update.tick(16);
    expect(events).deep.equals(['child:update']);
  });

  it('recursively destroys children once and removes all ticking registrations', () => {
    const parent = item('parent', composition.sceneRoot);
    const child = item('child', parent);
    const grandchild = item('grandchild', child);
    const nodes = [parent, child, grandchild];

    nodes.forEach(node => node.addComponent(Probe));
    composition.root.beginPlay();
    events = [];
    parent.dispose();
    parent.dispose();
    nodes.forEach(node => {
      expect(node.isDuringPlay).equals(false);
      expect(node.parent).equals(undefined);
      expect(node.components).length(0);
      expect(node.children).length(0);
      expect(events.filter(event => event === `${node.name}:destroy`)).length(1);
    });
    expect(composition.sceneRoot.children).not.includes(parent);
    expect(composition.sceneRoot.children).not.includes(child);
    events = [];
    composition.sceneTicking.update.tick(16);
    composition.sceneTicking.lateUpdate.tick(16);
    composition.sceneTicking.preRender.tick(0);
    expect(events).deep.equals([]);
  });

  it('calls Destroy after Awake even when a component never started', () => {
    const node = item('node');

    node.setActive(false);
    node.addComponent(Probe);
    node.setParent(composition.sceneRoot);
    node.dispose();
    expect(events).deep.equals(['node:awake', 'node:destroy']);
  });

  it('EndPlay followed by disposal does not duplicate lifecycle callbacks', () => {
    const node = item('node', composition.sceneRoot);

    node.addComponent(Probe);
    composition.root.beginPlay();
    events = [];
    node.endPlay();
    node.dispose();
    expect(events).deep.equals(['node:disable', 'node:destroy']);
  });

  it('uses live-array iteration when the current component removes itself', () => {
    class SelfDestroy extends Probe {
      override onUpdate () {
        super.onUpdate();
        this.dispose();
      }
    }
    const first = item('first', composition.sceneRoot);
    const second = item('second', composition.sceneRoot);

    first.addComponent(SelfDestroy);
    second.addComponent(Probe);
    composition.root.beginPlay();
    events = [];
    composition.sceneTicking.update.tick(16);
    expect(events).deep.equals(['first:update', 'first:disable', 'first:destroy']);
    events = [];
    composition.sceneTicking.update.tick(16);
    expect(events).deep.equals(['second:update']);
  });

  it('skips removed components and visits additions in the same Update pass', () => {
    const first = item('first', composition.sceneRoot);
    const second = item('second', composition.sceneRoot);
    let added = false;

    class Mutate extends Probe {
      override onUpdate () {
        super.onUpdate();
        if (!added) {
          added = true;
          secondProbe.enabled = false;
          item('added', composition.sceneRoot).addComponent(Probe);
        }
      }
    }
    first.addComponent(Mutate);
    const secondProbe = second.addComponent(Probe);

    composition.root.beginPlay();
    events = [];
    composition.sceneTicking.update.tick(16);
    expect(events).not.includes('second:update');
    expect(events).includes('added:update');
    events = [];
    composition.sceneTicking.update.tick(16);
    expect(events).deep.equals(['first:update', 'added:update']);
  });

  it('updates composition components in the same registration order as other components', () => {
    const parent = item('parent');
    const child = item('child', parent);

    class Timeline extends CompositionComponent {
      override onUpdate () { events.push('timeline'); }
    }
    parent.addComponent(Timeline);
    child.addComponent(Probe);
    parent.setParent(composition.sceneRoot);
    events = [];
    composition.resume();
    composition.update(16);
    expect(events).deep.equals(['child:update', 'timeline', 'child:late']);
  });

  it('completes Awake, Start and Enable during construction even while playback is paused', () => {
    class LifecyclePlugin extends Plugin {
      override onCompositionCreated (created: Composition) {
        created.sceneRoot.addComponent(Probe);
      }
    }
    registerPlugin('component-lifecycle', LifecyclePlugin);
    const created = new Composition(player.engine);

    expect(created.getPaused()).equals(true);
    expect(created.root.isDuringPlay).equals(true);
    expect(events).deep.equals(['sceneRoot:awake', 'sceneRoot:start', 'sceneRoot:enable']);
    events = [];
    created.update(16);
    expect(events).deep.equals([]);
    created.resume();
    created.update(16);
    expect(events).deep.equals(['sceneRoot:update', 'sceneRoot:late']);
  });

  it('finishes lifecycle callbacks before loadScene resolves with autoplay disabled', async () => {
    class LifecyclePlugin extends Plugin {
      override onCompositionCreated (created: Composition) {
        created.sceneRoot.addComponent(Probe);
      }
    }
    registerPlugin('component-lifecycle', LifecyclePlugin);
    const id = '11111111111141118111111111111111';
    const loaded = await player.loadScene({
      version: '3.0',
      type: 'ge',
      compositionId: id,
      compositions: [{ id, name: 'paused', duration: 1, startTime: 0, endBehavior: 2, items: [] }],
      items: [],
      components: [],
      images: [],
      textures: [],
      bins: [],
      plugins: [],
      shapes: [],
    }, { autoplay: false });

    expect(loaded.getPaused()).equals(true);
    expect(loaded.root.isDuringPlay).equals(true);
    expect(events).deep.equals(['sceneRoot:awake', 'sceneRoot:start', 'sceneRoot:enable']);
    loaded.pause();
    loaded.resume();
    expect(events).deep.equals(['sceneRoot:awake', 'sceneRoot:start', 'sceneRoot:enable']);
  });

  it('keeps the Enable flag and ticking registration until Disable returns', () => {
    class Inspect extends Probe {
      override onDisable () {
        expect(this.isEnableCalled).equals(true);
        expect(this.isDuringPlay).equals(true);
        expect(this.item.isDuringPlay).equals(true);
        expect(composition.sceneTicking.update.components).includes(this);
        super.onDisable();
      }
    }
    const node = item('node', composition.sceneRoot);
    const probe = node.addComponent(Inspect);

    events = [];
    probe.enabled = false;
    expect(events).deep.equals(['node:disable']);
    expect(probe.isEnableCalled).equals(false);
    expect(composition.sceneTicking.update.components).not.includes(probe);
  });

  it('destroys a standalone component before ending its play and unlinking it', () => {
    class Inspect extends Probe {
      override onDestroy () {
        expect(this.isAwakeCalled).equals(false);
        expect(this.isEnableCalled).equals(false);
        expect(this.isDuringPlay).equals(true);
        expect(this.item.isDuringPlay).equals(true);
        expect(this.item.isActive).equals(true);
        expect(this.item.components).includes(this);
        super.onDestroy();
      }
    }
    const node = item('node', composition.sceneRoot);
    const probe = node.addComponent(Inspect);

    events = [];
    probe.dispose();
    expect(events).deep.equals(['node:disable', 'node:destroy']);
    expect(probe.isDuringPlay).equals(false);
    expect(probe.isRegistered).equals(false);
    expect(node.components).not.includes(probe);
    expect(player.engine.objectInstance[probe.getInstanceId()]).equals(undefined);
  });

  it('ends the parent before its children, then ends its attached components', () => {
    const states: string[] = [];

    class InspectItem extends VFXItem {
      override onBeginPlay () {
        states.push(`${this.name}:begin:${this.isDuringPlay}:${this.components[0].isDuringPlay}`);
      }
      override onEndPlay () {
        states.push(`${this.name}:end:${this.isDuringPlay}:${this.components[0].isDuringPlay}`);
      }
    }
    class Inspect extends Probe {
      override onDisable () {
        expect(this.isEnableCalled).equals(true);
        expect(this.isDuringPlay).equals(true);
        expect(this.item.isDuringPlay).equals(true);
        expect(this.item.isActive).equals(true);
        super.onDisable();
      }
      override onDestroy () {
        expect(this.isDuringPlay).equals(true);
        expect(this.item.isDuringPlay).equals(true);
        expect(this.isAwakeCalled).equals(false);
        expect(this.isEnableCalled).equals(false);
        if (this.item.name === 'child') {
          expect(parent.isDuringPlay).equals(false);
          expect(parentProbe.isDuringPlay).equals(true);
        }
        super.onDestroy();
      }
    }
    const parent = new InspectItem(player.engine);
    const child = new InspectItem(player.engine);

    parent.name = 'parent';
    child.name = 'child';
    const parentProbe = parent.addComponent(Inspect);
    const childProbe = child.addComponent(Inspect);

    child.setParent(parent);
    parent.setParent(composition.sceneRoot);
    expect(states).deep.equals(['parent:begin:true:false', 'child:begin:true:false']);
    states.length = 0;
    events = [];
    parent.dispose();
    expect(events).deep.equals(['parent:disable', 'parent:destroy', 'child:disable', 'child:destroy']);
    expect(states).deep.equals(['parent:end:true:true', 'child:end:true:true']);
    expect(parentProbe.isDuringPlay).equals(false);
    expect(childProbe.isDuringPlay).equals(false);
    for (const object of [parent, child, parentProbe, childProbe]) {
      expect(object.isRegistered).equals(false);
    }
  });

  it('Component EndPlay only clears play state and unregisters the object', () => {
    const node = item('node', composition.sceneRoot);
    const probe = node.addComponent(Probe);

    events = [];
    probe.endPlay();
    expect(events).deep.equals([]);
    expect(probe.isDuringPlay).equals(false);
    expect(probe.isAwakeCalled).equals(true);
    expect(probe.isEnableCalled).equals(true);
    expect(player.engine.objectInstance[probe.getInstanceId()]).equals(undefined);
    probe.dispose();
    expect(events).deep.equals(['node:disable', 'node:destroy']);
  });

  it('clears every tick phase and callback', () => {
    const node = item('node', composition.sceneRoot);

    node.addComponent(Probe);
    composition.root.beginPlay();
    composition.sceneTicking.preRender.addTick(() => events.push('callback'), node);
    composition.sceneTicking.clear();
    events = [];
    composition.sceneTicking.update.tick(16);
    composition.sceneTicking.lateUpdate.tick(16);
    composition.sceneTicking.preRender.tick(0);
    expect(events).deep.equals([]);
  });
});
