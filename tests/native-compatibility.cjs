'use strict';
// Opt-in differential checks: node tests/native-compatibility.cjs
// Requires GNU coreutils (g-prefixed Homebrew tools or Linux names), Bash, and
// a UTF-8 locale. Kept separate from npm test so normal browser work needs none.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
require('../src/shell.js');
require('./load-data.cjs');
require('../src/engine.js');

function gnuTool(name) {
  for (const candidate of ['g' + name, name]) {
    const result = spawnSync(candidate, ['--version'], {encoding:'utf8'});
    if (result.status === 0 && /GNU coreutils/.test(result.stdout)) return candidate;
  }
  throw new Error(`GNU ${name} is required (install coreutils or put g${name} on PATH)`);
}
const names = ['seq', 'cut', 'wc', 'ls'];
const tools = Object.fromEntries(names.map(name => [name, gnuTool(name)]));
const utf8 = ['C.UTF-8', 'en_US.UTF-8', 'en_US.utf8'].find(locale => {
  const result = spawnSync(tools.wc, ['-m'], {input:'日', encoding:'utf8', env:{...process.env,LC_ALL:locale}});
  return result.status === 0 && result.stdout.trim() === '1';
});
if (!utf8) throw new Error('These checks require a UTF-8 locale (C.UTF-8 or en_US.UTF-8).');
const bash = spawnSync('bash', ['--version'], {encoding:'utf8'});
if (bash.status !== 0 || !/GNU bash/.test(bash.stdout)) throw new Error('Bash is required.');
console.log(spawnSync(tools.cut, ['--version'], {encoding:'utf8'}).stdout.split('\n')[0]);
console.log(bash.stdout.split('\n')[0]);
console.log(`Unicode checks use ${utf8}; cut byte comparisons explicitly use LC_ALL=C.`);

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'linuxroom-native-')));
const fixtures = {
  'a.txt':'one two\nthree\n', 'b.txt':'one\n', 'empty':'',
  'utf.txt':'日本語 テスト\n😀\n', 'tabs.txt':'a\tb\r\nlong\tline\n',
  'csv.txt':'a,b,c\nd,e,f\nno delimiter\n', 'nulls.txt':'a\0b\0c\n',
  'tree/child/note':'x\n', 'tree/a':'a\n', 'tree/z':'zzz\n',
  '😀a':'a', '😀b':'b', '😀dir/x1':'1', '😀dir/x2':'2'
};
const extraDirectories = ['space end ', 'two words', '$(echo unsafe)', '{a,b}', 'tree/empty'];
const time = Date.UTC(2026, 9, 25, 9) / 1000;
for (const [name,text] of Object.entries(fixtures)) {
  const filename = path.join(temporary, name);
  fs.mkdirSync(path.dirname(filename), {recursive:true});
  fs.writeFileSync(filename, text, {mode:0o644});
  fs.utimesSync(filename,time,time);
}
for (const name of extraDirectories) fs.mkdirSync(path.join(temporary,name),{recursive:true});
function shell() {
  const result = new globalThis.LogLabShell(fixtures);
  for (const name of extraDirectories) result.directories.add('/home/analyst/' + name);
  return result;
}
let passed = 0, failed = 0;
function check(name, body) {
  try { body(); passed++; }
  catch (error) { failed++; console.error(`FAIL ${name}\n${error.message}`); }
}
function normalize(text) { return text.split(temporary).join('/home/analyst'); }
function compareTool(command,args,input='',locale='C',options={}) {
  check([command,...args].join(' '),()=>{
    const native = spawnSync(tools[command],options.nativeArgs || args,{cwd:temporary,input,encoding:'utf8',env:{...process.env,LC_ALL:locale,TZ:'UTC',QUOTING_STYLE:'literal',LS_COLORS:''}});
    const virtual = shell().execute(command,args,input,{hasStdin:true});
    assert.equal(virtual.code,native.status,native.stderr || virtual.stderr);
    const transform = options.transform || (value=>value);
    assert.equal(transform(virtual.stdout),transform(native.stdout));
  });
}
function compareBash(command) {
  check(command,()=>{
    const native = spawnSync('bash',['--noprofile','--norc','-c',command],{cwd:temporary,encoding:'utf8',timeout:5000,env:{...process.env,HOME:'/home/analyst',USER:'analyst',LC_ALL:'C'}});
    const virtual = shell().run(command);
    assert.equal(virtual.code,native.status,native.stderr || virtual.stderr);
    assert.equal(virtual.stdout,normalize(native.stdout));
  });
}
try {
  // Exact GNU wc padding for stdin, one file, multiple files, and totals.
  for (const flags of [[],['-l'],['-w'],['-c'],['-m'],['-L'],['-lwmcL']]) {
    compareTool('wc',flags,'one two\nthree\n',utf8);
    compareTool('wc',[...flags,'a.txt'],'',utf8);
    compareTool('wc',[...flags,'a.txt','b.txt'],'',utf8);
    compareTool('wc',[...flags,'utf.txt','tabs.txt'],'',utf8);
    compareTool('wc',[...flags,'a.txt','-'],'hello world\n',utf8);
  }
  // GNU 9.11 changed -c in UTF-8 locales. C locale deliberately verifies the
  // byte model used by Linuxroom and by the review's GNU coreutils 9.4.
  for (const range of ['1-3','2-3','1,4','1-','-4']) {
    compareTool('cut',['-c',range,'utf.txt']);
    compareTool('cut',['-b',range,'tabs.txt']);
    compareTool('cut',['-c',range,'--complement','utf.txt']);
  }
  for (const delimiter of [':','','|']) compareTool('cut',['-d,','-f1,3','--output-delimiter',delimiter,'csv.txt']);
  compareTool('cut',['-d','','-f2','nulls.txt']);
  compareTool('cut',['-c1,3','--output-delimiter','','a.txt']);
  for (const args of [
    ['5'],['2','5'],['5','-2','-1'],['0','.1','.3'],['1','.3','2'],
    ['-w','9.8','.5','11'],['-w','-3','3'],['-s',',','4'],['-s','','3'],
    ['1e2','2e2','1e3'],['5','2'],['-2','0'],['1.00','3'],['.5','.25','1.5']
  ]) compareTool('seq',args);
  for (const args of [['-R','tree'],['-r','tree'],['-d','tree/'],['-S','a.txt','b.txt','empty']]) compareTool('ls',args);
  // File-only long output permits structural comparison without pretending
  // host ownership, directory sizes, or actual allocation are virtual values.
  compareTool('ls',['-l','a.txt','empty','b.txt'],'','C',{
    nativeArgs:['-l','--time-style=+%b %e %H:%M','a.txt','empty','b.txt'],
    transform:text=>text.split('\n').map(line=>line.replace(/^([^ ]+\s+\d+)\s+\S+\s+\S+ /,'$1 analyst analyst ')).join('\n')
  });
  for (const command of [
    'ls -d */', 'printf "<%s>\\n" {a,b}', 'printf "<%s>\\n" pre{a,{b,c}}post',
    'printf "<%s>\\n" {a,b}{1,2}', 'printf "<%s>\\n" {1..3}',
    'printf "<%s>\\n" {3..1}', 'printf "<%s>\\n" {a..c}',
    'printf "<%s>\\n" {1.."3"}', 'printf "<%s>\\n" {"a,b",c}',
    'printf "<%s>\\n" "{a,b}" \\{a,b\\}', 'printf "<%s>\\n" {~,x}',
    'printf "<%s>\\n" $HOME{,/logs}', 'printf "<%s>\\n" ${HOME}/{a,b}',
    'printf "<%s>\\n" ${HOME}{a,{b,c}}', 'printf "<%s>\\n" \\$HOME "$HOME"',
    'false; printf "%s\\n" $?; true; printf "%s\\n" ${?}',
    'cd "space end "; printf "<%s>\\n" $PWD',
    'cd "two words"; printf "<%s>\\n" $PWD "$PWD"',
    "cd '$(echo unsafe)'; printf '<%s>\\n' \"$PWD\"",
    "cd '{a,b}'; printf '<%s>\\n' $PWD",
    'printf "<%s>\\n" 😀*', 'cd 😀dir; printf "<%s>\\n" $PWD/x*'
  ]) compareBash(command);
  // Bounds intentionally differ from native tools: exercise refusal without
  // asking the host shell to allocate unbounded output.
  for (const command of ['echo {1..1000000}', 'echo '+Array(10).fill('{a,b}').join(''), 'seq 100001', 'seq 10000000000000000 10000000000000002']) {
    check('bounded '+command,()=>assert.notEqual(shell().run(command).code,0));
  }
  check('restoring an old snapshot adds the root skeleton and preserves learner files',()=>{
    const engine=globalThis.LinuxroomEngine,session=engine.createSession('01-echo');
    session.shell.write('saved.txt','saved\n');
    const snapshot=engine.serializeSession(session);
    snapshot.shell.directories=['/','/home','/home/analyst','/tmp'];
    const restored=engine.restoreSession(snapshot);
    for(const name of ['bin','etc','usr','var','proc','opt','root','dev']) assert(restored.shell.isDir('/'+name),name);
    assert.equal(restored.shell.read('saved.txt'),'saved\n');
  });
} finally {
  fs.rmSync(temporary,{recursive:true,force:true});
}
console.log(`Native compatibility: ${passed} passed, ${failed} failed.`);
if(failed) process.exitCode=1;
