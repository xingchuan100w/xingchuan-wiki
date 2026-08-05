// base.js — 页面骨架：head、SEO meta、百度统计注释占位
// 模板采用简单字符串插值函数，不引入任何模板引擎、零依赖。

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 渲染完整 HTML 页面骨架。
 * @param {object} opts
 * @param {string} opts.title       <title> 内容
 * @param {string} opts.description meta description 内容
 * @param {string} opts.canonical   canonical 完整 URL
 * @param {string} opts.content     <body> 内的页面内容（关注条/头部/main/页脚）
 * @param {string} [opts.ogTitle]   Open Graph 标题（可选，默认使用 title）
 * @param {string} [opts.ogDescription] Open Graph 描述（可选，默认使用 description）
 * @param {string} [opts.ogImage]   Open Graph 图片 URL（可选）
 * @param {string} [opts.ogType]    Open Graph 类型（可选，默认 'website'）
 * @param {object} [opts.jsonLd]    JSON-LD 结构化数据对象（可选）
 */
export function renderBase({ title, description, canonical, content, ogTitle, ogDescription, ogImage, ogType = 'website', jsonLd }) {
  const ogTitleContent = escapeHtml(ogTitle || title);
  const ogDescriptionContent = escapeHtml(ogDescription || description);
  
  const jsonLdScript = jsonLd ? 
    `  <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n  </script>` : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${escapeHtml(title)}</title>`,
    `  <meta name="description" content="${escapeHtml(description)}">`,
    `  <link rel="canonical" href="${escapeHtml(canonical)}">`,
    '  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">',
    '  <link rel="apple-touch-icon" href="/assets/favicon.svg">',
    '  ',
    '  <!-- Open Graph / Facebook -->',
    `  <meta property="og:type" content="${escapeHtml(ogType)}">`,
    `  <meta property="og:url" content="${escapeHtml(canonical)}">`,
    `  <meta property="og:title" content="${ogTitleContent}">`,
    `  <meta property="og:description" content="${ogDescriptionContent}">`,
    ogImage ? `  <meta property="og:image" content="${escapeHtml(ogImage)}">` : '  <!-- og:image 待配置 -->',
    '  ',
    '  <!-- Twitter -->',
    '  <meta property="twitter:card" content="summary_large_image">',
    `  <meta property="twitter:url" content="${escapeHtml(canonical)}">`,
    `  <meta property="twitter:title" content="${ogTitleContent}">`,
    `  <meta property="twitter:description" content="${ogDescriptionContent}">`,
    ogImage ? `  <meta property="twitter:image" content="${escapeHtml(ogImage)}">` : '  <!-- twitter:image 待配置 -->',
    '  ',
    '  <link rel="stylesheet" href="/assets/style.css">',
    jsonLdScript,
    '</head>',
    '<body>',
    content,
    '<!-- 百度统计 -->',
    '<script>',
    'var _hmt = _hmt || [];',
    '(function() {',
    '  var hm = document.createElement("script");',
    '  hm.src = "https://hm.baidu.com/hm.js?4978c44a417d2a78c20628e1dbc5c7ed";',
    '  var s = document.getElementsByTagName("script")[0]; ',
    '  s.parentNode.insertBefore(hm, s);',
    '})();',
    '</script>',
    '</body>',
    '</html>',
    '',
  ].filter(Boolean).join('\n');
}