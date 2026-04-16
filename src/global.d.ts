/// <reference types="react-scripts" />

declare module '*.module.css' {
  const classes: {
    [key: string]: string
  }
  export default classes
}

declare module '*.png' {
  const content: string
  export default content
}

declare global {
  interface Window {
    $screenType: 'mobile' | 'tablet' | 'desktop'
    $pdfImgs: Record<string, Array<string> | undefined>
    dataLayer: any[]
  }

  function gtag(command: 'config', targetId: string, config?: Record<string, any>): void
  function gtag(command: 'set', config: Record<string, any>): void
  function gtag(command: 'event', eventName: string, params?: Record<string, any>): void
  function gtag(command: 'js', date: Date): void
}

export {}
