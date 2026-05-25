# Qtide 开发计划

## 1. 项目概述

Qtide 是一个 VS Code 扩展，参考 Qt Creator 的功能，为 Qt 项目开发者提供代码编辑辅助。

项目基于 eide-master 的架构模式实现，核心目标是通过解析 .pro 工程文件，在 VS Code 侧边栏中展示项目文件结构，并提供与 Qt Creator 类似的树形视图交互。

---

## 2. 整体架构

```
qtide/
├── doc/
│   └── plan.md                   # 本计划文档
├── res/
│   └── icon/
│       └── qtide.svg             # 活动栏图标
├── src/
│   ├── extension.ts              # 扩展入口（激活/停用）
│   ├── QtTypeDefine.ts           # 类型与枚举定义
│   ├── ProFileParser.ts          # .pro 文件解析器
│   └── QtProjectExplorer.ts      # 项目树视图 + 操作视图
├── package.json                  # 扩展清单（views/menus/commands）
└── tsconfig.json
```

### 模块关系

- extension.ts -- 激活时创建 QtProjectExplorer，注册命令和 TreeView，扫描工作区 .pro 文件
- QtTypeDefine.ts -- 定义 TreeItemType 枚举、QtProjectData 接口、QtTreeItem 类
- ProFileParser.ts -- 解析 .pro 文件文本，返回结构化 QtProjectData
- QtProjectExplorer.ts -- 实现两个 TreeDataProvider：操作按钮视图 + 项目文件树视图

---

## 3. 阶段划分

### 阶段一：基础框架与项目树显示

**目标：** 在活动栏注册 Qtide 图标，点击后显示操作面板和项目文件结构。

已完成或进行中的任务：

1. 注册侧边栏图标（activitybar）
2. 操作视图：三个按钮（Open Project / New Project / Import Project）
3. Import Project：浏览本地 .pro 文件并解析
4. 项目树显示：
   ```
   [project_name]
     |- [project_name].pro
     |- Headers/
     |- Sources/
     |- Forms/
     |- Resources/
   ```

### 阶段二：增强文件树功能

- 右键上下文菜单（打开文件、在资源管理器中显示、复制路径）
- 点击树节点文件项在编辑器中打开
- FileSystemWatcher 自动刷新
- 支持多项目

### 阶段三：代码编辑增强

- 信号槽（SIGNAL/SLOT）导航
- MOC 文件识别
- .ui 文件关联 Qt Designer
- .qrc 资源文件预览

### 阶段四：构建集成

- 侧边栏构建/运行按钮
- 调用 qmake 生成 Makefile
- cmake 项目兼容
- 构建输出解析（Problem Matcher）

---

## 4. 关键技术点

### 4.1 TreeDataProvider 模式

参考 eide-master：

- 自定义 TreeItem（继承 vscode.TreeItem），携带 type 和 data 字段
- 使用枚举区分节点类型（GROUP / ITEM / FILE_ITEM）
- getChildren(element?) 根据 element.type 分支返回子节点
- 使用 EventEmitter 触发 onDidChangeTreeData 事件以刷新视图

### 4.2 .pro 文件解析

.pro 文件基于 qmake 语法：

- 变量赋值：`VAR = value` 或 `VAR += value`
- 续行：行末 `\` 表示下一行继续
- 注释：`#` 开头为注释
- 变量引用：`$${VAR}` 或 `$$VAR`
- 条件块：`win32 { ... }`、`debug { ... }` 等

解析器目前处理基本语法（赋值、续行、注释），后续逐步完善。

### 4.3 图标

- 操作按钮使用 VS Code 内置 ThemeIcon
- 文件类型使用 ThemeIcon（File / Folder）
- 活动栏使用自定义 SVG 图标

---

## 5. .pro 文件示例

```
QT       += core gui
TARGET = second
TEMPLATE = app

SOURCES += main.cpp mainwindow.cpp
HEADERS += mainwindow.h
FORMS   += mainwindow.ui
RESOURCES += my.qrc
```

解析后项目树：

```
second
  |- second.pro
  |- Headers/
  |    |- mainwindow.h
  |- Sources/
  |    |- main.cpp
  |    |- mainwindow.cpp
  |- Forms/
  |    |- mainwindow.ui
  |- Resources/
       |- my.qrc
```

---

## 6. 参考项目

- eide-master：`F:\Software\VsCode_Project\plugin_project\eide-master`（架构参考）
- VS Code Extension API：https://code.visualstudio.com/api
- qmake Variable Reference：https://doc.qt.io/qt-5/qmake-variable-reference.html
