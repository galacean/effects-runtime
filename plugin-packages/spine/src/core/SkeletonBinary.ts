import type { Timeline, CurveTimeline1, CurveTimeline2, CurveTimeline } from './Animation';
import { Animation, AttachmentTimeline, RGBATimeline, RGBTimeline, RGBA2Timeline, RGB2Timeline, AlphaTimeline, RotateTimeline, TranslateTimeline, TranslateXTimeline, TranslateYTimeline, ScaleTimeline, ScaleXTimeline, ScaleYTimeline, ShearTimeline, ShearXTimeline, ShearYTimeline, IkConstraintTimeline, TransformConstraintTimeline, PathConstraintPositionTimeline, PathConstraintSpacingTimeline, PathConstraintMixTimeline, DeformTimeline, DrawOrderTimeline, EventTimeline, SequenceTimeline } from './Animation';
import type { VertexAttachment, Attachment } from './attachments';
import type { AttachmentLoader } from './attachments';
import type { HasTextureRegion } from './attachments/HasTextureRegion';
import type { MeshAttachment } from './attachments';
import { Sequence, SequenceModeValues } from './attachments/Sequence';
import { BoneData } from './BoneData';
import { Event } from './Event';
import { EventData } from './EventData';
import { IkConstraintData } from './IkConstraintData';
import { PathConstraintData, PositionMode, SpacingMode } from './PathConstraintData';
import { SkeletonData } from './SkeletonData';
import { Skin } from './Skin';
import { SlotData } from './SlotData';
import { TransformConstraintData } from './TransformConstraintData';
import { Color, ArrayUtils } from '../utils';

/** Loads skeleton data in the Spine binary format.
 *
 * See [Spine binary format](http://esotericsoftware.com/spine-binary-format) and
 * [JSON and binary data](http://esotericsoftware.com/spine-loading-skeleton-data#JSON-and-binary-data) in the Spine
 * Runtimes Guide. */
export class SkeletonBinary {
  /** Scales bone positions, image sizes, and translations as they are loaded. This allows different size images to be used at
	 * runtime than were used in Spine.
	 *
	 * See [Scaling](http://esotericsoftware.com/spine-loading-skeleton-data#Scaling) in the Spine Runtimes Guide. */
  scale = 1;

  attachmentLoader: AttachmentLoader;
  private linkedMeshes = new Array<LinkedMesh>();

  constructor (attachmentLoader: AttachmentLoader) {
    this.attachmentLoader = attachmentLoader;
  }

