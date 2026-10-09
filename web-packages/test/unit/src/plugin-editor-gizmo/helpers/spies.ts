export type TestSpy = ((...args: any[]) => any);

interface SpyState {
  calls: any[][],
  called: boolean,
}

const initialBodyNodes = new Set(document.body.childNodes);
const restoreGetters: (() => void)[] = [];

/** Read recorded arguments for assertions about the last call or part of an argument. */
export function getSpyCalls (callback: unknown): any[][] {
  return (callback as { __spy: SpyState }).__spy.calls;
}

/** chai-spies 1.0.0 has no public reset method. */
export function resetSpy (callback: unknown): void {
  const state = (callback as { __spy: SpyState }).__spy;

  state.calls.length = 0;
  state.called = false;
}

/** Replace fixture getters, which chai.spy.on only supports for methods. */
export function spyOnGetter (object: object, key: string, getter: () => unknown): TestSpy {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  const spy = chai.spy(getter);

  Object.defineProperty(object, key, { configurable: true, get: spy });
  restoreGetters.push(() => {
    if (descriptor) {
      Object.defineProperty(object, key, descriptor);
    } else {
      Reflect.deleteProperty(object, key);
    }
  });

  return spy;
}

/** Restore method replacements, getters and DOM fixtures after gizmo test cases. */
export function restoreTestState (): void {
  chai.spy.restore();
  restoreGetters.splice(0).reverse().forEach(restore => restore());
  document.body.childNodes.forEach(node => {
    if (!initialBodyNodes.has(node)) {
      node.remove();
    }
  });
}
