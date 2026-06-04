import * as path from 'path';

export interface FileLists {
    headers: string[];
    sources: string[];
    forms: string[];
    resources: string[];
    translations: string[];
}

export function classifyFiles(files: string[]): FileLists {
    const headers: string[] = [];
    const sources: string[] = [];
    const forms: string[] = [];
    const resources: string[] = [];
    const translations: string[] = [];

    for (const file of files) {
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
