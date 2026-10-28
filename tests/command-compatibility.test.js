'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {spawnSync}=require('node:child_process');
require('../src/shell.js');
const shell=files=>new LogLabShell(files);
function output(s,command){const result=s.run(command);assert.equal(result.code,0,JSON.stringify(result));assert.equal(result.stderr,'');return result.stdout;}
function real(command,args,text){const run=spawnSync(command,args,{input:text,encoding:'utf8',env:{...process.env,LC_ALL:'C'}});assert.equal(run.status,0,run.stderr);return run.stdout;}
const gnu=name=>['g'+name,name].find(command=>{const r=spawnSync(command,['--version'],{encoding:'utf8'});return r.status===0&&r.stdout.includes('GNU');});

test('nl pads unnumbered empty lines and counts only numbered lines',()=>{
  const s=shell({input:'first\n\n\nlast'});
  assert.equal(output(s,"nl -w 1 -s ': ' input"),'1: first\n   \n   \n2: last\n');
  assert.equal(output(s,"nl -ba -w 1 -s ': ' input"),'1: first\n2: \n3: \n4: last\n');
  assert.equal(output(shell({input:''}),"nl -w 1 -s ': ' input"),'');
});
test('nl blank-line padding agrees with GNU for default and custom separators',{skip:!gnu('nl')},()=>{
  for(const text of ['first\n\n\nlast','first\n\n\nlast\n','\n',''])for(const args of [[],['-w','1','-s',': '],['-bt','-w','3','-s',''],['-w','1','-s','日'],['-w','1','-s','😀'],['-ba','-w','1','-s',': ']]){
    const result=shell({input:text}).execute('nl',[...args,'input'],'',{hasStdin:false});
    assert.equal(result.code,0,JSON.stringify(result));
    assert.equal(result.stdout,real(gnu('nl'),args,text),JSON.stringify(args));
  }
});

