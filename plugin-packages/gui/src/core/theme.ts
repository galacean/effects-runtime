import { EventEmitter, math } from '@galacean/effects';
import type {
  Engine,
  EventEmitterListener,
  FontStyle,
  FontWeight,
  Graphics,
  Texture,
} from '@galacean/effects';
import type {
  StyleBoxData,
  StyleBoxMarginsData,
  ThemeData,
  ThemeFontData,
  ThemeItemCollectionData,
} from './data';

type Color = math.Color;
type Vector2 = math.Vector2;
const Color = math.Color;
const Vector2 = math.Vector2;

export enum ThemeItemType {
  Color = 'color',
  Constant = 'constant',
  Font = 'font',
  FontSize = 'fontSize',
  Icon = 'icon',
  StyleBox = 'styleBox',
}

export interface ThemeFont {
  family: string,
  weight: FontWeight,
  style: FontStyle,
}

export interface StyleBoxMargins {
  left: number,
  top: number,
  right: number,
  bottom: number,
}

export interface StyleBoxRect {
  x: number,
  y: number,
  width: number,
  height: number,
}

export enum PatchStretchMode {
  Stretch,
  Tile,
  TileFit,
}

export type ThemeValue = Color | number | ThemeFont | Texture | StyleBox | null;

export interface ThemeItemDefinition<T extends ThemeValue = ThemeValue> {
  type: ThemeItemType,
  defaultValue: T,
  affectsLayout?: boolean,
}

export type ThemeItemDefinitions = Record<string, ThemeItemDefinition>;

type StyleBoxEvent = { changed: [styleBox: StyleBox] };
type ThemeEvent = { changed: [theme: Theme, affectsLayout: boolean] };
type RegisteredThemeType = { baseType: string | null, definitions: ThemeItemDefinitions };

const ZERO_MARGINS: StyleBoxMargins = { left: 0, top: 0, right: 0, bottom: 0 };

function cloneMargins (value: StyleBoxMargins): StyleBoxMargins {
  return { left: value.left, top: value.top, right: value.right, bottom: value.bottom };
}

function marginsFromData (data?: StyleBoxMarginsData): StyleBoxMargins {
  return {
    left: data?.left ?? 0,
    top: data?.top ?? 0,
    right: data?.right ?? 0,
    bottom: data?.bottom ?? 0,
  };
}

function finite (name: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }

  return value;
}

function nonNegative (name: string, value: number): number {
  return Math.max(0, finite(name, value));
}

function cloneFont (value: ThemeFont): ThemeFont {
  return { family: value.family, weight: value.weight, style: value.style };
}

function fontFromData (value: ThemeFontData): ThemeFont {
  return { family: value.family, weight: value.weight ?? 'normal', style: value.style ?? 'normal' };
}

export function cloneThemeValue<T extends ThemeValue> (value: T): T {
  if (value instanceof Color) {
    return value.clone() as T;
  }
  if (value && typeof value === 'object' && 'family' in value && 'weight' in value && 'style' in value) {
    return cloneFont(value) as T;
  }

  return value;
}

/** Drawable box resource used for rendering and content measurement. */
export abstract class StyleBox {
  private readonly eventEmitter = new EventEmitter<StyleBoxEvent>();
  private contentMargins = cloneMargins(ZERO_MARGINS);
  private readOnly = false;

  on (eventName: 'changed', listener: EventEmitterListener<StyleBoxEvent['changed']>): void {
    this.eventEmitter.on(eventName, listener);
  }

  off (eventName: 'changed', listener: EventEmitterListener<StyleBoxEvent['changed']>): void {
    this.eventEmitter.off(eventName, listener);
  }

  getContentMargins (): StyleBoxMargins { return cloneMargins(this.contentMargins); }

  get isReadOnly (): boolean { return this.readOnly; }

  /** @internal Makes a native fallback StyleBox immutable. */
  makeReadOnly (): this {
    this.readOnly = true;

    return this;
  }

  setContentMargins (left: number, top: number, right: number, bottom: number): void {
    this.assertMutable();
    const next = {
      left: nonNegative('StyleBox left content margin', left),
      top: nonNegative('StyleBox top content margin', top),
      right: nonNegative('StyleBox right content margin', right),
      bottom: nonNegative('StyleBox bottom content margin', bottom),
    };

    if (Object.keys(next).some(key => next[key as keyof StyleBoxMargins] !== this.contentMargins[key as keyof StyleBoxMargins])) {
      this.contentMargins = next;
      this.notifyChanged();
    }
  }

