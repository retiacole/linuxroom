'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/shell.js');
const D = require('./load-data.cjs');
require('../src/engine.js');
const E = globalThis.LinuxroomEngine;

function grade(id, commands) {
  const session = E.createSession(id);
  for (const command of commands) E.run(session, command);
  return {session, result:E.check(session)};
}
function passes(id, command) {
  assert.equal(grade(id, [command]).result.passed, true, id + ': ' + command);
}

test('equivalent direct input and pipelines pass the revised lessons', () => {
  for (const command of ['ls', 'ls .', 'ls -1', 'ls -1 .']) passes('04-ls', command);
  for (const command of ["tr '[:upper:]' '[:lower:]' < names.txt", 'tr A-Z a-z < names.txt', "cat names.txt | tr '[:upper:]' '[:lower:]'"]) passes('ap-20-tr-case', command);
  for (const command of ["tr -s ' ' < spaces.txt | cut -d ' ' -f 3", "cat spaces.txt | tr -s ' ' | cut -d ' ' -f 3", "tr -s ' ' < spaces.txt | awk '{print $3}'"]) passes('ap-21-tr-squeeze', command);
  for (const command of ['xargs -n 1 file < selected-files.txt', 'cat selected-files.txt | xargs -n 1 file']) passes('ad-19-xargs-info', command);
  for (const command of ["xargs cat < selected-files.txt | grep WARN", "cat selected-files.txt | xargs cat | grep WARN"]) passes('ad-20-xargs-read', command);
  for (const command of ["awk -F. '{print $NF}' object-names.txt", "rev object-names.txt | cut -d '.' -f 1 | rev"]) passes('ad-11-rev', command);
});

test('flexible grading still requires reading the intended input', () => {
  for (const [id, command] of [
    ['ap-20-tr-case', "printf 'REN\\naki\\nAki\\nmei\\nREN\\nren\\n' | tr A-Z a-z"],
    ['ap-21-tr-squeeze', "printf 'aki\\nren\\nmei\\n' | tr -s ' '"],
    ['ad-11-rev', "printf 'log\\njson\\nlog\\n'"]
  ]) assert.equal(grade(id,[command]).result.passed,false,id);
});

test('file totals and directory traversal teach portable operations', () => {
  passes('ad-06-du','du -cb bundle/*.log | tail -n 1');
  assert.equal(grade('ad-06-du',['du -sb bundle']).result.passed,false,'directory storage is not the requested file total');
  for (const id of ['ap-12-grep-recursive','ap-14-rg-glob','ap-15-find']) {
    const lesson=D.lessons.find(l=>l.id===id);
    assert.match(lesson.solution[0],/\| sort$/);
    passes(id,lesson.solution[0]);
    assert.equal(grade(id,[lesson.solution[0].replace(/ \| sort$/,'')]).result.passed,false,'sorted-looking traversal alone is not a promise of order');
  }
});

test('new shell syntax must actually be used instead of echoing the expected answer', () => {
  passes('ap-37-input-redirection','wc -l < names.txt');
  assert.equal(grade('ap-37-input-redirection',['cat names.txt | wc -l']).result.passed,false,'this one exercise specifically teaches <');
  passes('ap-45-and-sequence',"grep NOT_PRESENT session.log && echo unexpected; echo checked");
  assert.equal(grade('ap-45-and-sequence',["grep NOT_PRESENT session.log; echo checked"]).result.passed,false,'must compare both connectors');
  assert.equal(grade('ap-45-and-sequence',["grep NOT_PRESENT session.log; echo unexpected; echo checked"]).result.passed,false,'unconditional unexpected output is wrong');
  passes('ap-46-stderr','cat missing.log 2>/dev/null; cat notes.txt');
  assert.equal(grade('ap-46-stderr',['cat missing.log; cat notes.txt']).result.passed,false,'an unredirected error is not accepted');
  passes('ap-47-exit-status',"grep NOT_PRESENT session.log; echo $?");
  assert.equal(grade('ap-47-exit-status',["grep NOT_PRESENT session.log; echo 1"]).result.passed,false,'must expand the exit status');
  assert.equal(grade('ap-47-exit-status',["grep NOT_PRESENT session.log; echo '$?'"]).result.passed,false,'quoted literal is not a status expansion');
});

test('large logs make limits and counting useful, and new solutions survive restoration', () => {
  const fixture=D.datasets['ap-volume'];
  const log=fixture.files[fixture.cwd+'/server.log'];
  assert.equal(log.trimEnd().split('\n').length,400);
  assert.equal(log.trimEnd().split('\n').filter(line=>line.includes(' ERROR ')).length,10);
  for(const id of ['ap-38-ls-human','ap-39-ls-time','ap-40-large-head','ap-41-large-tail','ap-42-large-count','ap-43-tail-header','ap-44-head-bytes','ap-45-and-sequence','ap-46-stderr','ap-47-exit-status']) {
    const lesson=D.lessons.find(l=>l.id===id),{session,result}=grade(id,lesson.solution);
    assert.equal(result.passed,true,id);
    assert.equal(E.check(E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(session))))).passed,true,id+' after reload');
  }
});

test('the newest-first file listing rejects reversed or name-sorted output', () => {
  passes('ap-39-ls-time','ls -lt snapshots/*.log');
  passes('ap-39-ls-time','ls -l -t snapshots/*.log');
  assert.equal(grade('ap-39-ls-time',['ls -ltr snapshots/*.log']).result.passed,false,'all expected rows in oldest-first order must not pass');
  assert.equal(grade('ap-39-ls-time',['ls -lt snapshots/*.log | sort']).result.passed,false,'sorting the rows after ls must not discard the required time order');
});

test('practice hints have blanks and explanations identify real-system differences', () => {
  for(const lesson of D.lessons.filter(l=>l.mode!=='guide')) assert.match(lesson.hints[2],/穴埋め.*___/,lesson.id);
  for(const [id,term] of [['04-ls','ls -1'],['17-awk',"cut -d ' ' -f 3"],['ad-04-file','版'],['ad-12-diff','更新日時'],['01-echo','analyst@linuxroom:~$']]) {
    assert.ok(D.lessons.find(l=>l.id===id).explanation.join('\n').includes(term),id);
  }
  const final=D.lessons.find(l=>l.id==='36-final-ranking');
  assert.equal(final.solution[0],'mkdir -p reports');
  const session=E.createSession(final.id);
  E.run(session,'mkdir reports');
  for(const command of final.solution) E.run(session,command);
  assert.equal(E.check(session).passed,true,'already existing reports must not break the official solution');
});
