'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/shell.js');
require('./load-data.cjs');
require('../src/engine.js');
const E = globalThis.LinuxroomEngine;
const D = globalThis.LINUXROOM_DATA;
const lesson = D.lessons.find(item => item.id === '12-grep-number');
const original = '/home/analyst/logs/app.log';
const numbered = '2:09:01 ERROR ren upload\n3:09:02 ERROR aki download\n5:09:04 ERROR ren upload\n7:09:06 ERROR mei download\n8:09:07 ERROR ren upload\n9:09:08 ERROR aki preview\n';
const literal = "printf '" + numbered.replace(/\n/g, '\\n') + "'";

function run(command) {
  const session = E.createSession(lesson.id);
  const result = E.run(session, command);
  assert.equal(result.stderr, '', command);
  assert.equal(result.code, 0, command);
  return session;
}

test('original line numbers pass with grep numbering or numbering before filtering', () => {
  for (const command of [
    "grep -n 'ERROR' app.log",
    "grep --line-number 'ERROR' app.log",
    "cat -n app.log | grep 'ERROR'",
    "cat -n < app.log | grep 'ERROR'",
    "cat app.log | grep -n 'ERROR'",
    "nl app.log | grep 'ERROR'",
    "grep -n 'ERROR' app.log | head -n 6",
    "grep -n 'ERROR' app.log | tail -n 6",
    "grep -n 'ERROR' app.log | tee /tmp/evidence",
    "grep -n 'ERROR' app.log | sort -n",
    "grep -n 'ERROR' app.log | uniq"
  ]) {
    const session = run(command);
    assert.equal(E.check(session).passed, true, command);
    const restored = E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(session))));
    assert.equal(E.check(restored).passed, true, command + ' after reload');
  }
});

test('numbering the filtered result, unfiltered output, and incomplete matches fail', () => {
  for (const command of [
    "grep 'ERROR' app.log | cat -n",
    'cat -n app.log',
    "cat app.log | grep 'ERROR'",
    "cat -n app.log | grep -i 'ERROR'",
    "cat -n app.log | grep 'upload'",
    "grep -n 'ERROR' app.log | head -n 2"
  ]) assert.equal(E.check(run(command)).passed, false, command);
});

test('matching literal output or reading a different file is not source evidence', () => {
  for (const command of [
    literal,
    literal + " | grep 'ERROR'",
    "cat app.log >/dev/null; " + literal + " | grep 'ERROR'",
    'cat app.log | ' + literal + " | grep 'ERROR'",
    "grep -n 'ERROR' app.log >/dev/null; " + literal,
    "cp app.log /tmp/copied.log; cat -n /tmp/copied.log | grep 'ERROR'"
  ]) {
    const session = run(command);
    assert.equal(E.check(session).passed, false, command);
    assert.equal(E.check(session).details.find(detail => /元ファイル/.test(detail.message)).passed, false, command + ' source');
  }
  const prior = run("grep -n 'ERROR' app.log");
  E.run(prior, literal + " | grep 'ERROR'");
  assert.equal(E.check(prior).passed, false, 'a previous valid read cannot validate new literal output');
});

test('the original record content and order remain part of the lesson', () => {
  const altered = E.createSession(lesson.id);
  altered.shell.files[original] = altered.shell.files[original].replace('09:00 INFO', '09:00 CHANGED');
  E.run(altered, "cat -n app.log | grep 'ERROR'");
  assert.equal(E.check(altered).passed, false, 'reading an altered source cannot prove original line positions');
  for (const command of [
    "grep -n 'ERROR' app.log | sed 's/2:/1:/'",
    "grep -n 'ERROR' app.log | sed 's/upload/download/'",
    "grep -n 'ERROR' app.log | tac",
    "grep -n 'ERROR' app.log; grep -n 'ERROR' app.log"
  ]) {
    const session = run(command);
    const output = E.check(session).details.at(-1);
    assert.equal(output.passed, false, command);
  }
});