  getMinimumSize (): Vector2 {
    return new Vector2(
      this.contentMargins.left + this.contentMargins.right,
      this.contentMargins.top + this.contentMargins.bottom,
    );
  }

  abstract draw (graphics: Graphics, rect: StyleBoxRect): void;

  protected notifyChanged (): void { this.eventEmitter.emit('changed', this); }
  protected assertMutable (): void {
    if (this.readOnly) {throw new Error('Native fallback StyleBoxes are read-only.');}
  }
}

export class StyleBoxEmpty extends StyleBox {
  static readonly shared = new StyleBoxEmpty().makeReadOnly();
  override draw (): void {}
}

export class StyleBoxFlat extends StyleBox {
  private backgroundColor = Color.CLEAR.clone();
  private borderColor = Color.CLEAR.clone();
  private borderWidths = cloneMargins(ZERO_MARGINS);
  private cornerRadii = cloneMargins(ZERO_MARGINS);

  getBackgroundColor (): Color { return this.backgroundColor.clone(); }
  getBorderColor (): Color { return this.borderColor.clone(); }
  getBorderWidths (): StyleBoxMargins { return cloneMargins(this.borderWidths); }
  getCornerRadii (): StyleBoxMargins { return cloneMargins(this.cornerRadii); }

  setBackgroundColor (value: Color): void {
    this.assertMutable();
    if (!this.backgroundColor.equals(value)) {
      this.backgroundColor.copyFrom(value);
      this.notifyChanged();
    }
  }

  setBorderColor (value: Color): void {
    this.assertMutable();
    if (!this.borderColor.equals(value)) {
      this.borderColor.copyFrom(value);
      this.notifyChanged();
    }
  }

  setBorderWidths (left: number, top: number, right: number, bottom: number): void {
    this.assertMutable();
    const next = {
      left: nonNegative('StyleBoxFlat left border width', left),
      top: nonNegative('StyleBoxFlat top border width', top),
      right: nonNegative('StyleBoxFlat right border width', right),
      bottom: nonNegative('StyleBoxFlat bottom border width', bottom),
    };

    if (Object.keys(next).some(key => next[key as keyof StyleBoxMargins] !== this.borderWidths[key as keyof StyleBoxMargins])) {
      this.borderWidths = next;
      this.notifyChanged();
    }
  }

  setCornerRadii (topLeft: number, topRight: number, bottomRight: number, bottomLeft: number): void {
    this.assertMutable();
    const next = {
      left: nonNegative('StyleBoxFlat top-left corner radius', topLeft),
      top: nonNegative('StyleBoxFlat top-right corner radius', topRight),
      right: nonNegative('StyleBoxFlat bottom-right corner radius', bottomRight),
      bottom: nonNegative('StyleBoxFlat bottom-left corner radius', bottomLeft),
    };

    if (Object.keys(next).some(key => next[key as keyof StyleBoxMargins] !== this.cornerRadii[key as keyof StyleBoxMargins])) {
      this.cornerRadii = next;
      this.notifyChanged();
    }
  }

  override draw (graphics: Graphics, rect: StyleBoxRect): void {
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    if (this.hasRoundedCorners()) {
      this.drawRounded(graphics, rect);

      return;
    }
    graphics.fillRectangle(rect.x, rect.y, rect.width, rect.height, this.backgroundColor);
    const border = this.borderWidths;

    if (border.top > 0) {graphics.fillRectangle(rect.x, rect.y, rect.width, Math.min(border.top, rect.height), this.borderColor);}
    if (border.bottom > 0) {
      const height = Math.min(border.bottom, rect.height);

      graphics.fillRectangle(rect.x, rect.y + rect.height - height, rect.width, height, this.borderColor);
    }
    if (border.left > 0) {graphics.fillRectangle(rect.x, rect.y, Math.min(border.left, rect.width), rect.height, this.borderColor);}
    if (border.right > 0) {
      const width = Math.min(border.right, rect.width);

      graphics.fillRectangle(rect.x + rect.width - width, rect.y, width, rect.height, this.borderColor);
    }
  }

