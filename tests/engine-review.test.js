'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../src/shell.js');require('./load-data.cjs');require('../src/engine.js');
const D=globalThis.LINUXROOM_DATA,E=globalThis.LinuxroomEngine;
const old=require('./fixtures/v0.2-progress.json');

function lesson(id,conditions,body){
  D.datasets[id]={cwd:'/home/analyst',files:{'/home/analyst/input':'alpha\nbeta\n'}};
  D.lessons.push({id,fixture:id,validation:{all:conditions}});
  try{body(E.createSession(id));}finally{D.lessons.splice(D.lessons.findIndex(l=>l.id===id),1);delete D.datasets[id];}
}

test('English filesystem errors retain useful Japanese guidance',()=>{
  const s=E.createSession('sandbox');
  assert.match(E.run(s,'cat missing').feedback,/現在地/);
  assert.match(E.run(s,'cat /home/analyst').feedback,/ディレクトリ/);
  assert.match(E.run(s,'not-installed').feedback,/help/);
});

test('output feedback identifies extra, missing, reordered, and newline-different data',()=>{
  lesson('test-diagnostic',[{type:'output',value:'alpha\nbeta',match:'lines'}],s=>{
    E.run(s,'echo alpha');assert.match(E.check(s).details[0].message,/足りない行.*beta/);
    E.run(s,"printf 'alpha\\nbeta\\ngamma\\n'");assert.match(E.check(s).details[0].message,/余分な行.*gamma/);
    E.run(s,"printf 'beta\\nalpha\\n'");assert.match(E.check(s).details[0].message,/順序/);
  });
  lesson('test-newline',[{type:'output',value:'alpha\n',match:'exact'}],s=>{
    E.run(s,'printf alpha');assert.match(E.check(s).details[0].message,/改行/);
  });
});

test('input redirection is graded from actual parsing and source reads',()=>{
  lesson('test-input',[{type:'redirect',op:'<',path:'/home/analyst/input'},{type:'source',path:'/home/analyst/input'},{type:'output',value:'2'}],s=>{
    E.run(s,'echo 2');assert.equal(E.check(s).passed,false);
    E.run(s,'cat input | wc -l');assert.equal(E.check(s).passed,false,'this lesson specifically practices <');
    E.run(s,'wc -l < input');assert.equal(E.check(s).passed,true);
    assert.equal(E.check(E.restoreSession(E.serializeSession(s))).passed,true);
  });
});

test('declared redirected errors are accepted without weakening ordinary grading',()=>{
  const conditions=[{type:'status',command:'cat',code:1,scope:'any',stderrRedirected:true},{type:'redirect',op:'>',fd:2,path:'/dev/null',scope:'any'},{type:'output',value:'alpha\nbeta'}];
  lesson('test-stderr',conditions,s=>{
    E.run(s,'cat missing; cat input');assert.equal(E.check(s).passed,false,'visible errors still fail');
    E.run(s,'cat missing 2>/dev/null; cat input');assert.equal(E.check(s).passed,true);
    assert.equal(E.check(E.restoreSession(E.serializeSession(s))).passed,true);
  });
  lesson('test-hidden-error',[{type:'used',command:'wc'},{type:'output',value:'0'}],s=>{
    E.run(s,'cat missing 2>/dev/null | wc -l');assert.equal(E.check(s).passed,false);
  });
});

test('connectors and exit status require real shell syntax, not lookalike text',()=>{
  lesson('test-syntax',[{type:'status',command:'grep',code:1},{type:'connector',value:'&&'},{type:'connector',value:';'},{type:'variable',name:'?',command:'echo'},{type:'output',value:'1'}],s=>{
    E.run(s,"grep absent input && echo unexpected; echo 1");assert.equal(E.check(s).passed,false);
    E.run(s,"grep absent input && echo unexpected; echo '$?'");assert.equal(E.check(s).passed,false);
    E.run(s,'grep absent input && echo unexpected; echo "$?"');assert.equal(E.check(s).passed,true);
    assert.equal(E.check(E.restoreSession(E.serializeSession(s))).passed,true);
  });
});

test('metadata and previous exit status survive saves without replaying commands',()=>{
  const s=E.createSession('sandbox');
  E.run(s,'echo sample > /tmp/new-file');E.run(s,'cat missing');
  const snapshot=JSON.parse(JSON.stringify(E.serializeSession(s)));
  const restored=E.restoreSession(snapshot);
  assert.equal(restored.shell.lastExitCode,1);
  assert.deepEqual({...restored.shell.metadata['/tmp/new-file']},snapshot.shell.metadata['/tmp/new-file']);
  assert.equal(E.run(restored,'echo $?').stdout,'1\n');
  assert.equal(restored.shell.files['/tmp/new-file'],'sample\n');
});

test('conditional flow must skip the operation after the unsuccessful search',()=>{
  const s=E.createSession('ap-45-and-sequence');
  E.run(s,'grep NOT_PRESENT session.log; echo checked && pwd >/dev/null');
  assert.equal(E.check(s).passed,false);
  E.run(s,'grep NOT_PRESENT session.log && echo unexpected; echo checked');
  assert.equal(E.check(s).passed,true);
  assert.equal(E.check(E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(s))))).passed,true);
});

test('exit status must be expanded as an argument immediately after grep',()=>{
  const s=E.createSession('ap-47-exit-status');
  E.run(s,'grep NOT_PRESENT session.log; echo 1 >/tmp/status-$?; cat /tmp/status-1');
  assert.equal(E.check(s).passed,false);
  E.run(s,'grep NOT_PRESENT session.log; echo 1 >/dev/null; echo $?');
  assert.equal(E.check(s).passed,false);
  E.run(s,'grep NOT_PRESENT session.log; echo "$?"');
  assert.equal(E.check(s).passed,true);
  assert.equal(E.check(E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(s))))).passed,true);
});

test('fixture clocks stay fixed after restoration',()=>{
  const s=E.createSession('ap-39-ls-time');
  E.run(s,'touch before.log');
  const restored=E.restoreSession(JSON.parse(JSON.stringify(E.serializeSession(s))));
  E.run(restored,'touch after.log');
  assert.equal(restored.shell.metadata[restored.shell.resolve('after.log')].mtime,s.shell.metadata[s.shell.resolve('before.log')].mtime);
});

test('v0.2 progress retains all108 completions and every saved file',()=>{
  const p=E.hydrate(old.progress);
  assert.equal(E.stats(p).completed,108);assert.equal(E.stats(p).total,121);
  for(const [id,snapshot] of Object.entries(old.progress.sessions)){
    const restored=p.sessions[id];
    for(const [path,contents] of Object.entries(snapshot.shell.files))assert.equal(restored.shell.files[path],contents,id+' '+path);
    assert.equal(restored.shell.cwd,snapshot.shell.cwd);
    assert.equal(restored.shell.oldcwd,snapshot.shell.oldcwd);
  }
  const l=D.lessons.find(l=>l.id==='ap-05-more');
  const migrated=E.restoreSession(p.sessions[l.id]);
  for(const file of l.fixtureAdditions){
    assert.equal(migrated.shell.files[file],D.datasets[l.fixture].files[file]);
    E.run(migrated,'rm '+file);
    const saved=E.serializeSession(migrated);
    assert.equal(E.restoreSession(saved).shell.isFile(file),false,'a later deliberate deletion is not undone');
  }
});
