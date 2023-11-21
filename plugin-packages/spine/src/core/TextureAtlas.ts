import type { Texture } from '@galacean/effects';
import { TextureFilter, TextureWrap, TextureRegion } from './Texture';
import type { Disposable, StringMap } from '../utils';
import { ArrayUtils } from '../utils';

export class TextureAtlas implements Disposable {
  pages = new Array<TextureAtlasPage>();
  regions = new Array<TextureAtlasRegion>();

  constructor (atlasText: string) {
    const reader = new TextureAtlasReader(atlasText);
    const entry = new Array<string>(4);

    const pageFields: StringMap<(page: TextureAtlasPage) => void> = {};

    pageFields['size'] = (page: TextureAtlasPage) => {
      page.width = parseInt(entry[1]);
      page.height = parseInt(entry[2]);
    };
    pageFields['filter'] = (page: TextureAtlasPage) => {
      page.minFilter = ArrayUtils.enumValue(TextureFilter, entry[1]);
      page.magFilter = ArrayUtils.enumValue(TextureFilter, entry[2]);
    };
    pageFields['repeat'] = (page: TextureAtlasPage) => {
      if (entry[1].includes('x')) { page.uWrap = TextureWrap.Repeat; }
      if (entry[1].includes('y')) { page.vWrap = TextureWrap.Repeat; }
    };
    pageFields['pma'] = (page: TextureAtlasPage) => {
      page.pma = entry[1] == 'true';
    };

    const regionFields: StringMap<(region: TextureAtlasRegion) => void> = {};

    regionFields['xy'] = (region: TextureAtlasRegion) => { // Deprecated, use bounds.
      region.x = parseInt(entry[1]);
      region.y = parseInt(entry[2]);
    };
    regionFields['size'] = (region: TextureAtlasRegion) => { // Deprecated, use bounds.
      region.width = parseInt(entry[1]);
      region.height = parseInt(entry[2]);
    };
    regionFields['bounds'] = (region: TextureAtlasRegion) => {
      region.x = parseInt(entry[1]);
      region.y = parseInt(entry[2]);
      region.width = parseInt(entry[3]);
      region.height = parseInt(entry[4]);
    };
    regionFields['offset'] = (region: TextureAtlasRegion) => { // Deprecated, use offsets.
      region.offsetX = parseInt(entry[1]);
      region.offsetY = parseInt(entry[2]);
    };
    regionFields['orig'] = (region: TextureAtlasRegion) => { // Deprecated, use offsets.
      region.originalWidth = parseInt(entry[1]);
      region.originalHeight = parseInt(entry[2]);
    };
    regionFields['offsets'] = (region: TextureAtlasRegion) => {
      region.offsetX = parseInt(entry[1]);
      region.offsetY = parseInt(entry[2]);
      region.originalWidth = parseInt(entry[3]);
      region.originalHeight = parseInt(entry[4]);
    };
    regionFields['rotate'] = (region: TextureAtlasRegion) => {
      const value = entry[1];

      if (value == 'true') { region.degrees = 90; } else if (value != 'false') { region.degrees = parseInt(value); }
    };
    regionFields['index'] = (region: TextureAtlasRegion) => {
      region.index = parseInt(entry[1]);
    };

    let line = reader.readLine();

    // Ignore empty lines before first entry.
    while (line && line.trim().length == 0) { line = reader.readLine(); }
    // Header entries.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!line || line.trim().length == 0) { break; }
      if (reader.readEntry(entry, line) == 0) { break; } // Silently ignore all header fields.
      line = reader.readLine();
    }

    // Page and region entries.
    let page: TextureAtlasPage | null = null;
    let names: string[] | null = null;
    let values: number[][] | null = null;

