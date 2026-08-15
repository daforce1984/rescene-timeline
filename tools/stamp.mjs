/**
 * 캐시 깨기 도장.
 *
 * GitHub Pages 는 css · js 에 `cache-control: max-age=600` 을 붙인다.
 * 고쳐 올려도 10분 동안은 브라우저가 옛 파일을 그대로 쓴다 — 고친 게 안 보인다.
 * 파일 내용에서 딴 짧은 해시를 주소 뒤에 붙여, **내용이 바뀌면 주소도 바뀌게** 한다.
 *
 *   node tools/stamp.mjs          찍는다
 *   node tools/stamp.mjs --check  맞는지만 본다 (검사기가 이걸 쓴다)
 *
 * 해시는 도장을 걷어낸 내용으로 낸다 — 안 그러면 도장이 도장을 바꾸며 돈다.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const strip = (t) => t.replace(/\?v=[0-9a-f]{8}/g, '');
const hash = (t) => crypto.createHash('sha1').update(strip(t)).digest('hex').slice(0, 8);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

export function stamp(check = false) {
  const out = [];
  const write = (p, next) => {
    const cur = read(p);
    if (cur === next) return;
    out.push(p);
    if (!check) fs.writeFileSync(path.join(ROOT, p), next);
  };

  // data.js → main.js 의 import 에 찍는다
  const vData = hash(read('js/data.js'));
  const main = read('js/main.js');
  write('js/main.js', main.replace(/from '\.\/data\.js(\?v=[0-9a-f]{8})?'/, `from './data.js?v=${vData}'`));

  // main.js · style.css → index.html 에 찍는다
  const vMain = hash(read('js/main.js'));
  const vCss = hash(read('css/style.css'));
  const html = read('index.html')
    .replace(/(href=")\.\/css\/style\.css(\?v=[0-9a-f]{8})?(")/, `$1./css/style.css?v=${vCss}$3`)
    .replace(/(src=")\.\/js\/main\.js(\?v=[0-9a-f]{8})?(")/, `$1./js/main.js?v=${vMain}$3`);
  write('index.html', html);

  return { stale: out, v: { css: vCss, main: vMain, data: vData } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes('--check');
  const r = stamp(check);
  if (!r.stale.length) console.log(`도장 최신 — css ${r.v.css} · main ${r.v.main} · data ${r.v.data}`);
  else if (check) { console.error(`❌ 도장이 낡았다: ${r.stale.join(', ')} — node tools/stamp.mjs 를 돌릴 것`); process.exit(1); }
  else console.log(`도장 갱신 — ${r.stale.join(', ')} · css ${r.v.css} · main ${r.v.main} · data ${r.v.data}`);
}
