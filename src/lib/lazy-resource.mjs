/**
 * Optional services initialize when their feature uses them, rather than at build.
 * @template {object} T
 * @param {() => T} factory
 * @returns {T}
 */
export function lazyResource(factory) {
  let resource;
  const resolve=()=>resource||(resource=factory());
  return new Proxy(/** @type {T} */ ({}), {
    get(_target,key) { const value=Reflect.get(resolve(),key);return typeof value==='function'?value.bind(resolve()):value; },
    set(_target,key,value) { return Reflect.set(resolve(),key,value); },
  });
}
