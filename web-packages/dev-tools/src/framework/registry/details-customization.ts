export interface DetailsCustomization {
  target: object,
  getSearchTerms: () => string[],
  onInspectorGUI: () => void,
}
