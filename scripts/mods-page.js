// mods-page.js — 模组图鉴页客户端交互（独立文件，避免模板字符串转义问题）
// 由 build.mjs 读取并注入到 /once-human/mods/ 页面的 <script> 中。
// 不走模板字符串插值，因此 \d、\{、\u2726 等反斜杠不会被吞掉。

(function(){
  var esc = function(s) { return String(s).replace(/[&<>"']/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var root = document.querySelector('[data-role=mod-grid]');
  if (!root) return;
  var search = document.getElementById('mod-search');
  var level = document.getElementById('mod-level');
  var levelVal = document.querySelector('[data-role=level-val]');
  var slotTabsEl = root.querySelector('[data-role=slot-tabs]');
  var genreTabsEl = root.querySelector('[data-role=genre-tabs]');
  var modListEl = root.querySelector('[data-role=mod-list]');
  var visibleCount = document.querySelector('[data-role=visible-count]');
  var detailEl = root.querySelector('[data-role=mod-detail]');
  var detailContent = root.querySelector('[data-role=mod-detail-content]');
  var detailOverlay = root.querySelector('[data-role=mod-detail-overlay]');
  var detailClose = root.querySelector('[data-role=mod-detail-close]');

  var currentSlot = '武器';
  var currentGenre = 301;

  var ITEMS = (function(){ try { return JSON.parse(document.getElementById('mods-data').textContent); } catch(e) { return []; } })();

  // 共享条目ID列表（需要降级tier映射）
  var SHARED_BUFF_IDS = [7405]; // 对所有怪物伤害
  var SHARED_ATTR_IDS = [5101]; // 生命
  
  function levelToTier(lv, entryId){
    lv = parseInt(lv) || 17;
    var base;
    if (lv <= 3) base = 0;
    else if (lv <= 6) base = 1;
    else if (lv <= 9) base = 2;
    else if (lv <= 12) base = 3;
    else if (lv <= 15) base = 3;
    else base = 4;
    
    // 共享 attr 条目：始终用 index 1
    if (entryId && SHARED_ATTR_IDS.indexOf(entryId) >= 0) return 1;
    // 共享 buff 条目：L13-15 降2级
    if (entryId && SHARED_BUFF_IDS.indexOf(entryId) >= 0) {
      if (lv >= 13 && lv <= 15) return Math.max(base - 2, 0);
    }
    return base;
  }

  function fmt(v){
    if (v === null || v === undefined) return '固定';
    return (v * 100).toFixed(1) + '%';
  }

  function hideDetail() {
    detailEl.classList.remove('is-open');
  }

  function positionDetail(mx, my) {
    var dw = detailEl.offsetWidth || 340;
    var dh = detailEl.offsetHeight || 300;
    var ww = window.innerWidth;
    var wh = window.innerHeight;
    var gap = 14;
    var left = mx + gap;
    var top = my - Math.min(dh / 2, wh / 3);
    if (left + dw > ww - 10) left = mx - dw - gap;
    if (top < 10) top = 10;
    if (top + dh > wh - 10) top = wh - dh - 10;
    detailEl.style.left = left + 'px';
    detailEl.style.top = top + 'px';
  }

  function showDetail(mod, vi, mx, my) {
    var v = mod.variants[vi];
    if (!v) return;
    var lv = parseInt(level.value) || 17;
    var tier = levelToTier(level.value);

    var h = '<h3 class="mod-detail__title">' + esc(mod.name) + '<span class="mod-detail__title-sfx">＜' + esc(v.suffix) + '＞</span></h3>';
    h += '<div class="mod-detail__sub">' + esc(v.applySlot || '') + (v.genreName ? ' \u00B7 ' + esc(v.genreName) : '') + '</div>';

    if (v.iconFile) {
      h += '<div class="mod-detail__icon-row"><img class="mod-detail__icon" src="' + esc(v.iconFile) + '" alt=""></div>';
    }

    if (v.desc) {
      h += '<div class="mod-detail__desc">' + esc(v.desc) + '</div>';
    }

    h += '<div class="mod-detail__stats">';
    for (var i = 0; i < (v.stats || []).length; i++) {
      var st = v.stats[i];
      var val = (st.levelValues && st.levelValues.length >= lv) ? st.levelValues[lv - 1] :
                (st.values && st.values.length > 0) ? st.values[tier] : null;
      var valStr = (val !== null && val !== undefined) ? fmt(val) : '固定';
      var label = st.desc || st.name;
      // 优先用 levelValues（按游戏等级直接查表），回退到 descValues[tier]
      var tierVals = (st.levelValues && st.levelValues.length >= lv) ? st.levelValues[lv - 1] : 
                     (st.descValues && st.descValues.length > tier) ? st.descValues[tier] : null;
      label = label.replace(/\{(\d)\}/g, function(_, n) {
        var idx = parseInt(n) - 1;
        if (tierVals && tierVals.length > idx && tierVals[idx] != null) {
          var vv = parseFloat(tierVals[idx]);
          return st.descIsPercent ? vv.toFixed(1) : (vv * 100).toFixed(1);
        }
        // 回退到 values 数组
        if (st.values && st.values.length > tier && st.values[tier] != null && idx === 0) {
          return fmt(st.values[tier]);
        }
        return '{' + n + '}';
      });
      h += '<div class="mod-detail__stat"><span class="mod-detail__stat-name">' + esc(label) + '</span><span class="mod-detail__stat-val">' + valStr + '</span></div>';
    }
    h += '</div>';

    if (lv >= 17 && v.isShiny && v.shinyDesc) {
      h += '<div class="mod-detail__shiny">\u2726 ' + esc(v.shinyDesc) + '</div>';
    }

    h += '<div class="mod-detail__sub" style="margin-top:8px;text-align:center;font-size:11px;">5级及以上，等级越高词条属性越高</div>';

    detailContent.innerHTML = h;
    detailEl.classList.add('is-open');
    positionDetail(mx, my);
  }

  function renderList(){
    var q = (search.value || '').trim().toLowerCase();
    var list = ITEMS.filter(function(m) {
      if (m.slot !== currentSlot) return false;
      if (currentSlot === '武器' && !m.variants.some(function(v) { return v.genreLib === currentGenre; })) return false;
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (visibleCount) visibleCount.textContent = '显示 ' + list.length + ' / ' + ITEMS.length + ' 个模组';
    var lv = parseInt(level.value) || 17;

    if (list.length === 0) {
      modListEl.innerHTML = '<div class="mod-list__empty">该分类暂无模组</div>';
      return;
    }

    var html = '';
    for (var mi = 0; mi < list.length; mi++) {
      var m = list[mi];
      var globalIdx = ITEMS.indexOf(m);
      var v0 = m.variants[0] || {};
      var metaParts = [];
      if (v0.applySlot) metaParts.push(esc(v0.applySlot));
      if (v0.genreName) metaParts.push(esc(v0.genreName));
      var meta = metaParts.length ? '<div class="mod-row__meta">' + metaParts.join(' \u00B7 ') + '</div>' : '';

      var tiles = '';
      for (var vi = 0; vi < m.variants.length; vi++) {
        var v = m.variants[vi];
        var icon = v.iconFile ? '<img class="mod-tile__icon" src="' + esc(v.iconFile) + '" alt="" loading="lazy">' : '';
        var glow = (v.isShiny && lv >= 17) ? '<span class="mod-tile__glow">\u2726</span>' : '';
        var glowingAttr = v.isShiny ? ' data-glowing="1"' : '';
        tiles += '<div class="mod-tile" data-mod="' + globalIdx + '" data-variant="' + vi + '"' + glowingAttr + '>'
          + '<div class="mod-tile__diamond">'
          + '<span class="mod-tile__level">' + esc(v.suffix) + '</span>'
          + icon + glow
          + '</div>'
          + '</div>';
      }

      html += '<div class="mod-row">'
        + '<div class="mod-row__label">'
        + '<div class="mod-row__name">' + esc(m.name) + (m.glowing ? ' <span class="mod-card__star">\u2726</span>' : '') + '</div>'
        + meta
        + '</div>'
        + '<div class="mod-row__tiles">' + tiles + '</div>'
        + '</div>';
    }
    modListEl.innerHTML = html;

    // 悬停/点击 tile → 属性悬浮窗（跟随光标）
    var tilesAll = modListEl.querySelectorAll('.mod-tile');
    for (var ti = 0; ti < tilesAll.length; ti++) {
      (function(tile) {
        tile.addEventListener('mouseenter', function(e) {
          var mi2 = parseInt(tile.dataset.mod);
          var vi2 = parseInt(tile.dataset.variant);
          showDetail(ITEMS[mi2], vi2, e.clientX, e.clientY);
        });
        tile.addEventListener('mousemove', function(e) {
          positionDetail(e.clientX, e.clientY);
        });
        tile.addEventListener('mouseleave', function() {
          hideDetail();
        });
        tile.addEventListener('click', function(e) {
          var mi2 = parseInt(tile.dataset.mod);
          var vi2 = parseInt(tile.dataset.variant);
          showDetail(ITEMS[mi2], vi2, e.clientX, e.clientY);
        });
      })(tilesAll[ti]);
    }
  }

  // 鼠标离开整个列表区域时隐藏悬浮窗
  modListEl.addEventListener('mouseleave', hideDetail);

  // 部位 tab
  slotTabsEl.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-slot]');
    if (!btn) return;
    slotTabsEl.querySelectorAll('.mod-slot-tab').forEach(function(b) { b.classList.toggle('is-active', b === btn); });
    currentSlot = btn.dataset.slot;
    genreTabsEl.style.display = currentSlot === '武器' ? '' : 'none';
    if (currentSlot !== '武器') currentGenre = 0;
    hideDetail();
    renderList();
  });

  // 流派 tab
  genreTabsEl.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-genre-id]');
    if (!btn) return;
    genreTabsEl.querySelectorAll('.mod-genre-tab').forEach(function(b) { b.classList.toggle('is-active', b === btn); });
    currentGenre = parseInt(btn.dataset.genreId);
    hideDetail();
    renderList();
  });

  // 搜索 / 等级联动
  search.addEventListener('input', renderList);
  level.addEventListener('input', function() {
    var lv = parseInt(level.value) || 17;
    if (levelVal) levelVal.textContent = lv;
    renderList();
  });

  renderList();
})();
