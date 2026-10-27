'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.join(__dirname, '..');
const KEY = 'linuxroom.progress.v1';
const UI_KEY = 'linuxroom.ui.v1';

function sourceHTML() {
  let html = fs.readFileSync(path.join(root, 'src/ui.html'), 'utf8');
  const files = {CSS: ['style.css'], SHELL: ['shell.js'], DATA: ['data.js', 'data-levels.js', 'data-applied.js', 'data-advanced.js', 'data-en.js', 'concepts-en.js', 'examples-en.js', 'hints-en.js'], I18N: ['i18n.js'], ENGINE: ['engine.js'], APP: ['app.js']};
  for (const [key, names] of Object.entries(files)) {
    const source = names.map(name => fs.readFileSync(path.join(root, 'src', name), 'utf8')).join('\n');
    html = html.replace('/*__' + key + '__*/', () => source.replace(/<\/script/gi, '<\\/script'));
  }
  return html.replaceAll('__RELEASE_VERSION__', require('../package.json').version);
}

function createApp(saved) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(sourceHTML(), {
    url: 'https://linuxroom.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole,
    beforeParse(window) {
      window.TextEncoder = globalThis.TextEncoder;
      window.TextDecoder = globalThis.TextDecoder;
      window.confirm = () => true;
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
      if (saved) {
        window.localStorage.setItem(KEY, saved.progress);
        window.localStorage.setItem(UI_KEY, saved.ui);
      }
    }
  });
  const w = dom.window;
  const d = w.document;
  const click = id => d.getElementById(id).click();
  const run = input => {
    d.getElementById('command-input').value = input;
    d.getElementById('command-form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
  };
  const save = () => ({progress: w.localStorage.getItem(KEY), ui: w.localStorage.getItem(UI_KEY)});
  const importProgress = async content => {
    const text = JSON.stringify(content);
    const input = d.getElementById('import-file');
    Object.defineProperty(input, 'files', {configurable: true, value: [{size: Buffer.byteLength(text), text: async () => text}]});
    input.dispatchEvent(new w.Event('change', {bubbles: true}));
    await new Promise(resolve => setImmediate(resolve));
  };
  return {dom, w, d, click, run, save, importProgress, errors};
}

test('prompt follows cd while transcript records the cwd before each command, including reload', () => {
  const app = createApp();
  let saved;
  try {
    app.click('welcome-sandbox-button');
    app.run('cd /home/analyst');
    assert.equal(app.d.getElementById('terminal-prompt').textContent, 'analyst@linuxroom:~$');
    app.run('cd logs');
    assert.equal(app.d.getElementById('terminal-prompt').textContent, 'analyst@linuxroom:~/logs$');
    app.run('cd /tmp');
    assert.equal(app.d.getElementById('terminal-prompt').textContent, 'analyst@linuxroom:/tmp$');
    const prompts = [...app.d.querySelectorAll('.history-prompt')].map(el => el.textContent);
    assert.equal(prompts.at(-2), 'analyst@linuxroom:~$');
    assert.equal(prompts.at(-1), 'analyst@linuxroom:~/logs$');
    const stored = JSON.parse(app.w.localStorage.getItem(UI_KEY)).transcripts.sandbox;
    assert.equal(stored.at(-1).cwd, '/home/analyst/logs');
    saved = app.save();
    assert.deepEqual(app.errors, []);
  } finally { app.dom.window.close(); }
  const restored = createApp(saved);
  try {
    assert.equal(restored.d.getElementById('terminal-prompt').textContent, 'analyst@linuxroom:/tmp$');
    assert.equal([...restored.d.querySelectorAll('.history-prompt')].at(-1).textContent, 'analyst@linuxroom:~/logs$');
    assert.deepEqual(restored.errors, []);
  } finally { restored.dom.window.close(); }
});

test('legacy transcript without cwd remains readable and imported prompt strings remain text', () => {
  const app = createApp();
  let saved;
  try {
    app.click('welcome-sandbox-button');
    app.run('pwd');
    saved = app.save();
    const ui = JSON.parse(saved.ui);
    delete ui.transcripts.sandbox[0].cwd;
    ui.transcripts.sandbox.push({input: '<img src=x onerror=alert(1)>', cwd: '/tmp/<img src=x>', stdout: '', stderr: ''});
    saved.ui = JSON.stringify(ui);
  } finally { app.dom.window.close(); }
  const restored = createApp(saved);
  try {
    const prompts = restored.d.querySelectorAll('.history-prompt');
    assert.equal(prompts[0].textContent, '$');
    assert.match(prompts[0].title, /旧版/);
    assert.equal(prompts[1].textContent, 'analyst@linuxroom:/tmp/<img src=x>$');
    assert.equal(restored.d.querySelectorAll('#terminal-output img').length, 0);
    assert.deepEqual(restored.errors, []);
  } finally { restored.dom.window.close(); }
});

