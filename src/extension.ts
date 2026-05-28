import * as vscode from 'vscode';
import * as path from 'path';
import { QtProjectExplorer } from './QtProjectExplorer';
import { QtTreeItem } from './QtTypeDefine';

let projectExplorer: QtProjectExplorer;

async function promptToOpenWorkspaceForPro(proFilePath: string): Promise<void> {
    const fs = require('fs') as typeof import('fs');

    const dir = path.dirname(proFilePath);
    const baseName = path.basename(proFilePath, '.pro');

    // 首选与 .pro 同名的 .code-workspace
    const preferredWorkspace = path.join(dir, `${baseName}.code-workspace`);

    let workspacePath: string | undefined;

    if (fs.existsSync(preferredWorkspace)) {
        workspacePath = preferredWorkspace;
    } else {
        // 否则查找当前目录下任意 .code-workspace
        try {
            const entries = fs.readdirSync(dir);
            const wsName = entries.find(name => name.toLowerCase().endsWith('.code-workspace'));
            if (wsName) {
                workspacePath = path.join(dir, wsName);
            }
        } catch {
            // ignore fs errors and just return
        }
    }

    if (!workspacePath) {
        return;
    }

    // 如果当前已经打开的是同一个 workspace，则不提示
    if (vscode.workspace.workspaceFile &&
        vscode.workspace.workspaceFile.fsPath === workspacePath) {
        return;
    }

    const workspaceName = path.basename(workspacePath);
    const selection = await vscode.window.showInformationMessage(
        `Detected workspace file "${workspaceName}" for this Qt project. Do you want to open it?`,
        'Open Workspace',
        'Cancel'
    );

    if (selection === 'Open Workspace') {
        await vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(workspacePath)
        );
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Qtide extension is now active!');

    QtTreeItem.extensionUri = context.extensionUri;

    // 创建项目资源管理器（操作视图 + 项目树视图）
    projectExplorer = new QtProjectExplorer(context);

    // 注册命令
    context.subscriptions.push(
        vscode.commands.registerCommand('qtide.openProject', () => {
            projectExplorer.openProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('qtide.newProject', () => {
            projectExplorer.newProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('qtide.importProject', () => {
            projectExplorer.importProject();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('qtide.openSettings', () => {
            projectExplorer.openSettings();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('qtide.refreshProject', () => {
            void projectExplorer.refreshAllProjects();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('qtide.openTreeFile', (item?: QtTreeItem) => {
            void projectExplorer.openTreeFile(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('qtide.revealInExplorer', (item?: QtTreeItem) => {
            void projectExplorer.revealInExplorer(item);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('qtide.copyPath', (item?: QtTreeItem) => {
            void projectExplorer.copyPath(item);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            void projectExplorer.scanWorkspace();
        })
    );

    // 当用户在编辑器中打开 .pro 文件时，检测并提示关联的 .code-workspace
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            const filePath = doc.fileName;
            if (filePath.toLowerCase().endsWith('.pro')) {
                void promptToOpenWorkspaceForPro(filePath);
            }
        })
    );
}

export function deactivate() {
    if (projectExplorer) {
        projectExplorer.dispose();
    }
}
