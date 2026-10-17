const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const skillDirectory = process.env.COGSTYLE_DIRECTORY || path.join(os.homedir(), '.codex/skills/coding-style');
const ts = require(path.join(skillDirectory, 'node_modules/typescript'));

const root = process.env.SAMPLE_ROOT || path.resolve(__dirname, '..');
const cache = new Map();

function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = name => load(path.relative(root, path.resolve(path.dirname(filename), name.replace(/\.js$/, '.ts'))));
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}

module.exports = { load };
