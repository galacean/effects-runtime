import { FrameComponent, GradientValue, ShapeComponent, math, spec } from '@galacean/effects';
import { applyRichTextResize, createRichTextResizeSnapshot, getEditableTextComponent, getRichTextFrameWidth, getRichTextInputSelection, RichTextDocument } from '@galacean/effects-plugin-editor-gizmo';
import type { GradientPaint, Paint, SolidPaint, VFXItem } from '@galacean/effects';
import { RichTextComponent } from '@galacean/effects-plugin-rich-text';
import { DOMEvents, element } from './dom';
import type { DemoEditor } from './editor';
import type { DemoScene } from './scene';

type InspectorShapeAttributes = {
  type?: spec.ShapePrimitiveType,
  width?: number,
  height?: number,
  xRadius?: number,
  yRadius?: number,
  radius?: number,
  innerRadius?: number,
  outerRadius?: number,
};

const COLOR_MODES = {
  solid: spec.FillType.Solid,
  radial: spec.FillType.GradientRadial,
  linear: spec.FillType.GradientLinear,
  angular: spec.FillType.GradientAngular,
} as const;

/** 负责属性表单的读取、校验与显示，所有修改交给编辑器执行。 */
export class InspectorPanel {
  private readonly events = new DOMEvents();
  private readonly fields = {
    x: element<HTMLInputElement>('position-x'),
    y: element<HTMLInputElement>('position-y'),
    rotation: element<HTMLInputElement>('rotation'),
    width: element<HTMLInputElement>('width'),
    height: element<HTMLInputElement>('height'),
    fontSize: element<HTMLInputElement>('font-size'),
  };
  private readonly selectionName = element('selection');
  private readonly selectionKind = element('selection-kind');
  private readonly scale = element('scale');
  private readonly textSection = element('text-properties');
  private readonly textValue = element<HTMLTextAreaElement>('text-value');
  private readonly fillSection = element('fill-properties');
  private readonly fillMode = element<HTMLSelectElement>('fill-mode');
  private readonly gradientStop = element<HTMLSelectElement>('gradient-stop');
  private readonly latticeSoft = element<HTMLInputElement>('lattice-soft');
  private readonly latticeRadius = element<HTMLInputElement>('lattice-radius');
  private readonly previousGradients = new WeakMap<VFXItem, GradientPaint>();
  private readonly fill = element<HTMLInputElement>('fill');
  private readonly fillValue = element('fill-value');
  private readonly fillOpacity = element<HTMLInputElement>('fill-opacity');
  private readonly frameSection = element('frame-properties');
  private readonly frameTitle = element<HTMLInputElement>('frame-title');
  private readonly frameStroke = element<HTMLInputElement>('frame-stroke');
  private readonly frameStrokeWidth = element<HTMLInputElement>('frame-stroke-width');
  private readonly fillOpacityField = element('fill-opacity-field');
  private readonly mediaSection = element('media-properties');
  private readonly mediaPlay = element<HTMLButtonElement>('media-play');
  private readonly mediaSeek = element<HTMLInputElement>('media-seek');
  private readonly mediaTime = element('media-time');
  private readonly mediaStatus = element('media-status');
  private signature = '';
  private textTarget?: VFXItem;
  private beforeTextInput?: { item: VFXItem, source: string } & ReturnType<typeof getRichTextInputSelection>;
  private refreshFrame?: number;

