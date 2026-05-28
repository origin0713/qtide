import * as path from 'path';
import { QtProjectData } from './QtTypeDefine';

/**
 * .pro 文件解析器
 * 解析 qmake 工程文件，提取项目名称、源文件、头文件、UI文件和资源文件列表
 */
export class ProFileParser {

    /**
     * 解析 .pro 文件
     * @param proFilePath .pro 文件的绝对路径
     * @returns 解析后的项目数据，解析失败返回 null
     */
    static parse(proFilePath: string): QtProjectData | null {
        const fs = require('fs');

        let content: string;
        try {
            content = fs.readFileSync(proFilePath, 'utf-8');
        } catch (err) {
            console.error(`Failed to read .pro file: ${proFilePath}`, err);
            return null;
        }

        const proFileDir = path.dirname(proFilePath);
        const proFileName = path.basename(proFilePath);

        // 预处理：合并续行、去除注释
        const lines = ProFileParser.preprocess(content);

        // 解析变量
        const vars = ProFileParser.parseVariables(lines);

        // 提取 TARGET
        const targetArr = vars['TARGET'];
        const target = (targetArr && targetArr.length > 0) ? targetArr[0] : path.basename(proFileName, '.pro');

        // 构建项目数据
        const data: QtProjectData = {
            name: target,
            proFilePath: proFilePath,
            proFileDir: proFileDir,
            headers: vars['HEADERS'] || [],
            sources: vars['SOURCES'] || [],
            forms: vars['FORMS'] || [],
            resources: vars['RESOURCES'] || [],
        };

        return data;
    }

    /**
     * 预处理 .pro 文件内容：
     * 1. 去除注释（# 开头的部分）
     * 2. 合并续行（行末 \ 表示下一行继续）
     * @returns 处理后的行数组
     */
    private static preprocess(content: string): string[] {
        const rawLines = content.split(/\r?\n/);
        const mergedLines: string[] = [];
        let currentLine = '';

        for (const rawLine of rawLines) {
            let line = ProFileParser.stripComment(rawLine);
            const trimmed = line.trim();

            if (trimmed.length === 0) {
                if (currentLine.trim().length > 0) {
                    mergedLines.push(currentLine.trim());
                    currentLine = '';
                }
                continue;
            }

            if (trimmed.endsWith('\\')) {
                currentLine += trimmed.slice(0, -1).trimEnd() + ' ';
            } else {
                currentLine += trimmed;
                mergedLines.push(currentLine);
                currentLine = '';
            }
        }

        if (currentLine.trim().length > 0) {
            mergedLines.push(currentLine.trim());
        }

        return mergedLines;
    }

    /**
     * 去除行内注释
     * 简单处理：找到第一个 # 并截断（不考虑引号内情况）
     */
    private static stripComment(line: string): string {
        const commentIdx = line.indexOf('#');
        if (commentIdx >= 0) {
            return line.substring(0, commentIdx);
        }
        return line;
    }

    /**
     * 解析变量赋值
     * 支持：
     * - VAR = value
     * - VAR += value
     * - 变量值中的空格分隔多个文件
     */
    private static parseVariables(lines: string[]): Record<string, string[]> {
        const vars: Record<string, string[]> = {};

        for (const line of lines) {
            // 匹配 VAR = value 或 VAR += value
            const match = line.match(/^(\w+)\s*(\+?=)\s*(.*)$/);
            if (!match) {
                continue;
            }

            const varName = match[1];
            const operator = match[2]; // '=' or '+='
            const rawValue = match[3].trim();

            if (rawValue.length === 0) {
                continue;
            }

            // 按空格分割值
            const values = rawValue.split(/\s+/).filter(v => v.length > 0);

            if (operator === '+=') {
                // 追加模式
                if (!vars[varName]) {
                    vars[varName] = [];
                }
                vars[varName].push(...values);
            } else {
                // 赋值模式
                vars[varName] = values;
            }
        }

        return vars;
    }
}

