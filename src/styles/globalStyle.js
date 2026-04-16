export const globalStyles = {
  ':root': {
    /* 响应式单位 */
    '--responsive-unit': '1rem',
    '--icon-size': 'max(1.2rem, 28px)',
    '--icon-size-small': 'max(.92rem, 20px)',

    /* color */
    /* 灰度主色：基于 MUI grey palette */
    '--grey-50': '#fafafa',
    '--grey-100': '#f5f5f5',
    '--grey-200': '#eeeeee',
    '--grey-300': '#e0e0e0',
    '--grey-400': '#bdbdbd',
    '--grey-500': '#9e9e9e',
    '--grey-600': '#757575',
    '--grey-700': '#616161',
    '--grey-800': '#424242',
    '--grey-900': '#212121',

    /* 常用灰色语义变量 */
    '--text-primary': '#1a1e23' /* 主要文字 */,
    '--text-secondary': '#8f8f8f' /* 次要文字 */,
    '--text-disabled': 'var(--grey-500)' /* 禁用文字 */,
    '--bg-disabled': 'var(--grey-100)' /* 禁用背景 */,
    '--border-default': 'var(--grey-300)' /* 默认边框 */,
    '--divider': 'var(--grey-200)' /* 分割线 */,
    '--bg-hover': 'var(--grey-100)' /* hover背景 */,
    '--bg-paper': 'var(--grey-50)' /* 卡片/纸张背景 */,
    '--icon-muted': 'var(--grey-500)' /* 灰色图标 */,
    '--color-background': 'var(--grey-200)',

    /* 可选强调灰（图标 hover / 按钮 hover） */
    '--grey-hover': 'var(--grey-200)',

    /* 按钮颜色 */
    '--button--primary': '#28aeb1',

    /* 间距变量 */
    '--spacing-xs': 'clamp(0.25rem, 0.25rem + 0.25vw, 0.5rem)',
    '--spacing-sm': 'clamp(0.5rem, 0.5rem + 0.25vw, 0.75rem)',
    '--spacing-md': 'clamp(1rem, 1rem + 0.5vw, 1.5rem)',
    '--spacing-lg': 'clamp(1.5rem, 1.5rem + 0.75vw, 2.25rem)',
    '--spacing-xl': 'clamp(2rem, 2rem + 1vw, 3rem)',

    /* 标题字体大小 */
    '--heading-1': 'clamp(1.6rem, 2.2vw, 2.1rem)' /* ~26px-34px */,
    '--heading-2': 'clamp(1.4rem, 1.8vw, 1.8rem)' /* ~22px-29px */,
    '--heading-3': 'clamp(1.25rem, 1.5vw, 1.6rem)' /* ~20px-26px */,
    '--heading-4': 'clamp(1.15rem, 1.2vw, 1.4rem)' /* ~18px-22px */,
    '--heading-5': 'clamp(1.05rem, 1vw, 1.2rem)' /* ~17px-19px */,
    '--heading-6': 'clamp(1rem, 0.8vw, 1.1rem)' /* ~16px-18px */,

    /* 其他文本尺寸 */
    '--text-xs': 'clamp(0.75rem, 0.75rem + 0.25vw, 1rem)',
    '--text-sm': 'clamp(0.875rem, 0.875rem + 0.25vw, 1.125rem)',
    '--text-lg': 'clamp(1.125rem, 1.125rem + 0.25vw, 1.375rem)',
    '--text-xl': 'clamp(1.25rem, 1.25rem + 0.5vw, 1.75rem)',

    /* 边框圆角 */
    '--radius-sm': 'clamp(0.125rem, 0.125rem + 0.125vw, 0.25rem)',
    '--radius-md': 'clamp(0.25rem, 0.25rem + 0.25vw, 0.5rem)',
    '--radius-lg': 'clamp(0.5rem, 0.5rem + 0.5vw, 1rem)'
  },

  html: {
    fontFamily: 'var(--font-family)',
    /* 响应式基础字体大小 */
    fontSize: 'clamp(14px, calc(14px + 0.5vw), 28px)'
  },

  body: {
    '--text-base': '16px',
    fontSize: 'var(--text-base)',
    fontFamily: 'inherit'
  },

  /* 字体大小类 */
  '.font-size-14': {
    '--text-base': '14px'
  },

  '.font-size-16': {
    '--text-base': '16px'
  },

  '.font-size-18': {
    '--text-base': '18px'
  },

  '.font-size-21': {
    '--text-base': '21px'
  },

  '.font-size-24': {
    '--text-base': '24px'
  },

  '.font-size-28': {
    '--text-base': '28px'
  },

  /* 方向性间距 */
  ...['xs', 'sm', 'md', 'lg', 'xl'].reduce((acc, size) => {
    const directions = {
      p: 'padding',
      pt: 'paddingTop',
      pr: 'paddingRight',
      pb: 'paddingBottom',
      pl: 'paddingLeft',
      m: 'margin',
      mt: 'marginTop',
      mr: 'marginRight',
      mb: 'marginBottom',
      ml: 'marginLeft'
    }

    Object.entries(directions).forEach(([abbr, prop]) => {
      acc[`.${abbr}-${size}`] = { [prop]: `var(--spacing-${size})` }
    })

    return acc
  }, {}),

  /* 文本工具类 */
  '.text-xs': { fontSize: 'var(--text-xs)' },
  '.text-sm': { fontSize: 'var(--text-sm)' },
  '.text-base': { fontSize: 'inherit' } /* 使用正文字体大小 */,
  '.text-lg': { fontSize: 'var(--text-lg)' },
  '.text-xl': { fontSize: 'var(--text-xl)' },

  /* 标题工具类 */
  '.heading-1': { fontSize: 'var(--heading-1)' },
  '.heading-2': { fontSize: 'var(--heading-2)' },
  '.heading-3': { fontSize: 'var(--heading-3)' },
  '.heading-4': { fontSize: 'var(--heading-4)' },
  '.heading-5': { fontSize: 'var(--heading-5)' },
  '.heading-6': { fontSize: 'var(--heading-6)' },

  /* 确保所有 MUI 组件使用相同的字体族 */
  '.MuiTypography-root, .MuiButton-root, .MuiInputBase-root': {
    fontFamily: 'inherit'
  },

  /* 确保正文文本使用自定义字体大小 */
  '.MuiTypography-body1': {
    fontSize: 'var(--text-base)'
  },

  /* 处理 Portal 渲染的元素 */
  '.MuiPopover-root, .MuiMenu-root, .MuiModal-root': {
    '--inherited-font-size': 'var(--text-base)'
  },

  /* 特别处理 Select 和菜单项 */
  '.MuiMenuItem-root, .MuiSelect-select, .MuiPopover-paper .MuiTypography-root': {
    fontSize: 'var(--inherited-font-size, var(--text-base))',
    fontFamily: 'inherit'
  }
}
