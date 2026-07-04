/**
 * UI管理模块
 * 管理界面状态、弹窗、通知、虚拟手柄切换等
 */

class UIManager {
  constructor() {
    this.elements = {};
    this.toastTimer = null;
  }

  /**
   * 缓存DOM元素引用
   */
  cacheElements() {
    const ids = [
      'gameCanvas', 'screenPlaceholder', 'screenContainer',
      'gameTitle', 'fpsDisplay', 'powerLed', 'statusText',
      'btnLoadROM', 'btnLoad', 'btnPause', 'btnReset', 'btnFullscreen',
      'btnQuickSave', 'btnQuickLoad', 'btnSaveManager', 'btnExportSave',
      'btnCloseSaveModal', 'btnCloseSaveModal2', 'btnImportSave',
      'btnEditKeymap', 'btnCloseKeymapModal', 'btnCloseKeymapModal2', 'btnResetKeymap',
      'fileInput', 'saveImportInput',
      'toggleCRT', 'toggleScanlines', 'selectScale',
      'crtOverlay', 'saveModal', 'saveSlots', 'toastContainer',
      'keymapModal', 'keymapConfig', 'keymapDisplay',
      'fcConsole'
    ];

    for (const id of ids) {
      this.elements[id] = document.getElementById(id);
    }
  }

  /**
   * 显示游戏画面
   */
  showGameScreen(gameName) {
    this.elements.screenPlaceholder.classList.add('hidden');
    this.elements.screenContainer.classList.add('running');
    this.elements.powerLed.classList.add('on');
    this.elements.gameTitle.textContent = gameName || '游戏中...';
    this.elements.fpsDisplay.style.display = 'inline';

    // 启用控制按钮
    this.setGameControlsEnabled(true);
  }

  /**
   * 隐藏游戏画面
   */
  hideGameScreen() {
    this.elements.screenPlaceholder.classList.remove('hidden');
    this.elements.screenContainer.classList.remove('running');
    this.elements.powerLed.classList.remove('on');
    this.elements.gameTitle.textContent = '未加载游戏';
    this.elements.fpsDisplay.style.display = 'none';

    // 禁用控制按钮
    this.setGameControlsEnabled(false);
  }

  /**
   * 设置游戏控制按钮状态
   */
  setGameControlsEnabled(enabled) {
    const gameButtons = [
      'btnPause', 'btnReset', 'btnQuickSave',
      'btnQuickLoad', 'btnSaveManager', 'btnExportSave'
    ];

    for (const id of gameButtons) {
      if (this.elements[id]) {
        this.elements[id].disabled = !enabled;
      }
    }
  }

  /**
   * 更新FPS显示
   */
  updateFPS(fps) {
    this.elements.fpsDisplay.textContent = `${fps} FPS`;
  }

  /**
   * 更新状态栏
   */
  setStatus(text, type = 'info') {
    if (this.elements.statusText) {
      this.elements.statusText.textContent = text;
    }
  }

  /**
   * 显示Toast通知
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.elements.toastContainer.appendChild(toast);

    // 自动移除
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  /**
   * 显示存档管理弹窗
   */
  showSaveModal() {
    this.elements.saveModal.classList.add('active');
    this.refreshSaveSlots();
  }

  /**
   * 隐藏存档管理弹窗
   */
  hideSaveModal() {
    this.elements.saveModal.classList.remove('active');
  }

