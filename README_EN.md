# Qtide

[中文](README.md)

VS Code extension for browsing Qt projects (qmake / CMake) with a Qt Creator-like sidebar tree.

### Features

- **Import** — QuickPick type selector for qmake (.pro) or CMake (CMakeLists.txt)
- **Project tree** — Headers / Sources / Forms / Resources / **Other files** groups
- **Other files** — Translations (.ts / .qm) shown in a dedicated group
- **Workspace prompt** — Save `.code-workspace` after import, custom path supported
- **Auto-discover** — `.pro` and `CMakeLists.txt` in workspace are auto-loaded

![alt text](.resource/qtide.png)

### Usage

1. Click **Import Project** in the Operations view
2. Choose **qmake (.pro)** or **CMake (CMakeLists.txt)**
3. Select the project file
4. The file tree appears below
5. Optionally save the workspace file

### Acknowledgments

Thanks to [eide](https://github.com/github0null/eide) — design and code reference.

### Build

```bash
# Build extension
npm install
npm run compile

# Build settings panel (Node.js required)
cd webview/settings
npm install
npm run build
```

### License

MIT