  constructor (private readonly scene: DemoScene, private readonly editor: DemoEditor) {
    this.bindPositionFields();
    this.bindSizeFields();
    this.bindTextFields();
    this.events.on(
      this.fillMode,
      'change',
      () =>
        this.setColorMode(COLOR_MODES[this.fillMode.value as keyof typeof COLOR_MODES])
    );
    this.events.on(this.gradientStop, 'change', () => {
      this.editor.gradientGizmo?.selectStop(Number(this.gradientStop.value));
      this.refresh(true);
    });
    this.events.on(this.latticeSoft, 'change', () => {
      this.editor.latticeGizmo?.setSoftSelection(this.latticeSoft.checked);
      this.refresh(true);
    });
    this.events.on(this.latticeRadius, 'change', () => {
      const gizmo = this.editor.latticeGizmo;

      gizmo?.setSoftSelection(gizmo.softSelection, this.latticeRadius.valueAsNumber);
      this.refresh(true);
    });
    this.events.on(this.mediaPlay, 'click', () => {
      this.editor.editSelected('切换媒体播放', item => {
        const media = this.scene.getMediaState(item);

        if (media) {
          this.scene.setMediaPlaying(item, !media.playing);
        }
      });
    });
    this.events.on(this.mediaSeek, 'input', () => {
      this.editor.editSelected('调整媒体进度', item => this.scene.seekMedia(item, this.mediaSeek.valueAsNumber));
    });
    this.events.on(this.fill, 'input', () => {
      const hex = this.fill.value;

      if (this.editor.hasRichTextSelection) {
        this.editor.formatRichTextSelection('color', hex);

        return;
      }
      const channel = (index: number) => parseInt(hex.slice(index, index + 2), 16) / 255;

      if (this.editor.selectedItem?.getComponent(ShapeComponent)) {
        this.editShapeColor('修改色标颜色', color => color.set(channel(1), channel(3), channel(5), color.a));

        return;
      }
      this.editor.editSelected('修改填充', item => {
        const frame = item.getComponent(FrameComponent);
        const fill = this.getSolidPaint(frame?.fills);

        if (fill) {
          fill.color.set(channel(1), channel(3), channel(5), fill.color.a);
        }
        const text = getEditableTextComponent(item);

        if (!(text instanceof RichTextComponent && text.textLayout.useLegacyRichText)) {
          text?.setTextColor([channel(1), channel(3), channel(5), 1]);
        }
      });
    });
    this.events.on(this.fillOpacity, 'change', () => {
      const alpha = this.fillOpacity.valueAsNumber / 100;

      if (Number.isFinite(alpha) && alpha >= 0 && alpha <= 1) {
        if (this.editor.selectedItem?.getComponent(ShapeComponent)) {
          this.editShapeColor('修改填充透明度', color => {
            color.a = alpha;
          });

          return;
        }
        this.editor.editSelected('修改填充透明度', item => {
          const fill = this.getSolidPaint(item.getComponent(FrameComponent)?.fills);

          if (fill) {
            fill.color.a = alpha;
          }
        });
      }
    });
    this.events.on(this.frameTitle, 'input', () => {
      this.editor.editSelected('修改画板标题', item => {
        const frame = item.getComponent(FrameComponent);

        if (frame) {
          item.name = this.frameTitle.value;
          const data = this.scene.getItem(item);

          if (data) {
            data.name = item.name;
          }
        }
      });
    });
    this.events.on(this.frameStroke, 'input', () => {
      const color = this.frameStroke.value;

      this.editor.editSelected('修改画板描边颜色', item => {
        const frame = item.getComponent(FrameComponent);

        if (frame) {
          const channel = (index: number) => parseInt(color.slice(index, index + 2), 16) / 255;

          frame.strokes[0] = { type: spec.FillType.Solid, color: new math.Color(channel(1), channel(3), channel(5), 1) };
        }
      });
    });
    this.events.on(this.frameStrokeWidth, 'change', () => {
      const width = this.frameStrokeWidth.valueAsNumber;

      if (Number.isFinite(width) && width >= 0) {
        this.editor.editSelected('修改画板描边宽度', item => {
          const frame = item.getComponent(FrameComponent);

          if (frame) {
            frame.strokeWidth = width;
          }
        });
      }
    });
    Object.values(this.fields).forEach(input => {
      this.events.on(input, 'blur', () => this.scheduleRefresh());
    });
  }

