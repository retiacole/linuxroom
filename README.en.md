<p align="center">
  <img src="docs/images/linuxroom-banner.png" width="960" alt="Pixel art of the Linuxroom character casting fire magic in ancient ruins">
</p>

# Linuxroom v0.4.1

English · [日本語](README.md)

<img src="docs/images/linuxroom-character.png" align="right" width="120" alt="The Linuxroom character holding a staff and a book">

**Build your Linux command skills, one step at a time.**<br>
*ひとつずつ、つないでいこう。*

[Start in your browser](https://retiacole.github.io/linuxroom/) · [Download the offline HTML](https://github.com/retiacole/linuxroom/releases/latest/download/linuxroom.html)

Learn Linux commands one small step at a time. Linuxroom is a self-contained browser lab for navigating files, searching records, extracting fields, building pipelines and saving results. Inspect the actual input and output at each pipeline stage.

<br clear="right">

## Getting started

Open the hosted version or download `linuxroom.html` and open it locally. No installation, Linux machine or account is required. All lessons, styles, translations and code are included in the single HTML file. The exercises do not use the network.

Choose **English** in the header's **Language** menu. Japanese and English cover all 119 lessons, the learning map, hints, solution guidance, command reference, feedback and progress dialogs. Your choice is remembered in this browser and included in progress exports. Switching languages keeps your working files, current directory, command draft, history, completion records and revealed hints.

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
| Applied | 47 | Regular expressions, context, recursive search, text preparation, conditional aggregation and shell control |
| Advanced | 36 | Metadata, UTC time, comparisons, joins, awk aggregation, JSON arrays and cross-log investigation |

All 49 supported commands are practiced in solutions or runnable examples. The command reference links to related lessons. Each lesson has its own workspace, so you can revisit previous material without losing work in another lesson. Free practice is available from the home page and learning map.

The final exercises connect multiple sources and produce saved detail, counts and totals. After the beginner level, you can also continue to [SOCroom-easy](https://github.com/retiacole/socroom-easy) for reading logs and [Logroom](https://github.com/retiacole/logroom) for command-based log analysis.

## Terminal controls

| Key | Action |
| --- | --- |
| Enter | Run the command |
| ↑ / ↓ | Recall command history |
| Tab | Complete a command or filename; an empty input keeps normal Tab navigation |
| Ctrl + C | Clear the draft or close a viewer |
| Ctrl + L | Clear the terminal display |
| q in less / more | Close the viewer |

The prompt, such as `analyst@linuxroom:~/logs$`, shows the user, host and current directory. Type only the command after it. `help COMMAND` describes the supported subset. In this lab, `man COMMAND` opens the same teaching help in a viewer; on real Linux it opens the installed manual.

The shell is a simulation. It affects only virtual exercise files and implements a subset of real Linux behavior. Its file metadata is virtual, and `du` totals content bytes rather than real filesystem allocation. Use the command help to check supported options.

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

For browser checks, install Playwright Chromium or set `LINUXROOM_BROWSER_CHANNEL=chrome` to use an installed Chrome browser. `LINUXROOM_URL` can point the browser smoke test at a hosted copy.

`build.js` generates identical standalone files at `linuxroom.html`, `docs/index.html` and `docs/linuxroom.html`. Edit files under `src/`, then rebuild. English lesson copy is in `src/data-en.js`; the original concepts, example notes and progressive hints are translated in `src/concepts-en.js`, `src/examples-en.js` and `src/hints-en.js`. `src/i18n.js` contains presentation translations and language switching. Executable lesson definitions and fixtures remain in the original curriculum files.

The tests cover shell behavior, every lesson's validation, all 119 rendered lessons in Japanese and English, language switching, saved-state compatibility, storage denial, escaping, pagers and pipeline inspection. The HTML has no external dependencies or translation service.

## Credits and license

This app and curriculum were created using OpenAI Codex (AI). Its virtual shell extends the MIT-licensed implementation from [Logroom](https://github.com/retiacole/logroom). See [LICENSE](LICENSE) for the license.
