import * as path from 'path';
import { ProjectType, QtProjectData } from './QtTypeDefine';
import { classifyFiles } from './CmakeUtils';

function removeComments(content: string): string {
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

function findClosingParen(content: string, start: number): number {
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

function parseCommands(content: string): { name: string; args: string }[] {
    const commands: { name: string; args: string }[] = [];
    const cmdRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = cmdRegex.exec(content)) !== null) {
        const name = match[1];
        const startIdx = match.index + match[0].length;
        const endIdx = findClosingParen(content, startIdx);
        if (endIdx === -1) continue;

        const args = content.substring(startIdx, endIdx).trim();
        commands.push({ name, args });
        cmdRegex.lastIndex = endIdx + 1;
    }

    return commands;
}

function splitArgs(args: string): string[] {
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

function stripQuotes(s: string): string {
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
        return s.slice(1, -1);
    }
    return s;
}

export class SimpleCmakeParser {

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

        const cleanContent = removeComments(content);
        const commands = parseCommands(cleanContent);

        const vars = SimpleCmakeParser.buildVariableMap(commands, cmakeFileDir);
        const name = SimpleCmakeParser.extractProjectName(commands, vars);
        const projName = name || path.basename(cmakeFileDir);
        const allFiles = SimpleCmakeParser.extractFiles(commands, vars);

        const { headers, sources, forms, resources, translations } = classifyFiles(allFiles);

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

    private static extractProjectName(
        commands: { name: string; args: string }[],
        vars: Map<string, string[]>
    ): string | null {
        const projectCmd = commands.find(cmd => cmd.name.toLowerCase() === 'project');
        if (!projectCmd) return null;

        const args = splitArgs(projectCmd.args);
        if (args.length === 0) return null;

        let name = stripQuotes(args[0]);
        const varMatch = name.match(/^\$\{(\w+)\}$/);
        if (varMatch) {
            const resolved = vars.get(varMatch[1]);
            if (resolved && resolved.length > 0) return resolved[0];
        }
        return name;
    }

    private static buildVariableMap(
        commands: { name: string; args: string }[],
        cmakeFileDir: string
    ): Map<string, string[]> {
        const vars = new Map<string, string[]>();
        vars.set('CMAKE_CURRENT_SOURCE_DIR', [cmakeFileDir]);

        for (const cmd of commands) {
            const lowerName = cmd.name.toLowerCase();
            if (lowerName === 'set') {
                const args = splitArgs(cmd.args);
                if (args.length < 2) continue;

                const varName = stripQuotes(args[0]);
                vars.set(varName, args.slice(1).map(v => stripQuotes(v)));
            } else if (lowerName === 'get_filename_component') {
                const args = splitArgs(cmd.args);
                if (args.length < 3) continue;

                const varName = stripQuotes(args[0]);
                let filePath = stripQuotes(args[1]);
                const mode = stripQuotes(args[2]).toUpperCase();

                filePath = filePath.replace(/\$\{CMAKE_CURRENT_SOURCE_DIR\}/g, cmakeFileDir);
                filePath = filePath.replace(/\$\{CMAKE_CURRENT_LIST_DIR\}/g, cmakeFileDir);

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

    private static expandVar(value: string, vars: Map<string, string[]>): string[] {
        const varMatch = value.match(/^\$\{(\w+)\}$/);
        if (varMatch) {
            const ref = vars.get(varMatch[1]);
            if (ref) return [...ref];
            return [value];
        }
        return [value];
    }

    private static extractFiles(
        commands: { name: string; args: string }[],
        vars: Map<string, string[]>
    ): string[] {
        const allFiles = new Map<string, string>();

        const knownFileVars = ['PROJECT_SOURCES', 'SOURCES', 'PROJECT_HEADERS', 'HEADERS',
            'PROJECT_FORMS', 'FORMS', 'PROJECT_RESOURCES', 'RESOURCES',
            'TRANSLATIONS', 'TS_FILES'];

        for (const varName of knownFileVars) {
            const resolvedName = SimpleCmakeParser.resolveVarName(varName, vars);
            const values = vars.get(resolvedName);
            if (values) {
                for (const v of values) {
                    const expanded = SimpleCmakeParser.expandVar(v, vars);
                    for (const file of expanded) {
                        if (file.length > 0 && !file.startsWith('-')) {
                            allFiles.set(file, file);
                        }
                    }
                }
            }
        }

        for (const cmd of commands) {
            const lowerName = cmd.name.toLowerCase();
            if (lowerName !== 'add_executable' && lowerName !== 'qt_add_executable') continue;

            const args = splitArgs(cmd.args);
            if (args.length < 2) continue;

            const cmdFiles = SimpleCmakeParser.extractAddExecutableFiles(args, vars);
            for (const file of cmdFiles) {
                if (file.length > 0 && !file.startsWith('-')) {
                    allFiles.set(file, file);
                }
            }
        }

        return [...allFiles.keys()];
    }

    private static extractAddExecutableFiles(
        args: string[],
        vars: Map<string, string[]>
    ): string[] {
        const files: string[] = [];
        for (let i = 1; i < args.length; i++) {
            const arg = stripQuotes(args[i]);

            const varMatch = arg.match(/^\$\{(\w+)\}$/);
            if (varMatch) {
                const ref = vars.get(varMatch[1]);
                if (ref) {
                    for (const r of ref) {
                        files.push(...SimpleCmakeParser.expandVar(r, vars));
                    }
                }
                continue;
            }

            if (arg.includes('${')) continue;

            if (arg.match(/^[A-Z_]+$/) || arg === 'MANUAL_FINALIZATION') continue;

            files.push(arg);
        }
        return files;
    }

    private static resolveVarName(varName: string, vars: Map<string, string[]>): string {
        if (vars.has(varName)) return varName;
        for (const key of vars.keys()) {
            if (key.toLowerCase() === varName.toLowerCase()) return key;
        }
        return varName;
    }
}
