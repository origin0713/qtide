import * as vscode from 'vscode';
import { QtProjectExplorer } from './QtProjectExplorer';

let projectExplorer: QtProjectExplorer;

export function activate(context: vscode.ExtensionContext) {
    console.log('Qtide extension is now active!');

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
        vscode.commands.registerCommand('qtide.refreshProject', () => {
            const proj = projectExplorer.getCurrentProject();
            if (proj) {
                projectExplorer.loadProject(proj.proFilePath);
                vscode.window.showInformationMessage('Project refreshed.');
            } else {
                vscode.window.showWarningMessage('No project is currently opened.');
            }
        })
    );
}

export function deactivate() {
    if (projectExplorer) {
        projectExplorer.dispose();
    }
}
