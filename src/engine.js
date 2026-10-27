/* Linuxroom lesson engine. All commands operate on LogLabShell's virtual files. */
(function (root) {
  'use strict';
  const t = value => root.LinuxroomI18n ? root.LinuxroomI18n.t(value) : value;
  const VERSION = 1, MAX_SAVE = 8 * 1024 * 1024, MAX_TEXT = 524288;
  const META = new Set(['help', 'man', 'history', 'clear']);
  const data = () => root.LINUXROOM_DATA;
  const lessons = () => data().lessons;
  const lessonFor = id => lessons().find(lesson => lesson.id === id);
  const validId = id => id === 'sandbox' || Boolean(lessonFor(id));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const safeText = (value, max = MAX_TEXT) => typeof value === 'string' && value.length <= max;
  const canonical = path => safeText(path, 1024) && path.startsWith('/') && !path.includes('\0') && !path.split('/').some(x => x === '..' || x === '.');
  const stageAccepted = (stage, lesson) => Boolean(stage && ((stage.code === 0 && !stage.stderr) ||
    (lesson?.validation?.all || []).some(rule => rule.type === 'status' && rule.command === stage.command && rule.code === stage.code &&
      (!stage.stderr || (rule.stderrRedirected === true && stage.stderrRedirected === true)))));
  const isSuccess = (result, lesson) => Boolean(result && !result.stderr &&
    (result.code === 0 || (result.trace.length && result.trace.at(-1).code === result.code && stageAccepted(result.trace.at(-1), lesson))) &&
    result.trace.every(stage => stageAccepted(stage, lesson)));

  function createSession(lessonId) {
    const lesson = lessonFor(lessonId);
    if (lessonId !== 'sandbox' && !lesson) lessonId = lessons()[0].id;
    const selected = lessonFor(lessonId);
    const fixture = selected ? data().datasets[selected.fixture] : Object.values(data().datasets)[0];
    if (!fixture) throw new Error('Lesson fixture is missing');
    const shell = new root.LogLabShell(fixture.files, {metadata: fixture.metadata, now: fixture.now});
    shell.cwd = shell.resolve(selected && selected.cwd || fixture.cwd || '/home/analyst');
    shell.oldcwd = shell.cwd;
    shell.directories.add(shell.cwd); shell.addParents(shell.cwd + '/.placeholder');
    return {lessonId, shell, events: [], lastResult: null, evidence: [], pagerOpen: false, pagerOpened: false, pagerClosed: false};
  }

  function decorate(result) {
    const noMatch = result.trace.some(stage => ['grep', 'rg'].includes(stage.command) && stage.code === 1 && !stage.stderr);
    const error = result.stderr || result.trace.find(stage => stage.stderr)?.stderr;
    let feedback = '';
    if (error) {
      if (/no such file|no such directory/i.test(error)) feedback = t('指定した場所が見つかりません。pwd で現在地、ls でファイル名を確認できます。');
      else if (/is a directory/i.test(error)) feedback = t('指定した名前はディレクトリです。ls で中のファイルを確認しましょう。');
      else if (/quote/.test(error)) feedback = t('引用符が閉じていない可能性があります。開始と終わりの引用符を確認しましょう。');
      else if (/unsupported|command not found|利用できません/.test(error)) feedback = t('この学習用ターミナルが扱うコマンドには範囲があります。help で対応内容を確認できます。');
      else feedback = t('エラーの行を確認して、コマンド・引数・オプションを見直しましょう。');
    } else if (noMatch) feedback = t('検索条件に一致する行はありませんでした。grep の終了コード 1 は「一致なし」です。文字・大文字小文字・対象ファイルを確認しましょう。');
    else if (!result.stdout && result.code === 0 && result.trace.length) feedback = t('コマンドは終了しました。cd や保存など、成功しても文字を表示しない操作があります。');
    return Object.assign(result, {feedback, noMatch});
  }

  function remember(session, event) {
    session.events.push(event);
    if (session.events.length > 128) session.events.shift();
  }

  function run(session, input) {
    input = String(input);
    if (session.pagerOpen) {
      if (input.trim() === 'q') { closePager(session); return decorate({stdout: '', stderr: '', code: 0, trace: [], pagerClosed: true}); }
      return decorate({stdout: '', stderr: t('less: 表示中です。q で閉じてからコマンドを入力してください。\n'), code: 2, trace: []});
    }
    const result = decorate(session.shell.run(input));
    if (input.trim()) remember(session, {type: 'command', input: input.slice(0, 8192)});
    const targetCommands = (lessonFor(session.lessonId)?.validation?.all || []).filter(condition => condition.type === 'used').map(condition => condition.command);
    const countsForExercise = stage => !META.has(stage.command) || targetCommands.includes(stage.command);
    const substantive = result.trace.some(countsForExercise);
    if (substantive || (result.code !== 0 && result.trace.length === 0)) session.lastResult = result;
    if (isSuccess(result, lessonFor(session.lessonId))) {
      result.expectedStatus = result.code !== 0 || result.trace.some(stage => stage.code !== 0);
      for (const stage of result.trace) {
        if (countsForExercise(stage)) session.evidence.push({...stage, stdin: '', stdout: ''});
      }
      if (session.evidence.length > 128) session.evidence.splice(0, session.evidence.length - 128);
    }
    if (result.pager) { session.pagerOpen = true; session.pagerOpened = true; session.pagerClosed = false; }
    return result;
  }

  function closePager(session) {
    if (session.pagerOpen) {
      session.pagerOpen = false; session.pagerClosed = true;
      remember(session, {type: 'pagerClose'});
    }
  }

  function matches(actual, expected, mode) {
    actual = String(actual); expected = String(expected);
    if (mode === 'exact') return actual === expected;
    if (mode === 'contains') return actual.includes(expected);
    if (mode === 'lines') {
      const normalize = value => value.trim().split('\n').map(line => line.trim().replace(/\s+/g, ' ')).join('\n');
      return normalize(actual) === normalize(expected);
    }
    return actual.trim() === expected.trim();
  }

  function outputDifference(actual, expected, mode) {
    const tidy = value => mode === 'exact' ? String(value) : String(value).trim();
    const lines = value => tidy(value).split('\n').map(line => mode === 'lines' ? line.trim().replace(/\s+/g, ' ') : line);
    const shown = value => value.length > 70 ? value.slice(0, 67) + '…' : value;
    if (mode === 'contains') return t('必要な文字列「') + shown(String(expected).trim()) + t('」が見つかりません。');
    const got = lines(actual), wanted = lines(expected);
    const remaining = got.slice();
    const missing = [];
    for (const line of wanted) { const at = remaining.indexOf(line); if (at >= 0) remaining.splice(at, 1); else missing.push(line); }
    if (!missing.length && !remaining.length) return t('行の順序が異なります。並べ方を確認しましょう。');
    if (mode === 'exact' && String(actual).trimEnd() === String(expected).trimEnd()) return t('末尾の改行または空白が異なります。');
    return [missing.length ? t('足りない行:「') + shown(missing[0]) + '」' : '', remaining.length ? t('余分な行:「') + shown(remaining[0]) + '」' : ''].filter(Boolean).join(' / ');
  }

  // These are parsed argument tokens from real executions, never a regex on input.
  function flagsFor(stage) {
    const found = new Set();
    const valued = {grep: 'eABCm', rg: 'egABC', head: 'nc', tail: 'nc', cut: 'dfc', awk: 'Fv', sort: 'kt', uniq: 'fs', jq: '', wc: '', ls: '', nl: 'ws', find: ''}[stage.command] || '';
    const aliases = {'--ignore-case': 'i', '--line-number': 'n', '--invert-match': 'v', '--fixed-strings': 'F', '--extended-regexp': 'E', '--count': 'c', '--raw-output': 'r', '--compact-output': 'c', '--slurp': 's', '--numeric-sort': 'n', '--reverse': 'r'};
    const longValues = new Set(['--regexp', '--max-count', '--after-context', '--before-context', '--context', '--include', '--exclude', '--exclude-dir', '--glob', '--field-separator', '--key', '--delimiter', '--fields', '--characters', '--lines', '--bytes', '--output-delimiter']);
    for (let i = 0; i < stage.args.length; i++) {
      const arg = stage.args[i];
      if (arg === '--') break;
      if (arg.startsWith('--')) { if (aliases[arg]) found.add(aliases[arg]); if (longValues.has(arg)) i++; continue; }
      if (!arg.startsWith('-') || arg === '-') continue;
      for (let j = 1; j < arg.length; j++) {
        const flag = arg[j]; found.add(flag);
        if (valued.includes(flag)) { if (j === arg.length - 1) i++; break; }
      }
    }
    return found;
  }

  function check(session) {
    const lesson = lessonFor(session.lessonId);
    if (!lesson) return {passed: false, message: t('自由練習には採点がありません。コマンドの結果を自由に確かめてください。'), details: []};
    const result = session.lastResult;
    if (!result) return {passed: false, message: t('まずミッションに合うコマンドを実行してみましょう。'), details: []};
    if (!isSuccess(result, lesson)) return {passed: false, message: result.noMatch ? t('一致する行がありません。検索条件と対象ファイルを確認しましょう。') : t('直前の操作にエラーがあります。パイプの途中も確認して、もう一度実行しましょう。'), details: []};
    const details = (lesson.validation?.all || []).map(condition => {
      let passed = false, message = '';
      const stages = condition.scope === 'any' ? session.evidence : result.trace;
      switch (condition.type) {
        case 'output': passed = matches(result.stdout, condition.value, condition.match); message = passed ? t('表示された結果がミッションの条件に合っている') : outputDifference(result.stdout, condition.value, condition.match); break;
        case 'cwd': passed = session.shell.cwd === condition.value; message = t('指定されたディレクトリへ移動している'); break;
        case 'directory': passed = session.shell.isDir(session.shell.resolve(condition.path)); message = t('指定されたディレクトリを用意している'); break;
        case 'absent': {const path = session.shell.resolve(condition.path); passed = !session.shell.isFile(path) && !session.shell.isDir(path); message = t('指定された作業用ファイル・ディレクトリを削除している'); break;}
        case 'file': { const path = session.shell.resolve(condition.path); passed = session.shell.isFile(path) && matches(session.shell.files[path], condition.value, condition.match); message = t('保存したファイルの内容が条件に合っている'); break; }
        case 'used': passed = stages.some(stage => stageAccepted(stage, lesson) && stage.command === condition.command && (!condition.args || condition.args.every(arg => stage.args.includes(arg))) && (!condition.flags || [...condition.flags].every(flag => flagsFor(stage).has(flag)))); message = condition.command + t(' を使って今回の操作を実行している'); break;
        case 'status': passed = stages.some(stage => stageAccepted(stage, lesson) && stage.command === condition.command && stage.code === condition.code && (!condition.stderrRedirected || stage.stderrRedirected === true)); message = condition.command + t(' の終了コード ') + condition.code + t(' を確認している'); break;
        case 'redirect': passed = stages.some(stage => stageAccepted(stage, lesson) && stage.redirections.some(r => r.op === condition.op && r.target === condition.path && (condition.fd === undefined || r.fd === condition.fd))); message = condition.op + t(' で指定された入力・出力の向きを設定している'); break;
        case 'connector': passed = condition.afterCommand || condition.skipped !== undefined
          ? (result.flow || []).some(flow => flow.connector === condition.value && (condition.skipped === undefined || flow.executed === !condition.skipped) &&
            (!condition.afterCommand || result.trace.filter(stage => stage.pipeline === flow.pipeline - 1).at(-1)?.command === condition.afterCommand))
          : (result.connectors || []).includes(condition.value);
          message = (condition.afterCommand ? condition.afterCommand + t(' の後を ') : '') + condition.value + t(' でつなぎ') + (condition.skipped ? t('、条件に応じて次の実行を飛ばしている') : t('、実行条件を設定している')); break;
        case 'variable': passed = stages.some((stage, index) => stageAccepted(stage, lesson) && (!condition.command || stage.command === condition.command) &&
          (condition.context === 'arguments' ? stage.argumentVariables || [] : stage.variables || []).includes(condition.name) &&
          (!condition.afterCommand || stages[index - 1]?.command === condition.afterCommand));
          message = '$' + condition.name + t(' を') + (condition.context === 'arguments' ? t('引数として展開して値を確認している') : t('展開して値を確認している')); break;
        case 'pipeline': { const counts = new Map(); for (const stage of result.trace) counts.set(stage.pipeline, (counts.get(stage.pipeline) || 0) + 1); passed = [...counts.values()].some(count => count >= condition.minStages); message = t('必要な段階をパイプでつないでいる'); break; }
        case 'pagerClosed': passed = session.pagerOpened && session.pagerClosed && !session.pagerOpen; message = t('ファイルを開き、q で表示を閉じている'); break;
        case 'source': { const sourceStages = condition.scope === 'last' ? result.trace : session.evidence; passed = sourceStages.some(stage => stageAccepted(stage, lesson) && stage.reads.includes(condition.path)); message = t('指定された元ファイルを実際に読み込んでいる'); break; }
        default: message = t('未対応の判定条件です');
      }
      return {passed, message};
    });
    const passed = details.length > 0 && details.every(detail => detail.passed);
    return {passed, message: passed ? lesson.success || t('ミッションクリアです！') : t('もう一歩です。未達成の条件を判定欄で確認しましょう。'), details};
  }

  function cleanStage(value) {
    if (!object(value) || !safeText(value.command, 100) || !Array.isArray(value.args) || value.args.length > 128 || !value.args.every(x => safeText(x, 8192)) || !['stdin', 'stdout', 'stderr'].every(key => safeText(value[key])) || !Number.isInteger(value.code) || !canonical(value.cwdBefore) || !canonical(value.cwdAfter) || !Number.isInteger(value.pipeline) || !Number.isInteger(value.index)) return null;
    const redirections = Array.isArray(value.redirections) ? value.redirections.filter(r => object(r) && (r.fd === undefined || [0, 1, 2].includes(r.fd)) &&
      ((['<', '>', '>>'].includes(r.op) && canonical(r.target)) || (r.op === '>&' && ['1', '2'].includes(r.target))))
      .map(r => ({op: r.op, target: r.target, ...(r.fd !== undefined ? {fd: r.fd} : {})})) : [];
    const reads = Array.isArray(value.reads) ? value.reads.filter(canonical).slice(0, 128) : [];
    return {command: value.command, args: value.args.slice(), stdin: value.stdin, stdout: value.stdout, stderr: value.stderr, code: value.code, cwdBefore: value.cwdBefore, cwdAfter: value.cwdAfter, pipeline: value.pipeline, index: value.index, connector: [';', '&&', '||'].includes(value.connector) ? value.connector : ';', redirections, stderrRedirected: value.stderrRedirected === true, variables: Array.isArray(value.variables) && value.variables.includes('?') ? ['?'] : [], argumentVariables: Array.isArray(value.argumentVariables) && value.argumentVariables.includes('?') ? ['?'] : [], reads};
  }

  function cleanResult(value) {
    if (!object(value) || !safeText(value.stdout) || !safeText(value.stderr) || !Number.isInteger(value.code) || !Array.isArray(value.trace) || value.trace.length > 32) return null;
    const trace = value.trace.map(cleanStage);
    if (trace.some(stage => !stage)) return null;
    const flow = Array.isArray(value.flow) ? value.flow.filter(item => object(item) && [';', '&&', '||'].includes(item.connector) && Number.isInteger(item.pipeline) && item.pipeline >= 0 && Number.isInteger(item.codeBefore) && typeof item.executed === 'boolean').slice(0, 32).map(({connector, pipeline, codeBefore, executed}) => ({connector, pipeline, codeBefore, executed})) : [];
    return decorate({stdout: value.stdout, stderr: value.stderr, code: value.code, trace, flow, connectors: Array.isArray(value.connectors) ? value.connectors.filter(x => [';', '&&', '||'].includes(x)).slice(0, 64) : [], ...(value.pager === true ? {pager: true} : {})});
  }

  function serializeSession(session) {
    return {version: VERSION, fixtureRevision: lessonFor(session.lessonId)?.fixtureRevision || 1, lessonId: session.lessonId, shell: {files: {...session.shell.files}, directories: [...session.shell.directories], cwd: session.shell.cwd, oldcwd: session.shell.oldcwd, history: session.shell.history.slice(-128), metadata: {...session.shell.metadata}, snapshotTime: session.shell.snapshotTime, lastExitCode: session.shell.lastExitCode}, events: session.events.slice(-128), lastResult: session.lastResult, evidence: session.evidence.slice(-128), pagerOpen: session.pagerOpen, pagerOpened: session.pagerOpened, pagerClosed: session.pagerClosed};
  }

  function restoreSession(snapshot) {
    if (!object(snapshot) || snapshot.version !== VERSION || !validId(snapshot.lessonId)) return createSession(lessons()[0].id);
    const session = createSession(snapshot.lessonId);
    try {
      if (JSON.stringify(snapshot).length > MAX_SAVE) return session;
      const state = snapshot.shell;
      if (!object(state) || !object(state.files) || Object.keys(state.files).length > 256 || !Object.entries(state.files).every(([path, content]) => canonical(path) && safeText(content, 2097152)) || !Array.isArray(state.directories) || state.directories.length > 512 || !state.directories.every(canonical) || !canonical(state.cwd) || !canonical(state.oldcwd)) return session;
      const metadata = Object.create(null);
      if (object(state.metadata)) for (const [path, entry] of Object.entries(state.metadata).slice(0, 768)) {
        if (canonical(path) && object(entry) && Number.isFinite(entry.mtime) && Math.abs(entry.mtime) <= 8640000000000000) metadata[path] = {mtime: entry.mtime};
      }
      const files = {...state.files}, selected = lessonFor(snapshot.lessonId);
      if ((snapshot.fixtureRevision || 1) < (selected?.fixtureRevision || 1)) {
        const fixture = data().datasets[selected.fixture];
        for (const path of selected.fixtureAdditions || []) {
          if (canonical(path) && !own(files, path) && own(fixture.files, path) && !state.directories.includes(path)) files[path] = fixture.files[path];
        }
      }
      const shell = new root.LogLabShell(files, {metadata, now: data().datasets[selected?.fixture]?.now, snapshotTime: Number.isFinite(state.snapshotTime) && Math.abs(state.snapshotTime) <= 8640000000000000 ? state.snapshotTime : undefined, lastExitCode: Number.isInteger(state.lastExitCode) && state.lastExitCode >= 0 && state.lastExitCode <= 255 ? state.lastExitCode : 0});
      shell.directories = new Set([...shell.directories, ...state.directories]);
      shell.directories.add('/');
      for (const path of Object.keys(shell.files)) shell.addParents(path);
      if (!shell.isDir(state.cwd)) return session;
      shell.cwd = state.cwd; shell.oldcwd = state.oldcwd;
      shell.history = Array.isArray(state.history) ? state.history.filter(x => safeText(x, 8192)).slice(-128) : [];
      session.shell = shell;
      session.events = Array.isArray(snapshot.events) ? snapshot.events.filter(event => object(event) && (event.type === 'pagerClose' || (event.type === 'command' && safeText(event.input, 8192)))).slice(-128).map(event => event.type === 'pagerClose' ? {type: 'pagerClose'} : {type: 'command', input: event.input}) : [];
      session.lastResult = cleanResult(snapshot.lastResult);
      session.evidence = Array.isArray(snapshot.evidence) ? snapshot.evidence.map(cleanStage).filter(Boolean).slice(-128) : [];
      session.pagerOpened = snapshot.pagerOpened === true;
      session.pagerOpen = session.pagerOpened && snapshot.pagerOpen === true && session.lastResult?.pager === true;
      session.pagerClosed = session.pagerOpened && !session.pagerOpen && snapshot.pagerClosed === true;
      return session;
    } catch (_) { return createSession(snapshot.lessonId); }
  }

  function createProgress() { return {version: VERSION, currentId: lessons()[0].id, completed: {}, hints: {}, sessions: {}}; }
  function hydrate(raw) {
    const progress = createProgress();
    try {
      if (typeof raw === 'string') { if (raw.length > MAX_SAVE) return progress; raw = JSON.parse(raw); }
      if (!object(raw) || raw.version !== VERSION || JSON.stringify(raw).length > MAX_SAVE) return progress;
      if (validId(raw.currentId)) progress.currentId = raw.currentId;
      for (const lesson of lessons()) {
        const id = lesson.id;
        if (object(raw.completed) && own(raw.completed, id)) {
          const record = raw.completed[id];
          if (record === true || (object(record) && typeof record.assisted === 'boolean')) progress.completed[id] = {at: object(record) && safeText(record.at, 100) ? record.at : '', assisted: object(record) && record.assisted === true};
        }
        if (object(raw.hints) && own(raw.hints, id)) {
          const hint = raw.hints[id];
          if (Number.isInteger(hint) && hint >= 0 && hint <= 4) progress.hints[id] = hint;
        }
      }
      if (object(raw.sessions)) {
        for (const [id, snapshot] of Object.entries(raw.sessions)) {
          if (validId(id) && object(snapshot) && snapshot.lessonId === id && snapshot.version === VERSION) progress.sessions[id] = serializeSession(restoreSession(snapshot));
        }
      }
    } catch (_) { return createProgress(); }
    return progress;
  }
  function complete(progress, lessonId, assisted = false) {
    if (!lessonFor(lessonId)) return;
    const previous = progress.completed[lessonId];
    progress.completed[lessonId] = {at: previous?.at || new Date().toISOString(), assisted: Boolean(previous?.assisted || assisted)};
  }
  function stats(progress, levelId) {
    const selected = levelId ? lessons().filter(lesson => lesson.level === levelId) : lessons();
    const total = selected.length;
    const completed = selected.filter(lesson => own(progress.completed, lesson.id)).length;
    return {completed, total, percent: total ? Math.round(completed / total * 100) : 0};
  }
  root.LinuxroomEngine = {createSession, run, closePager, check, serializeSession, restoreSession, createProgress, hydrate, complete, stats};
})(typeof globalThis !== 'undefined' ? globalThis : this);
