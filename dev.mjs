/**
 * dev.mjs — 本地开发：监视源码 + 自动重建 + 本地预览（含浏览器自动刷新）
 * 零依赖：仅使用 Node 内置模块，与 build.mjs 保持一致的项目风格。
 *
 * 用法：
 *   node dev.mjs            默认 http://127.0.0.1:8080
 *   PORT=9000 node dev.mjs  指定端口（端口被占用时自动 +1 重试）
 *
 * 工作机制：
 *   1. 先执行一次构建（node build.mjs），产出 dist/
 *   2. 监视 data/ templates/ themes/ assets/ build.mjs，变化后防抖重建
 *   3. HTTP 静态服务 dist/，HTML 中注入轻量 live-reload 脚本（SSE），
 *      重建成功后自动刷新已打开的浏览器页面
 *   4. 支持 THEME / BASE_PATH / OUT_DIR 环境变量透传给 build.mjs
 */
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST = process.env.OUT_DIR || join(ROOT, 'dist');
const PORT_START = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ---------- 构建 ----------
function runBuild() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(ROOT, 'build.mjs')], {
      cwd: ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: process.env, // 透传 THEME / BASE_PATH / OUT_DIR
    });
    child.on('close', (code) => resolve(code === 0));
  });
}

// ---------- live-reload（SSE 广播） ----------
const lrClients = new Set();
function broadcastReload() {
  for (const res of lrClients) {
    try { res.write('event: reload\ndata: 1\n\n'); } catch { /* 忽略已断开连接 */ }
  }
}
const LR_SNIPPET = `<script>
(function(){try{var es=new EventSource('/__lr');es.addEventListener('reload',function(){location.reload();});es.onerror=function(){setTimeout(function(){try{es.close();}catch(e){} location.reload();},1500);};}catch(e){}})();
</script>`;

// ---------- 监视 + 防抖重建 ----------
const WATCH_TARGETS = ['data', 'templates', 'themes', 'assets', 'build.mjs'];
let rebuildTimer = null;
let building = false;
let pendingRebuild = false;

async function rebuild(reason) {
  if (building) { pendingRebuild = true; return; }
  building = true;
  const t0 = Date.now();
  console.log(`[watch] 变更检测：${reason} → 重新构建…`);
  const ok = await runBuild();
  building = false;
  if (ok) {
    console.log(`[watch] 构建完成（${Date.now() - t0} ms），已通知浏览器刷新`);
    broadcastReload();
  } else {
    console.error('[watch] 构建失败，保留上一版 dist/，等待下次变更');
  }
  if (pendingRebuild) {
    pendingRebuild = false;
    setTimeout(() => rebuild('构建期间的后续变更'), 100);
  }
}

function startWatchers() {
  for (const target of WATCH_TARGETS) {
    const full = join(ROOT, target);
    try {
      watch(full, { recursive: true }, (_event, filename) => {
        if (!filename || filename.includes('dist')) return;
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => rebuild(`${target}/${filename}`), 150);
      });
      console.log(`[watch] 监视中：${target}`);
    } catch (err) {
      console.error(`[watch] 无法监视 ${target}：${err.message}`);
    }
  }
}

// ---------- 静态服务 ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/__lr') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');
    lrClients.add(res);
    req.on('close', () => lrClients.delete(res));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = normalize(join(DIST, pathname));
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403); res.end('403'); return;
  }

  try {
    const st = await stat(filePath);
    if (st.isDirectory()) {
      res.writeHead(301, { Location: pathname + '/' }); res.end(); return;
    }
    let body = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
    if (type.startsWith('text/html')) {
      let html = body.toString('utf8');
      if (html.includes('</body>')) {
        html = html.replace('</body>', LR_SNIPPET + '</body>');
      } else {
        html += LR_SNIPPET;
      }
      body = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

// ---------- 启动 ----------
console.log('[dev]   首次构建…');
await runBuild();
startWatchers();

let port = PORT_START;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[dev]   端口 ${port} 被占用，尝试 ${port + 1}…`);
    port += 1;
    server.listen(port, '127.0.0.1');
  } else {
    console.error('[dev]   服务启动失败：', err);
    process.exit(1);
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`[dev]   预览地址：http://127.0.0.1:${port}/`);
  console.log('[dev]   修改 data/ templates/ themes/ assets/ 后自动重建并刷新浏览器；Ctrl+C 退出');
});