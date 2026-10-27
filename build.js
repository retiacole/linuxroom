'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const version = require('./package.json').version;
let html = fs.readFileSync(path.join(root, 'src/ui.html'), 'utf8');
const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
html = html.replace(/<!doctype html>/i, value => `${value}\n<!--\nLinuxroom v${version}. Virtual shell derived from Logroom.\n${license.replace(/-->/g, '-- >')}\n-->`);
for (const [marker, file] of Object.entries({CSS:'style.css', SHELL:'shell.js', DATA:'data.js', I18N:'i18n.js', ENGINE:'engine.js', APP:'app.js'})) {
  const placeholder = `/*__${marker}__*/`;
  if (!html.includes(placeholder)) throw new Error(`Missing build placeholder ${placeholder}`);
  let content = (marker === 'DATA' ? ['data.js','data-levels.js','data-applied.js','data-advanced.js','data-en.js','concepts-en.js','examples-en.js','hints-en.js'] : [file])
    .map(name => fs.readFileSync(path.join(root, 'src', name), 'utf8')).join('\n');
  if (file.endsWith('.js')) content = content.replace(/<\/script/gi, '<\\/script');
  html = html.replace(placeholder, () => content);
}
html = html.replaceAll('__RELEASE_VERSION__', version);
if (/\/\*__[A-Z]+__\*\//.test(html)) throw new Error('Unresolved placeholder');
fs.writeFileSync(path.join(root, 'linuxroom.html'), html);
const docs = path.join(root, 'docs');
fs.mkdirSync(docs, { recursive: true });
fs.writeFileSync(path.join(docs, 'index.html'), html);
fs.writeFileSync(path.join(docs, 'linuxroom.html'), html);
fs.writeFileSync(path.join(docs, '.nojekyll'), '');
console.log(`Built linuxroom.html and docs/ (${Math.round(Buffer.byteLength(html)/1024)} KiB per HTML)`);
