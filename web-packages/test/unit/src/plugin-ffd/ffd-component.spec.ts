import type { Engine, SpriteComponent } from '@galacean/effects';
import {
  CacheDataManager, math, spec, TrackAsset, Vector3PropertyMixerPlayable, Vector3ropertyPlayableAsset,
} from '@galacean/effects';
import { FFDComponent } from '@galacean/effects-plugin-ffd';

const { expect } = chai;
const { Vector3 } = math;

describe('plugin-ffd/ffd-component', () => {
  const engine = {
    effectsObjectServer: {
      registerObject: () => {},
      unregisterObject: () => {},
      findObject: () => undefined,
    },
    displayServer: {
      renderingDevice: { gpuCapability: { detail: { maxVertexUniforms: 256 } } },
    },
  } as unknown as Engine;

  function lattice (rows = 2, columns = 3) {
    const component = new FFDComponent(engine);
    const data: spec.FFDComponentData = {
      id: component.getInstanceId(),
      dataType: spec.DataType.FFDComponent,
      item: { id: 'sprite' },
      rowNum: rows,
      colNum: columns,
      boundMin: new Vector3(-1, -1, 0),
      boundMax: new Vector3(1, 1, 0),
      controlPoints: Array.from({ length: rows * columns }, (_, i) => new Vector3(i, i + 1, i + 2)),
    };
    const uniforms = new Map<string, math.Vector3>();

    component.fromData(data);
    component['currentSpriteComponent'] = {
      material: {
        setInt: () => {},
        setVector3: (name: string, point: math.Vector3) => uniforms.set(name, point.clone()),
      },
    } as unknown as SpriteComponent;

    return { component, data, uniforms };
  }

  it('continues animation sampling and uniform uploads after editing and canceling control points', () => {
    const { component, data, uniforms } = lattice();
    const asset = new Vector3ropertyPlayableAsset(engine);
    const curve = (offset: number): spec.Vector3CurveData[0] => [
      spec.ValueType.BEZIER_CURVE,
      [[spec.BezierKeyframeType.LINE, [0, offset]], [spec.BezierKeyframeType.LINE, [1, offset + 10]]],
    ];

    asset.fromData({
      id: asset.getInstanceId(),
      dataType: spec.DataType.Vector3PropertyPlayableAsset,
      start: 0,
      duration: 1,
      endBehavior: spec.EndBehavior.destroy,
      curveData: [spec.ValueType.VECTOR3_CURVE, [curve(0), curve(1), curve(2)]],
    });
    const mixer = new Vector3PropertyMixerPlayable();
    const track = new TrackAsset(engine);
    const cache = new CacheDataManager({ trackData: new Map(), clipData: new Map(), sharedData: new Map() });

    cache.setTrackKey(0);
    track.createTrackMixer = () => mixer;
    track.compileClips([asset]);
    mixer.propertyPath = 'controlPoints.0';
    mixer.setClipWeight(0, 1);
    const sample = (time: number) => {
      const context = { time, deltaTime: 0 };

      mixer.getClipPlayable(0).evaluate(component, context, cache);
      mixer.evaluate(0, component, context, cache);
      component.onUpdate(0);
      const expected = [time * 10, time * 10 + 1, time * 10 + 2];

      expect(component.getLattice().points[0].toArray()).deep.equals(expected);
      expect(uniforms.get('_ControlPoints[0]')?.toArray()).deep.equals(expected);
    };

    sample(0.25);
    const snapshot = component.getLattice().points;
    const edited = snapshot.map(point => point.clone().add(new Vector3(10, 20, 30)));

    component.setControlPoints(edited);
    expect(component.getLattice().points).deep.equals(edited);
    expect(data.controlPoints).deep.equals(edited);
    sample(0.5);
    component.setControlPoints(snapshot);
    expect(component.getLattice().points).deep.equals(snapshot);
    expect(data.controlPoints).deep.equals(snapshot);
    sample(0.75);
  });

  it('rejects a sparse update without changing runtime or serialized points', () => {
    const { component, data } = lattice();
    const snapshot = component.getLattice().points;
    const edited = component.getLattice().points;

    edited[0].set(100, 200, 300);
    delete edited[edited.length - 1];
    expect(() => component.setControlPoints(edited)).throws('Invalid FFD control points.');
    expect(component.getLattice().points).deep.equals(snapshot);
    expect(data.controlPoints).deep.equals(snapshot);
  });

  it('disables editing for fractional dimensions and non-finite coordinates', () => {
    const fractional = lattice(2.5, 2).component;
    const { component, data } = lattice();

    expect(component.getLattice().enabled).equals(true);
    expect(fractional.getLattice().enabled).equals(false);
    expect(() => fractional.setControlPoints(fractional.getLattice().points)).throws('Invalid FFD control points.');
    data.controlPoints[0].x = Infinity;
    component.fromData(data);
    expect(component.getLattice().enabled).equals(false);
    expect(() => component.setControlPoints(component.getLattice().points)).throws('Invalid FFD control points.');
  });
});
