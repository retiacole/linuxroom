/* Browser-only virtual text shell for LogLab. No host processes or network access. */
(function (root) {
  'use strict';
  const MAX_INPUT = 8192, MAX_OUTPUT = 524288, MAX_FILE = 2097152;
  const COMMANDS = ['help','pwd','cd','ls','cat','tac','less','more','grep','rg','sort','uniq','cut','tr','column','nl','diff','jq','base64','tee','head','tail','wc','sed','awk','find','echo','printf','paste','comm','join','xargs','rev','strings','basename','dirname','realpath','file','stat','du','date','clear','history','mkdir','touch','cp','mv','rm','rmdir'];
  const USAGE = {
    help: 'help [command]', pwd: 'pwd', cd: 'cd [directory|-]',
    ls: 'ls [-1alhdtRSr] [path ...]', cat: 'cat [-n] [file ...]', tac: 'tac [file ...]',
    less: 'less [file ...]  (read-only viewer; q closes)', more: 'more [file ...]  (read-only viewer; q closes)',
    grep: 'grep [-EFiwvncrRlhHLqxo] [-m N] [-A N|-B N|-C N] [-e pattern ...] [--include glob|--exclude glob|--exclude-dir glob] [--] pattern [file ...]',
    rg: 'rg [-FiwvnclHhqo] [-A N|-B N|-C N] [-e pattern] [-g glob] [--no-heading] [--count] [pattern] [path ...] | rg --files [-g glob] [path ...]',
    sort: 'sort [-nrufbsc] [-k N[,M][nrfb]] [-t delimiter] [file ...]', uniq: 'uniq [-cdui] [-f fields] [-s characters] [file]',
    cut: 'cut [-d delimiter] -f fields [-s] [--complement] [--output-delimiter text] [file ...] | cut -c characters [file ...]',
    tr: 'tr [-cds] [--] SET1 [SET2]  (reads standard input)',
    column: 'column -t [-s delimiter-characters] [file ...]', nl: 'nl [-ba|-bt] [-w width] [-s separator] [file]',
    diff: 'diff [-u] [--] file1 file2', jq: 'jq [-rcs] [--] [filter] [file ...]',
    base64: 'base64 [-d|--decode] [-w columns] [file]', tee: 'tee [-a] [file ...]',
    head: 'head [-n N|-c N] [file ...]', tail: 'tail [-n N|+N] [-c N|+N] [file ...]', wc: 'wc [-lwmcL] [file ...]',
    sed: "sed [-nE] [-i[backup-suffix]] [-e script ...] [script] [file ...]",
    awk: "awk [-F separator] [-v name=value ...] '[BEGIN {...}] [/regex/|expression] {print field, ...} [END {...}]' [file ...]",
    find: 'find [path] [-type f|d] [-name glob|-iname glob] [-path glob] [-maxdepth N] [-mindepth N]', echo: 'echo [-n] [text ...]',
    printf: 'printf format [argument ...]', paste: 'paste [-s] [-d delimiters] [file ...]', comm: 'comm [-123] file1 file2',
    join: 'join [-1 N] [-2 N] [-t delimiter] [-a 1|2|-v 1|2] [-e text] [-o field-list] file1 file2',
    xargs: 'xargs [-0r] [-d delimiter] [-n N] [-I token] [virtual-command [argument ...]]', rev: 'rev [file ...]',
    strings: 'strings [-a] [-n minimum] [-t d|o|x] [file ...]', basename: 'basename [-a] [-s suffix] path [suffix]',
    dirname: 'dirname path ...', realpath: 'realpath [-m|-e] path ...', file: 'file [-bi] path ...',
    stat: 'stat [-c format] path ...', du: 'du [-acshb] [--max-depth N] [path ...]',
    date: 'date [-u] [-d ISO-date|@epoch] [+format]', mv: 'mv [-n] source destination', rmdir: 'rmdir [-p] directory ...',
    vi: 'vi [file]  (standalone only)', view: 'view [file]  (read-only editor; standalone only)',
    sl: 'sl  (steam locomotive; standalone only; wait until it passes)',
    clear: 'clear', history: 'history', mkdir: 'mkdir [-p] directory ...',
    touch: 'touch file ...', cp: 'cp source destination', rm: 'rm [-f] file ...'
  };
  class ShellError extends Error { constructor(message, code = 2) { super(message); this.code = code; } }
  const fail = (message, code) => { throw new ShellError(message, code); };
  const escRE = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
  const asLines = text => text === '' ? [] : text.endsWith('\n') ? text.slice(0,-1).split('\n') : text.split('\n');
  const lineChunks = text => text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const lineOutput = rows => rows.length ? rows.join('\n') + '\n' : '';
  const bytes = s => new TextEncoder().encode(s).length;
  const basename = p => p === '/' ? '/' : p.slice(p.lastIndexOf('/')+1);
  const dirname = p => p.slice(0,p.lastIndexOf('/')) || '/';
  const usageError = (cmd, message) => fail(cmd + ': ' + message + '\nUsage: ' + USAGE[cmd]);
  const posixClasses = p => p.replace(/\[:(alnum|alpha|blank|cntrl|digit|graph|lower|print|punct|space|upper|xdigit):\]/g, (_, k) => ({alnum:'A-Za-z0-9',alpha:'A-Za-z',blank:' \\t',cntrl:'\\x00-\\x1f\\x7f',digit:'0-9',graph:'!-~',lower:'a-z',print:' -~',punct:'!-/:-@\\[-`{-~',space:'\\s',upper:'A-Z',xdigit:'A-Fa-f0-9'}[k]));
  function basicRegex(pattern) {
    let out = '', bracket = false;
    for (let i=0; i<pattern.length; i++) {
      let c=pattern[i];
      if (c==='\\' && i+1<pattern.length) { let n=pattern[++i]; out += /[+?(){}|]/.test(n) && !bracket ? n : '\\'+n; }
      else { if(c==='[') bracket=true; if(c===']') bracket=false; out += !bracket && /[+?(){}|]/.test(c) ? '\\'+c : c; }
    }
    return out;
  }
  function regex(pattern, extended = true, insensitive = false) {
    if (pattern.length > 512) fail('regular expression exceeds 512 characters');
    let source=posixClasses(extended ? pattern : basicRegex(pattern));
    if (/\(\?/.test(source)) fail('regular expression lookarounds and special groups are unsupported');
    if (/\([^)]*[*+][^)]*\)[*+{]/.test(source)) fail('nested repeated groups are unsupported in this browser exercise; for an IPv4-shaped token use [0-9]{1,3}(\\.[0-9]{1,3}){3} with grep -E (this does not validate octet ranges)');
    try { return new RegExp(source, insensitive ? 'i' : ''); }
    catch (e) { fail('invalid regular expression: ' + e.message); }
  }
  function lex(input) {
    const tokens=[]; let value='', mask=[], started=false, quote=null,plain=true,tilde=false,tildeEnd=false,statusOffsets=[];
    const add=(c,unquoted) => { if(!started&&c==='~'&&unquoted)tilde=true;if(tilde&&c==='/'&&unquoted)tildeEnd=true;value+=c; mask.push(Boolean(unquoted && (c==='*'||c==='?'))); started=true; };
    const flush=()=>{ if(started) tokens.push({kind:'word',value,mask,tilde,statusOffsets}); value=''; mask=[]; started=false;plain=true;tilde=false;tildeEnd=false;statusOffsets=[]; };
    for(let i=0;i<input.length;i++) {
      const c=input[i];
      if(quote) {
        if(c===quote) { quote=null; continue; }
        if(quote==='"' && c==='\\' && i+1<input.length && /["\\$`\n]/.test(input[i+1])) { add(input[++i],false); continue; }
        if(quote==='"' && (c==='`'||(c==='$'&&input[i+1]==='('))) fail('command substitution is unsupported');
        if(quote==='"' && c==='$'&&input[i+1]==='?'){statusOffsets.push(value.length);add('$',false);add('?',false);i++;plain=false;continue;}
        if(quote==='"' && c==='$' && /[A-Za-z_?{0-9]/.test(input[i+1]||'')) fail('shell variable expansion is unsupported; use literal paths');
        add(c,false); continue;
      }
      if(c==='\''||c==='"') { if(!tildeEnd)tilde=false;quote=c; started=true;plain=false; continue; }
      if(c==='\\') { if(i+1===input.length) fail('unfinished escape');if(!tildeEnd)tilde=false;plain=false; add(input[++i],false); continue; }
      if(c==='`'||(c==='$'&&input[i+1]==='(')) fail('command substitution is unsupported; quote awk programs with single quotes');
      if(c==='$'&&input[i+1]==='?'){statusOffsets.push(value.length);add('$',false);add('?',false);i++;plain=false;continue;}
      if(c==='$' && /[A-Za-z_?{0-9]/.test(input[i+1]||'')) fail('shell variable expansion is unsupported; use literal paths');
      if(c==='\n'||c===';') { flush(); tokens.push({kind:'op',value:';'}); continue; }
      if(/\s/.test(c)) { flush(); continue; }
      if(c==='#'&&!started) break;
      if('|&><'.includes(c)) {
        const ioNumber=started&&plain&&/^\d+$/.test(value)?value:null;
        flush(); let op=c;
        if(input[i+1]===c && (c==='|'||c==='&'||c==='>')) op+=input[++i];
        else if(c==='>'&&input[i+1]==='&')op+=input[++i];
        if(op==='&') fail('background commands are unsupported');
        if(c==='<'&&input[i+1]==='<') fail('here documents are unsupported');
        tokens.push({kind:'op',value:op,ioNumber}); continue;
      }
      if(c==='('||c===')') fail('subshells are unsupported; quote expressions passed to awk');
      add(c,true);
    }
    if(quote) fail('unclosed '+(quote==='\''?'single':'double')+' quote');
    flush(); return tokens;
  }
  function parse(tokens) {
    const chains=[]; let pipeline=[], words=[], redirs=[], connector=';';
    const finishCommand=()=>{ if(!words.length) fail('expected command'); pipeline.push({words,redirs}); words=[]; redirs=[]; };
    for(let i=0;i<tokens.length;i++) {
      const token=tokens[i];
      if(token.kind==='word') { words.push(token); continue; }
      const op=token.value;
      if(op==='>'||op==='>>'||op==='<'||op==='>&') {
        if(!tokens[i+1]||tokens[i+1].kind!=='word') fail('redirection requires a filename');
        const fd=token.ioNumber===null||token.ioNumber===undefined?(op==='<'?0:1):Number(token.ioNumber);
        if(token.ioNumber!==null&&token.ioNumber!==undefined)words.pop();
        if(op==='<'?fd!==0:fd!==1&&fd!==2)fail('this file descriptor redirection is unsupported');
        const target=tokens[++i];
        redirs.push({op,fd,target}); continue;
      }
      if(op==='|') { finishCommand(); continue; }
      if(op===';'||op==='&&'||op==='||') {
        if(!words.length&&!pipeline.length) { if(op===';') continue; fail('unexpected '+op); }
        finishCommand(); chains.push({connector,pipeline}); pipeline=[]; connector=op;
      }
    }
    if(words.length||pipeline.length) { finishCommand(); chains.push({connector,pipeline}); }
    else if(connector==='&&'||connector==='||') fail('expected command after '+connector);
    if(chains.reduce((n,c)=>n+c.pipeline.length,0)>32) fail('a command line may contain at most 32 commands');
    return chains;
  }
  function takeValue(args, i, tail, cmd, option) {
    const value=tail||args[i+1];
    if(value===undefined) usageError(cmd,option+' requires a value');
    return {value,next:tail?i:i+1};
  }
  function simpleOptions(args, allowed, cmd) {
    const flags=new Set(), rest=[]; let end=false;
    for(const arg of args) {
      if(!end&&arg==='--') { end=true; continue; }
      if(!end&&arg.startsWith('-')&&arg!=='-') { for(const f of arg.slice(1)) { if(!allowed.includes(f)) usageError(cmd,'unsupported option -'+f); flags.add(f); } }
      else rest.push(arg);
    }
    return {flags,rest};
  }
  function rangeSelector(spec, cmd) {
    if(!spec) usageError(cmd,'a nonempty field list is required');
    const ranges=spec.split(',').map(s=>{
      let m=s.match(/^(\d+)(?:-(\d*))?$/);
      if(m) { const a=+m[1], b=m[2]===undefined?a:m[2]===''?Infinity:+m[2]; if(!a||b<a) usageError(cmd,'invalid range '+s); return [a,b]; }
      m=s.match(/^-(\d+)$/); if(m&&+m[1]) return [1,+m[1]];
      usageError(cmd,'invalid range '+s);
    });
    return index=>ranges.some(([a,b])=>index>=a&&index<=b);
  }
  class LogLabShell {
    constructor(files={},options={}) {
      this.files=Object.create(null); this.directories=new Set(['/','/home','/home/analyst','/tmp']);
      this.snapshotTime=Number.isFinite(options.snapshotTime)?options.snapshotTime:Date.UTC(2026,9,25,9);
      this.clock=typeof options.now==='function'?options.now:()=>options.now===undefined?Date.now():new Date(options.now).getTime();
      this.metadata=Object.create(null);this.lastExitCode=Number.isInteger(options.lastExitCode)?options.lastExitCode:0;
      this.cwd='/home/analyst'; this.oldcwd=this.cwd; this.history=[]; this.supportedCommands=COMMANDS.slice();
      for(const [path,content] of Object.entries(files)) { const p=this.resolve(path); this.files[p]=String(content); this.addParents(p);this.metadata[p]={mtime:this.snapshotTime}; }
      for(const [path,entry] of Object.entries(options.metadata||{})){const mtime=new Date(entry.mtime).getTime();if(Number.isFinite(mtime))this.metadata[this.resolve(path)]={mtime};}
    }
    resolve(path) {
      const parts=(String(path).startsWith('/')?String(path):this.cwd+'/'+String(path)).split('/'), out=[];
      for(const part of parts) { if(!part||part==='.') continue; if(part==='..') out.pop(); else out.push(part); }
      return '/'+out.join('/');
    }
    addParents(path) { let p=dirname(path); while(true) { this.directories.add(p); if(p==='/') break; p=dirname(p); } }
    isFile(path) { return Object.prototype.hasOwnProperty.call(this.files,path); }
    isDir(path) { return this.directories.has(path) || Object.keys(this.files).some(p=>p.startsWith(path==='/'?'/':path+'/')); }
    allPaths() { for(const p of Object.keys(this.files)) this.addParents(p); return [...new Set([...this.directories,...Object.keys(this.files)])].sort(cmp); }
    getMetadata(path) {const p=this.resolve(path);return this.metadata[p]||(this.metadata[p]={mtime:this.snapshotTime});}
    expand(token) {
      if(token.statusOffsets?.length){if(this._traceVariables)this._traceVariables.add('?');let value=token.value,mask=token.mask.slice();for(const at of [...token.statusOffsets].reverse()){const status=String(this._expansionStatus===undefined?this.lastExitCode:this._expansionStatus);value=value.slice(0,at)+status+value.slice(at+2);mask.splice(at,2,...Array(status.length).fill(false));}token={...token,value,mask};}
      if(token.tilde&&(token.value==='~'||token.value.startsWith('~/'))){const prefix='/home/analyst';token={...token,value:prefix+token.value.slice(1),mask:[...Array(prefix.length).fill(false),...token.mask.slice(1)]};}
      if(!token.mask.some(Boolean)) return [token.value];
      const segments=[]; let segment=[], offset=0;
      for(const part of token.value.split('/')) { const masks=token.mask.slice(offset,offset+part.length); offset+=part.length+1; if(!part||part==='.') continue; if(part==='..') segments.push({parent:true}); else segments.push({part,masks}); }
      const resolved=token.value.startsWith('/')?[]:this.cwd.split('/').filter(Boolean).map(part=>({part,masks:[]}));
      for(const seg of segments) { if(seg.parent) resolved.pop(); else resolved.push(seg); }
      const source='^/'+resolved.map(seg=>Array.from(seg.part).map((c,i)=>seg.masks[i]?(c==='*'?'[^/]*':'[^/]'):escRE(c)).join('')).join('/')+'$';
      const matcher=new RegExp(source), found=this.allPaths().filter(p=>matcher.test(p)&&resolved.every((seg,i)=>!seg.masks.some(Boolean)||seg.part[0]==='.'||!p.split('/')[i+1].startsWith('.'))).map(p=>token.value.startsWith('/')?p:this.relative(p));
      return found.length?found:[token.value];
    }
    relative(path) { const a=this.cwd.split('/').filter(Boolean),b=path.split('/').filter(Boolean); while(a.length&&b.length&&a[0]===b[0]) { a.shift();b.shift(); } return [...a.map(()=>'..'),...b].join('/')||'.'; }
    read(path, cmd='read') { const p=this.resolve(path);if(p==='/dev/null'){if(this._traceReads)this._traceReads.push(p);return '';} if(this.isDir(p)) fail(cmd+': '+path+': Is a directory',1); if(!this.isFile(p)) fail(cmd+': '+path+': No such file or directory',1); if(this._traceReads)this._traceReads.push(p); return this.files[p]; }
    inputs(paths, stdin, cmd) { return paths.length?paths.map(name=>({name,text:name==='-'?stdin:this.read(name,cmd)})):[{name:'-',text:stdin}]; }
    write(path,text,append=false,cmd='redirection') { const p=this.resolve(path);if(p==='/dev/null')return; if(this.isDir(p)) fail(cmd+': '+path+': Is a directory',1); if(!this.isDir(dirname(p))) fail(cmd+': '+path+': No such file or directory',1); const value=(append&&this.isFile(p)?this.files[p]:'')+text; if(value.length>MAX_FILE) fail(cmd+': '+path+': virtual file exceeds the 2 MiB text limit',1); this.files[p]=value;this.getMetadata(p).mtime=this.clock(); this.addParents(p); }
    getHelp(command) {
      if(command) {
        if(command==='man')return 'man COMMAND — この教材では help COMMAND をページ表示します。実機では man でマニュアルを読みます。\n';
        if(!COMMANDS.includes(command)) fail('help: unknown command '+command,1);
        let extra='';
        if(command==='grep') extra='\nDefault grep uses basic regex: + ? | ( ) are literal unless escaped; -E enables extended regex.\n-F matches literal text. -r/-R recurse (virtual filesystem has no symlinks); -m limits selected lines per file.\n-L lists files without matching lines. Exit status still follows line matches: 0 match, 1 no match, 2 error.\nLong aliases: --recursive, --ignore-case, --invert-match, --line-number, --count, --regexp,\n--fixed-strings, --extended-regexp, --word-regexp, --line-regexp, --only-matching, --quiet,\n--files-with-matches, --files-without-match, --max-count, --after-context, --before-context, --context.\n--include/--exclude filter basenames; --exclude-dir filters directory names with * and ? globs.\nPCRE (-P), binary options, and color flags are unsupported.';
        if(command==='rg') extra='\nSubset: extended regex by default, recursive paths, no headings; -n adds line numbers.\nWith piped input and no paths, search standard input. -g accepts quoted * / ** / ? patterns; ! excludes.\n--files lists files. Hidden paths are skipped unless --hidden. --count counts matching lines.\nPCRE (-P), replacements, ignore files, multiline matching, and other options are unsupported.';
        if(command==='awk') extra='\nSubset: print $N, $NF, $(NF-3), comma-separated expressions; -F regex separator; -v name=value.\nBEGIN supports scalar assignments (including FS/OFS/ORS) and print statements separated by semicolons.\nFilters: /regex/, fields, == != < <= > >=, ~ !~, && ||. Functions: length, tolower, toupper, int.\nCounters: {n++} END {print n}; sums: {sum += $N} END {print sum};\n{count[$1]++} END {for (key in count) print count[key], key}. END {print NR} counts records.\nOne record block and one END block; arbitrary loops, system(), printf, and field assignment are unsupported.';
        if(command==='sed') extra='\nAddresses: numbers, $, /regex/, and address ranges; actions p, d, and s/old/new/g.\n-n suppresses automatic printing. Multiple -e scripts and semicolon-separated commands run in sequence.\nSubstitution supports &, \\1…\\9, escaped delimiters, and g/p/i flags; -E enables extended regex.\n-i edits named virtual files only; an attached suffix (e.g. -i.bak) saves a backup.\nBranches, hold space, arbitrary insertion, and other sed actions are unsupported.';
        if(command==='sort') extra='\nOne field key range, including -k9,9nr; field-position syntax is unsupported.\n-n numeric, -r reverse, -f ignore case, -b ignore leading blanks, -s stable, -u unique, -c check order.\nDefault fields split on whitespace; -t changes the separator. Numbers use a leading signed decimal.\n-u keeps the first line per equal key. Sorting uses deterministic character order (no locale collation).';
        if(command==='tr') extra='\nTranslate, delete (-d), squeeze consecutive characters (-s), or complement SET1 (-c).\nSets support ASCII ranges, \\n \\r \\t \\\\, octal escapes, and [:lower:] [:upper:] [:digit:] [:alpha:]\n[:alnum:] [:space:] [:blank:] [:punct:] [:xdigit:] [:print:] [:graph:] [:cntrl:].\nComplemented translation requires one output character. Repeated-set syntax is unsupported.';
        if(command==='column') extra='\nOnly table mode is supported. Default input splits on whitespace; -s uses each delimiter character.\nCells are padded with two spaces. Quoted CSV fields and ANSI styling are unsupported.';
        if(command==='nl') extra='\nDefault numbers nonempty lines; -ba numbers every line, -bt numbers nonempty lines.\nDefault width 6 and tab separator. Page delimiters and numbering formats are unsupported.';
        if(command==='diff') extra='\nCompare two virtual text files. Default is normal diff; -u shows unified diff with 3 context lines.\nExit status: 0 identical, 1 different, 2 error. Comparison is limited to 2 million line-pair cells.\nUse filtered excerpts for larger comparisons. Whitespace-ignore and recursive modes are unsupported.';
        if(command==='jq') extra='\nSubset for JSON and JSONL: . , .field, .nested.field, .[N], .["key"], .[]; pipes and comma outputs.\nselect(.field == "value") supports comparisons and and/or; missing fields return null.\nAlso: length, keys, values, type, has("key"), contains("text"), test("regex"),\nsort, unique, sort_by(.field), group_by(.field), unique_by(.field), arrays [filter],\nobject projections {key: .field}, @csv, @tsv, and // fallback. -r raw strings, -c compact, -s slurp.\nAssignments, variables, functions, reduce, recursion, and other jq language features are unsupported.';
        if(command==='head'||command==='tail') extra='\n-n counts lines; -c counts UTF-8 bytes. -q hides headings; -v forces them.\nhead -n -N omits the final N lines; tail -n +N / -c +N starts at the Nth line/byte.\nA byte slice through a UTF-8 character displays a replacement character in this text terminal.\nLogs are static snapshots. tail -f/--follow cannot track new events; re-run tail after editing a file.';
        if(command==='base64') extra='\nEncode UTF-8 text or decode Base64 into UTF-8 text. Default output wraps at 76 columns.\n-w 0 disables wrapping. Binary data that is not valid UTF-8 is unsupported in this text filesystem.';
        if(command==='tee') extra='\nCopy standard input to virtual files and standard output. -a appends. All writes stay in memory.';
        if(command==='uniq') extra='\nConsecutive equal lines only. -i ignores case, -f skips fields, -s skips characters for comparison.\nOriginal first lines are retained. Use sort before uniq to group scattered equal values.';
        if(command==='wc') extra='\n-l newline count, -w whitespace-separated words, -m Unicode characters, -c UTF-8 bytes.\n-L maximum display width with 8-column tab stops. Multiple-file totals use the maximum for -L.';
        if(command==='cut') extra='\nFields/ranges: 1,3-5,7-, -3. -s omits lines without a delimiter; otherwise those lines pass through.\n--complement reverses selection; --output-delimiter changes field separation (or gaps between character ranges).';
        if(command==='ls') extra='\n-a includes dotfiles, -l shows virtual permissions/owner and text byte sizes, -h human sizes,\n-d lists directories themselves, -R recurses, -S sorts by size, -t newest first, -r reverses.\nModification times are simulated fixture metadata in UTC, updated by touch/writes; not host filesystem times.\nThis text terminal always shows one item per line; -1 is also accepted. Symlinks and permission changes are unsupported.';
        if(command==='find') extra='\nOne starting path. Name/path predicates combine with AND; -iname/-ipath ignore case.\nQuoted * and ? globs are supported. The starting path has depth 0; no -exec or boolean expressions.';
        if(command==='printf') extra='\nFormats: %s %b %c %d %i %u %o %x %X %f %e %E %g %G and %%.\nSupports numeric width/precision, -/0 padding, standard backslash escapes, \\xHH and octal.\nFormat repeats for extra arguments. Safe JavaScript integers only; %q/%n and dynamic widths are unsupported.';
        if(command==='paste') extra='\nDefault joins corresponding lines with tabs; -s joins each file in sequence.\n-d cycles delimiter characters; standard backslash escapes and \\0 for an empty delimiter are supported.';
        if(command==='comm') extra='\nInputs must be sorted in this lab\'s character order. Columns: only file1, only file2, common.\n-1/-2/-3 suppress columns; comm -12 shows shared lines. Unsorted inputs report an error.';
        if(command==='join') extra='\nInputs must be sorted by the join fields. -1/-2 select 1-based keys; -t selects one delimiter.\nRepeated -a1/-a2 retain unmatched rows; -v1/-v2 output only unmatched rows.\n-o supports comma/space-separated 0 (key), 1.N, 2.N; -e fills missing fields. Duplicate keys produce all pairs.';
        if(command==='xargs') extra='\nDefault splits quoted/escaped whitespace arguments; -0 and -d use literal delimiters.\n-n limits arguments per batch; -I replaces a token once per nonempty input line; -r skips empty input.\nDispatches existing virtual commands directly; no shell re-parsing, host commands, -P, or shell -c.\nNested xargs and editors are unsupported; at most 256 batches.';
        if(command==='strings') extra='\nExtract ASCII printable sequences (including tabs), default minimum length 4.\n-n sets the minimum; -t d/o/x prefixes UTF-8 byte offsets. -a scans the full virtual text.';
        if(command==='basename') extra='\nStrip directory and optional suffix. -a processes multiple paths; -s suffix also enables multiple paths.';
        if(command==='dirname') extra='\nReturn the lexical parent of each path; paths need not exist.';
        if(command==='realpath') extra='\nNormalize virtual absolute paths and .. / .; there are no symlinks.\nDefault requires an existing parent; -e requires the path to exist; -m permits missing parents.';
        if(command==='file') extra='\nClassify virtual text using its contents: empty, ASCII, UTF-8, JSON/JSONL, or data.\n-b suppresses filenames; -i gives a basic MIME/charset description. No executable or archive inspection.';
        if(command==='stat') extra='\nVirtual metadata only; no real owners, inode allocation, or device numbers.\n-c formats: %n name, %s text bytes, %F type, %a octal virtual mode, %A mode letters,\n%y simulated UTC modification time, %Y epoch modification seconds, %%.';
        if(command==='du') extra='\nVirtual logical text size, not physical disk allocation. Default units are rounded-up KiB.\n-b reports bytes, -h human sizes, -s summarizes, -a includes files, -c adds a total.\nDirectory allocation is not modeled; real du -b includes the size of each directory.\nTo total only file contents, use du -cb bundle/*.log | tail -n 1. --max-depth limits display depth.';
        if(command==='date') extra='\nBrowser clock by default; -u formats UTC. -d accepts timezone-qualified ISO, YYYY-MM-DD (UTC), or @epoch.\nFormats: %Y %m %d %e %H %M %S %F %T %s %z %Z %a %A %b %B %u %w %j %n %t %%.\nRelative dates, setting the clock, locale modes, and nanoseconds are unsupported.';
        if(command==='mv') extra='\nMove one virtual file or directory; -n preserves an existing destination. No interactive mode or merging directories.';
        if(command==='rmdir') extra='\nRemove empty virtual directories; -p also removes empty parents. Current directory and its ancestors are protected.';
        if(command==='rm') extra='\n-f removes virtual files without errors for missing files. Recursive deletion is unsupported. Files stay in this learning sandbox.';
        if(command==='rev') extra='\nReverse Unicode characters within each line; preserve line endings.';
        return USAGE[command]+extra+'\n';
      }
      return 'Linuxroom 学習用の仮想ターミナル — Linux コマンドの一部を再現\n'+
        'Commands: '+COMMANDS.join(', ')+'\n'+
        'Syntax: quotes, escapes, |, <, >, >>, 2>, 2>>, 2>&1, ;, &&, ||, unquoted ~ / * / ? and $? status.\n'+
        'Use help COMMAND for exact options. Files and redirects stay in virtual memory.\n'+
        'No host OS, server execution, package installation, general shell variables, scripts, or network.\n'+
        'less/more open the viewer; q closes. help は教材専用ヘルプ。実機では man COMMAND。man は教材ヘルプの別名です。\n';
    }
    complete(input) {
      const m=input.match(/(?:^|[\s|;])([^\s|;]*)$/); if(!m) return [];
      const prefix=m[1]; let first=false;
      try {const before=lex(input.slice(0,input.length-prefix.length));first=!before.length||(before[before.length-1].kind==='op'&&['|',';','&&','||'].includes(before[before.length-1].value));} catch(_){return [];}
      const paths=this.allPaths().map(p=>prefix.startsWith('/')?p:this.relative(p)).filter(p=>p.startsWith(prefix)).map(p=>this.isDir(this.resolve(p))?p+'/':p);
      return [...new Set([...(first?COMMANDS.filter(c=>c.startsWith(prefix)):[]),...paths])].sort(cmp);
    }
    isRootResetCommand(input) {
      input=String(input);
      if(input.length>MAX_INPUT||input.includes('\0'))return false;
      try {
        const chains=parse(lex(input));
        if(chains.length!==1||chains[0].pipeline.length!==1)return false;
        const command=chains[0].pipeline[0];
        if(command.redirs.length||command.words[0]?.value!=='rm')return false;
        const flags=new Set(),paths=[];let end=false;
        for(const word of command.words.slice(1)) {
          const value=word.value;
          if(!end&&value==='--'){end=true;continue;}
          if(!end&&value==='--recursive'){flags.add('r');continue;}
          if(!end&&value==='--force'){flags.add('f');continue;}
          if(!end&&value==='--no-preserve-root')continue;
          if(!end&&/^-[rfR]+$/.test(value)){for(const flag of value.slice(1))flags.add(flag.toLowerCase());continue;}
          if(!end&&value.startsWith('-'))return false;
          paths.push(value);
        }
        return flags.has('r')&&flags.has('f')&&paths.length===1&&paths[0]==='/';
      } catch(_){return false;}
    }
    run(input) {
      input=String(input);
      if(input.length>MAX_INPUT) {this.lastExitCode=2;return {stdout:'',stderr:'shell: input exceeds 8192 characters\n',code:2,trace:[],connectors:[],flow:[]};}
      if(input.includes('\0')) {this.lastExitCode=2;return {stdout:'',stderr:'shell: NUL bytes are unsupported\n',code:2,trace:[],connectors:[],flow:[]};}
      if(input.trim()) this.history.push(input);
      let stdout='',stderr='',code=this.lastExitCode,clear=false,pager=false;
      const trace=[],connectors=[],flow=[];
      try {
        const chains=parse(lex(input));
        connectors.push(...chains.slice(1).map(chain=>chain.connector));
        for(let pipeline=0;pipeline<chains.length;pipeline++) {
          const chain=chains[pipeline],executed=!(chain.connector==='&&'&&code!==0 || chain.connector==='||'&&code===0);
          flow.push({connector:chain.connector,pipeline,codeBefore:code,executed});
          if(!executed) continue;
          // All stages expand against the previous pipeline status, as in Bash.
          this._expansionStatus=code;
          let data='',last={stdout:'',stderr:'',code:0};
          for(let nodeIndex=0;nodeIndex<chain.pipeline.length;nodeIndex++) {
            const node=chain.pipeline[nodeIndex],pipeSink={kind:'stdout'},errorSink={kind:'stderr'},fds={1:pipeSink,2:errorSink},openedOutputs=new Set();
            let stdin=data,words=node.words.map(t=>t.value),redirections=[],argumentVariables=[],emittedStderr=false;
            const cwdBefore=this.cwd,reads=[],variables=new Set();
            this._traceReads=reads;this._traceVariables=variables;
            try {
              words=node.words.flatMap(t=>this.expand(t));
              argumentVariables=[...variables];
              for(const r of node.redirs) {
                if(r.op==='>&'){const targets=this.expand(r.target);if(targets.length!==1||!/^[12]$/.test(targets[0]))fail('descriptor duplication supports only 1 and 2');redirections.push({op:r.op,fd:r.fd,target:targets[0]});fds[r.fd]=fds[Number(targets[0])];continue;}
                const targets=this.expand(r.target);
                if(targets.length!==1) fail('ambiguous '+(r.op==='<'?'input':'output')+' redirection');
                const path=this.resolve(targets[0]);redirections.push({op:r.op,fd:r.fd,target:path});
                if(r.op==='<') stdin=this.read(targets[0],'redirection');
                else {if(path!=='/dev/null'&&openedOutputs.has(path))fail('independent redirects to the same file are unsupported; use > file 2>&1 to share one descriptor');openedOutputs.add(path);this.write(targets[0],'',r.op==='>>');fds[r.fd]={kind:'file',path:targets[0]};}
              }
              last=this.execute(words[0],words.slice(1),stdin,{hasStdin:nodeIndex>0||node.redirs.some(r=>r.op==='<')});
            } catch(e) {
              last={stdout:'',stderr:(e instanceof ShellError?e.message:'shell: internal error')+'\n',code:e instanceof ShellError?e.code:2};
            } finally { this._traceReads=null;this._traceVariables=null; }
            last.stdout=last.stdout||''; last.stderr=last.stderr||''; last.code=last.code||0;
            if(last.stdout.length>MAX_OUTPUT) { last.stdout=last.stdout.slice(0,MAX_OUTPUT);last.stderr+='shell: output truncated at 512 KiB; filter the data or redirect a smaller result\n';last.code=1;delete last.events; }
            data='';
            for(const [fd,chunk] of last.events||[[1,last.stdout],[2,last.stderr]]) {
              const sink=fds[fd];if(!chunk)continue;
              if(sink.kind==='stdout')data+=chunk;
              else if(sink.kind==='stderr'){stderr+=chunk;emittedStderr=true;}
              else try {this.write(sink.path,chunk,true);}
              catch(e) {const message=(e instanceof ShellError?e.message:'shell: internal error')+'\n';stderr+=message;emittedStderr=true;last.stderr+=message;last.code=e instanceof ShellError?e.code:2;}
            }
            trace.push({command:words[0]||'',args:words.slice(1),stdin,stdout:last.stdout,stderr:last.stderr,code:last.code,cwdBefore,cwdAfter:this.cwd,pipeline,index:nodeIndex,connector:chain.connector,redirections,argumentVariables,variables:[...variables],stderrRedirected:fds[2].kind!=='stderr'&&!emittedStderr,reads:[...new Set(reads)]});
            if(last.clear) clear=true;
            if(nodeIndex===chain.pipeline.length-1)pager=Boolean(last.pager&&fds[1]===pipeSink);
          }
          stdout+=data;code=last.code;
          if(stdout.length>MAX_OUTPUT) {stdout=stdout.slice(0,MAX_OUTPUT);stderr+='shell: total output truncated at 512 KiB\n';code=1;break;}
        }
      } catch(e) {stderr+=(e instanceof ShellError?e.message:'shell: internal error')+'\n';code=e instanceof ShellError?e.code:2;}
      finally {delete this._expansionStatus;}
      this.lastExitCode=code;
      return {stdout,stderr,code,trace,connectors,flow,...(clear?{clear:true}:{}),...(pager?{pager:true}:{})};
    }
    execute(cmd,args,stdin,context={}) {
      if(['vi','view','sl'].includes(cmd)) fail(cmd+': Linuxroom では利用できません。ファイルを読むには cat または less を使ってください。',127);
      if(!COMMANDS.includes(cmd)&&cmd!=='man') fail(cmd+': command not found. Type help for the supported training commands.',127);
      const result=(stdout='',code=0,extra={})=>({stdout,stderr:'',code,...extra});
      if(args.includes('--help')&&(args.indexOf('--')<0||args.indexOf('--help')<args.indexOf('--'))) return result(this.getHelp(cmd));
      switch(cmd) {
        case 'man': if(args.length!==1)fail('man: one command name is required',2);return result('Linuxroom 学習用ヘルプ — 実機の man マニュアルではありません。実機では man COMMAND で詳細を調べます。\n\n'+this.getHelp(args[0]),0,{pager:true});
        case 'help': if(args.length>1) usageError(cmd,'too many arguments'); return result(this.getHelp(args[0]));
        case 'pwd': if(args.length) usageError(cmd,'no options are supported'); return result(this.cwd+'\n');
        case 'clear': if(args.length) usageError(cmd,'no arguments are supported'); return result('',0,{clear:true});
        case 'sl': if(args.length)usageError(cmd,'no options or arguments are supported');return result('',0,{train:true});
        case 'history': if(args.length) usageError(cmd,'no arguments are supported'); return result(lineOutput(this.history.map((x,i)=>String(i+1).padStart(4)+'  '+x)));
        case 'cd': { if(args.length>1) usageError(cmd,'too many arguments'); const dest=args[0]==='-'?this.oldcwd:this.resolve(args[0]||'/home/analyst'); if(!this.isDir(dest)) fail('cd: '+(args[0]||dest)+': '+(this.isFile(dest)?'Not a directory':'No such file or directory'),1); const old=this.cwd;this.cwd=dest;this.oldcwd=old;return result(args[0]==='-'?dest+'\n':''); }
        case 'echo': { let n=false; if(args[0]==='-n'){n=true;args=args.slice(1);} if(args[0]==='-e'||args[0]==='-E') usageError(cmd,'escape expansion options are unsupported'); return result(args.join(' ')+(n?'':'\n')); }
        case 'ls': return result(runLs(this,args));
        case 'cat': {const {flags,rest}=simpleOptions(args,'n',cmd);let text='',stderr='',code=0,lineNumber=0,lineStart=true;const events=[];for(const path of rest.length?rest:['-']){try{let chunk=path==='-'?stdin:this.read(path,cmd);if(flags.has('n'))chunk=lineChunks(chunk).map(line=>{const numbered=(lineStart?String(++lineNumber).padStart(6)+'\t':'')+line;lineStart=line.endsWith('\n');return numbered;}).join('');text+=chunk;events.push([1,chunk]);}catch(e){if(!(e instanceof ShellError))throw e;stderr+=e.message+'\n';events.push([2,e.message+'\n']);code=1;}}return {stdout:text,stderr,code,events};}
        case 'zcat': case 'zgrep': case 'zless': {const decompression=this.decompressing;this.decompressing=true;try{if(cmd==='zgrep')return this.grep(args,stdin);const {rest}=simpleOptions(args,'',cmd);if(!rest.length||rest.includes('-'))usageError(cmd,'named gzip fixtures are required; binary standard input is unsupported');const texts=rest.map(path=>{const text=this.read(path,cmd);if(!this.getMetadata(path).compressed)fail(cmd+': '+path+': not in gzip format (use cat for plain text)',1);return text;});return result(texts.join(''),0,cmd==='zless'?{pager:true}:{});}finally{this.decompressing=decompression;}}
        case 'tac': {const {rest}=simpleOptions(args,'',cmd);return result(this.inputs(rest,stdin,cmd).map(f=>lineChunks(f.text).reverse().join('')).join(''));}
        case 'base64': return result(runBase64(this,args,stdin));
        case 'tee': {const {flags,rest}=simpleOptions(args,'a',cmd);let stderr='',code=0;for(const path of rest){try{this.write(path,stdin,flags.has('a'),cmd);}catch(e){if(!(e instanceof ShellError))throw e;stderr+=e.message+'\n';code=1;}}return {stdout:stdin,stderr,code};}
        case 'less': case 'more': { const {rest}=simpleOptions(args,'',cmd); return result(this.inputs(rest,stdin,cmd).map(f=>f.text).join(''),0,{pager:true}); }
        case 'grep': return this.grep(args,stdin);
        case 'rg': return this.rg(args,stdin,context.hasStdin);
        case 'sort': return runSort(this,args,stdin);
        case 'uniq': return result(runUniq(this,args,stdin));
        case 'cut': return result(runCut(this,args,stdin));
        case 'tr': return result(runTr(args,stdin));
        case 'column': return result(runColumn(this,args,stdin));
        case 'nl': return result(runNl(this,args,stdin));
        case 'diff': return runDiff(this,args,stdin);
        case 'jq': return result(runJq(this,args,stdin));
        case 'head': case 'tail': return result(runEnds(this,cmd,args,stdin));
        case 'wc': return result(runWc(this,args,stdin));
        case 'sed': return result(runSed(this,args,stdin));
        case 'awk': return result(this.awk(args,stdin));
        case 'find': return result(runFind(this,args));
        case 'printf': return result(runPrintf(args));
        case 'paste': return result(runPaste(this,args,stdin));
        case 'comm': return result(runComm(this,args,stdin));
        case 'join': return result(runJoin(this,args,stdin));
        case 'xargs': return runXargs(this,args,stdin);
        case 'rev': {const {rest}=simpleOptions(args,'',cmd);return result(this.inputs(rest,stdin,cmd).map(f=>lineChunks(f.text).map(chunk=>{const nl=chunk.endsWith('\n');return Array.from(nl?chunk.slice(0,-1):chunk).reverse().join('')+(nl?'\n':'');}).join('')).join(''));}
        case 'strings': return result(runStrings(this,args,stdin));
        case 'basename': case 'dirname': case 'realpath': return result(runPaths(this,cmd,args));
        case 'file': case 'stat': case 'du': return result(runMetadata(this,cmd,args));
        case 'date': return result(runDate(args));
        case 'mv': case 'rmdir': return result(runMove(this,cmd,args));
        case 'vi': case 'view': {const {rest}=simpleOptions(args,'',cmd);if(rest.length>1)usageError(cmd,'only one file is supported');const path=this.resolve(rest[0]||'/home/analyst/untitled.txt');if(this.isDir(path))fail(cmd+': '+path+': Is a directory',1);if(!this.isFile(path)){if(cmd==='view')fail('view: '+path+': No such file or directory',1);if(!this.isDir(dirname(path)))fail('vi: No such file or directory',1);}return result('',0,{editor:{path,text:this.isFile(path)?this.files[path]:'',readonly:cmd==='view'}});}
        case 'mkdir': { const {flags,rest}=simpleOptions(args,'p',cmd); if(!rest.length) usageError(cmd,'missing directory'); for(const name of rest) {const p=this.resolve(name);if(this.isFile(p)) fail('mkdir: '+name+': File exists',1);if(this.isDir(p)&&!flags.has('p')) fail('mkdir: '+name+': File exists',1);if(!flags.has('p')&&!this.isDir(dirname(p)))fail('mkdir: '+name+': No such file or directory',1);this.directories.add(p);this.addParents(p);}return result(); }
        case 'touch': { const {rest}=simpleOptions(args,'',cmd);if(!rest.length)usageError(cmd,'missing file');for(const name of rest){const p=this.resolve(name);if(!this.isFile(p)&&!this.isDir(p))this.write(name,'',false,cmd);this.getMetadata(p).mtime=this.clock();}return result(); }
        case 'cp': { const {rest}=simpleOptions(args,'',cmd);if(rest.length!==2)usageError(cmd,'exactly two paths are required');let to=this.resolve(rest[1]);if(this.isDir(to))to+=(to==='/'?'':'/')+basename(this.resolve(rest[0]));if(to===this.resolve(rest[0]))fail('cp: source and destination are the same file',1);this.write(to,this.read(rest[0],cmd),false,cmd);return result(); }
        case 'rm': { const {flags,rest}=simpleOptions(args,'f',cmd);if(!rest.length&&!flags.has('f'))usageError(cmd,'missing file');for(const name of rest){const p=this.resolve(name);if(this.isDir(p))fail('rm: '+name+': Is a directory',1);if(!this.isFile(p)&&!flags.has('f'))fail('rm: '+name+': No such file or directory',1);delete this.files[p];delete this.metadata[p];}return result(); }
      }
    }
    ls(args) {
      const {flags,rest}=simpleOptions(args,'alh','ls'), paths=rest.length?rest:['.'], sections=[];
      const format=(p,name)=>{ if(!flags.has('l'))return name;const dir=this.isDir(p),size=dir?0:bytes(this.files[p]);let shown=String(size);if(flags.has('h')&&size>=1024)shown=(size/1024).toFixed(size<10240?1:0)+'K';return (dir?'drwxr-xr-x':'-rw-r--r--')+' 1 analyst analyst '+shown.padStart(7)+' '+name; };
      for(const name of paths){const p=this.resolve(name);if(this.isFile(p)){sections.push(format(p,name));continue;}if(!this.isDir(p))fail('ls: '+name+': No such file or directory',1);let children=this.allPaths().filter(x=>x!==p&&dirname(x)===p).filter(x=>flags.has('a')||!basename(x).startsWith('.'));let rows=children.map(x=>format(x,basename(x)));if(flags.has('a'))rows=[format(p,'.'),format(dirname(p),'..'),...rows];sections.push((paths.length>1?name+':\n':'')+rows.join('\n'));}
      return sections.join('\n\n')+(sections.some(Boolean)?'\n':'');
    }
    rg(args,stdin,hasStdin) {
      const passed=[],patterns=[],paths=[],globs=[];let filesMode=false,hidden=false,after=false,fixed=false;
      const longFlags={'--no-heading':'','--count':'c','--line-number':'n','--no-filename':'h','--with-filename':'H','--files-with-matches':'l','--fixed-strings':'F','--ignore-case':'i','--invert-match':'v','--word-regexp':'w','--only-matching':'o','--quiet':'q'};
      for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}
        if(!after&&arg==='--files'){filesMode=true;continue;}if(!after&&arg==='--hidden'){hidden=true;continue;}
        if(!after&&Object.prototype.hasOwnProperty.call(longFlags,arg)){if(longFlags[arg])passed.push('-'+longFlags[arg]);if(arg==='--fixed-strings')fixed=true;continue;}
        if(!after&&(arg==='--glob'||arg.startsWith('--glob='))){const t=takeValue(args,i,arg.startsWith('--glob=')?arg.slice(7):'','rg','--glob');globs.push(t.value);i=t.next;continue;}
        if(!after&&(arg==='--regexp'||arg.startsWith('--regexp='))){const t=takeValue(args,i,arg.startsWith('--regexp=')?arg.slice(9):'','rg','--regexp');patterns.push(t.value);i=t.next;continue;}
        if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if('egABC'.includes(f)){const t=takeValue(args,i,arg.slice(j+1),'rg','-'+f);i=t.next;if(f==='g')globs.push(t.value);else if(f==='e')patterns.push(t.value);else passed.push('-'+f,t.value);break;}if(!'FiwvnclHhqo'.includes(f))usageError('rg','unsupported option -'+f);passed.push('-'+f);if(f==='F')fixed=true;}continue;}
        paths.push(arg);
      }
      if(!filesMode&&!patterns.length){if(!paths.length)usageError('rg','missing pattern');patterns.push(paths.shift());}
      if(filesMode&&patterns.length)usageError('rg','--files does not accept a search pattern');
      const fromStdin=!filesMode&&!paths.length&&hasStdin;
      const finish=result=>{if(passed.includes('-c')&&!passed.includes('-q'))result.stdout=lineOutput(asLines(result.stdout).filter(line=>line!=='0'&&!/:0$/.test(line)));return result;};
      if(fromStdin){if(globs.length)usageError('rg','-g requires filesystem input');return finish(this.grep([...(!fixed?['-E']:[]),...passed,...patterns.flatMap(p=>['-e',p])],stdin,{allowDigitEscapes:true}));}
      let recurse=false;const candidates=[];
      for(const path of paths.length?paths:['.']){const p=this.resolve(path);if(this.isDir(p)){recurse=true;for(const file of Object.keys(this.files).filter(f=>f.startsWith(p==='/'?'/':p+'/')).sort(cmp))candidates.push({p:file,name:path.startsWith('/')?file:this.relative(file)});}else{if(!this.isFile(p))fail('rg: '+path+': No such file or directory',2);candidates.push({p,name:path});}}
      const matchGlob=(pattern,path)=>{const target=pattern.includes('/')?path:basename(path);let s='';for(let i=0;i<pattern.length;i++){const c=pattern[i];if(c==='*'&&pattern[i+1]==='*'){i++;if(pattern[i+1]==='/'){i++;s+='(?:.*/)?';}else s+='.*';}else s+=c==='*'?'[^/]*':c==='?'?'[^/]':escRE(c);}return new RegExp('^'+s+'$').test(target)||new RegExp('^'+s+'$').test(path.replace(/^\//,''));};
      const includes=globs.filter(g=>!g.startsWith('!')),excludes=globs.filter(g=>g.startsWith('!')).map(g=>g.slice(1));
      const seen=new Set(),selected=candidates.filter(f=>{if(seen.has(f.p))return false;seen.add(f.p);return (hidden||!this.relative(f.p).split('/').some(seg=>seg.startsWith('.')&&seg!=='.'&&seg!=='..'))&&(!includes.length||includes.some(g=>matchGlob(g,f.name)))&&!excludes.some(g=>matchGlob(g,f.name));});
      if(filesMode)return {stdout:lineOutput(selected.map(f=>f.name)),stderr:'',code:selected.length?0:1};
      if(!selected.length)return {stdout:'',stderr:'',code:1};
      return finish(this.grep([...(!fixed?['-E']:[]),...(recurse?['-H']:[]),...passed,...patterns.flatMap(p=>['-e',p]),'--',...selected.map(f=>f.name)],stdin,{allowDigitEscapes:true}));
    }
    grep(args,stdin,options={}) {
      args=longOptions(args,{'--recursive':'r','--dereference-recursive':'R','--ignore-case':'i','--invert-match':'v','--line-number':'n','--count':'c','--files-with-matches':'l','--files-without-match':'L','--only-matching':'o','--quiet':'q','--word-regexp':'w','--line-regexp':'x','--fixed-strings':'F','--extended-regexp':'E','--no-filename':'h','--with-filename':'H'},{'--regexp':'e','--max-count':'m','--after-context':'A','--before-context':'B','--context':'C','--include':'--include','--exclude':'--exclude','--exclude-dir':'--exclude-dir'},'grep');
      const flags=new Set(), patterns=[],paths=[],includes=[],excludes=[],excludedDirs=[];let after=false,A=0,B=0,maxCount=Infinity;
      for(let i=0;i<args.length;i++){
        const arg=args[i];if(!after&&arg==='--'){after=true;continue;}
        if(!after&&['--include','--exclude','--exclude-dir'].includes(arg)){const t=takeValue(args,i,'','grep',arg);i=t.next;(arg==='--include'?includes:arg==='--exclude'?excludes:excludedDirs).push(t.value);continue;}
        if(!after&&arg.startsWith('-')&&arg!=='-'){
          for(let j=1;j<arg.length;j++){
            const f=arg[j];
            if('eABCm'.includes(f)){const taken=takeValue(args,i,arg.slice(j+1),'grep','-'+f);i=taken.next;if(f==='e')patterns.push(taken.value);else if(f==='m'){if(!/^\d+$/.test(taken.value))usageError('grep','max count must be nonnegative');maxCount=+taken.value;}else{if(!/^\d+$/.test(taken.value)||+taken.value>10000)usageError('grep','context must be 0–10000');if(f==='A'||f==='C')A=+taken.value;if(f==='B'||f==='C')B=+taken.value;}break;}
            if(!'EFiwvncrRlhHLqxo'.includes(f))usageError('grep','unsupported option -'+f);if(f==='H')flags.delete('h');if(f==='h')flags.delete('H');if(f==='L')flags.delete('l');if(f==='l')flags.delete('L');flags.add(f);
          }
        } else if(!patterns.length)patterns.push(arg);else paths.push(arg);
      }
      if(!patterns.length)usageError('grep','missing pattern');
      if(flags.has('E')&&flags.has('F'))usageError('grep','-E and -F cannot be combined');
      const matchers=patterns.flatMap(p=>p.split('\n')).map(p=>{
        if(flags.has('F'))return {fixed:flags.has('i')?p.toLowerCase():p};
        if(!options.allowDigitEscapes){for(let i=0;i<p.length;i++)if(p[i]==='\\'){if(/[dD]/.test(p[i+1]||''))usageError('grep','\\d/\\D are not supported by BRE/ERE grep; use [0-9] or [[:digit:]] (negate with [^0-9]); PCRE -P is unavailable');i++;}}
        return {re:regex(p,flags.has('E'),flags.has('i'))};
      });
      const isWord=c=>Boolean(c&&/[A-Za-z0-9_]/.test(c));
      const matches=line=>{
        let hits=[];
        for(const matcher of matchers){
          if(matcher.fixed!==undefined){const hay=flags.has('i')?line.toLowerCase():line;let offset=0;while(offset<=hay.length){const n=hay.indexOf(matcher.fixed,offset);if(n<0)break;hits.push({index:n,text:line.slice(n,n+matcher.fixed.length)});offset=n+Math.max(1,matcher.fixed.length);}}
          else {const re=new RegExp(matcher.re.source,matcher.re.flags+'g');let m;while((m=re.exec(line))!==null){hits.push({index:m.index,text:m[0]});if(!m[0])re.lastIndex++;}}
        }
        hits=hits.filter(h=>(!flags.has('x')||(h.index===0&&h.text.length===line.length))&&(!flags.has('w')||(!isWord(line[h.index-1])&&!isWord(line[h.index+h.text.length]))));
        return hits.sort((a,b)=>a.index-b.index||b.text.length-a.text.length);
      };
      let expanded=paths;
      let recursiveDirectory=false;
      if(flags.has('r')||flags.has('R')){expanded=[];for(const name of paths.length?paths:['.']){const p=this.resolve(name);if(this.isDir(p)){recursiveDirectory=true;expanded.push(...Object.keys(this.files).filter(x=>x.startsWith(p==='/'?'/':p+'/')).sort(cmp).map(x=>name.startsWith('/')?x:name.replace(/\/$/,'')+'/'+x.slice(p.length+1)));}else expanded.push(name);}}
      expanded=expanded.filter(path=>path==='-'||(!includes.length||includes.some(g=>globMatch(g,basename(path))))&&!excludes.some(g=>globMatch(g,basename(path)))&&!excludedDirs.some(g=>dirname(this.resolve(path)).split('/').some(d=>globMatch(g,d))));
      if(!expanded.length&&paths.length)return {stdout:'',stderr:'',code:1};
      const inputs=expanded.length?expanded.map(name=>({name})):[{name:'-',text:stdin}],withName=flags.has('H')||(!flags.has('h')&&(inputs.length>1||recursiveDirectory));let any=false,out=[],stderr='';
      for(const file of inputs){try{file.text=file.name==='-'?stdin:this.read(file.name,'grep');}catch(e){if(!(e instanceof ShellError))throw e;stderr+=e.message+'\n';continue;}const lines=asLines(file.text),chosen=[],hits=[];for(let i=0;i<lines.length;i++){hits[i]=matches(lines[i]);if(chosen.length<maxCount&&(flags.has('v')?!hits[i].length:hits[i].length)){chosen.push(i);any=true;}}
        if(flags.has('q'))continue;
        const prefix=withName?(file.name==='-'?'(standard input)':file.name)+':':'';
        if(flags.has('l')){if(chosen.length)out.push(file.name==='-'?'(standard input)':file.name);continue;}
        if(flags.has('L')){if(!chosen.length)out.push(file.name==='-'?'(standard input)':file.name);continue;}
        if(flags.has('c')){out.push(prefix+chosen.length);continue;}
        if(flags.has('o')){if(!flags.has('v'))for(const i of chosen){let end=-1;for(const h of hits[i])if(h.text&&h.index>=end){out.push(prefix+(flags.has('n')?(i+1)+':':'')+h.text);end=h.index+h.text.length;}}continue;}
        const selected=new Set(chosen),visible=new Set();for(const n of chosen)for(let i=Math.max(0,n-B);i<=Math.min(lines.length-1,n+A);i++)visible.add(i);
        let previous=-2;for(const i of [...visible].sort((a,b)=>a-b)){if((A||B)&&previous>=0&&i>previous+1)out.push('--');const sep=selected.has(i)?':':'-';out.push((withName?(file.name==='-'?'(standard input)':file.name)+sep:'')+(flags.has('n')?(i+1)+sep:'')+lines[i]);previous=i;}
      }
      return {stdout:lineOutput(out),stderr,code:flags.has('q')&&any?0:stderr?2:any?0:1};
    }
    sort(args,stdin) {
      const flags=new Set(),paths=[];let key=null,delim=null,after=false,keyNumeric=false,keyReverse=false;
      for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='k'||f==='t'){const t=takeValue(args,i,arg.slice(j+1),'sort','-'+f);i=t.next;if(f==='k'){if(key)usageError('sort','only one key range is supported');const m=t.value.match(/^(\d+)([nr]*)(?:,(\d+)([nr]*))?$/);if(!m||!+m[1]||(m[3]&&+m[3]<+m[1]))usageError('sort','key must be N or N,M with optional n/r suffixes');key=[+m[1],m[3]?+m[3]:Infinity];keyNumeric=(m[2]+(m[4]||'')).includes('n');keyReverse=(m[2]+(m[4]||'')).includes('r');}else{if(t.value.length!==1)usageError('sort','delimiter must be one character');delim=t.value;}break;}if(!'nru'.includes(f))usageError('sort','unsupported option -'+f);flags.add(f);}}else paths.push(arg);}
      const rows=this.inputs(paths,stdin,'sort').flatMap(f=>asLines(f.text));
      const getKey=line=>{if(!key)return line;const fields=delim===null?line.trim().split(/\s+/):line.split(delim);return fields.slice(key[0]-1,key[1]).join(delim===null?' ':delim);};
      const compareKey=(a,b)=>{a=getKey(a);b=getKey(b);if(flags.has('n')||keyNumeric){const n=s=>{const m=s.match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);return m?Number(m[1]):0;};return Math.sign(n(a)-n(b));}return cmp(a,b);};
      rows.sort((a,b)=>compareKey(a,b)*((flags.has('r')||keyReverse)?-1:1)||(flags.has('u')?0:cmp(a,b)*(flags.has('r')?-1:1)));
      return lineOutput(flags.has('u')?rows.filter((row,i)=>!i||compareKey(row,rows[i-1])!==0):rows);
    }
    uniq(args,stdin) {
      const {flags,rest}=simpleOptions(args,'cdu','uniq');if(rest.length>1)usageError('uniq','only one input file is supported; use > to save output');const rows=asLines(this.inputs(rest,stdin,'uniq')[0].text),groups=[];
      for(const row of rows){const last=groups[groups.length-1];if(last&&last.line===row)last.n++;else groups.push({line:row,n:1});}
      return lineOutput(groups.filter(g=>(!flags.has('d')||g.n>1)&&(!flags.has('u')||g.n===1)).map(g=>(flags.has('c')?String(g.n).padStart(7)+' ':'')+g.line));
    }
    cut(args,stdin) {
      let delimiter='\t',field=null,characters=null,suppress=false,after=false;const paths=[];
      for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if('dfc'.includes(f)){const t=takeValue(args,i,arg.slice(j+1),'cut','-'+f);i=t.next;if(f==='d')delimiter=t.value;else if(f==='f')field=t.value;else characters=t.value;break;}if(f!=='s')usageError('cut','unsupported option -'+f);suppress=true;}}else paths.push(arg);}
      if(delimiter.length!==1)usageError('cut','delimiter must be one character');if((field===null)===(characters===null))usageError('cut','choose either -f or -c');if(characters!==null&&(delimiter!=='\t'||suppress))usageError('cut','-d and -s require -f');const select=rangeSelector(field===null?characters:field,'cut');
      const out=[];for(const f of this.inputs(paths,stdin,'cut'))for(const line of asLines(f.text)){if(field!==null&&!line.includes(delimiter)){if(!suppress)out.push(line);continue;}out.push((field===null?Array.from(line):line.split(delimiter)).filter((_,i)=>select(i+1)).join(field===null?'':delimiter));}return lineOutput(out);
    }
    ends(cmd,args,stdin) {
      let count=10,after=false;const paths=[];for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){if(cmd==='tail'&&(arg==='-f'||arg==='--follow'||arg.startsWith('--follow=')))usageError(cmd,'logs are static snapshots; continuous follow is unavailable. Re-run tail to inspect the current file');let v;if(arg==='-n'){if(args[++i]===undefined)usageError(cmd,'-n requires a number');v=args[i];}else if(arg.startsWith('-n'))v=arg.slice(2);else if(/^-\d+$/.test(arg))v=arg.slice(1);else usageError(cmd,'unsupported option '+arg);if(!/^\d+$/.test(v)||+v>100000)usageError(cmd,'line count must be 0–100000');count=+v;}else paths.push(arg);}
      const inputs=this.inputs(paths,stdin,cmd);return inputs.map((f,i)=>{const chunks=lineChunks(f.text),rows=cmd==='head'?chunks.slice(0,count):count?chunks.slice(-count):[];return (inputs.length>1?(i?'\n':'')+'==> '+f.name+' <==\n':'')+rows.join('');}).join('');
    }
    wc(args,stdin) {
      const {flags,rest}=simpleOptions(args,'lwc','wc'),chosen=['l','w','c'].filter(f=>!flags.size||flags.has(f));const inputs=this.inputs(rest,stdin,'wc'),totals={l:0,w:0,c:0};const rows=inputs.map(f=>{const counts={l:(f.text.match(/\n/g)||[]).length,w:(f.text.match(/\S+/g)||[]).length,c:bytes(f.text)};for(const k of chosen)totals[k]+=counts[k];return chosen.map(k=>String(counts[k])).join(' ')+(rest.length?' '+f.name:'');});if(inputs.length>1)rows.push(chosen.map(k=>totals[k]).join(' ')+' total');return lineOutput(rows);
    }
    sed(args,stdin) {
      let quiet=false,extended=false,script=null,after=false;const paths=[];
      for(const arg of args){if(!after&&arg==='--'){after=true;continue;}if(script===null&&!after&&arg.startsWith('-')&&arg!=='-'){for(const f of arg.slice(1)){if(f==='n')quiet=true;else if(f==='E')extended=true;else usageError('sed','unsupported option -'+f);}continue;}if(script===null)script=arg;else paths.push(arg);}
      if(script===null)usageError('sed','missing script');const records=this.inputs(paths,stdin,'sed').flatMap(f=>lineChunks(f.text)).map(chunk=>({line:chunk.endsWith('\n')?chunk.slice(0,-1):chunk,ending:chunk.endsWith('\n')?'\n':''})),rows=records.map(r=>r.line);let match=script.match(/^(\d+|\$)(?:,(\d+|\$))?p$/),predicate;
      if(match){const start=match[1]==='$'?rows.length:+match[1],end=match[2]==='$'?rows.length:match[2]?+match[2]:start;if(start<1||end<start)usageError('sed','invalid line address');predicate=(_,i)=>i+1>=start&&i+1<=end;}
      else if(/^\/.*\/p$/.test(script)){const re=regex(script.slice(1,-2),extended);predicate=line=>re.test(line);}
      if(predicate){const out=[];rows.forEach((line,i)=>{const text=line+records[i].ending;if(!quiet)out.push(text);if(predicate(line,i))out.push(text);});return out.join('');}
      if(script[0]!=='s'||script.length<4)usageError('sed','unsupported script; use help sed');const delim=script[1];if(/[\\\n\w]/.test(delim))usageError('sed','use a punctuation substitution delimiter');let parts=[],piece='',i=2;
      for(;i<script.length;i++){const c=script[i];if(c==='\\'&&i+1<script.length){const n=script[++i];piece+=(n===delim?n:'\\'+n);continue;}if(c===delim){parts.push(piece);piece='';if(parts.length===2){i++;break;}}else piece+=c;}
      if(parts.length!==2)usageError('sed','unterminated substitution');const flags=script.slice(i);if(!/^[gpi]*$/.test(flags))usageError('sed','only g, p and i substitution flags are supported');const base=regex(parts[0],extended,flags.includes('i')),re=new RegExp(base.source,base.flags+(flags.includes('g')?'g':''));const replacement=parts[1];
      const out=[];for(const record of records){const line=record.line,changed=base.test(line),value=line.replace(re,(...args)=>{const full=args[0],groups=args.slice(1,-2);return replacement.replace(/\\([1-9&\\])|&/g,(m,g)=>g?g==='&'?'&':g==='\\'?'\\':groups[+g-1]||'':full);})+record.ending;if(!quiet)out.push(value);if(changed&&flags.includes('p'))out.push(value);}return out.join('');
    }
    find(args) {
      let path='.',type=null,name=null,i=0;if(args[0]&&!args[0].startsWith('-'))path=args[i++];
      for(;i<args.length;i++){if(args[i]==='-type'){type=args[++i];if(type!=='f'&&type!=='d')usageError('find','-type supports f or d');}else if(args[i]==='-name'){name=args[++i];if(name===undefined)usageError('find','-name requires a quoted pattern');}else usageError('find','unsupported predicate '+args[i]);}
      const start=this.resolve(path);if(!this.isFile(start)&&!this.isDir(start))fail('find: '+path+': No such file or directory',1);const matcher=name===null?null:new RegExp('^'+Array.from(name).map(c=>c==='*'?'.*':c==='?'?'.':escRE(c)).join('')+'$');
      return lineOutput(this.allPaths().filter(p=>(p===start||p.startsWith(start==='/'?'/':start+'/'))&&(!type||(type==='f'?this.isFile(p):this.isDir(p)))&&(!matcher||matcher.test(basename(p)))).map(p=>path.startsWith('/')?p:path==='.'?(p===this.cwd?'.':'./'+this.relative(p)):path.replace(/\/$/,'')+p.slice(start.length)));
    }
    awk(args,stdin) { return runAwk(this,args,stdin); }
  }
  LogLabShell.supportedCommands=COMMANDS.slice();

  function longOptions(args,flags,valued,cmd) {
    const out=[];let after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;out.push(arg);continue;}if(!after&&arg.startsWith('--')){const at=arg.indexOf('='),name=at<0?arg:arg.slice(0,at);if(Object.prototype.hasOwnProperty.call(flags,name)){if(at>=0)usageError(cmd,name+' does not accept a value');out.push('-'+flags[name]);}else if(Object.prototype.hasOwnProperty.call(valued,name)){const value=at>=0?arg.slice(at+1):args[++i];if(value===undefined)usageError(cmd,name+' requires a value');out.push(valued[name].startsWith('--')?valued[name]:'-'+valued[name],value);}else usageError(cmd,'unsupported option '+name);}else out.push(arg);}return out;
  }
  function globMatch(pattern,value,insensitive=false) {return new RegExp('^'+Array.from(pattern).map(c=>c==='*'?'.*':c==='?'?'.':escRE(c)).join('')+'$',insensitive?'i':'').test(value);}
  function parseValued(args,allowed,valued,cmd) {
    const flags=new Set(),values={},rest=[];let after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(valued.includes(f)){const t=takeValue(args,i,arg.slice(j+1),cmd,'-'+f);i=t.next;values[f]=t.value;break;}if(!allowed.includes(f))usageError(cmd,'unsupported option -'+f);flags.add(f);}}else rest.push(arg);}return {flags,values,rest};
  }
  function positive(value,cmd,name,zero=false) {if(!/^\d+$/.test(value)||+value<(zero?0:1)||+value>1000000)usageError(cmd,name+' must be '+(zero?'nonnegative':'positive')+' and at most 1000000');return +value;}
  function lsTimestamp(time) {const date=new Date(time),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return months[date.getUTCMonth()]+' '+String(date.getUTCDate()).padStart(2)+' '+String(date.getUTCHours()).padStart(2,'0')+':'+String(date.getUTCMinutes()).padStart(2,'0');}
  function humanSize(n) {if(n<1024)return String(n);const units=['K','M','G'];let i=-1;do{n/=1024;i++;}while(n>=1024&&i<units.length-1);return n.toFixed(n<10?1:0)+units[i];}
  function runLs(shell,args) {
    let sort='name',after=false;const cleaned=[];for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;cleaned.push(arg);continue;}if(!after&&(arg==='--sort'||arg.startsWith('--sort='))){sort=arg==='--sort'?args[++i]:arg.slice(7);if(!['time','size','name'].includes(sort))usageError('ls','--sort supports time, size, or name');}else{if(!after&&/^-[^-]/.test(arg))for(const f of arg.slice(1))if(f==='t'||f==='S')sort=f==='t'?'time':'size';cleaned.push(arg);}}
    args=longOptions(cleaned,{'--all':'a','--directory':'d','--recursive':'R','--reverse':'r','--human-readable':'h'},{},'ls');
    const {flags,rest}=simpleOptions(args,'1alhdtRSr','ls'),paths=rest.length?rest:['.'],sections=[],fileRows=[];
    const format=(p,name)=>{if(!flags.has('l'))return name;const dir=shell.isDir(p),size=dir?0:bytes(shell.files[p]),meta=shell.getMetadata(p);return (dir?'drwxr-xr-x':'-rw-r--r--')+' 1 analyst analyst '+(flags.has('h')?humanSize(size):String(size)).padStart(7)+' '+lsTimestamp(meta.mtime)+' '+name;};
    const compare=(a,b)=>(sort==='time'?shell.getMetadata(b).mtime-shell.getMetadata(a).mtime:sort==='size'?(shell.isDir(b)?0:bytes(shell.files[b]))-(shell.isDir(a)?0:bytes(shell.files[a])):0)||cmp(basename(a),basename(b));
    const visit=(p,label,heading)=>{let children=shell.allPaths().filter(x=>x!==p&&dirname(x)===p).filter(x=>flags.has('a')||!basename(x).startsWith('.'));children.sort(compare);if(flags.has('r'))children.reverse();const rows=children.map(x=>format(x,basename(x)));if(flags.has('a'))rows.unshift(format(p,'.'),format(dirname(p),'..'));sections.push((heading?label+':\n':'')+rows.join('\n'));if(flags.has('R'))for(const child of children)if(shell.isDir(child))visit(child,label.replace(/\/$/,'')+'/'+basename(child),true);};
    for(const name of paths){const p=shell.resolve(name);if(shell.isFile(p)||flags.has('d')&&shell.isDir(p))fileRows.push({p,name});else if(!shell.isDir(p))fail('ls: '+name+': No such file or directory',1);}
    fileRows.sort((a,b)=>compare(a.p,b.p));if(flags.has('r'))fileRows.reverse();if(fileRows.length)sections.push(fileRows.map(f=>format(f.p,f.name)).join('\n'));
    for(const name of paths){const p=shell.resolve(name);if(!flags.has('d')&&shell.isDir(p))visit(p,name,paths.length>1||flags.has('R'));}
    return sections.join('\n\n')+(sections.some(Boolean)?'\n':'');
  }
  function runSort(shell,args,stdin) {
    args=longOptions(args,{'--numeric-sort':'n','--reverse':'r','--unique':'u','--ignore-case':'f','--ignore-leading-blanks':'b','--stable':'s','--check':'c'},{'--key':'k','--field-separator':'t'},'sort');
    let keys=0,after=false;for(const arg of args){if(arg==='--')after=true;else if(!after&&/^-.*k/.test(arg))keys++;}if(keys>1)usageError('sort','only one key range is supported');
    const {flags,values,rest}=parseValued(args,'nrufbsc','kt','sort');let key=null,keyFlags='';if(values.k!==undefined){const m=values.k.match(/^(\d+)([nrfb]*)(?:,(\d+)([nrfb]*))?$/);if(!m||!+m[1]||m[3]&&+m[3]<+m[1])usageError('sort','key must be N[,M] with optional n/r/f/b suffixes');key=[+m[1],m[3]?+m[3]:Infinity];keyFlags=m[2]+(m[4]||'');}if(values.t!==undefined&&values.t.length!==1)usageError('sort','delimiter must be one character');const delim=values.t,rows=shell.inputs(rest,stdin,'sort').flatMap(f=>asLines(f.text));
    const get=line=>{if(key){const fields=delim===undefined?line.trim().split(/\s+/):line.split(delim);line=fields.slice(key[0]-1,key[1]).join(delim===undefined?' ':delim);}if(flags.has('b')||keyFlags.includes('b'))line=line.replace(/^\s+/,'');if(flags.has('f')||keyFlags.includes('f'))line=line.toUpperCase();return line;};
    const numeric=s=>{const m=s.match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);return m?+m[1]:0;};
    const compareKey=(a,b)=>{a=get(a);b=get(b);return (flags.has('n')||keyFlags.includes('n')?Math.sign(numeric(a)-numeric(b)):cmp(a,b))*((flags.has('r')||keyFlags.includes('r'))?-1:1);};
    const compare=(a,b)=>compareKey(a,b)||((flags.has('s')||flags.has('u'))?0:cmp(a,b)*(flags.has('r')?-1:1));
    if(flags.has('c')){for(let i=1;i<rows.length;i++)if(compare(rows[i-1],rows[i])>0||flags.has('u')&&compareKey(rows[i-1],rows[i])===0)return {stdout:'',stderr:'sort: disorder at line '+(i+1)+': '+rows[i]+'\n',code:1};return {stdout:'',stderr:'',code:0};}
    rows.sort(compare);return {stdout:lineOutput(flags.has('u')?rows.filter((row,i)=>!i||compareKey(rows[i-1],row)!==0):rows),stderr:'',code:0};
  }
  function runUniq(shell,args,stdin) {
    args=longOptions(args,{'--count':'c','--repeated':'d','--unique':'u','--ignore-case':'i'},{'--skip-fields':'f','--skip-chars':'s'},'uniq');const {flags,values,rest}=parseValued(args,'cdui','fs','uniq');if(rest.length>1)usageError('uniq','only one input file is supported');const skipFields=values.f===undefined?0:positive(values.f,'uniq','field skip',true),skipChars=values.s===undefined?0:positive(values.s,'uniq','character skip',true);
    const key=line=>{for(let n=0;n<skipFields;n++)line=line.replace(/^\s*\S+/,'');line=Array.from(line).slice(skipChars).join('');return flags.has('i')?line.toLowerCase():line;},groups=[];
    for(const line of asLines(shell.inputs(rest,stdin,'uniq')[0].text)){const k=key(line),last=groups[groups.length-1];if(last&&last.key===k)last.n++;else groups.push({line,key:k,n:1});}return lineOutput(groups.filter(g=>(!flags.has('d')||g.n>1)&&(!flags.has('u')||g.n===1)).map(g=>(flags.has('c')?String(g.n).padStart(7)+' ':'')+g.line));
  }
  function runCut(shell,args,stdin) {
    let complement=false,output=null;const cleaned=[];let after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;cleaned.push(arg);continue;}if(!after&&arg==='--complement'){complement=true;continue;}if(!after&&(arg==='--output-delimiter'||arg.startsWith('--output-delimiter='))){output=arg.includes('=')?arg.slice(arg.indexOf('=')+1):args[++i];if(output===undefined)usageError('cut','--output-delimiter requires text');continue;}cleaned.push(arg);}
    const {flags,values,rest}=parseValued(cleaned,'s','dfc','cut'),field=values.f,characters=values.c,delimiter=values.d===undefined?'\t':values.d;if((field===undefined)===(characters===undefined))usageError('cut','choose either -f or -c');if(delimiter.length!==1)usageError('cut','delimiter must be one character');if(characters!==undefined&&(values.d!==undefined||flags.has('s')))usageError('cut','-d and -s require -f');const chosen=rangeSelector(field===undefined?characters:field,'cut'),select=i=>chosen(i)!==complement,out=[];
    for(const f of shell.inputs(rest,stdin,'cut'))for(const line of asLines(f.text)){if(field!==undefined&&!line.includes(delimiter)){if(!flags.has('s'))out.push(line);continue;}const items=field===undefined?Array.from(line):line.split(delimiter);if(field!==undefined)out.push(items.filter((_,i)=>select(i+1)).join(output===null?delimiter:output));else{let value='',previous=-2;items.forEach((v,i)=>{if(select(i+1)){if(output!==null&&previous>=0&&i>previous+1)value+=output;value+=v;previous=i;}});out.push(value);}}return lineOutput(out);
  }
  function runEnds(shell,cmd,args,stdin) {
    const end=args.indexOf('--');if(args.some((a,i)=>(end<0||i<end)&&(a==='--follow'||a.startsWith('--follow='))))usageError(cmd,'logs are static snapshots; continuous follow is unavailable. Re-run tail to inspect the current file');
    args=longOptions(args,{'--quiet':'q','--silent':'q','--verbose':'v'},{'--lines':'n','--bytes':'c'},cmd);const paths=[];let count=10,mode='n',fromStart=false,excludeEnd=false,quiet=false,verbose=false,after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&(arg==='-f'||arg==='--follow'))usageError(cmd,'logs are static snapshots; continuous follow is unavailable. Re-run tail to inspect the current file');if(!after&&arg==='-q'){quiet=true;continue;}if(!after&&arg==='-v'){verbose=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){let value;if(arg[1]==='n'||arg[1]==='c'){mode=arg[1];const t=takeValue(args,i,arg.slice(2),cmd,'-'+mode);i=t.next;value=t.value;}else if(/^-\d+$/.test(arg))value=arg.slice(1);else usageError(cmd,'unsupported option '+arg);fromStart=value.startsWith('+');excludeEnd=value.startsWith('-');if(fromStart&&cmd==='head')usageError(cmd,'+N is supported only by tail');if(excludeEnd&&cmd==='tail')excludeEnd=false;count=positive(value.replace(/^[+-]/,''),cmd,'count',true);}else paths.push(arg);}
    const inputs=shell.inputs(paths,stdin,cmd),headings=!quiet&&(verbose||inputs.length>1);
    return inputs.map((f,index)=>{let text;if(mode==='n'){const chunks=lineChunks(f.text);text=(cmd==='head'?(excludeEnd?chunks.slice(0,Math.max(0,chunks.length-count)):chunks.slice(0,count)):fromStart?chunks.slice(Math.max(0,count-1)):count?chunks.slice(-count):[]).join('');}else{const data=new TextEncoder().encode(f.text),part=cmd==='head'?(excludeEnd?data.slice(0,Math.max(0,data.length-count)):data.slice(0,count)):fromStart?data.slice(Math.max(0,count-1)):count?data.slice(-count):data.slice(0,0);text=new TextDecoder().decode(part);}return (headings?(index?'\n':'')+'==> '+f.name+' <==\n':'')+text;}).join('');
  }
  function runWc(shell,args,stdin) {
    args=longOptions(args,{'--lines':'l','--words':'w','--bytes':'c','--chars':'m','--max-line-length':'L'},{},'wc');const {flags,rest}=simpleOptions(args,'lwmcL','wc'),chosen=['l','w','m','c','L'].filter(f=>flags.size?flags.has(f):'lwc'.includes(f)),inputs=shell.inputs(rest,stdin,'wc'),total={l:0,w:0,m:0,c:0,L:0};
    const rows=inputs.map(f=>{const counts={l:(f.text.match(/\n/g)||[]).length,w:(f.text.match(/\S+/g)||[]).length,m:Array.from(f.text).length,c:bytes(f.text),L:asLines(f.text).reduce((max,line)=>{let col=0;for(const c of line)col=c==='\t'?col+8-col%8:col+displayWidth(c);return Math.max(max,col);},0)};for(const k of chosen)total[k]=k==='L'?Math.max(total[k],counts[k]):total[k]+counts[k];return chosen.map(k=>counts[k]).join(' ')+(rest.length?' '+f.name:'');});if(inputs.length>1)rows.push(chosen.map(k=>total[k]).join(' ')+' total');return lineOutput(rows);
  }
  function runFind(shell,args) {
    let path='.',type=null,min=0,max=Infinity,i=0;const predicates=[];if(args[0]&&!args[0].startsWith('-'))path=args[i++];
    for(;i<args.length;i++){const flag=args[i],value=args[++i];if(value===undefined)usageError('find',flag+' requires a value');if(flag==='-type'){if(value!=='f'&&value!=='d')usageError('find','-type supports f or d');type=value;}else if(flag==='-maxdepth')max=positive(value,'find','maximum depth',true);else if(flag==='-mindepth')min=positive(value,'find','minimum depth',true);else if(['-name','-iname','-path','-ipath'].includes(flag))predicates.push({flag,value});else usageError('find','unsupported predicate '+flag);}
    const start=shell.resolve(path);if(!shell.isFile(start)&&!shell.isDir(start))fail('find: '+path+': No such file or directory',1);const label=p=>path.startsWith('/')?p:path==='.'?(p===shell.cwd?'.':'./'+shell.relative(p)):path.replace(/\/$/,'')+p.slice(start.length);
    return lineOutput(shell.allPaths().filter(p=>{if(p!==start&&!p.startsWith(start==='/'?'/':start+'/'))return false;const depth=p===start?0:p.slice(start==='/'?1:start.length+1).split('/').length;return depth>=min&&depth<=max&&(!type||(type==='f'?shell.isFile(p):shell.isDir(p)))&&predicates.every(pred=>globMatch(pred.value,pred.flag.includes('path')?label(p):basename(p),pred.flag.startsWith('-i')));}).map(label));
  }
  function sedScripts(source) {
    const out=[];let at=0;
    while(at<source.length){while(/[\s;]/.test(source[at]||'')&&at<source.length)at++;if(at>=source.length)break;const start=at;let address=true,slashes=0,delimiter=null;
      for(;at<source.length;at++){const c=source[at];if(c==='\\'){at++;continue;}if(delimiter){if(c===delimiter){slashes--;if(!slashes)delimiter=null;}continue;}if(address&&c==='/'){delimiter='/';slashes=1;continue;}if(address&&(c==='s'||c==='p'||c==='d')){address=false;if(c==='s'){delimiter=source[++at];if(!delimiter||/[\\\n\w\s]/.test(delimiter))usageError('sed','invalid substitution delimiter');slashes=2;}continue;}if(c===';'||c==='\n')break;}
      if(delimiter)usageError('sed','unterminated regular expression or substitution');out.push(source.slice(start,at).trim());at++;
    }return out;
  }
  function compileSed(source,extended) {
    let at=0;
    const address=()=>{while(/\s/.test(source[at]||'')&&at<source.length)at++;if(source[at]==='/'){let pattern='',closed=false;at++;for(;at<source.length;at++){const c=source[at];if(c==='\\'&&at+1<source.length){pattern+=c+source[++at];continue;}if(c==='/'){at++;closed=true;break;}pattern+=c;}if(!closed)usageError('sed','unterminated address');const re=regex(pattern,extended),test=line=>re.test(line);test.regex=true;return test;}const m=source.slice(at).match(/^(\d+|\$)/);if(!m)return null;at+=m[0].length;if(m[0]==='$')return (_,i,n)=>i===n-1;const number=+m[0];if(!number)usageError('sed','line addresses start at 1');const test=(_,i)=>i+1===number;test.number=number;return test;};
    const first=address();let last=null;if(source[at]===','){at++;last=address();if(!last)usageError('sed','missing range end');}while(/\s/.test(source[at]||'')&&at<source.length)at++;const action=source[at++];let substitute=null;
    if(action==='s'){const delim=source[at++];if(!delim||/[\\\n\w\s]/.test(delim))usageError('sed','invalid substitution delimiter');const pieces=[];let piece='';for(;at<source.length;at++){const c=source[at];if(c==='\\'&&at+1<source.length){const next=source[++at];piece+=next===delim?next:'\\'+next;continue;}if(c===delim){pieces.push(piece);piece='';if(pieces.length===2){at++;break;}}else piece+=c;}if(pieces.length!==2)usageError('sed','unterminated substitution');const flags=source.slice(at).trim();if(!/^[gpi]*$/.test(flags))usageError('sed','only g/p/i substitution flags are supported');const base=regex(pieces[0],extended,flags.includes('i')),re=new RegExp(base.source,base.flags+(flags.includes('g')?'g':''));substitute={base,re,replacement:pieces[1],print:flags.includes('p')};at=source.length;
    }else if(action!=='p'&&action!=='d')usageError('sed','unsupported action '+(action||'(missing)'));
    if(source.slice(at).trim())usageError('sed','unexpected text after command');return {first,last,action,substitute,active:false};
  }
  function runSed(shell,args,stdin) {
    args=longOptions(args,{'--quiet':'n','--silent':'n','--regexp-extended':'E'},{'--expression':'e'},'sed');let quiet=false,extended=false,inplace=false,suffix='',after=false;const scripts=[],paths=[];
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='n')quiet=true;else if(f==='E')extended=true;else if(f==='i'){inplace=true;suffix=arg.slice(j+1);break;}else if(f==='e'){const t=takeValue(args,i,arg.slice(j+1),'sed','-e');scripts.push(t.value);i=t.next;break;}else usageError('sed','unsupported option -'+f);}continue;}paths.push(arg);}
    if(!scripts.length){if(!paths.length)usageError('sed','missing script');scripts.push(paths.shift());}const commands=scripts.flatMap(sedScripts).map(s=>compileSed(s,extended));if(!commands.length)usageError('sed','empty scripts are unsupported');if(inplace&&(!paths.length||paths.includes('-')))usageError('sed','-i requires named virtual files');
    const apply=(text,provided)=>{for(const c of commands)c.active=false;const records=provided||lineChunks(text),out=[];for(let i=0;i<records.length;i++){const ending=records[i].endsWith('\n')?'\n':'',original=ending?records[i].slice(0,-1):records[i];let line=original,deleted=false;
        for(const command of commands){let selected=!command.first;if(command.first){if(command.last){const alreadyActive=command.active;if(!command.active&&command.first(line,i,records.length))command.active=true;selected=command.active;if(selected&&(alreadyActive||!command.last.regex)&&(command.last.number!==undefined?i+1>=command.last.number:command.last(line,i,records.length)))command.active=false;}else selected=command.first(line,i,records.length);}if(!selected)continue;
          if(command.action==='p')out.push(line+ending);else if(command.action==='d'){deleted=true;break;}else{const s=command.substitute,changed=s.base.test(line);line=line.replace(s.re,(...a)=>{const full=a[0],groups=a.slice(1,-2);return s.replacement.replace(/\\([1-9&\\])|&/g,(m,g)=>g?g==='&'?'&':g==='\\'?'\\':groups[+g-1]||'':full);});if(changed&&s.print)out.push(line+ending);}}
        if(!quiet&&!deleted)out.push(line+ending);
      }return out.join('');};
    const inputs=shell.inputs(paths,stdin,'sed');if(inplace){for(const input of inputs){const output=apply(input.text);if(suffix)shell.write(input.name+suffix,input.text,false,'sed');shell.write(input.name,output,false,'sed');}return '';}return apply('',inputs.flatMap(f=>lineChunks(f.text)));
  }
  function decodeTextEscapes(source,cmd) {
    let out='';for(let i=0;i<source.length;i++){if(source[i]!=='\\'){out+=source[i];continue;}const c=source[++i];if(c===undefined)usageError(cmd,'unfinished backslash escape');const map={n:'\n',r:'\r',t:'\t',a:'\x07',b:'\b',f:'\f',v:'\v','\\':'\\'};if(Object.prototype.hasOwnProperty.call(map,c)){out+=map[c];continue;}if(c==='x'){const m=source.slice(i+1).match(/^[0-9a-fA-F]{1,2}/);if(!m)usageError(cmd,'\\x requires hexadecimal digits');out+=String.fromCharCode(parseInt(m[0],16));i+=m[0].length;continue;}if(/[0-7]/.test(c)){const m=source.slice(i).match(/^[0-7]{1,3}/);out+=String.fromCharCode(parseInt(m[0],8));i+=m[0].length-1;continue;}usageError(cmd,'unsupported escape \\'+c);}return out;
  }
  function runPrintf(args) {
    if(args[0]==='--')args=args.slice(1);if(!args.length)usageError('printf','missing format');const format=decodeTextEscapes(args[0],'printf'),values=args.slice(1),tokens=[];let at=0;
    for(let i=0;i<format.length;){if(format[i]!=='%'){let end=format.indexOf('%',i);if(end<0)end=format.length;tokens.push({text:format.slice(i,end)});i=end;continue;}const m=format.slice(i).match(/^%([-0]*)(\d+)?(?:\.(\d+))?([%sdifuoxXfcbeEgG])/);if(!m)usageError('printf','unsupported format conversion near '+format.slice(i,i+12));const width=m[2]?+m[2]:0,precision=m[3]===undefined?null:+m[3];if(width>4096||precision!==null&&precision>100)usageError('printf','format width/precision is too large');tokens.push({flags:m[1],width,precision,type:m[4]});i+=m[0].length;}
    let out='';const consumes=tokens.some(t=>t.type&&t.type!=='%');do{for(const token of tokens){if(token.text!==undefined){out+=token.text;continue;}const t=token.type;if(t==='%'){out+='%';continue;}const value=values[at++]===undefined?'':values[at-1];let rendered;
        if(t==='s')rendered=token.precision===null?value:Array.from(value).slice(0,token.precision).join('');else if(t==='b')rendered=decodeTextEscapes(value,'printf');else if(t==='c')rendered=Array.from(value)[0]||'\0';else{let n=value===''?0:value[0]==="'"?value.codePointAt(1)||0:Number(value);if(!Number.isFinite(n))usageError('printf','invalid number '+value);if('diuoxX'.includes(t)){n=Math.trunc(n);if(!Number.isSafeInteger(n)||'uoxX'.includes(t)&&n<0)usageError('printf','integer is outside the supported safe range');rendered=t==='o'?n.toString(8):t==='x'||t==='X'?n.toString(16):String(n);if(t==='X')rendered=rendered.toUpperCase();if(token.precision!==null){const negative=rendered.startsWith('-');rendered=(negative?rendered.slice(1):rendered).padStart(token.precision,'0');if(token.precision===0&&n===0)rendered='';if(negative)rendered='-'+rendered;}}else if(t==='f')rendered=n.toFixed(token.precision===null?6:token.precision);else if(t==='e'||t==='E')rendered=n.toExponential(token.precision===null?6:token.precision);else rendered=Number(n.toPrecision(token.precision===null?6:Math.max(1,token.precision))).toString();if(t==='E'||t==='G')rendered=rendered.toUpperCase();}
        const padding=' '.repeat(Math.max(0,token.width-Array.from(rendered).length));if(token.flags.includes('-'))rendered+=padding;else if(token.flags.includes('0')&&t!=='s'&&t!=='b'&&t!=='c'){const zeros='0'.repeat(padding.length);rendered=rendered.startsWith('-')?'-'+zeros+rendered.slice(1):zeros+rendered;}else rendered=padding+rendered;out+=rendered;
      }if(out.length>MAX_OUTPUT)fail('printf: output exceeds the browser text limit',1);}while(consumes&&at<values.length);return out;
  }
  function runPaste(shell,args,stdin) {
    const {flags,values,rest}=parseValued(args,'s','d','paste'),delimiter=values.d===undefined?'\t':decodeTextEscapes(values.d,'paste'),delimiters=Array.from(delimiter).map(c=>c==='\0'?'':c);if(!delimiters.length)delimiters.push('');const inputs=shell.inputs(rest,stdin,'paste').map(f=>asLines(f.text));
    if(flags.has('s'))return lineOutput(inputs.map(rows=>rows.map((row,i)=>row+(i<rows.length-1?delimiters[i%delimiters.length]:'')).join('')));const count=Math.max(0,...inputs.map(rows=>rows.length));return lineOutput(Array.from({length:count},(_,i)=>inputs.map((rows,j)=>(rows[i]||'')+(j<inputs.length-1?delimiters[j%delimiters.length]:'')).join('')));
  }
  function sortedRows(shell,path,stdin,cmd,getKey=x=>x) {const rows=asLines(path==='-'?stdin:shell.read(path,cmd));for(let i=1;i<rows.length;i++)if(cmp(getKey(rows[i-1]),getKey(rows[i]))>0)usageError(cmd,'input '+path+' is not sorted; use sort first');return rows;}
  function runComm(shell,args,stdin) {
    const {flags,rest}=simpleOptions(args,'123','comm');if(rest.length!==2)usageError('comm','exactly two sorted files are required');const a=sortedRows(shell,rest[0],stdin,'comm'),b=sortedRows(shell,rest[1],stdin,'comm'),out=[];let i=0,j=0;const emit=(column,line)=>{if(flags.has(String(column)))return;let tabs=0;for(let c=1;c<column;c++)if(!flags.has(String(c)))tabs++;out.push('\t'.repeat(tabs)+line);};
    while(i<a.length||j<b.length){if(j===b.length||i<a.length&&cmp(a[i],b[j])<0)emit(1,a[i++]);else if(i===a.length||cmp(a[i],b[j])>0)emit(2,b[j++]);else{emit(3,a[i]);i++;j++;}}return lineOutput(out);
  }
  function runJoin(shell,args,stdin) {
    const include=new Set(),only=new Set(),cleaned=[];let after=false;for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;cleaned.push(arg);continue;}if(!after&&/^-[av]/.test(arg)){const t=takeValue(args,i,arg.slice(2),'join',arg.slice(0,2));i=t.next;if(!['1','2'].includes(t.value))usageError('join','-a/-v requires 1 or 2');(arg[1]==='a'?include:only).add(t.value);}else cleaned.push(arg);}
    const {values,rest}=parseValued(cleaned,'','12teo','join');if(rest.length!==2)usageError('join','exactly two sorted files are required');const field1=values['1']===undefined?1:positive(values['1'],'join','field'),field2=values['2']===undefined?1:positive(values['2'],'join','field'),delimiter=values.t;if(delimiter!==undefined&&delimiter.length!==1)usageError('join','delimiter must be one character');const split=line=>delimiter===undefined?line.trim().split(/\s+/):line.split(delimiter),key=(line,n)=>split(line)[n-1]||'',a=sortedRows(shell,rest[0],stdin,'join',l=>key(l,field1)).map(split),b=sortedRows(shell,rest[1],stdin,'join',l=>key(l,field2)).map(split),out=[],output=values.o===undefined?null:values.o.split(/[ ,]+/).map(s=>{if(s==='0')return [0,0];const m=s.match(/^([12])\.(\d+)$/);if(!m||!+m[2])usageError('join','-o uses 0, 1.N, and 2.N fields');return [+m[1],+m[2]-1];});
    const emit=(left,right,k)=>{const cells=output?output.map(([source,n])=>source===0?k:(source===1?left:right)?.[n]||values.e||''):[k,...(left?left.filter((_,n)=>n!==field1-1):[]),...(right?right.filter((_,n)=>n!==field2-1):[])];out.push(cells.join(delimiter===undefined?' ':delimiter));};let i=0,j=0;
    while(i<a.length||j<b.length){const x=i<a.length?a[i][field1-1]||'':null,y=j<b.length?b[j][field2-1]||'':null;if(j===b.length||i<a.length&&cmp(x,y)<0){if(include.has('1')||only.has('1'))emit(a[i],null,x);i++;}else if(i===a.length||cmp(x,y)>0){if(include.has('2')||only.has('2'))emit(null,b[j],y);j++;}else{let endA=i+1,endB=j+1;while(endA<a.length&&(a[endA][field1-1]||'')===x)endA++;while(endB<b.length&&(b[endB][field2-1]||'')===y)endB++;if(!only.size){if((endA-i)*(endB-j)>100000)usageError('join','duplicate-key expansion exceeds the browser limit');for(let p=i;p<endA;p++)for(let q=j;q<endB;q++)emit(a[p],b[q],x);}i=endA;j=endB;}}
    return lineOutput(out);
  }
  function xargsWords(text) {const words=[];let word='',started=false,quote=null;for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote)quote=null;else word+=c;continue;}if(c==='"'||c==="'"){quote=c;started=true;continue;}if(c==='\\'){if(i+1===text.length)usageError('xargs','unfinished input escape');word+=text[++i];started=true;continue;}if(/\s/.test(c)){if(started){words.push(word);word='';started=false;}}else{word+=c;started=true;}}if(quote)usageError('xargs','unclosed input quote');if(started)words.push(word);return words;}
  function runXargs(shell,args,stdin) {
    let zero=false,noEmpty=false,delimiter=null,number=null,replace=null,at=0;
    for(;at<args.length;at++){const arg=args[at];if(arg==='--'){at++;break;}if(!arg.startsWith('-')||arg==='-')break;for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='0')zero=true;else if(f==='r')noEmpty=true;else if('dnI'.includes(f)){const t=takeValue(args,at,arg.slice(j+1),'xargs','-'+f);at=t.next;if(f==='d'){delimiter=decodeTextEscapes(t.value,'xargs');if(Array.from(delimiter).length!==1)usageError('xargs','delimiter must be one character');}else if(f==='n')number=positive(t.value,'xargs','batch size');else replace=t.value;break;}else usageError('xargs','unsupported option -'+f);}}
    if(zero&&delimiter!==null||replace!==null&&(zero||delimiter!==null||number!==null))usageError('xargs','-0/-d/-I/-n combination is unsupported');if(replace==='')usageError('xargs','replacement token must not be empty');const command=args[at]||'echo',fixed=args.slice(at+1);if(!COMMANDS.includes(command)||['xargs'].includes(command))usageError('xargs','only existing virtual commands may run; '+command+' is unsupported');
    let items=replace!==null?asLines(stdin).filter(s=>s.trim()!==''):zero||delimiter!==null?stdin.split(zero?'\0':delimiter):xargsWords(stdin);if((zero||delimiter!==null)&&items[items.length-1]==='')items.pop();if(!items.length&&noEmpty)return {stdout:'',stderr:'',code:0};const size=replace!==null?1:number||Math.max(1,items.length),batches=[];for(let i=0;i<items.length;i+=size)batches.push(items.slice(i,i+size));if(!batches.length)batches.push([]);if(batches.length>256)usageError('xargs','at most 256 batches may run');let stdout='',stderr='',code=0;
    for(const batch of batches){const argv=replace!==null?fixed.map(arg=>arg.split(replace).join(batch[0]||'')):[...fixed,...batch];let result;try{result=shell.execute(command,argv,'',{hasStdin:false});}catch(e){if(!(e instanceof ShellError))throw e;result={stdout:'',stderr:e.message+'\n',code:e.code};}stdout+=result.stdout||'';stderr+=result.stderr||'';if(result.code)code=123;if(stdout.length>MAX_OUTPUT)usageError('xargs','combined output exceeds the browser limit');}return {stdout,stderr,code};
  }
  function runStrings(shell,args,stdin) {
    const {values,rest}=parseValued(args,'a','nt','strings'),minimum=values.n===undefined?4:positive(values.n,'strings','minimum length');if(values.t!==undefined&&!['d','o','x'].includes(values.t))usageError('strings','offset radix must be d, o, or x');const out=[];
    for(const input of shell.inputs(rest,stdin,'strings')){const re=new RegExp('[\\x20-\\x7e\\t]{'+minimum+',}','g');let match;while((match=re.exec(input.text))!==null){let prefix='';if(values.t!==undefined)prefix=bytes(input.text.slice(0,match.index)).toString(values.t==='d'?10:values.t==='o'?8:16).padStart(7)+' ';out.push(prefix+match[0]);}}return lineOutput(out);
  }
  function pathBase(path) {path=String(path).replace(/\/+$/,'');if(!path)return '/';return path.slice(path.lastIndexOf('/')+1);}
  function pathDir(path) {path=String(path).replace(/\/+$/,'');if(!path)return '/';const at=path.lastIndexOf('/');if(at<0)return '.';return path.slice(0,at).replace(/\/+$/,'')||'/';}
  function runPaths(shell,cmd,args) {
    if(cmd==='basename'){const {flags,values,rest}=parseValued(args,'a','s',cmd);if(!rest.length)usageError(cmd,'missing path');let suffix=values.s,names=rest;if(!flags.has('a')&&values.s===undefined){if(rest.length>2)usageError(cmd,'too many operands; use -a for multiple paths');names=[rest[0]];suffix=rest[1];}return lineOutput(names.map(path=>{let name=pathBase(path);if(suffix&&name!==suffix&&name.endsWith(suffix))name=name.slice(0,-suffix.length);return name;}));}
    if(cmd==='dirname'){const {rest}=simpleOptions(args,'',cmd);if(!rest.length)usageError(cmd,'missing path');return lineOutput(rest.map(pathDir));}
    const {flags,rest}=simpleOptions(args,'me',cmd);if(!rest.length)usageError(cmd,'missing path');if(flags.has('m')&&flags.has('e'))usageError(cmd,'choose -m or -e');return lineOutput(rest.map(path=>{const p=shell.resolve(path);if(flags.has('e')&&!shell.isFile(p)&&!shell.isDir(p)||!flags.has('m')&&!shell.isDir(dirname(p)))fail('realpath: '+path+': No such file or directory',1);return p;}));
  }
  function runMetadata(shell,cmd,args) {
    if(cmd==='file'){const {flags,rest}=simpleOptions(args,'bi',cmd);if(!rest.length)usageError(cmd,'missing path');return lineOutput(rest.map(path=>{const p=shell.resolve(path);let description;if(shell.isDir(p))description=flags.has('i')?'inode/directory; charset=binary':'directory';else if(!shell.isFile(p))fail('file: '+path+': No such file or directory',1);else{const text=shell.files[p],ascii=/^[\x00-\x7f]*$/.test(text),binary=/[\x00-\x08\x0e-\x1f]/.test(text);if(flags.has('i'))description=(binary?'application/octet-stream':text.trim()&&(()=>{try{JSON.parse(text);return true;}catch(_){return false;}})()?'application/json':'text/plain')+'; charset='+(binary?'binary':ascii?'us-ascii':'utf-8');else if(!text)description='empty';else if(binary)description='data';else{let json=false,jsonl=false;try{JSON.parse(text);json=true;}catch(_){try{const rows=asLines(text).filter(s=>s.trim());if(rows.length>1){rows.forEach(s=>JSON.parse(s));jsonl=true;}}catch(_){}}description=json?'JSON text data':jsonl?'JSON Lines text data':ascii?'ASCII text':'UTF-8 Unicode text';}}return (flags.has('b')?'':path+': ')+description;}));}
    if(cmd==='stat'){const {values,rest}=parseValued(args,'','c',cmd);if(!rest.length)usageError(cmd,'missing path');return lineOutput(rest.map(path=>{const p=shell.resolve(path),dir=shell.isDir(p);if(!dir&&!shell.isFile(p))fail('stat: '+path+': No such file or directory',1);const meta=shell.getMetadata(p),data={y:new Date(meta.mtime).toISOString().replace('T',' ').replace('Z',' +0000'),Y:String(Math.floor(meta.mtime/1000)),n:path,s:String(dir?0:bytes(shell.files[p])),F:dir?'directory':'regular file',a:dir?'755':'644',A:dir?'drwxr-xr-x':'-rw-r--r--'};if(values.c!==undefined)return values.c.replace(/%(%|[A-Za-z])/g,(_,key)=>{if(key==='%')return '%';if(!Object.prototype.hasOwnProperty.call(data,key))usageError(cmd,'unsupported format %'+key);return data[key];});return '  File: '+path+'\n  Size: '+data.s+' bytes\n  Type: '+data.F+'\n  Mode: '+data.a+' ('+data.A+', virtual)';}));}
    let depth=Infinity;const cleaned=[];let after=false;for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;cleaned.push(arg);continue;}if(!after&&(arg==='--max-depth'||arg.startsWith('--max-depth='))){const value=arg.includes('=')?arg.slice(arg.indexOf('=')+1):args[++i];depth=positive(value,'du','maximum depth',true);}else cleaned.push(arg);}const {flags,rest}=simpleOptions(cleaned,'ashbc',cmd),paths=rest.length?rest:['.'],out=[];let total=0;const counted=new Set();if(flags.has('b')&&flags.has('h'))usageError(cmd,'choose -b or -h');const logical=p=>shell.isFile(p)?bytes(shell.files[p]):Object.entries(shell.files).reduce((n,[file,text])=>n+(file.startsWith(p==='/'?'/':p+'/')?bytes(text):0),0),show=n=>flags.has('b')?String(n):flags.has('h')?humanSize(n):String(Math.ceil(n/1024));
    for(const path of paths){const start=shell.resolve(path);if(!shell.isFile(start)&&!shell.isDir(start))fail('du: '+path+': No such file or directory',1);if(!counted.has(start)){total+=logical(start);counted.add(start);}if(flags.has('s')||shell.isFile(start)){out.push(show(logical(start))+'\t'+path);continue;}const all=shell.allPaths().filter(p=>p===start||p.startsWith(start==='/'?'/':start+'/')).filter(p=>flags.has('a')||shell.isDir(p)).filter(p=>(p===start?0:p.slice(start==='/'?1:start.length+1).split('/').length)<=depth).sort((a,b)=>b.split('/').length-a.split('/').length||cmp(a,b));for(const p of all)out.push(show(logical(p))+'\t'+(p===start?path:path.replace(/\/$/,'')+p.slice(start.length)));}if(flags.has('c'))out.push(show(total)+'\ttotal');return lineOutput(out);
  }
  function runDate(args) {
    args=longOptions(args,{'--utc':'u','--universal':'u'},{'--date':'d'},'date');const {flags,values,rest}=parseValued(args,'u','d','date');if(rest.length>1||rest.length&&rest[0][0]!=='+')usageError('date','use one +format operand');let date=new Date();if(values.d!==undefined){const value=values.d;if(/^@-?\d+(?:\.\d+)?$/.test(value))date=new Date(+value.slice(1)*1000);else{let normalized=value.replace(/ UTC$/,'Z').replace(' ','T');if(/^\d{4}-\d{2}-\d{2}$/.test(normalized))normalized+='T00:00:00Z';if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized))usageError('date','-d accepts an ISO date with timezone, YYYY-MM-DD, or @epoch; relative dates are unsupported');const y=+normalized.slice(0,4),m=+normalized.slice(5,7),d=+normalized.slice(8,10);if(m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate())usageError('date','invalid calendar date');date=new Date(normalized);}if(!Number.isFinite(date.getTime()))usageError('date','invalid date');}
    const utc=flags.has('u'),get=method=>date[(utc?'getUTC':'get')+method](),pad=(n,width=2)=>String(n).padStart(width,'0'),year=get('FullYear'),month=get('Month'),day=get('Date'),week=get('Day'),hour=get('Hours'),minute=get('Minutes'),second=get('Seconds'),offset=utc?0:-date.getTimezoneOffset(),zone=(offset>=0?'+':'-')+pad(Math.floor(Math.abs(offset)/60))+pad(Math.abs(offset)%60),shortDays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],longDays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],shortMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],longMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const formats={Y:String(year),m:pad(month+1),d:pad(day),e:String(day).padStart(2),H:pad(hour),M:pad(minute),S:pad(second),F:year+'-'+pad(month+1)+'-'+pad(day),T:pad(hour)+':'+pad(minute)+':'+pad(second),s:String(Math.floor(date.getTime()/1000)),z:zone,Z:utc?'UTC':Intl.DateTimeFormat('en',{timeZoneName:'short'}).formatToParts(date).find(p=>p.type==='timeZoneName').value,a:shortDays[week],A:longDays[week],b:shortMonths[month],B:longMonths[month],u:String(week||7),w:String(week),j:pad(Math.floor((Date.UTC(year,month,day)-Date.UTC(year,0,1))/86400000)+1,3),n:'\n',t:'\t','%':'%'};const format=rest.length?rest[0].slice(1):'%a %b %e %T %Z %Y';return format.replace(/%(.|$)/g,(_,key)=>{if(!Object.prototype.hasOwnProperty.call(formats,key))usageError('date','unsupported format %'+key);return formats[key];})+'\n';
  }
  function runMove(shell,cmd,args) {
    const {flags,rest}=simpleOptions(args,cmd==='mv'?'n':'p',cmd);if(cmd==='rmdir'){if(!rest.length)usageError(cmd,'missing directory');for(const path of rest){let p=shell.resolve(path);while(true){if(!shell.isDir(p))fail('rmdir: '+p+': No such file or directory',1);if(shell.cwd===p||shell.cwd.startsWith(p==='/'?'/':p+'/'))fail('rmdir: cannot remove the current directory or an ancestor',1);if(shell.allPaths().some(x=>x!==p&&dirname(x)===p))fail('rmdir: '+p+': Directory not empty',1);shell.directories.delete(p);delete shell.metadata[p];if(!flags.has('p')||dirname(p)==='/')break;p=dirname(p);}}return '';}
    if(rest.length!==2)usageError(cmd,'exactly two paths are required');const source=shell.resolve(rest[0]);if(!shell.isFile(source)&&!shell.isDir(source))fail('mv: '+rest[0]+': No such file or directory',1);let destination=shell.resolve(rest[1]);if(shell.isDir(destination))destination+=(destination==='/'?'':'/')+basename(source);if(source===destination)return '';if(destination.startsWith(source+'/'))fail('mv: cannot move a directory inside itself',1);if(!shell.isDir(dirname(destination)))fail('mv: '+rest[1]+': No such file or directory',1);if(flags.has('n')&&(shell.isFile(destination)||shell.isDir(destination)))return '';if(shell.isDir(source)){if(shell.isFile(destination)||shell.isDir(destination))fail('mv: destination already exists',1);const files=Object.entries(shell.files).filter(([p])=>p.startsWith(source+'/')),dirs=[...shell.directories].filter(p=>p===source||p.startsWith(source+'/'));for(const [p,text] of files){const next=destination+p.slice(source.length);shell.files[next]=text;shell.metadata[next]={...shell.getMetadata(p)};delete shell.files[p];delete shell.metadata[p];}for(const p of dirs){const next=destination+p.slice(source.length);shell.metadata[next]={...shell.getMetadata(p)};delete shell.metadata[p];shell.directories.delete(p);shell.directories.add(next);}if(shell.cwd===source||shell.cwd.startsWith(source+'/'))shell.cwd=destination+shell.cwd.slice(source.length);if(shell.oldcwd===source||shell.oldcwd.startsWith(source+'/'))shell.oldcwd=destination+shell.oldcwd.slice(source.length);shell.addParents(destination);}else{const meta={...shell.getMetadata(source)};shell.write(destination,shell.files[source],false,cmd);shell.metadata[destination]=meta;delete shell.files[source];delete shell.metadata[source];}return '';
  }

  function trSet(source) {
    if(/\[[^\]]*\*/.test(source))usageError('tr','repeated-set syntax is unsupported');
    const classes={};const chars=(a,b)=>Array.from({length:b-a+1},(_,i)=>String.fromCharCode(a+i));
    classes.lower=chars(97,122);classes.upper=chars(65,90);classes.digit=chars(48,57);classes.alpha=[...classes.upper,...classes.lower];classes.alnum=[...classes.digit,...classes.alpha];classes.space=['\t','\n','\v','\f','\r',' '];classes.blank=['\t',' '];classes.cntrl=[...chars(0,31),'\x7f'];classes.print=chars(32,126);classes.graph=chars(33,126);classes.punct=classes.graph.filter(c=>!/[A-Za-z0-9]/.test(c));classes.xdigit=[...classes.digit,...chars(65,70),...chars(97,102)];
    const tokens=[];
    for(let i=0;i<source.length;){if(source.slice(i,i+2)==='[:'){const end=source.indexOf(':]',i+2);if(end<0)usageError('tr','unterminated character class');const name=source.slice(i+2,end);if(!classes[name])usageError('tr','unsupported character class '+name);tokens.push({chars:classes[name]});i=end+2;continue;}
      let c=source[i++],escaped=false;if(c==='\\'){escaped=true;if(i===source.length)usageError('tr','unfinished escape');const oct=source.slice(i).match(/^[0-7]{1,3}/);if(oct){c=String.fromCharCode(parseInt(oct[0],8));i+=oct[0].length;}else{const e=source[i++],map={n:'\n',r:'\r',t:'\t',a:'\x07',b:'\b',f:'\f',v:'\v','\\':'\\','-':'-'};if(!Object.prototype.hasOwnProperty.call(map,e))usageError('tr','unsupported escape \\'+e);c=map[e];}}
      else if(c.codePointAt(0)>=0xd800&&c.codePointAt(0)<=0xdbff&&i<source.length)c+=source[i++];tokens.push({chars:[c],literal:true,escaped});
    }
    const out=[];for(let i=0;i<tokens.length;i++){const a=tokens[i],dash=tokens[i+1],b=tokens[i+2];if(a.literal&&dash&&dash.literal&&dash.chars[0]==='-'&&!dash.escaped&&b&&b.literal){const lo=a.chars[0].codePointAt(0),hi=b.chars[0].codePointAt(0);if(lo>hi||hi>127)usageError('tr','ranges must be ascending ASCII characters');out.push(...chars(lo,hi));i+=2;}else out.push(...a.chars);}return out;
  }
  function runTr(args,stdin) {
    const {flags,rest}=simpleOptions(args,'cds','tr');if(!rest.length||rest.length>2)usageError('tr','one or two sets are required');
    const a=trSet(rest[0]),b=rest[1]===undefined?null:trSet(rest[1]);if(!flags.has('d')&&!flags.has('s')&&b===null)usageError('tr','translation requires SET2');if(flags.has('d')&&b!==null&&!flags.has('s'))usageError('tr','SET2 requires -s when deleting');if(!flags.has('d')&&b!==null&&!b.length)usageError('tr','SET2 must not be empty');if(flags.has('c')&&!flags.has('d')&&b&&b.length!==1)usageError('tr','complemented translation supports one output character');
    const set=new Set(a),squeeze=new Set(b===null?a:b),mapping=new Map();if(b)for(let i=0;i<a.length;i++)if(!mapping.has(a[i]))mapping.set(a[i],b[Math.min(i,b.length-1)]);
    let out='',previous=null;for(const c of Array.from(stdin)){const member=flags.has('c')?!set.has(c):set.has(c);if(flags.has('d')&&member)continue;const v=!flags.has('d')&&b!==null&&member?(flags.has('c')?b[0]:mapping.get(c)):c;const squeezed=flags.has('s')&&(b!==null?squeeze.has(v):flags.has('c')?!set.has(v):set.has(v));if(squeezed&&v===previous)continue;out+=v;previous=v;}return out;
  }
  function displayWidth(text) { return Array.from(text).reduce((n,c)=>{const k=c.codePointAt(0);if(/[\u0300-\u036f\ufe00-\ufe0f]/.test(c))return n;return n+(k>=0x1100&&(k<=0x115f||k>=0x2e80&&k<=0xa4cf||k>=0xac00&&k<=0xd7a3||k>=0xf900&&k<=0xfaff||k>=0xfe10&&k<=0xfe6f||k>=0xff00&&k<=0xff60||k>=0x1f300)?2:1);},0); }
  function runColumn(shell,args,stdin) {
    let table=false,separator=null,after=false;const paths=[];
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='t')table=true;else if(f==='s'){const t=takeValue(args,i,arg.slice(j+1),'column','-s');separator=t.value;i=t.next;break;}else usageError('column','unsupported option -'+f);}}else paths.push(arg);}
    if(!table)usageError('column','only table mode -t is supported');if(separator==='')usageError('column','separator must not be empty');const split=separator===null?null:new RegExp('['+separator.replace(/[\\\]\[\-^]/g,'\\$&')+']');
    const rows=shell.inputs(paths,stdin,'column').flatMap(f=>asLines(f.text)).filter(line=>line.trim()!=='').map(line=>split?line.split(split):line.trim().split(/\s+/)),widths=[];
    for(const row of rows)row.forEach((v,i)=>widths[i]=Math.max(widths[i]||0,displayWidth(v)));return lineOutput(rows.map(row=>row.map((v,i)=>v+(i<row.length-1?' '.repeat(widths[i]-displayWidth(v)+2):'')).join('')));
  }
  function runNl(shell,args,stdin) {
    let all=false,width=6,separator='\t',after=false;const paths=[];
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){const f=arg[1];if(!'bws'.includes(f))usageError('nl','unsupported option '+arg);const t=takeValue(args,i,arg.slice(2),'nl','-'+f);i=t.next;if(f==='b'){if(t.value!=='a'&&t.value!=='t')usageError('nl','-b supports a or t');all=t.value==='a';}else if(f==='w'){if(!/^\d+$/.test(t.value)||+t.value<1||+t.value>100)usageError('nl','width must be 1–100');width=+t.value;}else separator=t.value;}else paths.push(arg);}
    if(paths.length>1)usageError('nl','only one input file is supported');let n=0;return lineChunks(shell.inputs(paths,stdin,'nl')[0].text).map(chunk=>{const body=chunk.endsWith('\n')?chunk.slice(0,-1):chunk;if(!all&&body==='')return chunk;return String(++n).padStart(width)+separator+chunk;}).join('');
  }
  function runDiff(shell,args,stdin) {
    const {flags,rest}=simpleOptions(args,'u','diff');if(rest.length!==2)usageError('diff','exactly two files are required');let a,b;try{a=lineChunks(rest[0]==='-'?stdin:shell.read(rest[0],'diff'));b=lineChunks(rest[1]==='-'?stdin:shell.read(rest[1],'diff'));}catch(e){if(e instanceof ShellError)e.code=2;throw e;}
    if(a.length===b.length&&a.every((line,i)=>line===b[i]))return {stdout:'',stderr:'',code:0};
    if((a.length+1)*(b.length+1)>2000000)usageError('diff','comparison exceeds 2 million line-pair cells; compare filtered excerpts');
    const columns=b.length+1,matrix=new Uint32Array((a.length+1)*columns);
    for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)matrix[i*columns+j]=a[i]===b[j]?matrix[(i+1)*columns+j+1]+1:Math.max(matrix[(i+1)*columns+j],matrix[i*columns+j+1]);
    const ops=[];let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){ops.push({kind:' ',text:a[i],old:i+1,new:j+1});i++;j++;}else if(i<a.length&&(j===b.length||matrix[(i+1)*columns+j]>=matrix[i*columns+j+1])){ops.push({kind:'-',text:a[i],old:i+1,new:j+1});i++;}else{ops.push({kind:'+',text:b[j],old:i+1,new:j+1});j++;}}
    const printLine=(op,prefix)=>prefix+(op.text.endsWith('\n')?op.text:op.text+'\n\\ No newline at end of file\n');
    let out='';
    if(flags.has('u')){out='--- '+rest[0]+'\n+++ '+rest[1]+'\n';const ranges=[];ops.forEach((op,index)=>{if(op.kind===' ')return;const start=Math.max(0,index-3),end=Math.min(ops.length,index+4),last=ranges[ranges.length-1];if(last&&start<=last[1])last[1]=Math.max(last[1],end);else ranges.push([start,end]);});
      for(const [start,end] of ranges){const slice=ops.slice(start,end),oldCount=slice.filter(op=>op.kind!=='+').length,newCount=slice.filter(op=>op.kind!=='-').length;const address=(n,count)=>count===1?String(n):String(count?n:n-1)+','+count;out+='@@ -'+address(ops[start].old,oldCount)+' +'+address(ops[start].new,newCount)+' @@\n';for(const op of slice)out+=printLine(op,op.kind);}
    }else{for(let at=0;at<ops.length;){if(ops[at].kind===' '){at++;continue;}const group=[];while(at<ops.length&&ops[at].kind!==' ')group.push(ops[at++]);const del=group.filter(op=>op.kind==='-'),add=group.filter(op=>op.kind==='+'),span=(first,last)=>first===last?String(first):first+','+last;if(del.length&&add.length)out+=span(del[0].old,del[del.length-1].old)+'c'+span(add[0].new,add[add.length-1].new)+'\n';else if(del.length)out+=span(del[0].old,del[del.length-1].old)+'d'+(del[0].new-1)+'\n';else out+=(add[0].old-1)+'a'+span(add[0].new,add[add.length-1].new)+'\n';for(const op of del)out+=printLine(op,'< ');if(del.length&&add.length)out+='---\n';for(const op of add)out+=printLine(op,'> ');}}
    return {stdout:out,stderr:'',code:1};
  }
  function runBase64(shell,args,stdin) {
    let decode=false,width=76,after=false;const paths=[];
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg==='--decode'){decode=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='d')decode=true;else if(f==='w'){const t=takeValue(args,i,arg.slice(j+1),'base64','-w');i=t.next;if(!/^\d+$/.test(t.value)||+t.value>10000)usageError('base64','wrap width must be 0–10000');width=+t.value;break;}else usageError('base64','unsupported option -'+f);}}else paths.push(arg);}
    if(paths.length>1)usageError('base64','only one input file is supported');const text=shell.inputs(paths,stdin,'base64')[0].text;
    if(decode){const value=text.replace(/\s/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))fail('base64: invalid input',1);let binary;try{binary=atob(value);}catch(_){fail('base64: invalid input',1);}try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));}catch(_){fail('base64: decoded data is not UTF-8 text; binary output is unsupported',1);}}
    const data=new TextEncoder().encode(text);let binary='';for(const byte of data)binary+=String.fromCharCode(byte);const encoded=btoa(binary);if(!encoded)return '';return width?lineOutput(encoded.match(new RegExp('.{1,'+width+'}','g'))||[]):encoded;
  }

  // A deliberately bounded jq filter parser; filters are data, never JavaScript.
  function jqSplit(source,separator) {
    const parts=[];let start=0,quote=false,depth=0;
    for(let i=0;i<source.length;i++){const c=source[i];if(quote){if(c==='\\')i++;else if(c==='"')quote=false;continue;}if(c==='"'){quote=true;continue;}if('([{'.includes(c)){depth++;continue;}if(')]}'.includes(c)){depth--;if(depth<0)fail('jq: unmatched delimiter',3);continue;}if(depth===0&&source.slice(i,i+separator.length)===separator){parts.push(source.slice(start,i).trim());start=i+separator.length;i+=separator.length-1;}}
    if(quote||depth!==0)fail('jq: unclosed string or delimiter',3);parts.push(source.slice(start).trim());return parts;
  }
  const jqTruth=v=>v!==null&&v!==false;
  const jqEqual=(a,b)=>jqCompare(a,b)===0;
  const jqCompare=(a,b)=>{
    const rank=v=>v===null?0:typeof v==='boolean'?1:typeof v==='number'?2:typeof v==='string'?3:Array.isArray(v)?4:5,d=rank(a)-rank(b);if(d)return Math.sign(d);
    if(a===null)return 0;
    if(Array.isArray(a)){for(let i=0;i<Math.min(a.length,b.length);i++){const n=jqCompare(a[i],b[i]);if(n)return n;}return Math.sign(a.length-b.length);}
    if(typeof a==='object'){const keysA=Object.keys(a).sort(cmp),keysB=Object.keys(b).sort(cmp),keyOrder=jqCompare(keysA,keysB);if(keyOrder)return keyOrder;for(const key of keysA){const n=jqCompare(a[key],b[key]);if(n)return n;}return 0;}
    return typeof a==='number'?Math.sign(a-b):cmp(a,b);
  };
  function jqOne(filter,input) {const values=filter(input);if(values.length!==1)fail('jq: this expression requires exactly one value',5);return values[0];}
  function jqPredicate(source) {
    source=source.trim();const or=jqSplit(source,' or ');if(or.length>1){const predicates=or.map(jqPredicate);return v=>predicates.some(p=>p(v));}const and=jqSplit(source,' and ');if(and.length>1){const predicates=and.map(jqPredicate);return v=>predicates.every(p=>p(v));}
    if(source.startsWith('(')&&source.endsWith(')'))return jqPredicate(source.slice(1,-1));
    for(const op of ['==','!=','>=','<=','>','<']){const parts=jqSplit(source,op);if(parts.length>1){if(parts.length!==2)fail('jq: chained comparisons are unsupported',3);const a=jqFilter(parts[0]),b=jqFilter(parts[1]);return v=>{const x=jqOne(a,v),y=jqOne(b,v),n=jqCompare(x,y);return op==='=='?jqEqual(x,y):op==='!='?!jqEqual(x,y):op==='>'?n>0:op==='>='?n>=0:op==='<'?n<0:n<=0;};}}
    const filter=jqFilter(source);return v=>jqTruth(jqOne(filter,v));
  }
  function jqFilter(source) {
    source=source.trim();if(!source)fail('jq: empty filter stage',3);
    const pipes=jqSplit(source,'|');if(pipes.length>1){const compiled=pipes.map(jqFilter);return v=>compiled.reduce((values,f)=>values.flatMap(item=>f(item)),[v]);}
    const alternatives=jqSplit(source,',');if(alternatives.length>1){const compiled=alternatives.map(jqFilter);return v=>compiled.flatMap(f=>f(v));}
    const defaults=jqSplit(source,'//');if(defaults.length>1){const compiled=defaults.map(jqFilter);return v=>{for(let i=0;i<compiled.length;i++){const values=compiled[i](v);if(i===compiled.length-1)return values;const kept=values.filter(jqTruth);if(kept.length)return kept;}return [];};}
    if(source==='.')return v=>[v];if(source==='empty')return ()=>[];
    if(source[0]==='['&&source.endsWith(']')){const inside=source.slice(1,-1).trim(),filter=inside?jqFilter(inside):null;return v=>[filter?filter(v):[]];}
    if(source[0]==='{'&&source.endsWith('}')){const inside=source.slice(1,-1).trim(),fields=inside?jqSplit(inside,',').map(field=>{const parts=jqSplit(field,':');if(parts.length!==2)fail('jq: object fields must use key: filter',3);let key=parts[0];if(key.startsWith('"')){try{key=JSON.parse(key);}catch(_){fail('jq: invalid object key',3);}}else if(!/^[A-Za-z_]\w*$/.test(key))fail('jq: object keys must be names or quoted strings',3);return {key,filter:jqFilter(parts[1])};}):[];return v=>{const output=Object.create(null);for(const f of fields)output[f.key]=jqOne(f.filter,v);return [output];};}
    let call=source.match(/^(select|has|contains|startswith|endswith|test|sort_by|group_by|unique_by)\(([\s\S]*)\)$/);
    if(call){const name=call[1],argument=call[2];if(name==='select'){const predicate=jqPredicate(argument);return v=>predicate(v)?[v]:[];}
      const filter=jqFilter(argument);
      if(['sort_by','group_by','unique_by'].includes(name))return v=>{if(!Array.isArray(v))fail('jq: '+name+' requires an array',5);const items=v.map((item,i)=>({item,key:jqOne(filter,item),i})).sort((a,b)=>jqCompare(a.key,b.key)||a.i-b.i);if(name==='sort_by')return [items.map(x=>x.item)];const groups=[];for(const x of items){const last=groups[groups.length-1];if(last&&jqEqual(last.key,x.key))last.items.push(x.item);else groups.push({key:x.key,items:[x.item]});}return [name==='unique_by'?groups.map(g=>g.items[0]):groups.map(g=>g.items)];};
      return v=>{const arg=jqOne(filter,v);if(name==='has'){if(v===null)return [false];if(typeof v!=='object')fail('jq: has requires an object or array',5);return [Object.prototype.hasOwnProperty.call(v,arg)];}if(name==='contains'){if(typeof v==='string'&&typeof arg==='string')return [v.includes(arg)];if(Array.isArray(v)&&Array.isArray(arg))return [arg.every(x=>v.some(y=>jqEqual(x,y)))];if(v&&arg&&typeof v==='object'&&typeof arg==='object')return [Object.keys(arg).every(k=>Object.prototype.hasOwnProperty.call(v,k)&&jqEqual(v[k],arg[k]))];fail('jq: contains supports strings, arrays, or shallow objects of matching types',5);}if(typeof v!=='string'||typeof arg!=='string')fail('jq: '+name+' requires strings',5);return [name==='test'?regex(arg).test(v):name==='startswith'?v.startsWith(arg):v.endsWith(arg)];};
    }
    if(['length','keys','values','type','sort','unique','not','@csv','@tsv'].includes(source))return v=>{
      if(source==='type')return [v===null?'null':Array.isArray(v)?'array':typeof v];
      if(source==='not')return [!jqTruth(v)];if(source==='values')return v===null?[]:[v];
      if(source==='length'){if(v===null)return [0];if(typeof v==='string')return [Array.from(v).length];if(Array.isArray(v))return [v.length];if(typeof v==='object')return [Object.keys(v).length];if(typeof v==='number')return [Math.abs(v)];fail('jq: length is unsupported for booleans',5);}
      if(source==='keys'){if(v===null||typeof v!=='object')fail('jq: keys requires an object or array',5);return [Array.isArray(v)?v.map((_,i)=>i):Object.keys(v).sort(cmp)];}
      if(!Array.isArray(v))fail('jq: '+source+' requires an array',5);
      if(source==='sort'||source==='unique'){const items=v.slice().sort(jqCompare);return [source==='sort'?items:items.filter((x,i)=>i===0||!jqEqual(x,items[i-1]))];}
      const cells=v.map(value=>{if(value!==null&&typeof value==='object')fail('jq: '+source+' requires scalar array values',5);if(value===null)return '';if(source==='@csv')return typeof value==='string'?'"'+value.replace(/"/g,'""')+'"':String(value);return String(value).replace(/\\/g,'\\\\').replace(/\t/g,'\\t').replace(/\n/g,'\\n').replace(/\r/g,'\\r');});return [cells.join(source==='@csv'?',':'\t')];
    };
    if(source[0]==='.'){
      const steps=[];let i=1,needName=true;
      while(i<source.length){if(source[i]==='.'){if(needName)fail('jq: recursive descent is unsupported',3);needName=true;i++;continue;}
        if(source[i]==='['){let end=i+1,quote=false;for(;end<source.length;end++){const c=source[end];if(quote){if(c==='\\')end++;else if(c==='"')quote=false;}else if(c==='"')quote=true;else if(c===']')break;}if(end===source.length)fail('jq: unclosed index',3);const index=source.slice(i+1,end).trim();if(index==='')steps.push({iterate:true});else if(/^-?\d+$/.test(index))steps.push({key:+index});else if(/^"/.test(index)){let key;try{key=JSON.parse(index);}catch(_){fail('jq: unsupported index',3);}if(typeof key!=='string')fail('jq: index must be a string or integer',3);steps.push({key});}else fail('jq: slices and computed indices are unsupported',3);i=end+1;needName=false;continue;}
        if(!needName)fail('jq: unsupported path syntax near '+source.slice(i),3);const name=source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(!name)fail('jq: unsupported field syntax',3);steps.push({key:name[0]});i+=name[0].length;needName=false;
      }
      if(needName&&steps.length)fail('jq: incomplete field path',3);
      return v=>steps.reduce((values,step)=>values.flatMap(value=>{if(step.iterate){if(value===null||typeof value!=='object')fail('jq: cannot iterate over '+(value===null?'null':typeof value),5);return Array.isArray(value)?value:Object.values(value);}if(value===null)return [null];if(typeof step.key==='number'){if(!Array.isArray(value))fail('jq: numeric index requires an array',5);const n=step.key<0?value.length+step.key:step.key;return [n>=0&&n<value.length?value[n]:null];}if(Array.isArray(value)||typeof value!=='object')fail('jq: field access requires an object',5);return [Object.prototype.hasOwnProperty.call(value,step.key)?value[step.key]:null];}),[v]);
    }
    try{const value=JSON.parse(source);return ()=>[value];}catch(_){fail('jq: unsupported filter syntax: '+source+'; use help jq',3);}
  }
  function jsonValues(text) {
    if(!text.trim())return [];
    try{return [JSON.parse(text)];}catch(_){}
    const values=[];let line=0;for(const record of asLines(text)){line++;if(!record.trim())continue;try{values.push(JSON.parse(record));}catch(_){fail('jq: invalid JSON on line '+line+' (supports JSON documents or one JSON value per line)',4);}}return values;
  }
  function runJq(shell,args,stdin) {
    const {flags,rest}=simpleOptionsBeforeFilter(args,'rcs','jq'),source=rest.length?rest[0]:'.',paths=rest.slice(1),filter=jqFilter(source),inputs=shell.inputs(paths,stdin,'jq').flatMap(f=>jsonValues(f.text));
    const values=(flags.has('s')?[inputs]:inputs).flatMap(v=>filter(v));
    return values.map(value=>flags.has('r')&&typeof value==='string'?value:JSON.stringify(value,null,flags.has('c')?0:2)).join('\n')+(values.length?'\n':'');
  }
  function simpleOptionsBeforeFilter(args,allowed,cmd) {
    const flags=new Set(),rest=[];let after=false;
    for(const arg of args){if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(const f of arg.slice(1)){if(!allowed.includes(f))usageError(cmd,'unsupported option -'+f);flags.add(f);}}else{after=true;rest.push(arg);}}
    return {flags,rest};
  }

  /* A small parsed awk interpreter. It deliberately never evaluates JavaScript. */
  function awkExpr(source) {
    const tokens=[];let i=0;
    while(i<source.length){const c=source[i];if(/\s/.test(c)){i++;continue;}if(c==='"'||c==='\''){const q=c;let value='';i++;let closed=false;while(i<source.length){let x=source[i++];if(x===q){closed=true;break;}if(x==='\\'&&i<source.length){x=source[i++];value+=({n:'\n',t:'\t',r:'\r'}[x]||x);}else value+=x;}if(!closed)usageError('awk','unclosed string');tokens.push({type:'literal',value});continue;}
      if(c==='/'){let p='',closed=false;i++;while(i<source.length){const x=source[i++];if(x==='\\'&&i<source.length){p+=x+source[i++];continue;}if(x==='/'){closed=true;break;}p+=x;}if(!closed)usageError('awk','unclosed regex');tokens.push({type:'regex',value:regex(p)});continue;}
      const number=source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);if(number){tokens.push({type:'literal',value:+number[0]});i+=number[0].length;continue;}
      const identifier=source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(identifier){tokens.push({type:'id',value:identifier[0]});i+=identifier[0].length;continue;}
      const op=source.slice(i).match(/^(?:&&|\|\||==|!=|<=|>=|!~|[~<>+*%$(),!\-])/);if(op){tokens.push({type:'op',value:op[0]});i+=op[0].length;continue;}
      usageError('awk','unsupported expression near '+source.slice(i,20));
    }
    let at=0;const peek=v=>tokens[at]&&tokens[at].value===v,accept=v=>peek(v)?(at++,true):false,need=v=>{if(!accept(v))usageError('awk','expected '+v);};
    const literal=value=>({type:'literal',value});
    function primary(){const t=tokens[at++];if(!t)usageError('awk','incomplete expression');if(t.type==='literal'||t.type==='regex')return {type:t.type,value:t.value};if(t.value==='('){const n=or();need(')');return n;}if(t.value==='$')return {type:'field',index:primary()};if(t.type==='id'){if(accept('(')){if(!['tolower','toupper','length','int'].includes(t.value))usageError('awk','unsupported function '+t.value);const value=peek(')')?{type:'field',index:literal(0)}:or();need(')');return {type:'call',name:t.value,value};}return {type:'var',name:t.value};}usageError('awk','unexpected '+t.value);}
    function unary(){if(accept('!'))return {type:'unary',op:'!',value:unary()};if(accept('-'))return {type:'unary',op:'-',value:unary()};if(accept('+'))return {type:'unary',op:'+',value:unary()};return primary();}
    function multiply(){let n=unary();while(peek('*')||peek('%')){const op=tokens[at++].value;n={type:'binary',op,left:n,right:unary()};}return n;}
    function add(){let n=multiply();while(peek('+')||peek('-')){const op=tokens[at++].value;n={type:'binary',op,left:n,right:multiply()};}return n;}
    function compare(){let n=add();while(tokens[at]&&['==','!=','<','<=','>','>=','~','!~'].includes(tokens[at].value)){const op=tokens[at++].value;n={type:'binary',op,left:n,right:add()};}return n;}
    function and(){let n=compare();while(accept('&&'))n={type:'binary',op:'&&',left:n,right:compare()};return n;}
    function or(){let n=and();while(accept('||'))n={type:'binary',op:'||',left:n,right:and()};return n;}
    const ast=or();if(at!==tokens.length)usageError('awk','unsupported expression; use commas between printed fields');
    const truth=(v,env)=>v instanceof RegExp?v.test(env.line):typeof v==='number'?v!==0:v!==''&&v!=='0';
    function evaluate(node,env){
      if(node.type==='literal'||node.type==='regex')return node.value;
      if(node.type==='var')return node.name==='NF'?env.fields.length:node.name==='NR'||node.name==='FNR'?env[node.name]:Object.prototype.hasOwnProperty.call(env.vars,node.name)?env.vars[node.name]:0;
      if(node.type==='field'){const n=Math.trunc(Number(evaluate(node.index,env)));if(n<0)usageError('awk','negative field index');return n===0?env.line:env.fields[n-1]||'';}
      if(node.type==='call'){const v=evaluate(node.value,env);return node.name==='tolower'?String(v).toLowerCase():node.name==='toupper'?String(v).toUpperCase():node.name==='length'?String(v).length:Math.trunc(Number(v)||0);}
      if(node.type==='unary'){const v=evaluate(node.value,env);return node.op==='!'?+!truth(v,env):node.op==='-'?-(Number(v)||0):(Number(v)||0);}
      const a=evaluate(node.left,env);if(node.op==='&&')return +(truth(a,env)&&truth(evaluate(node.right,env),env));if(node.op==='||')return +(truth(a,env)||truth(evaluate(node.right,env),env));const b=evaluate(node.right,env);
      if(node.op==='~'||node.op==='!~'){const re=b instanceof RegExp?b:regex(String(b));return +(re.test(String(a))!==(node.op==='!~'));}
      if(node.op==='+'||node.op==='-'||node.op==='*'||node.op==='%'){const x=Number(a)||0,y=Number(b)||0;return node.op==='+'?x+y:node.op==='-'?x-y:node.op==='*'?x*y:y?x%y:0;}
      const numeric=v=>typeof v==='number'||(String(v).trim()!==''&&Number.isFinite(Number(v))),x=numeric(a)&&numeric(b)?Number(a):String(a),y=numeric(a)&&numeric(b)?Number(b):String(b);
      return +(node.op==='=='?x===y:node.op==='!='?x!==y:node.op==='<'?x<y:node.op==='<='?x<=y:node.op==='>'?x>y:x>=y);
    }
    return {value:env=>evaluate(ast,env),test:env=>truth(evaluate(ast,env),env)};
  }
  function splitAwkArgs(source) {
    const out=[];let start=0,depth=0,quote=null,slash=false;
    for(let i=0;i<source.length;i++){const c=source[i];if(c==='\\'){i++;continue;}if(quote){if(c===quote)quote=null;continue;}if(slash){if(c==='/')slash=false;continue;}if(c==='"'||c==='\''){quote=c;continue;}if(c==='/'){slash=true;continue;}if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){out.push(source.slice(start,i));start=i+1;}}
    out.push(source.slice(start));return out;
  }
  function awkBlocks(program) {
    const blocks=[];let start=0,open=-1,quote=null,slash=false;
    for(let i=0;i<program.length;i++){const c=program[i];if(c==='\\'){i++;continue;}if(quote){if(c===quote)quote=null;continue;}if(slash){if(c==='/')slash=false;continue;}if(c==='"'||c==='\''){quote=c;continue;}if(c==='/'){slash=true;continue;}if(c==='{'){if(open!==-1)usageError('awk','nested blocks are unsupported');open=i;}if(c==='}'){if(open===-1)usageError('awk','unmatched closing brace');blocks.push({pattern:program.slice(start,open).trim(),action:program.slice(open+1,i).trim().replace(/;\s*$/,'')});open=-1;start=i+1;}}
    if(open!==-1)usageError('awk','unclosed block');const tail=program.slice(start).trim();if(tail){if(blocks.length)usageError('awk','unexpected text after block');blocks.push({pattern:tail,action:'print'});}return blocks;
  }
  function runAwk(shell,args,stdin) {
    let separator=' ',program=null,after=false;const paths=[],initial=Object.create(null);
    for(let i=0;i<args.length;i++){const arg=args[i];if(program===null&&!after&&arg==='--'){after=true;continue;}if(program===null&&!after&&arg.startsWith('-')&&arg!=='-'){if(!arg.startsWith('-F')&&!arg.startsWith('-v'))usageError('awk','unsupported option '+arg);const t=takeValue(args,i,arg.slice(2),'awk',arg.slice(0,2));i=t.next;if(arg[1]==='F')separator=t.value;else{const m=t.value.match(/^([A-Za-z_]\w*)=([\s\S]*)$/);if(!m)usageError('awk','-v requires name=value');initial[m[1]]=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(m[2])?+m[2]:decodeTextEscapes(m[2],'awk');}continue;}if(program===null)program=arg;else paths.push(arg);}
    if(program===null||!program.trim())usageError('awk','missing program');
    const blocks=awkBlocks(program);if(!blocks.length)usageError('awk','empty program');let main=null,end=null;const begins=[];
    for(const block of blocks){if(block.pattern==='BEGIN')begins.push(block);else if(block.pattern==='END'){if(end)usageError('awk','only one END block is supported');end=block;}else{if(main)usageError('awk','only one record block is supported');main=block;}}
    const filter=main&&main.pattern?awkExpr(main.pattern):null;let printers=null,counter=null,aggregate=null,sum=null;
    const compilePrint=action=>{const m=action.match(/^print(?:\s+([\s\S]*))?$/);if(!m)usageError('awk','unsupported action; use help awk');return m[1]?splitAwkArgs(m[1]).map(s=>awkExpr(s.trim())):[awkExpr('$0')];};
    if(main){let m;if(/^print(?:\s|$)/.test(main.action))printers=compilePrint(main.action);else if((m=main.action.match(/^([A-Za-z_]\w*)\+\+$/)))counter=m[1];else if((m=main.action.match(/^([A-Za-z_]\w*)\s*\+=\s*([\s\S]+)$/)))sum={name:m[1],value:awkExpr(m[2])};else if((m=main.action.match(/^([A-Za-z_]\w*)\[([\s\S]+)\]\+\+$/)))aggregate={name:m[1],key:awkExpr(m[2]),values:new Map()};else if(main.action!=='')usageError('awk','unsupported action; use help awk');}
    let endPrinters=null,aggregateOrder=null;
    if(end){if(aggregate){const m=end.action.match(/^for\s*\(\s*([A-Za-z_]\w*)\s+in\s+([A-Za-z_]\w*)\s*\)\s*print\s+([\s\S]+)$/);if(!m||m[2]!==aggregate.name)usageError('awk','unsupported aggregate END block');const normalized=m[3].replace(/\s/g,''),forward=aggregate.name+'['+m[1]+'],'+m[1],reverse=m[1]+','+aggregate.name+'['+m[1]+']';if(normalized===forward)aggregateOrder='count';else if(normalized===reverse)aggregateOrder='key';else usageError('awk','aggregate output supports count[key], key or key, count[key]');}else endPrinters=compilePrint(end.action);}
    const env={line:'',fields:[],NR:0,FNR:0,vars:Object.assign(Object.create(null),{FS:separator,OFS:' ',ORS:'\n'},initial)},out=[];
    const render=v=>v instanceof RegExp?+v.test(env.line):String(v);
    const emit=printers=>out.push(printers.map(p=>render(p.value(env))).join(String(env.vars.OFS))+String(env.vars.ORS));
    for(const begin of begins)for(const statement of awkStatements(begin.action)){const assignment=statement.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);if(assignment){if(['NR','NF','FNR'].includes(assignment[1]))usageError('awk','assigning record counters is unsupported');env.vars[assignment[1]]=awkExpr(assignment[2]).value(env);}else emit(compilePrint(statement));}
    // AWK treats a one-character FS literally (except the special space value).
    const fieldSeparator=String(env.vars.FS),fs=fieldSeparator===' '?null:fieldSeparator.length<=1?fieldSeparator:regex(fieldSeparator);
    for(const input of shell.inputs(paths,stdin,'awk')){env.FNR=0;for(const line of asLines(input.text)){env.line=line;env.fields=fs===''?Array.from(line):fs?line.split(fs):line.trim()?line.trim().split(/\s+/):[];env.NR++;env.FNR++;if(!main||filter&&!filter.test(env))continue;if(printers)emit(printers);if(counter)env.vars[counter]=(Number(env.vars[counter])||0)+1;if(sum)env.vars[sum.name]=(Number(env.vars[sum.name])||0)+(Number(sum.value.value(env))||0);if(aggregate){const key=String(aggregate.key.value(env));aggregate.values.set(key,(aggregate.values.get(key)||0)+1);}}}
    if(endPrinters)emit(endPrinters);if(aggregate&&aggregateOrder)for(const [key,count] of aggregate.values)out.push((aggregateOrder==='count'?count+String(env.vars.OFS)+key:key+String(env.vars.OFS)+count)+String(env.vars.ORS));return out.join('');
  }
  function awkStatements(source) {const out=[];let start=0,quote=null;for(let i=0;i<source.length;i++){const c=source[i];if(c==='\\'){i++;continue;}if(quote){if(c===quote)quote=null;}else if(c==='"'||c==='\'')quote=c;else if(c===';'){const s=source.slice(start,i).trim();if(s)out.push(s);start=i+1;}}const tail=source.slice(start).trim();if(tail)out.push(tail);return out;}
  root.LogLabShell=LogLabShell;
})(globalThis);
