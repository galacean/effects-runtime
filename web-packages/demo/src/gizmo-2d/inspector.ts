import { FrameComponent, TextComponent, math, spec } from '@galacean/effects';
import type { Paint, SolidPaint, VFXItem } from '@galacean/effects';
import { DOMEvents, element } from './dom';
import type { DemoEditor } from './editor';
import type { DemoScene } from './scene';

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
  private refreshFrame?: number;

  constructor (private readonly scene: DemoScene, private readonly editor: DemoEditor) {
    this.bindPositionFields();
    this.bindSizeFields();
    this.bindTextFields();
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
      const channel = (index: number) => parseInt(hex.slice(index, index + 2), 16) / 255;

      this.editor.editSelected('修改填充', item => {
        const frame = item.getComponent(FrameComponent);
        const fill = this.getSolidPaint(frame?.fills);

        if (fill) {
          fill.color.set(channel(1), channel(3), channel(5), fill.color.a);
        }
        item.getComponent(TextComponent)?.setTextColor([channel(1), channel(3), channel(5), 1]);
      });
    });
    this.events.on(this.fillOpacity, 'change', () => {
      const alpha = this.fillOpacity.valueAsNumber / 100;

      if (Number.isFinite(alpha) && alpha >= 0 && alpha <= 1) {
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
            frame.strokeAttributes.width = width;
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
    const text = item?.getComponent(TextComponent);
    const frame = item?.getComponent(FrameComponent);
    const fill = this.getSolidPaint(frame?.fills);
    const stroke = this.getSolidPaint(frame?.strokes);
    const color = this.getFillColor(item);
    const data = item ? this.scene.getItem(item) : undefined;
    const media = item ? this.scene.getMediaState(item) : undefined;
    const signature = JSON.stringify([
      selected.map(target => target.getInstanceId()),
      item?.transform.position.toArray(), item?.transform.scale.toArray(), item?.transform.size.toArray(),
      item?.transform.rotation.z, text?.text, text?.textStyle.fontSize, color,
      item?.name, frame?.strokeAttributes, fill?.color.toArray(), stroke?.color.toArray(),
      frame?.fills[0]?.type, frame?.strokes[0]?.type,
      data?.status, media,
    ]);

    if (!force && signature === this.signature) {
      return;
    }
    this.signature = signature;
    this.selectionName.textContent = selected.map(target => this.scene.getName(target)).join('、') || '未选择';
    this.selectionKind.textContent = item ? this.scene.getItem(item)?.kind ?? '—' : selected.length > 1 ? `${selected.length} 个图层` : '—';
    this.setInput(this.fields.x, item?.transform.position.x);
    this.setInput(this.fields.y, item?.transform.position.y);
    this.setInput(this.fields.rotation, item?.transform.rotation.z);
    this.setInput(this.fields.width, item ? Math.abs(item.transform.size.x * item.transform.scale.x) : undefined);
    this.setInput(this.fields.height, item ? Math.abs(item.transform.size.y * item.transform.scale.y) : undefined, !!text);
    this.scale.textContent = item ? `${item.transform.scale.x.toFixed(2)} × ${item.transform.scale.y.toFixed(2)}` : '—';
    this.textSection.hidden = !text;
    if (text) {
      if (document.activeElement !== this.textValue) {
        this.textValue.value = text.text;
      }
      this.setInput(this.fields.fontSize, text.textStyle.fontSize);
    }
    this.fillSection.hidden = !color;
    this.frameSection.hidden = data?.kind !== 'Frame';
    this.fillOpacityField.hidden = !fill;
    if (document.activeElement !== this.frameTitle) {
      this.frameTitle.value = item?.name ?? '';
    }
    this.setInput(this.fillOpacity, fill ? fill.color.a * 100 : undefined);
    this.setInput(this.frameStrokeWidth, frame?.strokeAttributes.width);
    if (stroke) {
      this.frameStroke.value = this.toHexColor(stroke.color);
    }
    if (color) {
      this.fill.value = color;
      this.fillValue.textContent = color.slice(1).toUpperCase();
    }
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

  private bindPositionFields (): void {
    for (const axis of ['x', 'y'] as const) {
      const input = this.fields[axis];

      this.events.on(input, 'change', () => {
        if (this.isValidNumber(input)) {
          this.editor.editSelected('修改位置', item => {
            const { x, y, z } = item.transform.position;

            item.setPosition(axis === 'x' ? input.valueAsNumber : x, axis === 'y' ? input.valueAsNumber : y, z);
          });
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
          const text = item.getComponent(TextComponent);
          const current = Math.abs(item.transform.size[axis] * item.transform.scale[axis]);

          if (text) {
            text.setTextWidth(text.textLayout.width * input.valueAsNumber / Math.max(current, 0.01));
          } else {
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

  private bindTextFields (): void {
    this.events.on(this.textValue, 'input', () => {
      this.editor.editSelected('修改文本', item => item.getComponent(TextComponent)?.setText(this.textValue.value));
    });
    const fontSize = this.fields.fontSize;

    this.events.on(fontSize, 'change', () => {
      if (this.isValidNumber(fontSize) && fontSize.valueAsNumber > 0) {
        this.editor.editSelected('修改字号', item => {
          const text = item.getComponent(TextComponent);

          text?.setFontSize(fontSize.valueAsNumber);
          text?.setLineHeight(Math.round(fontSize.valueAsNumber * 1.35));
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
    const text = item?.getComponent(TextComponent);
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
