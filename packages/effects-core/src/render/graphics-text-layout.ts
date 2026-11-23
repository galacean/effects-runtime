import type { GlyphAtlas, GlyphLayout } from './text-cache';
import { TextCache } from './text-cache';

type CachedTextLayout = {
  layout: GlyphLayout,
  characters?: string[],
};

type LayoutEntry = {
  key: string,
  value: CachedTextLayout,
  previous?: LayoutEntry,
  next?: LayoutEntry,
};

const MAX_LAYOUTS = 1000;

/** Keeps repeated drawing and measurement from rebuilding unchanged text layouts. */
export class GraphicsTextLayoutCache {
  private readonly entries = new Map<string, LayoutEntry>();
  private fonts = new WeakMap<GlyphAtlas, number>();
  private fontCount = 0;
  private oldest?: LayoutEntry;
  private newest?: LayoutEntry;
  private segmenter = TextCache.graphemeSegmenter;

  get (atlas: GlyphAtlas, text: string, fontSize: number, trimEnd = true): CachedTextLayout {
    if (this.segmenter !== TextCache.graphemeSegmenter) {
      this.clear();
      this.segmenter = TextCache.graphemeSegmenter;
    }
    let fontId = this.fonts.get(atlas);

    if (fontId === undefined) {
      fontId = this.fontCount++;
      this.fonts.set(atlas, fontId);
    }
    const key = `${fontId}-${fontSize}-${trimEnd}-${text}`;
    let entry = this.entries.get(key);

    if (entry) {
      this.touch(entry);

      return entry.value;
    }
    const value = { layout: atlas.getLayout(text, fontSize, trimEnd) };

    if (this.entries.size === MAX_LAYOUTS) {
      entry = this.oldest!;
      this.entries.delete(entry.key);
      entry.key = key;
      entry.value = value;
    } else {
      entry = { key, value };
    }
    this.entries.set(key, entry);
    this.touch(entry);

    return value;
  }

  private touch (entry: LayoutEntry): void {
    if (this.newest === entry) {
      return;
    }
    if (entry.previous) {
      entry.previous.next = entry.next;
    } else if (this.oldest === entry) {
      this.oldest = entry.next;
    }
    if (entry.next) {
      entry.next.previous = entry.previous;
    }
    entry.previous = this.newest;
    entry.next = undefined;
    if (this.newest) {
      this.newest.next = entry;
    } else {
      this.oldest = entry;
    }
    this.newest = entry;
  }

  clear (): void {
    this.entries.clear();
    this.fonts = new WeakMap();
    this.fontCount = 0;
    this.oldest = this.newest = undefined;
  }
}