  readSkeletonData (binary: DataView): SkeletonData {
    const scale = this.scale;

    const skeletonData = new SkeletonData();

    skeletonData.name = ''; // BOZO
    const input = new BinaryInput(binary);
    const lowHash = input.readInt32();
    const highHash = input.readInt32();

    skeletonData.hash = highHash == 0 && lowHash == 0 ? null : highHash.toString(16) + lowHash.toString(16);
    skeletonData.version = input.readString();
    skeletonData.x = input.readFloat();
    skeletonData.y = input.readFloat();
    skeletonData.width = input.readFloat();
    skeletonData.height = input.readFloat();

    const nonessential = input.readBoolean();

    if (nonessential) {
      skeletonData.fps = input.readFloat();

      skeletonData.imagesPath = input.readString();
      skeletonData.audioPath = input.readString();
    }

    let n = 0;

    // Strings.
    n = input.readInt(true);
    for (let i = 0; i < n; i++) {
      const str = input.readString();

      if (!str) {throw new Error('String in string table must not be null.');}
      input.strings.push(str);
    }

    // Bones.
    n = input.readInt(true);
    for (let i = 0; i < n; i++) {
      const name = input.readString();

      if (!name) {throw new Error('Bone name must not be null.');}
      const parent = i == 0 ? null : skeletonData.bones[input.readInt(true)];
      const data = new BoneData(i, name, parent);

      data.rotation = input.readFloat();
      data.x = input.readFloat() * scale;
      data.y = input.readFloat() * scale;
      data.scaleX = input.readFloat();
      data.scaleY = input.readFloat();
      data.shearX = input.readFloat();
      data.shearY = input.readFloat();
      data.length = input.readFloat() * scale;
      data.transformMode = input.readInt(true);
      data.skinRequired = input.readBoolean();
      if (nonessential) {Color.rgba8888ToColor(data.color, input.readInt32());}
      skeletonData.bones.push(data);
    }

    // Slots.
    n = input.readInt(true);
    for (let i = 0; i < n; i++) {
      const slotName = input.readString();

      if (!slotName) {throw new Error('Slot name must not be null.');}
      const boneData = skeletonData.bones[input.readInt(true)];
      const data = new SlotData(i, slotName, boneData);

      Color.rgba8888ToColor(data.color, input.readInt32());

      const darkColor = input.readInt32();

      if (darkColor != -1) {Color.rgb888ToColor(data.darkColor = new Color(), darkColor);}

      data.attachmentName = input.readStringRef();
      data.blendMode = input.readInt(true);
      skeletonData.slots.push(data);
    }

    // IK constraints.
    n = input.readInt(true);
    for (let i = 0, nn; i < n; i++) {
      const name = input.readString();

      if (!name) {throw new Error('IK constraint data name must not be null.');}
      const data = new IkConstraintData(name);

      data.order = input.readInt(true);
      data.skinRequired = input.readBoolean();
      nn = input.readInt(true);
      for (let ii = 0; ii < nn; ii++) {data.bones.push(skeletonData.bones[input.readInt(true)]);}
      data.target = skeletonData.bones[input.readInt(true)];
      data.mix = input.readFloat();
      data.softness = input.readFloat() * scale;
      data.bendDirection = input.readByte();
      data.compress = input.readBoolean();
      data.stretch = input.readBoolean();
      data.uniform = input.readBoolean();
      skeletonData.ikConstraints.push(data);
    }

    // Transform constraints.
    n = input.readInt(true);
    for (let i = 0, nn; i < n; i++) {
      const name = input.readString();

      if (!name) {throw new Error('Transform constraint data name must not be null.');}
      const data = new TransformConstraintData(name);

      data.order = input.readInt(true);
      data.skinRequired = input.readBoolean();
      nn = input.readInt(true);
      for (let ii = 0; ii < nn; ii++) {data.bones.push(skeletonData.bones[input.readInt(true)]);}
      data.target = skeletonData.bones[input.readInt(true)];
      data.local = input.readBoolean();
      data.relative = input.readBoolean();
      data.offsetRotation = input.readFloat();
      data.offsetX = input.readFloat() * scale;
      data.offsetY = input.readFloat() * scale;
      data.offsetScaleX = input.readFloat();
      data.offsetScaleY = input.readFloat();
      data.offsetShearY = input.readFloat();
      data.mixRotate = input.readFloat();
      data.mixX = input.readFloat();
      data.mixY = input.readFloat();
      data.mixScaleX = input.readFloat();
      data.mixScaleY = input.readFloat();
      data.mixShearY = input.readFloat();
      skeletonData.transformConstraints.push(data);
    }

    // Path constraints.
    n = input.readInt(true);
    for (let i = 0, nn; i < n; i++) {
      const name = input.readString();

      if (!name) {throw new Error('Path constraint data name must not be null.');}
      const data = new PathConstraintData(name);

      data.order = input.readInt(true);
      data.skinRequired = input.readBoolean();
      nn = input.readInt(true);
      for (let ii = 0; ii < nn; ii++) {data.bones.push(skeletonData.bones[input.readInt(true)]);}
      data.target = skeletonData.slots[input.readInt(true)];
      data.positionMode = input.readInt(true);
      data.spacingMode = input.readInt(true);
      data.rotateMode = input.readInt(true);
      data.offsetRotation = input.readFloat();
      data.position = input.readFloat();
      if (data.positionMode == PositionMode.Fixed) {data.position *= scale;}
      data.spacing = input.readFloat();
      if (data.spacingMode == SpacingMode.Length || data.spacingMode == SpacingMode.Fixed) {data.spacing *= scale;}
      data.mixRotate = input.readFloat();
      data.mixX = input.readFloat();
      data.mixY = input.readFloat();
      skeletonData.pathConstraints.push(data);
    }

    // Default skin.
    const defaultSkin = this.readSkin(input, skeletonData, true, nonessential);

    if (defaultSkin) {
      skeletonData.defaultSkin = defaultSkin;
      skeletonData.skins.push(defaultSkin);
    }

    // Skins.
    {
      let i = skeletonData.skins.length;

      ArrayUtils.setArraySize(skeletonData.skins, n = i + input.readInt(true));
      for (; i < n; i++) {
        const skin = this.readSkin(input, skeletonData, false, nonessential);

        if (!skin) {throw new Error('readSkin() should not have returned null.');}
        skeletonData.skins[i] = skin;
      }
    }

    // Linked meshes.
    n = this.linkedMeshes.length;
    for (let i = 0; i < n; i++) {
      const linkedMesh = this.linkedMeshes[i];
      const skin = !linkedMesh.skin ? skeletonData.defaultSkin : skeletonData.findSkin(linkedMesh.skin);

      if (!skin) {throw new Error('Not skin found for linked mesh.');}
      if (!linkedMesh.parent) {throw new Error('Linked mesh parent must not be null');}
      const parent = skin.getAttachment(linkedMesh.slotIndex, linkedMesh.parent);

      if (!parent) {throw new Error(`Parent mesh not found: ${linkedMesh.parent}`);}
      linkedMesh.mesh.timelineAttachment = linkedMesh.inheritTimeline ? parent as VertexAttachment : linkedMesh.mesh;
      linkedMesh.mesh.setParentMesh(parent as MeshAttachment);
      if (linkedMesh.mesh.region != null) {linkedMesh.mesh.updateRegion();}
    }
    this.linkedMeshes.length = 0;

    // Events.
    n = input.readInt(true);
    for (let i = 0; i < n; i++) {
      const eventName = input.readStringRef();

      if (!eventName) {throw new Error();}
      const data = new EventData(eventName);

      data.intValue = input.readInt(false);
      data.floatValue = input.readFloat();
      data.stringValue = input.readString();
      data.audioPath = input.readString();
      if (data.audioPath) {
        data.volume = input.readFloat();
        data.balance = input.readFloat();
      }
      skeletonData.events.push(data);
    }

    // Animations.
    n = input.readInt(true);
    for (let i = 0; i < n; i++) {
      const animationName = input.readString();

      if (!animationName) {throw new Error('Animatio name must not be null.');}
      skeletonData.animations.push(this.readAnimation(input, animationName, skeletonData));
    }

    return skeletonData;
  }

  private readSkin (input: BinaryInput, skeletonData: SkeletonData, defaultSkin: boolean, nonessential: boolean): Skin | null {
    let skin = null;
    let slotCount = 0;

    if (defaultSkin) {
      slotCount = input.readInt(true);
      if (slotCount == 0) {return null;}
      skin = new Skin('default');
    } else {
      const skinName = input.readStringRef();

      if (!skinName) {throw new Error('Skin name must not be null.');}
      skin = new Skin(skinName);
      skin.bones.length = input.readInt(true);
      for (let i = 0, n = skin.bones.length; i < n; i++) {skin.bones[i] = skeletonData.bones[input.readInt(true)];}

      for (let i = 0, n = input.readInt(true); i < n; i++) {skin.constraints.push(skeletonData.ikConstraints[input.readInt(true)]);}
      for (let i = 0, n = input.readInt(true); i < n; i++) {skin.constraints.push(skeletonData.transformConstraints[input.readInt(true)]);}
      for (let i = 0, n = input.readInt(true); i < n; i++) {skin.constraints.push(skeletonData.pathConstraints[input.readInt(true)]);}

      slotCount = input.readInt(true);
    }

    for (let i = 0; i < slotCount; i++) {
      const slotIndex = input.readInt(true);

      for (let ii = 0, nn = input.readInt(true); ii < nn; ii++) {
        const name = input.readStringRef();

        if (!name) {throw new Error('Attachment name must not be null');}
        const attachment = this.readAttachment(input, skeletonData, skin, slotIndex, name, nonessential);

        if (attachment) {skin.setAttachment(slotIndex, name, attachment);}
      }
    }

    return skin;
  }

