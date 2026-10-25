'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('./load-data.cjs');
const D = globalThis.LINUXROOM_DATA;

test('a complete, uniquely identified curriculum and coherent fixtures', () => {
  assert.equal(D.version, 1);
  assert.equal(D.lessons.length, 119);
  for (const level of D.levels) assert.equal(D.lessons.filter(l => l.level === level.id).length, level.id === 'applied' ? 47 : 36);
  assert.equal(new Set(D.lessons.map(x => x.id)).size, D.lessons.length);
  const chapters = new Set(D.chapters.map(x => x.id));
  assert.equal(chapters.size, D.chapters.length);
  assert.ok(chapters.size >= 9);
  for (const l of D.lessons) {
    assert.ok(chapters.has(l.chapter), `${l.id} has a chapter`);
    assert.ok(D.datasets[l.fixture], `${l.id} has a fixture`);
    assert.ok(l.goal && l.task && l.title && l.success, l.id);
    assert.equal(l.hints.length, 3, `${l.id} has three hints`);
    assert.ok(l.hints.every(x => typeof x === 'string' && x.length));
    assert.ok(l.explanation.length > 0 && l.solution.length > 0, l.id);
    assert.ok(l.validation.all.length > 0, l.id);
    assert.ok(['guide', 'practice', 'challenge'].includes(l.mode), l.id);
    assert.ok(typeof l.starter === 'string', l.id);
  }
  for (const dataset of Object.values(D.datasets)) {
    assert.ok(dataset.cwd.startsWith('/'));
    for (const [path, content] of Object.entries(dataset.files)) {
      assert.ok(path.startsWith('/'));
      assert.equal(typeof content, 'string');
      assert.ok(content.length < 100000);
    }
  }
});

test('key skills appear in actual solutions, including incremental pipelines', () => {
  const text = D.lessons.flatMap(l => l.solution).join('\n');
  for (const command of ['pwd', 'ls', 'cd', 'cat', 'head', 'tail', 'less', 'grep', 'wc', 'awk', 'cut', 'sort', 'uniq', 'tee', 'jq']) {
    assert.match(text, new RegExp(`\\b${command}\\b`), command);
  }
  assert.ok(D.lessons.some(l => l.solution.includes('q')), 'actually close less');
  assert.ok(D.lessons.filter(l => l.starter && l.starter.includes('|')).length >= 3, 'build on previous stages');
  assert.ok(D.lessons.some(l => l.validation.all.some(c => c.type === 'file')), 'save a result');
});