  private hasRoundedCorners (): boolean {
    const radii = this.cornerRadii;

    return radii.left > 0 || radii.top > 0 || radii.right > 0 || radii.bottom > 0;
  }

  private drawRounded (graphics: Graphics, rect: StyleBoxRect): void {
    const border = adaptBorderWidths(this.borderWidths, rect.width, rect.height);
    const radii = adaptCornerRadii(this.cornerRadii, border, rect.width, rect.height);
    const hasBorder = border.left > 0 || border.top > 0 || border.right > 0 || border.bottom > 0;

    if (!hasBorder) {
      drawRoundedFill(graphics, rect, radii, this.backgroundColor);

      return;
    }
    const inner = {
      x: rect.x + border.left,
      y: rect.y + border.top,
      width: Math.max(0, rect.width - border.left - border.right),
      height: Math.max(0, rect.height - border.top - border.bottom),
    };

    if (inner.width <= 0 || inner.height <= 0) {
      drawRoundedFill(graphics, rect, radii, this.borderColor);

      return;
    }
    const innerRadii = {
      left: Math.max(0, radii.left - Math.min(border.left, border.top)),
      top: Math.max(0, radii.top - Math.min(border.right, border.top)),
      right: Math.max(0, radii.right - Math.min(border.right, border.bottom)),
      bottom: Math.max(0, radii.bottom - Math.min(border.left, border.bottom)),
    };

    drawRoundedRing(graphics, rect, radii, inner, innerRadii, this.borderColor);
    drawRoundedFill(graphics, inner, innerRadii, this.backgroundColor);
  }
}

function adaptBorderWidths (border: StyleBoxMargins, width: number, height: number): StyleBoxMargins {
  const adapted = createInfiniteMargins();

  adaptMarginPair('top', 'bottom', adapted, border, height, height, height);
  adaptMarginPair('left', 'right', adapted, border, width, width, width);

  return adapted;
}

function adaptCornerRadii (
  radii: StyleBoxMargins,
  border: StyleBoxMargins,
  width: number,
  height: number,
): StyleBoxMargins {
  const adapted = createInfiniteMargins();

  adaptMarginPair('top', 'right', adapted, radii, height, height - border.bottom, height - border.top);
  adaptMarginPair('left', 'bottom', adapted, radii, height, height - border.bottom, height - border.top);
  adaptMarginPair('left', 'top', adapted, radii, width, width - border.right, width - border.left);
  adaptMarginPair('bottom', 'right', adapted, radii, width, width - border.right, width - border.left);

  return adapted;
}

function adaptMarginPair (
  first: keyof StyleBoxMargins,
  second: keyof StyleBoxMargins,
  adapted: StyleBoxMargins,
  source: StyleBoxMargins,
  available: number,
  firstMaximum: number,
  secondMaximum: number,
): void {
  const sum = source[first] + source[second];
  const factor = sum > 0 ? Math.min(1, available / sum) : 1;

  adapted[first] = Math.min(source[first] * factor, firstMaximum, adapted[first]);
  adapted[second] = Math.min(source[second] * factor, secondMaximum, adapted[second]);
}

function createInfiniteMargins (): StyleBoxMargins {
  return {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.POSITIVE_INFINITY,
    bottom: Number.POSITIVE_INFINITY,
  };
}

function drawRoundedFill (
  graphics: Graphics,
  rect: StyleBoxRect,
  radii: StyleBoxMargins,
  color: Color,
): void {
  const points = getRoundedPoints(rect, radii);
  const centerX = rect.x + rect.width * 0.5;
  const centerY = rect.y + rect.height * 0.5;

  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    graphics.fillTriangle(centerX, centerY, current[0], current[1], next[0], next[1], color);
  }
}

function drawRoundedRing (
  graphics: Graphics,
  outerRect: StyleBoxRect,
  outerRadii: StyleBoxMargins,
  innerRect: StyleBoxRect,
  innerRadii: StyleBoxMargins,
  color: Color,
): void {
  const outer = getRoundedPoints(outerRect, outerRadii);
  const inner = getRoundedPoints(innerRect, innerRadii);

  for (let index = 0; index < outer.length; index++) {
    const next = (index + 1) % outer.length;

    graphics.fillTriangle(
      outer[index][0], outer[index][1], outer[next][0], outer[next][1],
      inner[index][0], inner[index][1], color,
    );
    graphics.fillTriangle(
      outer[next][0], outer[next][1], inner[next][0], inner[next][1],
      inner[index][0], inner[index][1], color,
    );
  }
}