  refresh (force = false): void {
    const selected = this.editor.selectedItems;
    const item = this.editor.selectedItem;
    const text = getEditableTextComponent(item);
    const legacyRichText = text instanceof RichTextComponent && text.textLayout.useLegacyRichText;
    const textFormats = this.editor.richTextSelectionFormats;
    const frame = item?.getComponent(FrameComponent);
    const fill = this.getSolidPaint(frame?.fills);
    const shapePaint = item?.getComponent(ShapeComponent)?.getColorPaint('fill', 0);
    const gradient = shapePaint && shapePaint.type !== spec.FillType.Solid ? shapePaint : undefined;
    const stopIndex = this.selectedStopIndex(gradient);
    const shapeColor = shapePaint?.type === spec.FillType.Solid
      ? shapePaint.color
      : gradient?.gradientStops.stops[stopIndex]?.color;
    const stroke = this.getSolidPaint(frame?.strokes);
    const color = typeof textFormats?.color === 'string' && /^#[\da-f]{6}/i.test(textFormats.color)
      ? textFormats.color.slice(0, 7) : shapeColor ? this.toHexColor(shapeColor) : this.getFillColor(item);
    const data = item ? this.scene.getItem(item) : undefined;
    const vectorGeometry = data?.kind === 'Vector' ? this.scene.readVectorGeometry(data) : undefined;
    const media = item ? this.scene.getMediaState(item) : undefined;
    const lattice = this.editor.latticeGizmo;
    const signature = JSON.stringify([
      selected.map(target => target.getInstanceId()),
      item?.transform.position.toArray(), item?.transform.scale.toArray(), item?.transform.size.toArray(),
      item?.transform.rotation.z, text?.text, text?.textStyle.fontSize, textFormats, color,
      text instanceof RichTextComponent ? [text.textLayout.maxTextWidth, text.textLayout.useLegacyRichText] : undefined,
      item?.name, frame?.strokeWidth, fill?.color.toArray(), stroke?.color.toArray(),
      frame?.fills[0]?.type, frame?.strokes[0]?.type,
      vectorGeometry, data?.status, media,
      shapePaint, stopIndex,
      lattice && [lattice.selected.size, lattice.softSelection, lattice.softRadius],
    ]);

    if (!force && signature === this.signature) {
      return;
    }
    this.signature = signature;
    element('lattice-properties').hidden = !lattice;
    if (lattice) {
      element('lattice-selection').textContent = `${lattice.selected.size} 个控制点`;
      this.latticeSoft.checked = lattice.softSelection;
      this.setInput(this.latticeRadius, lattice.softRadius, !lattice.softSelection);
    }
    this.selectionName.textContent = selected.map(target => this.scene.getName(target)).join('、') || '未选择';
    this.selectionKind.textContent = item ? this.scene.getItem(item)?.kind ?? '—' : selected.length > 1 ? `${selected.length} 个图层` : '—';
    this.setInput(this.fields.x, item?.transform.position.x);
    this.setInput(this.fields.y, item?.transform.position.y);
    this.setInput(this.fields.rotation, item?.transform.rotation.z);
    this.setInput(this.fields.width, vectorGeometry?.width ?? (text instanceof RichTextComponent ? getRichTextFrameWidth(text)
      : item ? Math.abs(item.transform.size.x * item.transform.scale.x) : undefined), legacyRichText);
    this.setInput(this.fields.height, vectorGeometry?.height ?? (item ? Math.abs(item.transform.size.y * item.transform.scale.y) : undefined), !!text);
    this.scale.textContent = item ? `${item.transform.scale.x.toFixed(2)} × ${item.transform.scale.y.toFixed(2)}` : '—';
    this.textSection.hidden = !text;
    element('rich-text-tools').hidden = item?.type !== spec.ItemType.richtext;
    this.textValue.disabled = !text || legacyRichText;
    const textTargetChanged = this.textTarget !== item;

    this.textTarget = item;
    if (textTargetChanged || this.beforeTextInput?.source !== text?.text) {
      this.beforeTextInput = undefined;
    }
    if (text) {
      if (textTargetChanged || document.activeElement !== this.textValue) {
        this.beforeTextInput = undefined;
        this.textValue.value = item?.type === spec.ItemType.richtext ? new RichTextDocument(text.text).text : text.text;
      }
      this.setInput(this.fields.fontSize, textFormats?.size == null ? text.textStyle.fontSize : Number(textFormats.size), legacyRichText);
      this.fields.fontSize.placeholder = textFormats?.size === null ? '混合' : '';
      if (textFormats?.size === null && document.activeElement !== this.fields.fontSize) {
        this.fields.fontSize.value = '';
      }
      element('text-bold').setAttribute('aria-pressed', String(textFormats?.b === ''));
      element('text-italic').setAttribute('aria-pressed', String(textFormats?.i === ''));
    }
    element<HTMLButtonElement>('text-bold').disabled = item?.type !== spec.ItemType.richtext || legacyRichText;
    element<HTMLButtonElement>('text-italic').disabled = item?.type !== spec.ItemType.richtext || legacyRichText;
    this.fillSection.hidden = !color;
    element('fill-mode-field').hidden = !shapePaint;
    element('gradient-stop-field').hidden = !gradient;
    this.fillMode.value = Object.entries(COLOR_MODES).find(([, type]) => type === shapePaint?.type)?.[0] ?? 'solid';
    if (gradient) {
      const options = gradient.gradientStops.stops.map((stop, index) =>
        new Option(`${index + 1} · ${Math.round(stop.time * 100)}%`, String(index)),
      );

      this.gradientStop.replaceChildren(...options);
      this.gradientStop.value = String(stopIndex);
    }
    this.frameSection.hidden = data?.kind !== 'Frame';
    this.fillOpacityField.hidden = !fill && !shapeColor;
    if (document.activeElement !== this.frameTitle) {
      this.frameTitle.value = item?.name ?? '';
    }
    this.setInput(this.fillOpacity, shapeColor ? shapeColor.a * 100 : fill ? fill.color.a * 100 : undefined);
    this.setInput(this.frameStrokeWidth, frame?.strokeWidth);
    if (stroke) {
      this.frameStroke.value = this.toHexColor(stroke.color);
    }
    if (color) {
      this.fill.value = color;
      this.fillValue.textContent = textFormats?.color === null ? '混合' : color.slice(1).toUpperCase();
    }
    this.fill.disabled = !color || legacyRichText;
    this.mediaSection.hidden = data?.kind !== 'Video' && data?.kind !== 'Effects';
    this.mediaPlay.disabled = !media;
    this.mediaPlay.textContent = media?.playing ? '暂停' : '播放';
    this.mediaSeek.disabled = !media || media.duration <= 0;
    this.mediaSeek.max = String(media?.duration ?? 0);
    if (document.activeElement !== this.mediaSeek) {
      this.mediaSeek.value = String(media?.time ?? 0);
    }
    this.mediaTime.textContent = `${(media?.time ?? 0).toFixed(2)} / ${(media?.duration ?? 0).toFixed(2)} s`;
    this.mediaStatus.textContent = data?.status === 'loading' ? '素材加载中…' : data?.status === 'error' ? '素材加载失败' : media?.playing ? '播放中' : '已暂停';
  }