  /**
   * 刷新存档槽位列表
   */
  async refreshSaveSlots() {
    const container = this.elements.saveSlots;
    if (!container) return;

    try {
      const saves = await saveManager.getAllSaves();
      
      if (saves.length === 0 || saves.every(s => s.empty)) {
        container.innerHTML = `
          <div class="save-empty-state">
            <div class="empty-icon">📭</div>
            <p>暂无存档</p>
            <p style="font-size:0.75rem;margin-top:4px;">点击槽位保存，或使用 F5 快速存档</p>
          </div>
        `;
        return;
      }

      container.innerHTML = saves.map(s => {
        if (s.empty) {
          return `
            <div class="save-slot empty" data-slot="${s.slot}">
              <div class="slot-number">${s.slot + 1}</div>
              <div class="slot-info">
                <div class="slot-name">空槽位</div>
              </div>
              <div class="slot-actions">
                <button class="slot-action-btn save" data-action="save" data-slot="${s.slot}" title="保存到此槽位">💾</button>
              </div>
            </div>
          `;
        }

        const date = new Date(s.data.timestamp);
        const dateStr = `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getDate().toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

        return `
          <div class="save-slot" data-slot="${s.slot}">
            <div class="slot-number">${s.slot + 1}</div>
            <div class="slot-screenshot">
              ${s.data.screenshot 
                ? `<img src="${s.data.screenshot}" alt="截图" style="width:100%;height:100%;object-fit:cover;image-rendering:pixelated;">` 
                : '<div class="no-screenshot">无截图</div>'}
            </div>
            <div class="slot-info">
              <div class="slot-name">${this.escapeHtml(s.data.label)}</div>
              <div class="slot-meta">${dateStr}</div>
            </div>
            <div class="slot-actions">
              <button class="slot-action-btn load" data-action="load" data-slot="${s.slot}" title="读取存档">📥</button>
              <button class="slot-action-btn save" data-action="save" data-slot="${s.slot}" title="覆盖存档">💾</button>
              <button class="slot-action-btn danger" data-action="delete" data-slot="${s.slot}" title="删除存档">🗑️</button>
            </div>
          </div>
        `;
      }).join('');

      // 绑定槽位操作事件
      container.querySelectorAll('.slot-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const slot = parseInt(btn.dataset.slot);
          
          switch (action) {
            case 'save':
              await this.handleSlotSave(slot);
              break;
            case 'load':
              await this.handleSlotLoad(slot);
              break;
            case 'delete':
              await this.handleSlotDelete(slot);
              break;
          }
        });
      });

      // 点击空槽位保存
      container.querySelectorAll('.save-slot.empty').forEach(slot => {
        slot.addEventListener('click', async () => {
          const slotNum = parseInt(slot.dataset.slot);
          await this.handleSlotSave(slotNum);
        });
      });

    } catch (err) {
      console.error('刷新存档列表失败:', err);
      container.innerHTML = '<p style="text-align:center;color:#f44336;">加载存档列表失败</p>';
    }
  }

  /**
   * 处理槽位保存
   */
  async handleSlotSave(slot) {
    try {
      const state = emulator.getState();
      if (!state) {
        this.showToast('无法获取游戏状态', 'error');
        return;
      }

      const screenshot = emulator.getThumbnail();
      await saveManager.saveToSlot(slot, state, screenshot);
      this.showToast(`已保存到槽位 ${slot + 1}`, 'success');
      await this.refreshSaveSlots();
    } catch (err) {
      this.showToast('保存失败: ' + err.message, 'error');
    }
  }

  /**
   * 处理槽位读档
   */
  async handleSlotLoad(slot) {
    try {
      const saveData = await saveManager.loadFromSlot(slot);
      if (!saveData) {
        this.showToast('该槽位没有存档', 'error');
        return;
      }

      const success = emulator.loadState(saveData.state);
      if (success) {
        this.showToast(`已从槽位 ${slot + 1} 读取存档`, 'success');
        this.hideSaveModal();
      } else {
        this.showToast('读档失败', 'error');
      }
    } catch (err) {
      this.showToast('读档失败: ' + err.message, 'error');
    }
  }

  /**
   * 处理槽位删除
   */
  async handleSlotDelete(slot) {
    if (!confirm(`确定要删除槽位 ${slot + 1} 的存档吗？`)) return;

    try {
      await saveManager.deleteSave(slot);
      this.showToast(`槽位 ${slot + 1} 存档已删除`, 'info');
      await this.refreshSaveSlots();
    } catch (err) {
      this.showToast('删除失败: ' + err.message, 'error');
    }
  }

  /**
   * HTML转义
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * 切换CRT效果
   */
  toggleCRT(enabled) {
    if (enabled) {
      this.elements.crtOverlay.classList.add('active', 'curvature', 'vignette');
    } else {
      this.elements.crtOverlay.classList.remove('active', 'curvature', 'vignette');
    }
  }

  /**
   * 切换扫描线效果
   */
  toggleScanlines(enabled) {
    if (enabled) {
      this.elements.crtOverlay.classList.add('active', 'scanlines');
    } else {
      this.elements.crtOverlay.classList.remove('scanlines');
      // 如果CRT也关了，完全隐藏overlay
      if (!this.elements.toggleCRT.checked) {
        this.elements.crtOverlay.classList.remove('active');
      }
    }
  }

  /**
   * 设置画面缩放
   */
  setScale(scale) {
    const canvas = this.elements.gameCanvas;
    // Canvas内部尺寸不变，通过CSS缩放
    canvas.style.width = (256 * scale) + 'px';
    canvas.style.height = (240 * scale) + 'px';
  }

  /**
   * 切换全屏
   */
  toggleFullscreen() {
    const el = this.elements.screenContainer;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(err => {
        this.showToast('全屏失败: ' + err.message, 'error');
      });
    } else {
      document.exitFullscreen();
    }
  }

  /**
   * 暂停按钮UI更新
   */
  setPauseButtonState(isPaused) {
    const btn = this.elements.btnPause;
    if (btn) {
      const iconSpan = btn.querySelector('.ctrl-icon');
      const textSpan = btn.querySelectorAll('span')[1];
      if (isPaused) {
        if (iconSpan) iconSpan.textContent = '▶️';
        if (textSpan) textSpan.textContent = '继续';
        btn.classList.add('active');
      } else {
        if (iconSpan) iconSpan.textContent = '⏯️';
        if (textSpan) textSpan.textContent = '暂停';
        btn.classList.remove('active');
      }
    }
  }

  /**
   * 创建背景粒子
   */
  createParticles() {
    const container = document.getElementById('bgParticles');
    if (!container) return;

    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (4 + Math.random() * 6) + 's';
      particle.style.width = (2 + Math.random() * 3) + 'px';
      particle.style.height = particle.style.width;
      container.appendChild(particle);
    }
  }

  /**
   * 初始化UI事件绑定
   */
  bindEvents() {
    // 加载ROM按钮
    this.elements.btnLoadROM?.addEventListener('click', () => {
      this.elements.fileInput.click();
    });
    this.elements.btnLoad?.addEventListener('click', () => {
      this.elements.fileInput.click();
    });

    // 文件选择
    this.elements.fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        romLoader.loadFromFile(file);
      }
    });

    // 暂停按钮
    this.elements.btnPause?.addEventListener('click', () => {
      const isPaused = emulator.togglePause();
      this.setPauseButtonState(isPaused);
      this.showToast(isPaused ? '已暂停' : '已继续', 'info');
    });

    // 重置按钮
    this.elements.btnReset?.addEventListener('click', () => {
      if (confirm('确定要重置游戏吗？未保存的进度将丢失。')) {
        emulator.reset();
        this.showToast('游戏已重置', 'info');
      }
    });

    // 全屏按钮
    this.elements.btnFullscreen?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // 自定义按键
    this.elements.btnEditKeymap?.addEventListener('click', () => {
      this.showKeymapModal();
    });
    this.elements.btnCloseKeymapModal?.addEventListener('click', () => {
      this.hideKeymapModal();
    });
    this.elements.btnCloseKeymapModal2?.addEventListener('click', () => {
      this.hideKeymapModal();
    });
    this.elements.btnResetKeymap?.addEventListener('click', () => {
      if (confirm('确定要恢复默认按键映射吗？')) {
        controller.resetKeyMap();
        this.refreshKeymapDisplay();
        this.refreshKeymapConfig();
        this.showToast('已恢复默认按键', 'success');
      }
    });

    // 点击弹窗遮罩关闭
    this.elements.keymapModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.keymapModal) {
        this.hideKeymapModal();
      }
    });

    // 快速存档
    this.elements.btnQuickSave?.addEventListener('click', async () => {
      await this.quickSave();
    });

    // 快速读档
    this.elements.btnQuickLoad?.addEventListener('click', async () => {
      await this.quickLoad();
    });

    // 存档管理
    this.elements.btnSaveManager?.addEventListener('click', () => {
      this.showSaveModal();
    });

    // 关闭存档弹窗
    this.elements.btnCloseSaveModal?.addEventListener('click', () => {
      this.hideSaveModal();
    });
    this.elements.btnCloseSaveModal2?.addEventListener('click', () => {
      this.hideSaveModal();
    });

    // 点击弹窗遮罩关闭
    this.elements.saveModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.saveModal) {
        this.hideSaveModal();
      }
    });

    // 导出存档
    this.elements.btnExportSave?.addEventListener('click', async () => {
      await this.exportSaves();
    });

    // 导入存档
    this.elements.btnImportSave?.addEventListener('click', () => {
      this.elements.saveImportInput.click();
    });
    this.elements.saveImportInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const count = await saveManager.importSaves(text);
        this.showToast(`成功导入 ${count} 个存档`, 'success');
        await this.refreshSaveSlots();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });

    // CRT效果开关
    this.elements.toggleCRT?.addEventListener('change', (e) => {
      this.toggleCRT(e.target.checked);
    });

    // 扫描线开关
    this.elements.toggleScanlines?.addEventListener('change', (e) => {
      this.toggleScanlines(e.target.checked);
    });

    // 画面比例
    this.elements.selectScale?.addEventListener('change', (e) => {
      this.setScale(parseFloat(e.target.value));
    });

    // 拖拽ROM文件
    this.bindDragDrop();

    // 全屏变化监听
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        this.setScale(parseFloat(this.elements.selectScale?.value || '2.5'));
      }
    });

    // 快捷键事件
    document.addEventListener('fc:quicksave', async () => {
      await this.quickSave();
    });

    document.addEventListener('fc:quickload', async () => {
      await this.quickLoad();
    });

    // 窗口失焦时释放所有按键
    window.addEventListener('blur', () => {
      controller.releaseAll();
    });

    // ESC关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.elements.saveModal.classList.contains('active')) {
          this.hideSaveModal();
        }
        if (this.elements.keymapModal.classList.contains('active')) {
          this.hideKeymapModal();
        }
      }
    });
  }

  /**
   * 快速存档
   */
  async quickSave() {
    try {
      const state = emulator.getState();
      if (!state) {
        this.showToast('无法获取游戏状态', 'error');
        return;
      }

      const screenshot = emulator.getThumbnail();
      await saveManager.quickSave(state, screenshot);
      this.showToast('快速存档成功 (槽位1)', 'success');
    } catch (err) {
      this.showToast('存档失败: ' + err.message, 'error');
    }
  }

  /**
   * 快速读档
   */
  async quickLoad() {
    try {
      const saveData = await saveManager.quickLoad();
      if (!saveData) {
        this.showToast('没有快速存档，请先存档 (F5)', 'error');
        return;
      }

      const success = emulator.loadState(saveData.state);
      if (success) {
        this.showToast('快速读档成功 (槽位1)', 'success');
      } else {
        this.showToast('读档失败', 'error');
      }
    } catch (err) {
      this.showToast('读档失败: ' + err.message, 'error');
    }
  }

  /**
   * 导出存档
   */
  async exportSaves() {
    try {
      const json = await saveManager.exportSaves();
      const romInfo = romLoader.getRomInfo();
      const gameName = romInfo ? romInfo.name : 'unknown';
      
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gameName}_saves_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showToast('存档已导出', 'success');
    } catch (err) {
      this.showToast('导出失败: ' + err.message, 'error');
    }
  }

  /**
   * 绑定拖拽事件
   */
  bindDragDrop() {
    const container = this.elements.screenContainer;
    if (!container) return;

    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      container.addEventListener(eventName, preventDefaults);
      document.body.addEventListener(eventName, preventDefaults);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      container.addEventListener(eventName, () => {
        container.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      container.addEventListener(eventName, () => {
        container.classList.remove('drag-over');
      });
    });

    container.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.nes')) {
          romLoader.loadFromFile(file);
        } else {
          this.showToast('请拖入 .nes 格式的 ROM 文件', 'error');
        }
      }
    });
  }

  // ========== 按键自定义 ==========

  /**
   * 显示按键自定义弹窗
   */
  showKeymapModal() {
    this.elements.keymapModal.classList.add('active');
    this.refreshKeymapConfig();
  }

  /**
   * 隐藏按键自定义弹窗
   */
  hideKeymapModal() {
    this.elements.keymapModal.classList.remove('active');
    this.refreshKeymapDisplay();
  }

  /**
   * 刷新按键配置面板
   */
  refreshKeymapConfig() {
    const container = this.elements.keymapConfig;
    if (!container) return;

    const buttons = [
      { id: controller.BUTTONS.UP, label: '上', hint: '方向' },
      { id: controller.BUTTONS.DOWN, label: '下', hint: '方向' },
      { id: controller.BUTTONS.LEFT, label: '左', hint: '方向' },
      { id: controller.BUTTONS.RIGHT, label: '右', hint: '方向' },
      { id: controller.BUTTONS.A, label: 'A键', hint: '动作' },
      { id: controller.BUTTONS.B, label: 'B键', hint: '动作' },
      { id: controller.BUTTONS.START, label: 'Start', hint: '菜单' },
      { id: controller.BUTTONS.SELECT, label: 'Select', hint: '菜单' },
    ];

    container.innerHTML = buttons.map(btn => {
      const keys = controller.getKeysForButton(btn.id);
      const keysHtml = keys.map(code => `
        <span class="key-tag" data-code="${code}" data-button="${btn.id}">
          ${controller.getKeyDisplayName(code)}
          <span class="key-remove" data-code="${code}">✕</span>
        </span>
      `).join('');

      return `
        <div class="keymap-config-row" data-button="${btn.id}">
          <span class="button-label">${btn.label}</span>
          <div class="button-keys" id="keys-${btn.id}">
            ${keysHtml}
            <button class="btn-add-key" data-button="${btn.id}" title="添加按键">+</button>
          </div>
          <span class="key-hint">${btn.hint}</span>
        </div>
      `;
    }).join('');

    // 绑定添加按键事件
    container.querySelectorAll('.btn-add-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const button = parseInt(btn.dataset.button);
        const row = btn.closest('.keymap-config-row');

        // 标记为监听中
        btn.textContent = '按任意键...';
        btn.classList.add('listening');

        // 开始重映射
        controller.startRemapping(button, (keyCode) => {
          btn.classList.remove('listening');
          btn.textContent = '+';

          if (keyCode) {
            this.showToast(`已设置 ${controller.getKeyDisplayName(keyCode)} → ${controller.BUTTON_NAMES[button]}`, 'success');
          }
          this.refreshKeymapConfig();
          this.refreshKeymapDisplay();
        });
      });
    });

    // 绑定删除按键事件
    container.querySelectorAll('.key-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.dataset.code;
        const button = parseInt(btn.closest('.key-tag').dataset.button);

        // 从映射中移除
        delete controller.keyMap[code];
        controller.saveKeyMap();

        this.refreshKeymapConfig();
        this.refreshKeymapDisplay();
        this.showToast('已移除按键', 'info');
      });
    });
  }

  /**
   * 刷新按键映射显示（右侧面板）
   */
  refreshKeymapDisplay() {
    const container = this.elements.keymapDisplay;
    if (!container) return;

    const mappings = [
      { button: controller.BUTTONS.UP, label: '方向键' },
      { button: controller.BUTTONS.A, label: 'A键' },
      { button: controller.BUTTONS.B, label: 'B键' },
      { button: controller.BUTTONS.START, label: 'Start' },
      { button: controller.BUTTONS.SELECT, label: 'Select' },
      { button: null, label: '存档' },
      { button: null, label: '读档' },
    ];

    container.innerHTML = mappings.map(m => {
      if (m.button === null) {
        // 快捷键
        if (m.label === '存档') {
          return `<div class="keymap-item"><kbd>F5</kbd><span>存档</span></div>`;
        }
        if (m.label === '读档') {
          return `<div class="keymap-item"><kbd>F7</kbd><span>读档</span></div>`;
        }
      }

      const keys = controller.getKeysForButton(m.button);
      const keyNames = keys.map(code => controller.getKeyDisplayName(code)).join(' / ');
      return `<div class="keymap-item"><kbd>${keyNames || '未设置'}</kbd><span>${m.label}</span></div>`;
    }).join('');
  }
}

// 导出单例
const uiManager = new UIManager();
