#!/usr/bin/env node
/**
 * build.mjs — xingchuan 静态攻略知识库构建脚本
 * 零依赖：仅使用 Node 内置模块（fs/path/url），不引入任何 npm 包。
 * 运行：node build.mjs  →  产出 dist/（纯静态，可直接上传任意服务器）
 *
 * 主题 / 子路径构建（风格选型用，日常更新内容无需理会）：
 *   THEME=night-blue            使用 themes/<name>.css + themes/<name>-cover.svg + themes/<name>-qr.svg
 *   BASE_PATH=/night-blue       所有站内链接与 assets 引用加此前缀（canonical / sitemap 不带前缀，选型 demo 不影响）
 *   OUT_DIR=/path/to/out        输出目录（默认 dist/）
 *   示例：THEME=night-blue BASE_PATH=/night-blue OUT_DIR=/mnt/agents/output/app/night-blue node build.mjs
 * 新增第 N 个主题：在 themes/ 下放 <name>.css / <name>-cover.svg / <name>-qr.svg 三个文件即可。
 * 不传任何环境变量时，按默认 ember-dark（暗夜暖橙）主题构建到 dist/。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderHomePage,
  renderGameHome,
  renderGuideHub,
  renderBuildsList,
  renderBuildDetail,
  renderGuideDetail,
  renderMaterialsList,
  renderMechanicsList,
  renderUpdatesList,
  renderModsList,
} from './templates/pages.js';

// 部署时替换为真实域名（当前为占位域名，仅用于 canonical / sitemap / robots）
const BASE_URL = 'https://xingchuan.me';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ---------- 主题 / 子路径 / 输出目录（环境变量，均有默认值，向后兼容） ----------
const THEME = process.env.THEME || 'ember-dark'; // 正式主题：暗夜暖橙（2026-08 选定）；切换主题传 THEME=<name>
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, ''); // 如 '/night-blue'，结尾斜杠归一化
const DIST = process.env.OUT_DIR || join(ROOT, 'dist');

/** 站内绝对路径加 BASE_PATH 前缀（'/' → '/night-blue/'）；无 BASE_PATH 时原样返回。 */
const bp = (p) => `${BASE_PATH}${p}`;

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, 'data', rel), 'utf8'));

// ---------- 读取数据（页面内容全部来自 data/ 下 JSON） ----------
const site = readJson('site.json');
const games = readJson('games.json');
// 游戏 slug → 该游戏的四个板块数据；新增游戏时在 data/ 下加目录并在此登记即可
const gameData = {
  'once-human': {
    builds: readJson('once-human/builds.json'),
    materials: readJson('once-human/materials.json'),
    mechanics: readJson('once-human/mechanics.json'),
    changelog: readJson('once-human/changelog.json'),
    codex: readJson('once-human/codex.json'),
    mods: readJson('once-human/mods.json'),
    guns: readJson('once-human/guns.json'),
    armor: readJson('once-human/armor.json'),
    exploration: readJson('once-human/exploration.json'),
    growth: readJson('once-human/growth.json'),
    story: readJson('once-human/story.json'),
  },
};

const pages = []; // { urlPath, html }
const addPage = (urlPath, html) => pages.push({ urlPath, html });
const canonicalOf = (urlPath) => `${BASE_URL}${urlPath}`;

/** 从板块数据提取预览条目（标题/摘要/链接），count 为取前几条。mods 板块无 status 字段（默认视为完整）。 */
function sectionPreview(game, kind, data, count) {
  return data.items
    .filter((item) => item.status === undefined || item.status === '完整') // 占位条目过滤；mods 等无 status 字段的板块默认全部通过
    .slice(0, count)
    .map((item) => {
    switch (kind) {
      case 'builds':
        return {
          title: item.title,
          summary: item.summary,
          href:
            item.status === '完整'
              ? `/${game.slug}/builds/${item.slug}/`
              : `/${game.slug}/builds/`,
        };
      case 'materials':
        return {
          title: item.name,
          summary: item.summary || `${item.location} · ${item.route}`,
          href:
            item.slug && Array.isArray(item.sections)
              ? `/${game.slug}/${data.slug}/${item.slug}/`
              : `/${game.slug}/${data.slug}/`,
        };
      case 'mechanics':
        return {
          title: item.name,
          summary: item.summary,
          href:
            item.slug && Array.isArray(item.sections)
              ? `/${game.slug}/mechanics/${item.slug}/`
              : `/${game.slug}/mechanics/`,
        };
      case 'updates':
        return {
          title: item.version,
          summary: item.summary,
          href:
            item.slug && Array.isArray(item.sections)
              ? `/${game.slug}/updates/${item.slug}/`
              : `/${game.slug}/updates/`,
        };
      case 'mods':
        return {
          title: `模组图鉴 · ${data.items.length} 个模组 · ${data.items.reduce((n,i)=>n+i.variants.length,0)} 个变体`,
          summary: data.description,
          href: `/${game.slug}/${data.slug}/`,
        };
      default:
        throw new Error(`未知板块类型: ${kind}`);
    }
  });
}

