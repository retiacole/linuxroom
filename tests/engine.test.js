'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
require('../src/shell.js');
require('./load-data.cjs');
require('../src/engine.js');
const E = globalThis.LinuxroomEngine, D = globalThis.LINUXROOM_DATA;

function fixtureLesson(id, conditions) {
  D.datasets[id] = {cwd: '/home/analyst', files: {'/home/analyst/test.log': 'INFO start\nERROR beta\nerror alpha\nERROR beta\n', '/home/analyst/names.txt': 'blue\nred\nblue\n'}};
  const lesson = {id, fixture: id, validation: {all: conditions}, success: 'ok'};
  D.lessons.push(lesson);
  return () => { D.lessons.splice(D.lessons.indexOf(lesson), 1); delete D.datasets[id]; };
}

test('all official lesson solutions pass from independent fresh sessions', async t => {
  for (const lesson of D.lessons.slice()) await t.test(lesson.id + ' ' + lesson.title, () => {
    const session = E.createSession(lesson.id);
    assert.equal(E.check(session).passed, false, 'new lesson must not already pass');
    for (const command of lesson.solution) {
      const result = E.run(session, command);
      assert.equal(result.stderr, '', command);
      assert.ok(result.code === 0 || result.expectedStatus, command + ' unexpected status ' + result.code);
      assert.equal(result.trace.some(stage => stage.code !== 0 && !lesson.validation.all.some(rule => rule.type === 'status' && rule.command === stage.command && rule.code === stage.code)), false, command + ' has a failing pipeline stage');
    }
    const grade = E.check(session);
    assert.equal(grade.passed, true, JSON.stringify(grade));
    assert.equal(E.check(E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(session))))).passed, true, 'reload must preserve completed evidence');
  });
});

test('trying each displayed example still leaves the lesson solvable', () => {
  for (const lesson of D.lessons.slice()) {
    const session = E.createSession(lesson.id);
    const example = E.run(session, lesson.example.command);
    assert.equal(example.stderr, '', lesson.id + ' example');
    assert.ok(example.code === 0 || example.expectedStatus, lesson.id + ' example status');
    if (session.pagerOpen) E.closePager(session);
    for (const command of lesson.solution) {
      const result = E.run(session, command);
      assert.equal(result.stderr, '', lesson.id + ' after example: ' + command);
      assert.ok(result.code === 0 || result.expectedStatus, lesson.id + ' after example status');
    }
    assert.equal(E.check(session).passed, true, lesson.id + ' must remain solvable after its example');
  }
});

test('incorrect output and echoing expected output do not satisfy a targeted exercise', () => {
  const remove = fixtureLesson('test-target', [{type: 'used', command: 'grep'}, {type: 'output', value: 'ERROR beta\nERROR beta'}]);
  try {
    const session = E.createSession('test-target');
    E.run(session, "grep INFO test.log"); assert.equal(E.check(session).passed, false);
    E.run(session, "printf 'ERROR beta\\nERROR beta\\n'"); assert.equal(E.check(session).passed, false);
    E.run(session, "grep ERROR test.log"); assert.equal(E.check(session).passed, true);
    E.run(session, 'help grep'); assert.equal(E.check(session).passed, true);
    E.run(session, 'history'); assert.equal(E.check(session).passed, true);
    E.run(session, 'clear'); assert.equal(E.check(session).passed, true);
    E.run(session, 'not-a-command'); assert.equal(E.check(session).passed, false);
  } finally { remove(); }
});

test('help itself can be a lesson target', () => {
  const remove = fixtureLesson('test-help', [{type: 'used', command: 'help', args: ['grep']}, {type: 'output', value: 'grep', match: 'contains'}]);
  try { const session = E.createSession('test-help'); E.run(session, 'help grep'); assert.equal(E.check(session).passed, true); } finally { remove(); }
});

test('short option clustering and separate options grade identically', () => {
  const remove = fixtureLesson('test-flags', [{type: 'used', command: 'grep', flags: 'ni'}, {type: 'output', value: '2:ERROR beta\n3:error alpha\n4:ERROR beta'}]);
  try {
    for (const command of ['grep -ni error test.log', 'grep -n -i error test.log', 'grep --line-number --ignore-case error test.log']) {
      const session = E.createSession('test-flags'); E.run(session, command); assert.equal(E.check(session).passed, true, command);
    }
    const session = E.createSession('test-flags'); E.run(session, 'grep -n ERROR test.log'); assert.equal(E.check(session).passed, false);
  } finally { remove(); }
});

