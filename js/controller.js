/**
 * 控制器模块
 * 键盘映射、虚拟手柄（方向键 / 摇杆两种操作方式）、自定义按键绑定
 */

class Controller {
  constructor() {
    // JSNES 按键常量
    this.BUTTONS = {
      A: 0,
      B: 1,
      SELECT: 2,
      START: 3,
      UP: 4,
      DOWN: 5,
      LEFT: 6,
      RIGHT: 7
    };

    // 按钮名称映射
    this.BUTTON_NAMES = {
      [this.BUTTONS.A]: 'A',
      [this.BUTTONS.B]: 'B',
      [this.BUTTONS.SELECT]: 'Select',
      [this.BUTTONS.START]: 'Start',
      [this.BUTTONS.UP]: '上',
      [this.BUTTONS.DOWN]: '下',
      [this.BUTTONS.LEFT]: '左',
      [this.BUTTONS.RIGHT]: '右'
    };

    // 默认键盘映射
    this.defaultKeyMap = {
      // 方向键
      'ArrowUp': this.BUTTONS.UP,
      'ArrowDown': this.BUTTONS.DOWN,
      'ArrowLeft': this.BUTTONS.LEFT,
      'ArrowRight': this.BUTTONS.RIGHT,
      // WASD
      'KeyW': this.BUTTONS.UP,
      'KeyS': this.BUTTONS.DOWN,
      'KeyA': this.BUTTONS.LEFT,
      'KeyD': this.BUTTONS.RIGHT,
      // 功能键
      'KeyZ': this.BUTTONS.A,
      'KeyJ': this.BUTTONS.A,
      'KeyX': this.BUTTONS.B,
      'KeyK': this.BUTTONS.B,
      'Enter': this.BUTTONS.START,
      'ShiftRight': this.BUTTONS.SELECT,
      'ShiftLeft': this.BUTTONS.SELECT,
    };

    // 当前键盘映射（从localStorage加载或默认）
    this.keyMap = this.loadKeyMap();

    // 当前按下的按键
    this.pressedKeys = new Set();

    // 每个按钮被按住的计数（键盘与触屏可能同时按同一个键）
    this.buttonHolders = {};

    // 方向状态（触摸区域当前产生的方向）
    this.directionState = new Set();

    // 操作方式：dpad（方向键）/ joystick（摇杆）
    this.inputMode = this.loadInputMode();

    // 虚拟手柄元素
    this.gamepadElements = {};
    this._activePointers = {};

    // 是否已绑定
    this.bound = false;
    this._onKeyDownHandler = this._onKeyDown.bind(this);
    this._onKeyUpHandler = this._onKeyUp.bind(this);

    // 按键重映射状态
    this.isRemapping = false;
    this.remappingButton = null;
    this.remappingCallback = null;
  }

  // ==================== 按键映射 ====================

  /**
   * 从localStorage加载自定义按键映射
   */
  loadKeyMap() {
    try {
      const saved = localStorage.getItem('fc_keymap');
      if (saved) {
        const parsed = JSON.parse(saved);
        const validMap = {};
        for (const [code, button] of Object.entries(parsed)) {
          if (Object.values(this.BUTTONS).includes(button)) {
            validMap[code] = button;
          }
        }
        return { ...this.defaultKeyMap, ...validMap };
      }
    } catch (e) {
      console.warn('加载自定义按键映射失败:', e);
    }
    return { ...this.defaultKeyMap };
  }

  /**
   * 保存按键映射到localStorage
   */
  saveKeyMap() {
    try {
      localStorage.setItem('fc_keymap', JSON.stringify(this.keyMap));
    } catch (e) {
      console.warn('保存自定义按键映射失败:', e);
    }
  }

  /**
   * 重置为默认按键映射
   */
  resetKeyMap() {
    this.keyMap = { ...this.defaultKeyMap };
    this.saveKeyMap();
  }

  /**
   * 设置按键映射（用于自定义按键）
   */
  setKeyMapping(button, keyCode) {
    for (const [code, btn] of Object.entries(this.keyMap)) {
      if (btn === button) {
        delete this.keyMap[code];
      }
    }
    if (this.keyMap[keyCode] !== undefined) {
      delete this.keyMap[keyCode];
    }
    this.keyMap[keyCode] = button;
    this.saveKeyMap();
  }

  /**
   * 获取某个按钮当前绑定的按键列表
   */
  getKeysForButton(button) {
    return Object.entries(this.keyMap)
      .filter(([code, btn]) => btn === button)
      .map(([code]) => code);
  }