test('home offers pipeline inspection, dynamic lesson totals and dynamic release labels', () => {
  const app = createApp();
  try {
    const data = app.w.LINUXROOM_DATA;
    assert.ok(app.d.querySelector('.sandbox-callout #welcome-sandbox-button'));
    assert.match(app.d.querySelector('.sandbox-callout').textContent, /入力 → 処理 → 出力/);
    assert.equal(app.d.getElementById('course-summary').textContent, data.levels.length + ' 段階 · 全 ' + data.lessons.length + ' レッスン');
    for (const level of data.levels) {
      const card = app.d.querySelector('#level-cards [data-level="' + level.id + '"]').closest('.level-card');
      assert.equal(card.querySelector('.level-count').textContent, data.lessons.filter(l => l.level === level.id).length + ' レッスン');
    }
    assert.equal(app.d.getElementById('brand-version').textContent, 'STEP BY STEP / v' + data.release);
    app.click('welcome-sandbox-button');
    assert.match(app.d.getElementById('lesson-explanation').textContent, /各段/);
    app.run("printf '%s\\n' beta alpha beta | sort | uniq -c");
    assert.equal(app.d.querySelectorAll('#trace-stages .stage-button').length, 3);
    const stages = app.d.querySelectorAll('#trace-stages .stage-button');
    stages[1].click();
    assert.equal(app.d.getElementById('trace-input').textContent, 'beta\nalpha\nbeta\n');
    assert.equal(app.d.getElementById('trace-output').textContent, 'alpha\nbeta\nbeta\n');
    assert.equal(app.d.getElementById('trace-input-details').open, true);
    app.d.querySelector('#trace-stages .stage-button').click();
    assert.equal(app.d.getElementById('trace-input-details').open, false);
    assert.deepEqual(app.errors, []);
  } finally { app.dom.window.close(); }
});

test('terminal help explains every prompt part and shell syntax is searchable', () => {
  const app = createApp();
  try {
    app.click('welcome-sandbox-button');
    app.click('terminal-help');
    const guide = app.d.getElementById('prompt-guide').textContent;
    for (const part of ['ユーザー名', 'ホスト名', '現在地', '管理者', '一般ユーザー', '入力せず']) assert.ok(guide.includes(part), part);
    const search = app.d.getElementById('reference-search');
    for (const term of ['標準入力', '&&', '2>/dev/null', '$?', 'man', 'ls -lt', 'head -c', 'sort -u']) {
      search.value = term;
      search.dispatchEvent(new app.w.Event('input', {bubbles: true}));
      assert.ok(app.d.querySelector('#reference-list .reference-item'), term);
    }
    app.click('terminal-help');
    assert.equal(search.value, '');
    assert.deepEqual(app.errors, []);
  } finally { app.dom.window.close(); }
});

test('v0.2 imports preserve all saved work while adding only declared new fixture files', async () => {
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/v0.2-progress.json'), 'utf8'));
  const app = createApp();
  try {
    await app.importProgress(old);
    assert.match(app.d.getElementById('toast').textContent, /進捗を読み込みました/);
    const saved = JSON.parse(app.save().progress);
    assert.equal(saved.currentId, old.progress.currentId);
    assert.deepEqual(Object.keys(saved.completed).sort(), Object.keys(old.progress.completed).sort());
    const lesson = app.w.LINUXROOM_DATA.lessons.find(l => l.id === 'ap-05-more');
    assert.ok(lesson.fixtureAdditions.length > 0);
    for (const [id, before] of Object.entries(old.progress.sessions)) {
      const after = saved.sessions[id];
      for (const [name, content] of Object.entries(before.shell.files)) assert.equal(after.shell.files[name], content, name);
      for (const dir of before.shell.directories) assert.ok(after.shell.directories.includes(dir), dir);
      assert.equal(after.shell.cwd, before.shell.cwd);
      assert.equal(after.shell.oldcwd, before.shell.oldcwd);
      const additions = Object.keys(after.shell.files).filter(name => !Object.hasOwn(before.shell.files, name));
      if (id !== lesson.id) assert.deepEqual(additions, []);
      else {
        assert.deepEqual(additions.sort(), Array.from(lesson.fixtureAdditions).sort());
        for (const name of additions) assert.equal(after.shell.files[name], app.w.LINUXROOM_DATA.datasets[lesson.fixture].files[name]);
      }
    }
    assert.deepEqual(app.errors, []);
  } finally { app.dom.window.close(); }
});

test('import rejects lossy restoration and undeclared file or directory additions', async () => {
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/v0.2-progress.json'), 'utf8'));
  const app = createApp();
  try {
    app.click('welcome-sandbox-button');
    app.run('echo keep > /tmp/keep.txt');
    const previous = app.save().progress;
    const hydrate = app.w.LinuxroomEngine.hydrate;
    const changes = [
      state => { state.shell.files[Object.keys(state.shell.files)[0]] = 'unexpected change'; },
      state => { state.shell.files['/tmp/undeclared.txt'] = 'extra'; },
      state => { state.shell.directories.push('/tmp/undeclared'); },
      state => { state.shell.directories = state.shell.directories.filter(name => name !== '/home/analyst'); },
      state => { state.shell.cwd = '/tmp'; }
    ];
    const addition = app.w.LINUXROOM_DATA.lessons.find(l => l.id === 'ap-05-more').fixtureAdditions[0];
    changes.push(state => { state.shell.files[addition] = 'not the fixture content'; });
    for (const change of changes) {
      app.w.LinuxroomEngine.hydrate = raw => {
        const restored = hydrate(raw);
        change(restored.sessions['ap-05-more']);
        return restored;
      };
      await app.importProgress(old);
      assert.match(app.d.getElementById('save-status').textContent, /読み込みを中止/);
      assert.equal(app.save().progress, previous);
    }
    assert.deepEqual(app.errors, []);
  } finally { app.dom.window.close(); }
});
