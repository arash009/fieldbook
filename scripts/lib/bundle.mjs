// A tiny bundler for the app's own modules: each module runs once, in dependency order, inside one IIFE.
import { readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*['"](\.{1,2}\/[^'"]+)['"];?[ \t]*$/gm;
const EXPORT = /^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
const UNSUPPORTED = /^\s*(export\s+(default|\{|\*)|import\s+(?!\{))/m;

export async function bundle(entry) {
  const root = dirname(resolve(entry));
  const keyOf = (file) => relative(root, file).split('\\').join('/');
  const done = new Set();
  const modules = [];

  async function visit(file, stack) {
    if (done.has(file)) return;
    if (stack.includes(file)) throw new Error(`Import cycle: ${[...stack, file].map(keyOf).join(' → ')}`);
    const src = await readFile(file, 'utf8');
    if (UNSUPPORTED.test(src)) throw new Error(`${keyOf(file)}: only "import { … } from './x.js'" and "export function/const/class" are supported`);
    const deps = [];
    const code = src.replace(IMPORT, (_, names, spec) => {
      const dep = resolve(dirname(file), spec);
      deps.push(dep);
      const binds = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.replace(/\s+as\s+/, ': '));
      return `const { ${binds.join(', ')} } = __fb[${JSON.stringify(keyOf(dep))}];`;
    });
    for (const dep of deps) await visit(dep, [...stack, file]);
    done.add(file);
    const names = [...src.matchAll(EXPORT)].map((m) => m[1]);
    modules.push(`__fb[${JSON.stringify(keyOf(file))}] = (() => {\n${code.replace(/^export\s+/gm, '')}\nreturn { ${names.join(', ')} };\n})();`);
  }

  await visit(resolve(entry), []);
  return `(() => {\n'use strict';\nconst __fb = {};\n${modules.join('\n')}\n})();\n`;
}
