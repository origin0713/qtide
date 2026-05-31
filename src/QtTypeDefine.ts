import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 树节点类型枚举
 */
export enum TreeItemType {
    PROJECT,
    PRO_FILE,
    HEADERS_GROUP,
    SOURCES_GROUP,
    FORMS_GROUP,
    RESOURCES_GROUP,
    DIR_GROUP,
    HEADER_FILE,
    SOURCE_FILE,
    FORM_FILE,
    RESOURCE_FILE,
}

/**
 * .pro 文件解析后的项目数据结构
 */
export interface QtProjectData {
    /** 工程名称 (TARGET) */
    name: string;
    /** .pro 文件的绝对路径 */
    proFilePath: string;
    /** .pro 文件所在目录的绝对路径 */
    proFileDir: string;
    /** HEADERS 文件列表（相对路径） */
    headers: string[];
    /** SOURCES 文件列表（相对路径） */
    sources: string[];
    /** FORMS 文件列表（相对路径） */
    forms: string[];
    /** RESOURCES 文件列表（相对路径） */
    resources: string[];
}

/**
 * 自定义 TreeItem，携带节点类型和项目数据
 */
export class QtTreeItem extends vscode.TreeItem {

    static extensionUri: vscode.Uri;

    type: TreeItemType;
    projectData: QtProjectData;
    filePath?: string;
    parentGroupType?: TreeItemType;
    dirPath?: string;

    constructor(
        label: string,
        type: TreeItemType,
        projectData: QtProjectData,
        collapsibleState: vscode.TreeItemCollapsibleState,
        filePath?: string,
        parentGroupType?: TreeItemType,
        dirPath?: string
    ) {
        super(label, collapsibleState);
        this.type = type;
        this.projectData = projectData;
        this.filePath = filePath;
        this.parentGroupType = parentGroupType;
        this.dirPath = dirPath;

        this.setupAppearance();
    }

    static iconMap: Record<string, { open: string; close: string }> = {
        [TreeItemType.PROJECT]: { open: 'qt_open.svg', close: 'qt_close.svg' },
        [TreeItemType.HEADERS_GROUP]: { open: 'h_open.svg', close: 'h_close.svg' },
        [TreeItemType.SOURCES_GROUP]: { open: 'cpp_open.svg', close: 'cpp_close.svg' },
        [TreeItemType.FORMS_GROUP]: { open: 'pen_open.svg', close: 'pen_close.svg' },
        [TreeItemType.RESOURCES_GROUP]: { open: 'res_open.svg', close: 'res_close.svg' },
        [TreeItemType.DIR_GROUP]: { open: 'dir_open.svg', close: 'dir_close.svg' },
    };

    private setExpandableIcon(isExpanded: boolean): void {
        const pair = QtTreeItem.iconMap[this.type];
        if (pair) {
            this.iconPath = vscode.Uri.joinPath(
                QtTreeItem.extensionUri, 'res', 'icon',
                isExpanded ? pair.open : pair.close
            );
        }
    }

    updateExpandIcon(isExpanded: boolean): void {
        this.setExpandableIcon(isExpanded);
    }

    private setupAppearance(): void {
        switch (this.type) {
            case TreeItemType.PROJECT:
                this.setExpandableIcon(true);
                this.contextValue = 'project';
                this.tooltip = `Name: ${this.projectData.name}\nPath: ${this.projectData.proFileDir}`;
                break;

            case TreeItemType.PRO_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.projectData.proFilePath);
                this.contextValue = 'qtFile';
                this.tooltip = `${this.projectData.proFilePath}`;
                this.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(this.projectData.proFilePath)]
                };
                break;

            case TreeItemType.HEADERS_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'headersGroup';
                this.tooltip = `Headers (${this.projectData.headers.length} files)\n${this.projectData.headers.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.SOURCES_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'sourcesGroup';
                this.tooltip = `Sources (${this.projectData.sources.length} files)\n${this.projectData.sources.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.FORMS_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'formsGroup';
                this.tooltip = `Forms (${this.projectData.forms.length} files)\n${this.projectData.forms.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.RESOURCES_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'resourcesGroup';
                this.tooltip = `Resources (${this.projectData.resources.length} files)\n${this.projectData.resources.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.DIR_GROUP:
                this.setExpandableIcon(false);
                this.contextValue = 'dirGroup';
                this.tooltip = this.dirPath;
                break;

            case TreeItemType.HEADER_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;

            case TreeItemType.SOURCE_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;

            case TreeItemType.FORM_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;

            case TreeItemType.RESOURCE_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;
        }
    }

    private setFileCommand(): void {
        if (this.filePath) {
            const fullPath = path.join(this.projectData.proFileDir, this.filePath);
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(fullPath)]
            };

            this.tooltip = fullPath;
        }
    }

    /**
     * 判断节点类型是否为文件项
     */
    static isFileType(type: TreeItemType): boolean {
        return type === TreeItemType.PRO_FILE ||
            type === TreeItemType.HEADER_FILE ||
            type === TreeItemType.SOURCE_FILE ||
            type === TreeItemType.FORM_FILE ||
            type === TreeItemType.RESOURCE_FILE;
    }

    /** Full path for file items (relative filePath + project dir); panics if filePath is undefined */
    private getFullPath(): string {
        return path.join(this.projectData.proFileDir, this.filePath!);
    }

    /** Absolute path for file nodes; undefined for groups and project root */
    getAbsolutePath(): string | undefined {
        if (this.type === TreeItemType.PRO_FILE) {
            return this.projectData.proFilePath;
        }
        if (this.filePath) {
            return path.join(this.projectData.proFileDir, this.filePath);
        }
        return undefined;
    }

    getUri(): vscode.Uri | undefined {
        const absPath = this.getAbsolutePath();
        return absPath ? vscode.Uri.file(absPath) : undefined;
    }
}

