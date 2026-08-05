// components.js — 全局组件：顶部关注条 followBar、站点头部 siteHeader、页脚 siteFooter、列表/徽章等
// 每个组件一个函数：改一处，全站生效。

import { escapeHtml } from './base.js';

/** 微型标签：11px / 大写字距 / 次要色，编辑感来源（仅用于拉丁/数字或短词）。 */
export function microLabel(text) {
  return `<span class="micro-label">${escapeHtml(text)}</span>`;
}

/** 括号式元数据：[内容]，括号次要色、内容 accent 色。 */
export function metaTag(text) {
  return `<span class="meta-tag"><span class="meta-tag__br">[</span>${escapeHtml(text)}<span class="meta-tag__br">]</span></span>`;
}

/** 顶部固定关注条（40px）：FOLLOW 微型标签 + 文案 + 关注B站按钮（新窗口打开）。 */
export function followBar(site) {
  return `<div class="follow-bar">
  <p class="follow-bar__text">${microLabel('FOLLOW')}<span class="follow-bar__msg">${escapeHtml(site.followBarText)}</span></p>
  <a class="follow-bar__btn" href="${escapeHtml(site.bilibiliUrl)}" target="_blank" rel="noopener">${escapeHtml(site.followBarBtn)}</a>
</div>`;
}

/**
 * 站点头部：站名品牌 + 游戏栏目导航 + 各游戏「攻略大全」hub 页链接。
 * currentSlug 高亮当前栏目；guideSlug 高亮当前攻略大全页（此时栏目链接不高亮）。
 */
export function siteHeader(site, games, currentSlug = '', guideSlug = '') {
  const navLinks = games
    .map((g) => {
      const current = g.slug === currentSlug && g.slug !== guideSlug ? ' aria-current="page"' : '';
      return `<a href="/${g.slug}/"${current}>${escapeHtml(g.name)}</a>`;
    })
    .join('\n    ');
  const guideLinks = games
    .map((g) => {
      const current = g.slug === guideSlug ? ' aria-current="page"' : '';
      return `<a href="/${g.slug}/guide/"${current}>攻略大全</a>`;
    })
    .join('\n    ');
  return `<header class="site-header">
  <a class="site-header__brand" href="/">${escapeHtml(site.name)}${microLabel('WIKI')}</a>
  <nav class="site-header__nav" aria-label="游戏栏目">
    ${navLinks}
    ${guideLinks}
  </nav>
</header>`;
}

/** 页脚：超大描边空心收尾字 + 三栏结构（B站 / 抖音二维码+引导语 / 版权与免责声明）。 */
export function siteFooter(site) {
  return `<footer class="site-footer">
  <p class="site-footer__outline" aria-hidden="true">XINGCHUAN</p>
  <div class="site-footer__grid">
    <div class="site-footer__col">
      ${microLabel('BILIBILI / 关注')}
      <a class="site-footer__bilibili" href="${escapeHtml(site.bilibiliUrl)}" target="_blank" rel="noopener">B站主页：xingchuan（星川）</a>
    </div>
    <div class="site-footer__col">
      ${microLabel('DOUYIN / 视频讲解')}
      <div class="site-footer__douyin">
        <a class="site-footer__douyin-link" href="${escapeHtml(site.douyinUrl || 'https://v.douyin.com/vdEFIdcFuVU/')}" target="_blank" rel="noopener">
          <span class="site-footer__douyin-icon">🎵</span>
          <span class="site-footer__douyin-text">抖音：${escapeHtml(site.douyinName || '星川游戏菌【七日世界】')}</span>
        </a>
        <p>${escapeHtml(site.douyinGuide)}</p>
      </div>
    </div>
    <div class="site-footer__col">
      ${microLabel('NOTICE / 声明')}
      <p class="site-footer__copyright">${escapeHtml(site.copyright)}</p>
      <p class="site-footer__disclaimer">${escapeHtml(site.disclaimer)}</p>
    </div>
  </div>
</footer>`;
}

/** 状态徽章：完整 / 整理中。 */
export function badge(status) {
  return status === '完整'
    ? '<span class="badge badge--done">完整</span>'
    : '<span class="badge">整理中</span>';
}

/** 面包屑返回链接。 */
export function crumb(href, text) {
  return `<nav class="crumb" aria-label="面包屑">${microLabel('BACK')}<a href="${href}">← ${escapeHtml(text)}</a></nav>`;
}

