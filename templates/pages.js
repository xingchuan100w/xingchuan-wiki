// pages.js — 各页面渲染函数（字符串插值，无模板引擎）
// 所有攻略内容均来自 data/ 下 JSON，由 build.mjs 注入，本文件只负责结构。

import { renderBase, escapeHtml } from './base.js';
import { followBar, siteHeader, siteFooter, badge, crumb, wipNote, linkList, microLabel, metaTag, infoCard, videoCard, backToTop } from './components.js';

/** 页面外壳：关注条 + 头部 + main + 页脚。guideSlug 非空时头部高亮「攻略大全」而非栏目。 */
function shell(site, games, currentSlug, inner, guideSlug = '') {
  return [
    followBar(site),
    siteHeader(site, games, currentSlug, guideSlug),
    `<main>\n${inner}\n</main>`,
    siteFooter(site),
    backToTop(),
  ].join('\n');
}

/** 从游戏全名中提取拉丁名（如「七日世界（Once Human）」→「Once Human」），用于描边空心大字。 */
function latinName(fullName) {
  const m = String(fullName).match(/[A-Za-z][A-Za-z\s]*/);
  return m ? m[0].trim() : '';
}

/** 详情页右侧本页目录（桌面 ≥1024px 显示，移动端隐藏）。items: [{ no, heading }]，锚点 #sec-<no>。 */
function tocNav(items) {
  const lis = items
    .map(
      (it) =>
        `  <li><a href="#sec-${it.no}"><span class="toc__no" aria-hidden="true">§${it.no}</span>${escapeHtml(it.heading)}</a></li>`
    )
    .join('\n');
  return `<nav class="toc" aria-label="本页目录">\n  ${microLabel('ON THIS PAGE')}\n  <ul class="toc__list">\n${lis}\n  </ul>\n</nav>`;
}

