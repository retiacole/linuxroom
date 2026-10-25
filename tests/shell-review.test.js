'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/shell.js');

const fixtures = {
  '/home/analyst/note.txt': 'home note\n',
  '/tmp/good': 'ok\n',
  '/tmp/digits': '123\nddd\n\\d\n',
  '/home/analyst/bundle/a.log': 'red\n',
  '/home/analyst/bundle/b.log': 'blue\n'
};
const shell = (options = {}) => new LogLabShell(fixtures, {now:'2026-10-26T09:00:00Z', ...options});
function run(sh, command, stdout, code = 0, stderr = '') {
  const r = sh.run(command);
  assert.equal(r.stdout, stdout, command);
  assert.equal(r.code, code, command);
  assert.equal(r.stderr, stderr, command);
  return r;
}

test('BRE/ERE grep rejects JavaScript digit escapes and gives portable alternatives', () => {
  for (const command of [String.raw`grep '\d' /tmp/digits`, String.raw`grep -E '\D' /tmp/digits`, String.raw`grep -e x -e '\d' /tmp/digits`]) {
    const r = shell().run(command); assert.equal(r.code, 2); assert.match(r.stderr, /\[0-9\].*\[\[:digit:\]\]/);
  }
  run(shell(), "grep '[[:digit:]]' /tmp/digits", '123\n');
  run(shell(), String.raw`grep -F '\d' /tmp/digits`, '\\d\n');
  run(shell(), String.raw`grep '\\d' /tmp/digits`, '\\d\n');
  run(shell(), String.raw`rg '\d+' /tmp/digits`, '123\n');
  run(shell(), String.raw`cat /tmp/digits | rg '\d+'`, '123\n');
});

test('tilde expansion respects quotes, escapes and glob masks', () => {
  const sh = shell();
  run(sh, String.raw`echo ~ ~/note.txt '~' "~/note.txt" \~ x~ ''~`, '/home/analyst /home/analyst/note.txt ~ ~/note.txt ~ x~ ~\n');
  run(sh, String.raw`echo ~"/foo" ~'' ~/'foo' ~""/foo`, '~/foo ~ /home/analyst/foo ~/foo\n');
  run(sh, 'cat ~/note.txt', 'home note\n');
  run(sh, 'echo ~/*.txt', '/home/analyst/note.txt\n');
  run(sh, 'cd /tmp; cd ~; pwd', '/home/analyst\n');
});

test('GNU-style diagnostics retain command status and readable operands', () => {
  const sh = shell();
  run(sh, 'cat /missing /tmp/good', 'ok\n', 1, 'cat: /missing: No such file or directory\n');
  run(sh, 'cat /tmp', '', 1, 'cat: /tmp: Is a directory\n');
  assert.match(sh.run('madeup').stderr, /command not found/);
  run(sh, 'cat /missing /tmp/good 2>/dev/null', 'ok\n', 1);
  assert.equal(sh.isFile('/dev/null'), false);
  run(sh, 'cat /dev/null', '');
  run(sh, 'grep ok /missing /tmp/good 2>/dev/null', '/tmp/good:ok\n', 2);
});

test('redirection order shares descriptors rather than rewriting output strings', () => {
  const sh = shell();
  run(sh, 'cat /missing /tmp/good 2>&1 > /tmp/out', 'cat: /missing: No such file or directory\n', 1);
  run(sh, 'cat /tmp/out', 'ok\n');
  run(sh, 'cat /missing /tmp/good > /tmp/out 2>&1', '', 1);
  run(sh, 'cat /tmp/out', 'cat: /missing: No such file or directory\nok\n');
  run(sh, 'echo text 2>/tmp/error 1>&2', '');
  run(sh, 'cat /tmp/error', 'text\n');
  run(sh, 'echo text 2>/dev/null > /missing/out', '', 1);
  run(sh, 'cat /missing 2>/dev/null || echo handled', 'handled\n');
});

test('stderr append and quoted numeric arguments are parsed correctly', () => {
  const sh = shell();
  run(sh, 'cat /missing 2>/tmp/error', '', 1);
  run(sh, 'cat /other 2>>/tmp/error', '', 1);
  run(sh, 'cat /tmp/error', 'cat: /missing: No such file or directory\ncat: /other: No such file or directory\n');
  run(sh, "echo '2' >/tmp/number", '');run(sh, 'cat /tmp/number', '2\n');
  run(sh, 'echo 2 >/tmp/number', '');run(sh, 'cat /tmp/number', '2\n');
  assert.match(sh.run('echo text 3>/tmp/out').stderr, /file descriptor/);
  assert.match(sh.run('echo text 2>&9').stderr, /only 1 and 2/);
  assert.match(sh.run('echo text >/tmp/out 2>/tmp/./out').stderr, /independent redirects/);
});

test('cat numbering preserves ordered stdout/stderr and split input lines', () => {
  const sh = shell();
  run(sh, 'cat -n /missing /tmp/good 2>&1', 'cat: /missing: No such file or directory\n     1\tok\n', 1);
  run(sh, 'printf partial >/tmp/partial; cat -n /tmp/partial /missing /tmp/good 2>&1', '     1\tpartialcat: /missing: No such file or directory\nok\n', 1);
});

