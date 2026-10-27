'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const artifactDir = path.join(__dirname, 'artifacts');
fs.mkdirSync(artifactDir, {recursive:true});

(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.LINUXROOM_BROWSER_CHANNEL ? {channel:process.env.LINUXROOM_BROWSER_CHANNEL} : {})});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}, deviceScaleFactor:1});
    const targetUrl = process.env.LINUXROOM_URL || pathToFileURL(path.join(root, 'linuxroom.html')).href;
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url()) && request.url() !== targetUrl) requests.push(request.url()); });
    page.on('dialog', async dialog => { await dialog.accept(); });
    await page.goto(targetUrl);
    await page.screenshot({path:path.join(artifactDir,'welcome.png'),fullPage:true});
    await page.locator('#start-learning').click();
    assert.equal(await page.locator('#terminal-prompt').textContent(),'analyst@linuxroom:~$');
    await page.locator('#command-input').fill('echo ready');
    await page.locator('#command-input').press('Enter');
    await page.locator('#check-answer').click();
    assert.equal(await page.locator('#success-box').isVisible(),true);
    await page.locator('#next-lesson').click();
    const lessons = await page.evaluate(() => globalThis.LINUXROOM_DATA.lessons);
    const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    async function openLesson(lesson) {
      await page.locator('#map-button').click();
      await page.locator('#map-dialog [data-level="'+lesson.level+'"]').click();
      await page.locator('#chapter-list').getByRole('button', {name:new RegExp(escaped(lesson.title))}).click();
      assert.equal(await page.locator('#lesson-title').textContent(),lesson.title);
    }
    async function solve(lesson) {
      await openLesson(lesson);
      for (const input of lesson.solution) {
        if (input === 'q') { await page.keyboard.press('q'); }
        else { await page.locator('#command-input').fill(input); await page.locator('#command-input').press('Enter'); }
      }
      await page.locator('#check-answer').click();
      assert.equal(await page.locator('#success-box').isVisible(),true,lesson.id);
    }
    const listing = lessons.find(l=>l.id==='04-ls');
    await openLesson(listing);
    await page.locator('#command-input').fill('ls -1');await page.locator('#command-input').press('Enter');
    await page.locator('#check-answer').click();assert.equal(await page.locator('#success-box').isVisible(),true);
    for(const id of ['ap-37-input-redirection','ap-39-ls-time','ap-45-and-sequence','ap-46-stderr','ap-47-exit-status','ap-48-cat-visible','ap-49-file-hash'])await solve(lessons.find(l=>l.id===id));
    await page.reload();
    await page.locator('#check-answer').click();assert.equal(await page.locator('#success-box').isVisible(),true,'review lesson evidence survives a real reload');
    // Separate pager entry/exit, then progressively longer pipelines and persistence.
    const pager = lessons.find(lesson => lesson.validation.all.some(c => c.type === 'pagerClosed'));
    await solve(pager);
    const pipeline = lessons.filter(lesson => lesson.validation.all.some(c => c.type === 'pipeline' && c.minStages >= 5))[0];
    assert.ok(pipeline, 'a multi-stage learning task exists');
    await solve(pipeline);
    assert.ok(await page.locator('#trace-stages button').count() >= 5);
    await page.locator('#trace-stages button').first().click();
    assert.match(await page.locator('#trace-output').textContent(), /ERROR/);
    await page.locator('#trace-stages button').last().click();
    await page.locator('#toast').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(artifactDir,'pipeline.png'),fullPage:true});
    const saved = lessons.find(lesson => lesson.solution.some(command => /\btee\b/.test(command)));
    await solve(saved);
    const savedFile = saved.validation.all.find(c => c.type === 'file');
    assert.ok(savedFile);
    await page.reload();
    await page.locator('#command-input').fill('cat ' + savedFile.path);
    await page.locator('#command-input').press('Enter');
    assert.match(await page.locator('#terminal-output').textContent(), /ren/);
    const jqLesson = lessons.filter(lesson => lesson.solution.some(command => /^jq/.test(command))).at(-1);
    await solve(jqLesson);
    const appliedFinal = lessons.filter(lesson => lesson.level === 'applied').at(-1);
    await solve(appliedFinal);
    await page.locator('#next-lesson').click();
    assert.equal(await page.locator('#lesson-title').textContent(),lessons.find(lesson=>lesson.level==='advanced').title);
    const differences = lessons.find(lesson => lesson.validation.all.some(rule=>rule.type==='status'&&rule.command==='diff'));
    await solve(differences);
    assert.match(await page.locator('#terminal-output').textContent(),/diff/);
    await solve(lessons.at(-1));
    assert.equal(await page.locator('#graduation-link').isVisible(),true);
    assert.equal(await page.locator('#next-lesson').isVisible(),false);
    assert.match(await page.locator('#graduation-link').getAttribute('href'), /logroom/);
    await page.locator('#toast').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(artifactDir,'advanced.png'),fullPage:true});
    // An error and unmatched search must not break subsequent command input.
    await openLesson(lessons.find(lesson => lesson.id === '11-grep'));
    await page.locator('#command-input').fill('cat missing.log');
    await page.locator('#command-input').press('Enter');
    assert.match(await page.locator('#run-feedback').textContent(), /見つかりません|現在地/);
    await page.locator('#command-input').fill("grep 'NOT_FOUND' app.log");
    await page.locator('#command-input').press('Enter');
    assert.match(await page.locator('#run-feedback').textContent(), /一致/);
    await page.locator('#command-input').fill("grep 'ERROR' app.log");
    await page.locator('#command-input').press('Enter');
    await page.locator('#check-answer').click();
    assert.equal(await page.locator('#success-box').isVisible(),true);
    // Input is inert even when it resembles markup.
    await page.locator('#command-input').fill("echo '<img src=x onerror=alert(1)>'");
    await page.locator('#command-input').press('Enter');
    assert.equal(await page.locator('#terminal-output img').count(),0);
    // Real keyboard interactions and JSON import/export through the browser.
    const input = page.locator('#command-input');
    await input.fill('gre'); await input.press('Tab'); assert.match(await input.inputValue(), /^grep/);
    await input.fill('pwd'); await input.press('Enter'); await input.press('ArrowUp'); assert.equal(await input.inputValue(),'pwd');
    await input.press('Control+c'); assert.equal(await input.inputValue(),'');
    await page.locator('#save-button').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-progress').click();
    const download = await downloadPromise;
    const savePath = path.join(artifactDir,'progress.json'); await download.saveAs(savePath);
    const savedProgress = JSON.parse(fs.readFileSync(savePath,'utf8'));
    assert.equal(savedProgress.format,'linuxroom-export');
    const beforeInvalid = await page.evaluate(() => localStorage.getItem('linuxroom.progress.v1'));
    await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
    await page.waitForFunction(() => document.getElementById('save-status').textContent.includes('JSON'));
    assert.equal(await page.evaluate(() => localStorage.getItem('linuxroom.progress.v1')),beforeInvalid);
    const oversized = {version:1,currentId:'01-echo',completed:{},hints:{},sessions:{},padding:'x'.repeat(8*1024*1024)};
    await page.locator('#import-file').setInputFiles({name:'oversize.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oversized))});
    await page.waitForFunction(() => /大きすぎ|サイズ|保存上限/.test(document.getElementById('save-status').textContent));
    assert.equal(await page.evaluate(() => localStorage.getItem('linuxroom.progress.v1')),beforeInvalid);
    await page.locator('#import-file').setInputFiles(savePath);
    await page.waitForFunction(() => !document.getElementById('save-dialog').open);
    assert.equal(await page.locator('#lesson-title').textContent(),lessons.find(l=>l.id===savedProgress.progress.currentId).title);
    await page.setViewportSize({width:390,height:844});
    await page.locator('#toast').waitFor({state:'hidden'});
    await page.screenshot({path:path.join(artifactDir,'mobile.png'),fullPage:true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),true,'mobile page has no horizontal overflow');
    await page.locator('#save-button').click();
    await page.locator('#import-file').setInputFiles(path.join(__dirname,'fixtures/v0.2-progress.json'));
    await page.waitForFunction(() => !document.getElementById('save-dialog').open);
    const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('linuxroom.progress.v1')));
    assert.equal(Object.keys(migrated.completed).length,108);
    const volumeLesson=lessons.find(l=>l.id==='ap-05-more');
    for(const path of volumeLesson.fixtureAdditions)assert.equal(migrated.sessions[volumeLesson.id].shell.files[path].trim().split('\n').length,400);
    await solve(volumeLesson);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),true,'long prompt and the larger lesson fit mobile width');
    await page.screenshot({path:path.join(artifactDir,'mobile-review.png'),fullPage:true});
    assert.deepEqual(errors, [], 'no browser exceptions');
    assert.deepEqual(requests, [], 'offline app makes no network requests');
    console.log('Browser QA passed: review syntax, prompt, all stage transitions, pager, pipeline input/output, persistence, v0.2 migration, JSON import/export, mobile layout, offline requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
