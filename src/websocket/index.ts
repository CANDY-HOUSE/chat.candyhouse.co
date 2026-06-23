import i18n from '@/i18n'
import { presignUrl } from '@aws-amplify/core/internals/aws-client-utils'
import { fetchAuthSession } from 'aws-amplify/auth'

export enum WS_STATUS {
  DISCONNECTED = 0, // 未连接
  CONNECTING = 1, // 连接中
  CONNECTED = 2 // 已连接
}

const ACTION_TYPES = {
  KEEP_ALIVE: 'keepAlive'
}

const WS_HEARTBEAT_INTERVAL_MS = 60000 // 60秒心跳间隔
const getConfigAwsUrl = () => {
  let awsUrl = {
    production: 'wss://gfibtw2q45.execute-api.ap-northeast-1.amazonaws.com/production'
  }
  return awsUrl.production
}

const WS_SIGNING_REGION = process.env.REACT_APP_API_REGION || 'ap-northeast-1'

// 日志开关
const WS_DEBUG = process.env.NODE_ENV === 'development'
const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  if (WS_DEBUG) console.log(...args)
}

// 构造签名 WebSocket URL 的函数
const buildSignedWsUrl = async (): Promise<string> => {
  const baseUrl = `${getConfigAwsUrl()}?lang=${i18n.language}`
  const { credentials } = await fetchAuthSession()
  if (!credentials) {
    throw new Error('No credentials')
  }
  const signedUrl = presignUrl(
    { method: 'GET', url: new URL(baseUrl) },
    {
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
      },
      signingRegion: WS_SIGNING_REGION,
      signingService: 'execute-api',
      expiration: 300
    }
  )
  return signedUrl.toString()
}

class WebSocketManager {
  private static instance: WebSocketManager
  private ws: WebSocket | null = null
  private subscribers = new Map<string, Function>()

  // 重连与退避控制
  private reconnectTimer: any = null
  private connectionTimeoutTimer: any = null
  private retryCount = 0
  private readonly minReconnectionDelay = 1000
  private readonly maxReconnectionDelay = 10000
  private readonly connectionTimeout = 5000

  // 心跳与活跃检测
  private heartbeatTimer: any = null
  private pongTimeoutTimer: any = null
  private lastActiveTime: number = Date.now()
  private maxIdleTimeInterval: number = 1.5 * WS_HEARTBEAT_INTERVAL_MS

  private messageQueue: any[] = []
  private connectionId: string = ''
  private connectionFailureCallback: (() => Promise<boolean>) | null = null
  private readonly MAX_RETRIES_BEFORE_TOKEN_CHECK = 3
  private currentStatus: WS_STATUS = WS_STATUS.DISCONNECTED
  private statusListeners: Set<(_status: WS_STATUS) => void> = new Set() // 连接状态监听器
  private connectionIdListeners: Set<(_connectionId: string) => void> = new Set()

  private constructor() {
    window.addEventListener('beforeunload', () => {
      this.closeConnection()
    })

    window.addEventListener('offline', () => {
      log('【WS】网络断开')
      this.updateStatus(WS_STATUS.DISCONNECTED)
    })

    window.addEventListener('online', () => {
      log('【WS】网络恢复')
      this.wakeUpConnection()
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        log('【WS】页面可见，检查连接状态')
        this.wakeUpConnection()
      } else {
        this.lastActiveTime = Date.now()
      }
    })

