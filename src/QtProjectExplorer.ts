import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProFileParser } from './ProFileParser';
import { CmakeFileParser } from './CmakeFileParser';
import { QtProjectData, QtTreeItem, TreeItemType } from './QtTypeDefine';
import { QtideConfigManager } from './QtideConfig';

class OperationDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (element) {
            return [];
        }

        const items: vscode.TreeItem[] = [];

        const openItem = new vscode.TreeItem('Open Project', vscode.TreeItemCollapsibleState.None);
        openItem.command = {
            command: 'qtide.openProject',
            title: 'Open Project'
        };
        openItem.iconPath = new vscode.ThemeIcon('folder-opened');
        openItem.tooltip = 'Open a Qt workspace (.code-workspace)';
        items.push(openItem);

        const newItem = new vscode.TreeItem('New Project', vscode.TreeItemCollapsibleState.None);
        newItem.command = {
            command: 'qtide.newProject',
            title: 'New Project'
        };
        newItem.iconPath = new vscode.ThemeIcon('new-file');
        newItem.tooltip = 'Create a new Qt project';
        items.push(newItem);

        const importItem = new vscode.TreeItem('Import Project', vscode.TreeItemCollapsibleState.None);
        importItem.command = {
            command: 'qtide.importProject',
            title: 'Import Project'
        };
        importItem.iconPath = new vscode.ThemeIcon('cloud-download');
        importItem.tooltip = 'Import a Qt project (.pro or CMakeLists.txt)';
        items.push(importItem);

        const settingsItem = new vscode.TreeItem('Open Qtide Settings', vscode.TreeItemCollapsibleState.None);
        settingsItem.command = {
            command: 'qtide.openSettings',
            title: 'Open Qtide Settings'
        };
        settingsItem.iconPath = new vscode.ThemeIcon('gear');
        settingsItem.tooltip = 'Open Qtide settings panel';
        items.push(settingsItem);

        return items;
    }
}