/** 从板块数据提取索引条目（标题/括号元数据/摘要/链接），取全部条目，供攻略大全 hub 页使用。 */
function sectionIndex(game, kind, data) {
  const base = `/${game.slug}`;
  return data.items.map((item) => {
    switch (kind) {
      case 'builds':
        return {
          title: item.title,
          tags: [item.status, item.updatedAt && `更新 ${item.updatedAt}`],
          summary: item.summary,
          href:
            item.status === '完整'
              ? `${base}/builds/${item.slug}/`
              : `${base}/builds/`,
        };
      case 'materials': {
        const hasDetail = item.slug && Array.isArray(item.sections);
        return {
          title: item.name,
          tags: [item.location, item.respawn],
          summary: item.summary || item.route,
          href: hasDetail ? `${base}/${data.slug}/${item.slug}/` : `${base}/${data.slug}/`,
        };
      }
      case 'mechanics': {
        const idx = item.name.indexOf('：');
        const tag = idx > 0 ? item.name.slice(0, idx) : data.section;
        const title = idx > 0 ? item.name.slice(idx + 1) : item.name;
        const hasDetail = item.slug && Array.isArray(item.sections);
        return {
          title,
          tags: [tag, hasDetail && item.updatedAt && `更新 ${item.updatedAt}`],
          summary: item.summary,
          href: hasDetail ? `${base}/mechanics/${item.slug}/` : `${base}/mechanics/`,
        };
      }
      case 'updates':
        return {
          title: item.version,
          tags: [item.date],
          summary: item.summary,
          href:
            item.slug && Array.isArray(item.sections)
              ? `${base}/updates/${item.slug}/`
              : `${base}/updates/`,
        };
      case 'mods':
        // 模组图鉴只有列表页（一页速查 101 模组 / 849 变体），hub 条目直接指到板块页
        return {
          title: `${item.name} · ${item.variants.length} 后缀`,
          tags: [item.slot, item.glowing ? 'GLOW' : null].filter(Boolean),
          summary: (item.variants[0]?.desc || '').slice(0, 60),
          href: `${base}/${data.slug}/`,
        };
      default:
        throw new Error(`未知板块类型: ${kind}`);
    }
  });
}

/** 攻略大全 hub 页的四个板块定义：板块名 + micro 英文标签 + 全部索引条目。 */
function guideSectionsOf(game) {
  const d = gameData[game.slug];
  const base = `/${game.slug}`;
  return [
    { kind: 'builds', data: d.builds, en: 'BUILDS' },
    { kind: 'mechanics', data: d.mechanics, en: 'MECHANICS' },
    { kind: 'materials', data: d.story, en: 'STORY' },
    { kind: 'materials', data: d.exploration, en: 'EXPLORATION' },
    { kind: 'materials', data: d.codex, en: 'CODEX' },
    { kind: 'materials', data: d.materials, en: 'MATERIALS' },
    { kind: 'materials', data: d.growth, en: 'GROWTH' },
    { kind: 'updates', data: d.changelog, en: 'CHANGELOG' },
  ].map(({ kind, data, en }) => ({
    title: data.section,
    en,
    href: `${base}/${data.slug}/`,
    items: sectionIndex(game, kind, data),
  }));
}

/** 一个游戏的四个板块定义（板块数据文件自带 slug 作为 URL 路径段）。 */
function sectionsOf(game) {
  const d = gameData[game.slug];
  return [
    { kind: 'builds', data: d.builds },
    { kind: 'mechanics', data: d.mechanics },
    { kind: 'materials', data: d.story },
    { kind: 'materials', data: d.exploration },
    { kind: 'materials', data: d.codex },
    { kind: 'materials', data: d.materials },
    { kind: 'materials', data: d.growth },
    { kind: 'updates', data: d.changelog },
  ].map(({ kind, data }) => ({
    kind,
    data,
    title: data.section,
    href: `/${game.slug}/${data.slug}/`,
    description: data.description,
    preview: sectionPreview(game, kind, data, 2),
  }));
}

