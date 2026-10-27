/* Additive metadata: v0.1 IDs and fixtures remain the beginner curriculum. */
(function (root) {
  'use strict';
  const D = root.LINUXROOM_DATA;
  D.release = typeof module === 'object' && module.exports ? require('../package.json').version : '__RELEASE_VERSION__';
  D.levels = [
    {id:'beginner', title:'初級編', subtitle:'一つずつ、つなげる', description:'現在地とファイル操作から、検索・列の抽出・集計・保存まで。短いコマンドを一段ずつ組み立てます。'},
    {id:'applied', title:'応用編', subtitle:'条件を選んで、整える', description:'正規表現、複数ファイル検索、文字の整形、条件付き集計。必要な記録を狙って取り出します。'},
    {id:'advanced', title:'発展編', subtitle:'比較して、組み合わせる', description:'差分・照合、JSONの集約、日時・ファイルの確認を組み合わせ、調査用の結果を作ります。'}
  ];
  // Practice hints retain a blank so revealing the last hint still asks the learner to recall a step.
  D.practiceHint = lesson => {
    if (lesson.mode === 'guide' || lesson.hints[2].includes('穴埋め')) return lesson;
    const command = lesson.solution.at(-1);
    const segment = lesson.newPart && command.includes(lesson.newPart) ? lesson.newPart : command.match(/^\S+/)?.[0];
    const puzzle = segment ? command.replace(segment, '___') : command;
    lesson.hints[2] = '穴埋め：' + puzzle + '。___に、ここまでで学んだ操作や指定を補ってください。';
    return lesson;
  };
  D.glossary.push(
    {term:'入力リダイレクト <',text:'ファイルの本文を標準入力へ渡します。名前を引数として渡す操作との違いを意識しましょう。',example:'wc -l < names.txt'},
    {term:'標準エラー 2>',text:'エラーの説明は標準エラー2に出ます。2>/dev/nullはその表示を捨てますが、終了コードは変えません。',example:'cat missing.log 2>/dev/null'},
    {term:'終了コード $?',text:'直前のコマンドの終了コードです。0以外の意味はコマンドによって異なります。',example:'grep NOT_PRESENT session.log; echo $?'},
    {term:'接続 && と ;',text:'&&は左が成功したときだけ次を実行し、;は結果に関係なく次を実行します。本文を渡すパイプとは用途が異なります。',example:'mkdir -p reports && echo ready'}
  );
  // Explain implementation and platform differences where learners encounter them.
  D.lessons.find(item => item.id === "03-pwd").explanation.push("自由練習ではecho \"$HOME\" \"$USER\" \"$PWD\"でホーム・ユーザー名・現在地を読めます。whoamiはユーザー名、idは仮想のユーザーIDとグループを表示します。");
  D.lessons.find(item => item.id === "04-ls").explanation.push("ls /ではbin・etc・usr・var・proc・opt・root・devなどのLinuxのディレクトリ骨格を観察できます。この教材の中身は練習用です。ls -d */は今いる場所のディレクトリだけを末尾の/付きで表示します。");
  D.lessons.find(item => item.id === "17-awk").explanation.push("print $1, $3は区切り（標準は空白）を挟みます。print $1 \":\" $3は文字列連結で、コロン以外の区切りは入りません。length($0)はこの教材では文字数です。実機のgawkはUTF-8ロケールで文字数、mawkでは日本語がバイト数になる場合があります。");
  D.lessons.find(item => item.id === "19-cut").explanation.push("レビューで使われたGNU coreutils 9.4のcut -cはバイト単位です。この教材もその動作（Cロケール相当）に合わせ、UTF-8の「日本語」にcut -c1-3を使うと「日」になります。一方、GNU coreutils 9.11以降のUTF-8ロケールでは-cは文字単位です。バイトで切る意図はcut -bで明示できます。文字の途中で切ると表示が崩れ、この教材では不完全なUTF-8を置換文字で表示します。");
  D.lessons.find(item => item.id === "20-sort").explanation.push("この教材はCロケール相当の順序で並べます。実機のja_JP.UTF-8やen_US.UTF-8では大小文字の順序が変わることがあります。同じ順序で比較したいときはLC_ALL=C sortを使います。uniq -cの結果の並びにも、前のsortの順序が引き継がれます。");

  D.lessons.forEach(D.practiceHint);
  D.lessons.forEach(lesson => {lesson.level = 'beginner';});
  D.chapters.forEach(chapter => {chapter.level = 'beginner';});
})(globalThis);
