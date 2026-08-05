// check-links.mjs — 扫描 dist/ 全部站内相对链接，报告死链
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, normalize, relative } from 'node:path';

const DIST = 'dist';
let bad = 0, total = 0;

function scan(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { scan(p); continue; }
    if (!f.endsWith('.html')) continue;
    const html = readFileSync(p, 'utf8');
    for (const m of html.matchAll(/href="(\.\.\/[^"]*|\.\/[^"]*)"/g)) {
      total++;
      const resolved = normalize(join(dirname(p), m[1]));
      const ok = existsSync(join(resolved, 'index.html')) || existsSync(resolved);
      if (!ok) { bad++; console.log('死链:', m[1], '←', relative(DIST, p)); }
    }
  }
}
scan(DIST);
console.log(`检查站内相对链接 ${total} 条，死链 ${bad} 条`);
process.exit(bad ? 1 : 0);