// ---------- 首页：游戏导航 + 热门攻略（从各数据文件取前几条） ----------
const hot = [];
for (const game of games) {
  const d = gameData[game.slug];
  hot.push(...sectionPreview(game, 'builds', d.builds, 2).map((x) => ({ ...x, tag: d.builds.section })));
  hot.push(...sectionPreview(game, 'materials', d.materials, 1).map((x) => ({ ...x, tag: d.materials.section })));
  hot.push(...sectionPreview(game, 'mechanics', d.mechanics, 1).map((x) => ({ ...x, tag: d.mechanics.section })));
  hot.push(...sectionPreview(game, 'updates', d.changelog, 1).map((x) => ({ ...x, tag: d.changelog.section })));
}
addPage('/', renderHomePage({ site, games, hot, canonical: canonicalOf('/') }));

// ---------- 各游戏页面 ----------
for (const game of games) {
  const d = gameData[game.slug];
  const base = `/${game.slug}`;

  // 栏目首页
  // 封面图优先用 assets/<slug>-cover.jpeg（如小云雀生成的实拍氛围图）；不存在时回退主题 SVG 占位
  const coverUrl = existsSync(join(ROOT, 'assets', `${game.slug}-cover.jpeg`))
    ? `/assets/${game.slug}-cover.jpeg`
    : `/assets/${game.slug}-cover.svg`;
  addPage(`${base}/`, renderGameHome({ site, games, game, sections: sectionsOf(game), coverUrl, canonical: canonicalOf(`${base}/`) }));

  // 攻略大全 hub 页：四板块全部条目一页汇总
  addPage(`${base}/guide/`, renderGuideHub({ site, games, game, sections: guideSectionsOf(game), canonical: canonicalOf(`${base}/guide/`) }));

  // 配装推荐：列表页 + 状态为「完整」的条目生成详情页
  addPage(`${base}/builds/`, renderBuildsList({ site, games, game, data: d.builds, canonical: canonicalOf(`${base}/builds/`) }));
  for (const build of d.builds.items) {
    if (build.status === '完整') {
      const url = `${base}/builds/${build.slug}/`;
      addPage(url, renderBuildDetail({ site, games, game, build, canonical: canonicalOf(url) }));
    }
  }

  // 其余三个板块列表页；带 slug + sections 的条目用通用详情渲染器出详情页
  addPage(`${base}/materials/`, renderMaterialsList({ site, games, game, data: d.materials, canonical: canonicalOf(`${base}/materials/`) }));
  for (const item of d.materials.items) {
    if (item.slug && Array.isArray(item.sections)) {
      const url = `${base}/materials/${item.slug}/`;
      addPage(url, renderGuideDetail({ site, games, game, section: d.materials, item, canonical: canonicalOf(url) }));
    }
  }
  addPage(`${base}/mechanics/`, renderMechanicsList({ site, games, game, data: d.mechanics, canonical: canonicalOf(`${base}/mechanics/`) }));
  for (const item of d.mechanics.items) {
    if (item.slug && Array.isArray(item.sections)) {
      const url = `${base}/mechanics/${item.slug}/`;
      addPage(url, renderGuideDetail({ site, games, game, section: d.mechanics, item, canonical: canonicalOf(url) }));
    }
  }
  addPage(`${base}/updates/`, renderUpdatesList({ site, games, game, data: d.changelog, canonical: canonicalOf(`${base}/updates/`) }));
  for (const item of d.changelog.items) {
    if (item.slug && Array.isArray(item.sections)) {
      const url = `${base}/updates/${item.slug}/`;
      addPage(url, renderGuideDetail({ site, games, game, section: d.changelog, item, canonical: canonicalOf(url) }));
    }
  }
  // 万物图鉴
  addPage(`${base}/codex/`, renderMaterialsList({ site, games, game, data: d.codex, canonical: canonicalOf(`${base}/codex/`) }));
  for (const item of d.codex.items) {
    if (item.slug && Array.isArray(item.sections)) {
      const url = `${base}/codex/${item.slug}/`;
      const mainClass = item.slug === 'fur-bonuses' ? 'main--wide' : '';
      addPage(url, renderGuideDetail({ site, games, game, section: d.codex, item, canonical: canonicalOf(url), mainClass }));
    }
  }
  // 剧情
  addPage(`${base}/story/`, renderMaterialsList({ site, games, game, data: d.story, canonical: canonicalOf(`${base}/story/`) }));
  // 探索收集
  addPage(`${base}/exploration/`, renderMaterialsList({ site, games, game, data: d.exploration, canonical: canonicalOf(`${base}/exploration/`) }));
  // 角色成长
  addPage(`${base}/growth/`, renderMaterialsList({ site, games, game, data: d.growth, canonical: canonicalOf(`${base}/growth/`) }));
  // 武器图鉴 / 防具图鉴（占位页）
  addPage(`${base}/builds/guns/`, renderBuildsList({ site, games, game, data: d.guns, canonical: canonicalOf(`${base}/builds/guns/`) }));
  addPage(`${base}/builds/armor/`, renderBuildsList({ site, games, game, data: d.armor, canonical: canonicalOf(`${base}/builds/armor/`) }));
  // 模组图鉴（101 模组 / 849 后缀变体；纯列表页 + JS 交互，无详情页）
  addPage(`${base}/mods/`, renderModsList({ site, games, game, data: d.mods, canonical: canonicalOf(`${base}/mods/`) }));
}

