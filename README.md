# 🎮 FC 游戏机 - 网页端 NES 模拟器

一款能在浏览器中运行的童年经典 FC（红白机/NES）游戏模拟器，支持从本地导入 `.nes` ROM 文件，拥有完整的存档功能。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📂 ROM 导入 | 支持文件选择器和拖拽导入 `.nes` 文件 |
| 🎮 游戏运行 | 基于 JSNES 模拟器，流畅运行大多数 NES 游戏 |
| 💾 存档系统 | 10个存档槽位，IndexedDB 持久化存储，含截图预览 |
| ⌨️ 自定义按键 | 支持自定义键盘映射，保存到 localStorage |
| 📱 虚拟手柄 | 触屏设备自动显示虚拟手柄，桌面端可手动开启 |
| 🖥️ CRT 效果 | 扫描线、屏幕暗角、曲面效果，可独立开关 |
| 🔍 画面缩放 | 支持 2x / 2.5x / 3x / 3.5x 比例 |
| ⛶ 全屏模式 | 一键进入沉浸式全屏游戏 |
| 📤 存档导出 | 将存档导出为 JSON 文件，支持跨设备迁移 |

## 🕹️ 默认按键映射

| 按键 | 功能 |
|------|------|
| `↑↓←→` / `WASD` | 方向键 |
| `Z` / `J` | A 键 |
| `X` / `K` | B 键 |
| `Enter` | Start |
| `Shift` | Select |
| `F5` | 快速存档 |
| `F7` | 快速读档 |

> 点击右侧面板中的 ✏️ 按钮可自定义按键映射

## 🚀 快速开始

### 方式一：直接打开（最简单）

1. 下载本项目所有文件
2. 用浏览器直接打开 `index.html`
3. 点击「打开 ROM 文件」或拖拽 `.nes` 文件到屏幕区域
4. 开始游戏！

### 方式二：部署到 GitHub Pages

1. **Fork 或创建仓库**
   - 在 GitHub 上创建一个新仓库（例如 `fc-game`）
   - 将本项目所有文件上传到仓库

2. **启用 GitHub Pages**
   - 进入仓库 Settings → Pages
   - Source 选择 "Deploy from a branch"
   - Branch 选择 `main`，文件夹选择 `/ (root)`
   - 点击 Save

3. **访问网站**
   - 等待几分钟后，访问 `https://你的用户名.github.io/fc-game/`
   - 即可在线游玩！

### 方式三：本地服务器

```bash
cd fc-game
python3 -m http.server 8080
# 然后打开 http://localhost:8080
```

## 📁 项目结构

```
fc-game/
├── index.html              # 主入口页面
├── css/
│   ├── main.css            # 全局样式、复古FC主题
│   ├── crt-effect.css      # CRT扫描线效果
│   ├── gamepad.css         # 虚拟手柄样式
│   ├── save-manager.css    # 存档面板样式
│   └── keymap-config.css   # 按键自定义面板样式
├── js/
│   ├── app.js              # 应用主入口
│   ├── emulator.js         # JSNES模拟器封装
│   ├── romLoader.js        # ROM文件加载验证
│   ├── saveManager.js      # IndexedDB存档管理
│   ├── controller.js       # 键盘+手柄控制器（含自定义按键）
│   └── uiManager.js        # UI交互管理
└── lib/
    └── jsnes.min.js        # JSNES库本地备份
```

## 🛠️ 技术栈

- **模拟器核心**: [JSNES](https://github.com/bfirsh/jsnes) - 纯 JavaScript NES 模拟器
- **前端**: 纯 HTML5 + CSS3 + ES6 JavaScript（零框架、零构建）
- **存档存储**: IndexedDB（大容量二进制数据）
- **配置存储**: localStorage（小数据量即时读写）

## 📝 注意事项

1. **ROM 文件**: 请自行准备合法的 `.nes` ROM 文件，本项目不提供任何游戏 ROM
2. **浏览器兼容性**: 推荐使用 Chrome / Edge / Firefox 最新版本
3. **音频**: 部分浏览器可能需要用户交互后才能播放音频（点击页面任意位置即可）
4. **存档**: 存档保存在浏览器本地，清除浏览器数据会导致存档丢失，建议定期导出备份

## 📜 开源协议

本项目基于 MIT 协议开源。

JSNES 模拟器库遵循其原始开源协议。

---

❤️ 怀念童年，重温经典
##预览
<img width="1912" height="914" alt="image" src="https://github.com/user-attachments/assets/bdd422db-9941-4627-8d7d-3961b254e64f" />
<img width="1826" height="868" alt="image" src="https://github.com/user-attachments/assets/bdd4235c-3f79-4dba-8ade-78e16a46bc29" />