test('trace retains raw streams and actual routed pipeline input without re-execution', () => {
  const sh = shell(), calls = []; const execute = sh.execute.bind(sh);
  sh.execute = (...args) => {calls.push(args[0]); return execute(...args);};
  const r = run(sh, 'cat /missing 2>&1 | wc -l', '1\n');
  assert.deepEqual(calls, ['cat', 'wc']);
  assert.equal(r.trace[0].stderrRedirected, true);assert.equal(r.trace[0].stdout, '');assert.match(r.trace[0].stderr, /No such file/);
  assert.equal(r.trace[1].stdin, r.trace[0].stderr);
  assert.deepEqual(r.trace[0].redirections, [{op:'>&', fd:2, target:'1'}]);
  const input = run(sh, 'wc -l < /tmp/good', '1\n');
  assert.deepEqual(input.trace[0].reads, ['/tmp/good']);
  assert.deepEqual(input.trace[0].redirections, [{op:'<', fd:0, target:'/tmp/good'}]);
  run(sh, 'echo appended | tee -a /tmp/good | wc -l', '1\n');
  assert.equal(sh.files['/tmp/good'], 'ok\nappended\n');
});

test('status expansion supports quotes, escapes, command lists and pipeline boundaries', () => {
  const sh = shell();
  run(sh, 'cat /missing 2>/dev/null', '', 1);
  run(sh, String.raw`echo $? "$?" '$?' \$? "\$?" pre$?post`, '1 1 $? $? $? pre1post\n');
  run(sh, 'cat /missing 2>/dev/null && echo no; echo $?', '1\n');
  run(sh, 'cat /missing 2>/dev/null || echo $?; echo $?', '1\n0\n');
  run(sh, 'cat /missing 2>/dev/null; echo $? | cat; echo $?', '1\n0\n');
  run(sh, 'cat /missing 2>/dev/null; echo yes | echo $?; echo $?', '1\n0\n');
  run(sh, 'echo yes | grep no; echo $?', '1\n');
  run(sh, 'cat /missing 2>/dev/null; echo $? > /tmp/status-$?; cat /tmp/status-1', '1\n');
  assert.equal(sh.run("echo '").code, 2);run(sh, 'echo $?', '2\n');
  run(sh, 'cat /missing 2>/dev/null', '', 1);run(sh, '', '', 1);run(sh, 'echo $?', '1\n');
});

test('ls one-column option is accepted and long output includes timestamp fields', () => {
  const sh = shell();
  assert.equal(sh.run('ls -1').stdout, sh.run('ls').stdout);
  const row = sh.run('ls -l note.txt').stdout.trim().split(/\s+/);
  assert.deepEqual(row.slice(0,4), ['-rw-r--r--', '1', 'analyst', 'analyst']);
  assert.deepEqual(row.slice(5), ['Oct','25','09:00','note.txt']);
  run(sh, "ls -l note.txt | awk '{print $9}'", 'note.txt\n');
  const rows = sh.run('ls -l /tmp/good note.txt').stdout.trimEnd().split('\n');assert.equal(rows.length, 2);
  assert.match(sh.run('help ls').stdout, /simulated fixture metadata/);
});

test('ls time and size sorting, touch, stat and metadata restoration agree', () => {
  const sh = shell({metadata:{'/tmp/good':{mtime:'2026-10-25T12:00:00Z'}}});
  run(sh, 'ls -t note.txt /tmp/good', '/tmp/good\nnote.txt\n');
  run(sh, 'ls --sort=time -r note.txt /tmp/good', 'note.txt\n/tmp/good\n');
  run(sh, 'ls -S note.txt /tmp/good', 'note.txt\n/tmp/good\n');
  run(sh, 'touch note.txt; ls -t /tmp/good note.txt', 'note.txt\n/tmp/good\n');
  run(sh, "stat -c '%Y' note.txt", Date.parse('2026-10-26T09:00:00Z')/1000+'\n');
  sh.run('cat /missing 2>/dev/null');
  const saved = JSON.parse(JSON.stringify({metadata:sh.metadata, snapshotTime:sh.snapshotTime, lastExitCode:sh.lastExitCode}));
  const restored = new LogLabShell(sh.files, saved);
  assert.deepEqual(restored.getMetadata('note.txt'), sh.getMetadata('note.txt'));
  run(restored, 'echo $?', '1\n');
  run(sh, 'mv note.txt moved.txt', '');assert.equal(sh.metadata['/home/analyst/note.txt'], undefined);
  assert.equal(sh.getMetadata('moved.txt').mtime, Date.parse('2026-10-26T09:00:00Z'));
});

test('du totals file operands without teaching directory sizes as file-only sums', () => {
  run(shell(), 'du -cb bundle/*.log | tail -n 1', '9\ttotal\n');
  assert.match(shell().run('help du').stdout, /real du -b includes the size of each directory/);
});

