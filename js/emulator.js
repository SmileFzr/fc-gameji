/**
 * 模拟器核心模块
 * 封装 JSNES，管理Canvas渲染、音频输出、帧率控制
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

    // ===== 音频状态 =====
    this.audioCtx = null;
    this.audioGain = null;
    this.audioNode = null;
    this.audioSampleRate = 44100;
    this.audioSupported = false;
    this.muted = false;
    this.volume = 0.7;

    // 环形缓冲（容纳约 0.36s 的 48kHz 采样）
    this.RING_SIZE = 16384;
    this.RING_MASK = this.RING_SIZE - 1;
    this.MAX_BUFFERED = 6144; // 最多缓冲约 128ms，超出则丢弃最旧样本
    this.ringL = null;
    this.ringR = null;
    this.ringRead = 0;
    this.ringWrite = 0;
    this.ringCount = 0;

    // 像素写入优化
    this.pixels32 = null;
    this.littleEndian = true;
  }

  /**
   * 初始化模拟器
   */
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.imageData = this.ctx.createImageData(256, 240);

    // 检测字节序，决定是否用 Uint32 快速写入像素
    const probe = new Uint32Array(new Uint8Array([1, 0, 0, 0]).buffer)[0];
    this.littleEndian = probe === 1;
    this.pixels32 = this.littleEndian ? new Uint32Array(this.imageData.data.buffer) : null;

    // 先建音频上下文，才能拿到真实采样率给 JSNES
    this.initAudio();

    const options = {
      onFrame: (buffer) => this.onFrame(buffer),
      sampleRate: this.audioSampleRate,
      preferredFrameRate: 60
    };
    if (this.audioSupported) {
      options.onAudioSample = (left, right) => this.onAudioSample(left, right);
    }

    this.nes = new jsnes.NES(options);
  }

  // ==================== 音频 ====================

  /**
   * 创建音频上下文与输出节点（浏览器要求用户交互后才能出声，这里只创建不播放）
   */
  initAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      this.audioSupported = false;
      return false;
    }

    try {
      this.audioCtx = new AudioCtx();
      this.audioSampleRate = this.audioCtx.sampleRate || 44100;

      this.ringL = new Float32Array(this.RING_SIZE);
      this.ringR = new Float32Array(this.RING_SIZE);

      this.audioGain = this.audioCtx.createGain();
      this.audioGain.gain.value = this.muted ? 0 : this.volume;
      this.audioGain.connect(this.audioCtx.destination);

      // ScriptProcessor 兼容性最好（AudioWorklet 需要额外文件）
      this.audioNode = this.audioCtx.createScriptProcessor(2048, 0, 2);
      this.audioNode.onaudioprocess = (e) => this.processAudio(e);
      this.audioNode.connect(this.audioGain);

      this.audioSupported = true;
      return true;
    } catch (err) {
      console.warn('音频初始化失败，将静音运行:', err);
      this.audioSupported = false;
      return false;
    }
  }

  /**
   * JSNES 每个采样点回调（-1 ~ 1 的浮点）
   */
  onAudioSample(left, right) {
    if (!this.ringL) return;

    // 缓冲过多时丢弃最旧样本，防止延迟越积越大
    if (this.ringCount >= this.MAX_BUFFERED) {
      this.ringRead = (this.ringRead + 1) & this.RING_MASK;
      this.ringCount--;
    }

    this.ringL[this.ringWrite] = left;
    this.ringR[this.ringWrite] = right;
    this.ringWrite = (this.ringWrite + 1) & this.RING_MASK;
    this.ringCount++;
  }

  /**
   * 把环形缓冲喂给扬声器
   */
  processAudio(e) {
    const outL = e.outputBuffer.getChannelData(0);
    const outR = e.outputBuffer.getChannelData(1);
    const need = outL.length;
    const avail = Math.min(this.ringCount, need);

    for (let i = 0; i < avail; i++) {
      outL[i] = this.ringL[this.ringRead];
      outR[i] = this.ringR[this.ringRead];
      this.ringRead = (this.ringRead + 1) & this.RING_MASK;
    }
    this.ringCount -= avail;

    // 欠载补静音
    for (let i = avail; i < need; i++) {
      outL[i] = 0;
      outR[i] = 0;
    }
  }

  /**
   * 清空缓冲（切歌/恢复播放时避免播放旧声音）
   */
  clearAudioBuffer() {
    this.ringRead = 0;
    this.ringWrite = 0;
    this.ringCount = 0;
  }

  /**
   * 在用户手势中恢复音频（浏览器自动播放策略）
   */
  resumeAudio() {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => this.clearAudioBuffer()).catch(() => {});
    }
  }

  /**
   * 静音开关
   */
  setMuted(muted) {
    this.muted = !!muted;
    if (this.audioGain) {
      const now = this.audioCtx.currentTime;
      this.audioGain.gain.cancelScheduledValues(now);
      this.audioGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, now, 0.02);
    }
    if (!this.muted) this.resumeAudio();
    this.emit('audio', { muted: this.muted, volume: this.volume });
  }

  /**
   * 音量（0 ~ 1）
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    if (this.audioGain) {
      const now = this.audioCtx.currentTime;
      this.audioGain.gain.cancelScheduledValues(now);
      this.audioGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, now, 0.02);
    }
    this.emit('audio', { muted: this.muted, volume: this.volume });
  }

  isAudioSupported() {
    return this.audioSupported;
  }

  // ==================== ROM 与帧循环 ====================

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
      this.clearAudioBuffer();
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
    if (this.pixels32 && this.pixels32.length >= buffer.length) {
      // 快速路径：一次性写入 32 位像素（ARGB 小端序 = ABGR 字节序）
      const pixels = this.pixels32;
      for (let i = 0; i < buffer.length; i++) {
        const p = buffer[i];
        pixels[i] = 0xff000000 |
          ((p & 0xff) << 16) |
          (p & 0xff00) |
          ((p >> 16) & 0xff);
      }
    } else {
      const data = this.imageData.data;
      for (let i = 0; i < buffer.length; i++) {
        const pixel = buffer[i];
        const offset = i * 4;
        data[offset] = pixel & 0xff;
        data[offset + 1] = (pixel >> 8) & 0xff;
        data[offset + 2] = (pixel >> 16) & 0xff;
        data[offset + 3] = 0xff;
      }
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
    this.resumeAudio();
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
      this.clearAudioBuffer();
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
