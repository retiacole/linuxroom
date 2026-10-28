'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../linuxroom.html'), 'utf8');
const KEY = 'linuxroom.progress.v1';
const UI_KEY = 'linuxroom.ui.v1';
const japanese = /[ぁ-んァ-ン一-龥]/;

function createApp(saved, blocked = false, browser = {languages: ['ja-JP'], language: 'ja-JP'}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(html, {
    url: 'https://linuxroom.test/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole,
    beforeParse(w) {
      Object.defineProperty(w, 'navigator', {value: browser});
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
      w.confirm = () => true; w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.HTMLDialogElement.prototype.showModal = function () {this.setAttribute('open', '');};
      w.HTMLDialogElement.prototype.close = function () {this.removeAttribute('open');};
      if (saved) {
        w.localStorage.setItem(KEY, saved.progress);
        w.localStorage.setItem(UI_KEY, saved.ui);
      }
      if (blocked) Object.defineProperty(w, 'localStorage', {get() {throw new Error('Storage disabled');}});
    }
  });
  const w = dom.window, d = w.document;
  const click = id => d.getElementById(id).click();
  const language = value => {d.getElementById('language-select').value = value; d.getElementById('language-select').dispatchEvent(new w.Event('change'));};
  const run = command => {
    if (command === 'q' && d.getElementById('pager-dialog').open) return click('pager-close');
    d.getElementById('command-input').value = command;
    d.getElementById('command-form').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
  };
  const open = lesson => {
    click('map-button');
    d.querySelector('#map-levels [data-level="' + lesson.level + '"]').click();
    d.querySelector('[data-lesson="' + lesson.id + '"]').click();
  };
  const save = () => ({progress: w.localStorage.getItem(KEY), ui: w.localStorage.getItem(UI_KEY)});
  return {dom, w, d, errors, click, language, run, open, save};
}

test('all 121 English lessons can be completed through the shipped HTML', () => {
  const app = createApp();
  try {
    const D = app.w.LINUXROOM_DATA;
    const canonical = JSON.stringify(D.lessons.map(l => ({id: l.id, solution: l.solution, example: l.example.command, starter: l.starter, newPart: l.newPart, fixture: l.fixture, validation: l.validation})));
    const fixtures = JSON.stringify(D.datasets);
    const teaching = D.lessons.map(l => ({id: l.id, concepts: JSON.parse(JSON.stringify(l.concepts)), note: l.example.note, hints: Array.from(l.hints)}));
    app.language('en');
    assert.equal(app.d.documentElement.lang, 'en');
    assert.equal(D.lessons.length, 121);
    assert.equal(Object.keys(app.w.LINUXROOM_EN_LESSONS).length, 121);
    for (const original of teaching) {
      const lesson = D.lessons.find(l => l.id === original.id);
      assert.equal(lesson.concepts.length, original.concepts.length, lesson.id + ' retains every concept');
      original.concepts.forEach((concept, i) => {
        assert.equal(lesson.concepts[i].term, app.w.LINUXROOM_EN_CONCEPTS[concept.term]);
        assert.equal(lesson.concepts[i].text, app.w.LINUXROOM_EN_CONCEPTS[concept.text]);
      });
      assert.equal(lesson.example.note, app.w.LINUXROOM_EN_EXAMPLES[original.note]);
      assert.equal(lesson.hints.length, original.hints.length);
      original.hints.forEach((hint, i) => {if (!hint.startsWith('穴埋め：')) assert.equal(lesson.hints[i], app.w.LINUXROOM_EN_HINTS[hint]);});
    }
    assert.deepEqual(Array.from(D.lessons[0].concepts, c => c.term), ['$ and # in the prompt', 'Command', 'Argument']);
    assert.match(D.lessons[0].example.note, /hello/);
    for (const lesson of D.lessons) {
      app.open(lesson);
      for (const field of ['title', 'goal', 'task', 'explanation', 'concepts', 'hints', 'success', 'bridge']) {
        let text = JSON.stringify(lesson[field]);
        // This one append exercise intentionally teaches exact source text, with an English explanation.
        if (lesson.id === '27-append') text = text.replace(/確認開始|確認完了/g, 'sample');
        assert.doesNotMatch(text, japanese, lesson.id + ' ' + field);
      }
      app.click('hint-button'); app.click('solution-button');
      assert.match(app.d.getElementById('solution-box').textContent, /Example solution/);
      for (const command of lesson.solution) app.run(command);
      app.click('check-answer');
      assert.equal(app.d.getElementById('success-box').hidden, false, lesson.id + ': ' + app.d.getElementById('lesson-feedback').textContent);
    }
    assert.equal(Object.keys(JSON.parse(app.save().progress).completed).length, 121);
    assert.equal(app.d.getElementById('storage-warning').hidden, true);
    assert.equal(JSON.stringify(D.datasets), fixtures);
    assert.equal(JSON.stringify(D.lessons.map(l => ({id: l.id, solution: l.solution, example: l.example.command, starter: l.starter, newPart: l.newPart, fixture: l.fixture, validation: l.validation}))), canonical);
    assert.deepEqual(app.errors, []);
  } finally {app.w.close();}
});