  private readAttachment (input: BinaryInput, skeletonData: SkeletonData, skin: Skin, slotIndex: number, attachmentName: string, nonessential: boolean): Attachment | null {
    const scale = this.scale;

    let name = input.readStringRef();

    if (!name) {name = attachmentName;}

    switch (input.readByte()) {
      case AttachmentType.Region: {
        let path = input.readStringRef();
        const rotation = input.readFloat();
        const x = input.readFloat();
        const y = input.readFloat();
        const scaleX = input.readFloat();
        const scaleY = input.readFloat();
        const width = input.readFloat();
        const height = input.readFloat();
        const color = input.readInt32();
        const sequence = this.readSequence(input);

        if (!path) {path = name;}
        const region = this.attachmentLoader.newRegionAttachment(skin, name, path, sequence);

        if (!region) {return null;}
        region.path = path;
        region.x = x * scale;
        region.y = y * scale;
        region.scaleX = scaleX;
        region.scaleY = scaleY;
        region.rotation = rotation;
        region.width = width * scale;
        region.height = height * scale;
        Color.rgba8888ToColor(region.color, color);
        region.sequence = sequence;
        if (sequence == null) {region.updateRegion();}

        return region;
      }
      case AttachmentType.BoundingBox: {
        const vertexCount = input.readInt(true);
        const vertices = this.readVertices(input, vertexCount);
        const color = nonessential ? input.readInt32() : 0;

        const box = this.attachmentLoader.newBoundingBoxAttachment(skin, name);

        if (!box) {return null;}
        box.worldVerticesLength = vertexCount << 1;
        box.vertices = vertices.vertices!;
        box.bones = vertices.bones;
        if (nonessential) {Color.rgba8888ToColor(box.color, color);}

        return box;
      }
      case AttachmentType.Mesh: {
        let path = input.readStringRef();
        const color = input.readInt32();
        const vertexCount = input.readInt(true);
        const uvs = this.readFloatArray(input, vertexCount << 1, 1);
        const triangles = this.readShortArray(input);
        const vertices = this.readVertices(input, vertexCount);
        const hullLength = input.readInt(true);
        const sequence = this.readSequence(input);
        let edges: number[] = [];
        let width = 0, height = 0;

        if (nonessential) {
          edges = this.readShortArray(input);
          width = input.readFloat();
          height = input.readFloat();
        }

        if (!path) {path = name;}
        const mesh = this.attachmentLoader.newMeshAttachment(skin, name, path, sequence);

        if (!mesh) {return null;}
        mesh.path = path;
        Color.rgba8888ToColor(mesh.color, color);
        mesh.bones = vertices.bones;
        mesh.vertices = vertices.vertices!;
        mesh.worldVerticesLength = vertexCount << 1;
        mesh.triangles = triangles;
        mesh.regionUVs = uvs;
        if (sequence == null) {mesh.updateRegion();}
        mesh.hullLength = hullLength << 1;
        mesh.sequence = sequence;
        if (nonessential) {
          mesh.edges = edges;
          mesh.width = width * scale;
          mesh.height = height * scale;
        }

        return mesh;
      }
      case AttachmentType.LinkedMesh: {
        let path = input.readStringRef();
        const color = input.readInt32();
        const skinName = input.readStringRef();
        const parent = input.readStringRef();
        const inheritTimelines = input.readBoolean();
        const sequence = this.readSequence(input);
        let width = 0, height = 0;

        if (nonessential) {
          width = input.readFloat();
          height = input.readFloat();
        }

        if (!path) {path = name;}
        const mesh = this.attachmentLoader.newMeshAttachment(skin, name, path, sequence);

        if (!mesh) {return null;}
        mesh.path = path;
        Color.rgba8888ToColor(mesh.color, color);
        mesh.sequence = sequence;
        if (nonessential) {
          mesh.width = width * scale;
          mesh.height = height * scale;
        }
        this.linkedMeshes.push(new LinkedMesh(mesh, skinName, slotIndex, parent, inheritTimelines));

        return mesh;
      }
      case AttachmentType.Path: {
        const closed = input.readBoolean();
        const constantSpeed = input.readBoolean();
        const vertexCount = input.readInt(true);
        const vertices = this.readVertices(input, vertexCount);
        const lengths = ArrayUtils.newArray(vertexCount / 3, 0);

        for (let i = 0, n = lengths.length; i < n; i++) {lengths[i] = input.readFloat() * scale;}
        const color = nonessential ? input.readInt32() : 0;

        const path = this.attachmentLoader.newPathAttachment(skin, name);

        if (!path) {return null;}
        path.closed = closed;
        path.constantSpeed = constantSpeed;
        path.worldVerticesLength = vertexCount << 1;
        path.vertices = vertices.vertices!;
        path.bones = vertices.bones;
        path.lengths = lengths;
        if (nonessential) {Color.rgba8888ToColor(path.color, color);}

        return path;
      }
      case AttachmentType.Point: {
        const rotation = input.readFloat();
        const x = input.readFloat();
        const y = input.readFloat();
        const color = nonessential ? input.readInt32() : 0;

        const point = this.attachmentLoader.newPointAttachment(skin, name);

        if (!point) {return null;}
        point.x = x * scale;
        point.y = y * scale;
        point.rotation = rotation;
        if (nonessential) {Color.rgba8888ToColor(point.color, color);}

        return point;
      }
      case AttachmentType.Clipping: {
        const endSlotIndex = input.readInt(true);
        const vertexCount = input.readInt(true);
        const vertices = this.readVertices(input, vertexCount);
        const color = nonessential ? input.readInt32() : 0;

        const clip = this.attachmentLoader.newClippingAttachment(skin, name);

        if (!clip) {return null;}
        clip.endSlot = skeletonData.slots[endSlotIndex];
        clip.worldVerticesLength = vertexCount << 1;
        clip.vertices = vertices.vertices!;
        clip.bones = vertices.bones;
        if (nonessential) {Color.rgba8888ToColor(clip.color, color);}

        return clip;
      }
    }

    return null;
  }

