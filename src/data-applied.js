/* Linuxroom 応用編: explicit fixtures and independently specified expected results. */
(function (root) {
  'use strict';
  const D = root.LINUXROOM_DATA;
  const base = '/home/analyst/applied';
  const lines = values => values.join('\n') + '\n';
  const session = lines([
    '10:00 INFO api-1 session=start user=AKI',
    '10:01 WARN api-1 retry user=AKI',
    '10:02 ERROR api-1 failed user=AKI',
    '10:03 INFO api-1 session=end user=AKI',
    '10:04 INFO api-2 session=start user=REN',
    '10:05 ERROR api-2 failed user=REN',
    '10:06 WARN api-2 retry user=REN',
    '10:07 INFO api-2 session=end user=REN'
  ]);
  const labels = lines(['ERROR disk-full', 'INFO warm', 'WARN queue', 'DETAIL previous ERROR', 'ERROR cache-miss']);
  const notes = 'start\n\nreview\nfinish\n';
  const metrics = lines([
    'time,level,user,service,duration',
    '10:00,INFO,Aki,portal,40',
    '10:01,ERROR,REN,portal,120',
    '10:02,ERROR,aki,portal,250',
    '10:03,WARN,Mei,api,80',
    '10:04,ERROR,REN,api,300',
    '10:05,ERROR,Aki,portal,150',
    '10:06,ERROR,mei,portal,90',
    '10:07,INFO,Ren,portal,30',
    '10:08,ERROR,REN,portal,200',
    '10:09,ERROR,ren,portal,180'
  ]);
  const errorRows = lines([
    '10:01,ERROR,REN,portal,120',
    '10:02,ERROR,aki,portal,250',
    '10:04,ERROR,REN,api,300',
    '10:05,ERROR,Aki,portal,150',
    '10:06,ERROR,mei,portal,90',
    '10:08,ERROR,REN,portal,200',
    '10:09,ERROR,ren,portal,180'
  ]);
  const tags = 'ERROR first ERROR repeated\nWARN retry\nERROR last\n';
  const files = {
    [base + '/session.log']: session,
    [base + '/labels.log']: labels,
    [base + '/notes.txt']: notes,
    [base + '/peers.log']: 'peer=192.0.2.10 state=ok\npeer=192x0x2x10 state=ignore\npeer=192.0.2.11 state=ok\n',
    [base + '/archive/day1/app.log']: '08:00 INFO start\n08:01 ERROR upload\n08:02 INFO end\n',
    [base + '/archive/day1/readme.txt']: 'ERROR is an example label.\n',
    [base + '/archive/day2/app.log']: '09:00 INFO start\n09:01 INFO end\n',
    [base + '/archive/day2/proxy.log']: '09:00 INFO connect\n09:01 ERROR timeout\n',
    [base + '/metrics.csv']: metrics,
    [base + '/timings.csv']: 'q01,aki,9\nq02,ren,120\nq03,mei,30\nq04,aki,100\n',
    [base + '/names.txt']: 'REN\naki\nAki\nmei\nREN\nren\n',
    [base + '/spaces.txt']: '10:00   INFO   aki\n10:01     ERROR   ren\n10:02  WARN    mei\n',
    [base + '/repeated.txt']: 'ren\naki\nren\nmei\naki\nren\n',
    [base + '/table.csv']: 'user,status,ms\naki,OK,9\nren,FAIL,120\nmei,OK,30\n',
    [base + '/tags.txt']: tags,
    [base + '/annotated.txt']: '# collected at 10:00\n\naki OK\nren FAIL\n# end\n',
    [base + '/reports/.keep']: '',
    [base + '/reports/existing.txt']: '保存済みの記録\n',
    [base + '/trash/example.tmp']: '練習用の一時ファイル\n',
    [base + '/trash/draft.txt']: '削除する下書き\n',
    [base + '/trash/final.txt']: '残す完成版\n'
  };
  D.datasets['ap-workbench'] = { cwd: base, files };
  // A separate 400-line fixture makes read/limit/count tools useful without inflating every exercise.
  const volumeBase = base + '/volume';
  const volumeRows = Array.from({length:400}, (_, index) => {
    const n = index + 1, minute = String(Math.floor(index / 60)).padStart(2,'0'), second = String(index % 60).padStart(2,'0');
    return '2026-10-25T00:' + minute + ':' + second + 'Z ' + (n % 40 === 0 ? 'ERROR' : 'INFO') + ' gateway event=' + String(n).padStart(4,'0');
  });
  D.datasets['ap-volume'] = {cwd:volumeBase, files:{
    [volumeBase+'/server.log']:lines(volumeRows),
    [volumeBase+'/header.txt']:'LINUXROOM\nformat=text\n',
    [volumeBase+'/metrics.csv']:'time,level,count\n00:00,INFO,3\n00:01,ERROR,2\n00:02,INFO,4\n'
  }};
  D.datasets['ap-more'] = {cwd:base,files:{...files,[base+'/server.log']:lines(volumeRows)}};
  D.datasets['ap-fileinfo'] = {cwd:base, now:'2026-10-25T10:00:00Z', files:{
    [base+'/samples/payload.log']:'x'.repeat(2047)+'\n',
    [base+'/snapshots/a-old.log']:'INFO old\n',
    [base+'/snapshots/m-middle.log']:'WARN mid\n',
    [base+'/snapshots/z-new.log']:'INFO new\n'
  }, metadata:{
    [base+'/samples/payload.log']:{mtime:1792918800000},
    [base+'/snapshots/a-old.log']:{mtime:1792915200000},
    [base+'/snapshots/m-middle.log']:{mtime:1792918800000},
    [base+'/snapshots/z-new.log']:{mtime:1792920600000}
  }};
  const chapters = [
    ['ap-orient', '調べながら操作する', 'ヘルプ・履歴・画面の整理'],
    ['ap-read', '読み方を選ぶ', '逆順・閲覧・行番号'],
    ['ap-search', '検索条件を育てる', '固定文字 → 正規表現 → 前後の文脈'],
    ['ap-locate', '複数ファイルを探す', '本文検索・名前検索と順序の固定'],
    ['ap-fields', '列で選び、並べる', '条件・区切り・数値の順序'],
    ['ap-normalize', '表記をそろえる', '文字の変換 → 重複確認 → 表示'],
    ['ap-edit', '必要な部分を整える', 'sedで行の選択・置換・除外'],
    ['ap-workspace', '作業用ファイルを扱う', '書式・空ファイル・片付け'],
    ['ap-final', '応用実習：集計を組み立てる', '検索 → 列抽出 → 正規化 → 件数 → 保存']
  ];
  D.chapters.push(...chapters.map(([id, title, subtitle]) => ({ id, title, subtitle, level: 'applied' })));
  const out = (value, match = 'trim') => ({ type: 'output', value, match });
  const used = (command, options = {}) => ({ type: 'used', command, ...options });
  const source = (name, scope = 'last') => ({ type: 'source', path: base + '/' + name, scope });
  const saved = (name, value, match = 'trim') => ({ type: 'file', path: base + '/' + name, value, match });
  const pipe = minStages => ({ type: 'pipeline', minStages });
  const lessons = [];
  function lesson(item) {
    lessons.push({ level: 'applied', fixture: 'ap-workbench', minutes: 4, mode: 'practice', starter: '', newPart: '', ...item });
  }

  lesson({ id: 'ap-01-help', chapter: 'ap-orient', title: '対応するオプションを調べる', mode: 'guide', commands: ['help','whoami','id','seq'],
    goal: 'ヘルプで検索コマンドの指定方法を確かめられる。',
    explanation: ['応用編では、覚えているコマンドに条件を少しずつ加えます。暗記できなくても、調べながら使えれば大丈夫です。', 'help コマンド名で、この教材が対応している書き方を表示できます。これはLinuxroom・Logroomの独自案内です。一般のLinuxではmanや各コマンドの--helpなどを使います。この教材ではman grepもhelp grepと同じ簡易案内を表示しますが、実機のmanはマニュアル閲覧用です。'],
    concepts: [{ term: '対応構文', text: 'この学習用シェルで使える引数・オプションの組み合わせです。外部マニュアルの全機能があるわけではありません。' }],
    example: { command: 'whoami; id; seq 1 3; help head', note: 'ユーザー名・ID・1から3の連番を表示し、最後にheadの-nと-cを調べます。' },
    task: 'helpを使ってgrepの対応構文を表示し、-Fと-Eの説明を見つけてください。',
    hints: ['helpの後ろに、調べるコマンド名を置きます。', '今回はgrepの案内を表示します。', 'help grep と入力します。'],
    solution: ['help grep'], success: '知らないオプションを調べる入口ができました。', bridge: '次は、自分が入力したコマンドを振り返ります。',
    validation: { all: [used('help', { args: ['grep'] }), out('-F matches literal text.', 'contains')] }
  });
  lesson({ id: 'ap-02-history', chapter: 'ap-orient', title: '入力した手順を振り返る', commands: ['history'],
    goal: 'historyで入力履歴を確認できる。',
    explanation: ['historyは、この練習で入力したコマンドを番号付きで並べます。直前だけでなく、前に試した条件も振り返れます。', '履歴には失敗した入力も残ります。履歴にあることと、そのコマンドが成功したことは別です。↑キーで入力を呼び出して編集する操作も使えます。'],
    concepts: [{ term: '履歴', text: 'このセッションで入力したコマンドの記録です。新しい課題は別のセッションから始まります。' }],
    example: { command: 'echo sample', note: 'sampleと表示する入力を一つ残します。後からhistoryでこの入力も確認できます。' },
    task: 'echo ready を実行した後、historyで履歴を表示し、echo ready が含まれることを確かめてください。',
    hints: ['2回に分けて実行します。まずecho readyです。', 'そのあとhistoryだけを入力します。', 'echo ready を実行してから、history を実行します。'],
    solution: ['echo ready', 'history'], success: '操作の手順を振り返れました。長いパイプも履歴から直せます。', bridge: '履歴を残したまま画面を整理する操作も覚えましょう。',
    validation: { all: [used('echo', { args: ['ready'], scope: 'any' }), used('history'), out('echo ready', 'contains')] }
  });
  lesson({ id: 'ap-03-clear', chapter: 'ap-orient', title: '画面を整理して続ける', commands: ['clear'],
    goal: 'clearの効果と、ファイルや履歴が残ることを理解する。',
    explanation: ['clearは、ターミナルの表示を整理します。ファイルを消すコマンドではありません。現在地や入力履歴、課題の進捗も残ります。', '画面が長くなって読みにくいときに使えます。初期状態へ戻す「やり直し」とは効果が異なります。'],
    concepts: [{ term: '画面とデータ', text: '表示を消す操作と、保存されたファイルを消す操作は別です。' }],
    example: { command: 'cat notes.txt', note: '数行の記録を表示します。続く課題で画面だけ整理してみます。' },
    task: 'clearを実行して、ターミナルの表示を整理してください。notes.txtは残しておきます。',
    hints: ['表示だけを消すコマンドはclearです。', 'ファイル名は指定しません。', 'clear と入力します。'],
    solution: ['clear'], success: '表示を整理できました。ファイルも履歴も引き続き使えます。', bridge: '次は、本文の読み方を増やします。',
    validation: { all: [used('clear'), out('', 'exact'), saved('notes.txt', notes, 'exact')] }
  });

  lesson({ id: 'ap-04-tac', chapter: 'ap-read', title: '末尾側から逆順に読む', commands: ['tac', 'head'],
    goal: 'tacとheadをつなぎ、最後の記録から順に読める。',
    explanation: ['tacは、ファイルの行を逆順に表示します。文字そのものを逆にする操作ではありません。', 'session.logの各行は「時刻 種類 サーバー 出来事 利用者」です。時刻順に並べてあるので、tacで最後の時刻から読めます。'],
    concepts: [{ term: '行の逆順', text: '最後の行、最後から2行目…の順です。tailは末尾を取り出しますが、取り出した行の順序を維持します。' }],
    example: { command: 'tac notes.txt', note: 'finish、review、空行、startの順になります。' },
    starter: 'tail -n 3 session.log', newPart: 'tac | head', task: 'session.logの最後の3行を、最も後の時刻から順に表示してください。tacとheadを使います。',
    hints: ['tac session.logで全行を逆順にします。', 'その出力をhead -n 3に渡します。', 'tac session.log | head -n 3 と入力します。'],
    solution: ['tac session.log | head -n 3'], success: '並び順を変えてから、読む量を制限できました。', bridge: '次は別の閲覧コマンドで、読む画面から戻る練習です。',
    validation: { all: [used('tac'), used('head'), pipe(2), out('10:07 INFO api-2 session=end user=REN\n10:06 WARN api-2 retry user=REN\n10:05 ERROR api-2 failed user=REN')] }
  });
  lesson({ id: 'ap-05-more', chapter: 'ap-read', title: 'moreで開いて終了する', commands: ['more'], fixture:'ap-more', fixtureRevision:2, fixtureAdditions:[base+'/server.log'],
    goal: 'moreを使い、qでコマンド入力へ戻れる。',
    explanation: ['moreも長い本文を閲覧するためのコマンドです。実際のLinuxではlessと機能が異なりますが、この教材では両方ともスクロールできる閲覧画面を開きます。', 'server.logは400行の記録です。catで全体を出すと先頭が流れてしまいます。moreなら画面をスクロールしながら読み、本文を確認したらqで閉じます。開いている間は通常のコマンドを実行する状態ではありません。'],
    concepts: [{ term: 'more', text: '文章を少しずつ読むためのページャーです。この教材ではqで閉じる操作を練習します。' }],
    example: { command: 'cat /home/analyst/applied/server.log', note: '400行を一度に表示すると先頭が流れます。本文全体を読むときはmoreで開いてみましょう。' },
    task: 'moreで/home/analyst/applied/server.logを開き、確認後にqで閉じてください。',
    hints: ['moreの引数に/home/analyst/applied/server.logを指定します。', '開いただけで終わらず、qで戻ります。', 'more server.log を実行し、qで閉じます。'],
    solution: ['more /home/analyst/applied/server.log', 'q'], success: '別の閲覧コマンドでも、開く・読む・戻るを実行できました。', bridge: '次は、引用するときに便利な行番号を付けます。',
    validation: { all: [used('more', { scope: 'any' }), { type: 'pagerClosed' }, out(lines(volumeRows))] }
  });
  lesson({ id: 'ap-06-nl', chapter: 'ap-read', title: '空行にも行番号を付ける', commands: ['nl'],
    goal: 'nlで行番号の付け方を指定できる。',
    explanation: ['nlは本文に行番号を付けて表示します。初期設定では空行に番号を付けません。-baを付けると、空行を含む全行に番号を付けます。', '-wは番号欄の幅、-sは番号と本文の区切りです。元ファイルに番号を書き込む操作ではありません。'],
    concepts: [{ term: '-ba', text: 'body numberingをallにする指定です。空行も1行として番号を付けます。' }],
    example: { command: "nl -w 1 -s ': ' notes.txt", note: '空行は番号なしになり、reviewは2番になります。' },
    newPart: '-ba', task: 'notes.txtの全行に番号を付けてください。番号欄は幅1、区切りは「: 」とし、空行を2番にします。',
    hints: ['空行も数えるために-baを加えます。', "番号欄は-w 1、区切りは-s ': 'です。", "nl -ba -w 1 -s ': ' notes.txt と入力します。"],
    solution: ["nl -ba -w 1 -s ': ' notes.txt"], success: '本文の位置を、空行も含めて示せました。', bridge: '次は、似た文字列を取り違えない検索です。',
    validation: { all: [used('nl'), out('1: start\n2: \n3: review\n4: finish\n', 'exact'), saved('notes.txt', notes, 'exact')] }
  });

  lesson({ id: 'ap-07-grep-fixed', chapter: 'ap-search', title: 'ドットを文字として検索する', commands: ['grep'],
    goal: 'grep -Fで記号を含む文字列をそのまま検索できる。',
    explanation: ['grepの通常の検索では、.は「任意の1文字」という意味を持つ記号です。192.0.2.10をそのまま書くと、ドット以外の文字にも一致する場合があります。', '-Fは固定文字列の検索です。今回は説明用のIPアドレスが文字どおり一致する行を選びます。'],
    concepts: [{ term: '固定文字列', text: '記号も含め、指定した文字の並びをそのまま探す方法です。' }],
    example: { command: "grep -F 'peer=192.0.2.11' peers.log", note: 'ドットを含む指定どおりの1行だけが表示されます。' },
    newPart: '-F', task: 'grep -Fで、peers.logから peer=192.0.2.10 を含む行だけを表示してください。',
    hints: ['検索語の前に-Fを指定します。', '検索語を引用符で囲み、記号もそのまま書きます。', "grep -F 'peer=192.0.2.10' peers.log と入力します。"],
    solution: ["grep -F 'peer=192.0.2.10' peers.log"], success: '似ている別の文字列を選ばず、指定した表記を探せました。', bridge: '次は、意図的に記号の意味を使った検索をします。',
    validation: { all: [used('grep', { flags: 'F' }), out('peer=192.0.2.10 state=ok')] }
  });
  lesson({ id: 'ap-08-grep-alternation', chapter: 'ap-search', title: 'どちらかの語を含む行を選ぶ', commands: ['grep'],
    goal: 'grep -Eで複数の候補を一度に検索できる。',
    explanation: ['正規表現は、文字の並びの条件を表す書き方です。grep -Eでは、A|Bで「AまたはB」を表せます。', 'この|は引用符の内側なので、シェルのパイプではなく検索条件の一部です。labels.logは1行1件の短いメッセージです。'],
    concepts: [{ term: '選択（|）', text: '拡張正規表現で「どちらかに一致」を表します。検索語全体を引用符で囲みます。' }],
    example: { command: "grep -E 'INFO|DETAIL' labels.log", note: 'INFOかDETAILを含む2行を選びます。' },
    newPart: '-E と |', task: 'labels.logから、ERRORまたはWARNを含む4行を、grep -Eで一度に表示してください。',
    hints: ['候補の語を|でつなぎます。', "検索条件は'ERROR|WARN'です。", "grep -E 'ERROR|WARN' labels.log と入力します。"],
    solution: ["grep -E 'ERROR|WARN' labels.log"], success: '2つの候補を、一つの検索条件にできました。', bridge: '本文の途中にあるERRORを除くため、行の位置も条件にします。',
    validation: { all: [used('grep', { flags: 'E' }), out('ERROR disk-full\nWARN queue\nDETAIL previous ERROR\nERROR cache-miss')] }
  });
  lesson({ id: 'ap-09-grep-anchors', chapter: 'ap-search', title: '行頭と行末を条件にする', commands: ['grep'],
    goal: '^と$を使い、文字の位置を指定できる。',
    explanation: ['正規表現の^は行頭、$は行末を表します。^ERRORなら、文の途中のERRORは選びません。', '.*は「任意の文字が0文字以上」です。^ERROR.*full$なら、ERRORで始まりfullで終わる行を選べます。'],
    concepts: [{ term: 'アンカー', text: '文字そのものではなく、行頭や行末などの位置を指定する記号です。' }, { term: '.*', text: '.は任意の1文字、*は直前の要素の0回以上の繰り返しです。' }],
    example: { command: "grep -E '^WARN.*queue$' labels.log", note: 'WARNで始まりqueueで終わる行に一致します。' },
    task: 'labels.logから、ERRORで始まりfullで終わる行だけを表示してください。^と$を使います。',
    hints: ['始まりを^ERROR、終わりをfull$で指定します。', 'その間を.*でつなぎます。', "grep -E '^ERROR.*full$' labels.log と入力します。"],
    solution: ["grep -E '^ERROR.*full$' labels.log"], success: '語の有無に加えて、行内の位置も条件にできました。', bridge: '見つけた行の前後を読むと、記録の流れを確認できます。',
    validation: { all: [used('grep', { flags: 'E' }), out('ERROR disk-full')] }
  });
  lesson({ id: 'ap-10-grep-before-after', chapter: 'ap-search', title: '一致行の後と前を別々に読む', commands: ['grep'],
    goal: 'grep -Aと-Bの方向を区別できる。',
    explanation: ['-AはAfterで一致行の後、-BはBeforeで一致行の前を追加表示します。後ろの数字が追加する行数です。', '検索条件そのものに一致しない行も、周辺の記録として表示されます。これを文脈（context）と呼びます。'],
    concepts: [{ term: '-A / -B', text: '-A 1は一致行と次の1行、-B 1は前の1行と一致行です。' }],
    example: { command: "grep -A 1 '10:05' session.log", note: '10:05のERRORと、その後の10:06のWARNが表示されます。' },
    task: 'session.logの10:02を検索し、まず-A 1で後の1行を表示してください。次に-B 1へ変更し、前の1行を表示してください。',
    hints: ['最初はgrep -A 1で10:02を探します。', '2回目は-Aを-Bへ変更します。最後の表示は10:01と10:02です。', "grep -A 1 '10:02' session.log の後、grep -B 1 '10:02' session.log を実行します。"],
    solution: ["grep -A 1 '10:02' session.log", "grep -B 1 '10:02' session.log"], success: '前後の方向を区別して、近くの行を確認できました。', bridge: '次は前後をまとめて表示し、元の行番号も添えます。',
    validation: { all: [used('grep', { flags: 'A', args: ['10:02'], scope: 'any' }), used('grep', { flags: 'B', args: ['10:02'] }), out('10:01 WARN api-1 retry user=AKI\n10:02 ERROR api-1 failed user=AKI')] }
  });
  lesson({ id: 'ap-11-grep-context', chapter: 'ap-search', title: '前後の文脈に行番号を添える', commands: ['grep'],
    goal: 'grep -n -Cで引用できる範囲を表示できる。',
    explanation: ['-CはContextで、前と後の両側を同じ行数だけ追加します。-nと組み合わせると、元ファイルの位置も確認できます。', '行番号の後が:なら一致行、-なら周辺行です。一致した行と、参考として添えた行を区別できます。'],
    concepts: [{ term: '-C 1', text: '一致行の前後1行ずつを追加します。ファイルの端では存在する行だけを表示します。' }],
    example: { command: "grep -n -C 1 '10:05' session.log", note: '5-、6:、7-と表示され、6行目が検索に一致したことを確認できます。' },
    starter: "grep -B 1 '10:02' session.log", newPart: '-n -C 1', task: '10:02の前後1行ずつを、元の行番号を付けて表示してください。',
    hints: ['-Bを-Cへ変えると両側を指定できます。', '行番号の-nも付けます。', "grep -n -C 1 '10:02' session.log と入力します。"],
    solution: ["grep -n -C 1 '10:02' session.log"], success: '一致行と周辺行を、位置が分かる形で抜き出せました。', bridge: '同じ検索を、フォルダ内の複数ファイルへ広げます。',
    validation: { all: [used('grep', { flags: 'nC' }), out('2-10:01 WARN api-1 retry user=AKI\n3:10:02 ERROR api-1 failed user=AKI\n4-10:03 INFO api-1 session=end user=AKI')] }
  });

  lesson({ id: 'ap-12-grep-recursive', chapter: 'ap-locate', title: '条件に合うファイル名を集める', commands: ['grep', 'sort'],
    goal: 'grepの再帰検索と対象ファイル指定を組み合わせられる。',
    explanation: ['-rはディレクトリの下までたどる再帰検索、-lは一致する行があるファイルの名前だけを表示する指定です。実機の探索順は名前順とは限りません。最後に| sortで表示順を固定します。', "--include '*.log'は、末尾が.logのファイルに対象を絞ります。引用符で囲むと、*をgrepへそのまま渡せます。引用符がないとシェルが先に現在地の名前へ展開する場合があります。"],
    // Directory traversal order varies on real systems; explicitly sort the displayed result.
    concepts: [{ term: 'グロブ', text: '*.logのようなファイル名のパターン。*は任意の文字列です。正規表現とは書き方や用途が異なります。' }],
    example: { command: "grep -rl --include '*.txt' 'ERROR' archive", note: '説明文にERRORを含むreadme.txtだけが対象になります。' },
    task: '最後にsortで名前順にそろえてください。archive以下を再帰的に調べ、ERRORを含む.logファイルの名前だけを表示してください。',
    hints: ['本文ではなく名前を表示する-lと、下まで探す-rを組み合わせます。', "--include '*.log'で対象を絞ります。", "grep -rl --include '*.log' 'ERROR' archive | sort と入力します。"],
    solution: ["grep -rl --include '*.log' 'ERROR' archive | sort"], success: '内容とファイル名の両方の条件で、対象を探せました。', bridge: '同じ探索に使えるrgの基本を試します。',
    validation: { all: [used('sort'), used('grep', { flags: 'rl' }), out('archive/day1/app.log\narchive/day2/proxy.log')] }
  });
  lesson({ id: 'ap-13-rg', chapter: 'ap-locate', title: 'rgで行番号付きの検索をする', commands: ['rg'],
    goal: 'rgの検索語・対象・行番号指定を使える。',
    explanation: ['rg（ripgrep）も文字列を検索するコマンドです。-nで行番号を表示でき、基本の入力の形はgrepと似ています。', 'rgは通常、拡張正規表現を使います。文字をそのまま探したいときは-Fを指定できます。実際のLinux環境によっては別途インストールが必要です。'],
    concepts: [{ term: 'rg', text: 'ファイルやディレクトリの本文を探す検索ツールです。この教材ではLogroomと同じ範囲の機能を使えます。' }],
    example: { command: "rg -n 'INFO' archive/day1/app.log", note: '1行目と3行目が表示されます。' },
    task: 'rgを使い、archive/day1/app.logのERRORを含む行を、行番号付きで表示してください。',
    hints: ['コマンド名をrgにし、-nを付けます。', '検索語はERROR、対象はarchive/day1/app.logです。', "rg -n 'ERROR' archive/day1/app.log と入力します。"],
    solution: ["rg -n 'ERROR' archive/day1/app.log"], success: 'rgの基本形で、一致する行と位置を表示できました。', bridge: '次はrgの対象をディレクトリへ広げます。',
    validation: { all: [used('rg', { flags: 'n' }), out('2:08:01 ERROR upload')] }
  });
  lesson({ id: 'ap-14-rg-glob', chapter: 'ap-locate', title: 'rgで対象ファイルを絞る', commands: ['rg', 'sort'],
    goal: 'rgの-gでファイル名の条件を付けて再帰検索できる。',
    explanation: ['rgにディレクトリを渡すと、その下も検索します。-gでファイル名のグロブを指定できます。複数ファイルの探索順に依存しないよう、今回は最後にsortでそろえます。', "-g '*.log'なら.logだけを検索します。このデータにはERRORという語を説明する.txtもあるため、対象を絞ると本文の記録だけを取り出せます。"],
    // Directory traversal order varies on real systems; explicitly sort the displayed result.
    concepts: [{ term: '-g', text: '検索対象をファイル名などのパターンで制限します。パターンは引用符で囲んでrgへ渡します。' }],
    example: { command: "rg -g '*.txt' 'ERROR' archive", note: 'readme.txtの説明文だけが見つかります。' },
    starter: "rg -n 'ERROR' archive/day1/app.log", newPart: "-g '*.log' archive", task: 'archive以下の.logファイルだけをrgで調べ、ERRORの行をファイル名付きで表示してください。行番号は不要です。',
    hints: ['対象をファイルからarchiveディレクトリへ変えます。', "-g '*.log'を加えます。", "rg -g '*.log' 'ERROR' archive | sort と入力します。"],
    solution: ["rg -g '*.log' 'ERROR' archive | sort"], success: '複数の記録から、出所が分かる形で行を集められました。', bridge: '次は本文ではなく、ファイルの存在そのものを調べます。',
    validation: { all: [used('sort'), used('rg', { args: ['-g', '*.log'] }), out('archive/day1/app.log:08:01 ERROR upload\narchive/day2/proxy.log:09:01 ERROR timeout')] }
  });
  lesson({ id: 'ap-15-find', chapter: 'ap-locate', title: '本文を読まずにファイルを探す', commands: ['find', 'sort'],
    goal: 'findで種類と名前を条件にしてファイルを探せる。',
    explanation: ['findはパスをたどり、名前や種類などの条件でファイルを探します。grepやrgと異なり、今回の条件では本文を読みません。実機の走査順は保証されないので、比較・提出用の一覧は| sortで順序を固定します。', "-type fは通常のファイル、-name '*.log'は.logで終わる名前を指定します。*はfindに判断させるので引用符で囲みます。"],
    // Directory traversal order varies on real systems; explicitly sort the displayed result.
    concepts: [{ term: '-type f', text: 'ディレクトリではなくファイルを対象にする指定です。-type dならディレクトリです。' }],
    example: { command: "find archive -type f -name '*.txt'", note: '本文の内容に関係なく、.txtファイルのパスを表示します。' },
    task: '最後にsortで名前順にそろえてください。findでarchive以下の.logファイルをすべて表示してください。ERRORがないファイルも含めます。',
    hints: ['探し始める場所はarchiveです。', "-type fと-name '*.log'を付けます。", "find archive -type f -name '*.log' | sort と入力します。"],
    solution: ["find archive -type f -name '*.log' | sort"], success: '検索で一致しなかったファイルも含めて、対象一覧を作れました。', bridge: '次は見つけた記録を、列の値で絞ります。',
    validation: { all: [used('sort'), used('find'), out('archive/day1/app.log\narchive/day2/app.log\narchive/day2/proxy.log')] }
  });

  lesson({ id: 'ap-16-awk-condition', chapter: 'ap-fields', title: '列が一致した行から値を取る', commands: ['awk'],
    goal: 'awkの条件とprintを組み合わせられる。',
    explanation: ['awkは、条件に合う行だけで処理を実行できます。$2 == "ERROR"は「2列目がERRORと同じ」という条件です。', '条件の後ろの{print $3}は、条件に合った行の3列目を表示します。session.logは空白区切りで、2列目が種類、3列目がサーバーです。'],
    concepts: [{ term: '==', text: '左右が等しいか比較する記号です。文字列はawkプログラムの中で二重引用符で囲みます。' }],
    example: { command: "awk '$2 == \"INFO\" {print $3}' session.log", note: 'INFOの4行からサーバー名だけを取り出します。' },
    task: 'awkを使い、session.logの2列目がERRORの行から、3列目のサーバー名を表示してください。',
    hints: ['条件は$2 == "ERROR"です。', '取り出す列は{print $3}で指定します。', "awk '$2 == \"ERROR\" {print $3}' session.log と入力します。"],
    solution: ["awk '$2 == \"ERROR\" {print $3}' session.log"], success: '行の選択と列の取り出しを、一つのawkで実行できました。', bridge: '空白以外を区切りにするデータへ進みます。',
    validation: { all: [used('awk'), source('session.log'), out('api-1\napi-2')] }
  });
  lesson({ id: 'ap-17-awk-separator', chapter: 'ap-fields', title: 'カンマ区切りの列を取り出す', commands: ['awk'],
    goal: 'awk -Fで区切りを変え、見出しを除いて列を取れる。',
    explanation: ['metrics.csvは「時刻,種類,利用者,サービス,処理時間」の順です。処理時間の単位はミリ秒で、1行目は見出しです。', '-Fで区切りを変えられます。NRは読んだ行の番号なので、NR > 1を条件にすると見出しを除けます。今回は引用符内にカンマを含まない単純なCSVです。一般の複雑なCSVをawkだけで解析する練習ではありません。'],
    concepts: [{ term: '-F', text: 'フィールドの区切りを指定します。今回はカンマです。' }, { term: 'NR', text: 'ここまでに読んだ行の数です。1ファイルなら先頭からの行番号になります。' }],
    example: { command: "awk -F ',' 'NR > 1 {print $4}' metrics.csv", note: '見出しを除き、4列目のサービス名を取り出します。' },
    task: 'metrics.csvの見出しを除き、3列目の利用者名を順番どおり表示してください。',
    hints: ['-Fでカンマを区切りにします。', 'NR > 1で2行目以降を選び、$3を表示します。', "awk -F ',' 'NR > 1 {print $3}' metrics.csv と入力します。"],
    solution: ["awk -F ',' 'NR > 1 {print $3}' metrics.csv"], success: '区切りと見出しを意識して、必要な列を取り出せました。', bridge: '次は複数の列を条件にします。',
    validation: { all: [used('awk'), source('metrics.csv'), out('Aki\nREN\naki\nMei\nREN\nAki\nmei\nRen\nREN\nren')] }
  });
  lesson({ id: 'ap-18-awk-combined', chapter: 'ap-fields', title: '文字と数値の条件を組み合わせる', commands: ['awk'],
    goal: 'awkの&&と数値比較で条件を重ねられる。',
    explanation: ['&&は「両方の条件を満たす」という意味です。$4 == "portal" && $5 >= 150なら、portalかつ処理時間150ミリ秒以上の行を選べます。', 'printの後で列をカンマ区切りにすると、複数の値を標準の空白区切りで表示します。入力のカンマと、printの列指定のカンマは役割が違います。'],
    concepts: [{ term: '&&', text: '左と右の条件がどちらも成立する行を選びます。awkの引用符の内側に書きます。' }, { term: '>=', text: '以上を表す比較です。150も条件に含まれます。' }],
    example: { command: "awk -F ',' '$4 == \"portal\" && $5 < 50 {print $1, $3, $5}' metrics.csv", note: 'portalで50ミリ秒未満の2行から、時刻・利用者・処理時間を表示します。' },
    task: 'portalかつ処理時間150ミリ秒以上の行から、時刻・利用者・処理時間を空白区切りで表示してください。',
    hints: ['サービスは4列目、処理時間は5列目です。', '$4 == "portal"と$5 >= 150を&&でつなぎます。', "awk -F ',' '$4 == \"portal\" && $5 >= 150 {print $1, $3, $5}' metrics.csv と入力します。"],
    solution: ["awk -F ',' '$4 == \"portal\" && $5 >= 150 {print $1, $3, $5}' metrics.csv"], success: '列の値を見ながら、必要な範囲を正確に絞れました。', bridge: '数値の大きい順に並べて、読みやすくします。',
    validation: { all: [used('awk'), source('metrics.csv'), out('10:02 aki 250\n10:05 Aki 150\n10:08 REN 200\n10:09 ren 180')] }
  });
  lesson({ id: 'ap-19-sort-key', chapter: 'ap-fields', title: '指定した列の数値で並べる', commands: ['sort'],
    goal: 'sort -tと-kを使い、先頭以外の列を数値順にできる。',
    explanation: ['timings.csvは見出しなしで「リクエスト番号,利用者,処理時間」の順です。通常のsortでは先頭から文字として比べます。', "-t ','でカンマ区切り、-k3,3で比較する範囲を3列目だけに指定します。キーの後ろのnは数値、rは逆順なので、-k3,3nrで処理時間の大きい順になります。"],
    concepts: [{ term: 'ソートキー', text: '並べ替えるときに比べる列や範囲です。-k3,3は3列目から3列目までです。' }],
    example: { command: "sort -t ',' -k3,3n timings.csv", note: '9、30、100、120の数値が小さい順になります。' },
    newPart: '-k3,3nr', task: 'timings.csvを、3列目の処理時間が大きい順に並べて表示してください。',
    hints: ['区切り文字は-tで指定します。', '3列目を数値の逆順にする指定は-k3,3nrです。', "sort -t ',' -k3,3nr timings.csv と入力します。"],
    solution: ["sort -t ',' -k3,3nr timings.csv"], success: '先頭のIDに引っ張られず、必要な数値の順にできました。', bridge: '集計の前に表記の違いをそろえる練習です。',
    validation: { all: [used('sort'), source('timings.csv'), out('q02,ren,120\nq04,aki,100\nq03,mei,30\nq01,aki,9')] }
  });

  lesson({ id: 'ap-20-tr-case', chapter: 'ap-normalize', title: '利用者名の大小文字をそろえる', commands: ['tr'],
    goal: '標準入力をtrへ渡して文字を変換できる。',
    explanation: ['trは標準入力の文字を変換します。ファイルの本文は< names.txtで標準入力へ渡せます。cat names.txt | tr ...も同じ入力になります。trにファイル名を通常の引数として渡す書き方ではありません。', "'[:upper:]'は大文字の集合、'[:lower:]'は小文字の集合です。ここでは利用者名の大小文字を同じ人として扱うという、このデータのルールに従って正規化します。"],
    concepts: [{ term: '正規化', text: '比較や集計のために表記をそろえることです。大文字小文字が別の意味を持つデータには、同じ変換を無条件で使いません。' }],
    example: { command: "echo 'Aki REN' | tr '[:lower:]' '[:upper:]'", note: '反対向きの変換例です。AKI RENになります。' },
    task: 'names.txtをtrへ渡し、利用者名をすべて小文字にしてください。元ファイルは変更しません。',
    hints: ['trに< names.txtで本文を渡します。catからパイプで渡しても構いません。', "大文字の集合から小文字の集合へ変換します。", "cat names.txt | tr '[:upper:]' '[:lower:]' と入力します。"],
    solution: ["tr '[:upper:]' '[:lower:]' < names.txt"], success: 'RENとren、Akiとakiを同じ表記にそろえられました。', bridge: '次は余分な空白を整えます。',
    validation: { all: [used('tr'), source('names.txt'), out('ren\naki\naki\nmei\nren\nren')] }
  });
  lesson({ id: 'ap-21-tr-squeeze', chapter: 'ap-normalize', title: '連続する空白を一つにする', commands: ['tr', 'cut'],
    goal: 'tr -sで連続する文字をまとめ、次の処理へ渡せる。',
    explanation: ['spaces.txtは「時刻 種類 利用者」ですが、列の間の半角スペースの数が不ぞろいです。cut -dで指定する区切りは1文字なので、そのままでは空の列が数えられます。', "tr -s ' 'は、連続する半角スペースを一つにまとめます。整えた後ならcut -d ' ' -f 3で利用者名を取り出せます。"],
    concepts: [{ term: '-s', text: 'squeeze。指定した文字が連続しているとき、一つへまとめます。ここでは改行は変えません。' }],
    example: { command: "echo 'one    two' | tr -s ' '", note: 'oneとtwoの間が1個のスペースになります。' },
    task: 'spaces.txtの連続する半角スペースをtr -sでまとめ、3列目の利用者名を表示してください。列の抽出はcutやawkでできます。',
    hints: ['tr -sへ< spaces.txtでファイルを入力します。catからのパイプでも構いません。', "最後にcut -d ' ' -f 3を追加します。", "cat spaces.txt | tr -s ' ' | cut -d ' ' -f 3 と入力します。"],
    solution: ["tr -s ' ' < spaces.txt | cut -d ' ' -f 3"], success: '次のコマンドが扱いやすい形へ、入力を整えられました。', bridge: 'そろえた値で、繰り返し現れる名前を探します。',
    validation: { all: [used('tr', { flags: 's' }), source('spaces.txt'), out('aki\nren\nmei')] }
  });
  lesson({ id: 'ap-22-uniq-duplicates', chapter: 'ap-normalize', title: '繰り返し出る値だけを残す', commands: ['sort', 'uniq'],
    goal: 'sortとuniq -dで、複数回現れる値を一覧にできる。',
    explanation: ['uniq -dは、連続して同じ行が複数あるとき、その値を1回だけ表示します。件数を出す-cとは目的が異なります。', 'repeated.txtでは同じ名前が離れて現れます。先にsortで同じ名前を隣り合わせにしてからuniq -dを使います。'],
    concepts: [{ term: '-d', text: '繰り返しがある値だけを表示します。2回以上現れる値でも、表示は1行です。' }],
    example: { command: 'sort repeated.txt | uniq -u', note: '-uは反対に、1回だけの値を表示します。今回の例ではmeiです。' },
    starter: 'sort repeated.txt', newPart: '| uniq -d', task: 'repeated.txtで2回以上出る利用者名だけを、名前順に1回ずつ表示してください。',
    hints: ['最初にsortで同じ名前を集めます。', '件数の-cではなく、繰り返しだけの-dを付けます。', 'sort repeated.txt | uniq -d と入力します。'],
    solution: ['sort repeated.txt | uniq -d'], success: '一度しか現れない値を除き、繰り返しのある値だけにできました。', bridge: '結果を人が読みやすい表にもしてみます。',
    validation: { all: [used('sort'), used('uniq', { flags: 'd' }), pipe(2), out('aki\nren')] }
  });
  lesson({ id: 'ap-23-column', chapter: 'ap-normalize', title: '列の幅をそろえて読む', commands: ['column'],
    goal: 'columnで区切りのあるテキストを見やすく表示できる。',
    explanation: ['column -tは、各列の幅をそろえた表示を作ります。-sで入力の区切り文字を指定できます。', 'table.csvは「利用者,結果,処理時間」の3列です。この教材は単純な区切り形式を扱います。引用符で囲んだ値の中にカンマがある一般的なCSVには、この方法をそのまま使えません。'],
    concepts: [{ term: '整形', text: '内容を読める形へ整えることです。表示のために加えた空白を、元の生データの区切りと混同しないようにします。' }],
    example: { command: 'column -t spaces.txt', note: '空白区切りの各列をそろえます。' },
    task: 'column -tを使い、table.csvをカンマで区切って、見出しを含む表として表示してください。',
    hints: ['表の表示は-tです。', "入力のカンマを-s ','で指定します。", "column -t -s ',' table.csv と入力します。"],
    solution: ["column -t -s ',' table.csv"], success: '値を変えずに、列の対応を読み取りやすくできました。', bridge: '次はsedで、表示する行や語を整えます。',
    validation: { all: [used('column'), source('table.csv'), out('user status ms\naki OK 9\nren FAIL 120\nmei OK 30', 'lines')] }
  });

  lesson({ id: 'ap-24-sed-range', chapter: 'ap-edit', title: '行番号の範囲を抜き出す', commands: ['sed'],
    goal: 'sed -nと範囲pで、途中の連続する行を表示できる。',
    explanation: ['sedは行単位で選択や置換をするコマンドです。通常は各行を自動表示するので、指定した行だけを表示するときは-nを使います。', "'2,4p'は「2行目から4行目までをprintする」という指定です。元のファイルは書き換えません。"],
    concepts: [{ term: 'アドレスと処理', text: '2,4が対象範囲、pが表示処理です。-nでその他の自動表示を止めます。' }],
    example: { command: "sed -n '5,6p' session.log", note: '途中の5行目と6行目だけを表示します。' },
    task: 'sedを使い、session.logの2行目から4行目だけを表示してください。',
    hints: ['自動表示を止める-nを付けます。', '範囲は2,4、処理はpです。', "sed -n '2,4p' session.log と入力します。"],
    solution: ["sed -n '2,4p' session.log"], success: '先頭や末尾に限らず、途中の範囲を抜き出せました。', bridge: '次は本文の中の語を置き換えます。',
    validation: { all: [used('sed'), source('session.log'), out('10:01 WARN api-1 retry user=AKI\n10:02 ERROR api-1 failed user=AKI\n10:03 INFO api-1 session=end user=AKI')] }
  });
  lesson({ id: 'ap-25-sed-substitute', chapter: 'ap-edit', title: '各行の語をすべて置き換える', commands: ['sed'],
    goal: 'sedのsとgで、同じ行の複数の一致を置換できる。',
    explanation: ['s/元の語/置換後/は文字を置き換える指定です。末尾のgを付けると、各行にあるすべての一致を置き換えます。', 'gがないと各行の最初の一致だけを置き換えます。ここでは画面へ加工結果を出すだけで、元のtags.txtは変更しません。'],
    concepts: [{ term: 'g', text: 'global。各行で最初の一致だけでなく、すべての一致へ置換を適用します。' }],
    example: { command: "sed 's/ERROR/ERR/' tags.txt", note: '1行目にはERRORが2回ありますが、最初だけがERRになります。' },
    newPart: 's/ERROR/FAIL/g', task: 'tags.txtのERRORをすべてFAILへ置き換えて表示してください。同じ行の2回目も置換し、元ファイルは保ちます。',
    hints: ['s/ERROR/FAIL/で置換先を指定します。', '最後にgを加えて、各行の全一致を置き換えます。', "sed 's/ERROR/FAIL/g' tags.txt と入力します。"],
    solution: ["sed 's/ERROR/FAIL/g' tags.txt"], success: '置換の範囲を意識して、表示用のコピーを加工できました。', bridge: '次はコメントや空行を除き、集計しやすくします。',
    validation: { all: [used('sed'), out('FAIL first FAIL repeated\nWARN retry\nFAIL last'), saved('tags.txt', tags, 'exact')] }
  });
  lesson({ id: 'ap-26-sed-delete', chapter: 'ap-edit', title: 'コメントと空行を取り除く', commands: ['sed'],
    goal: 'sedで複数の除外処理を順に適用できる。',
    explanation: ['sedのdは、その行を出力から除く処理です。/^#/dは#で始まる行、/^$/dは何も文字がない行を除きます。', '-eを繰り返すと、複数の処理を順に指定できます。annotated.txtは#で始まる説明と空行、それ以外に「利用者 結果」の行があります。'],
    concepts: [{ term: '^$', text: '行頭の直後が行末、つまり空行です。スペースだけがある行とは異なります。' }, { term: '-e', text: '実行するsedの処理を一つ指定します。繰り返して複数の処理を書けます。' }],
    example: { command: "sed '/^#/d' annotated.txt", note: 'コメントは除かれますが、空行は残ります。' },
    starter: "sed '/^#/d' annotated.txt", newPart: "-e '/^$/d'", task: 'annotated.txtから#で始まるコメントと空行を除き、利用者と結果の2行だけを表示してください。',
    hints: ['1つ目の処理は/^#/dです。', '2つ目の処理/^$/dも-eで指定します。', "sed -e '/^#/d' -e '/^$/d' annotated.txt と入力します。"],
    solution: ["sed -e '/^#/d' -e '/^$/d' annotated.txt"], success: '集計対象ではない行を、明示した条件で除けました。', bridge: '記録を保存するための作業用ファイルを扱います。',
    validation: { all: [used('sed'), source('annotated.txt'), out('aki OK\nren FAIL\n', 'exact')] }
  });

  lesson({ id: 'ap-27-printf', chapter: 'ap-workspace', title: '書式を指定して要約を書く', commands: ['printf'],
    goal: 'printfで文字列・整数・改行を指定して出力できる。',
    explanation: ['printfは書式と値を分けて出力するコマンドです。%sは文字列、%dは整数の入る場所です。', 'echoと異なり、自動では末尾に改行しません。書式内の\\nが改行を表します。数値の結果を短い報告行へ整えるときに使えます。'],
    concepts: [{ term: '書式', text: '出力のひな形です。%sや%dの場所へ、後ろの引数を順に入れます。' }],
    example: { command: "printf 'user=%s count=%d\\n' aki 2", note: 'user=aki count=2と、末尾の改行を表示します。' },
    task: 'printfを使い、user=ren count=3 と表示してください。%sと%dを使い、最後に改行を入れます。',
    hints: ['書式の%sへren、%dへ3を渡します。', '書式の最後は\\nです。引用符の内側に書きます。', "printf 'user=%s count=%d\\n' ren 3 と入力します。"],
    solution: ["printf 'user=%s count=%d\\n' ren 3"], success: '値を指定した形に当てはめ、改行も含めて出力できました。', bridge: '次は本文が空の作業ファイルを用意します。',
    validation: { all: [used('printf', { args: ['user=%s count=%d\\n', 'ren', '3'] }), out('user=ren count=3\n', 'exact')] }
  });
  lesson({ id: 'ap-28-touch', chapter: 'ap-workspace', title: '空のファイルを用意する', commands: ['touch'],
    goal: 'touchで新しい空ファイルを作れる。',
    explanation: ['touchは、まだない名前なら空のファイルを作れます。親ディレクトリは先に存在している必要があります。今回はreportsが用意されています。', '実際のLinuxでは既存ファイルの時刻を更新する用途もあります。この教材でも既存ファイルの更新時刻が変わり、本文はそのまま残ります。'],
    concepts: [{ term: '空ファイル', text: '名前はありますが、本文の文字数が0のファイルです。ディレクトリとは別のものです。' }],
    example: { command: 'touch reports/example.txt', note: '例用の空ファイルを作ります。既存のreports/existing.txtには触れません。' },
    task: 'touchでreports/check.txtという空ファイルを作成してください。',
    hints: ['touchの後ろに、新しいファイルのパスを書きます。', 'reportsディレクトリは作成済みです。', 'touch reports/check.txt と入力します。'],
    solution: ['touch reports/check.txt'], success: '作業用ファイルを、本文を入れる前に用意できました。', bridge: '不要になった一時ファイルの削除を練習します。',
    validation: { all: [used('touch'), saved('reports/check.txt', '', 'exact'), saved('reports/existing.txt', '保存済みの記録\n', 'exact')] }
  });
  lesson({ id: 'ap-29-rm', chapter: 'ap-workspace', title: '指定した下書きだけを片付ける', commands: ['rm'],
    goal: '削除対象を指定し、残すファイルを保てる。',
    explanation: ['rmは指定したファイルを削除します。内容を確認してから、必要な名前だけを指定します。この練習の操作は仮想ファイルだけに作用します。', 'trashにはdraft.txtという下書きとfinal.txtという完成版があります。広いワイルドカードではなく、下書きの名前を指定して片付けます。'],
    concepts: [{ term: '削除対象', text: 'rmに渡したファイルが消えます。実際のLinuxでは通常、ゴミ箱には移動しません。' }],
    example: { command: 'rm trash/example.tmp', note: '例専用の一時ファイル1個だけを削除します。' },
    task: 'trash/draft.txtだけをrmで削除してください。trash/final.txtは内容ごと残します。',
    hints: ['削除する名前を1個だけ指定します。', '完成版final.txtは引数に入れません。', 'rm trash/draft.txt と入力します。'],
    solution: ['rm trash/draft.txt'], success: '残すものを保ちながら、指定の下書きだけを片付けられました。', bridge: 'ファイルがない空ディレクトリには、別のコマンドを使います。',
    validation: { all: [used('rm'), { type: 'absent', path: base + '/trash/draft.txt' }, saved('trash/final.txt', '残す完成版\n', 'exact')] }
  });
  lesson({ id: 'ap-30-rmdir', chapter: 'ap-workspace', title: '空の作業ディレクトリを片付ける', commands: ['rmdir', 'mkdir'],
    goal: 'rmdirが空のディレクトリを対象とすることを理解する。',
    explanation: ['rmdirは空のディレクトリを削除します。ファイルが残っているディレクトリは削除できません。', 'ここでは作業用の空ディレクトリをmkdirで作り、使わなかったものとしてrmdirで削除します。reports本体には記録が入っているので残します。'],
    concepts: [{ term: '空のディレクトリ', text: '中にファイルも子ディレクトリもない場所です。隠しファイルも中身に含まれます。' }],
    example: { command: 'mkdir reports/example-empty && rmdir reports/example-empty', note: '例用の空ディレクトリを作成後、削除します。&&は最初が成功したときだけ次を実行する接続です。' },
    task: 'mkdirでreports/emptyを作り、rmdirで削除してください。reportsと既存の記録は残します。',
    hints: ['最初にmkdir reports/emptyを実行します。', '次に同じパスをrmdirへ渡します。', 'mkdir reports/empty の後、rmdir reports/empty を実行します。'],
    solution: ['mkdir reports/empty', 'rmdir reports/empty'], success: 'ファイルと空ディレクトリの片付けを使い分けられました。', bridge: '最後は、同じ記録を材料にパイプを一段ずつ完成させます。',
    validation: { all: [used('mkdir', { args: ['reports/empty'], scope: 'any' }), used('rmdir'), { type: 'absent', path: base + '/reports/empty' }, { type: 'directory', path: base + '/reports' }, saved('reports/existing.txt', '保存済みの記録\n', 'exact')] }
  });

  const filter = "grep -F ',ERROR,' metrics.csv";
  const extract = filter + " | awk -F ',' '$4 == \"portal\" {print $3}'";
  const normalize = extract + " | tr '[:upper:]' '[:lower:]'";
  const count = normalize + ' | sort | uniq -c';
  const rank = count + ' | sort -nr';
  lesson({ id: 'ap-31-flow-filter', chapter: 'ap-final', title: '実習1：対象の種類を選ぶ', mode: 'guide', commands: ['grep'],
    goal: '集計の出発点として、記録の種類を正確に選べる。',
    explanation: ['これから6問で、portalサービスのERROR件数を利用者別に集計します。各問のファイルは独立していますが、同じコマンドを一段ずつ伸ばします。', 'metrics.csvの列は「時刻,種類,利用者,サービス,処理時間」です。まず前後のカンマも含む,ERROR,を固定文字列で探し、種類がERRORの7行を選びます。まだ他のサービスも含まれます。'],
    concepts: [{ term: '段階ごとの確認', text: '一度に完成形を書かず、各段階で意図した行や列になったか確かめます。' }],
    example: { command: "grep -F ',WARN,' metrics.csv", note: '種類がWARNの1行を選びます。見出しは一致しません。' },
    starter: 'cat metrics.csv', newPart: "grep -F ',ERROR,'", task: 'metrics.csvから、種類がERRORの7行をgrep -Fで表示してください。',
    hints: ['検索語の前後にカンマを含めます。', '固定文字列検索の-Fを付けます。', filter + ' と入力します。'],
    solution: [filter], success: '集計の入力を、ERRORの記録へ絞れました。', bridge: '次の段階では、サービスを選んで利用者名だけを取り出します。',
    validation: { all: [used('grep', { flags: 'F' }), source('metrics.csv'), out(errorRows)] }
  });
  lesson({ id: 'ap-32-flow-extract', chapter: 'ap-final', title: '実習2：サービスを選び、名前を取る', commands: ['grep', 'awk'],
    goal: '検索結果に列の条件を重ね、集計する値を取り出せる。',
    explanation: ['前の検索結果にはportalとapiの記録が混ざっています。4列目がportalの行だけを残し、3列目の利用者名を取り出します。', 'grepで行を減らしても、残った行の列番号は変わりません。awkに-Fでカンマ区切りを伝えます。'],
    concepts: [{ term: '行の抽出と列の抽出', text: 'どの記録を残すか選んでから、各記録のどの値を使うか選びます。' }],
    example: { command: filter + " | awk -F ',' '$4 == \"api\" {print $3}'", note: 'apiサービスのERROR記録からRENだけを取り出す例です。' },
    starter: filter, newPart: "| awk -F ',' '$4 == \"portal\" {print $3}'", task: '前のgrepにawkをつなぎ、portalサービスの利用者名6行だけを表示してください。',
    hints: ['4列目がportalという条件を付けます。', '表示するのは3列目の$3です。', extract + ' と入力します。'],
    solution: [extract], success: '集計したいサービスの、集計したい列だけになりました。', bridge: 'このままではRENとrenが別の値です。表記をそろえます。',
    validation: { all: [used('grep'), used('awk'), pipe(2), source('metrics.csv'), out('REN\naki\nAki\nmei\nREN\nren')] }
  });
  lesson({ id: 'ap-33-flow-normalize', chapter: 'ap-final', title: '実習3：集計前に表記をそろえる', commands: ['tr'],
    goal: '抽出した値だけを正規化し、集計の入力を作れる。',
    explanation: ['この実習では、利用者名の大文字小文字は同じ人を表すと定義しています。trで小文字へそろえると、RENとrenを一緒に数えられます。', 'ファイル全体ではなく、必要な名前を取り出してから変換しています。ERRORなどの別の列には影響しません。'],
    concepts: [{ term: '変換する範囲', text: '取り出した値だけを変換すると、関係のない列を不用意に変えずに済みます。' }],
    example: { command: "echo 'Mei' | tr '[:upper:]' '[:lower:]'", note: '名前1個を小文字へそろえる短い例です。' },
    starter: extract, newPart: "| tr '[:upper:]' '[:lower:]'", task: '前のパイプへtrを追加し、portalのERROR利用者名6行をすべて小文字にしてください。',
    hints: ['これまでのgrepとawkはそのまま使います。', '最後に大文字から小文字へ変換するtrを追加します。', normalize + ' と入力します。'],
    solution: [normalize], success: '同じ利用者を同じ値として数える準備ができました。', bridge: '次は並べ替えとuniqで件数を作ります。',
    validation: { all: [used('tr'), pipe(3), source('metrics.csv'), out('ren\naki\naki\nmei\nren\nren')] }
  });
  lesson({ id: 'ap-34-flow-count', chapter: 'ap-final', title: '実習4：同じ名前を集めて数える', commands: ['sort', 'uniq'],
    goal: '正規化した値から、利用者ごとの件数を作れる。',
    explanation: ['uniqは隣り合う同じ行を扱うので、正規化の後にsortで同じ名前を集めます。その結果をuniq -cへ渡すと利用者ごとの件数になります。', 'まず末尾に| sortだけを加えて並びを確認し、その後| uniq -cを加えると、それぞれの役割が見えます。'],
    concepts: [{ term: '集計の順番', text: '表記をそろえる → 同じ値を隣り合わせにする → 件数を数える、の順です。' }],
    example: { command: 'sort repeated.txt | uniq -c', note: '短い別ファイルで、同じ名前をまとめて数える復習です。' },
    starter: normalize, newPart: '| sort | uniq -c', task: '前のパイプの末尾にsortとuniq -cを追加し、利用者名順の件数を表示してください。',
    hints: ['まずsortを追加し、aki、mei、renがまとまることを確認します。', 'その後にuniq -cを追加します。', count + ' と入力します。'],
    solution: [count], success: 'akiが2件、meiが1件、renが3件という件数になりました。', bridge: '次は利用者名順から、件数の多い順へ並べ替えます。',
    validation: { all: [used('sort'), used('uniq', { flags: 'c' }), pipe(5), source('metrics.csv'), out('2 aki\n1 mei\n3 ren', 'lines')] }
  });
  lesson({ id: 'ap-35-flow-rank', chapter: 'ap-final', title: '実習5：件数の多い順にする', commands: ['sort'],
    goal: 'パイプ内の2回のsortの役割を説明できる。',
    explanation: ['件数が先頭の列になったので、sort -nrをつなぐと数値の大きい順になります。最初のsortと最後のsortは目的が異なります。', '最初は同じ利用者名を集めるため、最後は集計結果の件数順を変えるためです。途中結果の表示で、2か所を選んで見比べてください。'],
    concepts: [{ term: '同じコマンドの再利用', text: '入力の形が変われば、同じsortでも別の役割を担えます。' }],
    example: { command: "printf '%s\\n' '2 aki' '3 ren' | sort -nr", note: '件数付きの2行を、大きい順に並べる短い例です。' },
    starter: count, newPart: '| sort -nr', task: '前の集計結果へsort -nrを追加し、件数の多い順に表示してください。',
    hints: ['途中のsortは残します。', '最後へ数値の逆順のsort -nrを追加します。', rank + ' と入力します。'],
    solution: [rank], success: '対象選びから順位付けまで、一つのパイプになりました。', bridge: '最後に保存まで含めた処理を、自分で仕上げます。',
    validation: { all: [used('sort', { flags: 'nr' }), pipe(6), source('metrics.csv'), out('3 ren\n2 aki\n1 mei', 'lines')] }
  });
  lesson({ id: 'ap-36-flow-save', chapter: 'ap-final', title: '実習6：集計結果を表示して保存する', mode: 'challenge', minutes: 6, commands: ['tee'],
    goal: '条件の定義から結果の保存まで、つながった処理を完成できる。',
    explanation: ['依頼は「portalサービスのERRORを、利用者別に件数の多い順でまとめる」です。利用者名は大小文字を同じものとして扱います。', 'metrics.csvを読み、結果をreports/error-users.txtへ保存し、同時に画面にも表示してください。reportsは作成済みです。別の正しいコマンドの組み合わせでも、元データと結果が条件に合えば合格です。'],
    concepts: [{ term: '結果を残す', text: '画面で確認できることに加えて、後から読み直せるファイルに同じ内容を保存します。' }],
    example: { command: "printf '%s\\n' 'example output' | tee reports/example-summary.txt", note: '例用の別ファイルへ、表示と保存を同時に行います。' },
    starter: rank, newPart: '| tee reports/error-users.txt', task: 'metrics.csvのportalのERRORを利用者別に集計してください。名前は小文字、件数は多い順にし、reports/error-users.txtへ保存して同じ内容を表示します。',
    hints: ['ERRORを選ぶ → portalの利用者名を取る → 小文字にする → 同じ名前を集めて数える → 件数順、の流れです。', 'できた集計の末尾にteeを付けると、表示と保存を両方できます。', rank + ' | tee reports/error-users.txt と入力します。'],
    solution: [rank + ' | tee reports/error-users.txt'], success: '応用編クリア！条件を分解し、結果を確かめながら集計と保存を組み立てられました。', bridge: '発展編では、複数の記録の比較・結合や、構造を持つJSONの処理へ進みます。',
    validation: { all: [source('metrics.csv', 'any'), out('3 ren\n2 aki\n1 mei', 'lines'), saved('reports/error-users.txt', '3 ren\n2 aki\n1 mei', 'lines')] }
  });

  if (lessons.length !== 36) throw new Error('応用編は36問で構成します');

  // New IDs are inserted beside the related skill; existing saved lesson IDs remain valid.
  lesson({id:'ap-37-input-redirection',chapter:'ap-normalize',title:'ファイルを標準入力へ渡す',commands:['wc'],
    goal:'入力リダイレクト<でファイル本文をコマンドへ渡せる。',
    explanation:['<はファイルの本文を標準入力へつなぐ記号です。wc -l names.txtは行数とファイル名を表示しますが、wc -l < names.txtならwc自身は名前を引数として受け取らず、行数だけを表示します。','cat names.txt | wc -lも同じ内容を渡せます。ファイル一つを入力するだけなら<で直接渡せます。>は出力先、<は入力元なので向きを確かめましょう。'],
    concepts:[{term:'入力リダイレクト <',text:'シェルが指定ファイルを開き、その内容を標準入力としてコマンドへ渡します。元ファイルは変更しません。'}],
    example:{command:'wc -l notes.txt',note:'行数4の後ろにnotes.txtも表示されます。入力を<へ変えると表示は行数だけになります。'},
    starter:'wc -l names.txt',newPart:'<',task:'wc -lに< names.txtで本文を渡し、名前を付けずに行数6だけを表示してください。',
    hints:['ファイル名はそのままにし、名前の前へ<を入れます。','この問題では<を実際に使います。catからのパイプは次のtrでも試せます。','穴埋め：wc -l ___ names.txt。本文を入力する向きの記号を入れます。'],
    solution:['wc -l < names.txt'],success:'引数と標準入力の違いを使い分けられました。',bridge:'次は標準入力だけを読むtrへ、同じ方法で渡します。',
    validation:{all:[used('wc',{flags:'l'}),source('names.txt'),{type:'redirect',op:'<',path:base+'/names.txt'},out('6')]}});
  lesson({id:'ap-38-ls-human',chapter:'ap-read',title:'大きさを読みやすい単位で見る',fixture:'ap-fileinfo',commands:['ls'],
    goal:'ls -lhでファイルの詳細と大きさを確認できる。',
    explanation:['ls -lは種類・権限・所有者・サイズ・更新日時・名前を詳しく表示します。-hを加えると1024バイト単位をKやMで読みやすく表示します。','この教材の所有者・権限・更新日時は練習用の固定情報で、日時はUTCです。実機では地域設定などで表示が変わります。まずサイズと名前を対応させて読みましょう。'],
    concepts:[{term:'-lh',text:'-lで詳細表示、-hで人が読みやすいサイズ表示にします。2.0Kはこの例では2048バイトです。'}],
    example:{command:'ls -l samples/payload.log',note:'サイズの2048を確認します。-hを足すと2.0Kになります。'},
    starter:'ls -l samples/payload.log',newPart:'h',task:'ls -lhでsamples/payload.logの情報を表示し、サイズが2.0Kであることを確認してください。',
    hints:['-lと-hは-lhにまとめられます。','対象はsamples/payload.logです。','穴埋め：ls -l___ samples/payload.log。読みやすい単位にするオプションを補います。'],
    solution:['ls -lh samples/payload.log'],success:'長い記録を開く前に、ファイルの大きさをつかめました。',bridge:'次は新しいファイルから見るために、順序を変えます。',
    validation:{all:[used('ls',{flags:'lh',args:['samples/payload.log']}),out('2.0K','contains'),out('samples/payload.log','contains')]}});
  lesson({id:'ap-39-ls-time',chapter:'ap-read',title:'新しいファイルから一覧にする',fixture:'ap-fileinfo',commands:['ls'],
    goal:'ls -ltで更新日時の新しい順に対象を確認できる。',
    explanation:['ls -tは更新日時の新しい順に並べます。-lも付けると、その順序の根拠となる日時を一緒に読めます。名前順と日時順は別です。','snapshots/*.logには08:00、09:00、09:30 UTCの三つの記録を用意しました。ファイルの更新日時と本文内の出来事の時刻は同じとは限りません。'],
    concepts:[{term:'更新日時',text:'ファイルが更新された時刻です。-tで新しい順、-trなら古い順にできます。'}],
    example:{command:'ls -l snapshots/*.log',note:'名前順ではa-old、m-middle、z-newですが、調査では新しいファイルから見たい場合があります。'},
    starter:'ls -l snapshots/*.log',newPart:'t',task:'ls -ltでsnapshots/*.logの詳細を、新しいz-new、m-middle、a-oldの順に表示してください。',
    hints:['並べ方を時刻へ変える指定は-tです。','-lと-tを合わせ、日時と名前を読みます。','穴埋め：ls -l___ snapshots/*.log。新しい順にするオプションを補います。'],
    solution:['ls -lt snapshots/*.log'],success:'更新の新しい記録を、名前順に惑わされず見つけられました。',bridge:'記録が長いときは、読む範囲も選びましょう。',
    validation:{all:[used('ls',{flags:'lt'}),out('-rw-r--r-- 1 analyst analyst 9 Oct 25 09:30 snapshots/z-new.log\n-rw-r--r-- 1 analyst analyst 9 Oct 25 09:00 snapshots/m-middle.log\n-rw-r--r-- 1 analyst analyst 9 Oct 25 08:00 snapshots/a-old.log','lines')]}});
  lesson({id:'ap-40-large-head',chapter:'ap-read',title:'400行の記録の先頭で形式を知る',fixture:'ap-volume',commands:['head'],
    goal:'長い記録の最初だけを読み、形式を確かめられる。',
    explanation:['server.logは400行あり、catでは画面から先頭が流れます。形式だけを知りたいならheadで数行に絞れます。','各行は「UTC時刻 種類 ホスト 出来事の番号」です。すべてを読む前に、先頭の数行で列の役割を確認する練習です。'],
    concepts:[{term:'先頭の確認',text:'head -nで量を制限し、区切りや項目を先に調べます。先頭が全体を代表しているとは限りません。'}],
    example:{command:'cat server.log',note:'400行が一度に流れます。先頭の形式を見たい場面では、読む範囲を絞ってみましょう。'},
    task:'headを使い、server.logの先頭3行だけを表示してください。',
    hints:['headに-nで行数を指定します。','対象はserver.log、読む量は3行です。','穴埋め：head -n ___ server.log。先頭3行に絞ります。'],
    solution:['head -n 3 server.log'],success:'長い記録でも、まず形式を確かめる量だけ読めました。',bridge:'次は最も後に書かれた記録を見ます。',
    validation:{all:[used('head'),{type:'source',path:volumeBase+'/server.log'},out(lines(volumeRows.slice(0,3)))]}});
  lesson({id:'ap-41-large-tail',chapter:'ap-read',title:'400行の記録の末尾を確認する',fixture:'ap-volume',commands:['tail'],
    goal:'長い記録の最後だけを取り出せる。',
    explanation:['調査の入口が直近の出来事なら、末尾だけをtailで読みます。このファイルは時刻順なので、末尾が最も後の時刻です。','tail -n 3は最後の3行を、ファイルに並んだ順序のまま表示します。tacのように逆順にはしません。'],
    concepts:[{term:'末尾の確認',text:'全体を表示してスクロールする代わりに、必要な最後の数行を直接取り出します。'}],
    example:{command:'head -n 3 server.log',note:'先頭はevent=0001からです。末尾の確認にはtailへ切り替えます。'},
    starter:'head -n 3 server.log',newPart:'tail',task:'tailでserver.logの最後の3行だけを表示してください。',
    hints:['行数の-n 3はそのまま使えます。','先頭を読むheadから末尾を読むコマンドへ変えます。','穴埋め：___ -n 3 server.log。末尾を読むコマンド名を入れます。'],
    solution:['tail -n 3 server.log'],success:'最後のERRORを含む範囲へ、直接たどり着けました。',bridge:'全体を読みたいときはページャー、件数だけなら集計を使います。',
    validation:{all:[used('tail'),{type:'source',path:volumeBase+'/server.log'},out(lines(volumeRows.slice(-3)))]}});
  lesson({id:'ap-42-large-count',chapter:'ap-read',title:'400行から件数だけを確かめる',fixture:'ap-volume',commands:['grep'],
    goal:'grep -cで必要な種類の件数を調べられる。',
    explanation:['400行からERRORを一つずつ目で数える代わりに、grep -cで一致した行数を出します。記録の全体量と注目する行数を分けて捉えられます。','-cが数えるのは語の出現回数ではなく、一致した行の数です。同じ行にERRORが二つあっても1行と数えます。'],
    concepts:[{term:'-c',text:'一致した本文の代わりに、その行数を表示します。'}],
    example:{command:'wc -l server.log',note:'全体は400行です。次に、そのうちERRORの行だけを数えます。'},
    task:'grep -cでserver.logのERRORを含む行数だけを表示してください。',
    hints:['検索語はERRORです。','本文を表示するgrepへ-cを足します。',"穴埋め：grep ___ 'ERROR' server.log。一致行数を出すオプションを入れます。"],
    solution:["grep -c 'ERROR' server.log"],success:'長い本文を目で数えず、注目する行が10件だと確認できました。',bridge:'目的に応じて、行数以外の量で読む方法もあります。',
    validation:{all:[used('grep',{flags:'c'}),{type:'source',path:volumeBase+'/server.log'},out('10')]}});
  lesson({id:'ap-43-tail-header',chapter:'ap-fields',title:'見出しを除いて2行目から読む',fixture:'ap-volume',commands:['tail'],
    goal:'tail -n +2の開始行指定を使える。',
    explanation:['tail -n 2は末尾の2行ですが、tail -n +2は先頭から数えて2行目以降です。+が付くと「何行残すか」から「何行目からか」に意味が変わります。','metrics.csvの1行目は見出しです。集計の前に見出しだけを除くときに使えます。この課題のCSVは引用符内の改行を含みません。'],
    concepts:[{term:'-n +2',text:'1行目を除いて、2行目から末尾まで表示します。'}],
    example:{command:'tail -n 2 metrics.csv',note:'最後の2行だけで、最初のデータ行も落ちます。見出しだけを除く指定と比べましょう。'},
    starter:'tail -n 2 metrics.csv',newPart:'+2',task:'tailでmetrics.csvの見出しだけを除き、データ3行をすべて表示してください。',
    hints:['数の前の+が開始位置の指定になります。','開始位置は先頭から数えて2行目です。','穴埋め：tail -n ___ metrics.csv。2行目からを表す指定を入れます。'],
    solution:['tail -n +2 metrics.csv'],success:'末尾の件数と、開始行の指定を使い分けられました。',bridge:'列を選ぶ処理に渡す前に、対象行を整理できます。',
    validation:{all:[used('tail'),{type:'source',path:volumeBase+'/metrics.csv'},out('00:00,INFO,3\n00:01,ERROR,2\n00:02,INFO,4')]}});
  lesson({id:'ap-44-head-bytes',chapter:'ap-read',title:'先頭をバイト数で取り出す',fixture:'ap-volume',commands:['head'],
    goal:'head -cで先頭から指定したバイト数を読める。',
    explanation:['head -nは行数、head -cはバイト数です。長い1行の記録や形式の先頭だけを調べたいときに、読む量をバイトで制限できます。','header.txtの先頭はASCIIのLINUXROOMです。ASCIIは1文字1バイトですが、日本語などのUTF-8文字は複数バイトになるので、文字の途中で切れる場合があります。'],
    concepts:[{term:'-c',text:'ここでは文字数ではなくバイト数です。コマンドが違うと同じ-cでも意味が変わります。'}],
    example:{command:'head -n 1 header.txt',note:'1行目の改行まで読みます。今回は改行を含めず先頭9バイトだけを読みます。'},
    task:'head -cを使い、header.txtの先頭9バイトLINUXROOMだけを表示してください。改行は含めません。',
    hints:['行数の-nではなくバイト数の-cです。','LINUXROOMはASCIIの9文字です。','穴埋め：head -c ___ header.txt。改行を含めないバイト数を指定します。'],
    solution:['head -c 9 header.txt'],success:'行単位とバイト単位を目的に合わせて選べました。',bridge:'次は位置を共有するときに便利な行番号へ進みます。',
    validation:{all:[used('head',{flags:'c'}),{type:'source',path:volumeBase+'/header.txt'},out('LINUXROOM','exact')]}});
  lesson({id:'ap-45-and-sequence',chapter:'ap-workspace',title:'成功したときだけ続ける',commands:['grep','echo'],
    goal:'&&と;の実行条件の違いを使い分けられる。',
    explanation:['A && BはAの終了コードが0のときだけBを実行します。A ; BはAの結果に関係なくBへ進みます。パイプのように本文を渡す記号ではありません。','grepは一致ありで0、一致なしで1です。session.logにNOT_PRESENTはありません。今回は一致なしを意図した観察なので、終了コード1を正しい結果として扱います。'],
    concepts:[{term:'&&と;',text:'&&は左が成功した場合だけ右へ進みます。;は結果に関係なく次を実行します。awkの引用符内に書く&&とは別に、シェルの接続として使います。'}],
    example:{command:"grep 'INFO' session.log && echo found",note:'INFOが見つかるため、その後にfoundが表示されます。'},
    task:'grepでNOT_PRESENTを探し、一致したときだけecho unexpectedを実行するよう&&でつなぎます。その後は;でecho checkedを実行してください。表示はcheckedだけになります。',
    hints:['検索とecho unexpectedの間を&&でつなぎます。','最後のecho checkedへは;でつなぎ、検索結果に関係なく進めます。',"穴埋め：grep 'NOT_PRESENT' session.log ___ echo unexpected ; echo checked。成功時だけ進む記号を入れます。"],
    solution:["grep 'NOT_PRESENT' session.log && echo unexpected; echo checked"],success:'一致がなければ&&の右を飛ばし、;の右へ進むことを確認できました。',bridge:'エラーの本文にも標準出力とは別の出口があります。',
    validation:{all:[used('grep'),used('echo',{args:['checked']}),source('session.log'),{type:'status',command:'grep',code:1},{type:'connector',value:'&&',afterCommand:'grep',skipped:true},{type:'connector',value:';'},out('checked')]}});
  lesson({id:'ap-46-stderr',chapter:'ap-workspace',title:'エラーの出力先を分ける',commands:['cat'],
    goal:'2>/dev/nullが標準エラーだけを捨てることを理解する。',
    explanation:['通常の結果は標準出力1、エラーの説明は標準エラー2に出ます。2>でエラーの出力先を変え、/dev/nullへ送ると表示を捨てられます。','エラー表示を消しても、失敗した事実や終了コードは変わりません。原因を確認したうえで不要な診断を抑える操作です。今回は存在しないmissing.logを教材として指定します。'],
    concepts:[{term:'2>/dev/null',text:'標準エラーの出力だけを捨てます。通常の結果は画面へ出たままです。'}],
    example:{command:'cat notes.txt 2>/dev/null',note:'notes.txtは存在するので本文は普通に表示されます。2>は標準出力を消しません。'},
    task:'cat missing.logの標準エラーを2>/dev/nullで抑え、;で続けてcat notes.txtを実行してください。メモ本文だけを表示します。',
    hints:['エラーの番号は2です。>の直前に空白を入れず2>と書きます。','失敗後もメモを読むため、&&ではなく;でつなぎます。','穴埋め：cat missing.log ___/dev/null; cat notes.txt。標準エラーの出力先を変える記号を入れます。'],
    solution:['cat missing.log 2>/dev/null; cat notes.txt'],success:'エラー表示と通常の結果を分けられました。最初のcatは失敗のままである点も確認しましょう。',bridge:'次は直前の終了コードを数字で読みます。',
    validation:{all:[used('cat',{args:['missing.log']}),source('notes.txt'),{type:'status',command:'cat',code:1,stderrRedirected:true},{type:'redirect',op:'>',fd:2,path:'/dev/null'},out(notes)]}});
  lesson({id:'ap-47-exit-status',chapter:'ap-workspace',title:'直前の終了コードを読む',commands:['grep','echo','true','false'],
    goal:'$?で直前のコマンドの終了コードを確認できる。',
    explanation:['$?には直前に終わったコマンドの終了コードが入ります。echo $?で表示できます。0は成功を表し、0以外の意味はコマンドごとに違います。grepの1は一致なし、diffの1は差ありです。','別のコマンドを実行すると$?も更新されます。確認したい操作の直後に読みます。シングルクォートで\'$?\'と囲むと、展開せず文字そのものを表示します。'],
    concepts:[{term:'$?',text:'直前の終了コードへ展開されるシェルの特別な変数です。プロンプト末尾の$とは役割が異なります。'}],
    example:{command:'true; echo $?; false; echo $?',note:'trueの成功0とfalseの失敗1が、この順に表示されます。'},
    task:'grepでsession.logからNOT_PRESENTを探し、直後にecho $?で終了コードを表示してください。一致なしの1だけが表示されます。',
    hints:['grepに一致がないため、通常の本文出力は空です。','検索の直後へ; echo $?を続けます。',"穴埋め：grep 'NOT_PRESENT' session.log; echo ___。直前の終了コードを表す変数を入れます。"],
    solution:["grep 'NOT_PRESENT' session.log; echo $?"],success:'画面に本文が出ない理由を、終了コードからも確かめられました。',bridge:'ここまでの読み方・入力・接続を、最後の集計実習で使いましょう。',
    validation:{all:[used('grep'),used('echo'),source('session.log'),{type:'status',command:'grep',code:1},{type:'variable',name:'?',command:'echo',context:'arguments',afterCommand:'grep'},out('1')]}});


  D.datasets['ap-review'] = {cwd:base+'/review',files:{
    [base+'/review/windows.log']:'user\tresult\r\naki\tok\r\nren\tfail\r\n',
    [base+'/review/artifact.txt']:'abc\n'
  }};
  lesson({id:'ap-48-cat-visible',chapter:'ap-read',title:'見えない改行とタブを確かめる',fixture:'ap-review',commands:['cat'],
    goal:'cat -AでCRLFとタブを可視化し、検索のずれを説明できる。',
    explanation:['Windows由来のログには、行末がLFだけでなくCRLFになっているものがあります。cat -Aはタブを^I、CRを^M、行末を$で表示します。-Tはタブ、-vは制御文字、-Eは行末だけを見る指定です。',"windows.logのok行も末尾にCRがあるため、grep 'ok$'では一致しません。画面で似て見えるときは、文字を削る前にcat -Aで元データを確かめましょう。"],
    concepts:[{term:'CRLF',text:'CRとLFという2バイトの改行です。cat -Aでは行末が^M$と見えます。'}],
    example:{command:'cat -T windows.log',note:'タブだけが^Iになり、列の区切りを確認できます。'},
    task:'cat -Aでwindows.logを表示し、タブの^Iと各行末の^M$を確認してください。',
    hints:['catへ見えない文字も表示するオプションを加えます。','すべての表示指定をまとめるのは大文字の-Aです。','穴埋め：cat ___ windows.log。タブ・制御文字・行末を一緒に表示する指定を入れます。'],
    solution:['cat -A windows.log'],success:'目に見えない文字も、検索が一致しない原因として確認できました。',bridge:'文字の読み方を確認したら、必要な行や列を選びます。',
    validation:{all:[used('cat',{flags:'A'}),{type:'source',path:base+'/review/windows.log'},out('user^Iresult^M$\naki^Iok^M$\nren^Ifail^M$\n','exact')]}});
  lesson({id:'ap-49-file-hash',chapter:'ap-workspace',title:'ファイルのハッシュ値を記録する',fixture:'ap-review',commands:['sha256sum','md5sum'],
    goal:'sha256sumでファイル本文から照合用の値を求められる。',
    explanation:['sha256sumはファイルのバイト列からSHA-256ハッシュを計算します。ファイル名を変えても本文が同じなら値は同じですが、改行の有無でも値が変わります。', 'ハッシュはThreatHunting-roomなどの調査で、同じファイルを探すための手掛かりになります。一致だけで安全性は判断できません。md5sumも既存の記録を照合するときに使いますが、新しい完全性確認にはSHA-256を選びましょう。'],
    concepts:[{term:'ファイルハッシュ',text:'ファイル内容から計算した固定長の値です。名前ではなくバイト列を照合します。'}],
    example:{command:'md5sum artifact.txt',note:'同じファイルのMD5を表示します。SHA-256とは別の方式なので値も長さも異なります。'},
    task:'sha256sumでartifact.txtのSHA-256を表示してください。ファイルにはabcと末尾の改行が入っています。',
    hints:['ハッシュを求めるコマンドの後ろにファイル名を置きます。','今回はMD5ではなくSHA-256を選びます。','穴埋め：___ artifact.txt。SHA-256を計算するコマンド名を入れます。'],
    solution:['sha256sum artifact.txt'],success:'ファイルを照合する手掛かりを、内容から求められました。',bridge:'対象と条件を決め、最後の集計実習へ進みましょう。',
    validation:{all:[used('sha256sum'),{type:'source',path:base+'/review/artifact.txt'},out('edeaaff3f1774ad2888673770c6d64097e391bc362d7d6fb34982ddf0efd18cb  artifact.txt\n','exact')]}});

  const additionsBefore = {
    'ap-04-tac':['ap-38-ls-human','ap-39-ls-time','ap-48-cat-visible'],
    'ap-05-more':['ap-40-large-head','ap-41-large-tail'],
    'ap-06-nl':['ap-42-large-count','ap-44-head-bytes'],
    'ap-18-awk-combined':['ap-43-tail-header'],
    'ap-20-tr-case':['ap-37-input-redirection'],
    'ap-31-flow-filter':['ap-45-and-sequence','ap-46-stderr','ap-47-exit-status','ap-49-file-hash']
  };
  const addedIds = new Set(Object.values(additionsBefore).flat());
  const original = lessons.filter(item=>!addedIds.has(item.id));
  const byId = new Map(lessons.map(item=>[item.id,item]));
  lessons.splice(0,lessons.length,...original.flatMap(item=>[...(additionsBefore[item.id]||[]).map(id=>byId.get(id)),item]));

  // Explain implementation and platform differences where learners encounter them.
  lessons.find(item => item.id === "ap-01-help").explanation.push("自由練習ではwhoami、idでユーザー情報を確認できます。seq 1 3は1から3を1行ずつ表示します。echo {a,b}はブレース展開でa bになります。");
  lessons.find(item => item.id === "ap-12-grep-recursive").explanation.push("この教材ではファイルの走査順を固定しています。実機のgrep -rやfindの出力順はディレクトリの状態によって変わるので、比較する一覧には| sortを添えます。");
  lessons.find(item => item.id === "ap-33-flow-normalize").explanation.push("大小文字を残したまま並べるとロケールで順序が変わります。この教材と同じ順序を実機で確かめるにはLC_ALL=C sortを使います。小文字への正規化は、順序だけでなく同一人物として数えるルールを決める操作です。");
  lessons.find(item => item.id === "ap-38-ls-human").explanation.push("ディレクトリをls -lで読むと、先頭のtotalは表示対象の割当ブロックの合計です。この教材は4 KiB単位の割当を仮定し、ディレクトリのサイズは4096、リンク数は2＋直下のディレクトリ数として表示します。実機の値はファイルシステムにより異なります。");
  lessons.find(item => item.id === "ap-47-exit-status").explanation.push("短い確認にはtrue; echo $?とfalse; echo $?も使えます。trueは0、falseは1で終了します。どちらも本文は出力しません。");

  lessons.forEach(D.practiceHint);
  D.lessons.push(...lessons);
  D.glossary.push(
    { term: '固定文字列検索', text: 'grep -Fやrg -Fで、記号も文字どおりに検索する方法です。' },
    { term: '正規表現', text: '^、$、.*、選択の|などを使い、文字列の条件を表す書き方です。grep -Eで拡張正規表現を使えます。' },
    { term: '文脈（context）', text: '一致行の前後にある記録です。grepの-A・-B・-Cで追加表示します。' },
    { term: 'グロブ', text: '*.logなど、ファイル名のパターンです。find -nameやrg -gへ渡す場合は引用符で囲みます。' },
    { term: '正規化', text: '比較・集計の前に表記をそろえることです。元データの意味やルールを確かめて適用します。' },
    { term: 'ソートキー', text: '並べ替えで比較する列や範囲です。sort -k3,3nrなら3列目を数値の大きい順にします。' }
  );
})(typeof window !== 'undefined' ? window : globalThis);
