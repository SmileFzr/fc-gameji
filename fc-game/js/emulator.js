/**
 * 模拟器核心模块
 * 封装 JSNES，管理Canvas渲染、音频、帧率控制
 */

class Emulator {
  constructor() {
    this.nes = null;
    this.canvas = null;
    this.ctx = null;
    this.imageData = null;
    this.animationId = null;
    this.isRunning = false;
    this.isPaused = false;
    this.frameCount = 0;
    this.fps = 0;
    this.lastFpsTime = 0;
    this.frameCallback = null;
    this.listeners = [];
  }

  /**
   * 初始化模拟器
   */
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.imageData = this.ctx.createImageData(256, 240);
    
    // 初始化JSNES实例
    this.nes = new jsnes.NES({
      onFrame: (buffer) => this.onFrame(buffer)
    });
  }

  /**
   * 加载ROM并启动
   */
  loadROM(romData) {
    if (!this.nes) {
      throw new Error('模拟器未初始化，请先调用init()');
    }

    // 停止当前运行
    this.stop();

    try {
      // 将Uint8Array转换为字符串（JSNES要求的格式）
      let romString = '';
      for (let i = 0; i < romData.length; i++) {
        romString += String.fromCharCode(romData[i]);
      }

      this.nes.loadROM(romString);
      this.start();
      this.emit('started');
      return true;
    } catch (err) {
      this.emit('error', 'ROM加载失败: ' + err.message);
      return false;
    }
  }

  /**
   * 帧渲染回调
   */
  onFrame(buffer) {
    // 将JSNES的帧缓冲写入ImageData
    const data = this.imageData.data;
    for (let i = 0; i < buffer.length; i++) {
      const pixel = buffer[i];
      const offset = i * 4;
      // JSNES输出的是32位颜色值
      data[offset] = pixel & 0xFF;         // R
      data[offset + 1] = (pixel >> 8) & 0xFF;  // G
      data[offset + 2] = (pixel >> 16) & 0xFF; // B
      data[offset + 3] = 0xFF;             // A
    }

    // 渲染到Canvas
    this.ctx.putImageData(this.imageData, 0, 0);

    // FPS计算
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
      this.emit('fps', this.fps);
    }

    // 外部帧回调
    if (this.frameCallback) {
      this.frameCallback();
    }
  }

  /**
   * 设置每帧回调
   */
  onFrameCallback(callback) {
    this.frameCallback = callback;
  }

  /**
   * 启动模拟器循环
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();

    // 使用requestAnimationFrame驱动的帧循环
    const frameDuration = 1000 / 60; // 约16.67ms (60fps)
    let lastFrameTime = performance.now();
    let accumulatedTime = 0;

    const loop = (timestamp) => {
      if (!this.isRunning) return;

      if (!this.isPaused) {
        accumulatedTime += timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        // 追赶帧（如果落后太多，限制追赶量防止螺旋）
        const maxCatchUp = frameDuration * 3;
        if (accumulatedTime > maxCatchUp) {
          accumulatedTime = maxCatchUp;
        }

        while (accumulatedTime >= frameDuration) {
          this.nes.frame();
          accumulatedTime -= frameDuration;
        }
      } else {
        lastFrameTime = timestamp;
      }

      this.animationId = requestAnimationFrame(loop);
    };

    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * 停止模拟器
   */
  stop() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 暂停
   */
  pause() {
    this.isPaused = true;
    this.emit('paused');
  }

  /**
   * 恢复
   */
  resume() {
    this.isPaused = false;
    this.emit('resumed');
  }

  /**
   * 切换暂停
   */
  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this.isPaused;
  }

  /**
   * 重置游戏
   */
  reset() {
    if (!this.nes || !this.isRunning) return;
    this.nes.reset();
    this.emit('reset');
  }

  /**
   * 按键按下
   */
  buttonDown(button) {
    if (!this.nes || !this.isRunning || this.isPaused) return;
    this.nes.buttonDown(1, button);
  }

  /**
   * 按键释放
   */
  buttonUp(button) {
    if (!this.nes || !this.isRunning || this.isPaused) return;
    this.nes.buttonUp(1, button);
  }

  /**
   * 获取存档状态（序列化）
   */
  getState() {
    if (!this.nes) return null;
    try {
      return this.nes.toJSON();
    } catch (e) {
      console.error('获取存档状态失败:', e);
      return null;
    }
  }

  /**
   * 恢复存档状态
   */
  loadState(state) {
    if (!this.nes) return false;
    try {
      this.nes.fromJSON(state);
      // 恢复后需要先渲染一帧
      this.nes.frame();
      return true;
    } catch (e) {
      console.error('恢复存档状态失败:', e);
      return false;
    }
  }

  /**
   * 获取当前Canvas截图（Data URL）
   */
  getScreenshot() {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }

  /**
   * 获取当前Canvas截图（小缩略图Data URL）
   */
  getThumbnail() {
    if (!this.canvas) return null;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 128;
    thumbCanvas.height = 120;
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.imageSmoothingEnabled = false;
    thumbCtx.drawImage(this.canvas, 0, 0, 128, 120);
    return thumbCanvas.toDataURL('image/png');
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
const emulator = new Emulator();
