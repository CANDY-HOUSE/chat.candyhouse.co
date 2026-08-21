export interface ColorTokens {
  surfaceCanvas: string
  surfaceContent: string
  surfaceRaised: string
  surfaceSelected: string
  surfaceTrack: string
  borderDefault: string
  divider: string
  bgHover: string
  bgDisabled: string
  textPrimary: string
  textSecondary: string
  textDisabled: string
  iconMuted: string
  headerOverlayBg: string
  accentPrimary: string
  scrollbarThumb: string
  scrollbarThumbHover: string
  /** 对应 MUI theme.palette.background.default：浅色沿用纯白（登录页等整页背景仍需要它），
   *  深色和 surfaceCanvas 一致。语义上和 surfaceCanvas 不同，不要混用。 */
  pageBackground: string
}

export const lightColors: ColorTokens = {
  surfaceCanvas: '#eeeeee',
  surfaceContent: '#fafafa',
  surfaceRaised: '#ffffff',
  surfaceSelected: '#eeeeee',
  surfaceTrack: '#eeeeee',
  borderDefault: '#e0e0e0',
  divider: '#eeeeee',
  bgHover: '#f5f5f5',
  bgDisabled: '#f5f5f5',
  textPrimary: '#1a1e23',
  textSecondary: '#8f8f8f',
  textDisabled: '#9e9e9e',
  iconMuted: '#9e9e9e',
  headerOverlayBg: 'rgba(255, 255, 255, 0.6)',
  accentPrimary: '#9B59B6',
  scrollbarThumb: 'rgba(0, 0, 0, 0.12)',
  scrollbarThumbHover: 'rgba(0, 0, 0, 0.4)',
  pageBackground: '#ffffff'
}

export const darkColors: ColorTokens = {
  surfaceCanvas: '#161b22',
  surfaceContent: '#1c2128',
  surfaceRaised: '#22272e',
  surfaceSelected: '#2d333b',
  surfaceTrack: '#30363d',
  // 比 surfaceSelected/surfaceTrack 更亮一档：细边框在深色 UI 里天生比大面积色块更难被感知
  borderDefault: '#444c56',
  divider: '#262c36',
  bgHover: '#2d333b',
  bgDisabled: '#2d333b',
  textPrimary: '#e6edf3',
  textSecondary: '#9aa4b0',
  textDisabled: '#6e7681',
  iconMuted: '#768390',
  headerOverlayBg: 'rgba(22, 27, 34, 0.72)',
  accentPrimary: '#B77CD4',
  scrollbarThumb: 'rgba(255, 255, 255, 0.16)',
  scrollbarThumbHover: 'rgba(255, 255, 255, 0.32)',
  pageBackground: '#161b22'
}
