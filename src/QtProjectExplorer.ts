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

        // Open Project
        const openItem = new vscode.TreeItem('Open Project', vscode.TreeItemCollapsibleState.None);
        openItem.command = {
            command: 'qtide.openProject',
            title: 'Open Project'
        };
        openItem.iconPath = new vscode.ThemeIcon('folder-opened');
        openItem.tooltip = 'Open an existing Qt project (.pro file)';
        items.push(openItem);

        // New Project
        const newItem = new vscode.TreeItem('New Project', vscode.TreeItemCollapsibleState.None);
        newItem.command = {
            command: 'qtide.newProject',
            title: 'New Project'
        };
        newItem.iconPath = new vscode.ThemeIcon('new-file');
        newItem.tooltip = 'Create a new Qt project';
        items.push(newItem);

        // Import Project
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
 * 显示解析后的项目文件结构
 */
class ProjectDataProvider implements vscode.TreeDataProvider<QtTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<QtTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private projectData: QtProjectData | null = null;

    setProjectData(data: QtProjectData | null): void {
        this.projectData = data;
        this._onDidChangeTreeData.fire(undefined);
    }

    getProjectData(): QtProjectData | null {
        return this.projectData;
    }

    getTreeItem(element: QtTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: QtTreeItem): vscode.ProviderResult<QtTreeItem[]> {
        if (!this.projectData) {
            return [];
        }

        if (!element) {
            // 根节点：返回项目节点
            const projectNode = new QtTreeItem(
                this.projectData.name,
                TreeItemType.PROJECT,
                this.projectData,
                vscode.TreeItemCollapsibleState.Expanded
            );
            return [projectNode];
        }

        switch (element.type) {
            case TreeItemType.PROJECT:
                return this.getProjectChildren();

            case TreeItemType.HEADERS_GROUP:
                return this.getFileChildren(this.projectData.headers, TreeItemType.HEADER_FILE);

            case TreeItemType.SOURCES_GROUP:
                return this.getFileChildren(this.projectData.sources, TreeItemType.SOURCE_FILE);

            case TreeItemType.FORMS_GROUP:
                return this.getFileChildren(this.projectData.forms, TreeItemType.FORM_FILE);

            case TreeItemType.RESOURCES_GROUP:
                return this.getFileChildren(this.projectData.resources, TreeItemType.RESOURCE_FILE);

            default:
                return [];
        }
    }

    /**
     * 构建项目根节点的子节点：
     * .pro 文件 + Headers / Sources / Forms / Resources 四个分组
     */
    private getProjectChildren(): QtTreeItem[] {
        const data = this.projectData!;
        const children: QtTreeItem[] = [];

        // .pro 文件
        children.push(new QtTreeItem(
            path.basename(data.proFilePath),
            TreeItemType.PRO_FILE,
            data,
            vscode.TreeItemCollapsibleState.None
        ));

        // Headers 分组
        if (data.headers.length > 0) {
            children.push(new QtTreeItem(
                'Headers',
                TreeItemType.HEADERS_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            ));
        }

        // Sources 分组
        if (data.sources.length > 0) {
            children.push(new QtTreeItem(
                'Sources',
                TreeItemType.SOURCES_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            ));
        }

        // Forms 分组
        if (data.forms.length > 0) {
            children.push(new QtTreeItem(
                'Forms',
                TreeItemType.FORMS_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            ));
        }

        // Resources 分组
        if (data.resources.length > 0) {
            children.push(new QtTreeItem(
                'Resources',
                TreeItemType.RESOURCES_GROUP,
                data,
                vscode.TreeItemCollapsibleState.Expanded
            ));
        }

        return children;
    }

    /**
     * 根据文件列表和类型构建文件子节点
     */
    private getFileChildren(files: string[], fileType: TreeItemType): QtTreeItem[] {
        return files.map(filePath => new QtTreeItem(
            path.basename(filePath),
            fileType,
            this.projectData!,
            vscode.TreeItemCollapsibleState.None,
            filePath
        ));
    }
}

/**
 * Qt 项目资源管理器
 * 管理操作视图和项目树视图
 */
export class QtProjectExplorer {

    private operationProvider: OperationDataProvider;
    private projectProvider: ProjectDataProvider;

    private operationView: vscode.TreeView<vscode.TreeItem>;
    private projectView: vscode.TreeView<QtTreeItem>;

    constructor(context: vscode.ExtensionContext) {
        // 创建 DataProvider
        this.operationProvider = new OperationDataProvider();
        this.projectProvider = new ProjectDataProvider();

        // 创建 TreeView
        this.operationView = vscode.window.createTreeView('qtide.view.operations', {
            treeDataProvider: this.operationProvider
        });

        this.projectView = vscode.window.createTreeView('qtide.view.project', {
            treeDataProvider: this.projectProvider
        });

        // 注册 View 到 subscriptions 以便释放
        context.subscriptions.push(this.operationView);
        context.subscriptions.push(this.projectView);
    }

    /**
     * 导入项目：让用户选择 .pro 文件并解析
     */
    async importProject(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Qt Project Files': ['pro']
            },
            title: 'Select a Qt .pro file'
        });

        if (!uris || uris.length === 0) {
            return; // 用户取消
        }

        const proFilePath = uris[0].fsPath;
        await this.loadProject(proFilePath);
    }

    /**
     * 打开项目：让用户选择 .pro 文件并解析
     */
    async openProject(): Promise<void> {
        await this.importProject();
    }

    /**
     * 新建项目（占位）
     */
    async newProject(): Promise<void> {
        vscode.window.showInformationMessage('New Project: Feature under development.');
    }

    /**
     * 加载并解析 .pro 文件
     */
    async loadProject(proFilePath: string): Promise<void> {
        const data = ProFileParser.parse(proFilePath);

        if (!data) {
            vscode.window.showErrorMessage(`Failed to parse .pro file: ${proFilePath}`);
            return;
        }

        this.projectProvider.setProjectData(data);

        vscode.window.showInformationMessage(
            `Project "${data.name}" loaded. ` +
            `Sources: ${data.sources.length}, Headers: ${data.headers.length}, ` +
            `Forms: ${data.forms.length}, Resources: ${data.resources.length}`
        );
    }

    /**
     * 获取当前项目数据
     */
    getCurrentProject(): QtProjectData | null {
        return this.projectProvider.getProjectData();
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.operationView.dispose();
        this.projectView.dispose();
    }
}