  /**
   * 开始按键重映射
   */
  startRemapping(button, callback) {
    this.isRemapping = true;
    this.remappingButton = button;
    this.remappingCallback = callback;

    const handler = (e) => {
      if (['F5', 'F7', 'F12', 'Tab', 'Escape', 'CapsLock'].includes(e.code)) {
        return;
      }
      if (e.code.startsWith('Control') || e.code.startsWith('Alt') || e.code.startsWith('Meta')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      this.setKeyMapping(button, e.code);
      this.isRemapping = false;
      this.remappingButton = null;

      if (this.remappingCallback) {
        this.remappingCallback(e.code);
        this.remappingCallback = null;
      }

      document.removeEventListener('keydown', handler, true);
      document.removeEventListener('keydown', cancelHandler, true);
    };

    const cancelHandler = (e) => {
      if (e.code === 'Escape') {
        this.isRemapping = false;
        this.remappingButton = null;
        if (this.remappingCallback) {
          this.remappingCallback(null);
          this.remappingCallback = null;
        }
        document.removeEventListener('keydown', handler, true);
        document.removeEventListener('keydown', cancelHandler, true);
      }
    };

    document.addEventListener('keydown', handler, true);
    document.addEventListener('keydown', cancelHandler, true);
  }

  // ==================== 键盘 ====================

  /**
   * 绑定键盘事件
   */
  bind() {
    if (this.bound) return;

    document.addEventListener('keydown', this._onKeyDownHandler);
    document.addEventListener('keyup', this._onKeyUpHandler);

    // 阻止默认行为（防止方向键滚动页面等）
    document.addEventListener('keydown', (e) => {
      const preventKeys = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Space', 'Enter'
      ];
      const tag = document.activeElement && document.activeElement.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (preventKeys.includes(e.code) && !isTyping) {
        e.preventDefault();
      }
    }, { passive: false });

    this.bound = true;
  }

  /**
   * 解绑键盘事件
   */
  unbind() {
    document.removeEventListener('keydown', this._onKeyDownHandler);
    document.removeEventListener('keyup', this._onKeyUpHandler);
    this.bound = false;
  }

