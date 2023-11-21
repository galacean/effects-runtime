import 'fpsmeter';
import { Player } from '@galacean/effects';

export class SelectUI<T> {
  modified = false;

  constructor (
    public label: string,
    public selectedKey: string,
    public mapData: Record<string, T>,
  ) { }

  createUI () {
    const select = document.createElement('select');

    this.getKeyList().forEach(name => {
      const option = document.createElement('option');

      option.value = name;
      if (name === this.selectedKey) {
        option.selected = true;
      }
      option.appendChild(document.createTextNode(name));
      select.appendChild(option);
    });

    select.onchange = () => {
      const key = select.options[select.selectedIndex].value;

      this.selectedKey = key;
      this.modified = true;
    };

    const divDom = document.createElement('div');
    const br = document.createElement('br');
    const label = document.createElement('label');

    label.innerHTML = this.label;
    divDom.appendChild(label);
    divDom.appendChild(br);
    divDom.appendChild(select);

    return divDom;
  }

  getKeyList (): string[] {
    return Object.keys(this.mapData);
  }

  getKey (value: T): string {
    this.getKeyList().forEach(x => {
      if (this.getValue(x) == value) { return x; }
    });

    return '';
  }

  getValue (key: string): T {
    return this.mapData[key];
  }

  getSelectedKey (): string {
    return this.selectedKey;
  }

  getSelectedValue (): T {
    return this.getValue(this.selectedKey);
  }
}

export function createButton (parent: HTMLElement, name: string, callback?: (this: HTMLButtonElement, ev: MouseEvent) => any) {
  const button = document.createElement('button');

  button.textContent = name;
  if (callback !== undefined) {
    button.addEventListener('click', callback);
  }
  parent.appendChild(button);

  return button;
}

export function createCheckBox (parent: HTMLElement, name: string, defaultValue: boolean, callback?: (this: HTMLInputElement, ev: MouseEvent) => any) {
  const input = document.createElement('input');

  input.type = 'checkbox';
  input.id = name;
  input.checked = defaultValue;
  if (callback !== undefined) {
    input.addEventListener('click', callback);
  }
  parent.appendChild(input);

  const text = document.createElement('text');

  text.textContent = name;
  parent.appendChild(text);
}

export function createParagraph (parent: HTMLElement) {
  const p = document.createElement('p');

  parent.appendChild(p);

  return p;
}

export function createLabel (parent: HTMLElement, name: string, defaultValue: string) {
  const label = document.createElement('label');

  label.id = name;
  label.textContent = defaultValue;
  parent.appendChild(label);

  return label;
}

export function createSlider (name: string, minV: number, maxV: number, stepV: number, defaultV: number, callback: (value: Number) => any, style = ''): HTMLElement {
  const label = document.createElement('label');

  label.innerHTML = defaultV.toString();
  //
  const InputDom = document.createElement('input');

  InputDom.type = 'range';
  InputDom.min = minV.toString();
  InputDom.max = maxV.toString();
  InputDom.value = defaultV.toString();
  InputDom.step = stepV.toString();
  InputDom.style.cssText = style;
  InputDom.addEventListener('input', event => {
    label.innerHTML = InputDom.value;
    callback(Number(InputDom.value));
  });
  const divDom = document.createElement('div');

  divDom.innerHTML = name;
  divDom.appendChild(InputDom);
  divDom.appendChild(label);

  return divDom;
}

export function createPlayer (env: string, showFPS = true) {
  const renderFramework = /webgl=1\b/.test(location.search) ? 'webgl' : 'webgl2';
  const container = document.getElementById('J-container');
  const player = new Player({
    container: container,
    interactive: true,
    onItemClicked (e) {
    },
    renderFramework,
    env,
  });

  if (showFPS) {
    // @ts-expect-error
    const meter = new window.FPSMeter(
      container, {
        interval: 500,
        theme: 'transparent',
        heat:  1,
        history: 15,
        graph: 1,
        left: 'auto',
        top: '11px',
        right: 'auto',
        bottom: 'auto',
      }
    );

    player.ticker.add(meter.tick);
    // @ts-expect-error
    player.meter = meter;
  }

  return player;
}

export function disposePlayer (player?: Player) {
  if (player !== undefined) {
    // @ts-expect-error
    const meter = player.meter;

    meter?.destroy();
    // @ts-expect-error
    player.meter = undefined;
    player.dispose();
  }
}

export async function loadJsonFromURL (url: string): Promise<any> {
  return new Promise(function (resolve, reject) {
    const href = new URL(url, location.href).href;
    const xhr = new XMLHttpRequest();

    xhr.responseType = 'json';
    xhr.addEventListener('load', () => resolve(xhr.response));
    xhr.addEventListener('error', reject);
    xhr.open('get', href);
    xhr.send();
  });
}
