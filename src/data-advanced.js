/* Linuxroom advanced curriculum. Every dataset is synthetic and local. */
(function (root) {
  'use strict';
  const D = root.LINUXROOM_DATA;
  const base = '/home/analyst/advanced';
  const lines = rows => rows.join('\n') + '\n';
  const auth = lines([
    'Oct 25 09:00:00 gateway sshd[101]: Failed password for ren from 192.0.2.20 port 42001 ssh2',
    'Oct 25 09:01:00 gateway sshd[102]: Accepted password for aki from 192.0.2.10 port 42002 ssh2',
    'Oct 25 09:02:00 gateway sshd[103]: Failed password for invalid user guest from 192.0.2.20 port 42003 ssh2',
    'Oct 25 09:03:00 gateway sshd[104]: Failed password for mei from 192.0.2.30 port 42004 ssh2',
    'Oct 25 09:04:00 gateway sshd[105]: Failed password for ren from 192.0.2.20 port 42005 ssh2',
    'Oct 25 09:05:00 gateway sshd[106]: Accepted password for mei from 192.0.2.30 port 42006 ssh2'
  ]);
  const access = lines([
    '2026-10-25T00:00:00Z req-01 200 300',
    '2026-10-25T00:01:00Z req-02 503 80',
    '2026-10-25T00:02:00Z req-03 200 250',
    '2026-10-25T00:03:00Z req-04 500 40',
    '2026-10-25T00:04:00Z req-05 503 120',
    '2026-10-25T00:05:00Z req-06 200 150'
  ]);
  const events = [
    {time:'2026-10-25T00:00:00Z',request:{id:'req-01'},actor:{name:'aki'},result:'success'},
    {time:'2026-10-25T00:01:00Z',request:{id:'req-02'},actor:{name:'ren'},result:'failed'},
    {time:'2026-10-25T00:02:00Z',request:{id:'req-03'},actor:{name:'aki'},result:'success'},
    {time:'2026-10-25T00:03:00Z',request:{id:'req-04'},actor:{name:'mei'},result:'failed'},
    {time:'2026-10-25T00:04:00Z',request:{id:'req-05'},actor:{name:'ren'},result:'failed'},
    {time:'2026-10-25T00:05:00Z',request:{id:'req-06'},actor:{name:'ren'},result:'success'}
  ];
  const manifest = {collector:{name:'edge-01',zone:'UTC'},files:['access.log','audit.jsonl'],events};
  const finalEvents = [
    {time:'2026-10-25T02:00:00Z',request:{id:'job-01'},actor:{name:'sora'},result:'success'},
    {time:'2026-10-25T02:01:00Z',request:{id:'job-02'},actor:{name:'yui'},result:'failed'},
    {time:'2026-10-25T02:02:00Z',request:{id:'job-03'},actor:{name:'sora'},result:'failed'},
    {time:'2026-10-25T02:03:00Z',request:{id:'job-04'},actor:{name:'sora'},result:'failed'},
    {time:'2026-10-25T02:04:00Z',request:{id:'job-05'},actor:{name:'yui'},result:'success'}
  ];
  const files = {
    [base+'/ready.txt']:'ready\n',
    [base+'/bundle/a.log']:'INFO boot\n',
    [base+'/bundle/b.log']:'WARN retry\n',
    [base+'/selected-files.txt']:'bundle/a.log\nbundle/b.log\n',
    [base+'/collector.bin']:'LR\0collector=v1\0request_id=req-02\0state=queued\0',
    [base+'/sample.b64']:'cmVhZHkK\n',
    [base+'/payload.b64']:'eyJyZXF1ZXN0X2lkIjoicmVxLTAyIiwicmVzdWx0IjoiZmFpbGVkIn0K\n',
    [base+'/object-names.txt']:'gateway.access.log\ncollector.audit.json\nservice.error.log\n',
    [base+'/baseline.conf']:'retention=7\nformat=json\n',
    [base+'/current.conf']:'retention=14\nformat=json\n',
    [base+'/baseline-users.txt']:'aki\nmei\nren\n',
    [base+'/observed-users.txt']:'ren\naki\nren\nmei\nsota\n',
    [base+'/current-users.sorted']:'aki\nmei\nren\nsota\n',
    [base+'/request-ids.txt']:'req-01\nreq-02\nreq-03\n',
    [base+'/request-times.txt']:'00:00\n00:01\n00:02\n',
    [base+'/status-by-id.txt']:'req-01 200\nreq-02 503\nreq-03 200\nreq-04 500\n',
    [base+'/actors-by-id.txt']:'req-01 aki\nreq-02 ren\nreq-03 aki\nreq-04 mei\n',
    [base+'/expected-ids.txt']:'req-01\nreq-02\nreq-03\nreq-04\n',
    [base+'/received-ids.txt']:'req-01\nreq-03\nreq-04\n',
    [base+'/auth.log']:auth,
    [base+'/access.log']:access,
    [base+'/manifest.json']:JSON.stringify(manifest)+'\n',
    [base+'/audit.jsonl']:lines(events.map(value=>JSON.stringify(value))),
    [base+'/final/access.log']:lines([
      '2026-10-25T02:00:00Z job-01 200 300',
      '2026-10-25T02:01:00Z job-02 503 90',
      '2026-10-25T02:02:00Z job-03 500 60',
      '2026-10-25T02:03:00Z job-04 503 150',
      '2026-10-25T02:04:00Z job-05 200 240'
    ]),
    [base+'/final/audit.jsonl']:lines(finalEvents.map(value=>JSON.stringify(value)))
  };
  Object.assign(D.datasets, {'ad-lab':{cwd:base,files},'ad-final':{cwd:base+'/final',files:{...files}}});
  D.chapters.push(...[
    ['ad-inspect','調査対象を確かめる','パス・形式・サイズを調べる6問'],
    ['ad-transform','時刻と文字の表現をそろえる','UTC・文字列・Base64を扱う5問'],
    ['ad-compare','二つの記録を比較する','差分・集合・行の対応を見る5問'],
    ['ad-link','ファイルを横断して調べる','キー結合と引数の受け渡し4問'],
    ['ad-awk','awkで集計を組み立てる','列の位置から件数と合計へ進む5問'],
    ['ad-json','構造のあるJSONを集計する','入れ子・配列・グループ化7問'],
    ['ad-final','発展の統合実習','複数の資料から成果物を作る4問']
  ].map(([id,title,subtitle])=>({id,title,subtitle,level:'advanced'})));
  const out = (value,match='trim') => ({type:'output',value,match});
  const used = (command,extra={}) => ({type:'used',command,...extra});
  const source = (path,scope='any') => ({type:'source',path:base+'/'+path,scope});
  const saved = (path,value,match='trim') => ({type:'file',path:base+'/'+path,value,match});
  const pipe = minStages => ({type:'pipeline',minStages});
  const lessons=[];
  function add(item) { lessons.push({level:'advanced',minutes:4,mode:'practice',fixture:'ad-lab',starter:'',newPart:'',...item}); }
  const accessFields='access.logは「UTC時刻 リクエストID ステータス 応答バイト数」の4列です。IDは処理の識別子、200はこの教材では成功、500・503はサーバー側エラーの記録です。バイト数は応答データの大きさです。';
  const jsonFields='audit.jsonlの各行は一つの出来事です。timeはUTC時刻、request.idは処理ID、actor.nameは名前、resultはsuccess（成功）またはfailed（失敗）です。';
  const failIP="grep 'Failed password' auth.log | awk '{print $(NF-3)}'";
  const groupIP="grep 'Failed password' auth.log | awk '{count[$(NF-3)]++} END {for (ip in count) print count[ip], ip}'";
  const nestedIds="jq -r '.events[] | .request.id' manifest.json";
  const failedIds="jq -r '.events[] | select(.result == \"failed\") | .request.id' manifest.json";

  add({id:'ad-01-basename',chapter:'ad-inspect',title:'パスからファイル名を取り出す',mode:'guide',
    goal:'長いパスから末尾の名前だけを取り出せる。',
    explanation:['発展編は複数の記録を扱う準備から始めます。現在地は/home/analyst/advancedです。すべて教材内の仮想ファイルです。','basenameはパスの末尾の名前を表示します。ファイルの内容は読みません。収集したパスから報告書に書く名前を作るときに便利です。'],
    concepts:[{term:'basename',text:'パスの最後の部分を取り出します。追加の引数.logがあれば、その末尾を除けます。'}],
    example:{command:'basename /home/analyst/advanced/bundle/a.log',note:'a.logと表示されます。ファイルを移動したり改名したりする操作ではありません。'},
    task:'basenameを使い、/home/analyst/advanced/access.logから拡張子.logも除いたaccessを表示してください。',
    hints:['名前を取り出すコマンドに、まず対象パスを渡します。','二つ目の引数.logは、末尾から取り除く文字列です。','basename /home/analyst/advanced/access.log .log と入力します。'],
    solution:['basename /home/analyst/advanced/access.log .log'],success:'パスから保存用の名前を作る操作ができました。',bridge:'次は、名前ではなく置き場所を取り出します。',
    validation:{all:[used('basename'),out('access')]}});

  add({id:'ad-02-dirname',chapter:'ad-inspect',title:'パスから置き場所を取り出す',
    goal:'dirnameで親ディレクトリのパスを取り出せる。',
    explanation:['dirnameは、パスの最後の名前を除いた部分を表示します。basenameと組み合わせると「置き場所」と「名前」を分けられます。','表示するだけなので現在地は変わりません。ログの出所を報告するときには、ファイル名だけでなく置き場所も記録します。'],
    concepts:[{term:'dirname',text:'パスの親ディレクトリを文字列として表示します。cdとは異なり移動しません。'}],
    example:{command:'dirname /home/analyst/advanced/access.log',note:'/home/analyst/advancedと表示されます。'},
    task:'dirnameで/home/analyst/advanced/bundle/b.logの親ディレクトリを表示してください。',
    hints:['対象はbundleの中のb.logです。','dirnameの後ろに対象のパス全体を書きます。','dirname /home/analyst/advanced/bundle/b.log と入力します。'],
    solution:['dirname /home/analyst/advanced/bundle/b.log'],success:'ファイルがどの場所から来たかを取り出せました。',bridge:'次は..を含むパスを整理します。',
    validation:{all:[used('dirname'),out(base+'/bundle')]}});

  add({id:'ad-03-realpath',chapter:'ad-inspect',title:'省略したパスを絶対パスにする',
    goal:'realpathで.や..を整理し、出所を明確にできる。',
    explanation:['realpathは、現在地を基準にパスを整理して絶対パスにします。./は現在地、../は一つ上です。','-eは実際に存在する対象かも確かめる指定です。実Linuxではシンボリックリンクも扱いますが、この教材では仮想パスの整理を練習します。'],
    concepts:[{term:'正規化したパス',text:'現在地や..を解決して、場所を一意に指せる形に整理したパスです。'}],
    example:{command:'realpath -e ./ready.txt',note:'/home/analyst/advanced/ready.txtと表示されます。'},
    task:'realpath -eを使い、bundle/../access.logの絶対パスを表示してください。',
    hints:['bundleへ進んでから..で戻るため、access.logは現在地にあります。','-eに続けて、課題で指定したパスを渡します。','realpath -e bundle/../access.log と入力します。'],
    solution:['realpath -e bundle/../access.log'],success:'省略されたパスを、記録しやすい絶対パスにできました。',bridge:'場所が分かったら、ファイルの形式を調べます。',
    validation:{all:[used('realpath'),out(base+'/access.log')]}});

  add({id:'ad-04-file',chapter:'ad-inspect',title:'内容の形式を確かめる',
    goal:'fileで内容の種類を確認してから読む道具を選べる。',
    explanation:['拡張子は名前の一部です。fileは内容から種類を推測します。読み方を決める前に、テキストなのかJSONなのかを確認します。','この教材の判定は簡略版です。audit.jsonlは1行に一つのJSONが並ぶ形式です。実機ではfileの版や判定規則によりJSON Lines text data、JSON text data、ASCII textなど表記が変わることがあります。'],
    concepts:[{term:'JSON Lines',text:'各行が独立したJSONの記録。後半ではjqで項目を取り出します。'}],
    example:{command:'file ready.txt',note:'ready.txt: ASCII textと表示されます。ASCIIは英数字などの基本的な文字です。'},
    task:'fileを使ってaudit.jsonlの種類を表示してください。',
    hints:['fileに調べたいファイル名を渡します。','jsonlの最後は数字の1ではなく、英小文字のlです。','file audit.jsonl と入力します。'],
    solution:['file audit.jsonl'],success:'JSON Linesの記録だと確認できました。',bridge:'次は、ファイルの大きさを確かめます。',
    validation:{all:[used('file'),out('audit.jsonl: JSON Lines text data')]}});

  add({id:'ad-05-stat',chapter:'ad-inspect',title:'ファイルのバイト数を記録する',
    goal:'statの書式を指定し、名前とサイズを表示できる。',
    explanation:['statはファイルの情報を表示します。-cの後ろに書式を書くと、必要な項目だけを取り出せます。','%nは名前、%sはバイト数です。ready.txtにはreadyの5文字と改行1文字が入り、合計6バイトです。日本語では文字数とバイト数が異なります。この教材の所有権や時刻は実OSの情報ではありません。'],
    concepts:[{term:'バイト',text:'データの大きさの単位です。ASCII文字と改行はそれぞれ1バイトです。'}],
    example:{command:"stat -c '%n' ready.txt",note:'%nだけなら名前のready.txtだけを表示します。'},
    starter:"stat -c '%n' ready.txt",newPart:'%s',task:'stat -cを使い、ready.txtの名前とバイト数を、ready.txt 6の形で表示してください。',
    hints:['書式に名前の%nとサイズの%sを並べます。','書式中の空白を保つため、全体を引用符で囲みます。',"stat -c '%n %s' ready.txt と入力します。"],
    solution:["stat -c '%n %s' ready.txt"],success:'収集対象の名前と大きさを一行で示せました。',bridge:'ディレクトリ全体の大きさも確認してみましょう。',
    validation:{all:[used('stat'),out('ready.txt 6')]}});

  add({id:'ad-06-du',chapter:'ad-inspect',title:'まとめた記録の大きさを調べる',
    goal:'du -cbで選んだファイル本文の合計サイズを確認できる。',
    explanation:['du -bは見かけのサイズをバイト単位で表示し、-cは最後に総計を加えます。bundle/*.logで対象をログファイルそのものに絞り、tail -n 1で総計の行を取り出します。','a.logは10バイト、b.logは11バイトで、本文は合計21バイトです。ディレクトリをdu -sb bundleで測ると、実機ではディレクトリ自身のサイズも含まれます。本文だけを知りたいときは今回のようにファイルを指定します。'],
    concepts:[{term:'du -cb ファイル',text:'-cは総計、-bは見かけのサイズをバイト単位にします。*.logは該当するファイル名へ展開されます。'}],
    example:{command:'du -b ready.txt',note:'6とready.txtが表示されます。ファイル一つにも使えます。'},
    task:'du -cbでbundle/*.logの本文サイズを集計し、tailで総計の21 totalの行だけを表示してください。',
    hints:['duに-cbを付け、対象をbundle/*.logにします。','総計は最後の行なのでtail -n 1へ渡します。','穴埋め：du -cb bundle/*.log | tail -n ___。最後の1行だけを表示します。'],
    solution:['du -cb bundle/*.log | tail -n 1'],success:'調査対象をまとめた大きさを確認できました。',bridge:'ファイル情報に続き、時刻の表し方をそろえます。',
    validation:{all:[used('du'),used('tail'),out('21\ttotal','lines')]}});

  add({id:'ad-07-date-utc',chapter:'ad-transform',title:'タイムゾーンをUTCにそろえる',mode:'guide',
    goal:'オフセット付きの時刻をUTCで表示できる。',
    explanation:['複数のログを並べる前に、時刻の基準をそろえます。+09:00はUTCより9時間進んだ時刻、末尾のZはUTCを表します。','date -dは入力日時、-uはUTCでの出力です。+の後ろの書式で、%Fは日付、%Tは時分秒、%Zはタイムゾーン名を示します。日時を明示するため、この課題は実行した日や端末の時計に左右されません。'],
    concepts:[{term:'UTC',text:'時刻を比較するときの共通の基準です。09:00の+09:00は00:00のUTCと同じ瞬間です。'}],
    example:{command:"date -u -d '2026-10-25T10:00:00+09:00' '+%F %T %Z'",note:'2026-10-25 01:00:00 UTCと表示されます。'},
    task:'2026-10-25T09:00:00+09:00をUTCへ変換し、日付・時分秒・UTCを表示してください。',
    hints:['見本の入力時刻10:00:00を09:00:00に変えます。','書式は+%F %T %Zです。空白があるので引用符を付けます。',"date -u -d '2026-10-25T09:00:00+09:00' '+%F %T %Z' と入力します。"],
    solution:["date -u -d '2026-10-25T09:00:00+09:00' '+%F %T %Z'"],success:'異なる表記の時刻を共通の基準へ変換できました。',bridge:'数値だけで記録された時刻も読めるようにします。',
    validation:{all:[used('date'),out('2026-10-25 00:00:00 UTC')]}});

  add({id:'ad-08-date-epoch',chapter:'ad-transform',title:'数値の時刻を読みやすくする',
    goal:'UNIX時刻の秒数を日時へ変換できる。',
    explanation:['UNIX時刻は1970年1月1日00:00:00 UTCからの秒数で時刻を表します。ログには人が読む日時の代わりにこの数値が入ることがあります。','date -dに@と秒数を渡すと変換できます。ミリ秒の値はそのまま渡せません。今回は秒単位だと分かっている1792886400を使います。'],
    concepts:[{term:'@epoch',text:'dateにUNIX時刻の秒数を渡す書き方です。@0は起点の瞬間です。'}],
    example:{command:"date -u -d @0 '+%F %T %Z'",note:'1970-01-01 00:00:00 UTCと表示されます。'},
    starter:"date -u -d @0 '+%F %T %Z'",task:'秒数1792886400をdateで変換し、UTCの日付・時分秒・UTCを表示してください。',
    hints:['@のすぐ後ろに秒数を書きます。','表示の書式と-uは前の課題と同じです。',"date -u -d @1792886400 '+%F %T %Z' と入力します。"],
    solution:["date -u -d @1792886400 '+%F %T %Z'"],success:'数値で記録された時刻も、文字の時刻と比較できる形になりました。',bridge:'次は、制御文字を含む収集データから読める部分を取り出します。',
    validation:{all:[used('date'),out('2026-10-25 00:00:00 UTC')]}});

  add({id:'ad-09-strings',chapter:'ad-transform',title:'読める文字列を拾う',
    goal:'stringsの結果をgrepで絞り、記録の識別子を探せる。',
    explanation:['collector.binは、文字列の間にNULという表示できない区切りを入れた練習用データです。stringsは連続した表示可能な文字を拾います。-n 8は8文字以上という条件です。','collector=v1は収集器の版、request_id=req-02は処理ID、state=queuedは待機状態です。抽出した断片だけでは前後関係を保証できないため、ここではIDを探す操作を練習します。'],
    concepts:[{term:'strings',text:'データ内の読める文字列を取り出します。この教材ではASCIIの範囲を扱います。'}],
    example:{command:'strings -n 8 collector.bin',note:'collector=v1、request_id=req-02、state=queuedが別々の行として出ます。'},
    starter:'strings -n 8 collector.bin',newPart:"| grep -F 'request_id='",task:'stringsの結果をgrep -Fへ渡し、request_id=を含む行だけを表示してください。',
    hints:['読める文字列を取り出してから、行を絞ります。','固定文字列としてrequest_id=を検索します。',"strings -n 8 collector.bin | grep -F 'request_id=' と入力します。"],
    solution:["strings -n 8 collector.bin | grep -F 'request_id='"],success:'収集データから処理IDの断片を取り出せました。',bridge:'次は、Base64で表現されたデータを元の文字へ戻します。',
    validation:{all:[used('strings'),used('grep'),pipe(2),out('request_id=req-02')]}});

  add({id:'ad-10-base64',chapter:'ad-transform',title:'Base64を戻して項目を読む',
    goal:'表現を戻す処理とJSON抽出をパイプでつなげる。',
    explanation:['Base64はデータを英数字などの文字列で表す方式です。暗号ではありません。base64 -dで元のデータに戻せます。','payload.b64はJSONをBase64にした教材です。戻すとrequest_id（処理ID）とresult（結果）の二つのキーがあります。まず復元した本文を見てからjqへ渡しましょう。この教材ではUTF-8テキストへの復元を扱います。'],
    concepts:[{term:'デコード',text:'表現を元に戻す処理です。base64 -dの出力は次のコマンドの入力にできます。'}],
    example:{command:'base64 -d sample.b64',note:'readyと改行が復元されます。payload.b64も同じ操作で本文を確認できます。'},
    starter:'base64 -d payload.b64',newPart:"| jq -r '.request_id'",task:'payload.b64をデコードし、jqでrequest_idの値req-02だけを表示してください。',
    hints:['まずbase64 -d payload.b64でJSONが見えるか確認します。','その右にjq -rをつなぎ、.request_idを指定します。',"base64 -d payload.b64 | jq -r '.request_id' と入力します。"],
    solution:["base64 -d payload.b64 | jq -r '.request_id'"],success:'表現を戻す処理から、構造を読む処理へつなげられました。',bridge:'次は、区切りの数に依存せず末尾の項目を取り出します。',
    validation:{all:[used('base64'),used('jq'),pipe(2),out('req-02')]}});

  add({id:'ad-11-rev',chapter:'ad-transform',title:'末尾の区切りから取り出す',
    goal:'awkの区切りとNFで、最後の拡張子を取り出せる。',
    explanation:['object-names.txtにはgateway.access.logなど、ピリオドが複数ある名前が並びます。awk -F.でピリオド区切りにし、$NFで最後の列を選ぶと拡張子を取り出せます。','参考として、revで各行の文字を逆にし、cutで先頭の項目を取り、再度revで戻す方法もあります。revは文字の逆順、tacは行の逆順です。今回は短く書けるawkを本線にします。'],
    concepts:[{term:'$NF',text:'その行の最後のフィールドです。区切りの数が行ごとに違っても末尾を選べます。'}],
    example:{command:"rev object-names.txt | cut -d '.' -f 1 | rev",note:'revを使う別解です。同じ結果をawk -F.と$NFなら一つのコマンドで取り出せます。'},
    starter:"awk -F. '{print $1}' object-names.txt",newPart:'$NF',task:'object-names.txtから最後の拡張子を取り出し、log、json、logの順に表示してください。awkでもrevを使う別解でも構いません。',
    hints:['区切りはピリオドです。awkの-F.で指定します。','最後のフィールドの番号はNFです。値として読むときは$NFにします。',"穴埋め：awk -F. '{print ___}' object-names.txt。最後のフィールドを指定します。"],
    solution:["awk -F. '{print $NF}' object-names.txt"],success:'行ごとに区切りの数が違っても、末尾の項目を取り出せました。',bridge:'次は、二つの記録の違いを調べます。',
    validation:{all:[source('object-names.txt','last'),out('log\njson\nlog')]}});

  add({id:'ad-12-diff',chapter:'ad-compare',title:'基準と現在の差を見る',mode:'guide',
    goal:'diff -uの追加・削除の記号と、差がある終了コード1を理解する。',
    explanation:['baseline.confは基準、current.confは現在の設定です。retentionは保存日数、formatは出力形式です。diff -uは2ファイルの違いと周辺の行を表示します。','---は比較元、+++は比較先の見出しです。実機ではファイル名に更新日時も付きますが、この教材では日時を省略します。本文の-は元にだけある行、+は先にだけある行、空白は共通行です。@@は比較した行の範囲です。diffの終了コードは0が同じ、1が差あり、2以上がエラーです。この課題では差ありの1が正しい結果です。'],
    concepts:[{term:'統一形式の差分',text:'変わった行を-と+で示し、周囲の共通行も載せる形式です。差があるだけでは異常と断定できません。'}],
    example:{command:'diff -u baseline.conf baseline.conf',note:'同じものを比較するので出力は空、終了コードは0です。'},
    task:'diff -uでbaseline.confからcurrent.confへの違いを表示してください。保存日数が7から14へ変わっています。',
    hints:['比較元を先、比較先を後に書きます。','結果の-retention=7と+retention=14を確認しましょう。','diff -u baseline.conf current.conf と入力します。終了コード1はこの課題では差の検出です。'],
    solution:['diff -u baseline.conf current.conf'],success:'保存日数の変更を、基準からの差として示せました。',bridge:'次は、行の位置ではなく名前の集合を比べます。',
    validation:{all:[used('diff'),{type:'status',command:'diff',code:1},out('--- baseline.conf\n+++ current.conf\n@@ -1,2 +1,2 @@\n-retention=7\n+retention=14\n format=json\n','exact')]}});

  add({id:'ad-13-set-prepare',chapter:'ad-compare',title:'比較用の一覧を整える',
    goal:'重複のある観測結果を、整列済みの集合として保存できる。',
    explanation:['observed-users.txtは観測された名前で、同じ名前が何度も出ます。今回は回数ではなく「登場したか」を比較します。','sort -uは並べ替えながら重複を除きます。次に使うcommは両方の入力が同じ基準で整列済みである必要があります。並べてから保存する準備も調査の一部です。'],
    concepts:[{term:'集合としての一覧',text:'各名前を1回ずつ載せた一覧です。回数を調べる集計とは目的が異なります。'}],
    example:{command:'sort -u observed-users.txt',note:'aki、mei、ren、sotaがそれぞれ1回ずつ並びます。'},
    starter:'sort -u observed-users.txt',newPart:'| tee observed.sorted',task:'観測された名前を整列・重複除去し、表示すると同時にobserved.sortedへ保存してください。',
    hints:['sort -uの結果をteeで受け取ります。','保存先は現在地のobserved.sortedです。','sort -u observed-users.txt | tee observed.sorted と入力します。'],
    solution:['sort -u observed-users.txt | tee observed.sorted'],success:'次の比較に渡せる一覧ができました。',bridge:'整列済みの一覧で、新しく登場した名前を探します。',
    validation:{all:[used('sort'),used('tee'),pipe(2),out('aki\nmei\nren\nsota'),saved('observed.sorted','aki\nmei\nren\nsota')]}});

  add({id:'ad-14-comm-new',chapter:'ad-compare',title:'現在だけにある名前を探す',
    goal:'commで二つ目のファイルだけにある行を取り出せる。',
    explanation:['commは整列済みの2ファイルを比べます。標準では1列目が一つ目だけ、2列目が二つ目だけ、3列目が両方にある行です。','-1、-2、-3はその列を隠します。-13なら1列目と3列目を隠し、二つ目だけの名前が残ります。baseline-users.txtとcurrent-users.sortedは整列済み・重複なしで用意してあります。'],
    concepts:[{term:'comm -13',text:'一つ目に存在せず、二つ目に存在する行だけを表示します。'}],
    example:{command:'comm -23 current-users.sorted baseline-users.txt',note:'比較順を逆にすると、一つ目だけの列でもsotaを取り出せます。順番と隠す列は組み合わせで考えます。'},
    task:'baseline-users.txtを一つ目、current-users.sortedを二つ目に指定し、現在だけにある名前sotaをcommで表示してください。',
    hints:['残したいのは2列目です。','1列目と3列目を隠す指定は-13です。','comm -13 baseline-users.txt current-users.sorted と入力します。'],
    solution:['comm -13 baseline-users.txt current-users.sorted'],success:'基準にない名前を集合の差として取り出せました。',bridge:'同じ道具で、共通する名前も取り出せます。',
    validation:{all:[used('comm'),source('baseline-users.txt','last'),source('current-users.sorted','last'),out('sota')]}});

  add({id:'ad-15-comm-common',chapter:'ad-compare',title:'両方にある名前を探す',
    goal:'commの隠す列を変えて共通部分を選べる。',
    explanation:['今回は、基準にも現在にも登場する名前を取り出します。commの3列目が共通部分です。','-12を付けて1列目と2列目を隠します。どの列を表示する指定なのかと取り違えず、「隠す番号」として読みます。'],
    concepts:[{term:'共通部分',text:'どちらの一覧にも含まれる行です。comm -12で抽出できます。'}],
    example:{command:'comm -12 baseline-users.txt baseline-users.txt',note:'同じ一覧同士なら、すべての名前が共通になります。'},
    starter:'comm -13 baseline-users.txt current-users.sorted',newPart:'-12',task:'基準と現在に共通するaki、mei、renをcommで表示してください。',
    hints:['共通部分は3列目なので、3を隠してはいけません。','一つ目だけと二つ目だけを隠します。','comm -12 baseline-users.txt current-users.sorted と入力します。'],
    solution:['comm -12 baseline-users.txt current-users.sorted'],success:'同じ資料から、目的に合わせて共通部分を取り出せました。',bridge:'次は二つの列を横に並べます。',
    validation:{all:[used('comm'),source('baseline-users.txt','last'),source('current-users.sorted','last'),out('aki\nmei\nren')]}});

  add({id:'ad-16-paste',chapter:'ad-compare',title:'同じ順番の二つの列を横に並べる',
    goal:'pasteで、行が対応しているファイルを横に結合できる。',
    explanation:['request-ids.txtの各IDとrequest-times.txtの各時刻は、同じ行番号が同じ出来事に対応しています。pasteは1行目同士、2行目同士のように横へ並べます。','-dで出力の区切りを選べます。IDが同じかを確認して結ぶ操作ではないため、順番が違う資料をそのままpasteすると誤った対応になります。'],
    concepts:[{term:'paste',text:'ファイルの行の位置をそろえて横に並べます。キーで照合するjoinは次の章で扱います。'}],
    example:{command:'paste request-ids.txt request-times.txt',note:'標準ではIDと時刻の間がタブになります。'},
    task:'paste -dを使い、ID,時刻の形で3行を表示してください。最初の行はreq-01,00:00です。',
    hints:['区切り文字にカンマを指定します。','左側にIDファイル、右側に時刻ファイルを渡します。',"paste -d ',' request-ids.txt request-times.txt と入力します。"],
    solution:["paste -d ',' request-ids.txt request-times.txt"],success:'対応関係を確認した二つの列を横に並べられました。',bridge:'順番だけに頼らず、IDを使って照合する方法へ進みます。',
    validation:{all:[used('paste'),out('req-01,00:00\nreq-02,00:01\nreq-03,00:02')]}});

  add({id:'ad-17-join',chapter:'ad-link',title:'IDを使って二つの記録を結ぶ',mode:'guide',
    goal:'整列済みの二つのファイルを共通キーで結合できる。',
    explanation:['status-by-id.txtは「ID ステータス」、actors-by-id.txtは「ID 名前」です。どちらも1列目のID順に整列してあります。','joinは標準で1列目をキーとして照合し、同じIDの項目を横に結びます。出力は「ID ステータス 名前」です。キーは各ファイルで一意です。重複したキーがあると対応の組み合わせが増える点にも注意します。'],
    concepts:[{term:'キー',text:'記録同士の対応を決める共通の値です。ここではreq-01などの処理IDです。'}],
    example:{command:'join actors-by-id.txt status-by-id.txt',note:'名前側を先に結ぶと、ID・名前・ステータスの順になります。最初の行はreq-01 aki 200です。課題では入力の順を変えます。'},
    task:'joinでstatus-by-id.txtとactors-by-id.txtを結び、ID・ステータス・名前の4行を表示してください。',
    hints:['joinの後ろに、結びたい二つのファイルを書きます。','出力順のため、ステータス側を先にします。','join status-by-id.txt actors-by-id.txt と入力します。'],
    solution:['join status-by-id.txt actors-by-id.txt'],success:'別々の資料にあるステータスと名前をIDで結べました。',bridge:'結合した結果に、条件を加えてみましょう。',
    validation:{all:[used('join'),out('req-01 200 aki\nreq-02 503 ren\nreq-03 200 aki\nreq-04 500 mei')]}});

  add({id:'ad-18-join-filter',chapter:'ad-link',title:'結合した結果を条件で絞る',
    goal:'joinからawkへ渡し、複数資料にまたがる問いへ答えられる。',
    explanation:['joinの出力は1列目がID、2列目がステータス、3列目が名前です。500以上のステータスが記録された処理のIDと名前を取り出します。','awkの$2 >= 500は数値の比較です。比較後にprint $1, $3とすれば、元の別々のファイルから来た項目を一緒に表示できます。'],
    concepts:[{term:'結合してから抽出',text:'まず共通キーで資料をそろえ、その結果に条件をかける流れです。'}],
    example:{command:"join status-by-id.txt actors-by-id.txt | awk '$2 == 200 {print $1, $3}'",note:'成功側のreq-01 akiとreq-03 akiが表示されます。'},
    starter:'join status-by-id.txt actors-by-id.txt',newPart:"| awk '$2 >= 500 {print $1, $3}'",task:'結合後にステータス500以上の行を選び、IDと名前だけを表示してください。',
    hints:['joinを左、awkを右に置きます。','条件は$2 >= 500、表示する列は$1と$3です。',"join status-by-id.txt actors-by-id.txt | awk '$2 >= 500 {print $1, $3}' と入力します。"],
    solution:["join status-by-id.txt actors-by-id.txt | awk '$2 >= 500 {print $1, $3}'"],success:'一つのファイルには揃っていなかった情報を絞り込めました。',bridge:'ファイル名の一覧を別のコマンドに渡す方法も覚えます。',
    validation:{all:[used('join'),used('awk'),pipe(2),out('req-02 ren\nreq-04 mei')]}});

  add({id:'ad-19-xargs-info',chapter:'ad-link',title:'ファイル名を引数として渡す',
    goal:'標準入力の文字をxargsでコマンドの引数に変換できる。',
    explanation:['selected-files.txtにはbundle/a.logとbundle/b.logのパスが1行ずつあります。fileはパスを引数として受け取るため、一覧の本文を標準入力としてそのまま渡しても目的の形になりません。','xargsは標準入力の文字を引数に変えます。< selected-files.txtで一覧を読み込め、cat selected-files.txt | xargs ...でも同じです。-n 1は1引数ずつコマンドを呼び出す指定です。ここでは空白を含まない教材用パスを使います。一般の任意の名前には区切り方の設計が必要です。'],
    concepts:[{term:'標準入力と引数',text:'パイプは文字データを渡します。xargsは、その文字を後ろのコマンドの引数にする橋渡しです。'}],
    example:{command:'xargs -n 1 basename < selected-files.txt',note:'各パスにbasenameが呼ばれ、a.log、b.logが表示されます。'},
    starter:'xargs -n 1 basename < selected-files.txt',newPart:'file',task:'selected-files.txtを読み、xargsからfileを1ファイルずつ呼び出して、両方の形式を表示してください。',
    hints:['xargsへ< selected-files.txtで一覧を入力します。catからパイプで渡しても構いません。','呼び出すコマンドはfile、1回の引数は-n 1です。','cat selected-files.txt | xargs -n 1 file と入力します。'],
    solution:['xargs -n 1 file < selected-files.txt'],success:'一覧の文字を、コマンドへの引数として使えました。',bridge:'次は、一覧に載ったファイルの中身を連続して読みます。',
    validation:{all:[used('xargs'),source('selected-files.txt','last'),out('bundle/a.log: ASCII text\nbundle/b.log: ASCII text')]}});

  add({id:'ad-20-xargs-read',chapter:'ad-link',title:'対象一覧から本文を集めて絞る',
    goal:'一覧→引数→本文→抽出を一つのパイプにできる。',
    explanation:['xargsの後ろのコマンドをcatにすると、一覧に載った各ファイルの本文を読みます。その後にgrepをつなげれば、集めた本文を絞れます。','bundle/a.logはINFO boot、b.logはWARN retryの記録です。ここでは出所のファイル名を付けず、本文のWARN行だけを取り出します。出所を残したい場面では応用編のgrep -Hなどを選びます。'],
    concepts:[{term:'一覧から本文へ',text:'<で読むのはパス一覧、xargsが呼ぶcatが読むのは各ログの本文です。'}],
    example:{command:'xargs cat < selected-files.txt',note:'INFO bootとWARN retryが順番に表示されます。'},
    starter:'xargs cat < selected-files.txt',newPart:"| grep 'WARN'",task:'対象一覧から両方の本文を読み、WARNを含む行だけを表示してください。',
    hints:['前の段階で本文が集まっているため、最後は普通のgrepです。','grep側にファイル名を追加せず、標準入力を検索します。',"cat selected-files.txt | xargs cat | grep 'WARN' と入力します。"],
    solution:["xargs cat < selected-files.txt | grep 'WARN'"],success:'対象の一覧を出発点にして本文の抽出までつながりました。',bridge:'次は、ログの列数や数値を使った集計に取り組みます。',
    validation:{all:[used('xargs'),used('grep'),source('selected-files.txt','last'),out('WARN retry')]}});

  add({id:'ad-21-awk-nf',chapter:'ad-awk',title:'末尾から列の位置を数える',mode:'guide',minutes:5,
    goal:'行の長さが違うログから、NFを使って共通の項目を抽出できる。',
    explanation:['auth.logはSSH認証を模した記録です。「月 日 時刻 ホスト プロセス: 結果 password for 名前 from 送信元IP port 番号 ssh2」という並びです。Failedは失敗、Acceptedは成功です。IPは練習用の文書用アドレスです。','invalid user guestの行は名前の前の語が増えますが、末尾の「IP port 番号 ssh2」は共通です。NFはその行の列数、$(NF-3)は末尾から4番目の列です。固定の$11では全行を正しく扱えません。'],
    concepts:[{term:'NFと$(NF-3)',text:'NFはフィールド数です。$(NF-3)は計算した番号の列を参照します。ログの形式を先に確認して使います。'}],
    example:{command:"grep 'Failed password' auth.log | awk '{print NF, $NF}'",note:'通常の失敗行は14列、invalid userの行は16列です。どちらも最後はssh2です。'},
    starter:"grep 'Failed password' auth.log",newPart:"| awk '{print $(NF-3)}'",task:'Failed passwordの行を選び、送信元IPだけを元の順番で4行表示してください。',
    hints:['必要なIPは最後から4番目にあります。','awkの列番号としてNF-3という計算を使います。',"grep 'Failed password' auth.log | awk '{print $(NF-3)}' と入力します。"],
    solution:[failIP],success:'列数が違う行からも、共通の末尾構造を使ってIPを選べました。',bridge:'次は、行を表示する代わりにカウンタを増やします。',
    validation:{all:[used('grep'),used('awk'),source('auth.log','last'),pipe(2),out('192.0.2.20\n192.0.2.20\n192.0.2.30\n192.0.2.20')]}});

  add({id:'ad-22-awk-count',chapter:'ad-awk',title:'条件に合うたびに1を足す',
    goal:'awkのカウンタとENDで条件に合う件数を求められる。',
    explanation:[accessFields,'awkのcount++はcountに1を足します。ENDは全行を読み終えたあとに実行します。$3 >= 500に一致したときだけ数え、最後に合計を1回表示します。未設定の数値変数は0から始められます。'],
    concepts:[{term:'ENDとカウンタ',text:'行ごとに数を増やし、END {print count}で読み終えた集計値を表示します。'}],
    example:{command:"awk '$3 == 200 {count++} END {print count}' access.log",note:'200の行は3行あるため、3と表示されます。'},
    starter:"awk '$3 >= 500 {print $0}' access.log",newPart:'{count++} END {print count}',task:'awkでステータスが500以上の行を数え、件数3を表示してください。',
    hints:['表示のprint $0を、count++という加算に変えます。','全体を読み終えた後ろにEND {print count}を付けます。',"awk '$3 >= 500 {count++} END {print count}' access.log と入力します。"],
    solution:["awk '$3 >= 500 {count++} END {print count}' access.log"],success:'行ごとの処理から最後の集計結果を作れました。',bridge:'1ずつではなく、記録の数値を足す集計へ進みます。',
    validation:{all:[used('awk'),source('access.log','last'),out('3')]}});

  add({id:'ad-23-awk-sum',chapter:'ad-awk',title:'条件に合う数値を合計する',
    goal:'awkの+=で、特定の列の合計を求められる。',
    explanation:[accessFields,'total += $4は、その行の4列目をtotalへ足します。条件とENDは前の課題と同じ構造です。行の数ではなく、各行に記録された量を合計します。'],
    concepts:[{term:'+=',text:'右側の値を左側の変数へ加えます。total += $4は4列目の数値を加算します。'}],
    example:{command:"awk '$3 == 200 {total += $4} END {print total}' access.log",note:'200の行の300、250、150を足して700バイトになります。'},
    starter:"awk '$3 >= 500 {count++} END {print count}' access.log",newPart:'total += $4',task:'ステータス500以上の行の応答バイト数をawkで合計し、240を表示してください。',
    hints:['条件の$3 >= 500はそのまま使います。','count++をtotal += $4に変え、最後はtotalを表示します。',"awk '$3 >= 500 {total += $4} END {print total}' access.log と入力します。"],
    solution:["awk '$3 >= 500 {total += $4} END {print total}' access.log"],success:'80 + 40 + 120を、記録から自動的に合計できました。',bridge:'同じ考え方で、値ごとに別のカウンタを持てます。',
    validation:{all:[used('awk'),source('access.log','last'),out('240')]}});

  add({id:'ad-24-awk-groups',chapter:'ad-awk',title:'IPごとにカウンタを分ける',minutes:6,
    goal:'awkの連想配列で、キーごとの出現回数を数えられる。',
    explanation:['単一のcountでは全体の件数しか数えられません。count[値]と書くと、その値ごとに別のカウンタを持てます。これを連想配列と呼びます。','今回はFailed passwordの送信元IPがキーです。count[$(NF-3)]++でIPごとに加算し、ENDのfor (ip in count)で各キーを順に取り出します。キーを取り出す順番は一般のawkでは保証されないため、最後のsortで順序を決めます。'],
    concepts:[{term:'連想配列とfor',text:'名前付きの箱を複数持つ仕組みです。for (ip in count)は各キーをipに入れ、print count[ip], ipで件数とキーを出します。'}],
    example:{command:"grep 'Accepted password' auth.log | awk '{count[$(NF-3)]++} END {for (ip in count) print count[ip], ip}' | sort -k2,2",note:'成功側のIPごとに数えます。192.0.2.10と192.0.2.30が各1件です。'},
    starter:failIP,newPart:"{count[$(NF-3)]++} END {for (ip in count) print count[ip], ip}",task:'Failed passwordのIPごとの件数をawkで数え、IPの文字順に「件数 IP」で表示してください。',
    hints:['printでIPを出す部分をcount[IP]++へ変えます。','ENDで全キーの件数を表示し、sort -k2,2でIP列を並べます。',groupIP+' | sort -k2,2 と入力します。'],
    solution:[groupIP+' | sort -k2,2'],success:'一つのカウンタから、IPごとのカウンタへ広げられました。',bridge:'最後に件数順のランキングへ並べ、保存します。',
    validation:{all:[used('awk'),used('sort'),source('auth.log','last'),out('3 192.0.2.20\n1 192.0.2.30','lines')]}});

  add({id:'ad-25-awk-save',chapter:'ad-awk',title:'集計を順位付きの成果物にする',
    goal:'awkの集計に並べ替えと保存を加えて完成させられる。',
    explanation:['前の課題ではIPの文字順に並べました。今回は件数を数値として大きい順にします。sort -k1,1nrは1列目だけを数値・逆順のキーにします。','最後にteeをつなげ、画面に出した集計をip-ranking.txtにも保存します。元のauth.logはそのまま残ります。'],
    concepts:[{term:'集計 → 整列 → 保存',text:'awkが件数を作り、sortが順を決め、teeが結果を残す分担です。'}],
    example:{command:groupIP+' | sort -k1,1n',note:'数の小さい順にすると、1件のIP、3件のIPの順です。'},
    starter:groupIP+' | sort -k2,2',newPart:'sort -k1,1nr | tee ip-ranking.txt',task:'Failed passwordのIP別件数を多い順に表示し、同じ内容をip-ranking.txtに保存してください。今回は集計にawkを使います。',
    hints:['最後のsortを、1列目を数値の逆順にする指定へ変えます。','tee ip-ranking.txtを最後につなげます。',groupIP+' | sort -k1,1nr | tee ip-ranking.txt と入力します。'],
    solution:[groupIP+' | sort -k1,1nr | tee ip-ranking.txt'],success:'Logroomで使うIP別の集計を、段階ごとの役割を考えて作れました。',bridge:'次はJSONの入れ子や配列を同じように少しずつ処理します。',
    validation:{all:[used('awk'),used('sort'),used('tee'),source('auth.log','last'),out('3 192.0.2.20\n1 192.0.2.30','lines'),saved('ip-ranking.txt','3 192.0.2.20\n1 192.0.2.30','lines')]}});

  add({id:'ad-26-jq-nested',chapter:'ad-json',title:'JSONの中のさらに内側を読む',mode:'guide',
    goal:'ドットでキーをつなぎ、入れ子の値を取り出せる。',
    explanation:['manifest.jsonにはcollector（収集器）、files（ファイル名の配列）、events（出来事の配列）があります。collectorの中にはnameとzoneというキーがあります。','jqの.collector.nameは「collectorの中のname」を選びます。-rは文字列の引用符を外して表示する指定です。まずjq .で全体を見ることもできます。'],
    concepts:[{term:'入れ子',text:'値として別のオブジェクトや配列が入っている構造です。ドットをつなげて内側へ進みます。'}],
    example:{command:"jq -r '.collector.zone' manifest.json",note:'collectorのzoneにはUTCという文字列が入っています。'},
    task:'manifest.jsonから収集器のnameを取り出し、edge-01だけを表示してください。',
    hints:['収集器のキーはcollectorです。','その内側のnameへドットで進みます。',"jq -r '.collector.name' manifest.json と入力します。"],
    solution:["jq -r '.collector.name' manifest.json"],success:'階層をたどって、必要な値だけを取り出せました。',bridge:'次は配列の中の各記録を順に取り出します。',
    validation:{all:[used('jq'),source('manifest.json','last'),out('edge-01')]}});

  add({id:'ad-27-jq-array',chapter:'ad-json',title:'配列から一件ずつ取り出す',
    goal:'[]で配列を展開し、各記録の項目を取り出せる。',
    explanation:['manifest.jsonのeventsには6件の記録が配列として入っています。各記録のrequest.idが処理IDです。','配列は複数の値をまとめる構造です。.events[]は中身を一件ずつ流します。その後の.request.idは、流れてきた各記録に対して実行されます。引用符内の|はjqの処理をつなぐもので、シェルのパイプとは別です。'],
    concepts:[{term:'[]と[0]',text:'[]は各要素を展開し、[0]は最初の要素だけを選びます。添字は0から始まります。'}],
    example:{command:"jq -r '.events[0].request.id' manifest.json",note:'最初の記録だけならreq-01です。[]へ変えると全件を扱えます。'},
    starter:"jq -r '.events[0].request.id' manifest.json",newPart:'.events[] | .request.id',task:'events配列の全記録から、req-01〜req-06の処理IDを1行ずつ元の順番で表示してください。',
    hints:['最初の要素だけを選ぶ[0]を、全要素の[]に変えます。','配列を展開してから.request.idを選びます。',nestedIds+' と入力します。'],
    solution:[nestedIds],success:'配列の中の全記録に同じ操作を適用できました。',bridge:'各記録に条件をかけてみましょう。',
    validation:{all:[used('jq'),source('manifest.json','last'),out('req-01\nreq-02\nreq-03\nreq-04\nreq-05\nreq-06')]}});

  add({id:'ad-28-jq-select',chapter:'ad-json',title:'展開した記録を条件で選ぶ',
    goal:'配列の展開・条件の選択・項目の抽出を組み立てられる。',
    explanation:['eventsの各記録にはresultがあります。failedはこの教材で処理が失敗したという記録で、それだけで攻撃とは判断しません。','まず.events[]で一件ずつ取り出し、select(.result == "failed")で条件に合う記録だけを通し、最後に.request.idを選びます。IDだけにしてからではresultが失われるため、順番が大切です。'],
    concepts:[{term:'selectする順番',text:'条件判定に必要なキーがあるうちに絞り、そのあとで欲しい項目だけを取り出します。'}],
    example:{command:"jq -r '.events[] | select(.result == \"success\") | .request.id' manifest.json",note:'成功側のreq-01、req-03、req-06が表示されます。'},
    starter:nestedIds,newPart:'select(.result == "failed") |',task:'manifest.jsonのeventsからresultがfailedの記録だけを選び、処理IDを表示してください。',
    hints:['配列を展開した後、IDを取り出す前にselectを入れます。','文字列failedはjqの式の中でダブルクォートで囲みます。',failedIds+' と入力します。'],
    solution:[failedIds],success:'展開 → 選択 → 項目抽出の3段を組み立てられました。',bridge:'項目を二つ選んで、表の一行にします。',
    validation:{all:[used('jq'),source('manifest.json','last'),out('req-02\nreq-04\nreq-05')]}});

  add({id:'ad-29-jq-tsv',chapter:'ad-json',title:'必要な項目を表の行にする',
    goal:'jqで複数の値を配列にまとめ、TSVとして出力できる。',
    explanation:['失敗した処理のIDに、actor.name（名前）を追加します。[.request.id, .actor.name]は二つの値を一つの配列にまとめます。','@tsvは配列の値をタブ区切りの一行へ変換します。-rを付けると実際のタブが出ます。JSONをsortやjoinなどの行を扱う道具へ渡す準備になります。'],
    concepts:[{term:'TSVと@tsv',text:'TSVはタブで項目を区切る表です。@tsvはjqの配列をタブ区切りの文字列にします。'}],
    example:{command:"jq -r '.events[0] | [.request.id, .actor.name] | @tsv' manifest.json",note:'最初の記録をreq-01とakiの2列にします。'},
    starter:failedIds,newPart:'[.request.id, .actor.name] | @tsv',task:'resultがfailedの記録を「処理ID 名前」の2列のTSVで表示してください。並びは元の順番です。',
    hints:['最後の.request.idだけの部分を、二つの値の配列へ変えます。','配列の後ろに| @tsvを加えます。',"jq -r '.events[] | select(.result == \"failed\") | [.request.id, .actor.name] | @tsv' manifest.json と入力します。"],
    solution:["jq -r '.events[] | select(.result == \"failed\") | [.request.id, .actor.name] | @tsv' manifest.json"],success:'JSONから、他のコマンドにも渡せる2列の表を作れました。',bridge:'JSON Linesをまとめて集計する準備へ進みます。',
    validation:{all:[used('jq'),source('manifest.json','last'),out('req-02\tren\nreq-04\tmei\nreq-05\tren\n','exact')]}});

  add({id:'ad-30-jq-slurp',chapter:'ad-json',title:'JSON Linesを一つの配列にする',
    goal:'jq -sで複数のJSON記録を配列として扱える。',
    explanation:[jsonFields,'JSON Linesは最初から一つの配列ではありません。jq -sは入力のJSONをすべて集め、一つの配列としてフィルターに渡します。lengthは配列の要素数を返します。-sなしのlengthは各オブジェクトのキー数になり、意味が変わります。'],
    concepts:[{term:'-s（slurp）',text:'複数のJSONを一つの配列にまとめます。全件を比較したりグループ化する前に使います。'}],
    example:{command:"jq -s '.[0].request.id' audit.jsonl",note:'6件をまとめた配列の最初の記録を選び、"req-01"を表示します。'},
    task:'jq -sでaudit.jsonlを一つの配列として読み、記録の件数6を表示してください。',
    hints:['全体をまとめるため-sを付けます。','その配列にlengthを実行します。',"jq -s 'length' audit.jsonl と入力します。"],
    solution:["jq -s 'length' audit.jsonl"],success:'1行ずつの記録を、全体の配列として扱えました。',bridge:'まとめた配列を、名前ごとのグループに分けます。',
    validation:{all:[used('jq'),source('audit.jsonl','last'),out('6')]}});

  add({id:'ad-31-jq-group',chapter:'ad-json',title:'名前ごとのグループに分ける',minutes:5,
    goal:'group_byの出力が配列の配列であることを理解する。',
    explanation:[jsonFields,'group_by(.actor.name)は同じ名前の記録をまとめます。出力は「akiの記録の配列、meiの記録の配列、renの記録の配列」という配列です。.[]でグループを一つずつ取り出し、.[0].actor.nameでそのグループの名前を確認できます。'],
    concepts:[{term:'group_by',text:'指定した値が同じ要素をグループ化します。jqのgroup_byはキー順に整理してからグループを返します。'}],
    example:{command:"jq -s 'group_by(.actor.name) | length' audit.jsonl",note:'名前ごとのグループは3個なので3と表示されます。元の記録の6件とは別の数です。'},
    starter:"jq -s 'group_by(.actor.name)' audit.jsonl",newPart:'| .[] | .[0].actor.name',task:'audit.jsonlを名前でグループ化し、各グループの名前aki、mei、renを1行ずつ表示してください。',
    hints:['-sでまとめてからgroup_byします。','各グループを.[]で取り出し、その先頭の記録から名前を選びます。',"jq -sr 'group_by(.actor.name) | .[] | .[0].actor.name' audit.jsonl と入力します。"],
    solution:["jq -sr 'group_by(.actor.name) | .[] | .[0].actor.name' audit.jsonl"],success:'配列の中に配列がある構造を、一段ずつ扱えました。',bridge:'名前の隣に、グループの大きさを付けます。',
    validation:{all:[used('jq'),source('audit.jsonl','last'),out('aki\nmei\nren')]}});

  add({id:'ad-32-jq-group-count',chapter:'ad-json',title:'グループの件数をランキングにする',minutes:5,
    goal:'グループの名前とlengthを表にし、数値順へ並べられる。',
    explanation:['各グループはその名前の全記録を含む配列です。lengthを実行すれば、その名前の件数になります。[.[0].actor.name, length]は名前と件数の2要素です。','@tsvで表へ変え、引用符の外のパイプでsortへ渡します。sort -k2,2nrは2列目の件数を数値の大きい順に並べます。jqの中のパイプとシェルのパイプの境目を確認しましょう。'],
    concepts:[{term:'JSONからランキングへ',text:'まとめる → グループ化 → 各グループの名前と件数 → TSV → 数値順、という流れです。'}],
    example:{command:"jq -sr 'group_by(.actor.name) | .[] | [.[0].actor.name, length] | @tsv' audit.jsonl",note:'名前順でaki 2、mei 1、ren 3となります。ここへsortをつなぎます。'},
    starter:"jq -sr 'group_by(.actor.name) | .[] | [.[0].actor.name, length] | @tsv' audit.jsonl",newPart:'| sort -k2,2nr',task:'audit.jsonlの名前別の全記録件数を、名前・件数の2列で多い順に表示してください。',
    hints:['jqの各グループから名前とlengthを出します。','件数は2列目なのでsortのキーは-k2,2nrです。',"jq -sr 'group_by(.actor.name) | .[] | [.[0].actor.name, length] | @tsv' audit.jsonl | sort -k2,2nr と入力します。"],
    solution:["jq -sr 'group_by(.actor.name) | .[] | [.[0].actor.name, length] | @tsv' audit.jsonl | sort -k2,2nr"],success:'入れ子のJSON Linesから、全体のランキングまで組み立てられました。',bridge:'残りは、手順を自分で選ぶ統合実習です。',
    validation:{all:[used('jq'),used('sort'),source('audit.jsonl','last'),pipe(2),out('ren 3\naki 2\nmei 1','lines')]}});

  add({id:'ad-33-final-join',chapter:'ad-final',title:'統合① 失敗した処理の担当名を残す',mode:'challenge',minutes:6,
    goal:'別々の記録を照合して、必要な項目を成果物へまとめられる。',
    explanation:['status-by-id.txtにはIDとステータス、actors-by-id.txtにはIDと名前があります。どちらもID順に整列済みです。','ステータス500以上の記録について、ID・名前・ステータスをこの順番で取り出してください。手順は分割してもよく、同じ内容になる別の書き方も正解です。'],
    concepts:[{term:'今回の成果物',text:'二つの資料をIDで対応付け、条件に合う記録だけをfailed-actors.txtへ残します。'}],
    example:{command:'cat status-by-id.txt',note:'まず対象の列とステータスを確認できます。名前は相手の資料にあります。'},
    task:'二つの元ファイルを読み、ステータス500以上を「ID 名前 ステータス」でID順に表示し、failed-actors.txtへ保存してください。',
    hints:['IDをキーにjoinすると、ID・ステータス・名前の順になります。','awkで2列目を条件にし、print $1, $3, $2で並べます。',"join status-by-id.txt actors-by-id.txt | awk '$2 >= 500 {print $1, $3, $2}' | tee failed-actors.txt で作れます。"],
    solution:["join status-by-id.txt actors-by-id.txt | awk '$2 >= 500 {print $1, $3, $2}' | tee failed-actors.txt"],success:'二つの資料を照合し、必要な並びの成果物を作れました。',bridge:'次は、あるはずのIDと受信したIDの差を確認します。',
    validation:{all:[source('status-by-id.txt'),source('actors-by-id.txt'),out('req-02 ren 503\nreq-04 mei 500','lines'),saved('failed-actors.txt','req-02 ren 503\nreq-04 mei 500','lines')]}});

  add({id:'ad-34-final-missing',chapter:'ad-final',title:'統合② 届いていないIDを調べる',mode:'challenge',minutes:5,
    goal:'集合の向きを考え、期待一覧にだけある項目を抽出できる。',
    explanation:['expected-ids.txtは届く予定だったID、received-ids.txtは受信したIDです。両方とも整列済みで重複はありません。','今回は「期待にはあるが受信にはない」IDを求めます。比較の順番と、どの列を残すかを考えましょう。IDがない理由まではこの比較だけで分かりません。'],
    concepts:[{term:'差集合の向き',text:'AだけにあるものとBだけにあるものは別の結果です。問いに合う順番で比べます。'}],
    example:{command:'cat received-ids.txt',note:'実際に届いた一覧を確認できます。予定の一覧とは別の資料です。'},
    task:'二つの元ファイルを読み、届いていないIDを表示し、missing-ids.txtにも保存してください。',
    hints:['予定の一覧を一つ目、受信した一覧を二つ目として比較できます。','一つ目だけを残すには、commの2列目と3列目を隠します。','comm -23 expected-ids.txt received-ids.txt | tee missing-ids.txt で作れます。'],
    solution:['comm -23 expected-ids.txt received-ids.txt | tee missing-ids.txt'],success:'届いていないreq-02を、二つの資料から確認して保存できました。',bridge:'次は、ログ本文と集計を両方残します。',
    validation:{all:[source('expected-ids.txt'),source('received-ids.txt'),out('req-02'),saved('missing-ids.txt','req-02')]}});

  const failedAuth = lines([
    'Oct 25 09:00:00 gateway sshd[101]: Failed password for ren from 192.0.2.20 port 42001 ssh2',
    'Oct 25 09:02:00 gateway sshd[103]: Failed password for invalid user guest from 192.0.2.20 port 42003 ssh2',
    'Oct 25 09:03:00 gateway sshd[104]: Failed password for mei from 192.0.2.30 port 42004 ssh2',
    'Oct 25 09:04:00 gateway sshd[105]: Failed password for ren from 192.0.2.20 port 42005 ssh2'
  ]);
  add({id:'ad-35-final-auth',chapter:'ad-final',title:'統合③ 元の行と集計を一緒に残す',mode:'challenge',minutes:7,
    goal:'元の記録へ戻れる抜粋と、件数ランキングを同時に用意できる。',
    explanation:['auth.logのFailed passwordの記録を扱います。通常の名前の行とinvalid userを含む行では列数が違いますが、末尾の「IP port 番号 ssh2」は共通です。','集計だけでは個々の出来事を読み返せません。元の行を抜粋したファイルとIP別のランキングの両方を作ります。awkのカウンタでもsortとuniqでも、目的の結果になる方法を選べます。'],
    concepts:[{term:'抜粋と集計',text:'抜粋は元の行を保ち、集計は全体の傾向を示します。両方あれば件数から元の記録へ戻れます。'}],
    example:{command:'head -n 3 auth.log',note:'行の並びを確認し、IPの位置が末尾から数えられることを確かめます。'},
    task:'Failed passwordの4行を元の順でauth-failed.logに保存し、IP別件数を多い順で表示すると同時にauth-summary.txtへ保存してください。',
    hints:['最初の抽出にtee auth-failed.logを加えると、元の行を保存したまま次へ渡せます。','IPを$(NF-3)で取り出し、sort → uniq -c → sort -nrをつなげられます。',"grep 'Failed password' auth.log | tee auth-failed.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr | tee auth-summary.txt で作れます。"],
    solution:["grep 'Failed password' auth.log | tee auth-failed.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr | tee auth-summary.txt"],success:'元の4行と、3件・1件というIP別集計をセットで保存できました。',bridge:'最後は初めての記録を使い、JSONとテキストを結びます。',
    validation:{all:[source('auth.log'),saved('auth-failed.log',failedAuth,'exact'),out('3 192.0.2.20\n1 192.0.2.30','lines'),saved('auth-summary.txt','3 192.0.2.20\n1 192.0.2.30','lines')]}});

  add({id:'ad-36-final-crosslog',chapter:'ad-final',title:'卒業実習 JSONと本文を結ぶ調査',mode:'challenge',fixture:'ad-final',minutes:10,
    goal:'初めての複数資料から、照合・集計・保存の手順を自分で組み立てられる。',
    explanation:['今回は/home/analyst/advanced/finalから始まります。access.logは「UTC時刻 ID ステータス 応答バイト数」、audit.jsonlはtime・request.id・actor.name・resultを持つJSON Linesです。IDを共通キーとして対応付けます。','audit.jsonlのresultがfailedの処理を対象にします。reportsを作り、対応付けた明細、名前ごとの件数、応答バイト数の合計を保存してください。各資料のIDは一意で、今回の対象IDは両方にあります。途中の表を作っても、別の正しいコマンドでも構いません。'],
    concepts:[{term:'完成する3ファイル',text:'reports/failed.txtはID 名前 ステータス バイト数。reports/ranking.txtは件数 名前を件数の多い順。reports/bytes.txtは対象の応答バイト数合計です。'}],
    example:{command:"jq -r '[.request.id, .actor.name, .result] | @tsv' audit.jsonl",note:'まずJSONの全記録を表にして内容を確認できます。access.logもcatで列を確認してください。'},
    task:'resultがfailedの処理について、reports/failed.txtへID順の明細、reports/ranking.txtへ名前別件数の多い順、reports/bytes.txtへ応答バイト数合計を保存し、最後にその合計300を表示してください。',
    hints:['JSONから失敗したIDと名前を抽出して整列します。access.logからID・ステータス・バイト数を取り出して整列し、IDで結びます。','mkdir reportsで置き場を作ります。joinした明細を保存し、その2列目を件数集計、4列目をawkで合計します。',"mkdir reports → jq -r 'select(.result == \"failed\") | [.request.id, .actor.name] | @tsv' audit.jsonl | sort > failed-users.txt → awk '{print $2, $3, $4}' access.log | sort > request-status.txt → join failed-users.txt request-status.txt | tee reports/failed.txt → awk '{print $2}' reports/failed.txt | sort | uniq -c | sort -nr | tee reports/ranking.txt → awk '{total += $4} END {print total}' reports/failed.txt | tee reports/bytes.txt の順です。矢印ごとに一つずつ実行します。"],
    solution:[
      'mkdir reports',
      "jq -r 'select(.result == \"failed\") | [.request.id, .actor.name] | @tsv' audit.jsonl | sort > failed-users.txt",
      "awk '{print $2, $3, $4}' access.log | sort > request-status.txt",
      'join failed-users.txt request-status.txt | tee reports/failed.txt',
      "awk '{print $2}' reports/failed.txt | sort | uniq -c | sort -nr | tee reports/ranking.txt",
      "awk '{total += $4} END {print total}' reports/failed.txt | tee reports/bytes.txt"
    ],
    success:'発展編を完了しました。異なる形式の記録をIDで結び、明細・名前別件数・合計300バイトを自分の手順で用意できました。',
    bridge:'次はSOCroom-easyで記録の意味を学び、LogroomでLinuxコマンドを使った調査へ進みましょう。既に読解を学んだ方はLogroomで実践できます。',
    validation:{all:[source('final/audit.jsonl'),source('final/access.log'),{type:'directory',path:base+'/final/reports'},saved('final/reports/failed.txt','job-02 yui 503 90\njob-03 sora 500 60\njob-04 sora 503 150','lines'),saved('final/reports/ranking.txt','2 sora\n1 yui','lines'),saved('final/reports/bytes.txt','300'),out('300')]}});

  lessons.forEach(D.practiceHint);
  D.lessons.push(...lessons);
  D.glossary.push(
    {term:'パスを加工する道具',text:'basenameは末尾の名前、dirnameは親の場所、realpathは整理した絶対パスを表示します。ファイルの改名や移動はしません。',example:'realpath -e bundle/../access.log'},
    {term:'ファイル情報',text:'fileは形式、statは名前やバイト数、duは場所全体の大きさを調べます。教材のメタデータは仮想で、duは本文のサイズだけを合計します。',example:"stat -c '%n %s' ready.txt"},
    {term:'UTCとUNIX時刻',text:'ZはUTC、+09:00はUTCから9時間進んだ表記です。date -u -dでUTCへそろえ、@秒数ならUNIX時刻を指定できます。',example:"date -u -d @1792886400 '+%F %T %Z'"},
    {term:'stringsとBase64',text:'stringsは読める文字の断片を抽出します。base64 -dはBase64表現を元のデータへ戻します。Base64は暗号ではありません。',example:"base64 -d payload.b64 | jq -r '.request_id'"},
    {term:'rev',text:'各行の文字を逆順にします。行の順を逆にするtacとは異なります。',example:"rev object-names.txt | cut -d '.' -f 1 | rev"},
    {term:'diffの終了コード',text:'diffは0が同一、1が差あり、2以上がエラーです。-uは周辺行とともに-と+で差を示します。',example:'diff -u baseline.conf current.conf'},
    {term:'comm',text:'整列済みの2ファイルを比較します。1列目は一つ目だけ、2列目は二つ目だけ、3列目は共通。-123の数字は隠す列です。',example:'comm -13 baseline-users.txt current-users.sorted'},
    {term:'joinとpaste',text:'joinは整列済みの共通キーで照合します。pasteは行の位置で横に並べます。両者を選ぶ前に対応関係を確認します。',example:'join status-by-id.txt actors-by-id.txt'},
    {term:'xargs',text:'標準入力の文字をコマンドの引数へ変換します。-n 1なら1引数ずつ呼びます。空白を含む名前では区切り方にも注意します。',example:'cat selected-files.txt | xargs -n 1 file'},
    {term:'awkの集計',text:'count++は件数、total += $4は4列目の合計、count[値]++は値ごとの件数。ENDは全行の処理後に実行します。',example:"awk '$3 >= 500 {total += $4} END {print total}' access.log"},
    {term:'jqの配列と集計',text:'[]は各要素を展開、-sは入力全体を配列へ、group_byはキーでグループ化、lengthは配列の件数。@tsvは配列をタブ区切りの行へ変えます。',example:"jq -sr 'group_by(.actor.name) | .[] | [.[0].actor.name, length] | @tsv' audit.jsonl"}
  );
})(globalThis);