  private readSequence (input: BinaryInput) {
    if (!input.readBoolean()) {return null;}
    const sequence = new Sequence(input.readInt(true));

    sequence.start = input.readInt(true);
    sequence.digits = input.readInt(true);
    sequence.setupIndex = input.readInt(true);

    return sequence;
  }

  private readVertices (input: BinaryInput, vertexCount: number): Vertices {
    const scale = this.scale;
    const verticesLength = vertexCount << 1;
    const vertices = new Vertices();

    if (!input.readBoolean()) {
      vertices.vertices = this.readFloatArray(input, verticesLength, scale);

      return vertices;
    }
    const weights = new Array<number>();
    const bonesArray = new Array<number>();

    for (let i = 0; i < vertexCount; i++) {
      const boneCount = input.readInt(true);

      bonesArray.push(boneCount);
      for (let ii = 0; ii < boneCount; ii++) {
        bonesArray.push(input.readInt(true));
        weights.push(input.readFloat() * scale);
        weights.push(input.readFloat() * scale);
        weights.push(input.readFloat());
      }
    }
    vertices.vertices = ArrayUtils.toFloatArray(weights);
    vertices.bones = bonesArray;

    return vertices;
  }

  private readFloatArray (input: BinaryInput, n: number, scale: number): number[] {
    const array = new Array<number>(n);

    if (scale == 1) {
      for (let i = 0; i < n; i++) {array[i] = input.readFloat();}
    } else {
      for (let i = 0; i < n; i++) {array[i] = input.readFloat() * scale;}
    }

    return array;
  }

  private readShortArray (input: BinaryInput): number[] {
    const n = input.readInt(true);
    const array = new Array<number>(n);

    for (let i = 0; i < n; i++) {array[i] = input.readShort();}

    return array;
  }