/** 首页 = 游戏导航页：超大品牌 hero + 游戏栏目入口大块 + 热门攻略索引。 */
export function renderHomePage({ site, games, hot, canonical }) {
  const gameEntries = games
    .map((g, i) => {
      const latin = latinName(g.fullName);
      const outline = latin
        ? `<span class="game-entry__outline" aria-hidden="true">${escapeHtml(latin)}</span>`
        : '';
      return `  <section class="game-entry">
    <a class="game-entry__link" href="/${g.slug}/">
      <span class="game-entry__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="game-entry__head">
        <h2 class="game-entry__name">${escapeHtml(g.name)}</h2>
        ${outline}
      </span>
      <p class="game-entry__desc">${escapeHtml(g.description)}</p>
      <span class="btn">进入${escapeHtml(g.name)}专区 →</span>
    </a>
  </section>`;
    })
    .join('\n');

  const inner = `<section class="hero">
  ${microLabel('GAME GUIDES / BY 星川游戏菌')}
  <h1 class="hero__title"><span class="hero__zh">星川</span><span class="hero__latin" aria-hidden="true">xingchuan</span></h1>
  <p class="lede hero__lede">七日世界攻略知识库——由 ${escapeHtml(site.brand)} 维护的玩家自制攻略站，手机端随时查。</p>
</section>
${gameEntries}
<h2 class="index-heading">${microLabel('INDEX / HOT')}热门攻略</h2>
${linkList(hot)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": site.brand,
    "url": canonical,
    "description": site.homeDescription,
    "potentialAction": {
      "@type": "SearchAction",
      "target": canonical + "?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  return renderBase({
    title: site.homeTitle,
    description: site.homeDescription,
    canonical,
    content: shell(site, games, '', inner),
    ogTitle: site.homeTitle,
    ogDescription: site.homeDescription,
    jsonLd,
  });
}

/** 游戏栏目首页：SVG 封面横幅（叠加超大标题）+ 01-04 编号板块大列表。 */
export function renderGameHome({ site, games, game, sections, canonical }) {
  const latin = latinName(game.fullName);
  const blocks = sections
    .map((sec, i) => {
      const latest = sec.preview[0];
      const latestLine = latest
        ? `<span class="sec-index__latest">${metaTag('最新')}${escapeHtml(latest.title)}</span>`
        : '';
      return `  <li class="sec-index__item">
    <a class="sec-index__link" href="${sec.href}">
      <span class="sec-index__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="sec-index__body">
        <span class="sec-index__title">${escapeHtml(sec.title)}</span>
        <span class="sec-index__desc">${escapeHtml(sec.description)}</span>
        ${latestLine}
      </span>
      <span class="sec-index__arrow" aria-hidden="true">→</span>
    </a>
  </li>`;
    })
    .join('\n');

  const inner = `<figure class="cover">
  <img src="/assets/${escapeHtml(game.slug)}-cover.svg" alt="${escapeHtml(game.coverPlaceholder)}" width="1200" height="420">
  <figcaption class="cover__caption">
    ${microLabel(latin ? `${latin} / 攻略专区` : '攻略专区')}
    <h1 class="cover__title">${escapeHtml(game.name)}攻略专区</h1>
  </figcaption>
</figure>
<p class="lede">${escapeHtml(game.fullName)} · ${escapeHtml(game.description)}</p>
<section class="quick-links">
  ${microLabel('QUICK LINKS')}
  <h2 class="quick-links__title">快捷入口</h2>
  <div class="quick-links__grid">
    <a class="quick-links__item" href="https://qrsj-map.lzhailalu.com/" target="_blank" rel="noopener">
      <span class="quick-links__icon">🗺️</span>
      <span class="quick-links__name">交互地图</span>
      <span class="quick-links__desc">资源点位、据点标记</span>
    </a>
    <a class="quick-links__item" href="https://lzhailalu.com/" target="_blank" rel="noopener">
      <span class="quick-links__icon">⚔️</span>
      <span class="quick-links__name">配装器</span>
      <span class="quick-links__desc">装备搭配、模组模拟</span>
    </a>
    <a class="quick-links__item" href="https://market.lzhailalu.com/" target="_blank" rel="noopener">
      <span class="quick-links__icon">🤖</span>
      <span class="quick-links__name">星川助手</span>
      <span class="quick-links__desc">市场行情、数据查询</span>
    </a>
    <div class="quick-links__qr">
      <img src="/assets/wechat-mini-program.png" alt="微信小程序 回响宝典 二维码" width="120" height="120" loading="lazy">
      <span class="quick-links__qr-name">微信小程序</span>
      <span class="quick-links__qr-desc">回响宝典</span>
    </div>
  </div>
</section>
<ol class="sec-index">
${blocks}
</ol>
<p class="hub-cta">
  <a class="hub-cta__link" href="/${escapeHtml(game.slug)}/guide/">
    <span class="hub-cta__text">攻略大全 · 全部内容一页速查</span>
    <span class="hub-cta__arrow" aria-hidden="true">→</span>
  </a>
</p>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": game.seoTitle,
    "description": game.seoDescription,
    "url": canonical,
    "isPartOf": { "@type": "WebSite", "name": site.brand, "url": "/" }
  };

  return renderBase({
    title: game.seoTitle,
    description: game.seoDescription,
    canonical,
    content: shell(site, games, game.slug, inner),
    ogTitle: game.seoTitle,
    ogDescription: game.seoDescription,
    jsonLd,
  });
}

/**
 * 攻略大全 hub 页：四个板块的全部条目按板块分组汇总渲染。
 * 板块头 = 超大编号 01-04 + 宋体板块名 + micro 英文标签（整块链到板块列表页）；
 * 板块下用与首页热门攻略同款的高密度索引列表列出全部条目（标题 + 括号元数据 + 摘要）。
 * sections: [{ title, en, href, items: [{ href, title, tags, summary }] }]（items 为空数组时该板块渲染空列表）
 */
export function renderGuideHub({ site, games, game, sections, canonical }) {
  const blocks = sections
    .map(
      (sec, i) => `  <section class="hub-sec">
    <a class="hub-sec__head" href="${sec.href}">
      <span class="hub-sec__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="hub-sec__body">
        <span class="hub-sec__title">${escapeHtml(sec.title)}</span>
        ${microLabel(sec.en)}
      </span>
      <span class="hub-sec__arrow" aria-hidden="true">→</span>
    </a>
${linkList(sec.items)}
  </section>`
    )
    .join('\n');

  const inner = `${crumb(`/${game.slug}/`, `${game.name}专区`)}
<p class="meta-row">${metaTag('GUIDE HUB')}${metaTag('全部内容')}</p>
<h1>${escapeHtml(game.name)}攻略大全</h1>
<p class="lede">配装、材料、周本机制与版本更新全部条目一页汇总，持续更新，建议收藏，手机端随时查。</p>
${blocks}`;

  return renderBase({
    title: `${game.name}攻略大全：配装/材料/周本/版本更新一站式目录 - xingchuan`,
    description: `${game.name}攻略大全：流派配装、采集与生产、周本与机制、版本情报全部条目汇总目录，一站式速查，持续更新，建议收藏。`,
    canonical,
    content: shell(site, games, game.slug, inner, game.slug),
  });
}

