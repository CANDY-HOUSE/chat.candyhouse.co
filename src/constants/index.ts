// 发送消息的类型
export enum SendType {
  normal, // 正常发送
  refresh // 刷新消息
}

// 当前视图状态
export enum ViewModel {
  normal, // 普通对话
  voice, // 语音对话
  voiceActive, // 语音对话激活
  voicePause // 语音对话暂停
}

// 弹窗 level
export enum Level {
  error = 'error',
  warning = 'warning',
  info = 'info',
  success = 'success'
}

// 消息状态
export enum MessageState {
  error = -2,
  start,
  loading,
  finish,
  edit
}

// 模型状态
export enum ModelStatus {
  PREVIEW = 'PREVIEW', // 预览版：新模型测试阶段
  ACTIVE = 'ACTIVE', // 活跃：生产环境推荐使用
  DEPRECATED = 'DEPRECATED', // 已弃用：不推荐但仍可用
  RETIRED = 'RETIRED' // 已退役：不可用
}

// 模型类型
export enum ModelCategory {
  LLM = 'LLM',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO'
}

// 当前滚动位置
export enum ScrollState {
  top,
  bottom,
  middle,
  null
}