// ---------- 清空并重建 dist/ ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ---------- 写出页面 ----------
for (const { urlPath, html } of pages) {
  const filePath = join(DIST, urlPath, 'index.html'); // '/' → dist/index.html
  mkdirSync(dirname(filePath), { recursive: true });
  // 链接策略：
  // - BASE_PATH 模式（主题选型册）：站内链接统一加前缀。
  // - 默认模式：站内根绝对链接（href="/..." / src="/..."）按页面深度转相对路径，
  //   保证站点部署在任意子路径（含预览环境）都能正常跳转。
  // 完整 URL（canonical / B站外链等 href="https://..."）不受影响；canonical 与 sitemap 不带前缀。
  const depth = urlPath.split('/').filter(Boolean).length; // '/' → 0，'/once-human/' → 1
  const toRelative = (m, attr, rest) => {
    if (rest === '') return `${attr}="${depth === 0 ? './' : '../'.repeat(depth)}"`; // 回首页
    return `${attr}="${depth === 0 ? '' : '../'.repeat(depth)}${rest}"`;
  };
  const outHtml = BASE_PATH
    ? html.replaceAll('href="/', `href="${BASE_PATH}/`).replaceAll('src="/', `src="${BASE_PATH}/`)
    : html.replace(/(href|src)="\/([^"]*)"/g, toRelative);
  writeFileSync(filePath, outHtml, 'utf8');
  console.log(`[page]  ${bp(urlPath)}`);
}

// ---------- 拷贝 assets ----------
// 主题文件：themes/<name>.css → style.css；<name>-cover.svg → 各游戏封面；<name>-qr.svg → 抖音二维码占位
const themesDir = join(ROOT, 'themes');
mkdirSync(join(DIST, 'assets'), { recursive: true });
copyFileSync(join(themesDir, `${THEME}.css`), join(DIST, 'assets', 'style.css'));
console.log(`[asset] ${bp('/assets/style.css')}  (theme: ${THEME})`);
for (const game of games) {
  copyFileSync(join(themesDir, `${THEME}-cover.svg`), join(DIST, 'assets', `${game.slug}-cover.svg`));
  console.log(`[asset] ${bp(`/assets/${game.slug}-cover.svg`)}  (theme: ${THEME})`);
}
copyFileSync(join(themesDir, `${THEME}-qr.svg`), join(DIST, 'assets', 'douyin-qr-placeholder.svg'));
console.log(`[asset] ${bp('/assets/douyin-qr-placeholder.svg')}  (theme: ${THEME})`);
// assets/ 下其余与主题无关的静态文件（若有）原样拷贝
const assetsSrc = join(ROOT, 'assets');
for (const file of readdirSync(assetsSrc)) {
  const srcPath = join(assetsSrc, file);
  const destPath = join(DIST, 'assets', file);
  // 如果是目录，递归复制
  if (statSync(srcPath).isDirectory()) {
    mkdirSync(destPath, { recursive: true });
    for (const subFile of readdirSync(srcPath)) {
      const subSrcPath = join(srcPath, subFile);
      const subDestPath = join(destPath, subFile);
      if (statSync(subSrcPath).isFile()) {
        copyFileSync(subSrcPath, subDestPath);
        console.log(`[asset] ${bp(`/assets/${file}/${subFile}`)}`);
      }
    }
    continue;
  }
  copyFileSync(srcPath, destPath);
  console.log(`[asset] ${bp(`/assets/${file}`)}`);
}

// ---------- sitemap.xml ----------
const today = new Date().toISOString().split('T')[0];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${BASE_URL}${p.urlPath}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf8');
console.log('[seo]   /sitemap.xml');

// ---------- robots.txt ----------
writeFileSync(
  join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`,
  'utf8'
);
console.log('[seo]   /robots.txt');

console.log(`\n构建完成：${pages.length} 个页面 + assets + sitemap.xml + robots.txt → ${DIST}`);
console.log(`主题：${THEME}；链接前缀：${BASE_PATH || '(无)'}`);