function getRoundedPoints (rect: StyleBoxRect, radii: StyleBoxMargins): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const segments = 5;
  const corners: Array<[number, number, number, number]> = [
    [rect.x + radii.left, rect.y + radii.left, radii.left, Math.PI],
    [rect.x + rect.width - radii.top, rect.y + radii.top, radii.top, Math.PI * 1.5],
    [rect.x + rect.width - radii.right, rect.y + rect.height - radii.right, radii.right, 0],
    [rect.x + radii.bottom, rect.y + rect.height - radii.bottom, radii.bottom, Math.PI * 0.5],
  ];

  for (const [cx, cy, radius, start] of corners) {
    for (let index = 0; index <= segments; index++) {
      const angle = start + index / segments * Math.PI * 0.5;

      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
  }

  return points;
}

export class StyleBoxTexture extends StyleBox {
  private _texture: Texture | null = null;
  private sourceRect: StyleBoxRect | null = null;
  private patchMargins = cloneMargins(ZERO_MARGINS);
  private tint = Color.WHITE.clone();
  private _horizontalAxisStretchMode = PatchStretchMode.Stretch;
  private _verticalAxisStretchMode = PatchStretchMode.Stretch;
  private _drawCenter = true;

  get texture (): Texture | null { return this._texture; }
  set texture (value: Texture | null) {
    this.assertMutable();
    if (this._texture !== value) {
      this._texture = value;
      this.notifyChanged();
    }
  }

  get horizontalAxisStretchMode (): PatchStretchMode { return this._horizontalAxisStretchMode; }
  set horizontalAxisStretchMode (value: PatchStretchMode) {
    this.assertMutable();
    if (this._horizontalAxisStretchMode !== value) {
      this._horizontalAxisStretchMode = value;
      this.notifyChanged();
    }
  }

  get verticalAxisStretchMode (): PatchStretchMode { return this._verticalAxisStretchMode; }
  set verticalAxisStretchMode (value: PatchStretchMode) {
    this.assertMutable();
    if (this._verticalAxisStretchMode !== value) {
      this._verticalAxisStretchMode = value;
      this.notifyChanged();
    }
  }

  get drawCenter (): boolean { return this._drawCenter; }
  set drawCenter (value: boolean) {
    this.assertMutable();
    if (this._drawCenter !== value) {
      this._drawCenter = value;
      this.notifyChanged();
    }
  }

  getSourceRect (): StyleBoxRect | null { return this.sourceRect ? { ...this.sourceRect } : null; }
  getPatchMargins (): StyleBoxMargins { return cloneMargins(this.patchMargins); }
  getTint (): Color { return this.tint.clone(); }

  setSourceRect (x: number, y: number, width: number, height: number): void {
    this.assertMutable();
    this.sourceRect = {
      x: finite('StyleBoxTexture source x', x),
      y: finite('StyleBoxTexture source y', y),
      width: nonNegative('StyleBoxTexture source width', width),
      height: nonNegative('StyleBoxTexture source height', height),
    };
    this.notifyChanged();
  }

  clearSourceRect (): void {
    this.assertMutable();
    if (this.sourceRect) {
      this.sourceRect = null;
      this.notifyChanged();
    }
  }

  setPatchMargins (left: number, top: number, right: number, bottom: number): void {
    this.assertMutable();
    this.patchMargins = {
      left: nonNegative('StyleBoxTexture left patch margin', left),
      top: nonNegative('StyleBoxTexture top patch margin', top),
      right: nonNegative('StyleBoxTexture right patch margin', right),
      bottom: nonNegative('StyleBoxTexture bottom patch margin', bottom),
    };
    this.notifyChanged();
  }

  setTint (value: Color): void {
    this.assertMutable();
    if (!this.tint.equals(value)) {
      this.tint.copyFrom(value);
      this.notifyChanged();
    }
  }

