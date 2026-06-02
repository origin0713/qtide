import * as path from 'path';
import { ProjectType, QtProjectData } from './QtTypeDefine';

export class CmakeFileParser {

    static parse(cmakeFilePath: string): QtProjectData | null {
        const fs = require('fs');

        let content: string;
        try {
            content = fs.readFileSync(cmakeFilePath, 'utf-8');
        } catch (err) {
            console.error(`Failed to read CMake file: ${cmakeFilePath}`, err);
            return null;
        }

        const cmakeFileDir = path.dirname(cmakeFilePath);

        const cleanContent = CmakeFileParser.removeComments(content);
        const commands = CmakeFileParser.parseCommands(cleanContent);
        const vars = CmakeFileParser.buildVariableMap(commands);
        const resolvedVars = CmakeFileParser.resolveReferences(vars);

        const name = CmakeFileParser.extractProjectName(commands);
        const projName = name || path.basename(cmakeFileDir);

        const { headers, sources, forms, resources, translations } =
            CmakeFileParser.extractFiles(resolvedVars);

        return {
            name: projName,
            projectType: ProjectType.CMAKE,
            projectFilePath: cmakeFilePath,
            projectFileDir: cmakeFileDir,
            headers,
            sources,
            forms,
            resources,
            translations: translations.length > 0 ? translations : undefined,
        };
    }

    private static removeComments(content: string): string {
        let result = content.replace(/#\[\[[\s\S]*?\]\]/g, '');

        const lines = result.split('\n');
        return lines.map(line => {
            let inString = false;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') inString = !inString;
                if (line[i] === '#' && !inString) {
                    return line.substring(0, i);
                }
            }
            return line;
        }).join('\n');
    }

    private static parseCommands(content: string): { name: string; args: string }[] {
        const commands: { name: string; args: string }[] = [];
        const cmdRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
        let match: RegExpExecArray | null;

        while ((match = cmdRegex.exec(content)) !== null) {
            const name = match[1];
            const startIdx = match.index + match[0].length;
            const endIdx = CmakeFileParser.findClosingParen(content, startIdx);
            if (endIdx === -1) continue;

            const args = content.substring(startIdx, endIdx).trim();
            commands.push({ name, args });
            cmdRegex.lastIndex = endIdx + 1;
        }

        return commands;
    }

    private static findClosingParen(content: string, start: number): number {
        let depth = 1;
        let inString = false;
        let escape = false;

        for (let i = start; i < content.length; i++) {
            const char = content[i];
            if (escape) { escape = false; continue; }
            if (char === '\\' && inString) { escape = true; continue; }
            if (char === '"') { inString = !inString; continue; }
            if (!inString) {
                if (char === '(') depth++;
                else if (char === ')') {
                    depth--;
                    if (depth === 0) return i;
                }
            }
        }
        return -1;
    }

    private static extractProjectName(commands: { name: string; args: string }[]): string | null {
        const projectCmd = commands.find(cmd => cmd.name.toLowerCase() === 'project');
        if (!projectCmd) return null;

        const args = CmakeFileParser.splitArgs(projectCmd.args);
        return args.length > 0 ? CmakeFileParser.stripQuotes(args[0]) : null;
    }

    private static buildVariableMap(commands: { name: string; args: string }[]): Map<string, string[]> {
        const vars = new Map<string, string[]>();
        for (const cmd of commands) {
            if (cmd.name.toLowerCase() !== 'set') continue;
            const args = CmakeFileParser.splitArgs(cmd.args);
            if (args.length < 2) continue;

            const varName = CmakeFileParser.stripQuotes(args[0]);
            vars.set(varName, args.slice(1).map(v => CmakeFileParser.stripQuotes(v)));
        }
        return vars;
    }

    private static resolveReferences(vars: Map<string, string[]>): Map<string, string[]> {
        const resolved = new Map<string, string[]>();
        for (const [key, values] of vars) {
            const expanded: string[] = [];
            for (const v of values) {
                expanded.push(...CmakeFileParser.expandVar(v, vars));
            }
            resolved.set(key, expanded);
        }
        return resolved;
    }

    private static expandVar(value: string, vars: Map<string, string[]>): string[] {
        const varMatch = value.match(/^\$\{(\w+)\}$/);
        if (varMatch) {
            const ref = vars.get(varMatch[1]);
            if (ref) return [...ref];
            return [value];
        }
        const expanded = value.replace(/\$\{(\w+)\}/g, (match, varName) => {
            const ref = vars.get(varName);
            return ref && ref.length > 0 ? ref[0] : match;
        });
        return [expanded];
    }

    private static extractFiles(vars: Map<string, string[]>): {
        headers: string[]; sources: string[]; forms: string[];
        resources: string[]; translations: string[];
    } {
        const knownFileVars = ['PROJECT_SOURCES', 'SOURCES', 'HEADERS', 'FORMS', 'RESOURCES', 'TRANSLATIONS', 'TS_FILES'];
        const allFilesMap = new Map<string, string>();
        for (const varName of knownFileVars) {
            const resolvedName = CmakeFileParser.resolveVarName(varName, vars);
            const values = vars.get(resolvedName);
            if (values) {
                for (const v of values) {
                    if (v.length > 0 && !v.startsWith('-')) {
                        allFilesMap.set(v, v);
                    }
                }
            }
        }

        const headers: string[] = [];
        const sources: string[] = [];
        const forms: string[] = [];
        const resources: string[] = [];
        const translations: string[] = [];

        for (const file of allFilesMap.keys()) {
            const ext = path.extname(file).toLowerCase();
            switch (ext) {
                case '.h': case '.hpp': case '.hxx': case '.hh':
                    headers.push(file);
                    break;
                case '.cpp': case '.c': case '.cc': case '.cxx': case '.c++':
                    sources.push(file);
                    break;
                case '.ui':
                    forms.push(file);
                    break;
                case '.qrc':
                    resources.push(file);
                    break;
                case '.ts': case '.qm':
                    translations.push(file);
                    break;
                default:
                    if (!ext) {
                        sources.push(file);
                    }
                    break;
            }
        }

        return { headers, sources, forms, resources, translations };
    }

    private static resolveVarName(varName: string, vars: Map<string, string[]>): string {
        if (vars.has(varName)) return varName;
        for (const key of vars.keys()) {
            if (key.toLowerCase() === varName.toLowerCase()) return key;
        }
        return varName;
    }

    private static stripQuotes(s: string): string {
        if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
            return s.slice(1, -1);
        }
        return s;
    }

    private static splitArgs(args: string): string[] {
        const result: string[] = [];
        let current = '';
        let inString = false;
        let escape = false;

        for (const char of args) {
            if (escape) { current += char; escape = false; continue; }
            if (char === '\\' && inString) { escape = true; continue; }
            if (char === '"') { inString = !inString; current += char; continue; }
            if (!inString && (char === ' ' || char === '\t' || char === '\n' || char === '\r')) {
                if (current.length > 0) {
                    result.push(current);
                    current = '';
                }
                continue;
            }
            current += char;
        }
        if (current.length > 0) result.push(current);

        return result;
    }
}
