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

    type: TreeItemType;
    projectData: QtProjectData;
    /** 文件相对路径（仅 FILE 类型节点使用） */
    filePath?: string;

    constructor(
        label: string,
        type: TreeItemType,
        projectData: QtProjectData,
        collapsibleState: vscode.TreeItemCollapsibleState,
        filePath?: string
    ) {
        super(label, collapsibleState);
        this.type = type;
        this.projectData = projectData;
        this.filePath = filePath;

        this.setupAppearance();
    }

    private setupAppearance(): void {
        switch (this.type) {
            case TreeItemType.PROJECT:
                this.iconPath = new vscode.ThemeIcon('project');
                this.contextValue = 'project';
                this.description = this.projectData.name;
                this.tooltip = `${this.projectData.name}
Path: ${this.projectData.proFileDir}
Sources: ${this.projectData.sources.length} | Headers: ${this.projectData.headers.length} | Forms: ${this.projectData.forms.length} | Resources: ${this.projectData.resources.length}`;
                break;

            case TreeItemType.PRO_FILE:
                this.iconPath = new vscode.ThemeIcon('gear');
                this.contextValue = 'qtFile';
                this.description = 'Project File';
                this.tooltip = `Qt Project File\n${this.projectData.proFilePath}`;
                this.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(this.projectData.proFilePath)]
                };
                break;

            case TreeItemType.HEADERS_GROUP:
                this.iconPath = new vscode.ThemeIcon('symbol-struct');
                this.contextValue = 'headersGroup';
                this.description = `${this.projectData.headers.length} files`;
                this.tooltip = `Headers (${this.projectData.headers.length} files)\n${this.projectData.headers.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.SOURCES_GROUP:
                this.iconPath = new vscode.ThemeIcon('symbol-class');
                this.contextValue = 'sourcesGroup';
                this.description = `${this.projectData.sources.length} files`;
                this.tooltip = `Sources (${this.projectData.sources.length} files)\n${this.projectData.sources.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.FORMS_GROUP:
                this.iconPath = new vscode.ThemeIcon('symbol-interface');
                this.contextValue = 'formsGroup';
                this.description = `${this.projectData.forms.length} files`;
                this.tooltip = `Forms (${this.projectData.forms.length} files)\n${this.projectData.forms.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.RESOURCES_GROUP:
                this.iconPath = new vscode.ThemeIcon('symbol-misc');
                this.contextValue = 'resourcesGroup';
                this.description = `${this.projectData.resources.length} files`;
                this.tooltip = `Resources (${this.projectData.resources.length} files)\n${this.projectData.resources.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.HEADER_FILE:
                this.iconPath = new vscode.ThemeIcon('symbol-field');
                this.contextValue = 'qtFile';
                this.description = 'Header';
                this.setFileCommand();
                break;

            case TreeItemType.SOURCE_FILE:
                this.iconPath = new vscode.ThemeIcon('symbol-method');
                this.contextValue = 'qtFile';
                this.description = 'Source';
                this.setFileCommand();
                break;

            case TreeItemType.FORM_FILE:
                this.iconPath = new vscode.ThemeIcon('symbol-property');
                this.contextValue = 'qtFile';
                this.description = 'UI Form';
                this.setFileCommand();
                break;

            case TreeItemType.RESOURCE_FILE:
                this.iconPath = new vscode.ThemeIcon('symbol-enum');
                this.contextValue = 'qtFile';
                this.description = 'Resource';
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

            // 根据文件类型设置不同的工具提示
            let fileTypeInfo = '';
            switch (this.type) {
                case TreeItemType.HEADER_FILE:
                    fileTypeInfo = 'Header File';
                    break;
                case TreeItemType.SOURCE_FILE:
                    fileTypeInfo = 'Source File';
                    break;
                case TreeItemType.FORM_FILE:
                    fileTypeInfo = 'UI Form File';
                    break;
                case TreeItemType.RESOURCE_FILE:
                    fileTypeInfo = 'Resource File';
                    break;
            }

            this.tooltip = `${fileTypeInfo}\n${fullPath}`;
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
