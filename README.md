# Qtide

[中文](README_CN.md)

Qtide is a VS Code extension that parses and browses Qt `.pro` project files, providing a Qt Creator-like project file tree view.

### Features

- **Import .pro project** — Import a Qt `.pro` file via file picker, automatically parse TARGET, SOURCES, HEADERS, FORMS, RESOURCES
- **Project file tree** — Display headers, sources, UI forms and resources in grouped sidebar views with expand/collapse support
- **Workspace prompt** — Ask whether to save a `.code-workspace` file after successful import, with custom save path support
- **Open workspace** — Switch VS Code workspace via `.code-workspace` files
- **Settings panel** — Grouped settings UI (General / Editor / Build), currently feature preview

![alt text](.resource/qtide.png)

### Usage

1. Click **Import Project** in the Operations view
2. Select a `.pro` file
3. The project file tree appears below
4. Optionally save the workspace file when prompted

### Acknowledgments

Thanks to the [eide](https://github.com/github0null/eide) project, whose design and code were referenced during the development of this project.

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
