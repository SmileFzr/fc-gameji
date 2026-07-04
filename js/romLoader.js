/**
 * ROM加载器模块
 * 负责：文件导入、拖拽、iNES格式验证、Mapper检测
 */

class RomLoader {
  constructor() {
    this.romData = null;
    this.romInfo = null;
    this.listeners = [];
  }

  /**
   * 监听事件
   */
  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback(data));
  }

  /**
   * 通过文件选择器加载
   */
  async loadFromFile(file) {
    if (!file) return;

    // 扩展名检查
    if (!file.name.toLowerCase().endsWith('.nes')) {
      this.emit('error', '请选择 .nes 格式的 ROM 文件');
      return;
    }

    try {
      this.emit('loading', file.name);

      const arrayBuffer = await file.arrayBuffer();
      const romData = new Uint8Array(arrayBuffer);

      // 验证iNES格式
      const validation = this.validateINES(romData);
      if (!validation.valid) {
        this.emit('error', validation.error);
        return;
      }

      this.romData = romData;
      this.romInfo = {
        name: file.name.replace(/\.nes$/i, ''),
        size: file.size,
        ...validation.info
      };

      this.emit('loaded', {
        romData: this.romData,
        romInfo: this.romInfo
      });

    } catch (err) {
      this.emit('error', 'ROM 文件读取失败: ' + err.message);
    }
  }

  /**
   * 验证iNES文件格式
   */
  validateINES(data) {
    if (data.length < 16) {
      return { valid: false, error: '文件太小，不是有效的NES ROM' };
    }

    // 检查NES文件头标识
    const header = String.fromCharCode(...data.slice(0, 4));
    if (header !== 'NES\x1a') {
      return { valid: false, error: '无效的NES文件格式（缺少NES文件头标识）' };
    }

    const prgSize = data[4];     // PRG ROM大小（16KB为单位）
    const chrSize = data[5];     // CHR ROM大小（8KB为单位）
    const flags6 = data[6];      // 标志字节6
    const flags7 = data[7];      // 标志字节7
    const flags8 = data[8];      // PRG RAM大小
    const flags9 = data[9];      // TV系统

    // 解析Mapper编号
    const mapperLow = (flags6 >> 4) & 0x0F;
    const mapperHigh = flags7 & 0xF0;
    const mapper = mapperLow | mapperHigh;

    // 镜像模式
    const mirrorVertical = (flags6 & 0x01) === 1;
    const fourScreen = (flags6 & 0x08) !== 0;
    const mirrorMode = fourScreen ? '四屏' : (mirrorVertical ? '垂直' : '水平');

    // 是否有Trainer
    const hasTrainer = (flags6 & 0x04) !== 0;

    // SRAM（电池存档）
    const hasSRAM = (flags6 & 0x02) !== 0;

    // TV系统
    const tvSystem = (flags9 & 0x01) ? 'PAL' : 'NTSC';

    // 验证ROM大小
    const expectedSize = 16 + (hasTrainer ? 512 : 0) + prgSize * 16384 + chrSize * 8192;
    if (data.length < expectedSize) {
      return { 
        valid: false, 
        error: `ROM数据不完整（期望${expectedSize}字节，实际${data.length}字节）` 
      };
    }

    // 计算ROM的哈希（用于存档关联）
    const hash = this.computeHash(data);

    return {
      valid: true,
      info: {
        prgSize,
        chrSize,
        mapper,
        mirrorMode,
        hasTrainer,
        hasSRAM,
        tvSystem,
        hash
      }
    };
  }

  /**
   * 简单哈希函数（用于存档关联）
   */
  computeHash(data) {
    let hash = 0;
    const len = Math.min(data.length, 65536); // 只取前64KB
    for (let i = 0; i < len; i++) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * 获取当前ROM信息
   */
  getRomInfo() {
    return this.romInfo;
  }

  /**
   * 获取ROM数据
   */
  getRomData() {
    return this.romData;
  }

  /**
   * 检查是否有ROM加载
   */
  hasRom() {
    return this.romData !== null;
  }
}

// 导出单例
const romLoader = new RomLoader();
