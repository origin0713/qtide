import * as path from 'path';
import * as fs from 'fs';

export class QtideConfigManager {
    static readonly CONFIG_DIR = '.qtide';
    static readonly CONFIG_FILE = 'qtide.json';

    static getConfigDir(projectDir: string): string {
        return path.join(projectDir, QtideConfigManager.CONFIG_DIR);
    }

    static getConfigPath(projectDir: string): string {
        return path.join(projectDir, QtideConfigManager.CONFIG_DIR, QtideConfigManager.CONFIG_FILE);
    }

    static isTracked(projectFilePath: string): boolean {
        const configPath = QtideConfigManager.getConfigPath(path.dirname(projectFilePath));
        try {
            if (fs.existsSync(configPath)) {
                const raw = fs.readFileSync(configPath, 'utf-8');
                const config = JSON.parse(raw);
                return config && config.version && (
                    config.projectFilePath === projectFilePath ||
                    config.proFilePath === projectFilePath
                );
            }
        } catch {
        }
        return false;
    }

    static save(projectFilePath: string, name: string): void {
        const projectDir = path.dirname(projectFilePath);
        const configDir = QtideConfigManager.getConfigDir(projectDir);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const config = { version: 1, projectFilePath, name };
        fs.writeFileSync(QtideConfigManager.getConfigPath(projectDir), JSON.stringify(config, null, 4));
    }

    static remove(projectFilePath: string): void {
        const configPath = QtideConfigManager.getConfigPath(path.dirname(projectFilePath));
        try {
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }
        } catch {
        }
    }
}
