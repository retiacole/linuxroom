(function () {
  'use strict';
  const DATA = globalThis.LINUXROOM_DATA;
  const Engine = globalThis.LinuxroomEngine;
  const KEY = 'linuxroom.progress.v1';
  const UI_KEY = 'linuxroom.ui.v1';
  const $ = id => document.getElementById(id);
  const lessons = DATA.lessons;
  const byId = new Map(lessons.map(lesson => [lesson.id, lesson]));
  const levels = Array.isArray(DATA.levels) && DATA.levels.length ? DATA.levels : [{ id: 'beginner', title: '初級編', subtitle: '一つずつ、コマンドを覚える', description: 'ファイルを読むところから、パイプをつないで集計するところまで。' }];
  const levelById = new Map(levels.map(level => [level.id, level]));
  const levelLessons = id => lessons.filter(lesson => (lesson.level || 'beginner') === id);
  const levelOf = lesson => lesson && levelById.has(lesson.level) ? lesson.level : levels[0].id;
  const lessonCommands = lesson => [...(lesson.commands || []), ...(lesson.validation && lesson.validation.all || []).filter(rule => rule.type === 'used').map(rule => rule.command)];
  const taughtCommands = new Set(lessons.flatMap(lessonCommands));
  const modeLabels = { guide: 'まねて、試す', practice: '少し変えて、使う', challenge: '自分で、組み立てる' };
  const sessions = new Map();
  let progress = Engine.createProgress();
  let ui = { started: false, drafts: {}, transcripts: {}, solutions: {}, currentByLevel: {} };
  let activeLevel = levels[0].id;
  let currentSession = null;
  let currentLesson = null;
  let historyCursor = 0;
  let historyDraft = '';
  let latestTrace = [];
  let traceIndex = 0;
  let saveTimer;
  let toastTimer;
  let importBusy = false;
  let lastFocus = null;

  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = String(text);
    return result;
  }

  function promptFor(cwd) {
    const home = '/home/analyst';
    const location = cwd === home ? '~' : cwd.startsWith(home + '/') ? '~' + cwd.slice(home.length) : cwd;
    return 'analyst@linuxroom:' + location + '$';
  }

  function validId(id) { return id === 'sandbox' || byId.has(id); }
  function safeUI(raw) {
    const clean = { started: false, drafts: {}, transcripts: {}, solutions: {}, currentByLevel: {} };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
    clean.started = raw.started === true;
    levels.forEach(level => {
      const id = raw.currentByLevel && raw.currentByLevel[level.id];
      if (byId.has(id) && levelOf(byId.get(id)) === level.id) clean.currentByLevel[level.id] = id;
    });
    for (const id of ['sandbox', ...lessons.map(lesson => lesson.id)]) {
      const draft = raw.drafts && Object.prototype.hasOwnProperty.call(raw.drafts, id) ? raw.drafts[id] : '';
      if (typeof draft === 'string') clean.drafts[id] = draft.slice(0, 8192);
      if (raw.solutions && raw.solutions[id] === true) clean.solutions[id] = true;
      const entries = raw.transcripts && Object.prototype.hasOwnProperty.call(raw.transcripts, id) ? raw.transcripts[id] : null;
      if (Array.isArray(entries)) clean.transcripts[id] = entries.slice(-60).filter(entry => entry && typeof entry === 'object' && typeof entry.input === 'string').map(entry => ({
        input: entry.input.slice(0, 8192), stdout: String(entry.stdout || '').slice(0, 24000), stderr: String(entry.stderr || '').slice(0, 12000),
        code: Number.isFinite(entry.code) ? entry.code : 0, note: typeof entry.note === 'string' ? entry.note.slice(0, 1000) : '',
        cwd: typeof entry.cwd === 'string' && entry.cwd.startsWith('/') && !/[\x00-\x1f\x7f]/.test(entry.cwd) ? entry.cwd.slice(0, 4096) : null
      }));
    }
    return clean;
  }

  function storageFailure() {
    $('storage-warning').hidden = false;
    $('storage-warning').textContent = 'ブラウザへの自動保存ができません。「進捗を保存」からファイルをダウンロードすると、あとで続きから学習できます。';
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) progress = Engine.hydrate(raw);
      const rawUI = localStorage.getItem(UI_KEY);
      if (rawUI) {
        try { ui = safeUI(JSON.parse(rawUI)); } catch (_) { /* Ignore malformed UI preferences. */ }
      }
    } catch (_) { storageFailure(); }
    if (!progress.sessions) progress.sessions = {};
    if (!progress.hints) progress.hints = {};
    if (!progress.completed) progress.completed = {};
    if (!validId(progress.currentId)) progress.currentId = lessons[0].id;
    reconcileUIProgress();
  }

  function reconcileUIProgress() {
    // Progress exports can outlive UI preferences; keep the learning checkpoint authoritative.
    const selected = byId.get(progress.currentId);
    activeLevel = levelOf(selected);
    if (selected) ui.currentByLevel[activeLevel] = selected.id;
    if (progress.currentId !== lessons[0].id || Object.keys(progress.sessions).length || Object.keys(progress.completed).length || Object.keys(progress.hints).length) ui.started = true;
    lessons.forEach(lesson => { if (progress.hints[lesson.id] === 4) ui.solutions[lesson.id] = true; });
  }

  function checkpoint() {
    if (currentSession) {
      progress.sessions[currentSession.lessonId] = Engine.serializeSession(currentSession);
      ui.drafts[currentSession.lessonId] = $('command-input').value;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
      $('save-status').textContent = 'このブラウザに自動保存しました。';
    } catch (_) { storageFailure(); }
  }

  function laterSave() { clearTimeout(saveTimer); saveTimer = setTimeout(checkpoint, 200); }
  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }

  function stats() {
    const s = Engine.stats(progress);
    $('progress-label').textContent = s.completed + ' / ' + s.total + ' レッスン修了';
    $('progress-fill').style.width = s.percent + '%';
    const selected = levelById.get(activeLevel);
    const current = levelStats(activeLevel);
    $('map-progress').textContent = selected.title + '　' + current.completed + ' / ' + current.total + ' レッスン修了 · ' + current.percent + '%';
    $('map-overall').textContent = '全体 ' + s.completed + ' / ' + s.total + ' レッスン修了';
    $('welcome-progress').textContent = s.completed ? '全体 ' + s.completed + ' / ' + s.total + ' レッスン修了。今日も一歩ずつ。' : '';
    $('course-summary').textContent = levels.length + ' 段階 · 全 ' + s.total + ' レッスン';
    $('brand-version').textContent = 'STEP BY STEP / v' + (DATA.release || '0.3');
    $('footer-version').textContent = 'Offline learning lab · v' + (DATA.release || '0.3');
    $('start-learning').replaceChildren(document.createTextNode(ui.started ? '続きから学ぶ ' : '最初のレッスンをはじめる '), node('span', '', '→'));
    renderLevelCards();
  }

  function levelStats(id) {
    const selected = levelLessons(id);
    const completed = selected.filter(lesson => progress.completed[lesson.id]).length;
    return { completed, total: selected.length, percent: selected.length ? Math.round(completed / selected.length * 100) : 0 };
  }

  function resumeLevel(id) {
    const remembered = byId.get(ui.currentByLevel[id]);
    const target = remembered && levelOf(remembered) === id ? remembered : levelLessons(id)[0];
    if (target) renderLesson(target.id, { focus: true });
  }

  function renderLevelCards() {
    $('level-cards').replaceChildren(...levels.map((level, index) => {
      const s = levelStats(level.id);
      const card = node('section', 'level-card' + (levelOf(currentLesson || byId.get(progress.currentId)) === level.id ? ' level-current' : ''));
      const heading = node('div', 'level-card-heading');
      heading.append(node('span', 'level-step', 'STEP ' + String(index + 1).padStart(2, '0')), node('span', 'level-count', s.total + ' レッスン'));
      card.append(heading, node('h3', '', level.title), node('p', 'level-subtitle', level.subtitle || ''), node('p', 'level-description', level.description || '小さな操作をつなぎながら、できることを増やします。'));
      const progressLabel = node('div', 'level-progress-label');
      progressLabel.append(node('span', '', s.completed + ' / ' + s.total + ' 修了'), node('span', '', s.percent + '%'));
      const track = node('div', 'progress-track');
      const fill = node('span');
      fill.style.width = s.percent + '%';
      track.append(fill);
      const button = node('button', 'button secondary full-width', level.title + (ui.started && ui.currentByLevel[level.id] ? 'の続きへ →' : 'をはじめる →'));
      button.dataset.level = level.id;
      button.setAttribute('aria-label', level.title + 'を選んで学習する');
      button.addEventListener('click', () => resumeLevel(level.id));
      card.append(progressLabel, track, button);
      return card;
    }));
  }

  function nextLesson(lesson) {
    if (!lesson) return null;
    const level = levelOf(lesson);
    const selected = levelLessons(level);
    const index = selected.indexOf(lesson);
    if (selected[index + 1]) return selected[index + 1];
    const nextLevel = levels[levels.findIndex(item => item.id === level) + 1];
    return nextLevel ? levelLessons(nextLevel.id)[0] || null : null;
  }

  function openDialog(id) {
    const dialog = $(id);
    lastFocus = document.activeElement;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  function closeAllDialogs() {
    document.querySelectorAll('dialog[open]').forEach(dialog => closeDialog(dialog));
  }

  function home() {
    checkpoint();
    $('workspace').hidden = true;
    $('welcome').hidden = false;
    stats();
    window.scrollTo(0, 0);
  }

  function obtainSession(id) {
    if (sessions.has(id)) return sessions.get(id);
    let session;
    if (progress.sessions[id]) {
      try { session = Engine.restoreSession(progress.sessions[id]); } catch (_) { /* Fall back to a fresh lesson. */ }
    }
    if (!session || session.lessonId !== id) session = Engine.createSession(id);
    sessions.set(id, session);
    return session;
  }

  function renderLesson(id, options) {
    options = options || {};
    if (!validId(id)) id = lessons[0].id;
    if (currentSession && !options.skipCheckpoint) checkpoint();
    closeAllDialogs();
    currentLesson = byId.get(id) || null;
    currentSession = obtainSession(id);
    progress.currentId = id;
    if (currentLesson) {
      activeLevel = levelOf(currentLesson);
      ui.currentByLevel[activeLevel] = id;
    }
    ui.started = true;
    $('welcome').hidden = true;
    $('workspace').hidden = false;
    const selected = levelLessons(activeLevel);
    const index = selected.findIndex(lesson => lesson.id === id);
    const chapter = currentLesson ? DATA.chapters.find(ch => ch.id === currentLesson.chapter) : null;
    $('lesson-position').textContent = currentLesson ? levelById.get(activeLevel).title + '　' + String(index + 1).padStart(2, '0') + ' / ' + selected.length + '　' + (chapter ? chapter.title : '') : 'FREE PRACTICE / 自由練習';
    $('lesson-title').textContent = currentLesson ? currentLesson.title : '自由に、コマンドを試そう';
    $('lesson-mode').textContent = currentLesson ? modeLabels[currentLesson.mode] || '一歩ずつ練習' : '自分のペースで';
    $('lesson-minutes').textContent = currentLesson ? '約 ' + currentLesson.minutes + ' 分' : '時間制限なし';
    $('lesson-goal').textContent = currentLesson ? currentLesson.goal : '習ったコマンドを、何度でも。';
    $('lesson-explanation').replaceChildren(...(currentLesson ? currentLesson.explanation : ['ファイルを開いたり、探したり、パイプでつないだり。自由に操作してみましょう。', 'パイプでつないだら、「コマンドが、結果になるまで」で各段を選んでみよう。その段が受け取った入力と、次へ渡した出力を見比べられます。', '下の「この課題で使えるファイル」でファイル名を確認できます。迷ったら help やコマンド帳を使ってください。']).map(text => node('p', '', text)));
    const concepts = node('dl');
    (currentLesson ? currentLesson.concepts : [{ term: 'help', text: 'この教材で使えるコマンドを表示します。' }]).forEach(concept => {
      const row = node('div', 'concept-item');
      row.append(node('dt', '', concept.term), node('dd', '', concept.text));
      concepts.append(row);
    });
    $('concepts').replaceChildren(concepts);
    $('example-details').hidden = !currentLesson || !currentLesson.example;
    $('example-details').open = !!(currentLesson && currentLesson.mode === 'guide');
    $('example-command').textContent = currentLesson && currentLesson.example ? currentLesson.example.command : '';
    $('example-note').textContent = currentLesson && currentLesson.example ? currentLesson.example.note : '';
    $('lesson-task').textContent = currentLesson ? currentLesson.task : 'まずは pwd と ls で、現在地とファイルを見てみよう。';
    $('new-part-box').hidden = !(currentLesson && currentLesson.newPart);
    $('new-part').textContent = currentLesson && currentLesson.newPart || '';
    $('starter-fill').hidden = !(currentLesson && currentLesson.starter);
    $('starter-fill').textContent = currentLesson && currentLesson.newPart ? '前の段階を入力' : '書きはじめを入力';
    $('starter-fill').title = currentLesson && currentLesson.starter || '';
    $('hint-button').disabled = !currentLesson;
    $('solution-button').disabled = !currentLesson;
    $('check-answer').hidden = !currentLesson;
    $('solution-box').hidden = true;
    $('lesson-feedback').hidden = true;
    $('success-box').hidden = true;
    $('jump-mission').textContent = '課題に戻る ↑';
    $('run-feedback').textContent = '';
    $('run-feedback').className = 'run-feedback';
    $('command-input').value = ui.drafts[id] || '';
    historyCursor = commandHistory().length;
    historyDraft = '';
    renderHints();
    if (ui.solutions[id] && currentLesson) renderSolution();
    renderTranscript();
    updateShellView();
    latestTrace = currentSession.lastResult && Array.isArray(currentSession.lastResult.trace) ? currentSession.lastResult.trace : [];
    traceIndex = Math.max(0, latestTrace.length - 1);
    renderTrace();
    if (progress.completed[id] && currentLesson) showSuccess(false);
    stats();
    checkpoint();
    if (!options.noScroll) window.scrollTo(0, 0);
    if (options.focus) $('command-input').focus({ preventScroll: true });
    if (currentSession.pagerOpen) showPager(currentSession.lastResult && currentSession.lastResult.stdout || '');
  }

  function hintLevel() {
    if (!currentLesson) return 0;
    const value = progress.hints[currentLesson.id];
    return Math.min(3, typeof value === 'number' ? value : value && typeof value.count === 'number' ? value.count : 0);
  }

  function renderHints() {
    const count = hintLevel();
    const hints = currentLesson ? currentLesson.hints || [] : [];
    $('hint-count').textContent = count + '/' + hints.length;
    $('hint-button').disabled = !currentLesson || count >= hints.length;
    $('hint-list').replaceChildren(...hints.slice(0, count).map((text, i) => {
      const item = node('div', 'hint-item');
      item.append(node('strong', '', 'HINT ' + (i + 1)), document.createTextNode(text));
      return item;
    }));
  }

  function revealHint() {
    if (!currentLesson) return;
    progress.hints[currentLesson.id] = Math.min(3, hintLevel() + 1);
    if (progress.completed[currentLesson.id]) Engine.complete(progress, currentLesson.id, true);
    renderHints();
    checkpoint();
  }

  function renderSolution() {
    const box = $('solution-box');
    box.replaceChildren(node('h3', '', '解答例'), node('p', '', '見ながら入力しても大丈夫。実行した結果を確かめて、自分の操作にしていきましょう。'));
    (currentLesson.solution || []).forEach(command => box.append(node('code', '', command)));
    box.hidden = false;
  }

  function revealSolution() {
    if (!currentLesson) return;
    ui.solutions[currentLesson.id] = true;
    progress.hints[currentLesson.id] = 4;
    if (progress.completed[currentLesson.id]) Engine.complete(progress, currentLesson.id, true);
    renderSolution();
    renderHints();
    checkpoint();
  }

  function showSuccess(newlyCompleted) {
    if (!currentLesson) return;
    $('lesson-feedback').hidden = true;
    $('success-box').hidden = false;
    $('jump-mission').textContent = '修了・次の課題へ ↑';
    $('success-text').textContent = currentLesson.success;
    $('bridge-text').textContent = currentLesson.bridge || '';
    const next = nextLesson(currentLesson);
    const last = !next;
    $('next-lesson').hidden = last;
    $('next-lesson').textContent = next && levelOf(next) !== levelOf(currentLesson) ? levelById.get(levelOf(next)).title + 'へ進む →' : '次のレッスンへ →';
    $('graduation-link').hidden = !last;
    $('logroom-link').hidden = !last;
    if (last) $('bridge-text').textContent = (currentLesson.bridge || '次は SOCroom-easy でログの読み方を学び、Logroom でコマンドを使ったログ分析へ進みましょう。') + ' 各 GitHub ページから教材を入手できます。';
    else if (levelOf(next) !== levelOf(currentLesson)) $('bridge-text').textContent = levelById.get(levelOf(currentLesson)).title + 'の最後の実習ができました。次は' + levelById.get(levelOf(next)).title + 'です。今までのコマンドに新しい操作を足していきましょう。';
    if (newlyCompleted) toast('✓ ' + currentLesson.title + ' を修了しました');
  }

  function checkAnswer(manual) {
    if (!currentLesson || currentSession.pagerOpen) return;
    const result = Engine.check(currentSession);
    if (result.passed) {
      const first = !progress.completed[currentLesson.id];
      Engine.complete(progress, currentLesson.id, hintLevel() > 0 || ui.solutions[currentLesson.id] === true);
      showSuccess(first);
      stats();
      checkpoint();
    } else if (manual) {
      const feedback = $('lesson-feedback');
      feedback.replaceChildren(node('p', '', result.message || 'あと少し。課題の条件をもう一度確かめてみよう。'));
      const remaining = (result.details || []).filter(detail => !detail.passed);
      if (remaining.length) {
        const list = node('ul');
        remaining.forEach(detail => list.append(node('li', '', detail.message)));
        feedback.append(list);
      }
      feedback.hidden = false;
      toast('課題の条件と、左側のヒントを確認してみよう');
    }
  }

  function commandHistory() {
    return currentSession && Array.isArray(currentSession.events) ? currentSession.events.filter(event => event.type === 'command' && typeof event.input === 'string').map(event => event.input) : [];
  }

  function renderTranscript() {
    const output = $('terminal-output');
    output.replaceChildren();
    const entries = ui.transcripts[currentSession.lessonId] || [];
    if (!entries.length) output.append(node('div', 'terminal-welcome', 'Linuxroom · virtual terminal\n\nanalyst@linuxroom:~$ はプロンプトの例です。\nユーザー名@ホスト名:現在地 のあとに、入力を待つ $ が付きます。\nプロンプトは入力せず、コマンドだけを打って Enter。'));
    entries.forEach(entry => output.append(transcriptNode(entry)));
    output.scrollTop = output.scrollHeight;
  }

  function transcriptNode(entry) {
    const row = node('div', 'terminal-entry');
    const command = node('div', 'terminal-command');
    const prompt = node('span', 'history-prompt', entry.cwd ? promptFor(entry.cwd) : '$');
    prompt.title = entry.cwd ? '実行前の現在地: ' + entry.cwd : '旧版の履歴には実行前の現在地が保存されていません。';
    command.append(prompt, node('span', '', entry.input));
    row.append(command);
    if (entry.stdout) row.append(node('pre', '', entry.stdout));
    if (entry.stderr) row.append(node('pre', 'error', entry.stderr));
    if (!entry.stdout && !entry.stderr && entry.note) row.append(node('div', 'terminal-empty-output', entry.note));
    return row;
  }

  function clearTerminal() {
    if (!currentSession) return;
    ui.transcripts[currentSession.lessonId] = [];
    renderTranscript();
    checkpoint();
  }

  function appendTranscript(input, result, note, cwdBefore) {
    const id = currentSession.lessonId;
    const entries = ui.transcripts[id] || (ui.transcripts[id] = []);
    entries.push({ input, cwd: cwdBefore || currentSession.shell.cwd, stdout: String(result.stdout || '').slice(0, 24000), stderr: String(result.stderr || '').slice(0, 12000), code: result.code || 0, note: note || '' });
    if (entries.length > 60) entries.splice(0, entries.length - 60);
    renderTranscript();
  }

  function updateShellView() {
    $('terminal-cwd').textContent = '現在地: ' + currentSession.shell.cwd;
    $('terminal-prompt').textContent = promptFor(currentSession.shell.cwd);
    $('terminal-prompt').title = 'analyst はユーザー名、linuxroom はホスト名。: の後ろは現在地、~ はホームフォルダ。$ は一般ユーザーの入力待ちです。プロンプトは入力しません。';
    const files = Object.keys(currentSession.shell.files || {}).sort();
    $('file-count').textContent = files.length + ' files';
    $('file-list').replaceChildren(...files.slice(0, 100).map(path => {
      const button = node('button', 'file-button', path);
      button.title = '入力欄に ' + path + ' を追加';
      button.addEventListener('click', () => {
        const value = $('command-input').value;
        fillInput(value + (value && !/\s$/.test(value) ? ' ' : '') + quoteArg(path));
      });
      return button;
    }));
  }

  function runCommand(event) {
    if (event) event.preventDefault();
    if (!currentSession) return;
    const input = $('command-input').value;
    if (!input.trim()) { $('command-input').focus(); return; }
    if (currentSession.pagerOpen) { if (input.trim() === 'q') closePager(); return; }
    const cwdBefore = currentSession.shell.cwd;
    let result;
    try { result = Engine.run(currentSession, input); }
    catch (_) {
      result = { stdout: '', stderr: 'この操作を実行できませんでした。コマンドを短くして、もう一度試してください。', code: 2, trace: [] };
    }
    $('command-input').value = '';
    ui.drafts[currentSession.lessonId] = '';
    historyCursor = commandHistory().length;
    historyDraft = '';
    const noOutput = !result.stdout && !result.stderr;
    const lastStage = Array.isArray(result.trace) && result.trace[result.trace.length - 1];
    const fallback = result.code === 1 && lastStage && lastStage.command === 'diff' ? '差分が見つかりました。diff の終了状態 1 は、二つの内容が異なることを表します。' : result.code === 1 && noOutput && lastStage && ['grep', 'rg'].includes(lastStage.command) ? '一致する行がありませんでした。検索語や大文字・小文字を確認してみよう。' : noOutput && result.code !== 0 ? '終了状態 ' + result.code + ' です。画面に何も表示されなくても、コマンドが成功したとは限りません。' : noOutput && result.code === 0 ? '実行しました。画面に何も表示しないコマンドもあります。' : '';
    const feedback = result.feedback || fallback;
    if (result.clear) clearTerminal();
    else appendTranscript(input, result, result.pager ? '閲覧画面を開きました。q で閉じます。' : fallback, cwdBefore);
    $('run-feedback').textContent = feedback;
    $('run-feedback').className = 'run-feedback' + (result.stderr && !result.expectedStatus ? ' error' : '');
    if (Array.isArray(result.trace) && result.trace.length) {
      latestTrace = result.trace;
      traceIndex = latestTrace.length - 1;
      renderTrace();
    }
    updateShellView();
    checkpoint();
    if (result.pager || currentSession.pagerOpen) showPager(result.stdout || '');
    else { checkAnswer(false); $('command-input').focus({ preventScroll: true }); }
  }

  function quoteArg(arg) {
    arg = String(arg);
    return /^[A-Za-z0-9_./:@%=,+-]+$/.test(arg) ? arg : "'" + arg.replace(/'/g, "'\\''") + "'";
  }

  function stageCommand(stage) {
    return [stage.command, ...(stage.args || []).map(quoteArg)].join(' ');
  }

  function lineCount(text) {
    if (!text) return 0;
    const rows = String(text).split('\n');
    if (rows[rows.length - 1] === '') rows.pop();
    return rows.length;
  }

  function renderTrace() {
    $('trace-empty').hidden = latestTrace.length > 0;
    $('trace-detail').hidden = !latestTrace.length;
    $('trace-summary').textContent = latestTrace.length ? latestTrace.length + ' 個の処理 · 実行結果' : '';
    const stages = $('trace-stages');
    stages.replaceChildren();
    latestTrace.forEach((stage, i) => {
      if (i) {
        const piped = stage.pipeline === latestTrace[i - 1].pipeline && Number(stage.index) > 0;
        stages.append(node('span', piped ? 'stage-arrow' : 'stage-chain', piped ? '|' : '次の実行 →'));
      }
      const button = node('button', 'stage-button');
      button.setAttribute('aria-pressed', String(i === traceIndex));
      button.setAttribute('aria-label', '処理 ' + (i + 1) + ': ' + stageCommand(stage) + ' の入力と出力を見る');
      button.title = stageCommand(stage);
      button.append(node('strong', '', 'STEP ' + (i + 1)), document.createTextNode(stage.command));
      button.addEventListener('click', () => { traceIndex = i; renderTrace(); });
      stages.append(button);
    });
    const stage = latestTrace[traceIndex];
    if (!stage) return;
    $('trace-detail-title').textContent = stageCommand(stage);
    $('trace-line-count').textContent = '出力 ' + lineCount(stage.stdout) + ' 行';
    $('trace-input-count').textContent = lineCount(stage.stdin) + ' 行';
    $('trace-input').textContent = stage.stdin || '（標準入力は空です。ファイル名を引数で渡す処理は、そのファイルを直接読みます）';
    $('trace-input-details').open = Boolean(stage.stdin);
    $('trace-output').textContent = stage.stdout || (stage.stderr ? stage.stderr : '（表示する出力はありません）');
    let note = stage.stderr ? 'この処理でエラーが発生しました。エラー文と入力を確認してみよう。' : stage.code === 1 && stage.command === 'diff' ? '終了状態 1 は「差分あり」を表します。diff では、違いが見つかると 1 を返します。' : stage.code === 1 && ['grep', 'rg'].includes(stage.command) ? '終了状態 1 は「一致する行なし」を表します。検索語や大文字・小文字を確認してみよう。' : stage.code ? '終了状態 ' + stage.code + ' です。このコマンドの説明と結果を確認しましょう。' : '';
    if (stage.redirections && stage.redirections.length) note += (note ? ' ' : '') + 'この欄は保存・リダイレクト前の実際の出力です。' + stage.redirections.map(redir => (redir.fd === 2 ? '2' : '') + redir.op + ' ' + redir.target).join(' / ');
    if (Number(stage.index) > 0 && latestTrace[traceIndex - 1] && stage.pipeline === latestTrace[traceIndex - 1].pipeline) note += (note ? ' ' : '') + '前の処理から ' + lineCount(stage.stdin) + ' 行を受け取りました。';
    else if (!stage.stdin) note += (note ? ' ' : '') + '最初の処理です。必要な入力は、ファイルや引数から受け取ります。';
    if (stage.cwdAfter && stage.cwdBefore !== stage.cwdAfter) note += (note ? ' ' : '') + '現在地: ' + stage.cwdBefore + ' → ' + stage.cwdAfter;
    $('trace-note').textContent = note;
  }

  function fillInput(command) {
    $('command-input').value = String(command).slice(0, 8192);
    $('command-input').focus();
    $('command-input').setSelectionRange($('command-input').value.length, $('command-input').value.length);
    laterSave();
  }

  function completeInput() {
    const input = $('command-input');
    const before = input.value.slice(0, input.selectionStart);
    const after = input.value.slice(input.selectionEnd);
    let matches = [];
    try { matches = currentSession.shell.complete(before); } catch (_) { /* Completion is optional for incomplete quotes. */ }
    matches = Array.isArray(matches) ? matches.filter(item => typeof item === 'string') : [];
    if (!matches.length) { $('run-feedback').textContent = '補完の候補がありません。ファイル名や現在地を確認してみよう。'; return; }
    let prefix = matches[0];
    for (const match of matches) while (prefix && !match.startsWith(prefix)) prefix = prefix.slice(0, -1);
    const token = before.match(/[^\s|;]*$/);
    const existing = token ? token[0] : '';
    if (prefix.length > existing.length || matches.length === 1) {
      const completed = before.slice(0, before.length - existing.length) + prefix + (matches.length === 1 && !prefix.endsWith('/') ? ' ' : '');
      input.value = completed + after;
      input.setSelectionRange(completed.length, completed.length);
      laterSave();
    }
    $('run-feedback').textContent = matches.length === 1 ? '補完しました。' : '候補: ' + matches.slice(0, 12).join('  ') + (matches.length > 12 ? ' …' : '');
  }

  function inputKeys(event) {
    const input = $('command-input');
    if (event.isComposing) return;
    if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      input.value = '';
      $('run-feedback').textContent = '入力中のコマンドを取り消しました。';
      laterSave();
    } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault(); clearTerminal();
    } else if (event.key === 'Tab' && !event.shiftKey) {
      // An empty field keeps native Tab navigation available to keyboard users.
      if (input.value.trim()) { event.preventDefault(); completeInput(); }
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const history = commandHistory();
      if (historyCursor === history.length) historyDraft = input.value;
      historyCursor = Math.max(0, Math.min(history.length, historyCursor + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = historyCursor === history.length ? historyDraft : history[historyCursor] || '';
      input.setSelectionRange(input.value.length, input.value.length);
      laterSave();
    }
  }

  function showPager(text) {
    $('pager-content').textContent = text;
    const trace = currentSession.lastResult && currentSession.lastResult.trace || [];
    const pager = trace.find(stage => ['less', 'more'].includes(stage.command));
    $('pager-command-label').textContent = 'FILE VIEWER / ' + (pager ? pager.command : 'less / more');
    if (!$('pager-dialog').open) openDialog('pager-dialog');
    $('pager-content').focus();
  }

  function closePager() {
    if (!currentSession || !currentSession.pagerOpen) return;
    Engine.closePager(currentSession);
    closeDialog($('pager-dialog'));
    appendTranscript('q', { stdout: '', stderr: '', code: 0 }, '閲覧を終え、ターミナルに戻りました。');
    $('run-feedback').textContent = '閲覧画面を閉じました。次のコマンドを入力できます。';
    checkpoint();
    checkAnswer(false);
    $('command-input').focus();
  }

  function renderMapContents() {
    stats();
    const selected = levelLessons(activeLevel);
    $('map-levels').replaceChildren(...levels.map(level => {
      const s = levelStats(level.id);
      const button = node('button', 'map-level-button');
      button.dataset.level = level.id;
      button.setAttribute('aria-pressed', String(level.id === activeLevel));
      button.append(node('strong', '', level.title), node('span', '', s.completed + ' / ' + s.total));
      button.addEventListener('click', () => {
        activeLevel = level.id;
        renderMapContents();
        $('map-levels').querySelector('[data-level="' + level.id + '"]').focus();
      });
      return button;
    }));
    $('map-level-description').textContent = levelById.get(activeLevel).description || levelById.get(activeLevel).subtitle || '';
    const list = $('chapter-list');
    const chapters = DATA.chapters.filter(chapter => selected.some(lesson => lesson.chapter === chapter.id));
    list.replaceChildren(...chapters.map((chapter, chapterIndex) => {
      const section = node('section', 'chapter');
      const heading = node('div', 'chapter-heading');
      const labels = node('div');
      labels.append(node('h3', '', chapter.title), node('p', '', chapter.subtitle || ''));
      heading.append(node('span', 'chapter-number', String(chapterIndex + 1).padStart(2, '0')), labels);
      section.append(heading);
      const rows = node('div', 'chapter-lessons');
      selected.filter(lesson => lesson.chapter === chapter.id).forEach(lesson => {
        const completed = progress.completed[lesson.id];
        const button = node('button', 'lesson-link' + (completed ? ' done' : '') + (progress.currentId === lesson.id ? ' current' : ''));
        button.dataset.lesson = lesson.id;
        button.append(node('span', 'lesson-check', completed ? '✓' : String(selected.indexOf(lesson) + 1).padStart(2, '0')), node('span', 'lesson-link-title', lesson.title), node('span', 'muted', completed && completed.assisted ? 'ヒントあり' : lesson.minutes + ' 分'));
        button.addEventListener('click', () => renderLesson(lesson.id));
        rows.append(button);
      });
      section.append(rows);
      return section;
    }));
  }

  function renderMap() {
    renderMapContents();
    openDialog('map-dialog');
  }

  const builtInReferences = [
    { term: 'プロンプト / analyst@linuxroom:~$', text: 'コマンドの入力を待つ表示。analyst はユーザー名、linuxroom はホスト名（コンピューター名）、: の後ろが現在地。~ はホームフォルダ。$ は一般ユーザー、# は管理者の目印としてよく使われる。この教材では一般ユーザーで操作する。表示は環境ごとに異なる。プロンプト自体は入力しない。', example: 'analyst@linuxroom:~$ pwd\n/home/analyst\nanalyst@linuxroom:~$ cd logs\nanalyst@linuxroom:~/logs$' },
    { term: 'pwd', text: '今いるフォルダの場所を表示する。', example: 'pwd' },
    { term: 'ls / cd / ~', text: 'ls は中身の一覧。実機の端末では横に並ぶこともあり、ls -1 なら1行1項目。cd はフォルダを移動する。.. は一つ上、~ はホームフォルダ。移動するとプロンプトの現在地も変わる。', example: 'ls -1\ncd logs\ncd ..\ncd ~' },
    { term: 'ls -l / -lh / -lt', text: '-l は権限・サイズ・更新日時などの詳細、-h は読みやすいサイズ単位、-t は更新日時の新しい順。更新日時やサイズの表記は実機の環境でも異なる。', example: 'ls -lh logs\nls -lt logs' },
    { term: 'cat / head / tail / less', text: '順に、全体・先頭・末尾・閲覧画面で読む。head -c は先頭のバイト数、tail -n +2 は2行目から最後まで。less は q で終了。', example: 'cat app.log\nhead -n 3 app.log\nhead -c 20 app.log\ntail -n +2 members.csv\nless app.log' },
    { term: 'grep', text: '指定した文字を含む行を探す。-F は文字をそのまま検索、-n は行番号、-i は大文字と小文字を区別しない、-v は一致しない行。', example: "grep -n 'ERROR' app.log" },
    { term: '| / wc -l', text: '|（パイプ）は左の出力を右の入力へ渡す。wc -l は改行の数を数える。', example: "grep 'ERROR' app.log | wc -l" },
    { term: 'cut / awk', text: '必要な列を取り出す。cut -d は区切り文字、-f は列番号。awk の $1 は1列目、$NF は最後の列。', example: "cut -d ',' -f 2 members.csv\nawk '{print $2}' app.log" },
    { term: 'sort / sort -u / uniq -c', text: 'sort で並べ、uniq -c で隣り合う同じ行を数える。sort -nr は数字として大きい順に並べる。sort -u は並べ替えて重複を取り除く。', example: 'sort names.txt | uniq -c | sort -nr\nsort -u names.txt' },
    { term: 'mkdir / cp / mv', text: 'フォルダを作る・ファイルをコピーする・移動や名前の変更をする。mkdir -p はフォルダが存在していても成功し、必要な親フォルダも作る。', example: 'mkdir -p work\ncp app.log work/copy.log\nmv work/copy.log work/backup.log' },
    { term: '< / 標準入力', text: '< はファイルをコマンドの標準入力へ渡す。tr はファイル名を引数に取らないので、この書き方が使える。cat file | command と同じ入力を渡せる。wc -l < file はファイル名を付けずに行数だけを出す。', example: "tr '[:upper:]' '[:lower:]' < names.txt\nwc -l < app.log" },
    { term: '&& / ; / 終了状態', text: '&& は左のコマンドが成功（終了状態 0）したときだけ次を実行する。; は左の成否にかかわらず次を実行する。準備に失敗したら止めたいときは && を使う。', example: 'mkdir -p work && cp app.log work/copy.log\npwd; ls' },
    { term: '2>/dev/null / 標準エラー出力', text: '2> はエラーメッセージの出力先を変える。/dev/null は受け取った内容を捨てる特殊な出力先。エラーを非表示にしても、終了状態は変わらない。原因を調べるときは表示を戻そう。', example: 'ls missing.txt 2>/dev/null' },
    { term: '$? / 終了状態', text: '$? は直前のコマンドの終了状態。通常は 0 が成功、0 以外が失敗や特別な状態を表す。grep の 1 は一致なし、diff の 1 は差分あり。echo $? 自体は成功するので、確認は直後に行う。', example: "grep 'ERROR' app.log\necho $?" },
    { term: '> / >> / tee', text: '> はファイルを上書き、>> は末尾に追記。tee は画面とファイルの両方へ出力。', example: "grep 'ERROR' app.log > errors.txt\ncat errors.txt | tee copy.txt" },
    { term: 'jq', text: 'JSON の項目を取り出す。select は条件で絞り込む。-r は文字列の引用符を外す。', example: 'jq -r \'select(.level == "ERROR") | .user\' events.jsonl' },
    { term: 'help / man / history / clear', text: '実機でコマンドのマニュアルを読むときは man grep などを使う。この教材の man は学習用 help と同じ案内を表示する。history は入力履歴、clear は画面の表示を消す。ファイルや修了記録は消えない。', example: 'man grep\nhelp grep\nhistory\nclear' },
    { term: 'echo / printf', text: '文字を出力する。printf では書式を指定できる。%s は文字列、\\n は改行。', example: "echo ready\nprintf '%s\\n' alice bob" },
    { term: 'tac / more', text: 'tac は行を逆の順番で表示する。more はファイルを閲覧する。この教材では less と同じ閲覧画面で、q で終了する。', example: 'tac app.log\nmore app.log' },
    { term: 'rg / find', text: 'rg はファイル内の文字を検索する。find は名前などの条件でファイルを探す。find の名前パターンは引用符で囲む。', example: "rg 'ERROR' logs\nfind logs -name '*.log'" },
    { term: 'grep -E / -A / -B / -C', text: '-E は拡張正規表現。^ は行頭、$ は行末、| はいずれかに一致。-A は後ろ、-B は前、-C は前後の行も表示する。', example: "grep -E '^(ERROR|WARN)' app.log\ngrep -C 1 'ERROR' app.log" },
    { term: 'tr / sed / nl / column', text: 'tr は文字を変換する。sed は置換や行の抽出。nl は行番号を付け、column は列を見やすく整える。', example: "tr '[:upper:]' '[:lower:]' < names.txt\nsed 's/ERROR/error/g' app.log\nnl app.log\ncolumn -t app.log" },
    { term: 'touch / rm / rmdir', text: 'touch は空ファイルの作成などに使う。rm はファイルを削除し、rmdir は空フォルダを削除する。この教材では課題内の仮想ファイルだけが変わる。', example: 'touch memo.txt\nrm memo.txt\nmkdir empty\nrmdir empty' },
    { term: 'diff / comm', text: 'diff は二つのファイルの違いを表示する。終了状態 1 は差分あり。comm は並べ替え済みの二つのファイルの、共通・片方だけの行を調べる。', example: 'diff before.txt after.txt\ncomm -12 sorted-a.txt sorted-b.txt' },
    { term: 'join / paste / xargs', text: 'join は共通のキーで行を結合し、paste は行を横に並べる。xargs は入力から次のコマンドの引数を組み立てる。', example: 'join users.txt roles.txt\npaste names.txt counts.txt\nxargs wc -l < paths.txt' },
    { term: 'base64 / strings / rev', text: 'base64 は文字データの符号化・復号。strings は表示可能な文字の並びを抽出する。rev は各行の文字順を逆にする。', example: 'base64 -d encoded.txt\nstrings sample.bin\nrev names.txt' },
    { term: 'basename / dirname / realpath', text: 'パスのファイル名部分・親フォルダ部分・絶対パスを調べる。', example: 'basename /var/log/app.log\ndirname /var/log/app.log\nrealpath app.log' },
    { term: 'file / stat / du / date', text: 'file は種類、stat は詳細情報、du は使用量、date は日時を調べる。ファイル情報は学習用の仮想情報。date -u はブラウザの現在時刻を UTC で表示する。', example: 'file app.log\nstat app.log\ndu app.log\ndate -u' }
  ];

  function referenceItems() {
    const items = builtInReferences.slice();
    const glossary = Array.isArray(DATA.glossary) ? DATA.glossary : Object.entries(DATA.glossary || {}).map(([term, text]) => ({ term, text }));
    glossary.forEach(item => {
      const term = item.term || item.name || item.command || item.title;
      const text = item.text || item.definition || item.description || item.meaning;
      if (term && text) items.push({ term, text, example: item.example || '' });
    });
    return items;
  }

  function renderReferences() {
    const search = $('reference-search').value.trim().toLowerCase();
    const matches = referenceItems().filter(item => (item.term + ' ' + item.text + ' ' + item.example).toLowerCase().includes(search));
    $('reference-list').replaceChildren(...matches.map(item => {
      const section = node('section', 'reference-item');
      section.append(node('h3', '', item.term), node('p', '', item.text));
      if (item.example) section.append(node('code', '', typeof item.example === 'string' ? item.example : item.example.command || ''));
      return section;
    }));
    if (!matches.length) $('reference-list').append(node('p', 'muted', '該当する項目がありません。短い言葉で探してみよう。'));
    const related = search ? lessons.filter(lesson => {
      if (taughtCommands.has(search)) return lessonCommands(lesson).includes(search);
      const corpus = [lesson.title, lesson.goal, ...(lesson.explanation || []), ...(lesson.concepts || []).map(item => item.term + ' ' + item.text), ...(lesson.solution || [])].join(' ').toLowerCase();
      return corpus.includes(search);
    }) : [];
    $('reference-lessons').replaceChildren();
    if (related.length) {
      $('reference-lessons').append(node('h3', '', 'この言葉を練習するレッスン'));
      related.slice(0, 12).forEach(lesson => {
        const label = levelById.get(levelOf(lesson)).title + ' · ' + lesson.title;
        const button = node('button', 'reference-lesson-button', label + ' →');
        button.addEventListener('click', () => renderLesson(lesson.id, { focus: true }));
        $('reference-lessons').append(button);
      });
      if (related.length > 12) $('reference-lessons').append(node('p', 'muted', 'ほか ' + (related.length - 12) + ' 件。言葉を追加すると、さらに絞り込めます。'));
    }
  }

  function showReference() { renderReferences(); openDialog('reference-dialog'); }

  function retryLesson() {
    if (!currentSession) return;
    if (!window.confirm('この課題の操作・ファイル・入力を最初からやり直します。修了記録とヒントの記録は残ります。よろしいですか？')) return;
    const id = currentSession.lessonId;
    currentSession = null;
    sessions.delete(id);
    delete progress.sessions[id];
    delete ui.drafts[id];
    delete ui.transcripts[id];
    renderLesson(id, { skipCheckpoint: true, noScroll: true, focus: true });
    $('success-box').hidden = true;
    toast('課題のファイルと現在地を初期状態に戻しました');
  }

  function exportProgress() {
    checkpoint();
    const content = JSON.stringify({ format: 'linuxroom-export', version: 1, progress, ui }, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = node('a');
    link.href = url;
    link.download = 'linuxroom-progress.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('save-status').textContent = '進捗ファイルをダウンロードしました。個人情報を含むコマンドを入力した場合、その入力も保存されます。';
  }

  function importWasPreserved(raw, restored) {
    const sameKeys = (a, b) => JSON.stringify(Object.keys(a || {}).sort()) === JSON.stringify(Object.keys(b || {}).sort());
    const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
    if (raw.currentId !== restored.currentId || !sameKeys(raw.completed, restored.completed) || !sameKeys(raw.sessions, restored.sessions) || !sameKeys(raw.hints, restored.hints)) return false;
    for (const id of Object.keys(raw.hints || {})) if (raw.hints[id] !== restored.hints[id]) return false;
    for (const id of Object.keys(raw.sessions)) {
      const before = raw.sessions[id];
      const after = restored.sessions[id];
      if (!before || !before.shell || !after || !after.shell) return false;
      const a = before.shell, b = after.shell;
      if (Object.keys(a.files || {}).some(path => !own(b.files, path) || a.files[path] !== b.files[path]) || a.cwd !== b.cwd || a.oldcwd !== b.oldcwd) return false;
      const lesson = byId.get(id);
      const fixture = lesson && DATA.datasets[lesson.fixture];
      const allowedFiles = new Set((before.fixtureRevision || 1) < (lesson && lesson.fixtureRevision || 1) ? lesson.fixtureAdditions || [] : []);
      const additions = Object.keys(b.files || {}).filter(path => !own(a.files, path));
      if (additions.some(path => !allowedFiles.has(path) || !fixture || !own(fixture.files, path) || b.files[path] !== fixture.files[path])) return false;
      const allowedDirectories = new Set();
      for (const path of additions) {
        let parent = path.slice(0, path.lastIndexOf('/')) || '/';
        while (true) {
          allowedDirectories.add(parent);
          if (parent === '/') break;
          parent = parent.slice(0, parent.lastIndexOf('/')) || '/';
        }
      }
      if (!Array.isArray(a.directories) || !Array.isArray(b.directories) || a.directories.some(path => !b.directories.includes(path)) || b.directories.some(path => !a.directories.includes(path) && !allowedDirectories.has(path))) return false;
      if (own(a, 'lastExitCode') && a.lastExitCode !== b.lastExitCode || own(a, 'snapshotTime') && a.snapshotTime !== b.snapshotTime) return false;
      if (own(a, 'metadata') && (!a.metadata || typeof a.metadata !== 'object' || Array.isArray(a.metadata) || Object.keys(a.metadata).some(path => JSON.stringify(a.metadata[path]) !== JSON.stringify(b.metadata && b.metadata[path])))) return false;
      if (!Array.isArray(a.history) || JSON.stringify(a.history) !== JSON.stringify(b.history)) return false;
      if (!Array.isArray(before.events) || JSON.stringify(before.events) !== JSON.stringify(after.events)) return false;
      if (!Array.isArray(before.evidence) || before.evidence.length !== after.evidence.length) return false;
      if (before.lastResult != null && after.lastResult == null) return false;
      if (before.pagerOpen !== after.pagerOpen || before.pagerOpened !== after.pagerOpened || before.pagerClosed !== after.pagerClosed) return false;
    }
    return true;
  }

  async function importProgress(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || importBusy) return;
    importBusy = true;
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('ファイルが大きすぎます。Linuxroom で保存した進捗ファイルを選んでください。');
      const text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(file);
      });
      const parsed = JSON.parse(text);
      const wrapped = parsed && parsed.format === 'linuxroom-export' && parsed.version === 1;
      const raw = wrapped ? parsed.progress : parsed;
      if (!raw || typeof raw !== 'object' || raw.version !== 1 || !raw.completed || typeof raw.completed !== 'object' || Array.isArray(raw.completed) || !raw.sessions || typeof raw.sessions !== 'object' || Array.isArray(raw.sessions) || !validId(raw.currentId)) throw new Error('Linuxroom の進捗ファイルとして読み込めませんでした。');
      if (JSON.stringify(raw).length > 8 * 1024 * 1024) throw new Error('進捗データが保存上限の 8 MiB を超えています。現在の進捗は変更していません。');
      const nextProgress = Engine.hydrate(raw);
      if (!importWasPreserved(raw, nextProgress)) throw new Error('未対応の課題や壊れた作業データが含まれるため、読み込みを中止しました。現在の進捗は変更していません。');
      const nextUI = safeUI(wrapped ? parsed.ui : { started: true });
      if (!window.confirm('このブラウザの進捗と課題の作業状態を、選んだファイルの内容に置き換えます。よろしいですか？')) return;
      currentSession = null;
      sessions.clear();
      progress = nextProgress;
      ui = nextUI;
      ui.started = true;
      reconcileUIProgress();
      renderLesson(progress.currentId, { skipCheckpoint: true });
      toast('進捗を読み込みました。続きから学べます。');
    } catch (error) {
      $('save-status').textContent = error instanceof SyntaxError ? 'JSON の形式を読み取れませんでした。Linuxroom で保存したファイルを選んでください。' : error.message || 'ファイルを読み込めませんでした。';
    } finally { event.target.value = ''; importBusy = false; }
  }

  function bind() {
    $('home-button').addEventListener('click', home);
    $('start-learning').addEventListener('click', () => renderLesson(ui.started && validId(progress.currentId) ? progress.currentId : lessons[0].id, { focus: true }));
    ['map-button', 'welcome-map-button'].forEach(id => $(id).addEventListener('click', renderMap));
    ['sandbox-button', 'welcome-sandbox-button'].forEach(id => $(id).addEventListener('click', () => renderLesson('sandbox', { focus: true })));
    $('reference-button').addEventListener('click', showReference);
    $('terminal-help').addEventListener('click', () => {
      $('reference-search').value = '';
      showReference();
      $('prompt-guide').scrollIntoView({ block: 'start' });
    });
    $('save-button').addEventListener('click', () => { checkpoint(); openDialog('save-dialog'); });
    $('reference-search').addEventListener('input', renderReferences);
    document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
    document.querySelectorAll('dialog:not(#pager-dialog)').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog); } }));
    $('hint-button').addEventListener('click', revealHint);
    $('solution-button').addEventListener('click', revealSolution);
    $('retry-lesson').addEventListener('click', retryLesson);
    $('check-answer').addEventListener('click', () => checkAnswer(true));
    $('next-lesson').addEventListener('click', () => { const next = nextLesson(currentLesson); if (next) renderLesson(next.id, { focus: true }); });
    $('starter-fill').addEventListener('click', () => { if (currentLesson) fillInput(currentLesson.starter); });
    $('example-fill').addEventListener('click', () => { if (currentLesson && currentLesson.example) fillInput(currentLesson.example.command); });
    $('command-form').addEventListener('submit', runCommand);
    $('command-input').addEventListener('keydown', inputKeys);
    $('command-input').addEventListener('input', laterSave);
    $('jump-terminal').addEventListener('click', () => {
      $('command-input').scrollIntoView({ block: 'center' });
      $('command-input').focus({ preventScroll: true });
    });
    $('jump-mission').addEventListener('click', () => {
      ($('success-box').hidden ? $('lesson-task') : $('success-box')).scrollIntoView({ block: 'center' });
    });
    $('clear-terminal').addEventListener('click', () => { clearTerminal(); $('command-input').focus(); });
    $('pager-close').addEventListener('click', closePager);
    $('pager-dialog').addEventListener('cancel', event => { event.preventDefault(); closePager(); });
    $('pager-dialog').addEventListener('keydown', event => {
      if (event.key === 'q' || event.ctrlKey && event.key.toLowerCase() === 'c') { event.preventDefault(); closePager(); }
    });
    $('export-progress').addEventListener('click', exportProgress);
    $('import-progress').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', importProgress);
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') checkpoint(); });
  }

  load();
  bind();
  stats();
  if (ui.started) renderLesson(progress.currentId, { skipCheckpoint: true, noScroll: true });
})();