test('man is explicitly a training help alias and keeps the supported curriculum list stable', () => {
  const sh = shell(), r = sh.run('man grep');assert.equal(r.code, 0);assert.equal(r.pager, true);
  assert.match(r.stdout, /実機の man マニュアルではありません/);assert.match(r.stdout, /grep \[/);
  assert.equal(sh.supportedCommands.length, 49);assert.ok(!sh.supportedCommands.includes('man'));
});


test('parsed connectors retain skipped branches without including the implicit first separator', () => {
  const sh = shell();
  const skipped = run(sh, 'cat /missing 2>/dev/null && echo unreachable', '', 1);
  assert.deepEqual(skipped.connectors, ['&&']);
  assert.deepEqual(skipped.trace.map(stage => stage.command), ['cat']);
  const combined = run(sh, 'echo first || echo unreachable; echo last && echo done', 'first\nlast\ndone\n');
  assert.deepEqual(combined.connectors, ['||', ';', '&&']);
  assert.deepEqual(run(sh, 'echo one', 'one\n').connectors, []);
  assert.deepEqual(run(sh, "echo '&& ; ||'", '&& ; ||\n').connectors, []);
});

test('trace marks only status tokens that were actually expanded', () => {
  const sh = shell();
  run(sh, 'cat /missing 2>/dev/null', '', 1);
  assert.deepEqual(run(sh, 'echo "$?"', '1\n').trace[0].variables, ['?']);
  assert.deepEqual(run(sh, "echo '$?'", '$?\n').trace[0].variables, []);
  assert.deepEqual(run(sh, 'echo 1', '1\n').trace[0].variables, []);
  const redirect = run(sh, 'echo yes >/tmp/result-$?', '');
  assert.deepEqual(redirect.trace[0].variables, ['?']);
  const notExpanded = sh.run('echo yes < /missing > /tmp/never-$?');
  assert.deepEqual(notExpanded.trace[0].variables, []);
});


test('awk treats one-character FS literally and keeps multi-character regular expressions', () => {
  const sh = new LogLabShell({'object-names.txt':'a.b.log\nc.d.json\n', 'fields.txt':'one..two:three\n'});
  run(sh, "awk -F. '{print $NF}' object-names.txt", 'log\njson\n');
  run(sh, "awk -F . '{print $NF}' object-names.txt", 'log\njson\n');
  run(sh, `awk 'BEGIN {FS="."} {print $NF}' object-names.txt`, 'log\njson\n');
  run(sh, "awk -F '[.:]+' '{print NF, $1, $2, $3}' fields.txt", '3 one two three\n');
  run(sh, "echo 'left|right' | awk -F '|' '{print $2}'", 'right\n');
  run(sh, "echo '  one   two ' | awk -F ' ' '{print NF, $2}'", '2 two\n');
});


test('write failures identify the command that attempted the write', () => {
  const sh = shell();
  run(sh, 'touch /missing/out', '', 1, 'touch: /missing/out: No such file or directory\n');
  run(sh, 'cp /tmp/good /missing/out', '', 1, 'cp: /missing/out: No such file or directory\n');
  run(sh, 'echo text | tee /missing/out', 'text\n', 1, 'tee: /missing/out: No such file or directory\n');
  run(sh, 'mv /tmp/good /missing/out', '', 1, 'mv: /missing/out: No such file or directory\n');
  run(sh, "sed -i/missing 's/ok/changed/' /tmp/good", '', 1, 'sed: /tmp/good/missing: No such file or directory\n');
  run(sh, 'echo text >/missing/out', '', 1, 'redirection: /missing/out: No such file or directory\n');
  assert.equal(sh.files['/tmp/good'], 'ok\n');
});


test('flow records execution and skipped branches with the preceding status', () => {
  const sh = shell();
  const r = run(sh, 'cat /missing 2>/dev/null && echo skipped; echo done || echo skipped', 'done\n');
  assert.deepEqual(r.flow, [
    {connector:';', pipeline:0, codeBefore:0, executed:true},
    {connector:'&&', pipeline:1, codeBefore:1, executed:false},
    {connector:';', pipeline:2, codeBefore:1, executed:true},
    {connector:'||', pipeline:3, codeBefore:0, executed:false}
  ]);
  assert.deepEqual(sh.run('').flow, []);
  assert.deepEqual(sh.run("echo '").flow, []);
});

test('argument variables exclude status expansion that occurs only in redirects', () => {
  const sh = shell();
  run(sh, 'cat /missing 2>/dev/null', '', 1);
  const direct = run(sh, 'echo "$?"', '1\n').trace[0];
  assert.deepEqual(direct.argumentVariables, ['?']);
  assert.deepEqual(direct.variables, ['?']);
  const fileOnly = run(sh, 'echo 1 >/tmp/status-$?', '').trace[0];
  assert.deepEqual(fileOnly.argumentVariables, []);
  assert.deepEqual(fileOnly.variables, ['?']);
  assert.deepEqual(run(sh, "echo '$?'", '$?\n').trace[0].argumentVariables, []);
});