/** 配装推荐列表页：每条 = 标题行 + 括号元数据行 + 摘要。 */
export function renderBuildsList({ site, games, game, data, canonical }) {
  const lis = data.items
    .map((b) => {
      const meta = `<span class="item-meta-row">${metaTag(b.status)}${metaTag(`更新 ${b.updatedAt}`)}</span>`;
      const body = `<span class="item-title">${escapeHtml(b.title)}</span>
      ${meta}
      <span class="item-summary">${escapeHtml(b.summary)}</span>`;
      return b.status === '完整'
        ? `  <li><a href="/${game.slug}/builds/${b.slug}/">${body}</a></li>`
        : `  <li><div class="list-static">${body}</div></li>`;
    })
    .join('\n');

  const inner = `${crumb(`/${game.slug}/`, `${game.name}专区`)}
<p class="meta-row">${metaTag('SECTION')}${metaTag(data.section)}</p>
<h1>${escapeHtml(game.name)}${escapeHtml(data.section)}</h1>
<p class="lede">${escapeHtml(data.description)}</p>
<ul class="section-list">
${lis}
</ul>`;

  return renderBase({
    title: data.seoTitle,
    description: data.seoDescription,
    canonical,
    content: shell(site, games, game.slug, inner),
  });
}

/** 配装详情页：括号元数据头 + 适用场景、武器/装备表格、模组/词条建议、材料需求、正文段落。 */
export function renderBuildDetail({ site, games, game, build, canonical }) {
  const gearRows = build.gear
    .map(
      (g) => `      <tr><td>${escapeHtml(g.slot)}</td><td>${escapeHtml(g.name)}</td><td>${escapeHtml(g.note)}</td></tr>`
    )
    .join('\n');
  const modLis = build.mods.map((m) => `  <li>${escapeHtml(m)}</li>`).join('\n');
  const matRows = build.materialsNeeded
    .map(
      (m) =>
        `      <tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.amount)}</td><td>${escapeHtml(m.source)}</td></tr>`
    )
    .join('\n');
  const paras = build.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');

  const secH = (no, text) =>
    `<h2 class="sec-h" id="sec-${no}"><span class="sec-h__no" aria-hidden="true">§${no}</span>${escapeHtml(text)}</h2>`;

  // 文中视频卡：按 video.after 指定的小节（s1-s5）插入到该小节内容之后；
  // after 缺失或不匹配时归入 s5（文章末尾）；videos 字段缺失时全部为空、不渲染。
  const videoSlots = { s1: [], s2: [], s3: [], s4: [], s5: [] };
  if (Array.isArray(build.videos)) {
    for (const v of build.videos) {
      const key = v && typeof v.after === 'string' && v.after in videoSlots ? v.after : 's5';
      videoSlots[key].push(videoCard(v));
    }
  }
  const vids = (id) => videoSlots[id].filter(Boolean).join('\n');

  const inner = `<div class="detail-layout">
<article>
${crumb(`/${game.slug}/builds/`, `${game.name}配装推荐`)}
<h1>${escapeHtml(game.name)}${escapeHtml(build.title)}</h1>
<p class="meta-row">${metaTag(build.status)}${metaTag(`更新 ${build.updatedAt}`)}${metaTag(`BY ${site.name.toUpperCase()}`)}</p>
${infoCard(build.info)}
${secH(1, '适用场景')}
<p>${escapeHtml(build.scenario)}</p>
${vids('s1')}
${secH(2, '武器/装备列表')}
<div class="table-wrap">
  <table>
    <thead><tr><th>部位</th><th>装备</th><th>说明</th></tr></thead>
    <tbody>
${gearRows}
    </tbody>
  </table>
</div>
${vids('s2')}
${secH(3, '模组/词条建议')}
<ul class="text-list">
${modLis}
</ul>
${vids('s3')}
${secH(4, '材料需求')}
<div class="table-wrap">
  <table>
    <thead><tr><th>材料</th><th>数量</th><th>获取途径</th></tr></thead>
    <tbody>
${matRows}
    </tbody>
  </table>
</div>
${vids('s4')}
${secH(5, '配装思路')}
${paras}
${vids('s5')}
</article>
${tocNav([
  { no: 1, heading: '适用场景' },
  { no: 2, heading: '武器/装备列表' },
  { no: 3, heading: '模组/词条建议' },
  { no: 4, heading: '材料需求' },
  { no: 5, heading: '配装思路' },
])}
</div>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": build.title,
    "description": build.seoDescription,
    "url": canonical,
    "datePublished": build.updatedAt || "",
    "dateModified": build.updatedAt || "",
    "author": { "@type": "Person", "name": "星川 xingchuan" },
    "publisher": { "@type": "Organization", "name": site.brand },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical },
    "isPartOf": { "@type": "WebSite", "name": site.brand, "url": "/" }
  };

  return renderBase({
    title: build.seoTitle,
    description: build.seoDescription,
    canonical,
    content: shell(site, games, game.slug, inner),
    ogTitle: build.title,
    ogDescription: build.seoDescription,
    jsonLd,
  });
}

/**
 * 通用攻略详情渲染器：由 JSON 里的 sections 数组驱动，周本 BOSS / 机制问答 / 兑换码等详情页复用。
 * item: { title, seoTitle, seoDescription, updatedAt, status?, info?, sections: [{ heading, blocks }] }
 * blocks 支持四种类型：
 *   { "type": "paragraph", "text": "..." }                       普通段落（缺省类型）
 *   { "type": "list", "items": ["...", "..."] }                  无序列表
 *   { "type": "table", "cols": [...], "rows": [[...], ...] }     表格（移动端横向滚动）
 *   { "type": "note", "text": "..." }                            提示条（醒目免责声明等）
 */
export function renderGuideDetail({ site, games, game, section, item, canonical }) {
  const secH = (no, text) =>
    `<h2 class="sec-h" id="sec-${no}"><span class="sec-h__no" aria-hidden="true">§${no}</span>${escapeHtml(text)}</h2>`;

  const renderBlock = (b) => {
    if (!b || typeof b !== 'object') return '';
    if (b.type === 'list') {
      const lis = (b.items || []).map((t) => `  <li>${escapeHtml(t)}</li>`).join('\n');
      return `<ul class="text-list">\n${lis}\n</ul>`;
    }
    if (b.type === 'table') {
      const head = (b.cols || []).map((c) => `<th>${escapeHtml(c)}</th>`).join('');
      const rows = (b.rows || [])
        .map((r) => `      <tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('\n');
      return `<div class="table-wrap">
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`;
    }
    if (b.type === 'furniture-grid') {
      const cards = (b.items || []).map((item) => `    <div class="furniture-card">
      <div class="furniture-icon"><img src="/${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}" loading="lazy"></div>
      <div class="furniture-name">${escapeHtml(item.name)}</div>
    </div>`).join('\n');
      return `<div class="furniture-grid">\n${cards}\n</div>`;
    }
    if (b.type === 'note') {
      return `<p class="note">${microLabel('NOTE')}<span>${escapeHtml(b.text)}</span></p>`;
    }
    return `<p>${escapeHtml(b.text)}</p>`;
  };

  const secs = (item.sections || [])
    .map((s, i) => `${secH(i + 1, s.heading)}\n${(s.blocks || []).map(renderBlock).filter(Boolean).join('\n')}`)
    .join('\n');

  const meta = [
    metaTag(item.status || '完整'),
    item.updatedAt ? metaTag(`更新 ${item.updatedAt}`) : '',
    metaTag(`BY ${site.name.toUpperCase()}`),
  ].join('');

  const inner = `<div class="detail-layout">
<article>
${crumb(`/${game.slug}/${section.slug}/`, `${game.name}${section.section}`)}
<h1>${escapeHtml(game.name)}${escapeHtml(item.title)}</h1>
<p class="meta-row">${meta}</p>
${infoCard(item.info)}
${secs}
</article>
${tocNav((item.sections || []).map((s, i) => ({ no: i + 1, heading: s.heading })))}
</div>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": `${game.name}${item.title}`,
    "description": item.seoDescription,
    "url": canonical,
    "datePublished": item.updatedAt || "",
    "dateModified": item.updatedAt || "",
    "author": { "@type": "Person", "name": "星川 xingchuan" },
    "publisher": { "@type": "Organization", "name": site.brand },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical },
    "isPartOf": { "@type": "WebSite", "name": site.brand, "url": "/" }
  };

  return renderBase({
    title: item.seoTitle,
    description: item.seoDescription,
    canonical,
    content: shell(site, games, game.slug, inner),
    ogTitle: `${game.name}${item.title}`,
    ogDescription: item.seoDescription,
    jsonLd,
  });
}

/** 生产与制作相关列表页：与机制页同款条目列表（材料名 + 括号元数据[区域][刷新] + 摘要），带详情页的条目整条可点。 */
export function renderMaterialsList({ site, games, game, data, canonical }) {
  const blocks = data.items
    .map((m) => {
      // 支持两种数据结构：materials 和 collection
      const title = m.name || m.title;
      const location = m.location || '';
      const respawn = m.respawn || '';
      const summary = m.summary || m.route || '';
      const meta = location || respawn ? `${metaTag(location)}${metaTag(respawn)}` : '';
      const body = `<span class="item-title">${escapeHtml(title)}</span>
      ${meta ? `<span class="item-meta-row">${meta}</span>` : ''}
      <span class="item-summary">${escapeHtml(summary)}</span>`;
      // 带 slug + sections 的条目有详情页，整行渲染为链接；否则维持静态条目
      // 链接路径用 data.slug（本渲染器被 materials 与 codex 两个板块复用，不能写死 materials）
      return m.slug && Array.isArray(m.sections)
        ? `  <li><a href="/${game.slug}/${data.slug}/${m.slug}/">${body}</a></li>`
        : `  <li><div class="list-static">${body}</div></li>`;
    })
    .join('\n');

  const inner = `${crumb(`/${game.slug}/`, `${game.name}专区`)}
