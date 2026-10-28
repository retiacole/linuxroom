<p align="center">
  <img src="docs/images/linuxroom-banner.png" width="960" alt="Pixel art of the Linuxroom character casting fire magic in ancient ruins">
</p>

# Linuxroom v0.6.2

Without a saved language choice, the app opens in Japanese when the browser’s primary language is Japanese, and in English otherwise. Saved language choices take priority; older saves without a language use the browser default.

English · [日本語](README.md)

<img src="docs/images/linuxroom-character.png" align="right" width="120" alt="The Linuxroom character holding a staff and a book">

**Build your Linux command skills, one step at a time.**<br>
*ひとつずつ、つないでいこう。*

**[Play Now](https://retiacole.github.io/linuxroom/)** · [Download the offline HTML](https://github.com/retiacole/linuxroom/raw/refs/heads/main/linuxroom.html)

Learn Linux commands one small step at a time. Linuxroom is a self-contained browser lab for navigating files, searching records, extracting fields, building pipelines and saving results. Inspect the actual input and output at each pipeline stage.

<br clear="right">

## Getting started

Open the hosted version or download `linuxroom.html` and open it locally. No installation, Linux machine or account is required. All lessons, styles, translations and code are included in the single HTML file. The exercises do not use the network.

Choose **English** in the header's **Language** menu. Japanese and English cover all 121 lessons, the learning map, hints, solution guidance, command reference, feedback and progress dialogs. Your choice is remembered in this browser and included in progress exports. Switching languages keeps your working files, current directory, command draft, history, completion records and revealed hints.

1. Select **Start the first lesson**, or choose a level or lesson from the learning map.
2. Read the explanation and exercise, type a command, and press Enter. Do not type the prompt itself.
3. Inspect the output. Use hints or the example solution whenever useful.
4. Check your work, then continue to the next lesson.
5. For pipelines, select a stage to compare its input and output.

Commands, filenames, fixture contents and answer checks are identical in both languages. The append exercise deliberately uses the exact sample strings `確認開始` (“check started”) and `確認完了` (“check complete”); its English instructions explain what to copy. Learner-created text and raw terminal output are never translated.

## Curriculum

| Level | Lessons | Topics |
| --- | ---: | --- |
| Beginner | 36 | Navigation, reading, grep, fields, pipes, counts, saving and JSON |
| Applied | 49 | Regular expressions, context, recursive search, text preparation, conditional aggregation and shell control |
| Advanced | 36 | Metadata, UTC time, comparisons, joins, awk aggregation, JSON arrays and cross-log investigation |

All 56 supported commands are practiced in solutions or runnable examples. The command reference links to related lessons. Each lesson has its own workspace, so you can revisit previous material without losing work in another lesson. Free practice is available from the home page and learning map.

The final exercises connect multiple sources and produce saved detail, counts and totals. After the beginner level, you can also continue to [SOCroom-easy](https://github.com/retiacole/socroom-easy) for reading logs and [Logroom](https://github.com/retiacole/logroom) for command-based log analysis.

Beginner lesson 12/36 accepts both `grep -n 'ERROR' app.log` and `cat -n app.log | grep 'ERROR'`. Number the original file before filtering to preserve the source line numbers.

## Terminal controls

| Key | Action |
| --- | --- |
| Enter | Run the command |
| ↑ / ↓ | Recall command history |
| → | After completing a lesson at any level, go to the next lesson when the command input is empty. Editing, selection and open dialogs keep their normal controls. |
| Tab | Complete a command or filename; an empty input keeps normal Tab navigation |
| Ctrl + C | Clear the draft or close a viewer |
| Ctrl + L | Clear the terminal display |
| q in less / more | Close the viewer |

The prompt, such as `analyst@linuxroom:~/logs$`, shows the user, host and current directory. Type only the command after it. `help COMMAND` describes the supported subset. In this lab, `man COMMAND` opens the same teaching help in a viewer; on real Linux it opens the installed manual.

The shell is a simulation. It affects only virtual exercise files and implements a subset of real Linux behavior. Its metadata is virtual. `ls -l` totals and `du -h` simulate 4 KiB allocation; directories have size 4096 and link count 2 plus immediate subdirectories. Real values depend on the filesystem. `du -b` reports apparent byte sizes. Use the command help to check supported options.

Sorting uses C-locale order. If mixed-case names sort differently on Linux, compare with `LC_ALL=C sort`. Real `find` and `grep -r` traversal order is not guaranteed; use `| sort` when comparing lists. This lab uses the byte-oriented `cut -c` behavior of GNU coreutils 9.4, as reviewed, equivalent to the C locale. GNU coreutils 9.11 and later select characters in UTF-8 locales. Use `cut -b` when bytes are intended. Cutting inside a UTF-8 character produces incomplete text, shown with replacement characters here. `awk length` counts characters here; real mawk may count bytes. `file` descriptions vary by version, including `CSV ASCII text`.

See the [GNU coreutils 9.11 release notes](https://github.com/coreutils/coreutils/blob/v9.11/NEWS#L35-L39) and [9.4 manual](https://github.com/coreutils/coreutils/blob/v9.4/doc/coreutils.texi#L5810-L5820) for the `cut` version difference.

The shell expands `$HOME`, `$USER`, `$PWD`, `$OLDPWD` and `$?`, and supports `whoami`, `id`, `true`, `false` and `seq`. `LC_ALL=C` and `LC_ALL=POSIX` prefixes state the supported ordering. Arbitrary variable assignments and full shell scripts remain outside the teaching subset. `ls /` presents a basic Linux directory skeleton. `seq` limits numeric precision and output size; values outside its supported range produce explicit errors.

New applied lessons reveal CRLF and tabs with `cat -A` and record file hashes with `sha256sum`, with a `md5sum` example for comparing existing records. The shell also supports awk concatenation, division, `printf`, `substr`, field assignment and deduplication; multiple sort keys, `sort -h` and `-V`; and `find -print0` and `-exec`.

## Saving and restoring

Progress and workspaces are saved automatically in local browser storage. Use **Save progress** to download or import a JSON file when moving between browsers or devices. Commands you entered are included in that export. If browser storage is blocked or full, a visible notice explains the download fallback.

Progress from v0.1, v0.2 and v0.3 remains supported. Older saves without a language preference default to Japanese. Restarting one exercise resets its files, location and draft while retaining completion and hint records. It does not reset other lessons.

## Development

Requires Node.js 22 or later.

```sh
npm ci
npm run build
npm test
npm run test:browser
```

With GNU coreutils and Bash available, `npm run test:native` runs 101 comparisons against native commands. It supports Linux command names and the g-prefixed names commonly used on macOS.

For browser checks, install Playwright Chromium or set `LINUXROOM_BROWSER_CHANNEL=chrome` to use an installed Chrome browser. `LINUXROOM_URL` can point the browser smoke test at a hosted copy.

`build.js` generates identical standalone files at `linuxroom.html`, `docs/index.html` and `docs/linuxroom.html`. Edit files under `src/`, then rebuild. English lesson copy is in `src/data-en.js`; the original concepts, example notes and progressive hints are translated in `src/concepts-en.js`, `src/examples-en.js` and `src/hints-en.js`. `src/i18n.js` contains presentation translations and language switching. Executable lesson definitions and fixtures remain in the original curriculum files.

The tests cover shell behavior, every lesson's validation, all 121 rendered lessons in Japanese and English, language switching, saved-state compatibility, storage denial, escaping, pagers and pipeline inspection. The HTML has no external dependencies or translation service.

## Credits and license

This app and curriculum were created using OpenAI Codex (AI). Its virtual shell extends the MIT-licensed implementation from [Logroom](https://github.com/retiacole/logroom). See [LICENSE](LICENSE) for the license.

<p align="center">
  <img src="assets/linuxroom-journey.png" width="100%" alt="The Room series characters walking together through the countryside">
</p>

## Optional review and next steps

The map includes a three-lesson preparation set: `ap-07-grep-fixed`, `ad-21-awk-nf`, and `ad-12-diff`. Choose any of them in any order. The separate “Try a different log” check lets you investigate a small SSH dataset in its own virtual shell, with optional hints. It does not alter your completion record, lesson workspace, or free-practice files. Work in this check lasts only until the page closes.

After each stage’s final exercise, optional suggestions point beginner learners to SOCroom-easy Intermediate and applied/advanced learners to Logroom. The existing next-lesson action continues from Beginner to Applied and from Applied to Advanced. You may instead review any lesson or use free practice, including after Advanced. There is no automatic navigation, cross-tool progress check, or shared completion record. Online links open another tab; offline links expect separately downloaded sibling HTML files. The version at the top is populated from package.json during the build.
