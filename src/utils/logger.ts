import log from 'loglevel'

if (process.env.NODE_ENV === 'production') {
  log.setLevel('error')
} else {
  log.setLevel('debug')
}

export const logger = {
  trace: (...args: unknown[]): void => {
    log.trace(...args)
  },
  log: (...args: unknown[]): void => {
    log.debug(...args)
  },
  info: (...args: unknown[]): void => {
    log.info(...args)
  },
  error: (...args: unknown[]): void => {
    log.error(...args)
  },
  warn: (...args: unknown[]): void => {
    log.warn(...args)
  }
}