  dispose (): void {
    this.events.dispose();
    if (this.refreshFrame !== undefined) {
      cancelAnimationFrame(this.refreshFrame);
    }
  }

  private selectedStopIndex (paint?: GradientPaint): number {
    return Math.min(
      Math.max(
        0,
        this.editor.gradientGizmo?.selectedStopIndex ?? Number(this.gradientStop.value)
      ),
      (paint?.gradientStops.stops.length ?? 1) - 1
    );
  }

  private editShapeColor (label: string, edit: (color: math.Color) => void): void {
    const component = this.editor.selectedItem?.getComponent(ShapeComponent);
    const index = this.selectedStopIndex(component?.getGradientPaint('fill', 0));

    this.editor.editFill(label, item => {
      const shape = item.getComponent(ShapeComponent);
      const paint = shape.getColorPaint('fill', 0);

      if (!paint) {
        return;
      }
      edit(paint.type === spec.FillType.Solid ? paint.color : paint.gradientStops.stops[index].color);
      shape.setColorPaint('fill', 0, paint);
    });
    this.editor.gradientGizmo?.selectStop(index);
  }

  private setColorMode (type: typeof COLOR_MODES[keyof typeof COLOR_MODES]): void {
    this.editor.editFill('修改颜色模式', item => {
      const shape = item.getComponent(ShapeComponent);
      const paint = shape?.getColorPaint('fill', 0);

      if (!paint || paint.type === type) {
        return;
      }
      const gradient = paint.type !== spec.FillType.Solid ? paint : this.previousGradients.get(item);

      if (paint.type !== spec.FillType.Solid) {
        this.previousGradients.set(item, paint);
      }
      if (type === spec.FillType.Solid) {
        const color = paint.type === spec.FillType.Solid ? paint.color : paint.gradientStops.stops[0].color;

        shape.setColorPaint('fill', 0, { type, color });
      } else {
        const color = paint.type === spec.FillType.Solid ? paint.color : paint.gradientStops.stops[0].color;

        shape.setColorPaint('fill', 0, gradient ? { ...gradient, type } : {
          type, startPoint: new math.Vector2(0.5, 0.5), endPoint: new math.Vector2(1, 0.5),
          gradientStops: new GradientValue([[0, color.r, color.g, color.b, color.a], [1, 0, 0, 0, 1]]),
        });
      }
    });
    this.editor.gradientGizmo?.selectStop(0);
    this.refresh(true);
  }

