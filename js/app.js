/**
 * FC游戏机 - 应用主入口
 * 协调所有模块的初始化和事件联动
 */

(async function () {
  'use strict';

  // ========== 初始化阶段 ==========

  // 1. 缓存DOM元素
  uiManager.cacheElements();

  // 2. 初始化模拟器
  const canvas = uiManager.elements.gameCanvas;
  emulator.init(canvas);

  // 3. 初始化存档系统
  try {
    await saveManager.init();
    console.log('存档系统初始化完成');
  } catch (err) {
    console.error('存档系统初始化失败:', err);
    uiManager.showToast('存档系统不可用，存档功能将受限', 'error');
  }

  // 4. 绑定键盘控制器
  controller.bind();

  // 5. 初始化UI效果
  uiManager.createParticles();
  uiManager.toggleCRT(true);
  uiManager.toggleScanlines(true);
  uiManager.setScale(2.5);

  // 6. 绑定UI事件
  uiManager.bindEvents();

  // 7. 设置虚拟手柄
  setupVirtualGamepad();

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

  // ========== 虚拟手柄设置 ==========
  function setupVirtualGamepad() {
    // 动态创建虚拟手柄
    const gamepadHTML = `
      <div class="virtual-gamepad" id="virtualGamepad">
        <div class="gamepad-inner">
          <div class="dpad-area">
            <div class="dpad-btn dpad-up" id="dpadUp">▲</div>
            <div class="dpad-btn dpad-down" id="dpadDown">▼</div>
            <div class="dpad-btn dpad-left" id="dpadLeft">◀</div>
            <div class="dpad-btn dpad-right" id="dpadRight">▶</div>
            <div class="dpad-center"></div>
          </div>
          <div class="func-area">
            <div class="func-btn" id="gpSelect">SELECT</div>
            <div class="func-btn" id="gpStart">START</div>
          </div>
          <div class="action-area">
            <div class="action-btn btn-b" id="gpB">B</div>
            <div class="action-btn btn-a" id="gpA">A</div>
          </div>
        </div>
      </div>
      <button class="gamepad-toggle" id="gamepadToggle" title="切换虚拟手柄">🎮</button>
    `;

    document.body.insertAdjacentHTML('beforeend', gamepadHTML);

    // 绑定虚拟手柄
    controller.setGamepadElements({
      dpadUp: document.getElementById('dpadUp'),
      dpadDown: document.getElementById('dpadDown'),
      dpadLeft: document.getElementById('dpadLeft'),
      dpadRight: document.getElementById('dpadRight'),
      gpSelect: document.getElementById('gpSelect'),
      gpStart: document.getElementById('gpStart'),
      gpA: document.getElementById('gpA'),
      gpB: document.getElementById('gpB'),
    });

    // 手柄切换按钮
    const toggle = document.getElementById('gamepadToggle');
    const gamepad = document.getElementById('virtualGamepad');

    if (toggle && gamepad) {
      toggle.addEventListener('click', () => {
        const isVisible = gamepad.classList.toggle('visible');
        toggle.classList.toggle('visible', isVisible);
      });

      // 非触屏设备默认显示切换按钮
      if (window.matchMedia('(pointer: fine)').matches) {
        toggle.classList.add('visible');
        toggle.style.display = 'flex';
      }
    }
  }

  // ========== 启动完成 ==========
  uiManager.setStatus('就绪 - 请加载NES游戏文件');
  console.log('🎮 FC游戏机启动完成！');
  console.log('   - 点击"打开ROM文件"或拖拽.nes文件到屏幕区域');
  console.log('   - 键盘控制: 方向键/WASD移动, Z/J=A键, X/K=B键');
  console.log('   - 快捷键: F5快速存档, F7快速读档');

})();
