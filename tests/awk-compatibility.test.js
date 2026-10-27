'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
require('../src/shell.js');
const input = '10 web aki\n20 mail ren\n30 api aki\n';
function run(program, expected, text=input, options='') {
  const shell = new globalThis.LogLabShell({'rows.txt':text});
  const result = shell.run(`awk ${options} '${program}' rows.txt`);
  assert.equal(result.code,0,result.stderr);
  assert.equal(result.stderr,'');
  assert.equal(result.stdout,expected,program);
}

test('awk implicit concatenation preserves expression precedence and output separators',()=>{
  run('{print $1":"$2}', '10:web\n20:mail\n30:api\n');
  run('{print "user=" $3}', 'user=aki\nuser=ren\nuser=aki\n');
  run('{print NR": "$0}', '1: 10 web aki\n2: 20 mail ren\n3: 30 api aki\n');
  run('BEGIN {OFS="|"} {print $1+1 ":" $2, "user=" $3}', '11:web|user=aki\n21:mail|user=ren\n31:api|user=aki\n');
  run('BEGIN {print "x" 1+2, 2*3 "y", ("a" "b" == "ab")}', 'x3 6y 1\n');
});

test('awk division and regex literals coexist in expressions, print lists, and blocks',()=>{
  run('{s += $1} END {print s/NR}', '20\n');
  run('{print $1/2, $2 ~ /a/}', '5 0\n10 1\n15 1\n');
  run('BEGIN {print 12/3/2; print 1/3}', '2\n0.333333\n');
  run('/a[;{}]b/ {print $1/2; print /a[;{}]b/}', '5\n1\n', '10 a;b\n');
  run('BEGIN {print 6 / 2; print "x;y"; print "a,b"}', '3\nx;y\na,b\n');
});

test('awk printf formats evaluated arguments once without repeating the format',()=>{
  run('{printf "%02d:%-5s %.1f\\n", NR, $2, $1/3}', '01:web   3.3\n02:mail  6.7\n03:api   10.0\n');
  run('BEGIN {printf "[%s]", "one", "ignored"; printf "%%:%c:%c\\n", 65, "Z"}', '[one]%:A:Z\n');
  run('BEGIN {printf("%s=%03d\\n", "value", 7)}', 'value=007\n');
  run('BEGIN {printf "%+.2f %.2e %.3g\\n", 1.25, 3, 0.00001234}', '+1.25 3.00e+00 1.23e-05\n');
  run('BEGIN {printf "%s", "\\\\n"}', '\\n');
});

test('awk substr and length follow the documented Unicode character model',()=>{
  run('{print substr($2,2), substr($2,2,1)}', 'eb e\nail a\npi p\n');
  run('{print length($0), substr($0,2,2)}', '4 本😀\n', '日本😀語\n');
  run('BEGIN {print substr("abc",0,2), substr("abc",8), substr("abc",1,-2)}', 'ab  \n');
});

test('awk field assignment rebuilds the record and supports multiple statements',()=>{
  run('{$1=""; print}', ' web aki\n mail ren\n api aki\n');
  run('BEGIN {OFS=":"} {$2="service"; $4=NR; print NF, $0}', '4:10:service:aki:1\n4:20:service:ren:2\n4:30:service:aki:3\n');
  run('{$0="a b"; print NF, $2}', '2 b\n2 b\n2 b\n');
  run('{x=$1/2; x+=1; print x}', '6\n11\n16\n');
  run('{$(NF-1)=""; print}', '10  aki\n20  ren\n30  aki\n');
});

test('awk associative arrays support deduplication and aggregation with collision-safe keys',()=>{
  run('!seen[$3]++', '10 web aki\n20 mail ren\n');
  run('!seen[$3]++ {print $3}', 'aki\nren\n');
  run('{count[$3]++} END {for (key in count) print key, count[key]}', 'aki 2\nren 1\n');
  run('!seen[$1]++', '__proto__\nconstructor\n', '__proto__\nconstructor\n__proto__\n');
  run('{s[$3]+=$1} END {for (key in s) printf "%s=%d\\n", key, s[key]}', 'aki=40\nren=20\n');
});

test('awk rejects unsupported or unbounded actions explicitly',()=>{
  for(const program of ['BEGIN {print 1/0}', 'BEGIN {printf "%q", 1}', 'BEGIN {printf "%s %s", "one"}', 'BEGIN {printf "%999999s", "x"}', '{$10001="x"}', 'BEGIN {system("id")}', 'BEGIN {while(1) print 1}']) {
    const result = new globalThis.LogLabShell({'rows.txt':input}).run(`awk '${program}' rows.txt`);
    assert.notEqual(result.code,0,program);
    assert.match(result.stderr,/awk:/,program);
  }
});