test('cat exposes CRLF, tabs and controls without transforming generated line-number tabs',()=>{
  const s=shell({'input':'x\ty\r\n\x01\x7f\n'});
  assert.equal(output(s,'cat -A input'),'x^Iy^M$\n^A^?$\n');
  assert.equal(output(s,'cat -T input'),'x^Iy\r\n\x01\x7f\n');
  assert.equal(output(s,'cat -E input'),'x\ty^M$\n\x01\x7f$\n');
  assert.equal(output(s,'cat -nv input'),'     1\tx\ty^M\n     2\t^A^?\n');
  assert.equal(output(shell({a:'x\r',b:'\n'}),'cat -E a b'),'x^M$\n');
});
test('cat continues past missing files and preserves emitted stream ordering',()=>{
  const r=shell({a:'one\n',b:'two\n'}).run('cat -A a missing b');assert.equal(r.code,1);assert.equal(r.stdout,'one$\ntwo$\n');assert.match(r.stderr,/missing.*No such file/);
});
test('cat visibility flags agree with GNU for UTF-8 and all ASCII controls',{skip:!gnu('cat')},()=>{
  const text=Array.from({length:128},(_,i)=>String.fromCharCode(i)).join('')+'日本語\r\n';
  for(const flag of ['-A','-v','-T','-E','-nvET','-e','-t'])assert.equal(output(shell({input:text}),'cat '+flag+' input'),real(gnu('cat'),[flag],text),flag);
});
test('checksums match independent crypto implementation across padding boundaries and UTF-8',()=>{
  for(const command of ['md5sum','sha256sum'])for(const text of ['', 'abc','日本語\r\n','\0\x01',...Array.from({length:12},(_,i)=>'x'.repeat(52+i)),'z'.repeat(1000000)]){
    const expected=createHash(command==='md5sum'?'md5':'sha256').update(text).digest('hex');
    assert.equal(output(shell({input:text}),command+' input'),expected+'  input\n');
  }
});
test('checksums accept stdin, binary markers and escaped names and continue on read errors',()=>{
  const s=shell({'a\\b':'abc',a:'abc'}),hash=createHash('sha256').update('abc').digest('hex');
  assert.equal(output(s,"printf abc | sha256sum"),hash+'  -\n');
  assert.equal(output(s,"sha256sum -b 'a\\b'"),'\\'+hash+' *a\\\\b\n');
  const r=s.run('sha256sum missing a');assert.equal(r.code,1);assert.equal(r.stdout,hash+'  a\n');assert.match(r.stderr,/No such file/);
});
test('sort supports multiple independent keys and global-option inheritance',()=>{
  const s=shell({input:'2 z\n1 c\n2 a\n1 b\n'});
  assert.equal(output(s,'sort -k1,1nr -k2,2 input'),'2 a\n2 z\n1 b\n1 c\n');
  assert.equal(output(s,'sort -r -k1,1n -k2,2 input'),'1 c\n1 b\n2 z\n2 a\n');
  assert.equal(output(s,'sort -u -k1,1nr input'),'2 z\n1 c\n');
});
test('sort human-size and version ordering include negative sizes, leading zeros and prereleases',()=>{
  assert.equal(output(shell({input:'1G\n2K\n1023M\n20\n-1K\n0\n'}),'sort -h input'),'-1K\n0\n20\n2K\n1023M\n1G\n');
  assert.equal(output(shell({input:'v10\nv2\nv1.10\nv1.2\nv1~rc1\nv1\n'}),'sort -V input'),'v1~rc1\nv1\nv1.2\nv1.10\nv2\nv10\n');
});
test('sort agrees with GNU across multikey, exact decimals, whitespace and version suffixes',{skip:!gnu('sort')},()=>{
  const cases=[
    {text:'2 z\n1 c\n2 a\n1 b\n',args:['-k1,1nr','-k2,2']},
    {text:'2 z\n1 c\n2 a\n1 b\n',args:['-r','-k1,1n','-k2,2']},
    {text:'a  z\nb a\nc   b\nd b \ne  a\n',args:['-k2,2']},
    {text:'a  z\nb a\nc   b\nd b \ne  a\n',args:['-k2b']},
    {text:'a \nb\nc  \nd x\n',args:['-k2,2']},
    {text:'a \nb\nc  \nd x\n',args:['-k2,2b','-k1,1r']},
    {text:'.b21\n.~.b2+a12b-ba\n.foo.bar\n.foo2.bar\n',args:['-V']},
    {text:'9007199254740993\n9007199254740992\n.010\n.01\n-0.2\n+2\nx\n',args:['-n']},
    {text:'-1K\n-10\n-2M\n0K\n0M\n+3\n2\n1000K\n1M\n',args:['-h']},
    {text:'foo-1.0.tar.gz\nfoo-1.0.1.tar.gz\nfoo-1.0.gz\nfoo-1.0~rc1.tar.gz\n.\n..\n.x2\n.x10\n\nv01\nv1\nv001\nv1a\nv1+\n',args:['-V']}
  ];for(const {text,args} of cases)assert.equal(output(shell({input:text}),'sort '+args.join(' ')+' input'),real(gnu('sort'),args,text),args.join(' '));
});
test('find -print0 preserves whitespace and newline names through xargs -0',()=>{
  const s=shell({'tree/a b':'a','tree/c\nd':'b'});
  assert.equal(output(s,'find tree -type f -print0'),'tree/a b\0tree/c\nd\0');
  assert.equal(output(s,"find tree -type f -print0 | xargs -0 -n1 printf '<%s>\\n'"),'<tree/a b>\n<tree/c\nd>\n');
});
test('find -exec dispatches virtual commands, replaces literal placeholders and supports batching',()=>{
  const s=shell({'tree/a b':'one\n','tree/z':'two\n'});
  assert.equal(output(s,"find tree -type f -exec cat '{}' \\;"),'one\ntwo\n');
  assert.equal(output(s,"find tree -type f -exec printf '<%s>\\n' '{}' +"),'<tree/a b>\n<tree/z>\n');
  assert.equal(output(s,"find tree -type f -exec echo 'file={}' \\;"),'file=tree/a b\nfile=tree/z\n');
  assert.equal(output(s,"find tree -type f -exec grep missing '{}' \\; -print"),'');
  assert.equal(s.run("find tree -type f -exec grep missing '{}' +").code,1);
  for(const command of ["find tree -exec sh -c id \\;","find tree -exec find '{}' \\;","find tree -exec echo '{}' extra +","find tree -exec echo '{}' "])assert.notEqual(s.run(command).code,0,command);
});
