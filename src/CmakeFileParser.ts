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

        const vars = CmakeFileParser.initBuiltinVars(cmakeFileDir, cmakeFilePath, commands);
        const userVars = CmakeFileParser.buildVariableMap(commands, cmakeFileDir);
        for (const [key, value] of userVars) {
            if ((key === 'PROJECT_NAME' || key === 'CMAKE_PROJECT_NAME') && vars.has(key)) continue;
            vars.set(key, value);
        }
        const resolvedVars = CmakeFileParser.resolveReferences(vars);

        const resolvedProjName = resolvedVars.get('PROJECT_NAME');
        const projName = (resolvedProjName && resolvedProjName.length > 0
            && !resolvedProjName[0].includes('${'))
            ? resolvedProjName[0]
            : (CmakeFileParser.extractProjectName(commands) || path.basename(cmakeFileDir));

        const { headers, sources, forms, resources, translations } =
            CmakeFileParser.extractFiles(resolvedVars, cmakeFileDir);

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

    private static initBuiltinVars(
        cmakeFileDir: string,
        cmakeFilePath: string,
        commands: { name: string; args: string }[]
    ): Map<string, string[]> {
        const vars = new Map<string, string[]>();
        vars.set('CMAKE_CURRENT_SOURCE_DIR', [cmakeFileDir]);
        vars.set('CMAKE_CURRENT_BINARY_DIR', [cmakeFileDir]);
        vars.set('CMAKE_CURRENT_LIST_DIR', [cmakeFileDir]);
        vars.set('CMAKE_CURRENT_LIST_FILE', [cmakeFilePath]);
        vars.set('CMAKE_CURRENT_LIST_LINE', ['0']);
        vars.set('CMAKE_SOURCE_DIR', [cmakeFileDir]);
        vars.set('CMAKE_BINARY_DIR', [cmakeFileDir]);

        const projCmd = commands.find(c => c.name.toLowerCase() === 'project');
        if (projCmd) {
            const args = CmakeFileParser.splitArgs(projCmd.args);
            const projName = args.length > 0 ? CmakeFileParser.stripQuotes(args[0]) : '';
            if (!projName.includes('${')) {
                vars.set('PROJECT_NAME', [projName]);
                vars.set('CMAKE_PROJECT_NAME', [projName]);
            }
            vars.set('PROJECT_SOURCE_DIR', [cmakeFileDir]);
            vars.set('PROJECT_BINARY_DIR', [cmakeFileDir]);
        }

        return vars;
    }

    private static buildVariableMap(
        commands: { name: string; args: string }[],
        cmakeFileDir: string
    ): Map<string, string[]> {
        const vars = new Map<string, string[]>();
        for (const cmd of commands) {
            const lowerName = cmd.name.toLowerCase();
            if (lowerName === 'set') {
                const args = CmakeFileParser.splitArgs(cmd.args);
                if (args.length < 2) continue;

                const varName = CmakeFileParser.stripQuotes(args[0]);
                vars.set(varName, args.slice(1).map(v => CmakeFileParser.stripQuotes(v)));
            } else if (lowerName === 'get_filename_component') {
                const args = CmakeFileParser.splitArgs(cmd.args);
                if (args.length < 3) continue;

                const varName = CmakeFileParser.stripQuotes(args[0]);
                let filePath = CmakeFileParser.stripQuotes(args[1]);
                const mode = CmakeFileParser.stripQuotes(args[2]).toUpperCase();

                filePath = filePath
                    .replace(/\$\{CMAKE_CURRENT_SOURCE_DIR\}/g, cmakeFileDir)
                    .replace(/\$\{CMAKE_CURRENT_LIST_DIR\}/g, cmakeFileDir);

                let value: string;
                switch (mode) {
                    case 'NAME':      value = path.basename(filePath); break;
                    case 'DIRECTORY':
                    case 'PATH':      value = path.dirname(filePath); break;
                    case 'NAME_WE':   value = path.basename(filePath, path.extname(filePath)); break;
                    case 'EXT':       value = path.extname(filePath); break;
                    default:          value = filePath; break;
                }
                vars.set(varName, [value]);
            }
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
        for (const [key, values] of resolved) {
            const expanded: string[] = [];
            for (const v of values) {
                expanded.push(...CmakeFileParser.expandVar(v, resolved));
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

    private static normalizePath(filePath: string, cmakeFileDir: string): string {
        let cleaned = filePath.replace(/\$\{[^}]+\}[\/\\]?/g, '');
        if (cleaned && cleaned !== filePath) {
            return cleaned.replace(/\\/g, '/');
        }
        if (path.isAbsolute(filePath)) {
            return path.relative(cmakeFileDir, filePath).replace(/\\/g, '/');
        }
        return filePath.replace(/\\/g, '/');
    }

    private static extractFiles(vars: Map<string, string[]>, cmakeFileDir: string): {
        headers: string[]; sources: string[]; forms: string[];
        resources: string[]; translations: string[];
    } {
        const knownFileVars = ['PROJECT_SOURCES', 'SOURCES', 'PROJECT_HEADERS', 'HEADERS', 'PROJECT_FORMS', 'FORMS', 'PROJECT_RESOURCES', 'RESOURCES', 'TRANSLATIONS', 'TS_FILES'];
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
            const normalized = CmakeFileParser.normalizePath(file, cmakeFileDir);
            if (!normalized) continue;
            const ext = path.extname(normalized).toLowerCase();
            switch (ext) {
                case '.h': case '.hpp': case '.hxx': case '.hh':
                    headers.push(normalized);
                    break;
                case '.cpp': case '.c': case '.cc': case '.cxx': case '.c++':
                    sources.push(normalized);
                    break;
                case '.ui':
                    forms.push(normalized);
                    break;
                case '.qrc':
                    resources.push(normalized);
                    break;
                case '.ts': case '.qm':
                    translations.push(normalized);
                    break;
                default:
                    if (!ext) {
                        sources.push(normalized);
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