  override draw (graphics: Graphics, rect: StyleBoxRect): void {
    const texture = this.texture;

    if (!texture || rect.width <= 0 || rect.height <= 0) {return;}
    const source = this.sourceRect ?? { x: 0, y: 0, width: texture.width, height: texture.height };

    graphics.drawNinePatch(rect.x, rect.y, rect.width, rect.height, texture, {
      sourceX: source.x,
      sourceY: source.y,
      sourceWidth: source.width,
      sourceHeight: source.height,
      marginLeft: this.patchMargins.left,
      marginTop: this.patchMargins.top,
      marginRight: this.patchMargins.right,
      marginBottom: this.patchMargins.bottom,
      horizontalMode: this.horizontalAxisStretchMode,
      verticalMode: this.verticalAxisStretchMode,
      drawCenter: this.drawCenter,
    }, this.tint);
  }
}

/** Registry for stable control type inheritance and immutable native defaults. */
export class ThemeRegistry {
  private static readonly types = new Map<string, RegisteredThemeType>();

  static registerType (type: string, baseType: string | null, definitions: ThemeItemDefinitions = {}): void {
    if (!type) {throw new Error('Theme type names cannot be empty.');}
    if (baseType === type) {throw new Error(`Theme type ${type} cannot inherit itself.`);}
    if (baseType && !this.types.has(baseType)) {throw new Error(`Unknown base theme type: ${baseType}.`);}
    if (baseType && this.getTypeChain(baseType).includes(type)) {
      throw new Error(`Theme type inheritance cycle detected at ${type}.`);
    }
    const previous = this.types.get(type);

    if (previous && previous.baseType !== baseType) {
      throw new Error(`Theme type ${type} is already registered with base ${previous.baseType ?? '<none>'}.`);
    }
    const storedDefinitions: ThemeItemDefinitions = { ...(previous?.definitions ?? {}) };

    for (const name of Object.keys(definitions)) {
      if (storedDefinitions[name]) {
        throw new Error(`Theme item ${type}.${name} is already registered.`);
      }
      const definition = definitions[name];
      const defaultValue = cloneThemeValue(definition.defaultValue);

      if (defaultValue instanceof StyleBox) {defaultValue.makeReadOnly();}
      storedDefinitions[name] = { ...definition, defaultValue };
    }
    this.types.set(type, { baseType, definitions: storedDefinitions });
  }

  static hasType (type: string): boolean { return this.types.has(type); }

  static getTypeChain (type: string): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    let current: string | null = type;

    while (current && !visited.has(current)) {
      result.push(current);
      visited.add(current);
      current = this.types.get(current)?.baseType ?? null;
    }

    return result;
  }

  static getDefault (type: string, itemType: ThemeItemType, name: string): ThemeValue | undefined {
    const definition = this.types.get(type)?.definitions[name];

    return definition?.type === itemType ? cloneThemeValue(definition.defaultValue) : undefined;
  }

  static getItemDefinition (type: string, itemType: ThemeItemType, name: string): ThemeItemDefinition | undefined {
    for (const dependency of this.getTypeChain(type)) {
      const definition = this.types.get(dependency)?.definitions[name];

      if (definition?.type === itemType) {return definition;}
    }

    return undefined;
  }

  static affectsLayout (type: string, itemType: ThemeItemType, name: string): boolean {
    const definition = this.getItemDefinition(type, itemType, name);

    if (definition) {return definition.affectsLayout ?? false;}

    return itemType === ThemeItemType.Constant
      || itemType === ThemeItemType.Font
      || itemType === ThemeItemType.FontSize
      || itemType === ThemeItemType.StyleBox;
  }

  static getItemDefinitions (type: string, includeInherited = true): ThemeItemDefinitions {
    const result: ThemeItemDefinitions = {};
    const chain = includeInherited ? this.getTypeChain(type).reverse() : [type];

    for (const dependency of chain) {
      const definitions = this.types.get(dependency)?.definitions ?? {};

      for (const name of Object.keys(definitions)) {
        const definition = definitions[name];

        result[name] = { ...definition, defaultValue: cloneThemeValue(definition.defaultValue) };
      }
    }

    return result;
  }
}

export class Theme {
  private readonly eventEmitter = new EventEmitter<ThemeEvent>();
  private readonly values = new Map<string, Map<ThemeItemType, Map<string, ThemeValue>>>();
  private readonly variations = new Map<string, string>();
  private readonly styleBoxReferences = new Map<StyleBox, number>();
  private batchDepth = 0;
  private changePending = false;
  private layoutChangePending = false;
  private readonly styleBoxChanged = () => this.notifyChanged(true);