test('switching preserves files, cwd, draft, history, hints, solutions and completion across reload', () => {
  const app = createApp();
  let saved;
  try {
    app.click('start-learning'); app.run('echo ready'); app.click('hint-button'); app.click('solution-button');
    app.run("echo '日本語 <img src=x onerror=alert(1)>' > /tmp/kept.txt");
    app.run('cd /tmp');
    app.d.getElementById('command-input').value = "cat kept.txt | grep '日本語'";
    app.click('save-button');
    app.d.getElementById('save-dialog').removeAttribute('open');
    const before = app.save();
    app.language('en');
    assert.equal(app.save().progress, before.progress);
    assert.equal(app.d.getElementById('command-input').value, "cat kept.txt | grep '日本語'");
    assert.match(app.d.getElementById('terminal-cwd').textContent, /Current directory: \/tmp/);
    assert.equal(app.d.getElementById('success-box').hidden, false);
    assert.equal(app.d.getElementById('solution-box').hidden, false);
    assert.match(app.d.getElementById('hint-list').textContent, /echo/);
    saved = app.save();
    assert.equal(JSON.parse(saved.ui).locale, 'en');
    app.language('ja');
    assert.equal(app.d.getElementById('lesson-title').textContent, '最初のコマンドを打つ');
    assert.equal(app.save().progress, before.progress);
    assert.deepEqual(app.errors, []);
  } finally {app.w.close();}
  const resumed = createApp(saved);
  try {
    assert.equal(resumed.d.documentElement.lang, 'en');
    assert.equal(resumed.d.getElementById('command-input').value, "cat kept.txt | grep '日本語'");
    resumed.run('cat kept.txt');
    assert.match(resumed.d.getElementById('terminal-output').textContent, /日本語 <img src=x onerror=alert\(1\)>/);
    assert.equal(resumed.d.querySelector('#terminal-output img'), null);
    assert.deepEqual(resumed.errors, []);
  } finally {resumed.w.close();}
});

test('language switching preserves an open pager and selected pipeline stage', () => {
  const app = createApp();
  try {
    const lesson = app.w.LINUXROOM_DATA.lessons.find(l => l.id === '10-less');
    app.open(lesson); app.run('less app.log');
    const contents = app.d.getElementById('pager-content').textContent;
    app.language('en');
    assert.equal(app.d.getElementById('pager-dialog').open, true);
    assert.equal(app.d.getElementById('pager-content').textContent, contents);
    assert.match(app.d.getElementById('pager-close').textContent, /Press q/);
    app.click('pager-close');
    assert.equal(app.d.getElementById('success-box').hidden, false);
    app.run("grep ERROR app.log | awk '{print $3}' | sort");
    app.d.querySelectorAll('.stage-button')[1].click();
    const input = app.d.getElementById('trace-input').textContent;
    app.language('ja');
    assert.equal(app.d.querySelectorAll('.stage-button')[1].getAttribute('aria-pressed'), 'true');
    assert.equal(app.d.getElementById('trace-input').textContent, input);
    assert.deepEqual(app.errors, []);
  } finally {app.w.close();}
});

test('English reference, help, feedback, labels and static page copy are localized', () => {
  const app = createApp();
  try {
    app.language('en');
    const walker = app.d.createTreeWalker(app.d.body, 4);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement?.closest('script,style,[data-language-name]')) assert.doesNotMatch(node.textContent, japanese);
    }
    for (const el of app.d.querySelectorAll('*')) for (const key of ['aria-label', 'placeholder', 'title']) assert.doesNotMatch(el.getAttribute(key) || '', japanese);
    app.click('reference-button');
    assert.doesNotMatch(app.d.getElementById('reference-list').textContent.replace(/確認開始|確認完了/g, ''), japanese);
    app.d.getElementById('reference-search').value = 'standard input';
    app.d.getElementById('reference-search').dispatchEvent(new app.w.Event('input'));
    assert.ok(app.d.querySelectorAll('.reference-item').length > 0);
    app.click('start-learning');
    app.run('man grep');
    assert.doesNotMatch(app.d.getElementById('pager-content').textContent, japanese);
    app.click('pager-close');
    app.run('cat missing.txt');
    assert.match(app.d.getElementById('run-feedback').textContent, /not found/);
    app.click('check-answer');
    assert.doesNotMatch(app.d.getElementById('lesson-feedback').textContent, japanese);
    app.run('echo wrong'); app.click('check-answer');
    assert.match(app.d.getElementById('lesson-feedback').textContent, /Missing line/);
    assert.deepEqual(app.errors, []);
  } finally {app.w.close();}
});