    while (line !== null) {
      if (line.trim().length == 0) {
        page = null;
        line = reader.readLine();
      } else if (!page) {
        page = new TextureAtlasPage(line.trim());
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (reader.readEntry(entry, line = reader.readLine()) == 0) { break; }
          const field = pageFields[entry[0]];

          if (field) { field(page); }
        }
        this.pages.push(page);
      } else {
        const region = new TextureAtlasRegion(page, line);

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const count = reader.readEntry(entry, line = reader.readLine());

          if (count == 0) { break; }
          const field = regionFields[entry[0]];

          if (field) { field(region); } else {
            if (!names) { names = []; }
            if (!values) { values = []; }
            names.push(entry[0]);
            const entryValues: number[] = [];

            for (let i = 0; i < count; i++) { entryValues.push(parseInt(entry[i + 1])); }
            values.push(entryValues);
          }
        }
        if (region.originalWidth == 0 && region.originalHeight == 0) {
          region.originalWidth = region.width;
          region.originalHeight = region.height;
        }
        if (names && names.length > 0 && values && values.length > 0) {
          region.names = names;
          region.values = values;
          names = null;
          values = null;
        }
        region.u = region.x / page.width;
        region.v = region.y / page.height;
        if (region.degrees == 90) {
          region.u2 = (region.x + region.height) / page.width;
          region.v2 = (region.y + region.width) / page.height;
        } else {
          region.u2 = (region.x + region.width) / page.width;
          region.v2 = (region.y + region.height) / page.height;
        }
        this.regions.push(region);
      }
    }
  }

  findRegion (name: string): TextureAtlasRegion | null {
    for (let i = 0; i < this.regions.length; i++) {
      if (this.regions[i].name == name) {
        return this.regions[i];
      }
    }

    return null;
  }

  setTextures (assetManager: any, pathPrefix = '') {
    for (const page of this.pages) { page.setTexture(assetManager.get(pathPrefix + page.name)); }
  }

  dispose () {
    for (let i = 0; i < this.pages.length; i++) {
      this.pages[i].texture?.dispose();
    }
  }
}

class TextureAtlasReader {
  lines: Array<string>;
  index = 0;

  constructor (text: string) {
    this.lines = text.split(/\r\n|\r|\n/);
  }

  readLine (): string | null {
    if (this.index >= this.lines.length) { return null; }

    return this.lines[this.index++];
  }

  readEntry (entry: string[], line: string | null): number {
    if (!line) { return 0; }
    line = line.trim();
    if (line.length == 0) { return 0; }

    const colon = line.indexOf(':');

    if (colon == -1) { return 0; }
    entry[0] = line.substr(0, colon).trim();
    for (let i = 1, lastMatch = colon + 1; ; i++) {
      const comma = line.indexOf(',', lastMatch);

      if (comma == -1) {
        entry[i] = line.substr(lastMatch).trim();

        return i;
      }
      entry[i] = line.substr(lastMatch, comma - lastMatch).trim();
      lastMatch = comma + 1;
      if (i == 4) { return 4; }
    }
  }
}

export class TextureAtlasPage {
  name: string;
  minFilter: TextureFilter = TextureFilter.Nearest;
  magFilter: TextureFilter = TextureFilter.Nearest;
  uWrap: TextureWrap = TextureWrap.ClampToEdge;
  vWrap: TextureWrap = TextureWrap.ClampToEdge;
  texture: Texture | null = null;
  width = 0;
  height = 0;
  pma: boolean;

  constructor (name: string) {
    this.name = name;
  }

  setTexture (texture: Texture) {
    this.texture = texture;
  }
}

export class TextureAtlasRegion extends TextureRegion {
  page: TextureAtlasPage;
  name: string;
  x = 0;
  y = 0;
  override offsetX = 0;
  override offsetY = 0;
  override originalWidth = 0;
  override originalHeight = 0;
  index = 0;
  override degrees = 0;
  names: string[] | null = null;
  values: number[][] | null = null;

  constructor (page: TextureAtlasPage, name: string) {
    super();
    this.page = page;
    this.name = name;
  }
}