  on (eventName: 'changed', listener: EventEmitterListener<ThemeEvent['changed']>): void {
    this.eventEmitter.on(eventName, listener);
  }

  off (eventName: 'changed', listener: EventEmitterListener<ThemeEvent['changed']>): void {
    this.eventEmitter.off(eventName, listener);
  }

  batch<T> (callback: () => T): T {
    this.batchDepth++;
    try {
      return callback();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.changePending) {
        this.changePending = false;
        const affectsLayout = this.layoutChangePending;

        this.layoutChangePending = false;
        this.eventEmitter.emit('changed', this, affectsLayout);
      }
    }
  }

  setTypeVariation (variation: string, baseType: string): void {
    if (!variation || !baseType || variation === baseType) {throw new Error('Theme variations require distinct non-empty names.');}
    if (ThemeRegistry.hasType(variation)) {
      throw new Error(`Theme variation ${variation} conflicts with a registered control type.`);
    }
    if (!ThemeRegistry.hasType(baseType) && !this.variations.has(baseType)) {
      throw new Error(`Unknown theme variation base type: ${baseType}.`);
    }
    let current: string | undefined = baseType;

    while (current) {
      if (current === variation) {throw new Error(`Theme variation cycle detected at ${variation}.`);}
      current = this.variations.get(current);
    }
    if (this.variations.get(variation) !== baseType) {
      this.variations.set(variation, baseType);
      this.notifyChanged(true);
    }
  }

  clearTypeVariation (variation: string): void {
    for (const [dependent, base] of this.variations) {
      if (dependent !== variation && base === variation) {
        throw new Error(`Theme variation ${variation} is still used by ${dependent}.`);
      }
    }
    if (this.variations.delete(variation)) {this.notifyChanged(true);}
  }

  hasTypeVariation (variation: string): boolean { return this.variations.has(variation); }
  getTypeVariationBase (variation: string): string | undefined { return this.variations.get(variation); }

  getTypeDependencies (variation: string): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    let current = variation;

    while (!visited.has(current)) {
      result.push(current);
      visited.add(current);
      const base = this.variations.get(current);

      if (!base) {
        result.push(...ThemeRegistry.getTypeChain(current).slice(1));

        return result;
      }
      current = base;
    }

    throw new Error(`Theme variation cycle detected at ${variation}.`);
  }

  setColor (type: string, name: string, value: Color): void { this.setItem(type, ThemeItemType.Color, name, value); }
  getColor (type: string, name: string): Color | undefined { return this.getItem(type, ThemeItemType.Color, name) as Color | undefined; }
  hasColor (type: string, name: string): boolean { return this.hasItem(type, ThemeItemType.Color, name); }
  clearColor (type: string, name: string): void { this.clearItem(type, ThemeItemType.Color, name); }
  setConstant (type: string, name: string, value: number): void { this.setItem(type, ThemeItemType.Constant, name, finite(name, value)); }
  getConstant (type: string, name: string): number | undefined { return this.getItem(type, ThemeItemType.Constant, name) as number | undefined; }
  hasConstant (type: string, name: string): boolean { return this.hasItem(type, ThemeItemType.Constant, name); }
  clearConstant (type: string, name: string): void { this.clearItem(type, ThemeItemType.Constant, name); }
  setFont (type: string, name: string, value: ThemeFont): void { this.setItem(type, ThemeItemType.Font, name, value); }
  getFont (type: string, name: string): ThemeFont | undefined { return this.getItem(type, ThemeItemType.Font, name) as ThemeFont | undefined; }
  hasFont (type: string, name: string): boolean { return this.hasItem(type, ThemeItemType.Font, name); }
  clearFont (type: string, name: string): void { this.clearItem(type, ThemeItemType.Font, name); }
  setFontSize (type: string, name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {throw new RangeError(`${name} must be a positive finite font size.`);}
    this.setItem(type, ThemeItemType.FontSize, name, value);
  }
  getFontSize (type: string, name: string): number | undefined { return this.getItem(type, ThemeItemType.FontSize, name) as number | undefined; }
  hasFontSize (type: string, name: string): boolean { return this.hasItem(type, ThemeItemType.FontSize, name); }
  clearFontSize (type: string, name: string): void { this.clearItem(type, ThemeItemType.FontSize, name); }
  setIcon (type: string, name: string, value: Texture | null): void { this.setItem(type, ThemeItemType.Icon, name, value); }
  getIcon (type: string, name: string): Texture | null | undefined { return this.getItem(type, ThemeItemType.Icon, name) as Texture | null | undefined; }
  hasIcon (type: string, name: string): boolean { return this.hasItem(type, ThemeItemType.Icon, name); }
  clearIcon (type: string, name: string): void { this.clearItem(type, ThemeItemType.Icon, name); }
  setStyleBox (type: string, name: string, value: StyleBox): void { this.setItem(type, ThemeItemType.StyleBox, name, value); }
  getStyleBox (type: string, name: string): StyleBox | undefined { return this.getItem(type, ThemeItemType.StyleBox, name) as StyleBox | undefined; }
  hasStyleBox (type: string, name: string): boolean { return this.hasItem(type, ThemeItemType.StyleBox, name); }
  clearStyleBox (type: string, name: string): void { this.clearItem(type, ThemeItemType.StyleBox, name); }

  hasItem (type: string, itemType: ThemeItemType, name: string): boolean {
    return this.values.get(type)?.get(itemType)?.has(name) ?? false;
  }

  getItem (type: string, itemType: ThemeItemType, name: string): ThemeValue | undefined {
    const value = this.values.get(type)?.get(itemType)?.get(name);

    return value === undefined ? undefined : cloneThemeValue(value);
  }

  clearItem (type: string, itemType: ThemeItemType, name: string): void {
    const categories = this.values.get(type);
    const items = categories?.get(itemType);
    const previous = items?.get(name);

    if (!items?.delete(name)) {return;}
    if (items.size === 0) {categories?.delete(itemType);}
    if (categories?.size === 0) {this.values.delete(type);}
    if (previous instanceof StyleBox) {this.releaseStyleBox(previous);}
    this.notifyChanged(this.affectsLayout(type, itemType, name));
  }

  clear (): void {
    if (this.values.size === 0 && this.variations.size === 0) {return;}
    for (const styleBox of this.styleBoxReferences.keys()) {
      styleBox.off('changed', this.styleBoxChanged);
    }
    this.styleBoxReferences.clear();
    this.values.clear();
    this.variations.clear();
    this.notifyChanged(true);
  }

  static fromData (engine: Engine, data: ThemeData): Theme {
    const theme = new Theme();

    theme.batch(() => {
      const variations = data.variations ?? {};
      const remaining = new Map<string, string>();

      for (const variation of Object.keys(variations)) {remaining.set(variation, variations[variation]);}

      while (remaining.size > 0) {
        let progressed = false;

        for (const [variation, base] of remaining) {
          if (ThemeRegistry.hasType(base) || theme.hasTypeVariation(base)) {
            theme.setTypeVariation(variation, base);
            remaining.delete(variation);
            progressed = true;
          }
        }
        if (!progressed) {throw new Error('Theme data contains an unknown or cyclic variation.');}
      }
      for (const type of Object.keys(data.types)) {theme.setCollectionFromData(engine, type, data.types[type]);}
    });

    return theme;
  }

  private setCollectionFromData (engine: Engine, type: string, data: ThemeItemCollectionData): void {
    const colors = data.colors ?? {};
    const constants = data.constants ?? {};
    const fonts = data.fonts ?? {};
    const fontSizes = data.fontSizes ?? {};
    const icons = data.icons ?? {};
    const styleBoxes = data.styleBoxes ?? {};

    for (const name of Object.keys(colors)) {
      const value = colors[name];

      this.setColor(type, name, new Color(value.r, value.g, value.b, value.a));
    }
    for (const name of Object.keys(constants)) {this.setConstant(type, name, constants[name]);}
    for (const name of Object.keys(fonts)) {this.setFont(type, name, fontFromData(fonts[name]));}
    for (const name of Object.keys(fontSizes)) {this.setFontSize(type, name, fontSizes[name]);}
    for (const name of Object.keys(icons)) {
      const value = icons[name];

      this.setIcon(type, name, value ? engine.findObject<Texture>(value) : null);
    }
    for (const name of Object.keys(styleBoxes)) {this.setStyleBox(type, name, styleBoxFromData(engine, styleBoxes[name]));}
  }

  private setItem (type: string, itemType: ThemeItemType, name: string, value: ThemeValue): void {
    if (!type || !name) {throw new Error('Theme type and item names cannot be empty.');}
    let categories = this.values.get(type);

    if (!categories) {this.values.set(type, categories = new Map());}
    let items = categories.get(itemType);

    if (!items) {categories.set(itemType, items = new Map());}
    const previous = items.get(name);

    if (previous instanceof StyleBox) {this.releaseStyleBox(previous);}
    const stored = cloneThemeValue(value);

    items.set(name, stored);
    if (stored instanceof StyleBox) {this.retainStyleBox(stored);}
    this.notifyChanged(this.affectsLayout(type, itemType, name));
  }

  private retainStyleBox (styleBox: StyleBox): void {
    const count = this.styleBoxReferences.get(styleBox) ?? 0;

    if (count === 0) {styleBox.on('changed', this.styleBoxChanged);}
    this.styleBoxReferences.set(styleBox, count + 1);
  }

  private releaseStyleBox (styleBox: StyleBox): void {
    const count = this.styleBoxReferences.get(styleBox) ?? 0;

    if (count <= 1) {
      styleBox.off('changed', this.styleBoxChanged);
      this.styleBoxReferences.delete(styleBox);
    } else {this.styleBoxReferences.set(styleBox, count - 1);}
  }

  private notifyChanged (affectsLayout: boolean): void {
    if (this.batchDepth > 0) {
      this.changePending = true;
      this.layoutChangePending ||= affectsLayout;
    } else {this.eventEmitter.emit('changed', this, affectsLayout);}
  }

  private affectsLayout (type: string, itemType: ThemeItemType, name: string): boolean {
    for (const dependency of this.getTypeDependencies(type)) {
      const definition = ThemeRegistry.getItemDefinition(dependency, itemType, name);

      if (definition) {return definition.affectsLayout ?? false;}
    }

    return itemType === ThemeItemType.Constant
      || itemType === ThemeItemType.Font
      || itemType === ThemeItemType.FontSize
      || itemType === ThemeItemType.StyleBox;
  }
}

