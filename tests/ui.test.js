'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const html = fs.readFileSync(path.join(__dirname,'../linuxroom.html'),'utf8');
const KEY = 'linuxroom.progress.v1';
const tick = () => new Promise(resolve => setImmediate(resolve));

async function createApp(saved, blockedStorage=false, url='https://linuxroom.test/') {
  const errors=[];
  const console = new VirtualConsole();
  console.on('jsdomError',error=>errors.push(error.message));
  const dom = new JSDOM(html, {
    url, runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:console,
    beforeParse(window) {
      Object.defineProperty(window.navigator, 'languages', {value: ['ja-JP']});
      Object.defineProperty(window.navigator, 'language', {value: 'ja-JP'});
      window.TextEncoder = globalThis.TextEncoder; window.TextDecoder = globalThis.TextDecoder;
      window.confirm = () => true; window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = function(){};
      window.HTMLDialogElement.prototype.showModal = function(){this.setAttribute('open','');};
      window.HTMLDialogElement.prototype.close = function(){this.removeAttribute('open');this.dispatchEvent(new window.Event('close'));};
      window.URL.createObjectURL = () => 'blob:test'; window.URL.revokeObjectURL = () => {};
      if (saved) { window.localStorage.setItem(KEY,saved.progress); if(saved.ui)window.localStorage.setItem('linuxroom.ui.v1',saved.ui); }
      if (blockedStorage) Object.defineProperty(window,'localStorage',{get(){throw new window.DOMException('Storage unavailable','SecurityError');}});
    }
  });
  await tick();
  const w=dom.window,d=w.document;
  const click=id=>{const element=d.getElementById(id);assert.ok(element,id);element.click();};
  const run=command=>{
    if(command==='q'&&d.getElementById('pager-dialog').open){d.getElementById('pager-content').dispatchEvent(new w.KeyboardEvent('keydown',{key:'q',bubbles:true}));return;}
    const input=d.getElementById('command-input'); input.value=command; input.dispatchEvent(new w.Event('input',{bubbles:true}));
    d.getElementById('command-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  };
  const openLesson=lesson=>{
    click('map-button');
    const levelButton=d.querySelector('#map-dialog [data-level="'+lesson.level+'"]');
    if(levelButton)levelButton.click();
    const button=[...d.querySelectorAll('#chapter-list button')].find(el=>el.textContent.includes(lesson.title));
    assert.ok(button,lesson.id+' navigation');button.click();
    assert.equal(d.getElementById('lesson-title').textContent,lesson.title);
  };
  return {dom,w,d,errors,click,run,openLesson};
}

test('the distribution is truly standalone and retains its license',()=>{
  assert.match(html,/Copyright \(c\) 2026 Logroom contributors/);
  assert.match(html,/connect-src 'none'/);
  assert.doesNotMatch(html,/<script[^>]+src=/i);
  assert.doesNotMatch(html,/<link[^>]+(?:stylesheet|preconnect|preload)/i);
  assert.doesNotMatch(html,/\/\*__[A-Z]+__\*\//);
});

test('all lessons can be completed through rendered UI, including pager and map', async()=>{
  const app=await createApp();
  try {
    assert.deepEqual(app.errors,[]);
    app.click('start-learning');
    const lessons=app.w.LINUXROOM_DATA.lessons;
    for(const lesson of lessons){
      app.openLesson(lesson);
      for(const command of lesson.solution)app.run(command);
      app.click('check-answer');
      assert.equal(app.d.getElementById('success-box').hidden,false,lesson.id+' '+app.d.getElementById('lesson-feedback').textContent);
    }
    assert.equal(app.d.getElementById('graduation-link').hidden,false);
    assert.equal(JSON.parse(app.w.localStorage.getItem(KEY)).completed && Object.keys(JSON.parse(app.w.localStorage.getItem(KEY)).completed).length,lessons.length);
    assert.equal(app.d.getElementById('storage-warning').hidden,true,'the full curriculum fits browser storage');
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
});

test('input is escaped, hints are optional, retry is local, and storage survives reload',async()=>{
  const app=await createApp();
  let saved;
  try{
    app.click('start-learning');
    app.run("echo '<img src=x onerror=alert(1)>'");
    assert.equal(app.d.querySelectorAll('#terminal-output img').length,0);
    app.click('check-answer');assert.equal(app.d.getElementById('success-box').hidden,true);
    app.click('hint-button');assert.ok(app.d.getElementById('hint-list').textContent);
    app.run('echo ready');app.click('check-answer');
    app.click('next-lesson');
    app.run("echo 'linux room'");app.click('check-answer');
    app.click('retry-lesson');
    const lesson=app.w.LINUXROOM_DATA.lessons.find(l=>l.solution.some(c=>c.includes('tee ')));
    app.openLesson(lesson);
    for(const command of lesson.solution)app.run(command);
    app.click('check-answer');
    saved={progress:app.w.localStorage.getItem(KEY),ui:app.w.localStorage.getItem('linuxroom.ui.v1')};assert.ok(saved.progress);
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
  const restored=await createApp(saved);
  try{
    assert.equal(restored.d.getElementById('workspace').hidden,false);
    const lesson=restored.w.LINUXROOM_DATA.lessons.find(l=>l.solution.some(c=>c.includes('tee ')));
    const file=lesson.validation.all.find(c=>c.type==='file');
    restored.run('cat '+file.path);
    assert.match(restored.d.getElementById('terminal-output').textContent,/ren/);
    restored.click('map-button');
    assert.match(restored.d.getElementById('map-progress').textContent,/[234]/);
    assert.deepEqual(restored.errors,[]);
  }finally{restored.dom.window.close();}
});

test('storage denial has a visible fallback and does not stop learning',async()=>{
  const app=await createApp(null,true);
  try{
    app.click('start-learning');app.run('echo ready');app.click('check-answer');
    assert.equal(app.d.getElementById('success-box').hidden,false);
    assert.equal(app.d.getElementById('storage-warning').hidden,false);
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
});

test('old progress resumes beginner and level switches preserve each workspace and draft',async()=>{
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/v0.1-progress.json'),'utf8'));
  const app=await createApp({progress:JSON.stringify(old.progress),ui:JSON.stringify(old.ui)});
  let saved;
  try{
    assert.match(app.d.getElementById('lesson-position').textContent,/初級/);
    assert.equal(app.d.getElementById('command-input').value,'cat ../reports/memo.txt');
    assert.equal(Object.keys(JSON.parse(app.w.localStorage.getItem(KEY)).completed).length,36);
    app.click('home-button');
    app.d.querySelector('#level-cards [data-level="applied"]').click();
    const appliedFirst=app.w.LINUXROOM_DATA.lessons.find(l=>l.level==='applied');
    assert.equal(app.d.getElementById('lesson-title').textContent,appliedFirst.title);
    app.run('echo retained > /tmp/level-work.txt');
    const input=app.d.getElementById('command-input');input.value='unfinished command';input.dispatchEvent(new app.w.Event('input',{bubbles:true}));
    app.click('home-button');app.d.querySelector('#level-cards [data-level="advanced"]').click();
    assert.match(app.d.getElementById('lesson-position').textContent,/発展/);
    app.click('home-button');app.d.querySelector('#level-cards [data-level="applied"]').click();
    assert.equal(app.d.getElementById('command-input').value,'unfinished command');
    app.run('cat /tmp/level-work.txt');assert.match(app.d.getElementById('terminal-output').textContent,/retained/);
    saved={progress:app.w.localStorage.getItem(KEY),ui:app.w.localStorage.getItem('linuxroom.ui.v1')};
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
  const resumed=await createApp(saved);
  try{
    assert.match(resumed.d.getElementById('lesson-position').textContent,/応用/);
    resumed.run('cat /tmp/level-work.txt');assert.match(resumed.d.getElementById('terminal-output').textContent,/retained/);
    assert.deepEqual(resumed.errors,[]);
  }finally{resumed.dom.window.close();}
});

test('graduation buttons cross beginner to applied to advanced in order',async()=>{
  const app=await createApp();
  try{
    for(const [from,to] of [['beginner','applied'],['applied','advanced']]){
      const last=app.w.LINUXROOM_DATA.lessons.filter(l=>l.level===from).at(-1);
      app.openLesson(last);for(const c of last.solution)app.run(c);
      app.click('check-answer');assert.equal(app.d.getElementById('success-box').hidden,false);
      assert.equal(app.d.getElementById('graduation-link').hidden,false);
      assert.equal(app.d.getElementById('graduation-link').getAttribute('target'),'_blank');
      app.click('next-lesson');
      assert.equal(app.d.getElementById('lesson-title').textContent,app.w.LINUXROOM_DATA.lessons.find(l=>l.level===to).title);
    }
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
});

test('a v0.1 progress record resumes even when the separate UI record is missing',async()=>{
  const old=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/v0.1-progress.json'),'utf8'));
  const app=await createApp({progress:JSON.stringify(old.progress)});
  try{
    assert.equal(app.d.getElementById('workspace').hidden,false);
    assert.equal(app.d.getElementById('lesson-title').textContent,app.w.LINUXROOM_DATA.lessons.find(l=>l.id===old.progress.currentId).title);
    assert.match(app.d.getElementById('lesson-position').textContent,/初級/);
    app.run('cat ../reports/memo.txt');
    assert.match(app.d.getElementById('terminal-output').textContent,/確認開始\s+確認完了/);
    assert.equal(Object.keys(JSON.parse(app.w.localStorage.getItem(KEY)).completed).length,36);
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
});

test('optional preparation keeps saved work and the isolated check does not award completion',async()=>{
  const app=await createApp();
  try{
    app.click('start-learning');
    app.run('echo retained > /tmp/own.txt');
    const draft='cat /tmp/own.txt';
    app.d.getElementById('command-input').value=draft;
    app.d.getElementById('command-input').dispatchEvent(new app.w.Event('input',{bubbles:true}));
    app.click('map-button');
    const prep=[...app.d.querySelectorAll('[data-preparation-lesson]')];
    assert.deepEqual(prep.map(b=>b.dataset.preparationLesson),['ap-07-grep-fixed','ad-21-awk-nf','ad-12-diff']);
    app.click('diagnostic-open');
    const submit=id=>app.d.getElementById(id).dispatchEvent(new app.w.Event('submit',{bubbles:true,cancelable:true}));
    app.d.getElementById('diagnostic-command').value="grep 'Failed password' auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr";
    submit('diagnostic-command-form');
    assert.match(app.d.getElementById('diagnostic-output').textContent,/3 198\.51\.100\.62/);
    assert.match(app.d.getElementById('diagnostic-output').textContent,/2 203\.0\.113\.24/);
    app.d.getElementById('diagnostic-command').value='cat /tmp/own.txt';
    submit('diagnostic-command-form');
    assert.doesNotMatch(app.d.getElementById('diagnostic-output').textContent,/retained/);
    app.d.getElementById('diagnostic-ip').value='198.51.100.62';
    app.d.getElementById('diagnostic-count').value='3';
    submit('diagnostic-answer-form');
    assert.match(app.d.getElementById('diagnostic-feedback').textContent,/一致/);
    app.d.getElementById('diagnostic-count').value='4';
    app.d.getElementById('diagnostic-count').dispatchEvent(new app.w.Event('input',{bubbles:true}));
    assert.equal(app.d.getElementById('diagnostic-feedback').textContent,'');
    submit('diagnostic-answer-form');
    assert.match(app.d.getElementById('diagnostic-feedback').textContent,/比べ直し/);
    app.d.getElementById('diagnostic-command').value='rm auth.log';
    submit('diagnostic-command-form');
    app.click('diagnostic-reset');
    assert.equal(app.d.getElementById('diagnostic-ip').value,'');
    assert.equal(app.d.getElementById('diagnostic-feedback').textContent,'');
    app.d.getElementById('diagnostic-command').value='cat auth.log';
    submit('diagnostic-command-form');
    assert.match(app.d.getElementById('diagnostic-output').textContent,/Failed password/);
    app.d.querySelector('#diagnostic-dialog .close-dialog').click();
    assert.equal(app.d.getElementById('command-input').value,draft);
    app.run('cat /tmp/own.txt');
    assert.match(app.d.getElementById('terminal-output').textContent,/retained/);
    assert.deepEqual(Object.keys(JSON.parse(app.w.localStorage.getItem(KEY)).completed),[]);
    app.click('map-button');app.d.querySelector('[data-preparation-lesson="ad-21-awk-nf"]').click();
    assert.equal(JSON.parse(app.w.localStorage.getItem(KEY)).currentId,'ad-21-awk-nf');
    assert.equal(app.w.LINUXROOM_DATA.lessons.length,121);
    assert.deepEqual(app.errors,[]);
  }finally{app.w.close();}
});

test('version is visible at the top and graduation suggestions remain optional offline',async()=>{
  const app=await createApp(null,false,'file:///training/linuxroom.html');
  try{
    assert.equal(app.d.getElementById('brand-version').textContent,'STEP BY STEP / v'+require('../package.json').version);
    assert.equal(app.d.getElementById('graduation-options').hidden,true);
    const final=app.w.LINUXROOM_DATA.lessons.find(l=>l.id==='36-final-ranking');
    app.openLesson(final);for(const c of final.solution)app.run(c);app.click('check-answer');
    assert.equal(app.d.getElementById('graduation-link').getAttribute('href'),'socroom-easy.html');
    assert.equal(app.d.getElementById('next-lesson').hidden,false);
    app.click('next-lesson');
    assert.equal(app.d.getElementById('lesson-title').textContent,app.w.LINUXROOM_DATA.lessons.find(l=>l.level==='applied').title);
    assert.equal(app.d.getElementById('success-box').hidden,true);
    assert.deepEqual(app.errors,[]);
  }finally{app.w.close();}
});

function rightArrow(app, options = {}, target = app.d.getElementById('command-input')) {
  const event = new app.w.KeyboardEvent('keydown', {key:'ArrowRight',bubbles:true,cancelable:true,...options});
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

test('right arrow advances completed lessons in all three levels and focuses the next command input',async()=>{
  const app=await createApp();
  try {
    const data=app.w.LINUXROOM_DATA;
    for(const level of data.levels){
      const [first,next]=data.lessons.filter(lesson=>lesson.level===level.id);
      app.openLesson(first);
      assert.equal(rightArrow(app),false,'unfinished lessons do not advance');
      for(const command of first.solution)app.run(command);
      app.click('check-answer');
      assert.equal(app.d.getElementById('success-box').hidden,false);
      assert.equal(app.d.getElementById('next-shortcut').hidden,false);
      assert.equal(rightArrow(app),true,level.id);
      assert.equal(app.d.getElementById('lesson-title').textContent,next.title);
      assert.equal(app.d.activeElement.id,'command-input');
      assert.equal(JSON.parse(app.w.localStorage.getItem(KEY)).currentId,next.id);
    }
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
});

test('next-lesson shortcut preserves editing, native controls, selection, dialogs and the home screen',async()=>{
  const app=await createApp();
  try {
    app.click('start-learning');app.run('echo ready');
    const input=app.d.getElementById('command-input'),title=app.d.getElementById('lesson-title').textContent;
    for(const value of ['echo ready',' ']){input.value=value;input.setSelectionRange(2,2);assert.equal(rightArrow(app),false);assert.equal(input.value,value);}
    input.value='';
    for(const options of [{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{repeat:true},{isComposing:true},{keyCode:229}])assert.equal(rightArrow(app,options),false,JSON.stringify(options));
    const handled=new app.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true});handled.preventDefault();input.dispatchEvent(handled);
    assert.equal(rightArrow(app,{},app.d.getElementById('language-select')),false);
    const editor=app.d.createElement('div');editor.contentEditable='true';editor.setAttribute('contenteditable','true');app.d.body.append(editor);
    assert.equal(rightArrow(app,{},editor),false);editor.remove();
    const range=app.d.createRange();range.selectNodeContents(app.d.getElementById('lesson-title'));app.w.getSelection().removeAllRanges();app.w.getSelection().addRange(range);
    assert.equal(app.w.getSelection().isCollapsed,false);
    assert.equal(rightArrow(app,{},app.d.body),false);app.w.getSelection().removeAllRanges();
    app.click('reference-button');assert.equal(rightArrow(app),false);app.d.querySelector('#reference-dialog .close-dialog').click();
    app.run('less /home/analyst/logs/names.txt');assert.equal(app.d.getElementById('pager-dialog').open,true);assert.equal(rightArrow(app),false);app.run('q');
    assert.equal(app.d.getElementById('lesson-title').textContent,title);
    app.click('home-button');assert.equal(rightArrow(app,{},app.d.body),false);
    assert.equal(app.d.getElementById('workspace').hidden,true);
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
});

test('holding right does not skip completed lessons and level boundaries use the existing next action',async()=>{
  const app=await createApp();
  try {
    const data=app.w.LINUXROOM_DATA;
    for(const lesson of data.lessons.slice(0,2)){app.openLesson(lesson);for(const command of lesson.solution)app.run(command);}
    app.openLesson(data.lessons[0]);assert.equal(rightArrow(app),true);
    assert.equal(app.d.getElementById('lesson-title').textContent,data.lessons[1].title);
    assert.equal(rightArrow(app,{repeat:true}),false);
    assert.equal(app.d.getElementById('lesson-title').textContent,data.lessons[1].title);
    for(let index=0;index<data.levels.length;index++){
      const last=data.lessons.filter(lesson=>lesson.level===data.levels[index].id).at(-1);
      app.openLesson(last);for(const command of last.solution)app.run(command);app.click('check-answer');
      assert.equal(app.d.getElementById('success-box').hidden,false,last.id);
      if(index+1<data.levels.length){
        assert.equal(rightArrow(app),true);
        assert.equal(app.d.getElementById('lesson-title').textContent,data.lessons.find(lesson=>lesson.level===data.levels[index+1].id).title);
      }else{
        assert.equal(app.d.getElementById('next-shortcut').hidden,true);
        assert.equal(rightArrow(app),false);assert.equal(app.d.getElementById('lesson-title').textContent,last.title);
      }
    }
    assert.deepEqual(app.errors,[]);
  }finally{app.dom.window.close();}
});
