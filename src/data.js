/* Linuxroom curriculum: deterministic, offline, and intentionally small. */
(function (root) {
  'use strict';
  const home = '/home/analyst';
  const logdir = home + '/logs';
  const lines = values => values.join('\n') + '\n';
  const records = [
    '09:00 INFO aki login',
    '09:01 ERROR ren upload',
    '09:02 ERROR aki download',
    '09:03 INFO mei logout',
    '09:04 ERROR ren upload',
    '09:05 WARN aki retry',
    '09:06 ERROR mei download',
    '09:07 ERROR ren upload',
    '09:08 ERROR aki preview',
    '09:09 error aki export'
  ];
  const app = lines(records);
  const errors = records.filter(line => line.includes('ERROR'));
  const names = ['ren', 'aki', 'ren', 'mei', 'ren', 'aki'];
  const sortedNames = ['aki', 'aki', 'mei', 'ren', 'ren', 'ren'];
  const counts = lines(['      2 aki', '      1 mei', '      3 ren']);
  const ranking = lines(['      3 ren', '      2 aki', '      1 mei']);
  const events = records.map(line => {
    const [time, level, user, action] = line.split(' ');
    return { time, level, user, action };
  });
  const profile = { user: 'aki', team: 'blue', active: true };
  const shift = [
    '12:00 INFO sora open',
    '12:01 ERROR sora export',
    '12:02 ERROR yui save',
    '12:03 ERROR sora save',
    '12:04 WARN naoki retry',
    '12:05 ERROR naoki export',
    '12:06 ERROR yui save',
    '12:07 ERROR sora export',
    '12:08 INFO yui close'
  ];
  const finalRanking = lines(['      3 sora', '      2 yui', '      1 naoki']);
  const welcome = lines(['Linuxroomへようこそ。', 'コマンドを一つずつ試しましょう。', '失敗しても、練習をやり直せます。']);
  const files = {
    [home + '/welcome.txt']: welcome,
    [home + '/notes/commands.txt']: lines(['pwd: 現在地を表示', 'ls: 名前の一覧を表示', 'cd: ディレクトリを移動']),
    [logdir + '/app.log']: app,
    [logdir + '/names.txt']: lines(names),
    [logdir + '/sorted-names.txt']: lines(sortedNames),
    [logdir + '/counts.txt']: lines(['2 aki', '10 ren', '1 mei']),
    [logdir + '/teams.csv']: lines(['aki,blue', 'ren,red', 'mei,blue']),
    [logdir + '/profile.json']: JSON.stringify(profile) + '\n',
    [logdir + '/events.jsonl']: lines(events.map(event => JSON.stringify(event))),
    [home + '/inbox/shift.log']: lines(shift)
  };
  const datasets = {
    basics: { cwd: home, files: { ...files } },
    logs: { cwd: logdir, files: { ...files } },
    reports: { cwd: logdir, files: { ...files, [home + '/reports/.keep']: '' } },
    notes: { cwd: logdir, files: { ...files, [home + '/reports/memo.txt']: '確認開始\n' } },
    copy: { cwd: logdir, files: { ...files, [home + '/reports/ranking.txt']: ranking } },
    move: { cwd: logdir, files: { ...files, [home + '/reports/ranking-copy.txt']: ranking, [home + '/reports/example-before.txt']: 'sample\n' } }
  };
  const chapters = [
    { id: 'start', title: 'ターミナルの入口', subtitle: '入力する・実行する・結果を見る' },
    { id: 'browse', title: '場所とファイル', subtitle: '現在地から、読みたいファイルへ' },
    { id: 'read', title: 'ファイルを読む', subtitle: '全部・先頭・末尾を使い分ける' },
    { id: 'filter', title: '必要な行を選ぶ', subtitle: 'grepで条件を一つずつ変える' },
    { id: 'pipe', title: 'コマンドをつなぐ', subtitle: '左の結果を、右の材料にする' },
    { id: 'columns', title: '必要な列を選ぶ', subtitle: '行を選んでから、名前を取り出す' },
    { id: 'count', title: '集計を組み立てる', subtitle: '並べる → 数える → 多い順にする' },
    { id: 'save', title: '結果を残す', subtitle: '保存・追記・コピー・名前の変更' },
    { id: 'json', title: 'JSONの記録を読む', subtitle: 'キーで選び、条件で絞る' },
    { id: 'final', title: '卒業実習', subtitle: '新しい記録から、自分で集計を作る' }
  ];
  const out = (value, match = 'trim') => ({ type: 'output', value, match });
  const used = (command, options = {}) => ({ type: 'used', command, ...options });
  const pipe = minStages => ({ type: 'pipeline', minStages });
  const saved = (path, value, match = 'trim') => ({ type: 'file', path, value, match });
  const grep = "grep 'ERROR' app.log";
  const selectNames = grep + " | awk '{print $3}'";
  const groupNames = selectNames + ' | sort';
  const countNames = groupNames + ' | uniq -c';
  const rankNames = countNames + ' | sort -nr';
  const lessons = [];
  function lesson(item) {
    lessons.push({ minutes: 3, mode: 'practice', fixture: 'logs', starter: '', newPart: '', ...item });
  }

  lesson({ id: '01-echo', chapter: 'start', title: '最初のコマンドを打つ', mode: 'guide', fixture: 'basics',
    goal: '文字を入力して、Enterで実行できる。',
    explanation: ['ターミナルは、文字で操作をお願いする場所です。入力欄にコマンドを打ち、Enterで実行します。', 'echoは、後ろに書いた文字を表示します。画面の「$」は入力待ちの印です。$を含めず、echoから入力してください。'],
    concepts: [{ term: 'コマンド', text: '実行したい操作の名前。ここではechoです。' }, { term: '引数', text: 'コマンドに渡す情報。ここでは表示したい文字です。' }],
    example: { command: 'echo hello', note: 'helloと表示されます。コマンドと引数の間には半角スペースを入れます。' },
    task: 'echoを使って、ready と表示してください。',
    hints: ['コマンドの名前はechoです。', 'echoのあとに、半角スペースと表示したい文字を書きます。', 'echo ready を入力してEnterを押します。'],
    solution: ['echo ready'], success: '入力 → 実行 → 結果、の流れができました。', bridge: '次は、空白を含む言葉を一つのまとまりとして渡します。',
    validation: { all: [used('echo'), out('ready')] }
  });
  lesson({ id: '02-quotes', chapter: 'start', title: '引用符でひとまとまりにする', fixture: 'basics',
    goal: '空白を含む文字列を引用符で囲める。',
    explanation: ['半角のシングルクォート（\'）で囲むと、中の文字を一つの引数として渡せます。引用符そのものは表示されません。', '↑キーで前の入力を呼び出して直せます。困ったときのhelpは、この教材の操作案内です。実際のLinuxで外部コマンドを調べるときはmanや各コマンドの--helpなどを使います。'],
    concepts: [{ term: '引用符', text: '空白や記号を含む文字を、ひとまとまりにする印です。全角の「’」ではなく半角の\'を使います。' }],
    example: { command: "echo 'hello linux'", note: 'hello linuxが一つの引数としてechoに渡ります。' },
    starter: 'echo ready', task: 'echoに一つの引数として linux room を渡し、表示してください。',
    hints: ['文字列の前と後ろに同じ引用符を置きます。', 'linux roomの空白も引用符の内側に入れます。', "echo 'linux room' と入力します。"],
    solution: ["echo 'linux room'"], success: '空白を含む文字列を、一つの引数にできました。', bridge: 'これからgrepの検索語やawkの処理も、引用符で囲みます。',
    validation: { all: [used('echo', { args: ['linux room'] }), out('linux room')] }
  });
  lesson({ id: '03-pwd', chapter: 'browse', title: '現在地を確かめる', mode: 'guide', fixture: 'basics',
    goal: 'pwdで今いるディレクトリを確認できる。',
    explanation: ['ディレクトリは、ファイルをまとめるフォルダのことです。コマンドを実行するときにも「今いる場所」があります。', 'pwdは、現在地を/から始まる道順で表示します。この道順をパスと呼びます。'],
    concepts: [{ term: '現在のディレクトリ', text: '相対パスの出発点になる場所です。' }, { term: 'パス', text: 'ディレクトリやファイルの場所を示す文字列です。/は区切りです。' }],
    example: { command: 'pwd', note: 'pwdには、今回は引数を付けません。' },
    task: 'pwdを実行し、現在地を表示してください。',
    hints: ['場所を表示するコマンドはpwdです。', 'pwdだけを入力すれば動きます。', 'pwd を入力してEnterを押します。'],
    solution: ['pwd'], success: '現在地は/home/analystです。迷ったらpwdに戻れます。', bridge: '現在地が分かったら、そこにある名前を見てみましょう。',
    validation: { all: [used('pwd'), out(home)] }
  });
  lesson({ id: '04-ls', chapter: 'browse', title: 'あるものを一覧にする', fixture: 'basics',
    goal: 'lsでディレクトリの中身を確認できる。',
    explanation: ['lsは、ファイルやディレクトリの名前を一覧にします。引数を省略すると、現在地の中身を表示します。', 'この教材では、名前を1行ずつ表示します。実際のLinuxでは画面幅や設定により、複数列に並ぶこともあります。'],
    concepts: [{ term: 'ls', text: '名前を一覧にするコマンド。ファイルの本文を読むコマンドではありません。' }],
    example: { command: 'ls notes', note: '現在地にあるnotesディレクトリの中を表示します。' },
    task: '引数を付けずにlsを実行し、現在地の中身を表示してください。',
    hints: ['現在地を確認するなら、lsの後ろにパスは不要です。', '一覧にはinbox、logs、notes、welcome.txtがあります。', 'ls と入力します。'],
    solution: ['ls'], success: 'logsは記録ファイルの置き場、welcome.txtは本文を持つファイルです。', bridge: '次はlogsへ移動します。',
    validation: { all: [used('ls'), out('inbox\nlogs\nnotes\nwelcome.txt')] }
  });
  lesson({ id: '05-cd', chapter: 'browse', title: 'ディレクトリを移動する', fixture: 'basics',
    goal: 'cdで現在地を変えられる。',
    explanation: ['cdの後ろに行き先を書くと、現在地が変わります。/で始まらないパスは、今いる場所からたどります。', 'cdが成功しても、普通は何も表示されません。画面の現在地表示やpwdで変化を確認できます。Tabキーでファイル名やディレクトリ名を補完できます。'],
    concepts: [{ term: '相対パス', text: 'logsのように、現在地を出発点にする道順です。' }],
    example: { command: 'cd /home/analyst', note: '場所を全部書いて移動する例です。ここでは今の場所を指定しているので、現在地は変わりません。今回の行き先はlogsです。' },
    task: '/home/analystから、その中のlogsディレクトリへ移動してください。',
    hints: ['移動はcd、行き先はlogsです。', '何も表示されなくても、現在地が変われば成功です。', 'cd logs と入力します。'],
    solution: ['cd logs'], success: '現在地が/home/analyst/logsになりました。', bridge: '相対パスと絶対パスを使うと、他の場所へも移動できます。',
    validation: { all: [used('cd', { scope: 'any' }), { type: 'cwd', value: logdir }] }
  });
  lesson({ id: '06-paths', chapter: 'browse', title: '一つ上の場所へ戻る',
    goal: '..と絶対パスの意味が分かる。',
    explanation: ['この練習は/home/analyst/logsから始まります。..は一つ上のディレクトリ、.は現在地を指します。', '/で始まる絶対パスなら、現在地にかかわらず同じ場所を指定できます。例えば/home/analystは、どこからでも同じ場所です。'],
    concepts: [{ term: '..', text: '一つ上のディレクトリです。cd ..で戻れます。' }, { term: '絶対パス', text: '/を出発点にして、目的地まで全部書いたパスです。' }],
    example: { command: 'ls /home/analyst', note: '絶対パスで場所を指定する例です。lsは現在地を変えずに、指定先の中身を表示できます。' },
    task: '..を使って、logsから一つ上の/home/analystへ移動してください。',
    hints: ['cdの行き先に..を指定します。', '半角ピリオドを二つ、間を空けずに書きます。', 'cd .. と入力します。'],
    solution: ['cd ..'], success: '一つ上へ移動できました。', bridge: '次の章では、用意されたログを読みます。各練習の現在地は個別に用意されます。',
    validation: { all: [used('cd', { args: ['..'], scope: 'any' }), { type: 'cwd', value: home }] }
  });
  lesson({ id: '07-cat', chapter: 'read', title: 'ファイルを全部読む', mode: 'guide',
    goal: 'catで短いファイルを表示できる。',
    explanation: ['catにファイル名を渡すと、本文を表示できます。ここからは/home/analyst/logsで練習します。', 'app.logは10行の練習用記録です。各行は「時刻 種類 名前 操作」の順です。INFO・WARN・ERRORは記録の種類で、ここでは文字として選んでいきます。'],
    concepts: [{ term: 'ログ', text: '出来事を記録したものです。この章では意味の判断より、文字を読む操作に慣れます。' }],
    example: { command: 'cat names.txt', note: 'names.txtに入っている名前の一覧を表示します。' },
    task: 'catでapp.logの全10行を表示してください。',
    hints: ['catの後ろに、読みたいファイル名を書きます。', 'app.logは現在地にあるので、長いパスは要りません。', 'cat app.log と入力します。'],
    solution: ['cat app.log'], success: '一つの記録を、これから少しずつ加工していきます。', bridge: '長いファイルなら、まず先頭だけ見ることもできます。',
    validation: { all: [used('cat'), out(app)] }
  });
  lesson({ id: '08-head', chapter: 'read', title: '先頭だけを読む',
    goal: 'headの-nで表示する行数を変えられる。',
    explanation: ['headは、先頭の行を表示します。-nの後ろの数字で、何行表示するか決められます。', '-nのように動きを調整する指定をオプションと呼びます。コマンド、オプション、ファイル名の間には半角スペースを入れます。'],
    concepts: [{ term: 'オプション', text: 'コマンドの動きを変える指定です。-n 3は「3行」という指定です。' }],
    example: { command: 'head -n 2 app.log', note: '先頭の2行を表示する例です。' },
    task: 'app.logの先頭3行を表示してください。',
    hints: ['headと-nを使います。', '行数は3です。', 'head -n 3 app.log と入力します。'],
    solution: ['head -n 3 app.log'], success: '表示する量を、自分で決められました。', bridge: '次は、ファイルの最後側を読みます。',
    validation: { all: [used('head'), out(lines(records.slice(0, 3)))] }
  });
  lesson({ id: '09-tail', chapter: 'read', title: '末尾だけを読む',
    goal: 'tailでファイルの最後の行を読める。',
    explanation: ['tailは、ファイルの末尾を表示します。headと同じく-nで行数を指定できます。', '末尾が最新とは限りません。今回のファイルは時刻順なので、最後の行ほど後の出来事です。'],
    concepts: [{ term: '末尾', text: 'ファイルの最後側です。tail -n 2なら最後の2行です。' }],
    example: { command: 'tail -n 1 app.log', note: '最後の1行を表示します。' },
    starter: 'head -n 3 app.log', task: 'app.logの最後の3行を表示してください。',
    hints: ['先頭のheadを、末尾のtailに変えます。', '-n 3はそのまま使えます。', 'tail -n 3 app.log と入力します。'],
    solution: ['tail -n 3 app.log'], success: '同じ行数指定を、別のコマンドで使えました。', bridge: '画面内で落ち着いて読むための表示方法も試します。',
    validation: { all: [used('tail'), out(lines(records.slice(-3)))] }
  });
  lesson({ id: '10-less', chapter: 'read', title: '開いて、読んで、終了する',
    goal: 'lessで開いた表示をqで終了できる。',
    explanation: ['lessは、長い本文を読むための表示です。この教材ではスクロールして読める画面が開きます。', 'lessを開いている間は、通常のコマンド入力とは別の状態です。qを押すと閉じて、コマンド入力に戻れます。'],
    concepts: [{ term: 'ページャー', text: '本文を読むための表示機能です。lessは代表的なページャーです。' }],
    example: { command: 'less names.txt', note: '名前一覧を開く例です。qで閉じられます。' },
    task: 'lessでapp.logを開き、内容を確認したらqで閉じてください。',
    hints: ['まずless app.logで開きます。', '開いたままでは完了しません。入力画面へ戻りましょう。', 'less app.log を実行し、開いた画面でqを押します。'],
    solution: ['less app.log', 'q'], success: '読むための画面から、自分で戻れました。', bridge: '次は、全部を読む代わりに必要な行を探します。',
    validation: { all: [used('less', { scope: 'any' }), { type: 'pagerClosed' }, out(app)] }
  });

  lesson({ id: '11-grep', chapter: 'filter', title: '文字を含む行を選ぶ', mode: 'guide',
    goal: 'grepで条件に合う行を抽出できる。',
    explanation: ['grepは、指定した文字に一致する部分を含む行を表示します。今回は大文字のERRORを探します。', '基本形はgrep「検索する文字」「ファイル」です。検索語を引用符で囲む習慣を付けると、空白を含む語も扱えます。'],
    concepts: [{ term: '抽出', text: '必要なものを選んで取り出すこと。grepは該当した行全体を取り出します。' }],
    example: { command: "grep 'INFO' app.log", note: 'INFOを含む2行が表示されます。' },
    starter: 'cat app.log', task: 'app.logから、大文字のERRORを含む6行を表示してください。',
    hints: ['grepの検索語をERRORにします。', 'ERRORとerrorは、今の設定では別の文字です。', "grep 'ERROR' app.log と入力します。"],
    solution: [grep], success: '10行から、必要な6行に絞れました。この結果を後で集計に使います。', bridge: '同じ検索に、行番号を追加してみましょう。',
    validation: { all: [used('grep'), out(lines(errors))] }
  });
  lesson({ id: '12-grep-number', chapter: 'filter', title: '元の行番号も表示する',
    goal: 'grep -nで元ファイルの行番号を付けられる。',
    explanation: ['grepに-nを加えると、元ファイルで何行目だったかも表示されます。例えば2:で始まる行は、元の2行目です。', '同じ-nでも意味はコマンドごとに異なります。headでは行数、grepでは行番号です。'],
    concepts: [{ term: '行番号', text: '元ファイルの先頭を1行目として数えた位置です。抽出後の番号ではありません。' }],
    example: { command: "grep -n 'INFO' app.log", note: '1行目と4行目にINFOがあることが分かります。' },
    starter: grep, newPart: '-n', task: '大文字のERRORを含む行を、元の行番号付きで表示してください。',
    hints: ['前の検索に-nを足します。', 'grepと検索語の間に-nを置けます。', "grep -n 'ERROR' app.log と入力します。"],
    solution: ["grep -n 'ERROR' app.log"], success: '抽出した行を、元ファイルの場所と結び付けられました。', bridge: '次は、大文字と小文字を同じものとして探します。',
    validation: { all: [used('grep', { flags: 'n' }), out(lines(records.map((line, i) => (i + 1) + ':' + line).filter(line => line.includes('ERROR'))))] }
  });
  lesson({ id: '13-grep-case', chapter: 'filter', title: '大文字と小文字をまとめて探す',
    goal: 'grep -iで大文字・小文字を区別せず検索できる。',
    explanation: ['app.logの最後には、小文字のerrorが1行あります。通常の検索ではERRORとは一致しません。', '-iを付けると、大文字と小文字を区別せず検索します。今回は行番号を付けずに試します。'],
    concepts: [{ term: '-i', text: 'grepで大文字と小文字を区別しない指定です。' }],
    example: { command: "grep -i 'info' app.log", note: '小文字のinfoで、大文字のINFOも探せます。' },
    starter: grep, newPart: '-i', task: 'ERRORとerrorを両方含む、合計7行を表示してください。',
    hints: ['grepに-iを追加します。', '検索語はERRORのままで構いません。', "grep -i 'ERROR' app.log と入力します。"],
    solution: ["grep -i 'ERROR' app.log"], success: '条件を変えると、選ばれる行も変わることを確かめました。', bridge: '次は、該当する行を除外します。',
    validation: { all: [used('grep', { flags: 'i' }), out(lines(records.filter(line => /error/i.test(line))))] }
  });
  lesson({ id: '14-grep-invert', chapter: 'filter', title: '指定した種類を除外する',
    goal: 'grep -vで一致しない行を選べる。',
    explanation: ['-vは検索結果を反転させます。指定した文字を含まない行を表示します。', 'この練習ではINFOだけを除きます。WARNもERRORも小文字のerrorも、残る側です。'],
    concepts: [{ term: '-v', text: 'grepの条件に一致しない行を選ぶ指定です。' }],
    example: { command: "grep -v 'WARN' app.log", note: 'WARNの1行を除いた9行を表示します。' },
    starter: "grep 'INFO' app.log", newPart: '-v', task: 'app.logから、INFOを含む行を除いた8行を表示してください。',
    hints: ['検索語はINFOです。', 'INFOを表示する検索に-vを付けます。', "grep -v 'INFO' app.log と入力します。"],
    solution: ["grep -v 'INFO' app.log"], success: '選ぶ条件を、除く条件としても使えました。', bridge: '次は、選んだ行を別のコマンドに渡します。',
    validation: { all: [used('grep', { flags: 'v' }), out(lines(records.filter(line => !line.includes('INFO'))))] }
  });
  lesson({ id: '15-pipe-count', chapter: 'pipe', title: '選んだ行を数える', mode: 'guide', minutes: 4,
    goal: 'パイプでgrepの結果をwcに渡せる。',
    explanation: ['縦棒の|はパイプです。左のコマンドが出した文字を、右のコマンドの入力として渡します。', 'wc -lは改行の数を数えます。この教材の記録は各行の末尾に改行があるため、行数を数えられます。右側にはapp.logを書かず、grepから届く結果を数えます。'],
    concepts: [{ term: '標準出力', text: 'コマンドが結果の文字を出す先。普段は画面へ出ます。' }, { term: '標準入力', text: 'コマンドが文字を受け取る入口。パイプで前の結果を受け取れます。' }, { term: 'パイプ |', text: '左の標準出力を、右の標準入力につなぎます。' }],
    example: { command: "grep 'INFO' app.log | wc -l", note: 'INFOを選んだ結果が2行なので、2と表示されます。' },
    starter: grep, newPart: '| wc -l', task: '大文字のERRORを含む行をgrepで選び、wc -lで数えてください。',
    hints: ['前の検索の後ろに|を書きます。', '右側のwc -lには、ファイル名を付けません。', "grep 'ERROR' app.log | wc -l と入力します。"],
    solution: [grep + ' | wc -l'], success: '6という結果は、grepを通過した6行からできています。途中結果でも確かめられます。', bridge: '右側を変えると、数える以外の処理もできます。',
    validation: { all: [used('grep'), used('wc', { flags: 'l' }), pipe(2), out('6')] }
  });
  lesson({ id: '16-pipe-head', chapter: 'pipe', title: '選んだ結果の先頭を見る',
    goal: 'パイプの右側を、目的に合わせて入れ替えられる。',
    explanation: ['パイプの右側には、headも置けます。まずgrepで選び、その結果から先頭を取ります。', '処理の順番には意味があります。ファイルの先頭2行を取る操作と、ERRORを選んでから2行を取る操作は異なります。'],
    concepts: [{ term: '処理の順番', text: 'パイプは左から右へ、前の結果を材料にして進みます。' }],
    example: { command: "grep 'INFO' app.log | head -n 1", note: 'INFOの行を選び、その先頭1行だけを表示します。' },
    starter: grep + ' | wc -l', newPart: 'head -n 2', task: '大文字のERRORを含む行を選び、その先頭2行を表示してください。',
    hints: ['grepはそのまま使います。', 'wc -lの部分をhead -n 2に入れ替えます。', "grep 'ERROR' app.log | head -n 2 と入力します。"],
    solution: [grep + ' | head -n 2'], success: '同じ抽出結果を、違う目的に使えました。', bridge: '次は行全体から、必要な列だけを取り出します。',
    validation: { all: [used('grep'), used('head'), pipe(2), out(lines(errors.slice(0, 2)))] }
  });
  lesson({ id: '17-awk', chapter: 'columns', title: '空白で区切られた列を選ぶ', mode: 'guide', minutes: 4,
    goal: 'awkで番号を指定し、必要な列を取り出せる。',
    explanation: ['awkは、行を列に分けて処理できます。今回のような空白区切りでは、左から$1、$2、$3…と列を指定します。', "'{print $3}'は「3列目を表示する」という処理です。中の$をそのまま渡すため、全体を半角のシングルクォートで囲みます。"],
    concepts: [{ term: '列・フィールド', text: '1行を区切った中の項目です。app.logでは時刻が$1、種類が$2、名前が$3、操作が$4です。' }, { term: 'print', text: 'awkの中で、指定した値を表示する命令です。' }],
    example: { command: "awk '{print $2}' app.log", note: '2列目のINFOやERRORだけが表示されます。' },
    task: 'app.logの全10行から、3列目の名前だけを表示してください。',
    hints: ['名前は左から3番目です。', 'printの後ろを$3にします。', "awk '{print $3}' app.log と入力します。"],
    solution: ["awk '{print $3}' app.log"], success: '行全体から、名前だけを取り出せました。', bridge: 'ここまでのgrepと合わせて、ERRORの行の名前だけを取り出します。',
    validation: { all: [used('awk'), out(lines(records.map(line => line.split(' ')[2])))] }
  });
  lesson({ id: '18-grep-awk', chapter: 'columns', title: '行を選んでから、列を選ぶ', minutes: 4,
    goal: 'grepとawkをつなぎ、条件に合う名前だけを取り出せる。',
    explanation: ['最初にgrepでERRORの行を選びます。その結果をawkへ渡せば、選ばれた行の3列目だけを表示できます。', '右側のawkにはapp.logを指定しません。指定すると、パイプの結果ではなく元ファイルを読むことになります。'],
    concepts: [{ term: '行と列', text: 'grepで対象の行を選び、awkで各行の必要な列を選びます。' }],
    example: { command: "grep 'INFO' app.log | awk '{print $3}'", note: 'INFOの行に登場するakiとmeiが表示されます。' },
    starter: grep, newPart: "| awk '{print $3}'", task: '大文字のERRORを含む行から、3列目の名前だけを表示してください。',
    hints: ['前の段階はgrepでERRORを選ぶコマンドです。', "後ろに | awk '{print $3}' を加えます。", selectNames + ' と入力します。'],
    solution: [selectNames], success: '6行を選び、その6行から名前を取り出せました。まだ同じ名前が離れて並んでいます。', bridge: 'この結果を、次の集計の章で少しずつ育てます。',
    validation: { all: [used('grep'), used('awk'), pipe(2), out(lines(names))] }
  });
  lesson({ id: '19-cut', chapter: 'columns', title: '区切り文字を指定して列を取る',
    goal: 'cutでカンマ区切りの列を取り出せる。',
    explanation: ['teams.csvは「名前,チーム」の順で、各項目をカンマで区切っています。今回は名前やチームにカンマを含まない、単純な形式です。', "cut -d ',' -f 2は「カンマで区切り、2列目を取り出す」という指定です。一般的なCSVの引用符内のカンマなどは、cutだけでは適切に扱えません。"],
    concepts: [{ term: '区切り文字', text: '項目の境目を示す文字です。-dで指定し、-fで列番号を選びます。' }],
    example: { command: "cut -d ',' -f 1 teams.csv", note: '1列目の名前を取り出します。cat teams.csvで元の内容も確認できます。' },
    task: 'teams.csvから、2列目のチーム名だけを表示してください。',
    hints: ['区切りはカンマなので、-dの値は変えません。', '-fの後ろを2にします。', "cut -d ',' -f 2 teams.csv と入力します。"],
    solution: ["cut -d ',' -f 2 teams.csv"], success: '列の取り方を、データの区切りに合わせられました。', bridge: '次は、先ほどの名前を並べて数える準備です。',
    validation: { all: [used('cut'), out('blue\nred\nblue')] }
  });
  lesson({ id: '20-sort', chapter: 'count', title: '同じ名前を隣り合わせる', mode: 'guide',
    goal: 'sortで行を並べ替えられる。',
    explanation: ['sortは、行を並べ替えます。まず短いnames.txtで試します。中身は、先ほどERRORの行から取り出した6人分の名前と同じです。', '並べ替えると、同じ名前が隣り合います。後でuniqで数えるための準備になります。'],
    concepts: [{ term: 'sort', text: '行を並べ替えるコマンドです。この教材の英小文字の名前はaki、mei、renの順になります。' }],
    example: { command: 'sort teams.csv', note: '行全体を文字の順で並べます。元ファイル自体は書き換わりません。' },
    task: 'names.txtをsortで並べ替えて表示してください。',
    hints: ['sortの後ろにファイル名を書きます。', '元の順番はcat names.txtでも確認できます。', 'sort names.txt と入力します。'],
    solution: ['sort names.txt'], success: '同じ名前が隣り合いました。重複した行はまだ残っています。', bridge: '次は、隣り合った同じ行をまとめて数えます。',
    validation: { all: [used('sort'), out(lines(sortedNames))] }
  });
  lesson({ id: '21-uniq', chapter: 'count', title: '隣り合う同じ行を数える',
    goal: 'uniq -cの数え方と、sortが必要な理由が分かる。',
    explanation: ['uniqは、隣り合う同じ行をまとめます。-cを付けると、そのまとまりの行数も表示します。', 'sorted-names.txtは並べ替え済みです。離れた同じ名前を一つに数えるには、先にsortで隣り合わせる必要があります。'],
    concepts: [{ term: 'uniq -c', text: '連続して現れる同じ行をまとめ、「件数 元の行」の形で表示します。' }],
    example: { command: 'uniq sorted-names.txt', note: '件数なしで、aki、mei、renの3行にまとめます。' },
    newPart: '-c', task: 'sorted-names.txtをuniq -cで集計し、名前ごとの件数を表示してください。',
    hints: ['uniqに-cを付けます。', '使うのは並べ替え済みのsorted-names.txtです。', 'uniq -c sorted-names.txt と入力します。'],
    solution: ['uniq -c sorted-names.txt'], success: 'akiは2件、meiは1件、renは3件と分かりました。', bridge: '次は、ファイルに分けず、パイプの中で並べ替えます。',
    validation: { all: [used('uniq', { flags: 'c' }), out(counts, 'lines')] }
  });
  lesson({ id: '22-pipeline-sort', chapter: 'count', title: '集計の組み立て① 並べる', minutes: 4,
    goal: 'grep → awkの後ろへ、sortを一段だけ追加できる。',
    explanation: ['ここから、同じコマンドを一段ずつ伸ばします。まず「ERRORの行を選ぶ → 名前を取る」の結果にsortを加えます。', '各段階の表示で、6行の記録が6個の名前になり、名前順になる変化を確かめてください。'],
    concepts: [{ term: 'パイプライン', text: '複数のコマンドをパイプでつないだものです。一段ずつ目的を説明できれば、長くても読み解けます。' }],
    example: { command: 'cat names.txt | sort', note: '受け取った名前を並べ替える形です。sortにファイル名は要りません。' },
    starter: selectNames, newPart: '| sort', task: 'ERRORの行から名前を取り出すコマンドの後ろにsortを追加し、名前順に表示してください。',
    hints: ['前の段階を入力すると、grepとawkまでのコマンドを使えます。', 'その後ろに | sort を追加します。', groupNames + ' と入力します。'],
    solution: [groupNames], success: '3段の処理になりました。選ぶ → 取り出す → 並べる、の順です。', bridge: '今度は、並べた名前を数える段階を追加します。',
    validation: { all: [used('grep'), used('awk'), used('sort'), pipe(3), out(lines(sortedNames))] }
  });
  lesson({ id: '23-pipeline-uniq', chapter: 'count', title: '集計の組み立て② 数える', minutes: 4,
    goal: '並べ替えた結果へuniq -cを追加できる。',
    explanation: ['前の段階で、同じ名前が隣り合いました。最後にuniq -cを加えれば、名前ごとの件数になります。', 'ここで行数は6行から3行になります。3は名前の種類の数、各行の左側は出現件数です。'],
    concepts: [{ term: '件数と種類数', text: '6件のERRORに、3種類の名前が登場します。出力の行数と件数は別のものです。' }],
    example: { command: 'sort names.txt | uniq -c', note: '並べてから数える、という2段の基本形です。' },
    starter: groupNames, newPart: '| uniq -c', task: '前の3段のコマンドにuniq -cを追加し、ERRORの名前ごとの件数を表示してください。',
    hints: ['grep、awk、sortはそのまま残します。', '末尾に | uniq -c を加えます。', countNames + ' と入力します。'],
    solution: [countNames], success: '4段で、元の記録から集計表ができました。まだ名前順です。', bridge: '最後に件数の多い順に並べます。',
    validation: { all: [used('grep'), used('awk'), used('sort'), used('uniq', { flags: 'c' }), pipe(4), out(counts, 'lines')] }
  });
  lesson({ id: '24-pipeline-rank', chapter: 'count', title: '集計の組み立て③ 多い順にする', minutes: 4,
    goal: 'sort -nrを追加して、数の多い順に並べられる。',
    explanation: ['sort -nは、行の先頭を数値として比較します。-rは並び順を逆にします。合わせた-nrで、件数の多い順にできます。', '最初のsortは「同じ名前を隣り合わせる」ため、最後のsort -nrは「件数の多い順にする」ため。同じコマンドでも、担当する役割が違います。'],
    concepts: [{ term: '数値順', text: '2より10を大きいとする順序です。文字としての並べ替えでは10が2より先に来る場合があります。' }, { term: '-nr', text: '-nと-rをまとめた指定です。-n -rと分けても同じです。' }],
    example: { command: 'sort -nr counts.txt', note: 'counts.txtの10、2、1を数の大きい順にします。cat counts.txtでも中身を確かめられます。' },
    starter: countNames, newPart: '| sort -nr', task: '前の集計コマンドにsort -nrを追加し、ERRORの件数が多い名前から順に表示してください。',
    hints: ['名前順に数えるところまでは変えません。', '末尾にもう一段、 | sort -nr を追加します。', rankNames + ' と入力します。'],
    solution: [rankNames], success: '5段のコマンドが完成しました。ren 3件、aki 2件、mei 1件を自分で求められました。', bridge: '次は、この結果を後から読めるファイルとして残します。',
    validation: { all: [used('grep'), used('awk'), used('uniq', { flags: 'c' }), used('sort', { flags: 'nr' }), pipe(5), out(ranking, 'lines')] }
  });
  lesson({ id: '25-mkdir', chapter: 'save', title: '結果を置く場所を作る', mode: 'guide',
    goal: 'mkdirで作業用ディレクトリを作れる。',
    explanation: ['mkdirは、新しいディレクトリを作ります。今回は/home/analystの中にreportsという置き場を作ります。', '現在地は/home/analyst/logsです。../reportsは「一つ上へ進み、その中のreports」を表します。成功時に何も表示されないのは通常の動きです。'],
    concepts: [{ term: 'mkdir', text: '指定したパスにディレクトリを作るコマンドです。' }],
    example: { command: 'mkdir ../practice', note: '一つ上にpracticeを作る例です。今回作る名前はreportsです。' },
    task: 'mkdirで/home/analyst/reportsを作ってください。',
    hints: ['現在地の一つ上を表すのは..です。', 'mkdir ../reportsなら、目的の場所に作れます。絶対パスでも構いません。', 'mkdir ../reports と入力します。'],
    solution: ['mkdir ../reports'], success: '結果を保存する場所ができました。ls ..で場所を確認できます。', bridge: '次は、画面に出ていた結果をファイルへ送ります。',
    validation: { all: [used('mkdir', { scope: 'any' }), { type: 'directory', path: home + '/reports' }] }
  });
  lesson({ id: '26-redirect', chapter: 'save', title: '表示の代わりにファイルへ保存する', fixture: 'reports',
    goal: '>で抽出結果をファイルへ保存できる。',
    explanation: ['>は、コマンドの出力先をファイルへ変える記号です。保存先がなければ作り、あれば内容を上書きします。', 'この練習ではreportsを用意済みです。画面に結果が出なくても、保存できていれば成功です。catで保存先を読めます。'],
    concepts: [{ term: 'リダイレクト', text: '出力先などを切り替えること。>は標準出力をファイルに書きます。' }],
    example: { command: "grep 'INFO' app.log > ../reports/info.txt", note: 'INFOの行を保存します。同じ名前のファイルがあれば上書きします。' },
    starter: grep, newPart: '> ../reports/errors.txt', task: '大文字のERRORを含む6行を、../reports/errors.txtへ保存してください。',
    hints: ['前の検索コマンドの末尾に>と保存先を書きます。', 'パイプの|ではなく、出力先を変える>を使います。', grep + ' > ../reports/errors.txt と入力します。'],
    solution: [grep + ' > ../reports/errors.txt'], success: '抽出結果がerrors.txtに残りました。元のapp.logはそのままです。', bridge: '次は、上書きせず末尾に追加する方法です。',
    validation: { all: [used('grep', { scope: 'any' }), saved(home + '/reports/errors.txt', lines(errors))] }
  });
  lesson({ id: '27-append', chapter: 'save', title: '今の内容を残して追記する', fixture: 'notes',
    goal: '>>と>の違いを理解して追記できる。',
    explanation: ['>>は、ファイルの最後に出力を追加します。>は上書き、>>は追記です。', 'この練習の../reports/memo.txtには「確認開始」の1行が入っています。catで内容を見てから追記しても構いません。'],
    concepts: [{ term: '追記', text: '既存の内容を残したまま、その後ろに追加することです。' }],
    example: { command: "echo '作業中' >> ../reports/example.txt", note: '別の練習用ファイルへ追記する例です。今回の保存先はmemo.txt、追加する文字は確認完了です。' },
    newPart: '>>', task: '元の「確認開始」を残し、その次に「確認完了」を1行だけ追記してください。',
    hints: ['文字を出すechoと、追記する>>を組み合わせます。', '>が一つだと元の内容が消えるので、二つ書きます。', "echo '確認完了' >> ../reports/memo.txt と入力します。"],
    solution: ["echo '確認完了' >> ../reports/memo.txt"], success: '2行のメモになりました。追記を繰り返すと同じ行も増えることを覚えておきましょう。', bridge: '集計結果を、画面で見ながら保存する方法もあります。',
    validation: { all: [used('echo', { scope: 'any' }), saved(home + '/reports/memo.txt', '確認開始\n確認完了\n', 'exact')] }
  });
  lesson({ id: '28-tee', chapter: 'save', title: '完成した集計を見ながら保存する', fixture: 'reports', minutes: 4,
    goal: '5段の集計へteeを加え、表示と保存を両方できる。',
    explanation: ['teeは、標準入力で受け取った文字をファイルに保存し、同じ文字を標準出力にも流します。', '前に作った5段の集計の末尾へ、teeを一段だけ加えます。今回はreportsを用意済みです。teeは通常、保存先を上書きします。'],
    concepts: [{ term: 'tee', text: '入力をファイルと次の出力先の両方へ送るコマンドです。末尾なら画面にも見えます。' }],
    example: { command: "grep 'INFO' app.log | tee ../reports/info.txt", note: 'INFOの行を表示しながら、同じ内容を保存します。' },
    starter: rankNames, newPart: '| tee ../reports/ranking.txt', task: 'ERRORの名前別件数を多い順に表示し、同じ結果を../reports/ranking.txtへ保存してください。',
    hints: ['前の5段の集計は、そのまま使えます。', '末尾に | tee ../reports/ranking.txt を追加します。', rankNames + ' | tee ../reports/ranking.txt と入力します。'],
    solution: [rankNames + ' | tee ../reports/ranking.txt'], success: '6段で、選ぶ → 列を取る → 並べる → 数える → 多い順 → 保存、がつながりました。', bridge: 'できあがったファイルのコピーと名前の変更も練習します。',
    validation: { all: [used('grep'), used('awk'), used('uniq', { flags: 'c' }), used('sort', { flags: 'nr' }), used('tee'), pipe(6), out(ranking, 'lines'), saved(home + '/reports/ranking.txt', ranking, 'lines')] }
  });
  lesson({ id: '29-copy', chapter: 'save', title: '結果のコピーを作る', fixture: 'copy',
    goal: 'cpで元ファイルを残して複製できる。',
    explanation: ['cpは、コピー元とコピー先をこの順に指定します。元ファイルを残したまま、同じ内容を別の場所や名前に保存できます。', 'この練習では../reports/ranking.txtを用意済みです。コピー先に既存ファイルを指定すると上書きされるので、パスを確認して使います。'],
    concepts: [{ term: 'cp 元 先', text: '最初がコピー元、次がコピー先です。空白で区切って指定します。' }],
    example: { command: 'cp ../reports/ranking.txt ../reports/backup.txt', note: 'backup.txtという別名にコピーする例です。' },
    task: '../reports/ranking.txtを、../reports/ranking-copy.txtへコピーしてください。',
    hints: ['コマンドはcpです。', 'コピー元の後ろに、コピー先のパスを書きます。', 'cp ../reports/ranking.txt ../reports/ranking-copy.txt と入力します。'],
    solution: ['cp ../reports/ranking.txt ../reports/ranking-copy.txt'], success: '元のranking.txtとコピーの両方が残っています。', bridge: '次は、ファイルの名前を変更します。',
    validation: { all: [used('cp', { scope: 'any' }), saved(home + '/reports/ranking.txt', ranking, 'lines'), saved(home + '/reports/ranking-copy.txt', ranking, 'lines')] }
  });
  lesson({ id: '30-move', chapter: 'save', title: 'ファイル名を変更する', fixture: 'move',
    goal: 'mvでファイル名を変更できる。',
    explanation: ['mvは、ファイルを別の場所へ移したり、名前を変更したりします。同じディレクトリ内で別の名前を指定すれば、名前の変更になります。', 'この練習では../reports/ranking-copy.txtを用意済みです。cpと違い、元の名前のファイルは残りません。'],
    concepts: [{ term: 'mv 元 先', text: '移動元と移動先を指定します。移動先が既存ファイルなら上書きする場合があるため、名前を確かめます。' }],
    example: { command: 'mv ../reports/example-before.txt ../reports/example-after.txt', note: '別の練習用ファイルの名前を変更する例です。今回変えるのはranking-copy.txtです。' },
    task: '../reports/ranking-copy.txtの名前を、../reports/summary.txtへ変更してください。',
    hints: ['名前を変更するコマンドはmvです。', '最初に今の名前、次に新しい名前を書きます。', 'mv ../reports/ranking-copy.txt ../reports/summary.txt と入力します。'],
    solution: ['mv ../reports/ranking-copy.txt ../reports/summary.txt'], success: '内容を保ったまま、summary.txtという名前に変えられました。', bridge: '次は、項目名を持つJSONの記録を扱います。',
    validation: { all: [used('mv', { scope: 'any' }), saved(home + '/reports/summary.txt', ranking, 'lines')] }
  });
  lesson({ id: '31-jq-read', chapter: 'json', title: 'JSONを読みやすく表示する', mode: 'guide', minutes: 4,
    goal: 'JSONのキーと値を見分け、jqで表示できる。',
    explanation: ['JSONでは「項目名: 値」の組で情報を表せます。項目名をキーと呼びます。profile.jsonにはuser、team、activeがあります。', "jqはJSONを処理するコマンドです。フィルター'.'は、入力された値全体をそのまま出します。見やすい改行と字下げも付きます。"],
    concepts: [{ term: 'キーと値', text: '"user": "aki"なら、userがキー、akiが値です。' }, { term: 'jqのフィルター', text: 'どの値を取り出すか、どう処理するかを表す式です。シングルクォートで囲んで渡します。' }],
    example: { command: 'cat profile.json', note: '元ファイルは1行です。jqで表示すると、項目ごとに改行されます。' },
    task: "jqの'.'を使って、profile.jsonの全体を表示してください。",
    hints: ['コマンド名はjqです。', "jqの後ろに'.'、次にファイル名を書きます。", "jq '.' profile.json と入力します。"],
    solution: ["jq '.' profile.json"], success: 'JSON全体を、項目ごとに読みやすく表示できました。', bridge: '次は、番号でなくキーを指定して値を取り出します。',
    validation: { all: [used('jq'), out(JSON.stringify(profile, null, 2))] }
  });
  lesson({ id: '32-jq-field', chapter: 'json', title: 'キーを指定して名前を取る', minutes: 4,
    goal: 'jq -rでキーの値を普通の文字列として取り出せる。',
    explanation: ['events.jsonlは、app.logと同じ10件を1行ずつJSONにした記録です。1行に一つのJSONがある形式をJSON Linesと呼びます。', '.userはuserの値を取り出します。-rを付けると、文字列をJSONの引用符なしで表示できます。位置ではなくキーで選べるので、項目の並び順に頼りません。'],
    concepts: [{ term: '.user', text: '現在のJSONから、userというキーの値を取り出す式です。' }, { term: '-r', text: 'jqで文字列を引用符なしの通常の文字として出力する指定です。' }],
    example: { command: "jq -r '.user' profile.json", note: '引用符なしのakiが表示されます。' },
    task: 'events.jsonlの全10件から、userの値を引用符なしで表示してください。',
    hints: ['フィルターは.userです。', '引用符なしにする-rを忘れずに付けます。', "jq -r '.user' events.jsonl と入力します。"],
    solution: ["jq -r '.user' events.jsonl"], success: '空白の列番号に頼らず、名前を取り出せました。', bridge: '次は、JSONの項目を条件にして記録を絞ります。',
    validation: { all: [used('jq', { flags: 'r' }), out(lines(events.map(event => event.user)))] }
  });
  lesson({ id: '33-jq-select', chapter: 'json', title: 'JSONの値で記録を選ぶ', minutes: 4,
    goal: 'jqのselectで、キーの値が一致する記録を選べる。',
    explanation: ['select(条件)は、条件に合うJSONだけを残します。.level == "ERROR"は「levelの値が大文字のERRORと等しい」という条件です。', '条件の外側はシングルクォート、ERRORの文字列はダブルクォートで囲みます。ここでは選んだJSON全体を表示します。'],
    concepts: [{ term: 'select', text: '条件が成り立つ入力だけを通すjqの処理です。' }, { term: '==', text: '左右の値が等しいか比較する記号です。=を二つ書きます。' }],
    example: { command: "jq 'select(.level == \"INFO\")' events.jsonl", note: 'levelがINFOの2件だけを選びます。' },
    task: 'events.jsonlから、levelが大文字のERRORと等しい6件をJSONのまま表示してください。',
    hints: ['.levelというキーを条件にします。', 'selectの丸括弧の中を.level == "ERROR"にします。', "jq 'select(.level == \"ERROR\")' events.jsonl と入力します。"],
    solution: ["jq 'select(.level == \"ERROR\")' events.jsonl"], success: '行の見た目ではなく、levelの値を使って選べました。', bridge: '選んだJSONから名前だけを取る処理をつなぎます。',
    validation: { all: [used('jq'), out(lines(events.filter(event => event.level === 'ERROR').map(event => JSON.stringify(event, null, 2))))] }
  });
  lesson({ id: '34-jq-compose', chapter: 'json', title: 'JSONでも、選んでから取り出す', minutes: 4,
    goal: 'jqの中でselectとフィールド抽出をつなげられる。',
    explanation: ['jqのフィルターの中にも|が書けます。selectで残したJSONを、.userへ渡して名前だけを取り出します。', '引用符の内側の|はjqの処理をつなぎます。引用符の外側の|はシェルがコマンドをつなぎます。今回は一つのjqコマンドの中で処理します。'],
    concepts: [{ term: 'jq内のパイプ', text: 'JSONの値を次のフィルターへ渡します。シェルのパイプは文字を次のコマンドへ渡します。' }],
    example: { command: "jq -r 'select(.level == \"INFO\") | .user' events.jsonl", note: 'INFOを選んだ後、akiとmeiを取り出します。' },
    starter: "jq 'select(.level == \"ERROR\")' events.jsonl", newPart: '| .user',
    task: 'levelがERRORの6件から、userだけを引用符なしで表示してください。',
    hints: ['selectの後ろ、シングルクォートの内側に | .user を加えます。', '前に学んだ-rを付けると、名前の引用符を外せます。', "jq -r 'select(.level == \"ERROR\") | .user' events.jsonl と入力します。"],
    solution: ["jq -r 'select(.level == \"ERROR\") | .user' events.jsonl"], success: 'grep → awkと同じ6個の名前が、JSONからも取り出せました。外側にsortなどをつなぐこともできます。', bridge: '最後は、新しいファイルで、これまでの操作を自分で選びます。',
    validation: { all: [used('jq', { flags: 'r' }), out(lines(names))] }
  });
  lesson({ id: '35-final-extract', chapter: 'final', title: '卒業実習① 新しい記録を調べる', mode: 'challenge', fixture: 'basics', minutes: 5,
    goal: '別の場所にある記録を読み、指定された行を抽出できる。',
    explanation: ['ここからは手順を自分で選びます。現在地は/home/analyst。inboxの中に、新しい記録shift.logが届いています。', '列の構成は「時刻 種類 名前 操作」です。lsやcatで確認してから絞っても、ファイルを直接指定して絞っても構いません。'],
    concepts: [{ term: 'ここまでの道具', text: 'pwd・ls・cdで場所を確かめ、cat・head・tailで読み、grepで行を選べます。' }],
    example: { command: 'ls inbox', note: 'ファイルの名前を確認するところから始められます。' },
    task: 'inbox/shift.logを読み、大文字のERRORを含む行だけを表示してください。',
    hints: ['現在地の下にあるファイルは、ディレクトリ名/ファイル名で指定できます。', '必要なのはERRORを含む行全体です。名前の抽出はまだしません。', "grep 'ERROR' inbox/shift.log で抽出できます。cd inboxしてからでも構いません。"],
    solution: ["grep 'ERROR' inbox/shift.log"], success: '新しいファイルにも、知っている操作を使えました。', bridge: '次は、この記録から名前別の件数を求め、結果を保存します。',
    validation: { all: [{ type: 'source', path: home + '/inbox/shift.log' }, out(lines(shift.filter(line => line.includes('ERROR'))))] }
  });
  lesson({ id: '36-final-ranking', chapter: 'final', title: '卒業実習② 集計を完成させる', mode: 'challenge', fixture: 'basics', minutes: 7,
    goal: '新しい記録の抽出・集計・保存を自分で組み立てられる。',
    explanation: ['最後の練習は/home/analystから始まります。reportsはまだないので、必要な置き場を作ってください。', '何段に分けても構いません。途中結果を確かめ、目的を満たすコマンドを組み立てましょう。モデル解答と同じ書き方である必要はありません。'],
    concepts: [{ term: '今回の完成形', text: 'ERRORだけを選ぶ → 名前を取る → 同じ名前を並べる → 数える → 多い順にする → 保存する。' }],
    example: { command: 'cat inbox/shift.log', note: 'まず元の記録を確認できます。列番号や選ぶ条件を確かめましょう。' },
    task: 'inbox/shift.logの大文字のERRORについて、名前別の件数を多い順に表示してください。同じ結果を/home/analyst/reports/ranking.txtに保存してください。',
    hints: ['名前は3列目です。まずgrepとawkをつなぎ、名前だけ取り出せるか確かめます。', 'sort → uniq -c → sort -nrで集計できます。mkdirでreportsを作り、最後にteeで保存できます。', "mkdir reports を実行し、grep 'ERROR' inbox/shift.log | awk '{print $3}' | sort | uniq -c | sort -nr | tee reports/ranking.txt と入力します。"],
    solution: ['mkdir reports', "grep 'ERROR' inbox/shift.log | awk '{print $3}' | sort | uniq -c | sort -nr | tee reports/ranking.txt"],
    success: '卒業です。新しい記録からsora 3件、yui 2件、naoki 1件を求めて保存できました。長いコマンドも、役割のある小さな操作の組み合わせです。',
    bridge: '次はSOCroom-easyでログの意味や読み方を学び、その後Logroomでコマンドを使ったログ分析に進みましょう。',
    validation: { all: [{ type: 'source', path: home + '/inbox/shift.log' }, { type: 'directory', path: home + '/reports' }, out(finalRanking, 'lines'), saved(home + '/reports/ranking.txt', finalRanking, 'lines')] }
  });

  const glossary = [
    { term: 'コマンド', text: '文字で指定する操作の名前。後ろに引数やオプションを付けます。', example: "grep 'ERROR' app.log" },
    { term: 'プロンプト', text: '入力待ちを示す印です。画面にある$は入力しません。', example: 'echo ready' },
    { term: '引数', text: 'コマンドに渡す情報。検索語やファイル名などです。', example: 'cat app.log' },
    { term: 'オプション', text: 'コマンドの動きを調整する指定。同じ文字でもコマンドによって意味が異なります。', example: 'head -n 3 app.log' },
    { term: '引用符', text: '空白や記号を含む文字列をひとまとまりにします。awkの処理には半角のシングルクォートを使います。', example: "awk '{print $3}' app.log" },
    { term: 'ディレクトリ', text: 'ファイルをまとめる場所。一般的な画面操作でいうフォルダです。', example: 'ls logs' },
    { term: '現在地', text: '今いるディレクトリ。相対パスの出発点です。', example: 'pwd' },
    { term: '絶対パス', text: '/から始まり、場所を全部指定した道順です。', example: 'cd /home/analyst/logs' },
    { term: '相対パス', text: '現在地からたどる道順。..は一つ上、.は現在地です。', example: 'cat ../welcome.txt' },
    { term: 'パイプ |', text: '左の標準出力を、右の標準入力に渡します。右側に元ファイルを指定すると、届いた結果を使わない場合があります。', example: "grep 'ERROR' app.log | wc -l" },
    { term: '標準入力・標準出力', text: 'コマンドが文字を受け取る入口と、結果を出す出口。パイプでつなげられます。', example: 'cat names.txt | sort' },
    { term: 'grep', text: '条件に合う行を選びます。-nは行番号、-iは大文字小文字を区別しない、-vは除外、-Fは検索語を正規表現でなく文字列として扱います。', example: "grep -n 'ERROR' app.log" },
    { term: '一致しない検索', text: 'grepで見つからないと、出力は空になります。見つからないことを示す終了コード1は、構文エラーとは違います。', example: "grep 'NOT_FOUND' app.log" },
    { term: '列・フィールド', text: '行を区切った項目。awkでは通常、空白区切りの左から$1、$2…です。$0は行全体、$NFは最後の列です。', example: "awk '{print $3}' app.log" },
    { term: 'cut', text: '区切り文字や文字位置を指定して、一部分を取り出します。単純な区切りのデータに使います。', example: "cut -d ',' -f 2 teams.csv" },
    { term: 'sortとuniq', text: 'uniqは隣り合う同じ行をまとめます。離れた同じ行もまとめて数えるなら、まずsortで並べます。', example: 'sort names.txt | uniq -c' },
    { term: '数値順', text: 'sort -nは数値として比較、-rは逆順です。-nrで数の多い順にします。', example: 'sort -nr counts.txt' },
    { term: '保存と追記', text: '>は上書き、>>は追記です。保存先の親ディレクトリは先に作ります。', example: "echo '確認完了' >> ../reports/memo.txt" },
    { term: 'tee', text: '受け取った文字を保存し、同時に標準出力にも流します。通常は保存先を上書きします。', example: "grep 'ERROR' app.log | tee ../reports/errors.txt" },
    { term: 'JSONとJSON Lines', text: 'JSONはキーと値を持つデータ形式。JSON Linesは1行に一つずつJSONを置く形式です。', example: "jq -r '.user' events.jsonl" },
    { term: 'jqのselect', text: 'JSONのキーの値を条件に、入力を選びます。引用符内の|はjqのフィルターをつなぎます。', example: "jq -r 'select(.level == \"ERROR\") | .user' events.jsonl" },
    { term: '操作の補助', text: '↑・↓で入力履歴、Tabで名前の補完、Ctrl+Lで表示を整理できます。lessはqで閉じます。', example: 'less app.log' },
    { term: 'この教材のhelp', text: '学習用シェルが対応するコマンドを案内します。一般のLinuxの外部コマンドを調べるmanとは別の、この教材の機能です。', example: 'help grep' }
  ];
  root.LINUXROOM_DATA = { version: 1, chapters, datasets, lessons, glossary };
})(typeof globalThis !== 'undefined' ? globalThis : window);
