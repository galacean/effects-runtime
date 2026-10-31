import type { PropertyGroup } from '../../ui/property-editor/property-sheet';

export interface DetailsCustomization {
  target: object,
  getSearchTerms(): string[],
  build(group: PropertyGroup): void,
}