  private readAnimation (input: BinaryInput, name: string, skeletonData: SkeletonData): Animation {
    input.readInt(true); // Number of timelines.
    const timelines = new Array<Timeline>();
    const scale = this.scale;
    const tempColor1 = new Color();
    const tempColor2 = new Color();

    // Slot timelines.
    for (let i = 0, n = input.readInt(true); i < n; i++) {
      const slotIndex = input.readInt(true);

      for (let ii = 0, nn = input.readInt(true); ii < nn; ii++) {
        const timelineType = input.readByte();
        const frameCount = input.readInt(true);
        const frameLast = frameCount - 1;

        switch (timelineType) {
          case SLOT_ATTACHMENT: {
            const timeline = new AttachmentTimeline(frameCount, slotIndex);

            for (let frame = 0; frame < frameCount; frame++) {timeline.setFrame(frame, input.readFloat(), input.readStringRef());}
            timelines.push(timeline);

            break;
          }
          case SLOT_RGBA: {
            const bezierCount = input.readInt(true);
            const timeline = new RGBATimeline(frameCount, bezierCount, slotIndex);

            let time = input.readFloat();
            let r = input.readUnsignedByte() / 255.0;
            let g = input.readUnsignedByte() / 255.0;
            let b = input.readUnsignedByte() / 255.0;
            let a = input.readUnsignedByte() / 255.0;

            for (let frame = 0, bezier = 0; ; frame++) {
              timeline.setFrame(frame, time, r, g, b, a);
              if (frame == frameLast) {break;}

              const time2 = input.readFloat();
              const r2 = input.readUnsignedByte() / 255.0;
              const g2 = input.readUnsignedByte() / 255.0;
              const b2 = input.readUnsignedByte() / 255.0;
              const a2 = input.readUnsignedByte() / 255.0;

              switch (input.readByte()) {
                case CURVE_STEPPED:
                  timeline.setStepped(frame);

                  break;
                case CURVE_BEZIER:
                  setBezier(input, timeline, bezier++, frame, 0, time, time2, r, r2, 1);
                  setBezier(input, timeline, bezier++, frame, 1, time, time2, g, g2, 1);
                  setBezier(input, timeline, bezier++, frame, 2, time, time2, b, b2, 1);
                  setBezier(input, timeline, bezier++, frame, 3, time, time2, a, a2, 1);
              }
              time = time2;
              r = r2;
              g = g2;
              b = b2;
              a = a2;
            }
            timelines.push(timeline);

            break;
          }
          case SLOT_RGB: {
            const bezierCount = input.readInt(true);
            const timeline = new RGBTimeline(frameCount, bezierCount, slotIndex);

            let time = input.readFloat();
            let r = input.readUnsignedByte() / 255.0;
            let g = input.readUnsignedByte() / 255.0;
            let b = input.readUnsignedByte() / 255.0;

            for (let frame = 0, bezier = 0; ; frame++) {
              timeline.setFrame(frame, time, r, g, b);
              if (frame == frameLast) {break;}

              const time2 = input.readFloat();
              const r2 = input.readUnsignedByte() / 255.0;
              const g2 = input.readUnsignedByte() / 255.0;
              const b2 = input.readUnsignedByte() / 255.0;

              switch (input.readByte()) {
                case CURVE_STEPPED:
                  timeline.setStepped(frame);

                  break;
                case CURVE_BEZIER:
                  setBezier(input, timeline, bezier++, frame, 0, time, time2, r, r2, 1);
                  setBezier(input, timeline, bezier++, frame, 1, time, time2, g, g2, 1);
                  setBezier(input, timeline, bezier++, frame, 2, time, time2, b, b2, 1);
              }
              time = time2;
              r = r2;
              g = g2;
              b = b2;
            }
            timelines.push(timeline);

            break;
          }
          case SLOT_RGBA2: {
            const bezierCount = input.readInt(true);
            const timeline = new RGBA2Timeline(frameCount, bezierCount, slotIndex);

            let time = input.readFloat();
            let r = input.readUnsignedByte() / 255.0;
            let g = input.readUnsignedByte() / 255.0;
            let b = input.readUnsignedByte() / 255.0;
            let a = input.readUnsignedByte() / 255.0;
            let r2 = input.readUnsignedByte() / 255.0;
            let g2 = input.readUnsignedByte() / 255.0;
            let b2 = input.readUnsignedByte() / 255.0;

            for (let frame = 0, bezier = 0; ; frame++) {
              timeline.setFrame(frame, time, r, g, b, a, r2, g2, b2);
              if (frame == frameLast) {break;}
              const time2 = input.readFloat();
              const nr = input.readUnsignedByte() / 255.0;
              const ng = input.readUnsignedByte() / 255.0;
              const nb = input.readUnsignedByte() / 255.0;
              const na = input.readUnsignedByte() / 255.0;
              const nr2 = input.readUnsignedByte() / 255.0;
              const ng2 = input.readUnsignedByte() / 255.0;
              const nb2 = input.readUnsignedByte() / 255.0;

              switch (input.readByte()) {
                case CURVE_STEPPED:
                  timeline.setStepped(frame);

                  break;
                case CURVE_BEZIER:
                  setBezier(input, timeline, bezier++, frame, 0, time, time2, r, nr, 1);
                  setBezier(input, timeline, bezier++, frame, 1, time, time2, g, ng, 1);
                  setBezier(input, timeline, bezier++, frame, 2, time, time2, b, nb, 1);
                  setBezier(input, timeline, bezier++, frame, 3, time, time2, a, na, 1);
                  setBezier(input, timeline, bezier++, frame, 4, time, time2, r2, nr2, 1);
                  setBezier(input, timeline, bezier++, frame, 5, time, time2, g2, ng2, 1);
                  setBezier(input, timeline, bezier++, frame, 6, time, time2, b2, nb2, 1);
              }
              time = time2;
              r = nr;
              g = ng;
              b = nb;
              a = na;
              r2 = nr2;
              g2 = ng2;
              b2 = nb2;
            }
            timelines.push(timeline);

            break;
          }
          case SLOT_RGB2: {
            const bezierCount = input.readInt(true);
            const timeline = new RGB2Timeline(frameCount, bezierCount, slotIndex);

            let time = input.readFloat();
            let r = input.readUnsignedByte() / 255.0;
            let g = input.readUnsignedByte() / 255.0;
            let b = input.readUnsignedByte() / 255.0;
            let r2 = input.readUnsignedByte() / 255.0;
            let g2 = input.readUnsignedByte() / 255.0;
            let b2 = input.readUnsignedByte() / 255.0;

            for (let frame = 0, bezier = 0; ; frame++) {
              timeline.setFrame(frame, time, r, g, b, r2, g2, b2);
              if (frame == frameLast) {break;}
              const time2 = input.readFloat();
              const nr = input.readUnsignedByte() / 255.0;
              const ng = input.readUnsignedByte() / 255.0;
              const nb = input.readUnsignedByte() / 255.0;
              const nr2 = input.readUnsignedByte() / 255.0;
              const ng2 = input.readUnsignedByte() / 255.0;
              const nb2 = input.readUnsignedByte() / 255.0;

              switch (input.readByte()) {
                case CURVE_STEPPED:
                  timeline.setStepped(frame);

                  break;
                case CURVE_BEZIER:
                  setBezier(input, timeline, bezier++, frame, 0, time, time2, r, nr, 1);
                  setBezier(input, timeline, bezier++, frame, 1, time, time2, g, ng, 1);
                  setBezier(input, timeline, bezier++, frame, 2, time, time2, b, nb, 1);
                  setBezier(input, timeline, bezier++, frame, 3, time, time2, r2, nr2, 1);
                  setBezier(input, timeline, bezier++, frame, 4, time, time2, g2, ng2, 1);
                  setBezier(input, timeline, bezier++, frame, 5, time, time2, b2, nb2, 1);
              }
              time = time2;
              r = nr;
              g = ng;
              b = nb;
              r2 = nr2;
              g2 = ng2;
              b2 = nb2;
            }
            timelines.push(timeline);

            break;
          }
          case SLOT_ALPHA: {
            const timeline = new AlphaTimeline(frameCount, input.readInt(true), slotIndex);
            let time = input.readFloat(), a = input.readUnsignedByte() / 255;

            for (let frame = 0, bezier = 0; ; frame++) {
              timeline.setFrame(frame, time, a);
              if (frame == frameLast) {break;}
              const time2 = input.readFloat();
              const a2 = input.readUnsignedByte() / 255;

              switch (input.readByte()) {
                case CURVE_STEPPED:
                  timeline.setStepped(frame);

                  break;
                case CURVE_BEZIER:
                  setBezier(input, timeline, bezier++, frame, 0, time, time2, a, a2, 1);
              }
              time = time2;
              a = a2;
            }
            timelines.push(timeline);
          }
        }
      }
    }

    // Bone timelines.
    for (let i = 0, n = input.readInt(true); i < n; i++) {
      const boneIndex = input.readInt(true);

      for (let ii = 0, nn = input.readInt(true); ii < nn; ii++) {
        const type = input.readByte(), frameCount = input.readInt(true), bezierCount = input.readInt(true);

        switch (type) {
          case BONE_ROTATE:
            timelines.push(readTimeline1(input, new RotateTimeline(frameCount, bezierCount, boneIndex), 1));

            break;
          case BONE_TRANSLATE:
            timelines.push(readTimeline2(input, new TranslateTimeline(frameCount, bezierCount, boneIndex), scale));

            break;
          case BONE_TRANSLATEX:
            timelines.push(readTimeline1(input, new TranslateXTimeline(frameCount, bezierCount, boneIndex), scale));

            break;
          case BONE_TRANSLATEY:
            timelines.push(readTimeline1(input, new TranslateYTimeline(frameCount, bezierCount, boneIndex), scale));

            break;
          case BONE_SCALE:
            timelines.push(readTimeline2(input, new ScaleTimeline(frameCount, bezierCount, boneIndex), 1));

            break;
          case BONE_SCALEX:
            timelines.push(readTimeline1(input, new ScaleXTimeline(frameCount, bezierCount, boneIndex), 1));

            break;
          case BONE_SCALEY:
            timelines.push(readTimeline1(input, new ScaleYTimeline(frameCount, bezierCount, boneIndex), 1));

            break;
          case BONE_SHEAR:
            timelines.push(readTimeline2(input, new ShearTimeline(frameCount, bezierCount, boneIndex), 1));

            break;
          case BONE_SHEARX:
            timelines.push(readTimeline1(input, new ShearXTimeline(frameCount, bezierCount, boneIndex), 1));

            break;
          case BONE_SHEARY:
            timelines.push(readTimeline1(input, new ShearYTimeline(frameCount, bezierCount, boneIndex), 1));
        }
      }
    }

    // IK constraint timelines.
    for (let i = 0, n = input.readInt(true); i < n; i++) {
      const index = input.readInt(true), frameCount = input.readInt(true), frameLast = frameCount - 1;
      const timeline = new IkConstraintTimeline(frameCount, input.readInt(true), index);
      let time = input.readFloat(), mix = input.readFloat(), softness = input.readFloat() * scale;

      for (let frame = 0, bezier = 0; ; frame++) {
        timeline.setFrame(frame, time, mix, softness, input.readByte(), input.readBoolean(), input.readBoolean());
        if (frame == frameLast) {break;}
        const time2 = input.readFloat(), mix2 = input.readFloat(), softness2 = input.readFloat() * scale;

        switch (input.readByte()) {
          case CURVE_STEPPED:
            timeline.setStepped(frame);

            break;
          case CURVE_BEZIER:
            setBezier(input, timeline, bezier++, frame, 0, time, time2, mix, mix2, 1);
            setBezier(input, timeline, bezier++, frame, 1, time, time2, softness, softness2, scale);
        }
        time = time2;
        mix = mix2;
        softness = softness2;
      }
      timelines.push(timeline);
    }

    // Transform constraint timelines.
    for (let i = 0, n = input.readInt(true); i < n; i++) {
      const index = input.readInt(true), frameCount = input.readInt(true), frameLast = frameCount - 1;
      const timeline = new TransformConstraintTimeline(frameCount, input.readInt(true), index);
      let time = input.readFloat(), mixRotate = input.readFloat(), mixX = input.readFloat(), mixY = input.readFloat(),
        mixScaleX = input.readFloat(), mixScaleY = input.readFloat(), mixShearY = input.readFloat();

      for (let frame = 0, bezier = 0; ; frame++) {
        timeline.setFrame(frame, time, mixRotate, mixX, mixY, mixScaleX, mixScaleY, mixShearY);
        if (frame == frameLast) {break;}
        const time2 = input.readFloat(), mixRotate2 = input.readFloat(), mixX2 = input.readFloat(), mixY2 = input.readFloat(),
          mixScaleX2 = input.readFloat(), mixScaleY2 = input.readFloat(), mixShearY2 = input.readFloat();

        switch (input.readByte()) {
          case CURVE_STEPPED:
            timeline.setStepped(frame);

            break;
          case CURVE_BEZIER:
            setBezier(input, timeline, bezier++, frame, 0, time, time2, mixRotate, mixRotate2, 1);
            setBezier(input, timeline, bezier++, frame, 1, time, time2, mixX, mixX2, 1);
            setBezier(input, timeline, bezier++, frame, 2, time, time2, mixY, mixY2, 1);
            setBezier(input, timeline, bezier++, frame, 3, time, time2, mixScaleX, mixScaleX2, 1);
            setBezier(input, timeline, bezier++, frame, 4, time, time2, mixScaleY, mixScaleY2, 1);
            setBezier(input, timeline, bezier++, frame, 5, time, time2, mixShearY, mixShearY2, 1);
        }
        time = time2;
        mixRotate = mixRotate2;
        mixX = mixX2;
        mixY = mixY2;
        mixScaleX = mixScaleX2;
        mixScaleY = mixScaleY2;
        mixShearY = mixShearY2;
      }
      timelines.push(timeline);
    }

    // Path constraint timelines.
    for (let i = 0, n = input.readInt(true); i < n; i++) {
      const index = input.readInt(true);
      const data = skeletonData.pathConstraints[index];

      for (let ii = 0, nn = input.readInt(true); ii < nn; ii++) {
        switch (input.readByte()) {
          case PATH_POSITION:
            timelines
              .push(readTimeline1(input, new PathConstraintPositionTimeline(input.readInt(true), input.readInt(true), index),
                data.positionMode == PositionMode.Fixed ? scale : 1));

            break;
          case PATH_SPACING:
            timelines
              .push(readTimeline1(input, new PathConstraintSpacingTimeline(input.readInt(true), input.readInt(true), index),
                data.spacingMode == SpacingMode.Length || data.spacingMode == SpacingMode.Fixed ? scale : 1));

            break;
          case PATH_MIX: {
            const timeline = new PathConstraintMixTimeline(input.readInt(true), input.readInt(true), index);
            let time = input.readFloat(), mixRotate = input.readFloat(), mixX = input.readFloat(), mixY = input.readFloat();

            for (let frame = 0, bezier = 0, frameLast = timeline.getFrameCount() - 1; ; frame++) {
              timeline.setFrame(frame, time, mixRotate, mixX, mixY);
              if (frame == frameLast) {break;}
              const time2 = input.readFloat(), mixRotate2 = input.readFloat(), mixX2 = input.readFloat(),
                mixY2 = input.readFloat();

              switch (input.readByte()) {
                case CURVE_STEPPED:
                  timeline.setStepped(frame);

                  break;
                case CURVE_BEZIER:
                  setBezier(input, timeline, bezier++, frame, 0, time, time2, mixRotate, mixRotate2, 1);
                  setBezier(input, timeline, bezier++, frame, 1, time, time2, mixX, mixX2, 1);
                  setBezier(input, timeline, bezier++, frame, 2, time, time2, mixY, mixY2, 1);
              }
              time = time2;
              mixRotate = mixRotate2;
              mixX = mixX2;
              mixY = mixY2;
            }
            timelines.push(timeline);
          }
        }
      }
    }

    // Deform timelines.
    for (let i = 0, n = input.readInt(true); i < n; i++) {
      const skin = skeletonData.skins[input.readInt(true)];

      for (let ii = 0, nn = input.readInt(true); ii < nn; ii++) {
        const slotIndex = input.readInt(true);

        for (let iii = 0, nnn = input.readInt(true); iii < nnn; iii++) {
          const attachmentName = input.readStringRef();

          if (!attachmentName) {throw new Error('attachmentName must not be null.');}
          const attachment = skin.getAttachment(slotIndex, attachmentName);
          const timelineType = input.readByte();
          const frameCount = input.readInt(true);
          const frameLast = frameCount - 1;

          switch (timelineType) {
            case ATTACHMENT_DEFORM: {
              const vertexAttachment = attachment as VertexAttachment;
              const weighted = vertexAttachment.bones;
              const vertices = vertexAttachment.vertices;
              const deformLength = weighted ? vertices.length / 3 * 2 : vertices.length;

              const bezierCount = input.readInt(true);
              const timeline = new DeformTimeline(frameCount, bezierCount, slotIndex, vertexAttachment);

              let time = input.readFloat();

              for (let frame = 0, bezier = 0; ; frame++) {
                let deform;
                let end = input.readInt(true);

                if (end == 0) {deform = weighted ? ArrayUtils.newFloatArray(deformLength) : vertices;} else {
                  deform = ArrayUtils.newFloatArray(deformLength);
                  const start = input.readInt(true);

                  end += start;
                  if (scale == 1) {
                    for (let v = start; v < end; v++) {deform[v] = input.readFloat();}
                  } else {
                    for (let v = start; v < end; v++) {deform[v] = input.readFloat() * scale;}
                  }
                  if (!weighted) {
                    for (let v = 0, vn = deform.length; v < vn; v++) {deform[v] += vertices[v];}
                  }
                }

                timeline.setFrame(frame, time, deform);
                if (frame == frameLast) {break;}
                const time2 = input.readFloat();

                switch (input.readByte()) {
                  case CURVE_STEPPED:
                    timeline.setStepped(frame);

                    break;
                  case CURVE_BEZIER:
                    setBezier(input, timeline, bezier++, frame, 0, time, time2, 0, 1, 1);
                }
                time = time2;
              }
              timelines.push(timeline);

              break;
            }
            case ATTACHMENT_SEQUENCE: {
              const timeline = new SequenceTimeline(frameCount, slotIndex, attachment as unknown as HasTextureRegion);

              for (let frame = 0; frame < frameCount; frame++) {
                const time = input.readFloat();
                const modeAndIndex = input.readInt32();

                timeline.setFrame(frame, time, SequenceModeValues[modeAndIndex & 0xf], modeAndIndex >> 4,
                  input.readFloat());
              }
              timelines.push(timeline);

              break;
            }
          }
        }
      }
    }

    // Draw order timeline.
    const drawOrderCount = input.readInt(true);

    if (drawOrderCount > 0) {
      const timeline = new DrawOrderTimeline(drawOrderCount);
      const slotCount = skeletonData.slots.length;

      for (let i = 0; i < drawOrderCount; i++) {
        const time = input.readFloat();
        const offsetCount = input.readInt(true);
        const drawOrder = ArrayUtils.newArray(slotCount, 0);

        for (let ii = slotCount - 1; ii >= 0; ii--) {drawOrder[ii] = -1;}
        const unchanged = ArrayUtils.newArray(slotCount - offsetCount, 0);
        let originalIndex = 0, unchangedIndex = 0;

        for (let ii = 0; ii < offsetCount; ii++) {
          const slotIndex = input.readInt(true);

          // Collect unchanged items.
          while (originalIndex != slotIndex) {unchanged[unchangedIndex++] = originalIndex++;}
          // Set changed items.
          drawOrder[originalIndex + input.readInt(true)] = originalIndex++;
        }
        // Collect remaining unchanged items.
        while (originalIndex < slotCount) {unchanged[unchangedIndex++] = originalIndex++;}
        // Fill in unchanged items.
        for (let ii = slotCount - 1; ii >= 0; ii--) {if (drawOrder[ii] == -1) {drawOrder[ii] = unchanged[--unchangedIndex];}}
        timeline.setFrame(i, time, drawOrder);
      }
      timelines.push(timeline);
    }

    // Event timeline.
    const eventCount = input.readInt(true);

    if (eventCount > 0) {
      const timeline = new EventTimeline(eventCount);

      for (let i = 0; i < eventCount; i++) {
        const time = input.readFloat();
        const eventData = skeletonData.events[input.readInt(true)];
        const event = new Event(time, eventData);

        event.intValue = input.readInt(false);
        event.floatValue = input.readFloat();
        event.stringValue = input.readBoolean() ? input.readString() : eventData.stringValue;
        if (event.data.audioPath) {
          event.volume = input.readFloat();
          event.balance = input.readFloat();
        }
        timeline.setFrame(i, event);
      }
      timelines.push(timeline);
    }

    let duration = 0;

    for (let i = 0, n = timelines.length; i < n; i++) {duration = Math.max(duration, timelines[i].getDuration());}

    return new Animation(name, timelines, duration);
  }
}