<p class="meta-row">${metaTag('SECTION')}${metaTag(data.section)}</p>
<h1>${escapeHtml(game.name)}${escapeHtml(data.section)}</h1>
<p class="lede">${escapeHtml(data.description)}</p>
<ul class="section-list">
${blocks}
</ul>`;

  return renderBase({
    title: data.seoTitle,
    description: data.seoDescription,
    canonical,
    content: shell(site, games, game.slug, inner),
  });
}

/** 周本/机制攻略列表页：条目前缀（「周本：」「机制：」）转为括号元数据。 */
export function renderMechanicsList({ site, games, game, data, canonical }) {
  const blocks = data.items
    .map((m) => {
      const idx = m.name.indexOf('：');
      const kind = idx > 0 ? m.name.slice(0, idx) : data.section;
      const title = idx > 0 ? m.name.slice(idx + 1) : m.name;
      const body = `<span class="item-title">${escapeHtml(title)}</span>
      <span class="item-meta-row">${metaTag(kind)}${m.updatedAt ? metaTag(`更新 ${m.updatedAt}`) : ''}</span>
      <span class="item-summary">${escapeHtml(m.summary)}</span>`;
      // 带 slug + sections 的条目有详情页，整行渲染为链接；否则维持静态条目
      return m.slug && Array.isArray(m.sections)
        ? `  <li><a href="/${game.slug}/mechanics/${m.slug}/">${body}</a></li>`
        : `  <li><div class="list-static">${body}</div></li>`;
    })
    .join('\n');

  const inner = `${crumb(`/${game.slug}/`, `${game.name}专区`)}
