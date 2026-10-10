import {
  ActivationPlayableAsset, ActivationTrack, Asset, CompositionComponent, FloatPropertyPlayableAsset,
  FloatPropertyTrack, ObjectBindingTrack, Player, PlayState, SerializationHelper, SpriteComponent,
  TimelineAsset, TimelineInstance, TrackAsset, TransformPlayableAsset, TransformTrack, VFXItem, spec,
} from '@galacean/effects';

const { expect } = chai;

describe('core/plugins/timeline/asset-update', () => {
  let player: Player;
  let root: VFXItem;
  let target: VFXItem;
  let component: CompositionComponent;

  beforeEach(() => {
    player = new Player({ canvas: document.createElement('canvas'), manualRender: true });
    root = new VFXItem(player.engine);
    root.duration = 10;
    target = new VFXItem(player.engine);
    target.duration = 0;
    target.setParent(root);
    component = root.addComponent(CompositionComponent);
  });

  afterEach(() => {
    root.dispose();
    player.dispose();
  });

  function curveData (asset: FloatPropertyPlayableAsset, end: number): spec.FloatPropertyPlayableAssetData {
    return {
      id: asset.getInstanceId(), dataType: spec.DataType.FloatPropertyPlayableAsset,
      curveData: [spec.ValueType.BEZIER_CURVE, [[spec.BezierKeyframeType.LINE, [0, 0]], [spec.BezierKeyframeType.LINE, [1, end]]]],
    };
  }

  function updateCurve (timeline: TimelineAsset, asset: FloatPropertyPlayableAsset, end: number) {
    SerializationHelper.deserialize(curveData(asset, end), asset);
    timeline.setData(timeline.definition as spec.TimelineAssetData);
  }

  function bind (timeline: TimelineAsset, track: TrackAsset, receiver = component, item = target, initialize = true) {
    receiver.fromData({
      id: receiver.getInstanceId(), dataType: spec.DataType.CompositionComponent,
      timelineAsset: { id: timeline.getInstanceId() },
      sceneBindings: [{ key: { id: track.getInstanceId() }, value: { id: item.getInstanceId() } }],
    } as spec.CompositionComponentData);
    if (initialize) {
      receiver.initialize();
    }
  }

  function setup (initialize = true) {
    const asset = new FloatPropertyPlayableAsset(player.engine);
    const track = new FloatPropertyTrack(player.engine);
    const timeline = new TimelineAsset(player.engine);

    SerializationHelper.deserialize(curveData(asset, 10), asset);
    SerializationHelper.deserialize({
      id: track.getInstanceId(), dataType: spec.DataType.FloatPropertyTrack, path: 'duration', children: [],
      clips: [{ start: 0, duration: 2, endBehavior: spec.EndBehavior.freeze, asset: { id: asset.getInstanceId() } }],
    } as spec.TrackAssetData, track);
    SerializationHelper.deserialize({
      id: timeline.getInstanceId(), dataType: spec.DataType.TimelineAsset,
      tracks: [{ id: track.getInstanceId() }],
    } as spec.TimelineAssetData, timeline);
    bind(timeline, track, component, target, initialize);

    return { asset, track, timeline };
  }

  function runtime (receiver = component) {
    return receiver as unknown as { _timelineInstance: TimelineInstance | null };
  }

  it('Timeline setter 在 Awake 前开始监听，播放图使用最新关键帧', () => {
    const { asset, track, timeline } = setup(false);
    let resets = 0;
    const originalReset = component.resetState.bind(component);

    component.resetState = () => { resets++; originalReset(); };
    bind(timeline, track, component, target, false);
    const beforeAwake = resets;

    updateCurve(timeline, asset, 20);
    expect(component.isAwakeCalled).to.equal(false);
    expect(resets).to.equal(beforeAwake + 1);
    expect(runtime()._timelineInstance).to.equal(null);
    component.initialize();
    component.sampleTime(1);
    expect(target.duration).to.equal(10);
    updateCurve(timeline, asset, 30);
    expect(resets).to.equal(beforeAwake + 2);
    expect(runtime()._timelineInstance).to.equal(null);
    component.sampleTime(1);
    expect(target.duration).to.equal(15);
  });

  it('Awake 前采样后 dispose 释放播放图和监听，不补调用 onDestroy', () => {
    const { asset, timeline } = setup(false);

    component.sampleTime(1);
    expect(component.isAwakeCalled).to.equal(false);
    expect(target.duration).to.equal(5);
    const instance = runtime()._timelineInstance!;
    let destroys = 0;
    let resets = 0;
    const originalDestroy = component.onDestroy.bind(component);
    const originalReset = component.resetState.bind(component);

    component.onDestroy = () => { destroys++; originalDestroy(); };
    component.resetState = () => { resets++; originalReset(); };
    component.dispose();
    expect(runtime()._timelineInstance).to.equal(null);
    expect(instance.masterTrackInstances).to.deep.equal([]);
    component.dispose();
    const beforeUpdate = resets;

    updateCurve(timeline, asset, 20);
    expect(destroys).to.equal(0);
    expect(resets).to.equal(beforeUpdate);
    expect(target.duration).to.equal(5);
  });

  it('Timeline setter 立即切换监听，相同引用和 Awake 不重复绑定，置空时解除监听', () => {
    const { asset, timeline } = setup(false);
    const other = new TimelineAsset(player.engine);
    let bindings = 0;
    const originalOn = timeline.on.bind(timeline);

    timeline.on = (event, listener) => {
      bindings++;

      return originalOn(event, listener);
    };
    other.setData({ id: other.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: [] });
    component.timelineAsset = other;
    component.timelineAsset = timeline;
    expect(bindings).to.equal(1);
    component.initialize();
    expect(bindings).to.equal(1);
    component.timelineAsset = timeline;
    component.fromData({ id: component.getInstanceId(), dataType: spec.DataType.CompositionComponent } as spec.CompositionComponentData);
    expect(bindings).to.equal(1);

    component.timelineAsset = other;
    component.sampleTime(1);
    const instance = runtime()._timelineInstance;

    updateCurve(timeline, asset, 20);
    expect(runtime()._timelineInstance).to.equal(instance);
    other.setData({ id: other.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: [] });
    expect(runtime()._timelineInstance).to.equal(null);
    component.timelineAsset = null;
    expect(component.timelineAsset).to.equal(null);
    let resets = 0;
    const originalReset = component.resetState.bind(component);

    component.resetState = () => { resets++; originalReset(); };
    other.setData({ id: other.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: [] });
    expect(resets).to.equal(0);
  });

  it('fromData 保留未变的播放图', () => {
    const { track, timeline } = setup();

    component.sampleTime(1);
    const old = runtime()._timelineInstance;

    component.fromData({ id: component.getInstanceId(), dataType: spec.DataType.CompositionComponent } as spec.CompositionComponentData);
    expect(runtime()._timelineInstance).to.equal(old);
    bind(timeline, track);
    expect(runtime()._timelineInstance).to.equal(old);
  });

  it('setData 在解析成功后通知，保持 ID，失败时不发送 changed', () => {
    class Probe extends Asset {
      value = 0;
      override fromData (data: spec.EffectsObjectData & { value: number }) {
        super.fromData(data);
        if (data.value < 0) {
          throw new Error('Invalid value.');
        }
        this.value = data.value;
      }
    }
    const asset = new Probe(player.engine);
    const data = { id: asset.getInstanceId(), dataType: spec.DataType.TimelineAsset, value: 3 };
    const observed: number[] = [];
    const unsubscribe = asset.on('changed', changed => {
      expect(changed).to.equal(asset);
      expect(asset.definition.value).to.equal(asset.value);
      observed.push(asset.value);
    });

    asset.setData(data);
    expect(() => asset.setData({ ...data, value: -1 })).to.throw('Invalid value.');
    expect(() => asset.setData({ ...data, id: 'different' })).to.throw('Cannot change asset ID');
    expect(asset.getInstanceId()).to.equal(data.id);
    expect(observed).to.deep.equal([3]);
    unsubscribe();
    asset.setData({ ...data, value: 4 });
    expect(observed).to.deep.equal([3]);
  });

  it('Timeline setData 使所有共享播放器失效，下一次采样重建并保留暂停和时间', () => {
    const { asset, track, timeline } = setup();
    const secondRoot = new VFXItem(player.engine);
    const secondTarget = new VFXItem(player.engine);

    secondRoot.setParent(root);
    secondTarget.setParent(secondRoot);
    secondTarget.duration = 0;
    const second = secondRoot.addComponent(CompositionComponent);

    bind(timeline, track, second, secondTarget);
    component.sampleTime(1);
    second.sampleTime(1);
    component.pause();
    expect(target.duration).to.equal(5);
    const old = runtime()._timelineInstance!;

    updateCurve(timeline, asset, 20);
    expect(old.masterTrackInstances).to.deep.equal([]);
    expect(runtime()._timelineInstance).to.equal(null);
    expect(runtime(second)._timelineInstance).to.equal(null);
    expect(component.state).to.equal(PlayState.Paused);
    expect(component.getTime()).to.equal(1);
    component.sampleTime(component.getTime());
    second.sampleTime(second.getTime());
    expect(target.duration).to.equal(10);
    expect(secondTarget.duration).to.equal(10);
    expect(runtime()._timelineInstance).not.to.equal(old);
    old.dispose();
    expect(runtime()._timelineInstance).not.to.equal(null);
  });

  it('Timeline setData 统一提交 clip 替换和轨道删除', () => {
    const { track, timeline } = setup();
    const replacement = new FloatPropertyPlayableAsset(player.engine);

    SerializationHelper.deserialize(curveData(replacement, 30), replacement);
    component.sampleTime(1);
    const old = runtime()._timelineInstance;
    let changed = 0;

    timeline.on('changed', () => changed++);
    SerializationHelper.deserialize({
      ...track.definition, id: track.getInstanceId(), dataType: spec.DataType.FloatPropertyTrack, path: 'duration', children: [],
      clips: [{ start: 0, duration: 2, endBehavior: spec.EndBehavior.freeze, asset: { id: replacement.getInstanceId() } }],
    } as Parameters<FloatPropertyTrack['fromData']>[0], track);
    expect(changed).to.equal(0);
    expect(runtime()._timelineInstance).to.equal(old);
    timeline.setData(timeline.definition as spec.TimelineAssetData);
    expect(changed).to.equal(1);
    component.sampleTime(1);
    expect(target.duration).to.equal(15);
    updateCurve(timeline, replacement, 50);
    expect(changed).to.equal(2);
    component.sampleTime(1);
    expect(target.duration).to.equal(25);

    timeline.setData({ id: timeline.getInstanceId(), dataType: spec.DataType.TimelineAsset } as spec.TimelineAssetData);
    expect(timeline.flattenedTracks).to.deep.equal([]);
    expect(() => component.sampleTime(1)).not.to.throw();
    expect(runtime()._timelineInstance!.masterTrackInstances).to.deep.equal([]);
    expect(changed).to.equal(3);
  });

  it('Timeline setData 刷新子轨道结构和扁平缓存', () => {
    const { track, timeline } = setup();
    const parent = new TrackAsset(player.engine);

    SerializationHelper.deserialize({
      id: parent.getInstanceId(), dataType: spec.DataType.TrackAsset, clips: [],
      children: [{ id: track.getInstanceId() }],
    } as spec.TrackAssetData, parent);
    timeline.setData({
      id: timeline.getInstanceId(), dataType: spec.DataType.TimelineAsset,
      tracks: [{ id: parent.getInstanceId() }],
    });
    bind(timeline, parent);
    component.sampleTime(1);
    expect(timeline.flattenedTracks).to.deep.equal([parent, track]);
    expect(target.duration).to.equal(5);
    SerializationHelper.deserialize({ id: parent.getInstanceId(), dataType: spec.DataType.TrackAsset } as spec.TrackAssetData, parent);
    expect(track.parent).to.equal(undefined);
    expect(timeline.flattenedTracks).to.deep.equal([parent, track]);
    timeline.setData(timeline.definition as spec.TimelineAssetData);
    expect(timeline.flattenedTracks).to.deep.equal([parent]);
    component.sampleTime(1);
    expect(runtime()._timelineInstance!.masterTrackInstances[0].children).to.deep.equal([]);
  });

  it('切换 Timeline 和销毁组件均解除旧监听', () => {
    const { asset, track, timeline } = setup();
    const other = new TimelineAsset(player.engine);

    other.setData({ id: other.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: [] });
    bind(other, track);
    component.sampleTime(1);
    const instance = runtime()._timelineInstance;

    updateCurve(timeline, asset, 20);
    expect(runtime()._timelineInstance).to.equal(instance);
    let resets = 0;
    const originalReset = component.resetState.bind(component);

    component.resetState = () => { resets++; originalReset(); };
    component.dispose();
    const before = resets;

    other.setData({ id: other.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: [] });
    expect(resets).to.equal(before);
  });

  it('Transform 重建保留初始姿态，连续编辑不累积缩放，dispose 不修改当前姿态', () => {
    const asset = new TransformPlayableAsset(player.engine);
    const track = new TransformTrack(player.engine);
    const timeline = new TimelineAsset(player.engine);
    const data: Parameters<TransformPlayableAsset['fromData']>[0] = {
      id: asset.getInstanceId(), dataType: spec.DataType.TransformPlayableAsset,
      positionOverLifetime: {}, sizeOverLifetime: { size: [spec.ValueType.CONSTANT, 2] },
      rotationOverLifetime: { asRotation: true, z: [spec.ValueType.CONSTANT, 30] },
    };

    target.transform.setScale(3, 3, 3);
    target.transform.setRotation(0, 0, 10);
    SerializationHelper.deserialize(data, asset);
    SerializationHelper.deserialize({
      id: track.getInstanceId(), dataType: spec.DataType.TransformTrack, children: [],
      clips: [{ start: 0, duration: 2, endBehavior: spec.EndBehavior.freeze, asset: { id: asset.getInstanceId() } }],
    } as spec.TrackAssetData, track);
    timeline.setData({ id: timeline.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: [{ id: track.getInstanceId() }] });
    bind(timeline, track);
    component.sampleTime(1);
    expect(target.transform.scale.x).to.equal(6);
    expect(target.transform.getRotation().z).to.be.closeTo(40, 1e-5);
    for (const size of [4, 2, 3]) {
      const previousScale = target.transform.scale.x;

      SerializationHelper.deserialize({ ...data, sizeOverLifetime: { size: [spec.ValueType.CONSTANT, size] } } as typeof data, asset);
      timeline.setData(timeline.definition as spec.TimelineAssetData);
      expect(runtime()._timelineInstance).to.equal(null);
      expect(target.transform.scale.x).to.equal(previousScale);
      expect(target.transform.getRotation().z).to.be.closeTo(40, 1e-5);
      component.sampleTime(1);
      expect(target.transform.scale.x).to.equal(3 * size);
      expect(target.transform.getRotation().z).to.be.closeTo(40, 1e-5);
    }
    component.resetState();
    expect(target.transform.scale.x).to.equal(9);
    expect(target.transform.getRotation().z).to.be.closeTo(40, 1e-5);
    component.sampleTime(1);
    component.dispose();
    expect(target.transform.scale.x).to.equal(9);
    expect(target.transform.getRotation().z).to.be.closeTo(40, 1e-5);
  });

  it('不同 Transform 轨道共用初始姿态，删除动画通道后在采样时恢复对应属性', () => {
    const moving = new TransformPlayableAsset(player.engine);
    const scaling = new TransformPlayableAsset(player.engine);
    const movingTrack = new TransformTrack(player.engine);
    const scalingTrack = new TransformTrack(player.engine);
    const parent = new TrackAsset(player.engine);
    const timeline = new TimelineAsset(player.engine);
    const movingData: Parameters<TransformPlayableAsset['fromData']>[0] = {
      id: moving.getInstanceId(), dataType: spec.DataType.TransformPlayableAsset,
      positionOverLifetime: { asMovement: true, linearX: [spec.ValueType.CONSTANT, 2] },
      rotationOverLifetime: { asRotation: true, z: [spec.ValueType.CONSTANT, 30] },
    };
    const scalingData: Parameters<TransformPlayableAsset['fromData']>[0] = {
      id: scaling.getInstanceId(), dataType: spec.DataType.TransformPlayableAsset,
      positionOverLifetime: {}, sizeOverLifetime: { size: [spec.ValueType.CONSTANT, 2] },
    };

    target.transform.setPosition(1, 2, 3);
    target.transform.setRotation(0, 0, 10);
    target.transform.setScale(3, 3, 3);
    SerializationHelper.deserialize(movingData, moving);
    SerializationHelper.deserialize(scalingData, scaling);
    for (const [track, asset] of [[movingTrack, moving], [scalingTrack, scaling]]) {
      SerializationHelper.deserialize({
        id: track.getInstanceId(), dataType: spec.DataType.TransformTrack, children: [],
        clips: [{ start: 0, duration: 2, endBehavior: spec.EndBehavior.freeze, asset: { id: asset.getInstanceId() } }],
      } as spec.TrackAssetData, track);
    }
    SerializationHelper.deserialize({
      id: parent.getInstanceId(), dataType: spec.DataType.TrackAsset, clips: [],
      children: [{ id: movingTrack.getInstanceId() }, { id: scalingTrack.getInstanceId() }],
    } as spec.TrackAssetData, parent);
    timeline.setData({ id: timeline.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: [{ id: parent.getInstanceId() }] });
    bind(timeline, parent);
    component.sampleTime(1);
    expect(target.transform.position.toArray()).to.deep.equal([3, 2, 3]);
    expect(target.transform.getRotation().z).to.be.closeTo(40, 1e-5);
    expect(target.transform.scale.x).to.equal(6);
    SerializationHelper.deserialize({ ...scalingData, sizeOverLifetime: { size: [spec.ValueType.CONSTANT, 4] } } as typeof scalingData, scaling);
    timeline.setData(timeline.definition as spec.TimelineAssetData);
    component.sampleTime(1);
    expect(target.transform.position.toArray()).to.deep.equal([3, 2, 3]);
    expect(target.transform.getRotation().z).to.be.closeTo(40, 1e-5);
    expect(target.transform.scale.x).to.equal(12);
    SerializationHelper.deserialize({ ...scalingData, sizeOverLifetime: undefined } as typeof scalingData, scaling);
    timeline.setData(timeline.definition as spec.TimelineAssetData);
    expect(target.transform.scale.x).to.equal(12);
    component.sampleTime(1);
    expect(target.transform.scale.x).to.equal(3);
    expect(target.transform.position.toArray()).to.deep.equal([3, 2, 3]);
    expect(target.transform.getRotation().z).to.be.closeTo(40, 1e-5);
    SerializationHelper.deserialize({ ...movingData, positionOverLifetime: {}, rotationOverLifetime: undefined } as typeof movingData, moving);
    timeline.setData(timeline.definition as spec.TimelineAssetData);
    expect(target.transform.position.toArray()).to.deep.equal([3, 2, 3]);
    component.sampleTime(1);
    expect(target.transform.position.toArray()).to.deep.equal([1, 2, 3]);
    expect(target.transform.getRotation().z).to.be.closeTo(10, 1e-5);
    expect(target.transform.scale.x).to.equal(3);
  });

  it('重建辅助轨道不修改共享轨道树、不积累资产，且采用新的片段时长', () => {
    const binding = new ObjectBindingTrack(player.engine);
    const activation = new ActivationTrack(player.engine);
    const asset = new ActivationPlayableAsset(player.engine);
    const timeline = new TimelineAsset(player.engine);

    target.addComponent(SpriteComponent);
    const data = {
      id: activation.getInstanceId(), dataType: spec.DataType.ActivationTrack, children: [],
      clips: [{ start: 0, duration: 2, endBehavior: spec.EndBehavior.freeze, asset: { id: asset.getInstanceId() } }],
    };

    SerializationHelper.deserialize(data, activation);
    SerializationHelper.deserialize({ id: binding.getInstanceId(), dataType: spec.DataType.ObjectBindingTrack, clips: [], children: [{ id: activation.getInstanceId() }] } as spec.TrackAssetData, binding);
    timeline.setData({ id: timeline.getInstanceId(), dataType: spec.DataType.TimelineAsset, tracks: [{ id: binding.getInstanceId() }] });
    const count = Object.keys(player.engine.effectsObjectServer.objectInstance).length;

    for (const duration of [2, 3, 4]) {
      SerializationHelper.deserialize({ ...data, clips: [{ ...data.clips[0], duration }] } as spec.TrackAssetData, activation);
      timeline.setData(timeline.definition as spec.TimelineAssetData);
      const instance = new TimelineInstance(timeline, [{ key: binding, value: target }], component);
      const children = instance.masterTrackInstances[0].children;

      expect(binding.getChildTracks()).to.deep.equal([activation]);
      expect(children.length).to.equal(2);
      expect(children[1].mixer.clipPlayables[0].getDuration()).to.equal(duration);
      const generatedTrack = children[1].trackAsset;
      const generatedClipAsset = generatedTrack.getClips()[0].asset;
      const instances = player.engine.effectsObjectServer.objectInstance;

      expect(instances[generatedTrack.getInstanceId()]).to.equal(generatedTrack);
      expect(instances[generatedClipAsset.getInstanceId()]).to.equal(generatedClipAsset);
      expect(Object.keys(instances).length).to.equal(count + 2);
      instance.dispose();
      expect(instances[generatedTrack.getInstanceId()]).to.equal(undefined);
      expect(instances[generatedClipAsset.getInstanceId()]).to.equal(undefined);
      for (const sharedAsset of [binding, activation, asset, timeline]) {
        expect(instances[sharedAsset.getInstanceId()]).to.equal(sharedAsset);
      }
      expect(Object.keys(instances).length).to.equal(count);
      instance.dispose();
      expect(Object.keys(instances).length).to.equal(count);
    }
  });
});