export class BinaryInput {
  constructor (data: DataView, public strings = new Array<string>(), private index: number = 0, private buffer = data) {
  }

  readByte (): number {
    return this.buffer.getInt8(this.index++);
  }

  readUnsignedByte (): number {
    return this.buffer.getUint8(this.index++);
  }

  readShort (): number {
    const value = this.buffer.getInt16(this.index);

    this.index += 2;

    return value;
  }

  readInt32 (): number {
    const value = this.buffer.getInt32(this.index);

    this.index += 4;

    return value;
  }

  readInt (optimizePositive: boolean) {
    let b = this.readByte();
    let result = b & 0x7F;

    if ((b & 0x80) != 0) {
      b = this.readByte();
      result |= (b & 0x7F) << 7;
      if ((b & 0x80) != 0) {
        b = this.readByte();
        result |= (b & 0x7F) << 14;
        if ((b & 0x80) != 0) {
          b = this.readByte();
          result |= (b & 0x7F) << 21;
          if ((b & 0x80) != 0) {
            b = this.readByte();
            result |= (b & 0x7F) << 28;
          }
        }
      }
    }

    return optimizePositive ? result : ((result >>> 1) ^ -(result & 1));
  }

  readStringRef (): string | null {
    const index = this.readInt(true);

    return index == 0 ? null : this.strings[index - 1];
  }