<p class="meta-row">${metaTag('SECTION')}${metaTag(data.section)}</p>
<h1>${escapeHtml(game.name)}${escapeHtml(data.section)}</h1>
<p class="lede">${escapeHtml(data.description)}</p>
<ul class="section-list">
${blocks}
</ul>`;

  return renderBase({
    title: data.seoTitle,
    description: data.seoDescription,
    canonical,
    content: shell(site, games, game.slug, inner),
  });
}

/** 版本更新日志列表页：日期转为括号元数据。 */
export function renderUpdatesList({ site, games, game, data, canonical }) {
  const blocks = data.items
    .map((u) => {
      const body = `<span class="item-title">${escapeHtml(u.version)}</span>
      <span class="item-meta-row">${metaTag(u.date)}</span>
      <span class="item-summary">${escapeHtml(u.summary)}</span>`;
      // 带 slug + sections 的条目（如兑换码汇总）有详情页，整行渲染为链接
      return u.slug && Array.isArray(u.sections)
        ? `  <li><a href="/${game.slug}/updates/${u.slug}/">${body}</a></li>`
        : `  <li><div class="list-static">${body}</div></li>`;
    })
    .join('\n');

  const inner = `${crumb(`/${game.slug}/`, `${game.name}专区`)}
<p class="meta-row">${metaTag('SECTION')}${metaTag(data.section)}</p>
<h1>${escapeHtml(game.name)}${escapeHtml(data.section)}</h1>
<p class="lede">${escapeHtml(data.description)}</p>
<ul class="section-list">
${blocks}
</ul>`;

  return renderBase({
    title: data.seoTitle,
    description: data.seoDescription,
    canonical,
    content: shell(site, games, game.slug, inner),
  });
}
