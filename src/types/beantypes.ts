export interface BeanUser {
  name: string
  email: string
  isLogin: boolean
  isMembership?: boolean
  companyInfo?: {
    level: number
  }
}

export interface BeanAnchor {
  top: number
  left: number
  origin?: Element
}

export interface BeanVersionInfo {
  gitHash: string
  buildTime: string
}