  readString (): string | null {
    let byteCount = this.readInt(true);

    switch (byteCount) {
      case 0:
        return null;
      case 1:
        return '';
    }
    byteCount--;
    let chars = '';
    const charCount = 0;

    for (let i = 0; i < byteCount;) {
      const b = this.readUnsignedByte();

      switch (b >> 4) {
        case 12:
        case 13:
          chars += String.fromCharCode(((b & 0x1F) << 6 | this.readByte() & 0x3F));
          i += 2;

          break;
        case 14:
          chars += String.fromCharCode(((b & 0x0F) << 12 | (this.readByte() & 0x3F) << 6 | this.readByte() & 0x3F));
          i += 3;

          break;
        default:
          chars += String.fromCharCode(b);
          i++;
      }
    }

    return chars;
  }

  readFloat (): number {
    const value = this.buffer.getFloat32(this.index);

    this.index += 4;

    return value;
  }

  readBoolean (): boolean {
    return this.readByte() != 0;
  }
}

class LinkedMesh {
  parent: string | null; skin: string | null;
  slotIndex: number;
  mesh: MeshAttachment;
  inheritTimeline: boolean;

  constructor (mesh: MeshAttachment, skin: string | null, slotIndex: number, parent: string | null, inheritDeform: boolean) {
    this.mesh = mesh;
    this.skin = skin;
    this.slotIndex = slotIndex;
    this.parent = parent;
    this.inheritTimeline = inheritDeform;
  }
}