  private bindPositionFields (): void {
    for (const axis of ['x', 'y'] as const) {
      const input = this.fields[axis];

      this.events.on(input, 'change', () => {
        if (this.isValidNumber(input)) {
          this.editor.editSelectedPosition(axis, input.valueAsNumber);
        }
      });
    }
    const rotation = this.fields.rotation;

    this.events.on(rotation, 'change', () => {
      if (this.isValidNumber(rotation)) {
        this.editor.editSelected('修改旋转', item => item.setRotation(0, 0, rotation.valueAsNumber));
      }
    });
  }

  private bindSizeFields (): void {
    for (const [input, axis] of [[this.fields.width, 'x'], [this.fields.height, 'y']] as const) {
      this.events.on(input, 'change', () => {
        if (!this.isValidNumber(input) || input.valueAsNumber <= 0) {
          return;
        }
        this.editor.editSelected('修改尺寸', item => {
          const text = getEditableTextComponent(item);
          const current = Math.abs(item.transform.size[axis] * item.transform.scale[axis]);

          if (text instanceof RichTextComponent) {
            if (axis !== 'x' || text.textLayout.useLegacyRichText) {
              return;
            }
            const snapshot = createRichTextResizeSnapshot(text, 'width');
            const currentWidth = getRichTextFrameWidth(text);

            if (input.valueAsNumber === Math.round(currentWidth * 100) / 100) {
              return;
            }
            applyRichTextResize(snapshot, input.valueAsNumber / Math.max(currentWidth, 0.01));
          } else if (text) {
            text.setTextWidth(text.textLayout.width * input.valueAsNumber / Math.max(current, 0.01));
          } else if (!this.setVectorSize(item, axis, input.valueAsNumber)) {
            item.transform.setSize(
              axis === 'x' ? input.valueAsNumber / Math.max(Math.abs(item.transform.scale.x), 0.01) : item.transform.size.x,
              axis === 'y' ? input.valueAsNumber / Math.max(Math.abs(item.transform.scale.y), 0.01) : item.transform.size.y,
            );
            this.scene.fitEffects(item);
          }
        });
      });
    }
  }

  private setVectorSize (item: VFXItem, axis: 'x' | 'y', size: number): boolean {
    const data = this.scene.getItem(item);
    const component = item.getComponent(ShapeComponent);
    const shape = component?.shape as InspectorShapeAttributes | undefined;

    if (data?.kind !== 'Vector' || !shape) {
      return false;
    }
    const scale = Math.abs(item.transform.scale[axis]);

    // 零缩放保持折叠；非零缩放按真实值换算尺寸。
    if (scale === 0) {
      return true;
    }
    const value = size / scale;

    if (!Number.isFinite(value)) {
      return true;
    }
    const definitionUpdates: Record<string, unknown> = {};

    switch (shape.type) {
      case spec.ShapePrimitiveType.Rectangle:
        shape[axis === 'x' ? 'width' : 'height'] = value;
        definitionUpdates[axis === 'x' ? 'width' : 'height'] = value;

        break;
      case spec.ShapePrimitiveType.Ellipse:
        shape[axis === 'x' ? 'xRadius' : 'yRadius'] = value / 2;
        definitionUpdates[axis === 'x' ? 'xRadius' : 'yRadius'] = value / 2;

        break;
      case spec.ShapePrimitiveType.Polygon: {
        const previousRadius = shape.radius ?? 0;

        shape.radius = value / 2;
        definitionUpdates.radius = value / 2;
        const other = axis === 'x' ? 'y' : 'x';
        const otherScale = item.transform.scale[other] * Math.abs(previousRadius) / shape.radius;

        item.transform.setScale(axis === 'x' ? item.transform.scale.x : otherScale,
          axis === 'y' ? item.transform.scale.y : otherScale, item.transform.scale.z);

        break;
      }
      case spec.ShapePrimitiveType.Star: {
        const previousOuter = shape.outerRadius ?? 0;
        const nextOuter = value / 2;

        shape.outerRadius = nextOuter;
        shape.innerRadius = previousOuter === 0 ? shape.innerRadius : (shape.innerRadius ?? 0) * nextOuter / previousOuter;
        definitionUpdates.outerRadius = shape.outerRadius;
        definitionUpdates.innerRadius = shape.innerRadius;
        const other = axis === 'x' ? 'y' : 'x';
        const otherScale = item.transform.scale[other] * Math.abs(previousOuter) / nextOuter;

        item.transform.setScale(axis === 'x' ? item.transform.scale.x : otherScale,
          axis === 'y' ? item.transform.scale.y : otherScale, item.transform.scale.z);

        break;
      }
      default:
        return false;
    }
    Object.assign(component.definition, definitionUpdates);
    component.onApplyAnimationProperties();

    return true;
  }