export function styleBoxFromData (engine: Engine, data: StyleBoxData): StyleBox {
  let styleBox: StyleBox;

  if (data.type === 'flat') {
    const flat = new StyleBoxFlat();

    if (data.backgroundColor) {flat.setBackgroundColor(new Color(data.backgroundColor.r, data.backgroundColor.g, data.backgroundColor.b, data.backgroundColor.a));}
    if (data.borderColor) {flat.setBorderColor(new Color(data.borderColor.r, data.borderColor.g, data.borderColor.b, data.borderColor.a));}
    const border = marginsFromData(data.borderWidths);

    flat.setBorderWidths(border.left, border.top, border.right, border.bottom);
    const corners = marginsFromData(data.cornerRadii);

    flat.setCornerRadii(corners.left, corners.top, corners.right, corners.bottom);
    styleBox = flat;
  } else if (data.type === 'texture') {
    const texture = new StyleBoxTexture();

    texture.texture = data.texture ? engine.findObject<Texture>(data.texture) : null;
    if (data.sourceRect) {texture.setSourceRect(data.sourceRect.position[0], data.sourceRect.position[1], data.sourceRect.size[0], data.sourceRect.size[1]);}
    const patch = marginsFromData(data.patchMargins);

    texture.setPatchMargins(patch.left, patch.top, patch.right, patch.bottom);
    texture.horizontalAxisStretchMode = data.horizontalAxisStretchMode ?? PatchStretchMode.Stretch;
    texture.verticalAxisStretchMode = data.verticalAxisStretchMode ?? PatchStretchMode.Stretch;
    texture.drawCenter = data.drawCenter ?? true;
    if (data.tint) {texture.setTint(new Color(data.tint.r, data.tint.g, data.tint.b, data.tint.a));}
    styleBox = texture;
  } else {styleBox = new StyleBoxEmpty();}
  const content = marginsFromData(data.contentMargins);

  styleBox.setContentMargins(content.left, content.top, content.right, content.bottom);

  return styleBox;
}

export const themeFallbacks = {
  color: Color.CLEAR.clone(),
  constant: 0,
  font: { family: 'sans-serif', weight: 'normal', style: 'normal' } as ThemeFont,
  fontSize: 14,
  icon: null as Texture | null,
  styleBox: StyleBoxEmpty.shared,
};
