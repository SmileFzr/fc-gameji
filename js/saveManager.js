/**
 * 存档管理模块
 * 使用 IndexedDB 存储存档数据，支持多槽位、截图预览
 */

class SaveManager {
  constructor() {
    this.db = null;
    this.dbName = 'FCGameSaves';
    this.dbVersion = 1;
    this.maxSlots = 10;
    this.currentGameHash = null;
    this.listeners = [];
  }

  /**
   * 初始化数据库
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB 初始化失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建存档存储
        if (!db.objectStoreNames.contains('saves')) {
          const store = db.createObjectStore('saves', { keyPath: 'id' });
          store.createIndex('gameHash', 'gameHash', { unique: false });
          store.createIndex('slot', 'slot', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 创建游戏信息存储
        if (!db.objectStoreNames.contains('games')) {
          const gameStore = db.createObjectStore('games', { keyPath: 'hash' });
          gameStore.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  /**
   * 设置当前游戏
   */
  setCurrentGame(romInfo) {
    if (!romInfo) {
      this.currentGameHash = null;
      return;
    }
    this.currentGameHash = romInfo.hash;

    // 保存游戏信息
    this.saveGameInfo(romInfo);
  }

  /**
   * 保存游戏信息
   */
  async saveGameInfo(romInfo) {
    if (!this.db) return;

    const tx = this.db.transaction('games', 'readwrite');
    const store = tx.objectStore('games');
    store.put({
      hash: romInfo.hash,
      name: romInfo.name,
      mapper: romInfo.mapper,
      lastPlayed: Date.now()
    });
  }

  /**
   * 快速存档（到槽位0）
   */
  async quickSave(state, screenshot) {
    return this.saveToSlot(0, state, screenshot, '快速存档');
  }

  /**
   * 快速读档（从槽位0）
   */
  async quickLoad() {
    return this.loadFromSlot(0);
  }

  /**
   * 存档到指定槽位
   */
  async saveToSlot(slot, state, screenshot, label = '') {
    if (!this.db || !this.currentGameHash) {
      throw new Error('存档系统未就绪');
    }

    if (slot < 0 || slot >= this.maxSlots) {
      throw new Error(`槽位必须在 0-${this.maxSlots - 1} 之间`);
    }

    const saveData = {
      id: `${this.currentGameHash}_${slot}`,
      gameHash: this.currentGameHash,
      slot: slot,
      state: state,
      screenshot: screenshot || null,
      label: label || `存档 ${slot + 1}`,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('saves', 'readwrite');
      const store = tx.objectStore('saves');
      const request = store.put(saveData);

      request.onsuccess = () => {
        this.emit('saved', { slot, saveData });
        resolve(saveData);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 从指定槽位读档
   */
  async loadFromSlot(slot) {
    if (!this.db || !this.currentGameHash) {
      throw new Error('存档系统未就绪');
    }

    const id = `${this.currentGameHash}_${slot}`;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('saves', 'readonly');
      const store = tx.objectStore('saves');
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          this.emit('loaded', { slot, saveData: request.result });
          resolve(request.result);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 获取当前游戏的所有存档
   */
  async getAllSaves() {
    if (!this.db || !this.currentGameHash) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('saves', 'readonly');
      const store = tx.objectStore('saves');
      const index = store.index('gameHash');
      const request = index.getAll(this.currentGameHash);

      request.onsuccess = () => {
        const saves = request.result || [];
        // 构建完整的槽位列表
        const allSlots = [];
        for (let i = 0; i < this.maxSlots; i++) {
          const save = saves.find(s => s.slot === i);
          allSlots.push({
            slot: i,
            empty: !save,
            data: save || null
          });
        }
        resolve(allSlots);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 删除存档
   */
  async deleteSave(slot) {
    if (!this.db || !this.currentGameHash) return;

    const id = `${this.currentGameHash}_${slot}`;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('saves', 'readwrite');
      const store = tx.objectStore('saves');
      const request = store.delete(id);

      request.onsuccess = () => {
        this.emit('deleted', { slot });
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 导出存档为JSON
   */
  async exportSaves() {
    const saves = await this.getAllSaves();
    const nonEmpty = saves.filter(s => !s.empty);
    
    const exportData = {
      version: 1,
      gameHash: this.currentGameHash,
      exportedAt: Date.now(),
      saves: nonEmpty.map(s => ({
        slot: s.slot,
        label: s.data.label,
        state: s.data.state,
        timestamp: s.data.timestamp
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入存档JSON
   */
  async importSaves(jsonString) {
    try {
      const importData = JSON.parse(jsonString);
      
      if (!importData.version || !importData.saves) {
        throw new Error('无效的存档文件格式');
      }

      let imported = 0;
      for (const save of importData.saves) {
        await this.saveToSlot(save.slot, save.state, null, save.label);
        imported++;
      }

      return imported;
    } catch (err) {
      throw new Error('存档导入失败: ' + err.message);
    }
  }

  /**
   * 获取所有游戏列表
   */
  async getAllGames() {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('games', 'readonly');
      const store = tx.objectStore('games');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 事件监听
   */
  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  emit(event, data) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback(data));
  }
}

// 导出单例
const saveManager = new SaveManager();
