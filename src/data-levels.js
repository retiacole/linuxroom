/* Additive metadata: v0.1 IDs and fixtures remain the beginner curriculum. */
(function (root) {
  'use strict';
  const D = root.LINUXROOM_DATA;
  D.release = '0.2';
  D.levels = [
    {id:'beginner', title:'初級編', subtitle:'一つずつ、つなげる', description:'現在地とファイル操作から、検索・列の抽出・集計・保存まで。短いコマンドを一段ずつ組み立てます。'},
    {id:'applied', title:'応用編', subtitle:'条件を選んで、整える', description:'正規表現、複数ファイル検索、文字の整形、条件付き集計。必要な記録を狙って取り出します。'},
    {id:'advanced', title:'発展編', subtitle:'比較して、組み合わせる', description:'差分・照合、JSONの集約、日時・ファイルの確認を組み合わせ、調査用の結果を作ります。'}
  ];
  D.lessons.forEach(lesson => {lesson.level = 'beginner';});
  D.chapters.forEach(chapter => {chapter.level = 'beginner';});
})(globalThis);
