import * as vscode from 'vscode';
import * as path from 'path';
import { ProFileParser } from './ProFileParser';
import { QtProjectData, QtTreeItem, TreeItemType } from './QtTypeDefine';

/**
 * 操作视图的 TreeDataProvider
 * 显示三个操作按钮：Open Project / New Project / Import Project
 */
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
        importItem.iconPath = new vscode.ThemeIcon('file-add');
        importItem.tooltip = 'Import a Qt project from a .pro file';
        items.push(importItem);

        return items;
    }
}

/**
 * 项目树视图的 TreeDataProvider
 * 支持多项目根节点
 */
class ProjectDataProvider implements vscode.TreeDataProvider<QtTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<QtTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private projects: QtProjectData[] = [];

    setProjects(projects: QtProjectData[]): void {
        this.projects = projects;
        this._onDidChangeTreeData.fire(undefined);
    }

    getProjects(): QtProjectData[] {
        return [...this.projects];
    }

    addOrUpdateProject(data: QtProjectData): void {
        const index = this.projects.findIndex(p => p.proFilePath === data.proFilePath);
        if (index >= 0) {
            this.projects[index] = data;
        } else {
            this.projects.push(data);
        }
        this._onDidChangeTreeData.fire(undefined);
    }

    removeProject(proFilePath: string): void {
        const before = this.projects.length;
        this.projects = this.projects.filter(p => p.proFilePath !== proFilePath);
        if (this.projects.length !== before) {
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    getTreeItem(element: QtTreeItem): vscode.TreeItem {
        return element;
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
                return this.getFileChildren(element.projectData, element.projectData.headers, TreeItemType.HEADER_FILE);

            case TreeItemType.SOURCES_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.sources, TreeItemType.SOURCE_FILE);

            case TreeItemType.FORMS_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.forms, TreeItemType.FORM_FILE);

            case TreeItemType.RESOURCES_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.resources, TreeItemType.RESOURCE_FILE);

            default:
                return [];
        }
    }

    private getProjectChildren(data: QtProjectData): QtTreeItem[] {
        const children: QtTreeItem[] = [];

        // .pro 文件节点
        children.push(new QtTreeItem(
            path.basename(data.proFilePath),
            TreeItemType.PRO_FILE,
            data,
            vscode.TreeItemCollapsibleState.None
        ));

        // Headers 分组
        if (data.headers.length > 0) {
            const headersGroup = new QtTreeItem(
                'Headers',
                TreeItemType.HEADERS_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(headersGroup);
        }

        // Sources 分组
        if (data.sources.length > 0) {
            const sourcesGroup = new QtTreeItem(
                'Sources',
                TreeItemType.SOURCES_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(sourcesGroup);
        }

        // Forms 分组
        if (data.forms.length > 0) {
            const formsGroup = new QtTreeItem(
                'Forms',
                TreeItemType.FORMS_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(formsGroup);
        }

        // Resources 分组
        if (data.resources.length > 0) {
            const resourcesGroup = new QtTreeItem(
                'Resources',
                TreeItemType.RESOURCES_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            );
            children.push(resourcesGroup);
        }

        return children;
    }

    private getFileChildren(
        projectData: QtProjectData,
        files: string[],
        fileType: TreeItemType
    ): QtTreeItem[] {
        return files.map(filePath => new QtTreeItem(
            path.basename(filePath),
            fileType,
            projectData,
            vscode.TreeItemCollapsibleState.None,
            filePath
        ));
    }
}

/**
 * Qt 项目资源管理器
 */
export class QtProjectExplorer {

    private operationProvider: OperationDataProvider;
    private projectProvider: ProjectDataProvider;

    private operationView: vscode.TreeView<vscode.TreeItem>;
    private projectView: vscode.TreeView<QtTreeItem>;

    private fileWatchers: vscode.FileSystemWatcher[] = [];
    private refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

        void this.scanWorkspace();
    }

    /**
     * 扫描工作区中的 .pro 文件并加载
     */
    async scanWorkspace(): Promise<void> {
        if (!vscode.workspace.workspaceFolders?.length) {
            return;
        }

        const proFiles = await vscode.workspace.findFiles(
            '**/*.pro',
            '{**/node_modules/**,**/.git/**,**/build/**,**/out/**}'
        );

        for (const uri of proFiles) {
            await this.loadProject(uri.fsPath, { silent: true });
        }
    }

    async importProject(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            filters: {
                'Qt Project Files': ['pro']
            },
            title: 'Select Qt .pro file(s)'
        });

        if (!uris || uris.length === 0) {
            return;
        }

        for (const uri of uris) {
            await this.loadProject(uri.fsPath);
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

        await vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(uris[0].fsPath)
        );
    }

    async newProject(): Promise<void> {
        vscode.window.showInformationMessage('New Project: Feature under development.');
    }

    async loadProject(
        proFilePath: string,
        options?: { silent?: boolean }
    ): Promise<void> {
        const data = ProFileParser.parse(proFilePath);

        if (!data) {
            if (!options?.silent) {
                vscode.window.showErrorMessage(`Failed to parse .pro file: ${proFilePath}`);
            }
            return;
        }

        this.projectProvider.addOrUpdateProject(data);
        this.setupWatchers();

        if (!options?.silent) {
            vscode.window.showInformationMessage(
                `Project "${data.name}" loaded. ` +
                `Sources: ${data.sources.length}, Headers: ${data.headers.length}, ` +
                `Forms: ${data.forms.length}, Resources: ${data.resources.length}`
            );
        }
    }

    async refreshAllProjects(): Promise<void> {
        const projects = this.projectProvider.getProjects();
        if (projects.length === 0) {
            vscode.window.showWarningMessage('No project is currently opened.');
            return;
        }

        for (const proj of projects) {
            await this.loadProject(proj.proFilePath, { silent: true });
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
            const proWatcher = vscode.workspace.createFileSystemWatcher(proj.proFilePath);
            proWatcher.onDidChange(() => this.scheduleProjectRefresh(proj.proFilePath));
            proWatcher.onDidCreate(() => this.scheduleProjectRefresh(proj.proFilePath));
            proWatcher.onDidDelete(() => this.onProFileDeleted(proj.proFilePath));
            this.fileWatchers.push(proWatcher);

            const dirPattern = new vscode.RelativePattern(
                vscode.Uri.file(proj.proFileDir),
                '**/*'
            );
            const dirWatcher = vscode.workspace.createFileSystemWatcher(dirPattern);
            dirWatcher.onDidChange(uri => this.onProjectDirChanged(proj.proFilePath, uri));
            dirWatcher.onDidCreate(uri => this.onProjectDirChanged(proj.proFilePath, uri));
            dirWatcher.onDidDelete(uri => this.onProjectDirChanged(proj.proFilePath, uri));
            this.fileWatchers.push(dirWatcher);
        }
    }

    private onProFileDeleted(proFilePath: string): void {
        this.projectProvider.removeProject(proFilePath);
        this.clearRefreshTimer(proFilePath);
        this.setupWatchers();
        vscode.window.showWarningMessage(`Removed project: ${path.basename(proFilePath)}`);
    }

    private onProjectDirChanged(proFilePath: string, uri: vscode.Uri): void {
        const basename = path.basename(uri.fsPath).toLowerCase();
        if (basename.endsWith('.pro')) {
            return;
        }
        this.scheduleProjectRefresh(proFilePath);
    }

    private scheduleProjectRefresh(proFilePath: string): void {
        const existing = this.refreshTimers.get(proFilePath);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.refreshTimers.delete(proFilePath);
            void this.loadProject(proFilePath, { silent: true });
        }, 300);

        this.refreshTimers.set(proFilePath, timer);
    }

    private clearRefreshTimer(proFilePath: string): void {
        const timer = this.refreshTimers.get(proFilePath);
        if (timer) {
            clearTimeout(timer);
            this.refreshTimers.delete(proFilePath);
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
