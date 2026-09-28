export function assignInspectorName (
  obj: Record<string, any> | null,
  name?: string,
  id?: string,
) {
  if (name === undefined || obj === null) {
    return;
  }

  obj.__SPECTOR_Metadata = { name };
  if (obj.__SPECTOR_Object_TAG) {
    obj.__SPECTOR_Object_TAG.displayText = name;
    if (id) {
      obj.__SPECTOR_Object_TAG.id = id;
    }
  } else {
    obj.__SPECTOR_Object_TAG = {
      displayText: name,
      id: '',
    };
  }
}
