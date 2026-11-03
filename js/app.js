/**
 * FC游戏机 - 应用主入口
 * 协调所有模块的初始化和事件联动
 */

(function () {
  'use strict';

  // ========== 初始化阶段 ==========

  // 1. 缓存DOM元素
  uiManager.cacheElements();

  // 2. 初始化模拟器（带音频）
  const canvas = uiManager.elements.gameCanvas;
  emulator.init(canvas);

  // 3. 构建虚拟手柄 + 悬浮工具条
  setupVirtualGamepad();

  // 4. 绑定键盘控制器
  controller.bind();

  // 5. 初始化UI效果与已保存的设置（声音/音量/CRT/操作方式等）
  uiManager.createParticles();
  uiManager.applyStoredSettings();

  // 6. 绑定UI事件
  uiManager.bindEvents();

  // 7. 初始化存档系统
  (async () => {
    try {
      await saveManager.init();
      console.log('存档系统初始化完成');
    } catch (err) {
      console.error('存档系统初始化失败:', err);
      uiManager.showToast('存档系统不可用，存档功能将受限', 'error');
    }
  })();

  // ========== 事件监听 ==========

  // ROM加载器事件
  romLoader.on('loading', (filename) => {
    uiManager.setStatus(`正在加载: ${filename}...`);
  });

  romLoader.on('loaded', (data) => {
    uiManager.setStatus('ROM加载完成，正在启动...');

    // 设置当前游戏
    saveManager.setCurrentGame(data.romInfo);

    // 加载到模拟器
    const success = emulator.loadROM(data.romData);
    if (success) {
      uiManager.showGameScreen(data.romInfo.name);
      uiManager.showToast(`已加载: ${data.romInfo.name}`, 'success');
      uiManager.setStatus(`运行中 - ${data.romInfo.name} | Mapper: ${data.romInfo.mapper}`);

      // 触屏设备：自动显示手柄，并把页面带回画面顶部
      if (uiManager.isTouchDevice()) {
        uiManager.setPadVisible(true);
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      // 用户已点击过页面，这里再恢复一次音频，避免被自动播放策略挡住
      emulator.resumeAudio();
    }
  });

  romLoader.on('error', (message) => {
    uiManager.showToast(message, 'error');
    uiManager.setStatus('加载失败');
  });

  // 模拟器事件
  emulator.on('started', () => {
    uiManager.setPauseButtonState(false);
  });

  emulator.on('paused', () => {
    uiManager.setPauseButtonState(true);
  });

  emulator.on('resumed', () => {
    uiManager.setPauseButtonState(false);
    controller.reapplyHeld();
  });

  emulator.on('reset', () => {
    uiManager.setPauseButtonState(false);
  });

  emulator.on('fps', (fps) => {
    uiManager.updateFPS(fps);
  });

  emulator.on('error', (message) => {
    uiManager.showToast(message, 'error');
  });

  // 存档事件
  saveManager.on('saved', ({ slot }) => {
    console.log(`存档已保存到槽位 ${slot + 1}`);
  });

  saveManager.on('loaded', ({ slot }) => {
    console.log(`从槽位 ${slot + 1} 读取存档`);
  });

  // 操作方式切换后同步设置面板
  document.addEventListener('fc:inputmode', (e) => {
    uiManager.updateInputModeUI(e.detail.mode);
  });

  // ========== 虚拟手柄 ==========
  function setupVirtualGamepad() {
    const gamepadHTML = `
      <div class="virtual-gamepad" id="virtualGamepad">
        <!-- 手柄内嵌工具条：不会遮挡页面内容 -->
        <div class="pad-tools" id="padTools">
          <button class="tool-btn" id="toolSound" type="button" title="声音">🔊</button>
          <button class="tool-btn" id="toolLayout" type="button" title="切换操作方式">✚</button>
          <button class="tool-btn" id="toolFocus" type="button" title="沉浸模式">⛶</button>
          <button class="tool-btn" id="toolHidePad" type="button" title="收起手柄">▾</button>
        </div>

        <div class="gamepad-inner">

          <!-- 左：方向控制（方向键 / 摇杆二选一） -->
          <div class="pad-area">
            <div class="dpad-zone" id="dpadZone">
              <div class="dpad-btn dpad-up" id="dpadUp">▲</div>
              <div class="dpad-btn dpad-down" id="dpadDown">▼</div>
              <div class="dpad-btn dpad-left" id="dpadLeft">◀</div>
              <div class="dpad-btn dpad-right" id="dpadRight">▶</div>
              <div class="dpad-center"></div>
            </div>

            <div class="joystick-zone" id="joystickZone">
              <div class="joystick-base">
                <div class="joystick-ring"></div>
                <div class="joystick-knob" id="joystickKnob"></div>
              </div>
            </div>
          </div>

          <!-- 中：SELECT / START -->
          <div class="func-area">
            <div class="func-btn" id="gpSelect">SELECT</div>
            <div class="func-btn" id="gpStart">START</div>
          </div>

          <!-- 右：B / A -->
          <div class="action-area">
            <div class="action-btn btn-b" id="gpB">B</div>
            <div class="action-btn btn-a" id="gpA">A</div>
          </div>

        </div>
      </div>

      <!-- 手柄收起时显示的入口按钮 -->
      <button class="pad-fab" id="gamepadToggle" type="button" title="显示虚拟手柄">🎮</button>
    `;

    document.body.insertAdjacentHTML('beforeend', gamepadHTML);

    // 重新缓存新增的元素
    uiManager.cacheElements();

    // 绑定手柄按钮
    controller.setGamepadElements({
      dpadZone: document.getElementById('dpadZone'),
      joystickZone: document.getElementById('joystickZone'),
      joystickKnob: document.getElementById('joystickKnob'),
      dpadUp: document.getElementById('dpadUp'),
      dpadDown: document.getElementById('dpadDown'),
      dpadLeft: document.getElementById('dpadLeft'),
      dpadRight: document.getElementById('dpadRight'),
      gpSelect: document.getElementById('gpSelect'),
      gpStart: document.getElementById('gpStart'),
      gpA: document.getElementById('gpA'),
      gpB: document.getElementById('gpB'),
    });

    // 先套用保存的输入方式（含 body class）
    controller.setInputMode(controller.inputMode);

    // 桌面端窗口变化时校正手柄占位高度
    updatePadHeightVar();
    window.addEventListener('resize', updatePadHeightVar);
    window.addEventListener('orientationchange', () => setTimeout(updatePadHeightVar, 300));
  }

  /**
   * 把虚拟手柄实际高度写入 CSS 变量，供页面留白与工具条定位使用
   */
  function updatePadHeightVar() {
    const pad = document.getElementById('virtualGamepad');
    if (!pad) return;

    // 横屏时手柄是铺满全屏的悬浮层，不占用页面高度
    const compactLandscape = window.matchMedia('(orientation: landscape) and (max-height: 540px)').matches;
    if (compactLandscape) {
      document.documentElement.style.setProperty('--pad-height', '0px');
      return;
    }

    const wasVisible = pad.classList.contains('is-visible');
    if (!wasVisible) pad.style.visibility = 'hidden';
    pad.style.display = 'block';
    const h = pad.offsetHeight;
    if (!wasVisible) {
      pad.style.display = '';
      pad.style.visibility = '';
    }
    if (h > 0) {
      document.documentElement.style.setProperty('--pad-height', h + 'px');
    }
  }

  // ========== 启动完成 ==========
  uiManager.setStatus('就绪 - 请加载NES游戏文件');
  console.log('🎮 FC游戏机启动完成！');
  console.log('   - 点击"打开ROM文件"或拖拽.nes文件到屏幕区域');
  console.log('   - 键盘控制: 方向键/WASD移动, Z/J=A键, X/K=B键');
  console.log('   - 触屏: 右下角工具条可切换 声音 / 摇杆或方向键 / 沉浸模式');
  console.log('   - 快捷键: F5快速存档, F7快速读档');

})();