  private bindTextFields (): void {
    this.events.on(this.textValue, 'beforeinput', event => {
      const item = this.editor.selectedItem;
      const text = getEditableTextComponent(item);

      this.beforeTextInput = item && text
        ? { item, source: text.text, ...getRichTextInputSelection(this.textValue, event.inputType) }
        : undefined;
    });
    this.events.on(this.textValue, 'input', () => {
      const selection = this.beforeTextInput;

      this.beforeTextInput = undefined;
      this.editor.editSelected('修改文本', item => {
        const text = getEditableTextComponent(item);

        if (!text) {
          return;
        }
        if (text instanceof RichTextComponent && text.textLayout.useLegacyRichText) {
          return;
        }
        if (item.type === spec.ItemType.richtext) {
          const document = new RichTextDocument(text.text);

          document.updateText(this.textValue.value, selection?.item === item && selection.source === text.text ? selection : undefined);
          text.setText(document.markup);
        } else {
          text.setText(this.textValue.value);
        }
      });
    });
    for (const [id, attribute] of [['text-bold', 'b'], ['text-italic', 'i']] as const) {
      this.events.on(element(id), 'mousedown', event => event.preventDefault());
      this.events.on(element(id), 'click', () => this.editor.formatRichTextSelection(attribute));
    }
    const fontSize = this.fields.fontSize;

    this.events.on(fontSize, 'change', () => {
      if (this.isValidNumber(fontSize) && fontSize.valueAsNumber > 0) {
        if (this.editor.hasRichTextSelection) {
          this.editor.formatRichTextSelection('size', fontSize.value);

          return;
        }
        this.editor.editSelected('修改字号', item => {
          const text = getEditableTextComponent(item);

          if (text instanceof RichTextComponent) {
            if (text.textLayout.useLegacyRichText) {
              return;
            }
            text.setLayoutProperties({ fontSize: fontSize.valueAsNumber, lineHeight: fontSize.valueAsNumber * 1.35 });
          } else {
            text?.setFontSize(fontSize.valueAsNumber);
            text?.setLineHeight(Math.round(fontSize.valueAsNumber * 1.35));
          }
        });
      }
    });
  }

  private scheduleRefresh (): void {
    if (this.refreshFrame !== undefined) {
      cancelAnimationFrame(this.refreshFrame);
    }
    // 等 change 事件完成后再格式化，避免 blur 覆盖尚未提交的输入值。
    this.refreshFrame = requestAnimationFrame(() => {
      this.refreshFrame = undefined;
      this.refresh(true);
    });
  }

  private isValidNumber (input: HTMLInputElement): boolean {
    return input.value !== '' && Number.isFinite(input.valueAsNumber);
  }

  private setInput (input: HTMLInputElement, value: number | undefined, disabled = false): void {
    input.disabled = value === undefined || disabled;
    if (document.activeElement !== input) {
      input.value = value === undefined ? '' : String(Math.round(value * 100) / 100);
    }
  }

  private getFillColor (item: VFXItem | undefined): string | undefined {
    const frame = item?.getComponent(FrameComponent);
    const fill = this.getSolidPaint(frame?.fills);
    const text = getEditableTextComponent(item);
    const channels = fill ? [fill.color.r, fill.color.g, fill.color.b] : text?.textStyle.textColor.slice(0, 3);

    return channels ? `#${channels.map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('')}` : undefined;
  }

  private getSolidPaint (paints?: Paint[]): SolidPaint | undefined {
    const paint = paints?.[0];

    return paint?.type === spec.FillType.Solid ? paint : undefined;
  }

  private toHexColor (color: spec.ColorData): string {
    return `#${[color.r, color.g, color.b].map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('')}`;
  }
}