  /**
   * 键盘按下处理
   */
  _onKeyDown(e) {
    if (this.isRemapping) return;

    const tag = e.target && e.target.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (isTyping) return;

    if (this.pressedKeys.has(e.code)) return;

    const button = this.keyMap[e.code];
    if (button !== undefined) {
      e.preventDefault();
      this.pressedKeys.add(e.code);
      this.pressButton(button);
    }

    if (e.code === 'F5') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('fc:quicksave'));
    }
    if (e.code === 'F7') {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('fc:quickload'));
    }
  }

  /**
   * 键盘释放处理
   */
  _onKeyUp(e) {
    if (this.isRemapping) return;

    const button = this.keyMap[e.code];
    if (button !== undefined) {
      e.preventDefault();
      this.pressedKeys.delete(e.code);
      this.releaseButton(button);
    }
  }

  /**
   * 释放所有按键（用于失焦时）
   */
  releaseAll() {
    this.pressedKeys.clear();
    this.buttonHolders = {};
    this.directionState.clear();
    for (let b = 0; b <= 7; b++) {
      emulator.buttonUp(b);
    }
    this._updateDpadVisual(new Set());
    this._resetJoystickVisual();
  }

  // ==================== 按钮引用计数 ====================

  /**
   * 按下按钮（多个来源同时按住时只在第一次真正按下）
   */
  pressButton(button) {
    const count = this.buttonHolders[button] || 0;
    this.buttonHolders[button] = count + 1;
    if (count === 0) {
      emulator.buttonDown(button);
      this._highlightButton(button, true);
    }
  }

  /**
   * 释放按钮
   */
  releaseButton(button) {
    const count = this.buttonHolders[button] || 0;
    if (count <= 1) {
      delete this.buttonHolders[button];
      emulator.buttonUp(button);
      this._highlightButton(button, false);
    } else {
      this.buttonHolders[button] = count - 1;
    }
  }

  /**
   * 重新应用当前按住的状态（读档/暂停恢复后调用）
   */
  reapplyHeld() {
    for (const key of Object.keys(this.buttonHolders)) {
      if (this.buttonHolders[key] > 0) {
        emulator.buttonDown(parseInt(key, 10));
      }
    }
  }

  /**
   * 键盘按键时高亮虚拟手柄对应按钮（桌面端也能看到反馈）
   */
  _highlightButton(button, pressed) {
    const map = {
      [this.BUTTONS.A]: 'gpA',
      [this.BUTTONS.B]: 'gpB',
      [this.BUTTONS.START]: 'gpStart',
      [this.BUTTONS.SELECT]: 'gpSelect'
    };
    const id = map[button];
    if (id && this.gamepadElements[id]) {
      this.gamepadElements[id].classList.toggle('pressed', pressed);
    }
  }

  // ==================== 操作方式 ====================

  loadInputMode() {
    try {
      const saved = localStorage.getItem('fc_input_mode');
      if (saved === 'joystick' || saved === 'dpad') return saved;
    } catch (e) { /* 忽略 */ }
    return 'dpad';
  }

  /**
   * 切换操作方式：dpad / joystick
   */
  setInputMode(mode) {
    this.inputMode = mode === 'joystick' ? 'joystick' : 'dpad';
    try {
      localStorage.setItem('fc_input_mode', this.inputMode);
    } catch (e) { /* 忽略 */ }

    document.body.classList.toggle('mode-joystick', this.inputMode === 'joystick');
    document.body.classList.toggle('mode-dpad', this.inputMode === 'dpad');

    // 切换时松开方向，避免卡键
    this._setDirectionState({});
    this._resetJoystickVisual();
    this.emitInputMode();
  }

  emitInputMode() {
    document.dispatchEvent(new CustomEvent('fc:inputmode', {
      detail: { mode: this.inputMode }
    }));
  }

  cycleInputMode() {
    this.setInputMode(this.inputMode === 'dpad' ? 'joystick' : 'dpad');
    return this.inputMode;
  }

  // ==================== 虚拟手柄 ====================

  /**
   * 设置虚拟手柄元素
   */
  setGamepadElements(elements) {
    this.gamepadElements = elements;
    this._bindGamepadEvents();
  }

  /**
   * 绑定虚拟手柄事件
   */
  _bindGamepadEvents() {
    const el = this.gamepadElements;

    // 方向区：整块区域统一处理，手指滑动可平滑切换方向
    if (el.dpadZone) {
      this._bindDirectionZone(el.dpadZone, { joystick: false });
    }
    if (el.joystickZone) {
      this._bindDirectionZone(el.joystickZone, { joystick: true });
    }

    // 按钮
    const buttons = {
      gpSelect: this.BUTTONS.SELECT,
      gpStart: this.BUTTONS.START,
      gpA: this.BUTTONS.A,
      gpB: this.BUTTONS.B
    };
    for (const [id, button] of Object.entries(buttons)) {
      if (el[id]) this._bindHoldButton(el[id], button);
    }
  }

  /**
   * 为单个虚拟按钮绑定按下/抬起（Pointer Events，支持多指）
   */
  _bindHoldButton(element, button) {
    let pointerId = null;

    const press = (e) => {
      if (pointerId !== null) return;
      e.preventDefault();
      pointerId = e.pointerId;
      try { element.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      element.classList.add('pressed');
      this.pressButton(button);
    };

    const release = (e) => {
      if (pointerId === null) return;
      if (e && e.pointerId !== undefined && e.pointerId !== pointerId) return;
      pointerId = null;
      element.classList.remove('pressed');
      this.releaseButton(button);
    };

    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
    // 鼠标移出后松开（指针捕获失效时的兜底）
    element.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') release(e);
    });
  }

  /**
   * 绑定方向区域（方向键区 / 摇杆区通用）
   * 根据触点相对中心的位置计算 4 向或 8 向
   */
  _bindDirectionZone(zone, opts) {
    const knob = this.gamepadElements.joystickKnob;
    const useJoystick = opts && opts.joystick;
    const state = { pointerId: null };

    const handle = (e) => {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = Math.min(rect.width, rect.height) / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;

      const dist = Math.hypot(dx, dy);
      // 摇杆可视化：旋钮跟随手指，限制在半径内
      if (useJoystick && knob) {
        const max = radius * 0.62;
        const k = dist > max ? max / dist : 1;
        knob.style.transform =
          `translate(-50%, -50%) translate(${(dx * k).toFixed(1)}px, ${(dy * k).toFixed(1)}px)`;
      }

      // 死区：摇杆略小，方向键区略大（避免误触斜向）
      const dead = radius * (useJoystick ? 0.22 : 0.28);
      if (dist < dead) {
        this._setDirectionState({});
        return;
      }

      const nx = dx / dist;
      const ny = dy / dist;
      const threshold = useJoystick ? 0.4 : 0.58;

      this._setDirectionState({
        up: ny < -threshold,
        down: ny > threshold,
        left: nx < -threshold,
        right: nx > threshold
      });
    };

    const down = (e) => {
      if (state.pointerId !== null) return;
      e.preventDefault();
      state.pointerId = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      zone.classList.add('active');
      handle(e);
    };

    const move = (e) => {
      if (e.pointerId !== state.pointerId) return;
      e.preventDefault();
      handle(e);
    };

    const up = (e) => {
      if (state.pointerId === null) return;
      if (e && e.pointerId !== undefined && e.pointerId !== state.pointerId) return;
      state.pointerId = null;
      zone.classList.remove('active');
      this._setDirectionState({});
      if (useJoystick) this._resetJoystickVisual();
    };

    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
    zone.addEventListener('lostpointercapture', up);
  }

  /**
   * 设置方向状态（只发送变化的按键）
   */
  _setDirectionState(dirs) {
    const next = new Set();
    if (dirs.up) next.add(this.BUTTONS.UP);
    if (dirs.down) next.add(this.BUTTONS.DOWN);
    if (dirs.left) next.add(this.BUTTONS.LEFT);
    if (dirs.right) next.add(this.BUTTONS.RIGHT);

    for (const button of next) {
      if (!this.directionState.has(button)) this.pressButton(button);
    }
    for (const button of this.directionState) {
      if (!next.has(button)) this.releaseButton(button);
    }

    this.directionState = next;
    this._updateDpadVisual(next);
  }

  /**
   * 方向键高亮
   */
  _updateDpadVisual(dirSet) {
    const map = {
      dpadUp: this.BUTTONS.UP,
      dpadDown: this.BUTTONS.DOWN,
      dpadLeft: this.BUTTONS.LEFT,
      dpadRight: this.BUTTONS.RIGHT
    };
    for (const [id, button] of Object.entries(map)) {
      const el = this.gamepadElements[id];
      if (el) el.classList.toggle('pressed', dirSet.has(button));
    }
  }

  /**
   * 摇杆旋钮回中
   */
  _resetJoystickVisual() {
    const knob = this.gamepadElements.joystickKnob;
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  }

  // ==================== 显示名称 ====================

  getKeyDisplayName(code) {
    const displayNames = {
      'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
      'KeyW': 'W', 'KeyS': 'S', 'KeyA': 'A', 'KeyD': 'D',
      'KeyZ': 'Z', 'KeyJ': 'J', 'KeyX': 'X', 'KeyK': 'K',
      'Enter': 'Enter', 'ShiftRight': 'Shift', 'ShiftLeft': 'Shift', 'Space': '空格',
      'KeyQ': 'Q', 'KeyE': 'E', 'KeyR': 'R', 'KeyT': 'T', 'KeyY': 'Y',
      'KeyU': 'U', 'KeyI': 'I', 'KeyO': 'O', 'KeyP': 'P',
      'KeyF': 'F', 'KeyG': 'G', 'KeyH': 'H', 'KeyL': 'L',
      'KeyC': 'C', 'KeyV': 'V', 'KeyB': 'B', 'KeyN': 'N', 'KeyM': 'M',
      'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
      'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0',
      'Backspace': '退格', 'Backquote': '`', 'Minus': '-', 'Equal': '=',
      'BracketLeft': '[', 'BracketRight': ']', 'Backslash': '\\',
      'Semicolon': ';', 'Quote': "'", 'Comma': ',', 'Period': '.', 'Slash': '/',
      'Numpad1': '小键盘1', 'Numpad2': '小键盘2', 'Numpad3': '小键盘3',
      'Numpad4': '小键盘4', 'Numpad5': '小键盘5', 'Numpad6': '小键盘6',
      'Numpad7': '小键盘7', 'Numpad8': '小键盘8', 'Numpad9': '小键盘9',
      'Numpad0': '小键盘0', 'NumpadEnter': '小键盘Enter',
      'NumpadAdd': '小键盘+', 'NumpadSubtract': '小键盘-',
      'NumpadMultiply': '小键盘*', 'NumpadDivide': '小键盘/',
      'NumpadDecimal': '小键盘.',
    };
    return displayNames[code] || code;
  }
}

// 导出单例
const controller = new Controller();