class Vertices {
  constructor (public bones: Array<number> | null = null, public vertices: Array<number> | Float32Array | null = null) { }
}

enum AttachmentType { Region, BoundingBox, Mesh, LinkedMesh, Path, Point, Clipping }

function readTimeline1 (input: BinaryInput, timeline: CurveTimeline1, scale: number): CurveTimeline1 {
  let time = input.readFloat(), value = input.readFloat() * scale;

  for (let frame = 0, bezier = 0, frameLast = timeline.getFrameCount() - 1; ; frame++) {
    timeline.setFrame(frame, time, value);
    if (frame == frameLast) {break;}
    const time2 = input.readFloat(), value2 = input.readFloat() * scale;

    switch (input.readByte()) {
      case CURVE_STEPPED:
        timeline.setStepped(frame);

        break;
      case CURVE_BEZIER:
        setBezier(input, timeline, bezier++, frame, 0, time, time2, value, value2, scale);
    }
    time = time2;
    value = value2;
  }

  return timeline;
}

function readTimeline2 (input: BinaryInput, timeline: CurveTimeline2, scale: number): CurveTimeline2 {
  let time = input.readFloat(), value1 = input.readFloat() * scale, value2 = input.readFloat() * scale;

  for (let frame = 0, bezier = 0, frameLast = timeline.getFrameCount() - 1; ; frame++) {
    timeline.setFrame(frame, time, value1, value2);
    if (frame == frameLast) {break;}
    const time2 = input.readFloat(), nvalue1 = input.readFloat() * scale, nvalue2 = input.readFloat() * scale;

    switch (input.readByte()) {
      case CURVE_STEPPED:
        timeline.setStepped(frame);

        break;
      case CURVE_BEZIER:
        setBezier(input, timeline, bezier++, frame, 0, time, time2, value1, nvalue1, scale);
        setBezier(input, timeline, bezier++, frame, 1, time, time2, value2, nvalue2, scale);
    }
    time = time2;
    value1 = nvalue1;
    value2 = nvalue2;
  }

  return timeline;
}

function setBezier (input: BinaryInput, timeline: CurveTimeline, bezier: number, frame: number, value: number,
  time1: number, time2: number, value1: number, value2: number, scale: number) {
  timeline.setBezier(bezier, frame, value, time1, value1, input.readFloat(), input.readFloat() * scale, input.readFloat(), input.readFloat() * scale, time2, value2);
}

const BONE_ROTATE = 0;
const BONE_TRANSLATE = 1;
const BONE_TRANSLATEX = 2;
const BONE_TRANSLATEY = 3;
const BONE_SCALE = 4;
const BONE_SCALEX = 5;
const BONE_SCALEY = 6;
const BONE_SHEAR = 7;
const BONE_SHEARX = 8;
const BONE_SHEARY = 9;

const SLOT_ATTACHMENT = 0;
const SLOT_RGBA = 1;
const SLOT_RGB = 2;
const SLOT_RGBA2 = 3;
const SLOT_RGB2 = 4;
const SLOT_ALPHA = 5;

const ATTACHMENT_DEFORM = 0;
const ATTACHMENT_SEQUENCE = 1;

const PATH_POSITION = 0;
const PATH_SPACING = 1;
const PATH_MIX = 2;

const CURVE_LINEAR = 0;
const CURVE_STEPPED = 1;
const CURVE_BEZIER = 2;
