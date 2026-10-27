'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../src/shell.js');require('./load-data.cjs');require('../src/engine.js');
const D=globalThis.LINUXROOM_DATA,E=globalThis.LinuxroomEngine;

test('all original lesson IDs retain their order and saved completions',()=>{
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/v0.2-progress.json'),'utf8'));
  const ids=Object.keys(old.progress.completed);
  assert.equal(ids.length,108);
  assert.deepEqual(D.lessons.filter(l=>ids.includes(l.id)).map(l=>l.id),ids);
});

test('three complete levels exercise every supported log-analysis command',()=>{
  assert.deepEqual(D.levels.map(l=>l.id),['beginner','applied','advanced']);
  const actual=new Set();
  for(const level of D.levels){
    const lessons=D.lessons.filter(l=>l.level===level.id);
    assert.equal(lessons.length,level.id === 'applied' ? 49 : 36,level.id);
    for(const l of lessons){
      const s=E.createSession(l.id);
      for(const c of l.solution){const r=E.run(s,c);for(const stage of r.trace)actual.add(stage.command);}
      assert.equal(E.check(s).passed,true,l.id);
      const example=E.createSession(l.id);
      for(const stage of E.run(example,l.example.command).trace)actual.add(stage.command);
    }
  }
  const supported=new LogLabShell().supportedCommands;
  assert.equal(supported.length,56);
  assert.deepEqual(supported.filter(command=>!actual.has(command)),[],'no command missing from real practice');
});

test('v0.1 saves preserve36 completions, work files, assistance, and current lesson',()=>{
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/v0.1-progress.json'),'utf8'));
  const progress=E.hydrate(old.progress);
  assert.deepEqual(E.stats(progress,'beginner'),{completed:36,total:36,percent:100});
  assert.deepEqual(E.stats(progress,'applied'),{completed:0,total:49,percent:0});
  assert.deepEqual(E.stats(progress,'advanced'),{completed:0,total:36,percent:0});
  assert.equal(E.stats(progress).total,121);
  assert.equal(progress.currentId,'27-append');
  assert.equal(progress.completed['01-echo'].assisted,true);
  assert.equal(progress.hints['01-echo'],2);
  for(const [id,snapshot] of Object.entries(old.progress.sessions)){
    const session=E.restoreSession(progress.sessions[id]);
    assert.deepEqual({...session.shell.files},snapshot.shell.files);
    assert.equal(session.shell.cwd,snapshot.shell.cwd);
    assert.equal(E.check(session).passed,true,id);
  }
});

test('diff status1 is an expected difference only when the lesson declares it',()=>{
  const fixture='test-diff-status';
  D.datasets[fixture]={cwd:'/home/analyst',files:{'/home/analyst/a':'old\n','/home/analyst/b':'new\n'}};
  const l={id:fixture,fixture,validation:{all:[{type:'used',command:'diff'},{type:'status',command:'diff',code:1},{type:'output',value:'< old',match:'contains'},{type:'source',path:'/home/analyst/a'}]}};
  D.lessons.push(l);
  try{
    const s=E.createSession(fixture),r=E.run(s,'diff a b');assert.equal(r.code,1);assert.equal(r.expectedStatus,true);assert.equal(E.check(s).passed,true);
    assert.equal(E.check(E.restoreSession(E.serializeSession(s))).passed,true);
    E.run(s,'diff a missing');assert.equal(E.check(s).passed,false);
    E.run(s,'diff a a');assert.equal(E.check(s).passed,false,'identical files do not satisfy a difference task');
    l.validation.all=l.validation.all.filter(rule=>rule.type!=='status');
    E.run(s,'diff a b');assert.equal(E.check(s).passed,false,'nonzero is not accepted globally');
  }finally{D.lessons.splice(D.lessons.indexOf(l),1);delete D.datasets[fixture];}
});

test('absent checks real deletion and status rules never hide stderr',()=>{
  const fixture='test-remove';
  D.datasets[fixture]={cwd:'/home/analyst',files:{'/home/analyst/scratch':'temporary\n'}};
  const l={id:fixture,fixture,validation:{all:[{type:'used',command:'rm'},{type:'absent',path:'/home/analyst/scratch'}]}};D.lessons.push(l);
  try{
    const s=E.createSession(fixture);E.run(s,'cat scratch');assert.equal(E.check(s).passed,false);
    E.run(s,'rm scratch');assert.equal(E.check(s).passed,true);
    assert.equal(E.check(E.restoreSession(E.serializeSession(s))).passed,true);
  }finally{D.lessons.splice(D.lessons.indexOf(l),1);delete D.datasets[fixture];}
});
