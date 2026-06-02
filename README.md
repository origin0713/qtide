# Qtide

[English](README_EN.md)

Qtide 是一个 VS Code 扩展，用于解析和浏览 Qt 项目文件，提供类似 Qt Creator 的项目文件树视图。支持 **qmake (.pro)** 和 **CMake (CMakeLists.txt)** 两种项目类型。

### 功能

- **导入项目** — 顶部 QuickPick 选择项目类型（qmake / CMake），自动解析 TARGET、SOURCES、HEADERS、FORMS、RESOURCES、TRANSLATIONS
- **项目文件树** — 侧边栏按 Headers / Sources / Forms / Resources / **Other files** 分组展示
- **Other files** — 翻译文件（.ts / .qm）独立分组，使用专属图标
- **工作区文件提示** — 导入成功后提示保存 `.code-workspace`，支持自定义路径
- **打开工作区** — 通过 `.code-workspace` 切换 VS Code 工作区
- **自动发现** — 工作区内的 `.pro` 和 `CMakeLists.txt` 自动加入项目树
- **设置面板** — 预览版，提供 General / Editor / Build 分组

![alt text](.resource/qtide.png)

### 使用

1. 点击 Operations 视图中的 **Import Project**
2. 选择 **qmake (.pro)** 或 **CMake (CMakeLists.txt)**
3. 选择对应项目文件
4. 项目文件树自动在下方显示
5. 按提示保存工作区文件（可选）

### 鸣谢

感谢 [eide](https://github.com/github0null/eide) 项目，本项目的实现参考了其设计和代码。

### 构建

```bash
# 编译扩展
npm install
npm run compile

# 构建设置面板（需先安装 Node.js）
cd webview/settings
npm install
npm run build
```

### 许可

MIT
