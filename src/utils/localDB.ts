import localforage from 'localforage'

/**
 * LocalDB - 基于 localforage 的本地存储封装
 */
export class LocalDB {
  private store: LocalForage

  constructor(dbName = 'candyhouseAI', storeName = 'fileStore') {
    this.store = localforage.createInstance({
      name: dbName,
      storeName,
      description: 'Local storage for chat files and data',
      driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE]
    })
  }

  /**
   * 存储数据
   */
  async set<T>(key: string, value: T): Promise<void> {
    await this.store.setItem(key, value)
  }

  /**
   * 获取数据
   */
  async get<T>(key: string): Promise<T | null> {
    return await this.store.getItem<T>(key)
  }

  /**
   * 删除指定数据
   */
  async remove(key: string): Promise<void> {
    await this.store.removeItem(key)
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    await this.store.clear()
  }

  /**
   * 获取所有键名
   */
  async keys(): Promise<string[]> {
    return await this.store.keys()
  }

  /**
   * 获取存储项数量
   */
  async length(): Promise<number> {
    return await this.store.length()
  }

  /**
   * 计算存储总大小（字节）
   */
  async getSize(): Promise<number> {
    let totalSize = 0
    await this.store.iterate((value) => {
      totalSize += new Blob([JSON.stringify(value)]).size
    })
    return totalSize
  }

  /**
   * 检查键是否存在
   */
  async has(key: string): Promise<boolean> {
    const value = await this.store.getItem(key)
    return value !== null
  }

  /**
   * 遍历所有数据
   */
  async forEach<T>(callback: (value: T, key: string, index: number) => void): Promise<void> {
    await this.store.iterate(callback)
  }
}

export const db = new LocalDB()
