/**
 * 后处理配置
 */
export interface GlobalVolume {
  usePostProcessing: boolean,
  useHDR: boolean,
  // Bloom
  useBloom: number,
  threshold: number,
  bloomIntensity: number,
  // ColorAdjustments
  brightness: number,
  saturation: number,
  contrast: number,
  // Vignette
  // vignetteColor: Color,
  // vignetteCenter: Vector2,
  vignetteIntensity: number,
  vignetteSmoothness: number,
  vignetteRoundness: number,
  // ToneMapping
  useToneMapping: number, // 1: true, 0: false
}

export const defaultGlobalVolume: GlobalVolume = {
  useHDR: false,
  usePostProcessing: false,
  /***** Material Uniform *****/
  // Bloom
  useBloom: 1.0,
  threshold: 1.0,
  bloomIntensity: 1.0,
  // ColorAdjustments
  brightness: 1.0,
  saturation: 1.0,
  contrast: 1.0,
  // Vignette
  // vignetteColor: new math.Color(0, 0, 0, 1),
  // vignetteCenter: new math.Vector2(0.5, 0.5),
  vignetteIntensity: 0.2,
  vignetteSmoothness: 0.4,
  vignetteRoundness: 1.0,
  // ToneMapping
  useToneMapping: 1, // 1: true, 0: false
};
