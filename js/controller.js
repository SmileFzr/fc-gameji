/**
 * 控制器模块
 * 键盘映射、虚拟手柄、自定义按键绑定
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

    // 手柄按键元素映射
    this.gamepadElements = {};

    // 是否已绑定
    this.bound = false;

    // 按键重映射状态
    this.isRemapping = false;
    this.remappingButton = null;
    this.remappingCallback = null;
  }

  /**
   * 从localStorage加载自定义按键映射
   */
  loadKeyMap() {
    try {
      const saved = localStorage.getItem('fc_keymap');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 验证所有值是否有效
        const validMap = {};
        for (const [code, button] of Object.entries(parsed)) {
          if (Object.values(this.BUTTONS).includes(button)) {
            validMap[code] = button;
          }
        }
        // 合并默认值和自定义值
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
    // 移除该按钮之前的映射（避免重复）
    for (const [code, btn] of Object.entries(this.keyMap)) {
      if (btn === button) {
        delete this.keyMap[code];
      }
    }
    // 如果新按键已被其他按钮使用，移除旧映射
    if (this.keyMap[keyCode] !== undefined) {
      delete this.keyMap[keyCode];
    }
    // 设置新映射
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

    // 添加一次性按键监听
    const handler = (e) => {
      // 忽略功能键和修饰键
      if (['F5', 'F7', 'F12', 'Tab', 'Escape', 'CapsLock'].includes(e.code)) {
        return;
      }
      // 忽略纯修饰键
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
    };

    document.addEventListener('keydown', handler, true);

    // 取消重映射（按Escape）
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
    document.addEventListener('keydown', cancelHandler, true);
  }

  /**
   * 绑定键盘事件
   */
  bind() {
    if (this.bound) return;

    document.addEventListener('keydown', this._onKeyDown.bind(this));
    document.addEventListener('keyup', this._onKeyUp.bind(this));

    // 阻止默认行为（防止方向键滚动页面等）
    document.addEventListener('keydown', (e) => {
      const preventKeys = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Space', 'Enter'
      ];
      if (preventKeys.includes(e.code) && document.activeElement === document.body) {
        e.preventDefault();
      }
    });

    this.bound = true;
  }

  /**
   * 解绑键盘事件
   */
  unbind() {
    document.removeEventListener('keydown', this._onKeyDown.bind(this));
    document.removeEventListener('keyup', this._onKeyUp.bind(this));
    this.bound = false;
  }

  /**
   * 键盘按下处理
   */
  _onKeyDown(e) {
    // 重映射模式下忽略所有按键
    if (this.isRemapping) return;

    if (this.pressedKeys.has(e.code)) return;

    const button = this.keyMap[e.code];
    if (button !== undefined) {
      e.preventDefault();
      this.pressedKeys.add(e.code);
      emulator.buttonDown(button);
    }

    // 快捷键处理
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
    // 重映射模式下忽略
    if (this.isRemapping) return;

    const button = this.keyMap[e.code];
    if (button !== undefined) {
      e.preventDefault();
      this.pressedKeys.delete(e.code);
      emulator.buttonUp(button);
    }
  }

  /**
   * 释放所有按键（用于失焦时）
   */
  releaseAll() {
    for (const code of this.pressedKeys) {
      const button = this.keyMap[code];
      if (button !== undefined) {
        emulator.buttonUp(button);
      }
    }
    this.pressedKeys.clear();
  }

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
    // 方向键
    const dpadButtons = {
      'dpadUp': this.BUTTONS.UP,
      'dpadDown': this.BUTTONS.DOWN,
      'dpadLeft': this.BUTTONS.LEFT,
      'dpadRight': this.BUTTONS.RIGHT,
    };

    for (const [id, button] of Object.entries(dpadButtons)) {
      const el = this.gamepadElements[id];
      if (!el) continue;

      this._bindButtonEvents(el, button);
    }

    // 功能键
    const funcButtons = {
      'gpSelect': this.BUTTONS.SELECT,
      'gpStart': this.BUTTONS.START,
    };

    for (const [id, button] of Object.entries(funcButtons)) {
      const el = this.gamepadElements[id];
      if (!el) continue;
      this._bindButtonEvents(el, button);
    }

    // AB键
    const actionButtons = {
      'gpA': this.BUTTONS.A,
      'gpB': this.BUTTONS.B,
    };

    for (const [id, button] of Object.entries(actionButtons)) {
      const el = this.gamepadElements[id];
      if (!el) continue;
      this._bindButtonEvents(el, button);
    }
  }

  /**
   * 为单个虚拟按钮绑定事件
   */
  _bindButtonEvents(el, button) {
    const pressStart = (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      emulator.buttonDown(button);
    };

    const pressEnd = (e) => {
      e.preventDefault();
      el.classList.remove('pressed');
      emulator.buttonUp(button);
    };

    el.addEventListener('mousedown', pressStart);
    el.addEventListener('mouseup', pressEnd);
    el.addEventListener('mouseleave', pressEnd);
    el.addEventListener('touchstart', pressStart, { passive: false });
    el.addEventListener('touchend', pressEnd);
    el.addEventListener('touchcancel', pressEnd);
  }

  /**
   * 获取按键显示名称
   */
  getKeyDisplayName(code) {
    const displayNames = {
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'KeyW': 'W',
      'KeyS': 'S',
      'KeyA': 'A',
      'KeyD': 'D',
      'KeyZ': 'Z',
      'KeyJ': 'J',
      'KeyX': 'X',
      'KeyK': 'K',
      'Enter': 'Enter',
      'ShiftRight': 'Shift',
      'ShiftLeft': 'Shift',
      'Space': '空格',
      'KeyQ': 'Q',
      'KeyE': 'E',
      'KeyR': 'R',
      'KeyT': 'T',
      'KeyY': 'Y',
      'KeyU': 'U',
      'KeyI': 'I',
      'KeyO': 'O',
      'KeyP': 'P',
      'KeyF': 'F',
      'KeyG': 'G',
      'KeyH': 'H',
      'KeyL': 'L',
      'KeyC': 'C',
      'KeyV': 'V',
      'KeyB': 'N',
      'KeyN': 'N',
      'KeyM': 'M',
      'Digit1': '1',
      'Digit2': '2',
      'Digit3': '3',
      'Digit4': '4',
      'Digit5': '5',
      'Digit6': '6',
      'Digit7': '7',
      'Digit8': '8',
      'Digit9': '9',
      'Digit0': '0',
      'Backspace': '退格',
      'Backquote': '`',
      'Minus': '-',
      'Equal': '=',
      'BracketLeft': '[',
      'BracketRight': ']',
      'Backslash': '\\',
      'Semicolon': ';',
      'Quote': "'",
      'Comma': ',',
      'Period': '.',
      'Slash': '/',
      'Numpad1': '小键盘1',
      'Numpad2': '小键盘2',
      'Numpad3': '小键盘3',
      'Numpad4': '小键盘4',
      'Numpad5': '小键盘5',
      'Numpad6': '小键盘6',
      'Numpad7': '小键盘7',
      'Numpad8': '小键盘8',
      'Numpad9': '小键盘9',
      'Numpad0': '小键盘0',
      'NumpadEnter': '小键盘Enter',
      'NumpadAdd': '小键盘+',
      'NumpadSubtract': '小键盘-',
      'NumpadMultiply': '小键盘*',
      'NumpadDivide': '小键盘/',
      'NumpadDecimal': '小键盘.',
    };
    return displayNames[code] || code;
  }
}

// 导出单例
const controller = new Controller();
