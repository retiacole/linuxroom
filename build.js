'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'src/ui.html'), 'utf8');
const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
html = html.replace(/<!doctype html>/i, value => `${value}\n<!--\nLinuxroom v0.4.1. Virtual shell derived from Logroom.\n${license.replace(/-->/g, '-- >')}\n-->`);
const illustrationPlaceholder = '__WELCOME_ART_DATA_URI__';
if (!html.includes(illustrationPlaceholder)) throw new Error('Missing welcome illustration placeholder');
const illustration = fs.readFileSync(path.join(root, 'assets', 'linuxroom-journey.png'));
html = html.replace(illustrationPlaceholder, () => `data:image/png;base64,${illustration.toString('base64')}`);
for (const [marker, file] of Object.entries({CSS:'style.css', SHELL:'shell.js', DATA:'data.js', I18N:'i18n.js', ENGINE:'engine.js', APP:'app.js'})) {
  const placeholder = `/*__${marker}__*/`;
  if (!html.includes(placeholder)) throw new Error(`Missing build placeholder ${placeholder}`);
  let content = (marker === 'DATA' ? ['data.js','data-levels.js','data-applied.js','data-advanced.js','data-en.js','concepts-en.js','examples-en.js','hints-en.js'] : [file])
    .map(name => fs.readFileSync(path.join(root, 'src', name), 'utf8')).join('\n');
  if (file.endsWith('.js')) content = content.replace(/<\/script/gi, '<\\/script');
  html = html.replace(placeholder, () => content);
}
if (/\/\*__[A-Z]+__\*\//.test(html)) throw new Error('Unresolved placeholder');
fs.writeFileSync(path.join(root, 'linuxroom.html'), html);
const docs = path.join(root, 'docs');
fs.mkdirSync(docs, { recursive: true });
fs.writeFileSync(path.join(docs, 'index.html'), html);
fs.writeFileSync(path.join(docs, 'linuxroom.html'), html);
fs.writeFileSync(path.join(docs, '.nojekyll'), '');
console.log(`Built linuxroom.html and docs/ (${Math.round(Buffer.byteLength(html)/1024)} KiB per HTML)`);