    this.subscribe(ACTION_TYPES.KEEP_ALIVE, (response: any) => {
      log('【WS】收到心跳响应:', response)
      const newId = response.connectionId
      if (this.connectionId && this.connectionId !== newId) {
        this.updateConnectionId(newId) // 真正变化 → 通知监听者
      } else {
        this.connectionId = newId // 首次赋值或相同 → 不通知
      }
      log('【WS】当前连接ID:', this.connectionId)
      this.clearPongTimeout()
      this.updateStatus(WS_STATUS.CONNECTED)
    })
  }

  static getInstance() {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager()
    }
    return WebSocketManager.instance
  }

  private updateStatus(status: WS_STATUS) {
    if (this.currentStatus === status) return
    this.currentStatus = status
    this.statusListeners.forEach((listener) => listener(status))
  }

  public onStatusChange(callback: (_status: WS_STATUS) => void) {
    this.statusListeners.add(callback)
    callback(this.currentStatus)
    return () => this.statusListeners.delete(callback)
  }

  private updateConnectionId(newConnectionId: string) {
    this.connectionId = newConnectionId
    log('【WS】连接ID已更新:', newConnectionId)
    this.connectionIdListeners.forEach((listener) => listener(newConnectionId))
  }

  public onConnectionIdChange(callback: (_connectionId: string) => void) {
    this.connectionIdListeners.add(callback)
    return () => this.connectionIdListeners.delete(callback)
  }

  public getStatus() {
    return this.currentStatus
  }

  private wakeUpConnection() {
    this.updateStatus(WS_STATUS.CONNECTING)
    const idleTime = Date.now() - this.lastActiveTime
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || idleTime > this.maxIdleTimeInterval) {
      log(`【WS】检测到长时间不活跃(${Math.floor(idleTime / 1000)}秒)或连接断开，尝试重连`)
      this.reconnect()
    } else {
      log('【WS】唤醒检查：状态为OPEN，发送主动探测包验证链路有效性')
      this.triggerHeartbeatCheck()
    }
  }

  public connect() {
    if (this.ws) {
      this.closeConnection()
    }
    this.retryCount = 0
    this.initWebSocket()
  }

  public closeConnection() {
    this.clearAllTimers()
    this.teardownSocket()
    this.updateStatus(WS_STATUS.DISCONNECTED)
  }

  public getConnectionId() {
    return this.connectionId
  }

  public setConnectionFailureCallback(callback: () => Promise<boolean>) {
    this.connectionFailureCallback = callback
  }

  // 解绑事件并关闭当前连接，统一拆连接入口
  private teardownSocket() {
    if (!this.ws) return
    this.ws.onopen = null
    this.ws.onmessage = null
    this.ws.onclose = null
    this.ws.onerror = null
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close()
    }
    this.ws = null
  }

  // 无网络 / 正在连接时跳过重连，两条重连路径共用
  private cannotReconnectNow(): boolean {
    if (!this.checkNetworkStatus()) {
      log('【WS】当前无网络，等待网络恢复')
      return true
    }
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      log('【WS】正在连接中，忽略重复的重连请求')
      return true
    }
    return false
  }

  // 主动重连 (立即，重置退避)
  private reconnect() {
    if (this.cannotReconnectNow()) return
    log('【WS】主动执行重连...')
    this.clearAllTimers()
    this.teardownSocket()
    this.retryCount = 0
    this.initWebSocket()
  }

  // 被动退避重连 (用于异常断开)
  private async handleReconnect() {
    if (this.cannotReconnectNow()) return
    if (this.reconnectTimer) {
      log('【WS】已有重连任务在等待，忽略重复退避')
      return
    }
    let delay = this.minReconnectionDelay * Math.pow(1.5, this.retryCount)
    delay = Math.min(delay, this.maxReconnectionDelay)
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      log(`【WS】尝试重连... (次数:${this.retryCount + 1}) 延迟:${Math.floor(delay)}ms`)
      this.retryCount++
      if (
        this.retryCount === this.MAX_RETRIES_BEFORE_TOKEN_CHECK &&
        this.connectionFailureCallback
      ) {
        log('【WS】重试多次失败，检查 token')
        const tokenRefreshed = await this.connectionFailureCallback()
        if (tokenRefreshed) {
          log('【WS】Token 已刷新，重置计数器')
          this.retryCount = 0
          return
        }
      }
      this.initWebSocket()
    }, delay)
  }

  private checkNetworkStatus(): boolean {
    return navigator.onLine
  }

  private async initWebSocket() {
    try {
      this.updateStatus(WS_STATUS.CONNECTING)
      const wsUrl = await buildSignedWsUrl()
      if (!wsUrl) throw new Error('WebSocket URL未配置')
      this.teardownSocket()
      this.ws = new WebSocket(wsUrl)
      log('【WS】WebSocket实例已创建: ', this.ws)
      if (this.connectionTimeoutTimer) clearTimeout(this.connectionTimeoutTimer)
      this.connectionTimeoutTimer = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          log('【WS】连接超时未就绪，主动关闭并重连')
          this.ws.close()
        }
      }, this.connectionTimeout)
      this.setupWebSocketHandlers()
    } catch (error) {
      console.error('【WS】WebSocket初始化失败:', error)
      this.handleReconnect()
    }
  }

  private setupWebSocketHandlers() {
    if (!this.ws) return
    this.ws.onopen = (_event) => {
      this.updateStatus(WS_STATUS.CONNECTED)
      log('【WS】WebSocket连接成功', new Date().toLocaleString())
      if (this.connectionTimeoutTimer) {
        clearTimeout(this.connectionTimeoutTimer)
        this.connectionTimeoutTimer = null
      }
      this.retryCount = 0
      this.lastActiveTime = Date.now()
      this.startHeartbeat()
      this.processMessageQueue()
    }
    this.ws.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data.trim() === '') {
        return
      }
      try {
        const message = JSON.parse(event.data)
        log(`【WS 收到消息⬇${new Date().toLocaleString()}】`, message.action, message)
        this.lastActiveTime = Date.now()
        this.notifySubscribers(message)
      } catch (e) {
        console.error('【WS】消息解析失败:', e)
      }
    }
    this.ws.onclose = (event) => {
      this.updateStatus(WS_STATUS.DISCONNECTED)
      log('【WS】WebSocket连接关闭', event, new Date().toLocaleString())
      this.clearAllTimers()
      this.handleReconnect()
    }
    this.ws.onerror = (event) => {
      console.error('【WS】WebSocket错误:', event)
    }
  }

  // ---- 心跳防假死机制 ----
  private triggerHeartbeatCheck() {
    this.clearPongTimeout()
    this.sendMessage({ action: ACTION_TYPES.KEEP_ALIVE })
    this.pongTimeoutTimer = setTimeout(() => {
      log('【WS】心跳超时未响应，判定假死，尝试重连')
      this.reconnect()
    }, 3000)
  }

  private clearPongTimeout() {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer)
      this.pongTimeoutTimer = null
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.triggerHeartbeatCheck()
      }
    }, WS_HEARTBEAT_INTERVAL_MS)
    this.triggerHeartbeatCheck()
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    this.clearPongTimeout()
  }

  private clearAllTimers() {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer)
      this.connectionTimeoutTimer = null
    }
  }

  // ---- 消息分发与队列系统 ----
  subscribe(key: string, callback: Function) {
    this.subscribers.set(key, callback)
  }

  unsubscribe(key: string) {
    this.subscribers.delete(key)
  }

  private notifySubscribers(message: any) {
    const action = message.action
    if (this.subscribers.has(action)) {
      this.subscribers.get(action)!(message)
    } else {
      log(`【WS】 No subscriber for action: ${action}`)
    }
  }

  async sendMessage(message: any) {
    log(`【WS 发送消息⬆${new Date().toLocaleString()}】`, message.action, message)
    if (!this.checkNetworkStatus()) {
      console.error('【WS】当前无网络连接，消息发送失败')
      return
    }
    if (this.ws?.readyState !== WebSocket.OPEN) {
      const existingIndex = this.messageQueue.findIndex((msg) => msg.action === message.action)
      if (existingIndex !== -1) {
        this.messageQueue[existingIndex] = message
      } else {
        this.messageQueue.push(message)
      }
      log('【WS】WebSocket未连接，消息已加入队列')
      return
    }
    this.ws.send(JSON.stringify(message))
  }

  private async processMessageQueue() {
    if (this.messageQueue.length > 0) {
      log({ '【WS】检查队列消息': JSON.stringify(this.messageQueue) })
    }
    if (this.ws?.readyState !== WebSocket.OPEN) return
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue[0]
      try {
        await this.sendMessage(msg)
        this.messageQueue.shift()
      } catch (error) {
        console.error(`【WS】队列消息发送失败:`, error)
        break
      }
    }
  }
}

export default WebSocketManager.getInstance()
