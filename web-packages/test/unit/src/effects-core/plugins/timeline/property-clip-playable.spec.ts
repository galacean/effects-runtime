import type { Engine, ValueGetter } from '@galacean/effects';
import {
  ColorPropertyMixerPlayable, ColorPropertyPlayableAsset, FloatPropertyPlayableAsset,
  PropertyClipPlayable, RandomValue, ReferenceCurve, SerializationHelper, Sprite, spec, TimelineClip, TrackAsset,
  Vector2PropertyMixerPlayable, Vector2PropertyPlayableAsset,
  Vector3PropertyMixerPlayable, Vector3ropertyPlayableAsset,
  Vector4PropertyMixerPlayable, Vector4PropertyPlayableAsset,
} from '@galacean/effects';
import type { Color, Vector2, Vector3, Vector4 } from '@galacean/effects-math/es/core';

const { expect } = chai;

type SampleValue = Color | Vector2 | Vector3 | Vector4;

describe('core/plugins/timeline/property-clip-playable', () => {
  const engine = {
    effectsObjectServer: {
      registerObject: () => {},
      unregisterObject: () => {},
    },
  } as unknown as Engine;
  const context = { time: 0, deltaTime: 0 };
  const cases = [
    {
      name: 'Color', Asset: ColorPropertyPlayableAsset, Mixer: ColorPropertyMixerPlayable,
      dataType: spec.DataType.ColorPropertyPlayableAsset, curveType: spec.ValueType.COLOR_CURVE, dimensions: 4,
    },
    {
      name: 'Vector2', Asset: Vector2PropertyPlayableAsset, Mixer: Vector2PropertyMixerPlayable,
      dataType: spec.DataType.Vector2PropertyPlayableAsset, curveType: spec.ValueType.VECTOR2_CURVE, dimensions: 2,
    },
    {
      name: 'Vector3', Asset: Vector3ropertyPlayableAsset, Mixer: Vector3PropertyMixerPlayable,
      dataType: spec.DataType.Vector3PropertyPlayableAsset, curveType: spec.ValueType.VECTOR3_CURVE, dimensions: 3,
    },
    {
      name: 'Vector4', Asset: Vector4PropertyPlayableAsset, Mixer: Vector4PropertyMixerPlayable,
      dataType: spec.DataType.Vector4PropertyPlayableAsset, curveType: spec.ValueType.VECTOR4_CURVE, dimensions: 4,
    },
  ];

  function sample<T> (playable: PropertyClipPlayable<T>, time: number) {
    playable.duration = 1;
    playable.evaluate({}, { time, deltaTime: 0 });
  }

  function expectComponents (value: SampleValue, offset: number) {
    value.toArray().forEach((component, index) => {
      expect(component).to.be.closeTo(index + offset, 1e-6);
    });
  }

  for (const testCase of cases) {
    const createAsset = () => {
      const asset = new testCase.Asset(engine);
      const data = {
        id: 'shared-curve',
        dataType: testCase.dataType,
        curveData: [testCase.curveType, Array.from({ length: testCase.dimensions }, (_, index) => [
          spec.ValueType.BEZIER_CURVE,
          [[spec.BezierKeyframeType.LINE, [0, index]], [spec.BezierKeyframeType.LINE, [1, index + 10]]],
        ])],
      };

      SerializationHelper.deserialize(data, asset);

      return asset;
    };

    it(`${testCase.name} keeps independent, reusable sample values for a shared curve`, () => {
      const asset = createAsset();
      const first = asset.createPlayable() as PropertyClipPlayable<SampleValue>;
      const second = asset.createPlayable() as PropertyClipPlayable<SampleValue>;
      const firstValue = first.value;
      const secondValue = second.value;

      expect(first.curve).to.equal(asset.curve);
      expect(second.curve).to.equal(asset.curve);
      expect(firstValue).not.to.equal(secondValue);

      sample(first, 0.25);
      expectComponents(first.value, 2.5);
      expectComponents(second.value, 0);

      sample(second, 0.75);
      expectComponents(first.value, 2.5);
      expectComponents(second.value, 7.5);

      asset.curve.getValue(0.9);
      const third = asset.createPlayable() as PropertyClipPlayable<SampleValue>;

      expect(third.value).not.to.equal(firstValue);
      expect(third.value).not.to.equal(secondValue);
      expectComponents(first.value, 2.5);
      expectComponents(second.value, 7.5);

      sample(first, 0.5);
      expect(first.value).to.equal(firstValue);
      expect(second.value).to.equal(secondValue);
      expectComponents(first.value, 5);
      expectComponents(second.value, 7.5);
    });

    it(`${testCase.name} mixes different sample times from a shared curve`, () => {
      const asset = createAsset();
      const track = new TrackAsset(engine);
      const mixer = new testCase.Mixer();
      const clips = [-0.25, -0.75].map(start => {
        const clip = new TimelineClip();

        clip.asset = asset;
        clip.start = start;
        clip.duration = 1;
        clip.endBehavior = spec.EndBehavior.destroy;

        return clip;
      });

      track.createTrackMixer = () => mixer;
      track.compileClips(clips);
      const segmentId = mixer.getSegments().findIndex(segment => context.time >= segment.start && context.time < segment.end);
      const first = mixer.getClipPlayable(0) as PropertyClipPlayable<SampleValue>;
      const second = mixer.getClipPlayable(1) as PropertyClipPlayable<SampleValue>;
      const target = { value: first.value.clone() };

      mixer.propertyPath = 'value';
      mixer.setClipWeight(first, 0.5);
      mixer.setClipWeight(second, 0.5);
      mixer.evaluate(segmentId, undefined, { time: 0.1, deltaTime: 0 });
      expectComponents(first.value, 3.5);
      expectComponents(second.value, 8.5);
      expectComponents(target.value, 0);
      mixer.evaluate(segmentId, target, context);

      expectComponents(target.value, 5);
      expectComponents(first.value, 2.5);
      expectComponents(second.value, 7.5);

      mixer.setClipWeight(0, 0);
      mixer.setClipWeight(1, 0);
      mixer.evaluate(segmentId, target, { time: 0.1, deltaTime: 0.1 });
      expectComponents(target.value, 5);
      expectComponents(first.value, 3.5);
      expectComponents(second.value, 8.5);

      mixer.setClipWeight(0, 0.5);
      mixer.setClipWeight(1, 0.5);
      mixer.evaluate(segmentId, undefined, { time: 0.2, deltaTime: 0.1 });
      expectComponents(first.value, 4.5);
      expectComponents(second.value, 9.5);
      expectComponents(target.value, 5);
    });

    it(`${testCase.name} writes into the supplied result and preserves getValue behavior`, () => {
      const curve = createAsset().curve as ValueGetter<SampleValue>;
      const scratch = curve.getValue(0.1);
      const result = scratch.clone();

      expect(result).not.to.equal(scratch);
      expect(curve.getValue(0.25, result)).to.equal(result);
      expectComponents(result, 2.5);
      expectComponents(scratch, 1);

      expect(curve.getValue(0.75, result)).to.equal(result);
      expectComponents(result, 7.5);
      expectComponents(scratch, 1);

      expect(curve.getValue(0.5)).to.equal(scratch);
      expectComponents(scratch, 5);
      expectComponents(result, 7.5);
    });
  }

  it('keeps scalar samples independent', () => {
    const asset = new FloatPropertyPlayableAsset(engine);

    asset.fromData({
      id: 'float-curve', dataType: spec.DataType.FloatPropertyPlayableAsset,
      curveData: [spec.ValueType.BEZIER_CURVE, [
        [spec.BezierKeyframeType.LINE, [0, 0]], [spec.BezierKeyframeType.LINE, [1, 10]],
      ]],
    });
    const first = asset.createPlayable() as PropertyClipPlayable<number>;
    const second = asset.createPlayable() as PropertyClipPlayable<number>;

    sample(first, 0.25);
    sample(second, 0.75);
    expect(first.value).to.equal(2.5);
    expect(second.value).to.equal(7.5);
  });

  it('preserves sampled object references and empty reference curves', () => {
    const firstSprite = new Sprite(engine);
    const secondSprite = new Sprite(engine);
    const curve = new ReferenceCurve<Sprite>([[0, firstSprite], [0.5, secondSprite]]);
    const first = new PropertyClipPlayable<Sprite>();
    const second = new PropertyClipPlayable<Sprite>();

    first.curve = second.curve = curve;
    first.value = curve.getValue(0);
    second.value = curve.getValue(0);
    sample(first, 0.25);
    sample(second, 0.75);
    expect(first.value).to.equal(firstSprite);
    expect(second.value).to.equal(secondSprite);

    first.curve = new ReferenceCurve<Sprite>([]);
    sample(first, 0);
    expect(first.value).to.equal(undefined);
  });

  it('does not use the previous numeric sample as a random seed', () => {
    const curve = new RandomValue([10, 20]);
    const playable = new PropertyClipPlayable<number>();
    const random = Math.random;

    playable.curve = curve;
    playable.value = 100;
    Math.random = () => 0.25;
    try {
      sample(playable, 0.5);
      expect(playable.value).to.equal(12.5);
      expect(curve.getValue(0.5, undefined, 0.75)).to.equal(17.5);
      expect(curve.getValue(0.5, 100, 0.75)).to.equal(17.5);
      expect(curve.getValue(0.5, undefined, 0)).to.equal(10);
      expect(curve.getValue(0.5, undefined, 1)).to.equal(20);
    } finally {
      Math.random = random;
    }
  });
});
