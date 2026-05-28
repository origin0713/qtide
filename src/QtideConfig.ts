import * as path from 'path';
import * as fs from 'fs';

export class QtideConfigManager {
    static readonly CONFIG_DIR = '.qtide';
    static readonly CONFIG_FILE = 'qtide.json';

    static getConfigDir(proDir: string): string {
        return path.join(proDir, QtideConfigManager.CONFIG_DIR);
    }

    static getConfigPath(proDir: string): string {
        return path.join(proDir, QtideConfigManager.CONFIG_DIR, QtideConfigManager.CONFIG_FILE);
    }

    static isTracked(proFilePath: string): boolean {
        const configPath = QtideConfigManager.getConfigPath(path.dirname(proFilePath));
        try {
            if (fs.existsSync(configPath)) {
                const raw = fs.readFileSync(configPath, 'utf-8');
                const config = JSON.parse(raw);
                return config && config.version && config.proFilePath === proFilePath;
            }
        } catch {
        }
        return false;
    }

    static save(proFilePath: string, name: string): void {
        const proDir = path.dirname(proFilePath);
        const configDir = QtideConfigManager.getConfigDir(proDir);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const config = { version: 1, proFilePath, name };
        fs.writeFileSync(QtideConfigManager.getConfigPath(proDir), JSON.stringify(config, null, 4));
    }

    static remove(proFilePath: string): void {
        const configPath = QtideConfigManager.getConfigPath(path.dirname(proFilePath));
        try {
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }
        } catch {
        }
    }
}