class ProjectDataProvider implements vscode.TreeDataProvider<QtTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<QtTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private projects: QtProjectData[] = [];
    private dirExpandStates = new Map<string, boolean>();

    setDirExpandState(key: string, expanded: boolean): void {
        this.dirExpandStates.set(key, expanded);
    }

    getDirExpandState(key: string): boolean {
        return this.dirExpandStates.get(key) ?? false;
    }

    clearDirExpandStates(): void {
        this.dirExpandStates.clear();
    }

    setProjects(projects: QtProjectData[]): void {
        this.projects = projects;
        this.dirExpandStates.clear();
        this._onDidChangeTreeData.fire(undefined);
    }

    getProjects(): QtProjectData[] {
        return [...this.projects];
    }

    addOrUpdateProject(data: QtProjectData): void {
        const index = this.projects.findIndex(p => p.projectFilePath === data.projectFilePath);
        if (index >= 0) {
            this.projects[index] = data;
        } else {
            this.projects.push(data);
        }
        this._onDidChangeTreeData.fire(undefined);
    }

    removeProject(projectFilePath: string): void {
        const before = this.projects.length;
        this.projects = this.projects.filter(p => p.projectFilePath !== projectFilePath);
        if (this.projects.length !== before) {
            this.dirExpandStates.clear();
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    getTreeItem(element: QtTreeItem): vscode.TreeItem {
        return element;
    }

    refreshItem(item: QtTreeItem): void {
        this._onDidChangeTreeData.fire(item);
    }

    getChildren(element?: QtTreeItem): vscode.ProviderResult<QtTreeItem[]> {
        if (!element) {
            if (this.projects.length === 0) {
                return [];
            }
            return this.projects.map(data => new QtTreeItem(
                data.name,
                TreeItemType.PROJECT,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            ));
        }

        switch (element.type) {
            case TreeItemType.PROJECT:
                return this.getProjectChildren(element.projectData);

            case TreeItemType.HEADERS_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.headers, TreeItemType.HEADERS_GROUP);

            case TreeItemType.SOURCES_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.sources, TreeItemType.SOURCES_GROUP);

            case TreeItemType.FORMS_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.forms, TreeItemType.FORMS_GROUP);

            case TreeItemType.RESOURCES_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.resources, TreeItemType.RESOURCES_GROUP);

            case TreeItemType.OTHER_FILES_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.translations || [], TreeItemType.OTHER_FILES_GROUP);

            case TreeItemType.DIR_GROUP:
                return this.getDirGroupChildren(element);

            default:
                return [];
        }
    }

    private getProjectChildren(data: QtProjectData): QtTreeItem[] {
        const children: QtTreeItem[] = [];

        children.push(new QtTreeItem(
            path.basename(data.projectFilePath),
            TreeItemType.PRO_FILE,
            data,
            vscode.TreeItemCollapsibleState.None
        ));

        if (data.headers.length > 0) {
            const headersGroup = new QtTreeItem(
                'Headers',
                TreeItemType.HEADERS_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(headersGroup);
        }

        if (data.sources.length > 0) {
            const sourcesGroup = new QtTreeItem(
                'Sources',
                TreeItemType.SOURCES_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(sourcesGroup);
        }

        if (data.forms.length > 0) {
            const formsGroup = new QtTreeItem(
                'Forms',
                TreeItemType.FORMS_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(formsGroup);
        }

        if (data.resources.length > 0) {
            const resourcesGroup = new QtTreeItem(
                'Resources',
                TreeItemType.RESOURCES_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(resourcesGroup);
        }

        const translationFiles = data.translations || [];
        if (translationFiles.length > 0) {
            const otherFilesGroup = new QtTreeItem(
                'Other files',
                TreeItemType.OTHER_FILES_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(otherFilesGroup);
        }

        return children;
    }

    private getFileChildren(
        projectData: QtProjectData,
        files: string[],
        groupType: TreeItemType
    ): QtTreeItem[] {
        const fileType = this.getFileTypeForGroup(groupType);
        const projectFileDir = projectData.projectFileDir;

        const relDirs = files.map(f => {
            const absDir = path.resolve(projectFileDir, path.dirname(f));
            return path.relative(projectFileDir, absDir).replace(/\\/g, '/');
        });

        const dirSet = new Set(relDirs);
        dirSet.delete('.');
        const commonBase = this.findCommonPrefix([...dirSet]);

        const dirMap = new Map<string, string[]>();
        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            let dir = relDirs[i];

            if (commonBase && dir.startsWith(commonBase)) {
                const suffix = dir.slice(commonBase.length);
                dir = suffix.startsWith('/') ? suffix.slice(1) : '__root__';
                if (dir.length === 0) dir = '__root__';
            } else if (dir === '.') {
                dir = '__root__';
            }

            if (!dirMap.has(dir)) {
                dirMap.set(dir, []);
            }
            dirMap.get(dir)!.push(filePath);
        }

        const dirKeys = [...dirMap.keys()].filter(k => k !== '__root__');

        if (dirKeys.length === 1 && !dirMap.has('__root__')) {
            const flatFiles = dirMap.get(dirKeys[0])!;
            return flatFiles.map(fp => new QtTreeItem(
                path.basename(fp),
                fileType,
                projectData,
                vscode.TreeItemCollapsibleState.None,
                fp
            ));
        }

        const result: QtTreeItem[] = [];

        const rootFiles = dirMap.get('__root__');
        if (rootFiles) {
            for (const fp of rootFiles) {
                result.push(new QtTreeItem(
                    path.basename(fp),
                    fileType,
                    projectData,
                    vscode.TreeItemCollapsibleState.None,
                    fp
                ));
            }
        }

        for (const dirKey of dirKeys) {
            const fullDir = commonBase ? commonBase + '/' + dirKey : dirKey;
            const stateKey = `${projectData.projectFilePath}:${groupType}:${fullDir}`;
            const wasExpanded = this.getDirExpandState(stateKey);
            const dirNode = new QtTreeItem(
                path.basename(dirKey),
                TreeItemType.DIR_GROUP,
                projectData,
                wasExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                groupType,
                fullDir
            );
            dirNode.updateExpandIcon(wasExpanded);
            result.push(dirNode);
        }

        return result;
    }

    private findCommonPrefix(dirs: string[]): string | undefined {
        if (dirs.length <= 1) return undefined;
        const parts = dirs.map(d => d.split('/'));
        const minLen = Math.min(...parts.map(p => p.length));
        if (minLen === 0) return undefined;
        const common: string[] = [];
        for (let i = 0; i < minLen; i++) {
            const p = parts[0][i];
            if (parts.every(arr => arr[i] === p)) {
                common.push(p);
            } else {
                break;
            }
        }
        return common.length > 0 ? common.join('/') : undefined;
    }

    private getDirGroupChildren(element: QtTreeItem): QtTreeItem[] {
        const { projectData, dirPath, parentGroupType } = element;
        if (!dirPath || !parentGroupType) return [];

        const fileType = this.getFileTypeForGroup(parentGroupType);
        const files = this.getFilesForGroup(projectData, parentGroupType);

        return files
            .filter(f => {
                const absDir = path.resolve(projectData.projectFileDir, path.dirname(f));
                const relDir = path.relative(projectData.projectFileDir, absDir).replace(/\\/g, '/');
                return relDir === dirPath;
            })
            .map(filePath => new QtTreeItem(
                path.basename(filePath),
                fileType,
                projectData,
                vscode.TreeItemCollapsibleState.None,
                filePath
            ));
    }

    private getFileTypeForGroup(groupType: TreeItemType): TreeItemType {
        switch (groupType) {
            case TreeItemType.HEADERS_GROUP: return TreeItemType.HEADER_FILE;
            case TreeItemType.SOURCES_GROUP: return TreeItemType.SOURCE_FILE;
            case TreeItemType.FORMS_GROUP: return TreeItemType.FORM_FILE;
            case TreeItemType.RESOURCES_GROUP: return TreeItemType.RESOURCE_FILE;
            case TreeItemType.OTHER_FILES_GROUP: return TreeItemType.OTHER_FILE;
            default: return TreeItemType.HEADER_FILE;
        }
    }

    private getFilesForGroup(projectData: QtProjectData, groupType: TreeItemType): string[] {
        switch (groupType) {
            case TreeItemType.HEADERS_GROUP: return projectData.headers;
            case TreeItemType.SOURCES_GROUP: return projectData.sources;
            case TreeItemType.FORMS_GROUP: return projectData.forms;
            case TreeItemType.RESOURCES_GROUP: return projectData.resources;
            case TreeItemType.OTHER_FILES_GROUP: return projectData.translations || [];
            default: return [];
        }
    }
}

export class QtProjectExplorer {

    private operationProvider: OperationDataProvider;
    private projectProvider: ProjectDataProvider;

    private operationView: vscode.TreeView<vscode.TreeItem>;
    private projectView: vscode.TreeView<QtTreeItem>;

    private fileWatchers: vscode.FileSystemWatcher[] = [];
    private refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();

    private settingsPanel: vscode.WebviewPanel | undefined;

    private workspaceRoot: string | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.operationProvider = new OperationDataProvider();
        this.projectProvider = new ProjectDataProvider();

        this.operationView = vscode.window.createTreeView('qtide.view.operations', {
            treeDataProvider: this.operationProvider
        });

        this.projectView = vscode.window.createTreeView('qtide.view.project', {
            treeDataProvider: this.projectProvider
        });

        context.subscriptions.push(this.operationView);
        context.subscriptions.push(this.projectView);

        context.subscriptions.push(
            this.projectView.onDidExpandElement(e => {
                const item = e.element as QtTreeItem;
                if (item.type === TreeItemType.DIR_GROUP) {
                    const key = `${item.projectData.projectFilePath}:${item.parentGroupType}:${item.dirPath}`;
                    this.projectProvider.setDirExpandState(key, true);
                }
                if (QtTreeItem.iconMap?.[item.type]) {
                    item.updateExpandIcon(true);
                    this.projectProvider.refreshItem(item);
                }
            })
        );

        context.subscriptions.push(
            this.projectView.onDidCollapseElement(e => {
                const item = e.element as QtTreeItem;
                if (item.type === TreeItemType.DIR_GROUP) {
                    const key = `${item.projectData.projectFilePath}:${item.parentGroupType}:${item.dirPath}`;
                    this.projectProvider.setDirExpandState(key, false);
                }
                if (QtTreeItem.iconMap?.[item.type]) {
                    item.updateExpandIcon(false);
                    this.projectProvider.refreshItem(item);
                }
            })
        );

        this.workspaceRoot = this.resolveWorkspaceRoot();
        void this.scanWorkspace();
    }

    private resolveWorkspaceRoot(): string | undefined {
        if (vscode.workspace.workspaceFile) {
            return path.dirname(vscode.workspace.workspaceFile.fsPath);
        }
        if (vscode.workspace.workspaceFolders?.length) {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        return undefined;
    }

    async scanWorkspace(): Promise<void> {
        this.workspaceRoot = this.resolveWorkspaceRoot();
        if (!this.workspaceRoot || !vscode.workspace.workspaceFolders?.length) {
            return;
        }

        const [proUris, cmakeUris] = await Promise.all([
            vscode.workspace.findFiles(
                '**/*.pro',
                '{**/node_modules/**,**/.git/**,**/build/**,**/out/**}'
            ),
            vscode.workspace.findFiles(
                '**/CMakeLists.txt',
                '{**/node_modules/**,**/.git/**,**/build/**,**/out/**}'
            ),
        ]);

        const allUris = [...proUris, ...cmakeUris];

        if (allUris.length === 0) {
            return;
        }

        const tracked: vscode.Uri[] = [];
        const untracked: vscode.Uri[] = [];

        for (const uri of allUris) {
            if (QtideConfigManager.isTracked(uri.fsPath)) {
                tracked.push(uri);
            } else {
                untracked.push(uri);
            }
        }

        for (const uri of tracked) {
            await this.loadProject(uri.fsPath, { silent: true });
        }

        if (untracked.length === 0) {
            return;
        }

        if (untracked.length === 1) {
            const name = path.basename(untracked[0].fsPath, '.pro');
            await this.loadProject(untracked[0].fsPath, { silent: true });
            QtideConfigManager.save(untracked[0].fsPath, name);
            vscode.window.showInformationMessage(`Loaded Qt project: ${name}`);
            return;
        }

        await this.promptProjectSelection(untracked);
    }

    private async promptProjectSelection(uris: vscode.Uri[]): Promise<void> {
        const allItem: vscode.QuickPickItem & { isAll?: boolean; uri?: vscode.Uri } = {
            label: 'All Projects',
            description: `Load all ${uris.length} projects`,
            isAll: true,
        };

        const projItems: (vscode.QuickPickItem & { isAll?: boolean; uri?: vscode.Uri })[] = uris.map(uri => {
            const fileName = path.basename(uri.fsPath);
            const name = fileName === 'CMakeLists.txt'
                ? path.basename(path.dirname(uri.fsPath))
                : path.basename(uri.fsPath, '.pro');
            const dir = path.relative(this.workspaceRoot!, path.dirname(uri.fsPath));
            return {
                label: name,
                description: dir,
                detail: uri.fsPath,
                uri,
            };
        });

        const items = [...projItems, allItem];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a project to load (Enter to confirm, ESC to cancel)',
            title: 'Qtide - Select Projects',
        });

        if (!selected) {
            vscode.window.showInformationMessage('No projects loaded.');
            return;
        }

        if (selected.isAll) {
            for (const uri of uris) {
                await this.loadProject(uri.fsPath, { silent: true });
                const fileName = path.basename(uri.fsPath);
                const name = fileName === 'CMakeLists.txt'
                    ? path.basename(path.dirname(uri.fsPath))
                    : path.basename(uri.fsPath, '.pro');
                QtideConfigManager.save(uri.fsPath, name);
            }
            return;
        }

        await this.loadProject(selected.uri!.fsPath);
        QtideConfigManager.save(selected.uri!.fsPath, selected.label);
    }

    async removeProject(item?: QtTreeItem): Promise<void> {
        if (!item || item.type !== TreeItemType.PROJECT) {
            return;
        }

        const projectFilePath = item.projectData.projectFilePath;
        const projectName = item.projectData.name;

        const confirm = await vscode.window.showWarningMessage(
            `Remove project "${projectName}" from Qtide?`,
            { modal: true },
            'Remove'
        );

        if (confirm !== 'Remove') {
            return;
        }

        this.projectProvider.removeProject(projectFilePath);
        this.clearRefreshTimer(projectFilePath);
        this.setupWatchers();

        QtideConfigManager.remove(projectFilePath);

        vscode.window.showInformationMessage(`Project "${projectName}" removed.`);
    }

    async importProject(): Promise<void> {
        const typePicks: (vscode.QuickPickItem & { projectType: 'qmake' | 'cmake' })[] = [
            { label: 'qmake (.pro)', description: 'Import a Qt qmake project from a .pro file', projectType: 'qmake' },
            { label: 'CMake (CMakeLists.txt)', description: 'Import a CMake project', projectType: 'cmake' },
        ];

        const selectedType = await vscode.window.showQuickPick(typePicks, {
            title: 'Qtide - Select Project Type',
            placeHolder: 'Select the project file type to import...',
        });

        if (!selectedType) {
            return;
        }

        let filters: { [name: string]: string[] };
        let dialogTitle: string;

        if (selectedType.projectType === 'qmake') {
            filters = { 'Qt Project Files': ['pro'] };
            dialogTitle = 'Select Qt .pro file';
        } else {
            filters = { 'CMake Project file (CMakeLists.txt)': ['txt'] };
            dialogTitle = 'Select CMakeLists.txt';
        }

        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters,
            title: dialogTitle,
        });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        const fileName = path.basename(filePath);

        if (selectedType.projectType === 'cmake') {
            if (fileName !== 'CMakeLists.txt' && fileName !== 'CMakeCache.txt') {
                vscode.window.showWarningMessage(
                    `Expected CMakeLists.txt, got "${fileName}". Loading anyway.`
                );
            }
            await this.loadProject(uris[0].fsPath);
            QtideConfigManager.save(uris[0].fsPath, path.basename(path.dirname(uris[0].fsPath)));
        } else {
            await this.loadProject(uris[0].fsPath);
            QtideConfigManager.save(uris[0].fsPath, path.basename(uris[0].fsPath, '.pro'));
        }
    }

    async openProject(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'VS Code Workspace': ['code-workspace']
            },
            title: 'Open Qt Workspace (.code-workspace)'
        });

        if (!uris || uris.length === 0) {
            return;
        }

        const targetPath = uris[0].fsPath;

        if (vscode.workspace.workspaceFile &&
            vscode.workspace.workspaceFile.fsPath === targetPath) {
            vscode.window.showInformationMessage('This workspace is already open.');
            return;
        }

        await vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(targetPath),
            false
        );
    }

    async newProject(): Promise<void> {
        vscode.window.showInformationMessage('New Project: Feature under development.');
    }

    async openSettings(): Promise<void> {
        if (this.settingsPanel) {
            this.settingsPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'qtide.settings',
            'Qtide Settings',
            vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.iconPath = vscode.Uri.joinPath(QtTreeItem.extensionUri, 'res', 'icon', 'qtide.svg');

        const settingsDir = path.join(QtTreeItem.extensionUri.fsPath, 'res', 'html', 'settings');
        const htmlFile = path.join(settingsDir, 'index.html');
        let html = fs.readFileSync(htmlFile, 'utf-8');
        html = html.replace(
            /((?:src|href)=")([^"]+?\.(?:css|js))(")/gi,
            (_, prefix, filePath, suffix) => {
                const absPath = path.resolve(settingsDir, filePath);
                return `${prefix}${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}${suffix}`;
            }
        );
        panel.webview.html = html;

        const settingsModel = {
            config: {
                groups: [
                    {
                        label: 'General',
                        id: 'general',
                        fields: [
                            { key: 'projectName', label: 'Project Name', type: 'text', value: '', description: 'Default project name for new projects' },
                            { key: 'buildDir', label: 'Build Directory', type: 'text', value: 'build', description: 'Default build output directory' },
                            { key: 'qtVersion', label: 'Qt Version', type: 'dropdown', value: '6.5', options: [{ label: 'Qt 5.15', value: '5.15' }, { label: 'Qt 6.2', value: '6.2' }, { label: 'Qt 6.5', value: '6.5' }, { label: 'Qt 6.6', value: '6.6' }] }
                        ]
                    },
                    {
                        label: 'Editor',
                        id: 'editor',
                        fields: [
                            { key: 'autoComplete', label: 'Auto-complete', type: 'checkbox', value: true, description: 'Enable code auto-completion' },
                            { key: 'formatOnSave', label: 'Format on Save', type: 'checkbox', value: false, description: 'Auto-format files when saving' },
                            { key: 'tabSize', label: 'Tab Size', type: 'dropdown', value: '4', options: [{ label: '2 spaces', value: '2' }, { label: '4 spaces', value: '4' }, { label: '8 spaces', value: '8' }] }
                        ]
                    },
                    {
                        label: 'Build',
                        id: 'build',
                        fields: [
                            { key: 'buildJobs', label: 'Parallel Jobs', type: 'dropdown', value: '4', options: [{ label: '1 job', value: '1' }, { label: '2 jobs', value: '2' }, { label: '4 jobs', value: '4' }, { label: '8 jobs', value: '8' }] },
                            { key: 'makeFlags', label: 'Make Flags', type: 'textarea', value: '', description: 'Additional flags for make' },
                            { key: 'cleanBeforeBuild', label: 'Clean before build', type: 'checkbox', value: false, description: 'Run clean target before building' }
                        ]
                    }
                ]
            }
        };

        panel.webview.onDidReceiveMessage(async (msg: any) => {
            if (typeof msg === 'string') {
                if (msg === 'qtide.settings.launched') {
                    panel.webview.postMessage(settingsModel);
                }
            }
        });

        panel.onDidDispose(() => {
            this.settingsPanel = undefined;
        });

        this.settingsPanel = panel;
    }

    async loadProject(
        filePath: string,
        options?: { silent?: boolean }
    ): Promise<void> {
        const ext = path.extname(filePath).toLowerCase();
        const data = ext === '.pro'
            ? ProFileParser.parse(filePath)
            : CmakeFileParser.parse(filePath);

        if (!data) {
            if (!options?.silent) {
                vscode.window.showErrorMessage(`Failed to parse project file: ${path.basename(filePath)}`);
            }
            return;
        }

        this.projectProvider.addOrUpdateProject(data);
        this.setupWatchers();

        if (!options?.silent) {
            console.log(
                `Project "${data.name}" loaded. ` +
                `Sources: ${data.sources.length}, Headers: ${data.headers.length}, ` +
                `Forms: ${data.forms.length}, Resources: ${data.resources.length}`
            );
            await this.promptSaveWorkspace(data);
        }
    }

    private async promptSaveWorkspace(data: QtProjectData): Promise<void> {
        const projectTypeLabel = data.projectType === 'cmake' ? 'CMake' : 'qmake';
        const selection = await vscode.window.showInformationMessage(
            `[${projectTypeLabel}] Project "${data.name}" imported. Continue to auto-save workspace, Cancel to choose custom path.`,
            'Continue', 'Cancel'
        );

        let targetPath: string | undefined;

        if (selection === 'Continue') {
            targetPath = path.join(data.projectFileDir, `${data.name}.code-workspace`);
        } else if (selection === 'Cancel') {
            const defaultUri = vscode.Uri.file(
                path.join(data.projectFileDir, `${data.name}.code-workspace`)
            );
            const uri = await vscode.window.showSaveDialog({
                defaultUri,
                filters: { 'VS Code Workspace': ['code-workspace'] },
                title: 'Save Workspace File As'
            });
            if (uri) {
                targetPath = uri.fsPath;
            }
        }

        if (targetPath) {
            const workspaceContent = {
                folders: [{ path: '.' }],
                settings: {}
            };
            try {
                fs.writeFileSync(targetPath, JSON.stringify(workspaceContent, null, 4));

                const openSelection = await vscode.window.showInformationMessage(
                    `Workspace file saved: ${path.basename(targetPath)}. Open it in VS Code?`,
                    'Yes', 'Later'
                );
                if (openSelection === 'Yes') {
                    await vscode.commands.executeCommand(
                        'vscode.openFolder',
                        vscode.Uri.file(targetPath),
                        false
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to save workspace file: ${error}`
                );
            }
        }
    }

    async refreshAllProjects(): Promise<void> {
        const projects = this.projectProvider.getProjects();
        if (projects.length === 0) {
            vscode.window.showWarningMessage('No project is currently opened.');
            return;
        }

        for (const proj of projects) {
            await this.loadProject(proj.projectFilePath, { silent: true });
        }

        vscode.window.showInformationMessage(
            projects.length === 1
                ? 'Project refreshed.'
                : `${projects.length} projects refreshed.`
        );
    }

    async openTreeFile(item?: QtTreeItem): Promise<void> {
        if (!item) {
            return;
        }
        const uri = item.getUri();
        if (uri) {
            await vscode.commands.executeCommand('vscode.open', uri);
        }
    }

    async revealInExplorer(item?: QtTreeItem): Promise<void> {
        if (!item) {
            return;
        }
        const uri = item.getUri();
        if (uri) {
            await vscode.commands.executeCommand('revealFileInOS', uri);
        }
    }

    async copyPath(item?: QtTreeItem): Promise<void> {
        if (!item) {
            return;
        }
        const absPath = item.getAbsolutePath();
        if (!absPath) {
            return;
        }
        await vscode.env.clipboard.writeText(absPath);
        vscode.window.showInformationMessage('Path copied to clipboard.');
    }

    getCurrentProject(): QtProjectData | null {
        const projects = this.projectProvider.getProjects();
        return projects.length > 0 ? projects[0] : null;
    }

    getProjects(): QtProjectData[] {
        return this.projectProvider.getProjects();
    }

    private setupWatchers(): void {
        this.disposeWatchers();

        for (const proj of this.projectProvider.getProjects()) {
            const projectWatcher = vscode.workspace.createFileSystemWatcher(proj.projectFilePath);
            projectWatcher.onDidChange(() => this.scheduleProjectRefresh(proj.projectFilePath));
            projectWatcher.onDidCreate(() => this.scheduleProjectRefresh(proj.projectFilePath));
            projectWatcher.onDidDelete(() => this.onProjectFileDeleted(proj.projectFilePath));
            this.fileWatchers.push(projectWatcher);

            const dirPattern = new vscode.RelativePattern(
                vscode.Uri.file(proj.projectFileDir),
                '**/*'
            );
            const dirWatcher = vscode.workspace.createFileSystemWatcher(dirPattern);
            dirWatcher.onDidChange(uri => this.onProjectDirChanged(proj.projectFilePath, uri));
            dirWatcher.onDidCreate(uri => this.onProjectDirChanged(proj.projectFilePath, uri));
            dirWatcher.onDidDelete(uri => this.onProjectDirChanged(proj.projectFilePath, uri));
            this.fileWatchers.push(dirWatcher);
        }
    }

    private onProjectFileDeleted(filePath: string): void {
        this.projectProvider.removeProject(filePath);
        this.clearRefreshTimer(filePath);
        this.setupWatchers();
        QtideConfigManager.remove(filePath);
        vscode.window.showWarningMessage(`Removed project: ${path.basename(filePath)}`);
    }

    private onProjectDirChanged(filePath: string, uri: vscode.Uri): void {
        const basename = path.basename(uri.fsPath).toLowerCase();
        if (basename.endsWith('.pro') || basename === 'cmakelists.txt') {
            return;
        }
        this.scheduleProjectRefresh(filePath);
    }

    private scheduleProjectRefresh(projectFilePath: string): void {
        const existing = this.refreshTimers.get(projectFilePath);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.refreshTimers.delete(projectFilePath);
            void this.loadProject(projectFilePath, { silent: true });
        }, 300);

        this.refreshTimers.set(projectFilePath, timer);
    }

    private clearRefreshTimer(projectFilePath: string): void {
        const timer = this.refreshTimers.get(projectFilePath);
        if (timer) {
            clearTimeout(timer);
            this.refreshTimers.delete(projectFilePath);
        }
    }

    private disposeWatchers(): void {
        for (const watcher of this.fileWatchers) {
            watcher.dispose();
        }
        this.fileWatchers = [];
    }

    dispose(): void {
        for (const timer of this.refreshTimers.values()) {
            clearTimeout(timer);
        }
        this.refreshTimers.clear();
        this.disposeWatchers();
        this.operationView.dispose();
        this.projectView.dispose();
    }
}