test('trace comes from actual parsing and preserves quoted pipes', () => {
  const shell = new globalThis.LogLabShell({'/home/analyst/test': 'a|b\nother\n'});
  const result = shell.run("grep -F 'a|b' test | wc -l");
  assert.equal(result.trace.length, 2);
  assert.deepEqual(result.trace[0].args, ['-F', 'a|b', 'test']);
  assert.equal(result.trace[0].stdout, 'a|b\n');
  assert.equal(result.trace[1].stdin, result.trace[0].stdout);
  assert.equal(result.trace[0].pipeline, result.trace[1].pipeline);
  const chained = shell.run('pwd; cat test | wc -l');
  assert.notEqual(chained.trace[0].pipeline, chained.trace[1].pipeline);
  assert.equal(chained.trace[1].pipeline, chained.trace[2].pipeline);
});

test('trace does not repeat side effects and shows stdout before redirection', () => {
  const shell = new globalThis.LogLabShell({'/home/analyst/notes': 'start\n'});
  let result = shell.run("echo next >> notes");
  assert.equal(shell.read('notes'), 'start\nnext\n');
  assert.equal(result.stdout, '');
  assert.equal(result.trace[0].stdout, 'next\n');
  assert.deepEqual(result.trace[0].redirections, [{op: '>>', fd: 1, target: '/home/analyst/notes'}]);
  result = shell.run('cat < notes | tee copy | wc -l');
  assert.equal(shell.read('copy'), 'start\nnext\n');
  assert.equal(result.trace[0].stdin, 'start\nnext\n');
  assert.deepEqual(result.trace[0].reads, ['/home/analyst/notes']);
  assert.equal(result.trace[1].stdout, result.trace[0].stdout);
  assert.equal(result.stdout.trim(), '2');
});

test('errors at an earlier pipeline stage cannot be hidden by a successful final stage', () => {
  const remove = fixtureLesson('test-errors', [{type: 'used', command: 'wc'}, {type: 'output', value: '0'}]);
  try {
    const session = E.createSession('test-errors');
    let result = E.run(session, 'grep ERROR missing.log | wc -l');
    assert.equal(result.code, 0, 'shell keeps normal last-stage status');
    assert.notEqual(result.trace[0].code, 0);
    assert.equal(E.check(session).passed, false);
    result = E.run(session, 'grep NOMATCH test.log | wc -l');
    assert.equal(result.noMatch, true);
    assert.match(result.feedback, /一致/);
    assert.equal(E.check(session).passed, false);
    result = E.run(session, "grep 'unterminated");
    assert.deepEqual(result.trace, []);
    assert.equal(E.check(session).passed, false);
  } finally { remove(); }
});

test('pager requires q and survives a snapshot while open', () => {
  const remove = fixtureLesson('test-pager', [{type: 'used', command: 'less'}, {type: 'pagerClosed'}]);
  try {
    let session = E.createSession('test-pager');
    E.run(session, 'less test.log');
    assert.equal(session.pagerOpen, true); assert.equal(E.check(session).passed, false);
    session = E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(session))));
    assert.equal(session.pagerOpen, true);
    assert.notEqual(E.run(session, 'pwd').code, 0);
    E.run(session, 'q'); assert.equal(session.pagerOpen, false); assert.equal(E.check(session).passed, true);
    E.closePager(session); assert.equal(E.check(session).passed, true);
  } finally { remove(); }
});

test('graduation accepts different real transformations while requiring source reading', () => {
  const remove = fixtureLesson('test-graduation', [{type: 'source', path: '/home/analyst/test.log'}, {type: 'file', path: '/home/analyst/result.txt', value: 'ERROR beta\nERROR beta'}]);
  try {
    for (const command of ["grep ERROR test.log > result.txt", "awk '/ERROR/ {print $0}' test.log > result.txt", "sed -n '/ERROR/p' test.log > result.txt"]) {
      const session = E.createSession('test-graduation'); E.run(session, command); assert.equal(E.check(session).passed, true, command);
    }
    const session = E.createSession('test-graduation'); E.run(session, "printf 'ERROR beta\\nERROR beta\\n' > result.txt"); assert.equal(E.check(session).passed, false);
  } finally { remove(); }
});

