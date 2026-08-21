/**
 * Characters whose shaping is sensitive to right-to-left direction or joining.
 * The layout/render handoff uses this only to preserve the existing Canvas
 * whole-string paint path; it is not a FancyConfig concern.
 */
const RTL_OR_JOINING = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasRtlOrJoiningText (text: string): boolean {
  return RTL_OR_JOINING.test(text);
}