test('old saves default to Japanese and blocked storage still allows switching and learning', () => {
  const old = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/v0.2-progress.json'), 'utf8'));
  const oldApp = createApp({progress: JSON.stringify(old.progress), ui: JSON.stringify(old.ui)});
  try {
    assert.equal(oldApp.d.documentElement.lang, 'ja');
    oldApp.language('en');
    assert.equal(oldApp.d.documentElement.lang, 'en');
    assert.deepEqual(appKeys(oldApp), Object.keys(old.progress.completed).sort());
    assert.deepEqual(oldApp.errors, []);
  } finally {oldApp.w.close();}
  const app = createApp(null, true);
  try {
    app.language('en'); app.click('start-learning'); app.run('echo ready');
    assert.equal(app.d.getElementById('success-box').hidden, false);
    assert.match(app.d.getElementById('storage-warning').textContent, /autosave is unavailable/);
    assert.deepEqual(app.errors, []);
  } finally {app.w.close();}
});

function appKeys(app) {return Object.keys(JSON.parse(app.save().progress).completed).sort();}

test('optional check stays open across languages without changing evidence, answers or lesson work', () => {
  const app = createApp();
  try {
    app.click('start-learning');
    app.run('echo retained > /tmp/own.txt');
    app.click('map-button'); app.click('diagnostic-open');
    app.d.getElementById('diagnostic-ip').value = '198.51.100.62';
    app.d.getElementById('diagnostic-count').value = '3';
    app.d.getElementById('diagnostic-answer-form').dispatchEvent(new app.w.Event('submit', {bubbles: true, cancelable: true}));
    const source = app.d.getElementById('diagnostic-source').textContent;
    const before = app.save().progress;
    app.language('en');
    assert.equal(app.d.getElementById('diagnostic-dialog').open, true);
    assert.doesNotMatch(app.d.getElementById('diagnostic-dialog').textContent, japanese);
    assert.match(app.d.getElementById('diagnostic-feedback').textContent, /IP and count match/);
    assert.equal(app.d.getElementById('diagnostic-source').textContent, source);
    assert.equal(app.d.getElementById('diagnostic-ip').value, '198.51.100.62');
    assert.equal(app.d.getElementById('diagnostic-count').value, '3');
    assert.equal(app.save().progress, before);
    app.language('ja');
    assert.match(app.d.getElementById('diagnostic-feedback').textContent, /一致/);
    app.d.querySelector('#diagnostic-dialog .close-dialog').click();
    app.run('cat /tmp/own.txt');
    assert.match(app.d.getElementById('terminal-output').textContent, /retained/);
    assert.deepEqual(app.errors, []);
  } finally {app.w.close();}
});


test('fresh and legacy visits use the primary browser language, with English as the fallback', () => {
  for (const [browser, expected] of [
    [{languages: ['ja-JP', 'en-US'], language: 'en-US'}, 'ja'],
    [{languages: ['JA-jp']}, 'ja'],
    [{languages: ['fr-FR', 'ja-JP'], language: 'ja-JP'}, 'en'],
    [{languages: ['th-TH']}, 'en'],
    [{languages: ['', null, 'ja'], language: 'en-US'}, 'ja'],
    [{languages: [], language: 'ja-JP'}, 'ja'],
    [{language: 'en-GB'}, 'en'],
    [null, 'en']
  ]) {
    const app = createApp(undefined, false, browser);
    try {
      assert.equal(app.d.documentElement.lang, expected, JSON.stringify(browser));
      assert.equal(app.d.getElementById('language-select').value, expected);
      assert.deepEqual(app.errors, []);
    } finally {app.w.close();}
  }
  const legacy = createApp({progress: '{}', ui: JSON.stringify({started: false, locale: 'invalid'})}, false, {languages: ['en-US']});
  try {assert.equal(legacy.d.documentElement.lang, 'en'); assert.deepEqual(legacy.errors, []);} finally {legacy.w.close();}
});

test('saved language choices override the browser and blocked storage still allows automatic language', () => {
  for (const [browser, saved, expected] of [
    [{languages: ['en-US']}, 'ja', 'ja'],
    [{languages: ['ja-JP']}, 'en', 'en']
  ]) {
    const app = createApp({progress: '{}', ui: JSON.stringify({locale: saved})}, false, browser);
    try {assert.equal(app.d.documentElement.lang, expected); assert.deepEqual(app.errors, []);} finally {app.w.close();}
  }
  const app = createApp(undefined, true, {languages: ['ja-JP']});
  try {
    assert.equal(app.d.documentElement.lang, 'ja');
    app.language('en');
    assert.equal(app.d.documentElement.lang, 'en');
    assert.deepEqual(app.errors, []);
  } finally {app.w.close();}
});