test('actual graduation accepts alternate extraction and a saved result read in a later command', () => {
  const extract = E.createSession('35-final-extract');
  E.run(extract, "sed -n '/ ERROR /p' inbox/shift.log");
  assert.equal(E.check(extract).passed, true);
  const ranking = E.createSession('36-final-ranking');
  E.run(ranking, 'mkdir reports');
  E.run(ranking, `awk '$2 == "ERROR" {print $3}' inbox/shift.log | sort | uniq -c | sort -rn > reports/ranking.txt`);
  assert.equal(E.check(ranking).passed, false, 'graduation also asks to display the result');
  E.run(ranking, 'cat reports/ranking.txt');
  assert.equal(E.check(ranking).passed, true, 'showing a previously saved real transformation is valid');
});

test('completion offers commands after real pipes and file paths after arguments', () => {
  const shell = new globalThis.LogLabShell({'/home/analyst/test.log': 'sample\n'});
  assert.ok(shell.complete('gr').includes('grep'));
  assert.ok(shell.complete("grep 'x|y' test.log | so").includes('sort'));
  assert.ok(shell.complete('pwd && ca').includes('cat'));
  assert.ok(shell.complete('cat te').includes('test.log'));
});

test('snapshots preserve files, directory, evidence and completed status without replay side effects', () => {
  const remove = fixtureLesson('test-save', [{type: 'file', path: '/home/analyst/reports/result', value: 'one\ntwo'}]);
  try {
    const session = E.createSession('test-save');
    E.run(session, 'mkdir reports'); E.run(session, 'cd reports'); E.run(session, 'echo one > result'); E.run(session, 'echo two >> result');
    const progress = E.createProgress(); progress.currentId = session.lessonId; progress.sessions[session.lessonId] = E.serializeSession(session);
    E.complete(progress, session.lessonId, true); E.complete(progress, session.lessonId, false);
    assert.equal(E.stats(progress).completed, 1); assert.equal(progress.completed[session.lessonId].assisted, true);
    const hydrated = E.hydrate(JSON.stringify(progress));
    const restored = E.restoreSession(hydrated.sessions[session.lessonId]);
    assert.equal(restored.shell.cwd, '/home/analyst/reports'); assert.equal(restored.shell.read('result'), 'one\ntwo\n'); assert.equal(E.check(restored).passed, true);
    const reset = E.createSession(session.lessonId); assert.equal(reset.shell.isDir('/home/analyst/reports'), false); assert.equal(E.stats(hydrated).completed, 1);
    const result = E.run(restored, 'rm -rf /'); assert.notEqual(result.code, 0); assert.equal(result.gameOver, undefined); assert.equal(E.stats(hydrated).completed, 1); assert.equal(restored.shell.read('result'), 'one\ntwo\n');
  } finally { remove(); }
});

test('malformed, oversized and unknown save data safely falls back', () => {
  for (const raw of [null, 'no json', '{', {version: 99}, [], {version: 1, currentId: 'does-not-exist', completed: {evil: true}, sessions: {evil: {lessonId: 'evil'}}}, ' '.repeat(8 * 1024 * 1024 + 1)]) {
    const progress = E.hydrate(raw); assert.equal(progress.version, 1); assert.equal(E.stats(progress).completed, 0); assert.equal(progress.currentId, D.lessons[0].id);
  }
  const cyclic = {version: 1}; cyclic.self = cyclic; assert.doesNotThrow(() => E.hydrate(cyclic));
  for (const raw of [null, {}, {version: 1, lessonId: D.lessons[0].id, shell: {files: {'relative': 'bad'}, directories: []}}]) assert.doesNotThrow(() => E.restoreSession(raw));
  const progress = E.createProgress(); progress.currentId = 'sandbox'; progress.sessions.sandbox = E.serializeSession(E.createSession('sandbox'));
  assert.equal(E.hydrate(progress).currentId, 'sandbox');
  assert.equal(E.restoreSession(E.hydrate(progress).sessions.sandbox).lessonId, 'sandbox');
});

test('unsupported UI commands are clear, safe, and absent from completion/help', () => {
  const shell = new globalThis.LogLabShell();
  for (const command of ['vi', 'view', 'sl']) {
    const result = shell.run(command); assert.equal(result.code, 127); assert.match(result.stderr, /利用できません/); assert.equal(result.trace.length, 1); assert.equal(shell.supportedCommands.includes(command), false);
  }
  assert.equal(shell.run('help').stdout.includes('GAME OVER'), false);
});
