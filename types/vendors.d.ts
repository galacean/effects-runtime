declare module '*.glsl' {
  const value: string;
  export default value;
}

declare module '*.wasm' {
  const content: () => Promise<Response>;
  export default content;
}

declare const __DEBUG__: boolean;
declare const __VERSION__: string;


interface Window {
  _createOffscreenCanvas: (width: number, height: number) => HTMLCanvasElement;
  AlipayJSBridge: any;
  WindVane: any;
  ge: any,
  __wxjs_environment: any;
}

declare const my: any
