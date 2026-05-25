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
                this.iconPath = vscode.ThemeIcon.Folder;
                this.contextValue = 'project';
                break;

            case TreeItemType.PRO_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.contextValue = 'proFile';
                this.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(this.projectData.proFilePath)]
                };
                break;

            case TreeItemType.HEADERS_GROUP:
                this.iconPath = vscode.ThemeIcon.Folder;
                this.contextValue = 'headersGroup';
                break;

            case TreeItemType.SOURCES_GROUP:
                this.iconPath = vscode.ThemeIcon.Folder;
                this.contextValue = 'sourcesGroup';
                break;

            case TreeItemType.FORMS_GROUP:
                this.iconPath = vscode.ThemeIcon.Folder;
                this.contextValue = 'formsGroup';
                break;

            case TreeItemType.RESOURCES_GROUP:
                this.iconPath = vscode.ThemeIcon.Folder;
                this.contextValue = 'resourcesGroup';
                break;

            case TreeItemType.HEADER_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.contextValue = 'headerFile';
                this.setFileCommand();
                break;

            case TreeItemType.SOURCE_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.contextValue = 'sourceFile';
                this.setFileCommand();
                break;

            case TreeItemType.FORM_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.contextValue = 'formFile';
                this.setFileCommand();
                break;

            case TreeItemType.RESOURCE_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.contextValue = 'resourceFile';
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
}
