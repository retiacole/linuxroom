// Adapted from Logroom: editor-specific tests omitted because Linuxroom has no editor UI.
'use strict';
const assert=require('node:assert/strict');require('../src/shell.js');
const files={
 '/home/analyst/a.txt':'one\ntwo\nthree\n',
 '/home/analyst/b.txt':'beta\nalpha\nalpha\n',
 '/home/analyst/empty.txt':'',
 '/home/analyst/fields.txt':'a:b:c\nd:e:f\nsolo\n',
 '/home/analyst/sorted.txt':'alpha\nbeta\ngamma\n',
 '/home/analyst/case.txt':'ALPHA\nalpha\nBeta\n',
 '/home/analyst/ties.txt':'b 2\na 2\nc 1\n',
 '/home/analyst/skip.txt':'1 same\n2 same\n3 other\n',
 '/home/analyst/utf.txt':'日本語\n',
 '/home/analyst/blank.txt':'a\n\nb\n',
 '/home/analyst/left.txt':'a\nb\nd\n',
 '/home/analyst/right.txt':'b\nc\nd\n',
 '/home/analyst/join1.txt':'a apple\nb banana\nd durian\n',
 '/home/analyst/join2.txt':'a 10\nc 30\nd 40\n',
 '/home/analyst/table1.txt':'a\nb\n',
 '/home/analyst/table2.txt':'1\n2\n3\n',
 '/home/analyst/args.txt':'"hello world" simple\n',
 '/home/analyst/args0.txt':'a b\0c\0',
 '/home/analyst/sub/A.LOG':'error alpha\nerror beta\n',
 '/home/analyst/sub/b.log':'normal\n',
 '/home/analyst/sub/deep/c.txt':'alpha\n',
 '/home/analyst/binary.txt':'\0abc\0printable-string\x01'
};
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;}catch(e){failed++;console.error('FAIL',name,'\n'+e.message);}}
function sh(){return new LogLabShell(files);}
function eq(command,expected,code=0){const r=sh().run(command);assert.equal(r.code,code,JSON.stringify(r));assert.equal(r.stdout,expected);assert.equal(r.stderr,'');}
function err(command,code){const r=sh().run(command);assert.notEqual(r.code,0,JSON.stringify(r));if(code!==undefined)assert.equal(r.code,code);assert(r.stderr);assert(!r.stderr.includes('internal error'),r.stderr);}
test('supported v3 commands discoverable',()=>{for(const c of ['printf','paste','comm','join','xargs','rev','strings','basename','dirname','realpath','file','stat','du','date','mv','rmdir'])assert(sh().supportedCommands.includes(c),c);});
test('grep max matches',()=>eq('grep -m1 alpha b.txt','alpha\n'));
test('grep max matches zero',()=>eq('grep -m0 alpha b.txt','',1));
test('grep files without matches',()=>eq('grep -L alpha a.txt b.txt','a.txt\n'));
test('grep recursive include',()=>eq("grep -r --include '*.log' normal sub",'sub/b.log:normal\n'));
test('grep recursive exclude directory',()=>eq("grep -r --exclude-dir deep alpha sub",'sub/A.LOG:error alpha\n'));
test('grep recursive uppercase R',()=>eq('grep -R alpha sub','sub/A.LOG:error alpha\nsub/deep/c.txt:alpha\n'));
test('sort stable ties',()=>eq('sort -s -n -k2,2 ties.txt','c 1\nb 2\na 2\n'));
test('sort fold case',()=>eq('sort -f case.txt','ALPHA\nalpha\nBeta\n'));
test('sort check success',()=>eq('sort -c sorted.txt',''));
test('sort check failure',()=>err('sort -c b.txt',1));
test('uniq ignore case',()=>eq('uniq -i case.txt','ALPHA\nBeta\n'));
test('uniq skip fields',()=>eq('uniq -f1 skip.txt','1 same\n3 other\n'));
test('uniq skip characters',()=>eq('uniq -s2 skip.txt','1 same\n3 other\n'));
test('cut complement fields',()=>eq("cut -d: -f2 --complement fields.txt",'a:c\nd:f\nsolo\n'));
test('cut output delimiter',()=>eq("cut -d: -f1,3 --output-delimiter ',' fields.txt",'a,c\nd,f\nsolo\n'));
test('head bytes ASCII',()=>eq('head -c4 a.txt','one\n'));
test('head bytes UTF8 intact boundary',()=>eq('head -c6 utf.txt','日本'));
test('head exclude last line',()=>eq('head -n-1 a.txt','one\ntwo\n'));
test('tail from nth line',()=>eq('tail -n+2 a.txt','two\nthree\n'));
test('tail bytes UTF8',()=>eq('tail -c4 utf.txt','語\n'));
test('tail bytes from position',()=>eq('tail -c+4 utf.txt','本語\n'));
test('wc characters',()=>eq('wc -m utf.txt','4 utf.txt\n'));
test('wc bytes',()=>eq('wc -c utf.txt','10 utf.txt\n'));
test('wc max line length',()=>eq('wc -L a.txt','5 a.txt\n'));
test('sed multiple expressions',()=>eq("sed -e 's/one/ONE/' -e 's/two/TWO/' a.txt",'ONE\nTWO\nthree\n'));
test('sed inplace with backup',()=>{const s=sh(),r=s.run("sed -i.bak 's/one/ONE/' a.txt");assert.equal(r.code,0,JSON.stringify(r));assert.equal(r.stdout,'');assert.equal(s.files['/home/analyst/a.txt'],'ONE\ntwo\nthree\n');assert.equal(s.files['/home/analyst/a.txt.bak'],files['/home/analyst/a.txt']);});
test('awk BEGIN fields and output separator',()=>eq("awk 'BEGIN {FS=\":\"; OFS=\",\"} {print $1,$3}' fields.txt",'a,c\nd,f\nsolo,\n'));
test('awk v variables',()=>eq("awk -v tag=found 'NR == 1 {print tag,$1}' a.txt",'found one\n'));
test('awk BEGIN print',()=>eq("awk 'BEGIN {print \"heading\"} {print $1}' a.txt",'heading\none\ntwo\nthree\n'));
test('find case insensitive maxdepth',()=>eq("find sub -maxdepth 1 -type f -iname '*.log'",'sub/A.LOG\nsub/b.log\n'));
test('find mindepth',()=>eq('find sub -mindepth 2 -type f','sub/deep/c.txt\n'));
test('find path predicate',()=>eq("find sub -type f -path '*/deep/*'",'sub/deep/c.txt\n'));
test('ls directory itself',()=>eq('ls -d sub','sub\n'));
test('ls recursive',()=>{const r=sh().run('ls -R sub');assert.equal(r.code,0);assert.match(r.stdout,/sub:/);assert.match(r.stdout,/sub\/deep:/);assert.match(r.stdout,/c\.txt/);});
test('printf string and numeric',()=>eq("printf '%s:%d:%x\\n' item 15 15",'item:15:f\n'));
test('printf repeats format',()=>eq("printf '%s\\n' a b c",'a\nb\nc\n'));
test('printf width alignment',()=>eq("printf '%5s|%03d\\n' x 7",'    x|007\n'));
test('paste columns uneven',()=>eq('paste table1.txt table2.txt','a\t1\nb\t2\n\t3\n'));
test('paste serial delimiter',()=>eq("paste -s -d, table1.txt table2.txt",'a,b\n1,2,3\n'));
test('comm only common',()=>eq('comm -12 left.txt right.txt','b\nd\n'));
test('comm only first',()=>eq('comm -23 left.txt right.txt','a\n'));
test('comm three columns',()=>eq('comm left.txt right.txt','a\n\t\tb\n\tc\n\t\td\n'));
test('comm unsorted error',()=>err('comm b.txt right.txt'));
test('join matching rows',()=>eq('join join1.txt join2.txt','a apple 10\nd durian 40\n'));
test('join include unmatched',()=>eq('join -a1 join1.txt join2.txt','a apple 10\nb banana\nd durian 40\n'));
test('join output columns',()=>eq('join -o 1.2,2.2 join1.txt join2.txt','apple 10\ndurian 40\n'));
test('join unmatched output default',()=>eq("join -a1 -a2 -e NA -o 0,1.2,2.2 join1.txt join2.txt",'a apple 10\nb banana NA\nc NA 30\nd durian 40\n'));
test('xargs default echo',()=>eq("printf 'one two\\nthree\\n' | xargs",'one two three\n'));
test('xargs grouped arguments',()=>eq("printf 'one two three\\n' | xargs -n2 echo",'one two\nthree\n'));
test('xargs quoted words',()=>eq("cat args.txt | xargs -n1 echo",'hello world\nsimple\n'));
test('xargs null-delimited',()=>eq('cat args0.txt | xargs -0 -n1 echo','a b\nc\n'));
test('xargs replacement token',()=>eq("printf 'a b\\nc\\n' | xargs -I '{}' echo 'item={}'",'item=a b\nitem=c\n'));
test('xargs empty -r',()=>eq('cat empty.txt | xargs -r echo should-not-run',''));
test('xargs metachar literal isolation',()=>{const s=sh(),r=s.run("echo 'ok; touch /tmp/SHOULD_NOT_EXIST' | xargs echo");assert.equal(r.code,0);assert.equal(r.stdout,'ok; touch /tmp/SHOULD_NOT_EXIST\n');assert(!s.isFile('/tmp/SHOULD_NOT_EXIST'));});
test('xargs rejects host execution',()=>err("echo harmless | xargs sh -c"));
test('rev unicode',()=>eq('rev utf.txt','語本日\n'));
test('strings extracts printable sequences',()=>eq('strings -n4 binary.txt','printable-string\n'));
test('basename suffix',()=>eq("basename /var/log/access.log .log",'access\n'));
test('basename multiple',()=>eq("basename -a -s .log /a/a.log /b/b.log",'a\nb\n'));
test('dirname multiple',()=>eq('dirname /var/log/auth.log relative.txt','/var/log\n.\n'));
test('realpath virtual resolution',()=>eq('realpath -m sub/../a.txt','/home/analyst/a.txt\n'));
test('realpath existing error',()=>err('realpath -e missing.txt'));
test('file text recognition',()=>{const r=sh().run('file -b a.txt');assert.equal(r.code,0);assert.match(r.stdout,/text/i);});
test('stat byte size',()=>eq("stat -c '%s' utf.txt",'10\n'));
test('stat filename',()=>eq("stat -c '%n' a.txt",'a.txt\n'));
test('du bytes summary',()=>eq('du -sb sub','36\tsub\n'));
test('date explicit UTC deterministic',()=>eq("date -u -d '2026-08-12T09:18:42Z' '+%Y-%m-%d %H:%M:%S %Z'",'2026-08-12 09:18:42 UTC\n'));
test('date epoch deterministic',()=>eq("date -u -d '@0' '+%Y-%m-%d'",'1970-01-01\n'));
test('mv preserves contents and removes source',()=>{const s=sh(),r=s.run('mv a.txt /tmp/new.txt');assert.equal(r.code,0,JSON.stringify(r));assert.equal(s.files['/tmp/new.txt'],files['/home/analyst/a.txt']);assert(!s.isFile('/home/analyst/a.txt'));});
test('mv no clobber',()=>{const s=sh(),r=s.run('mv -n a.txt b.txt');assert.equal(r.code,0);assert.equal(s.files['/home/analyst/a.txt'],files['/home/analyst/a.txt']);assert.equal(s.files['/home/analyst/b.txt'],files['/home/analyst/b.txt']);});
test('rmdir removes empty directory',()=>{const s=sh(),r=s.run('mkdir /tmp/empty ; rmdir /tmp/empty');assert.equal(r.code,0,JSON.stringify(r));assert(!s.isDir('/tmp/empty'));});
test('rmdir rejects nonempty',()=>err('rmdir sub'));
for(const c of ['cat a.txt | vi a.txt','vi a.txt > /tmp/out','vi a.txt b.txt','xargs -P2 echo',"printf '%q' x",'find sub -exec echo {} \\;','du --unsupported sub',"awk 'BEGIN {system(\"id\")}' a.txt",'tail -f a.txt'])test('unsupported explicit '+c,()=>err(c));
test('Linuxroom omits dedicated editor and animation screens',()=>{for(const command of ['vi','view','sl']){assert(!sh().supportedCommands.includes(command));err(command+' a.txt');}});
console.log('V3 command QA:',passed,'passed,',failed,'failed');if(failed)process.exitCode=1;