/** 「内容持续整理中」提示条。 */
export function wipNote(text = '内容持续整理中，更多条目会陆续补充。') {
  return `<p class="note">${microLabel('WIP')}<span>${escapeHtml(text)}</span></p>`;
}

/**
 * 攻略信息卡（配装详情页头部，h1 + 括号元数据行之后、§1 之前）。
 * GUIDE INFO 小标记 + 细分隔线网格（移动端 2 列，≥480px 一排四列）。
 * 优雅降级：info 缺失/不是对象返回空字符串；缺某个 key 只跳过对应格子，不渲染空格。
 * 「最后更新」格值用 accent 色（时效性信号，对齐 Maxroll Last Updated 强调）。
 */
export function infoCard(info) {
  if (!info || typeof info !== 'object') return '';
  const cells = [
    ['适用赛季 SEASON', info.season, ''],
    ['难度 DIFFICULTY', info.difficulty, ''],
    ['养成耗时 TIME', info.timeCost, ''],
    ['最后更新 UPDATED', info.updated, ' info-card__value--updated'],
  ]
    .filter(([, value]) => value)
    .map(
      ([label, value, cls]) => `    <div class="info-card__cell">
      ${microLabel(label)}
      <span class="info-card__value${cls}">${escapeHtml(value)}</span>
    </div>`
    );
  if (cells.length === 0) return '';
  return `<section class="info-card" aria-label="攻略信息">
  ${microLabel('GUIDE INFO')}
  <div class="info-card__grid">
${cells.join('\n')}
  </div>
</section>`;
}

/**
 * 高密度索引列表（热门攻略 / 板块预览 / 攻略大全 hub 通用）。
 * 每条 = 标题行 + 括号元数据行（有 tag/tags 时）+ 摘要。
 * items: [{ href, title, summary, tag?, tags? }]（tags 数组可渲染多个括号元数据）
 */
export function linkList(items) {
  const lis = items
    .map((it) => {
      const tags = Array.isArray(it.tags) ? it.tags : it.tag ? [it.tag] : [];
      const meta = tags.length
        ? `<span class="item-meta-row">${tags.filter(Boolean).map(metaTag).join('')}</span>`
        : '';
      return `  <li><a href="${it.href}">
      <span class="item-title">${escapeHtml(it.title)}</span>
      ${meta}
      <span class="item-summary">${escapeHtml(it.summary)}</span>
    </a></li>`;
    })
    .join('\n');
  return `<ul class="section-list">\n${lis}\n</ul>`;
}

/**
 * 文中视频卡（配装详情页正文内嵌，引流 B 站视频）。
 * raised 底 + accent 边框，整块为 <a>：新窗口打开 + rel noopener。
 * 优雅降级：video 缺失/非对象/缺 url 或 title 返回空字符串；note 缺失则不渲染注释行。
 * note 含「占位」时追加 [占位待替换] 括号元数据（正式上线视频替换后自动消失）。
 */
export function videoCard(video) {
  if (!video || typeof video !== 'object' || !video.url || !video.title) return '';
  const noteText = video.note ? `<span>${escapeHtml(video.note)}</span>` : '';
  const placeholder = video.note && video.note.includes('占位') ? metaTag('占位待替换') : '';
  const note =
    noteText || placeholder ? `<span class="video-card__note">${noteText}${placeholder}</span>` : '';
  return `<a class="video-card" href="${escapeHtml(video.url)}" target="_blank" rel="noopener">
  <span class="video-card__play" aria-hidden="true"><svg width="44" height="44" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="21.5" fill="var(--accent)"/><path d="M18 14.5 30.5 22 18 29.5Z" fill="var(--ink)"/></svg></span>
  <span class="video-card__body">
    ${microLabel('VIDEO / B站视频')}
    <span class="video-card__title">${escapeHtml(video.title)}</span>
    ${note}
  </span>
</a>`;
}

/** 返回顶部按钮：页面滚动超过 300px 时显示，点击平滑滚动回顶部。 */
export function backToTop() {
  return `<button class="back-to-top" id="backToTop" aria-label="返回顶部" title="返回顶部">
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 7 15 12"/></svg>
</button>
<script>
(function(){
  var btn = document.getElementById('backToTop');
  if (!btn) return;
  var ticking = false;
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(function() {
        btn.classList.toggle('back-to-top--visible', window.scrollY > 300);
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  onScroll();
})();
</script>`;
}