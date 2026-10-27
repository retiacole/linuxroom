# 更新履歴

## v0.5.0 — 2026-10-27

実Linuxとの比較レビューを受け、自由練習での差を修正しました。初級36・応用49・発展36の計121課題、56コマンドです。既存119課題のIDと相対的な順序、保存済みの進捗は維持します。

- `ls -d */`のディレクトリ限定と末尾`/`、ブレース展開、レビュー対象のGNU coreutils 9.4／Cロケール相当の`cut -c`バイト選択、`wc`の列幅、`ls -R`の末尾改行を修正。
- `ls -l`に`total`と可変幅の列を追加。ディレクトリのサイズ・リンク数、`du`の割当量は4 KiB単位の仮想ファイルシステムとして表示し、実機の値は環境依存であることを説明。
- `/bin`・`/etc`・`/usr`・`/var`・`/proc`・`/opt`・`/root`・`/dev`などのディレクトリ骨格を追加。
- `awk`の文字列連結、除算、`printf`、`substr`、フィールド代入、`!seen[$3]++`による重複除外を追加。
- `$HOME`・`$USER`・`$PWD`・`$OLDPWD`、`whoami`・`id`・`true`・`false`・`seq`を追加。
- `cat -A`／`-v`／`-T`／`-E`、`sha256sum`／`md5sum`、複数キーの`sort`と`-h`／`-V`、`find -print0`／`-exec`を追加。
- 応用編にCRLF・タブの可視化とSHA-256によるファイル照合の2課題を追加し、日本語・英語に対応。
- Cロケール相当の順序と`LC_ALL=C sort`、mawkとgawkの`length`、走査順、GNU coreutils 9.11以降での`cut -c`の文字対応と明示的な`cut -b`、UTF-8のバイト切り出し、`file`の版による表記差を教材内で説明。
- 追加機能、全課題の解答、言語切替、旧進捗の復元を回帰テストで確認。

The real-Linux review fixes silent differences in directory globs, byte selection, listing layout, counts and allocated sizes. It also adds awk formatting, beginner shell utilities, checksums, sort keys and safe virtual find actions. Two bilingual exercises cover hidden line endings and file hashes, bringing the curriculum to 121 lessons while preserving existing lesson IDs and saved work. Platform differences remain documented where learners encounter them. The cut byte model targets the reviewed coreutils 9.4/C-locale behavior; GNU 9.11 added character-aware -c in multibyte locales. Use -b to request bytes explicitly.

## v0.4.2 — 2026-10-26

- 集合イラストを学習用HTMLから取り除き、日本語・英語READMEの末尾へ移動しました。学習画面・進捗保存の挙動は維持しています。
- Moved the party illustration from the learning HTML to the end of the Japanese and English READMEs. Learning screens and saved progress keep their existing behavior.

## v0.4.1 — 2026-10-26

- ホームの教材紹介の末尾に、仲間と歩く集合イラストを追加しました。画面幅に合わせて表示し、画像も単一HTMLに同梱するためオフラインで利用できます。
- Added the party's journey illustration at the end of the home introduction. The image scales to the screen and is embedded in the standalone HTML for offline use.

## v0.3.0 — 2026-10-25

Fableのレビューを受け、実機との違いで誤解しやすい教材・シェルの挙動を修正しました。初級36・応用47・発展36の計119課題です。

### 教材と採点

- 応用編に11課題を追加：入力リダイレクト、`ls -lh`／`ls -lt`、400行のログの先頭・末尾・件数確認、`tail -n +2`、`head -c`、`&&`／`;`、標準エラーのリダイレクト、終了コード`$?`。
- `tr`などの入力で、ファイルを実際に読んだことを確認しながら`<`と`cat |`の別解を受け入れるように修正。
- `du`の課題をファイルだけの合計に変更。複数ファイル検索の結果は`sort`で順序を揃える練習に変更。
- `ls -1`を正解として受け入れ、`ls`の列表示、`diff -u`の日時、`file`の形式表記について実機との差を説明。
- 拡張子の抽出は`awk -F.`を本線とし、`rev`の組み合わせを参考例に変更。`awk`と`cut`の空白の扱いを説明し、卒業課題は`mkdir -p`を使用。
- 練習・チャレンジの3段目のヒントを穴埋め形式に変更。不正解時に出力の不足・余分・順序の違いを表示。

### ターミナルと画面

- `~`、`cd ~/logs`、`2>/dev/null`、`2>&1`、`$?`を扱い、`ls -l`に日時を表示。`man`は教材内ヘルプを開く別名として追加。
- `grep`のBRE／EREではJavaScript由来の`\d`／`\D`を受け入れず、使用できる文字クラスを案内。`awk -F.`はドットを区切り文字として扱うように修正。
- `No such file or directory`、`Is a directory`、`command not found`などのエラー文言と、それに対応する日本語フィードバックを整備。
- プロンプトにユーザー名・ホスト名・現在地を表示し、最初の課題で`$`／`#`の読み方を説明。
- ホームに自由練習とパイプの途中表示を紹介する入口を追加。各段の標準入力も確認可能。

### 保存と検証

- 旧108課題のID・相対的な順序・進捗を維持。長いログの閲覧課題では、既存の作業ファイルを残したまま新しいログだけを補充。
- 更新日時・終了コード・リダイレクトなどの実行記録も保存・復元。
- 全課題の解答、等価コマンドと誤答、旧版の保存データ移行、ブラウザ操作・モバイル表示を回帰テストに追加。

仮想シェルは引き続き学習用の部分実装です。`ls`の1列表示や教材版`man`など、意図的な違いは教材内とREADMEに記載しています。
