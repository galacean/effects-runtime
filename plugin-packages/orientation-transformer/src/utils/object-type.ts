export function getObjectType (obj: any) {
  return Object.prototype.toString.call(obj);
}
