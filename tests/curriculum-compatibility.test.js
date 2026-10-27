'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../src/shell.js');
const D=require('./load-data.cjs');
require('../src/engine.js');
require('../src/data-en.js');
const E=globalThis.LinuxroomEngine;

function run(id,commands) {
  const session=E.createSession(id);
  for(const command of commands) E.run(session,command);
  return session;
}

test('CRLF exercise requires visible source bytes and preserves them across reload',()=>{
  const id='ap-48-cat-visible',lesson=D.lessons.find(item=>item.id===id);
  const session=run(id,lesson.solution);
  assert.equal(E.check(session).passed,true);
  assert.equal(E.check(E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(session))))).passed,true);
  assert.equal(E.check(run(id,['cat windows.log'])).passed,false);
  assert.equal(E.check(run(id,['cat -T windows.log'])).passed,false);
  assert.equal(E.check(run(id,["printf 'user^Iresult^M$\\naki^Iok^M$\\nren^Ifail^M$\\n'"])).passed,false);
  const source=session.shell.read('windows.log');
  assert.equal(source,'user\tresult\r\naki\tok\r\nren\tfail\r\n');
  assert.equal(session.shell.run("grep 'ok$' windows.log").code,1);
});

test('checksum exercise hashes the original bytes and survives session restoration',()=>{
  const id='ap-49-file-hash',lesson=D.lessons.find(item=>item.id===id);
  const session=run(id,lesson.solution);
  assert.equal(E.check(session).passed,true);
  assert.equal(E.check(E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(session))))).passed,true);
  assert.equal(E.check(run(id,['md5sum artifact.txt'])).passed,false);
  assert.equal(E.check(run(id,["printf abc > artifact.txt",...lesson.solution])).passed,false,'removing the final newline changes the hash');
  assert.equal(E.check(run(id,["echo 'edeaaff3f1774ad2888673770c6d64097e391bc362d7d6fb34982ddf0efd18cb  artifact.txt'"])).passed,false,'typing a checksum is not calculating it');
});

test('platform caveats are available in both teaching languages',()=>{
  for(const [id,term] of [['20-sort','LC_ALL=C sort'],['17-awk','mawk'],['19-cut','UTF-8'],['ap-38-ls-human','4096'],['ad-06-du','4.0K'],['ad-04-file','CSV ASCII text'],['ap-12-grep-recursive','| sort']]) {
    assert.ok(D.lessons.find(item=>item.id===id).explanation.join('\n').includes(term),id+' Japanese');
    assert.ok(globalThis.LINUXROOM_EN_LESSONS[id].explanation.join('\n').includes(term),id+' English');
  }
  for (const text of [D.lessons.find(item=>item.id==='19-cut').explanation,globalThis.LINUXROOM_EN_LESSONS['19-cut'].explanation]) {
    const note=text.join('\n');
    for (const term of ['9.4','9.11','cut -b']) assert.ok(note.includes(term),'cut version caveat: '+term);
  }
  assert.equal(D.release,'0.5.0');
});
