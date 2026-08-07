// gen-mods v5：完整数据链（模组→后缀→4词条→等级数值→闪光）
// 用法：node scripts/gen-mods.mjs
// 数据源：
//   拆包 new_mod_property_data.json（模组+后缀+闪光）
//   拆包 new_mod_frame_lib_data.json（后缀→4词条池）
//   拆包 mod_entry_data.json（词条数值 6 tier）
//   飞书 mod_rows.json（图标 hash）

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DUMP = 'G:\\Downloads\\BINDICT_CO0808\\BINDICT_CO\\game_common';
const OFFICIAL_ICONS = 'D:\\WorkBuddy\\2026-08-06\\client_icons\\png\\ui\\dynamic_texpack\\all_icon_res\\mods_icon_cbt2\\mods_new';
const OUT = join(ROOT, '..', 'data', 'once-human', 'mods.json');
const OUT_ICONS = join(ROOT, '..', 'assets', 'mods');
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

const propsRaw = readJson(join(DUMP, 'new_mod_property_data.json'));
const framesLib = readJson(join(DUMP, 'new_mod_frame_lib_data.json'));
const entries = readJson(join(DUMP, 'mod_entry_data.json'));
// 流派 ID → 中文流派名（基于 new_mod_property_data 实际分布推断）
const GENRE_NAMES = {
  0: '全部基础',
  301: '灼烧',
  302: '电涌',
  303: '冰霜漩涡',
  304: '猎人标记',
  305: '重装阵地',
  306: '不稳定爆弹',
  307: '快枪手',
  311: '弹射',
  312: '碎弹',
};

// frame 排序优先级：通用基底在前，特殊流派在后
const GENRE_ORDER = [0, 301, 302, 303, 304, 305, 306, 307, 311, 312];

const applyRanges = readJson(join(DUMP, 'mod_apply_range_data.json'));
const buffLevel = readJson(join(DUMP + '/buff_level_data.json'));

// 共享条目检测：被多个 frame 引用的 entry，游戏内 tier 映射与专属条目不同
const entryFrameCount = {};
for (const [k, v] of Object.entries(framesLib)) {
  if (v.sub_entry_item_no) {
    for (const id of v.sub_entry_item_no) {
      entryFrameCount[id] = (entryFrameCount[id] || 0) + 1;
    }
  }
}
// 仅对"超级共享"条目降级（被10+ frame引用，且游戏内始终用最低tier）
// 7405=对所有怪物伤害(33帧), 5101=生命(10帧)
const sharedEntryIds = new Set([7405, 5101]);
// 官方图标目录索引（icon_path → 本地文件名）
const officialFiles = new Set(readdirSync(OFFICIAL_ICONS));
const iconResolve = (iconPath) => {
  if (!iconPath) return '';
  return officialFiles.has(iconPath) ? 'assets/mods/' + iconPath : '';
};

// apply_range → 部位
const applyIdToSlot = {};
for (const [k, v] of Object.entries(applyRanges)) applyIdToSlot[k] = v.desc;

// entry 查找（取第一个有 desc 或 attr_value_list 的 tier）
const findEntry = (id) => {
  for (let t = 1; t <= 6; t++) {
    const e = entries[id + '&' + t];
    if (e) return e;
  }
  return null;
};

// 主词条专用：遍历所有 tier，优先取有 desc 的（主词条描述在高 tier）
const findMainEntry = (id) => {
  let fallback = null;
  for (let t = 1; t <= 6; t++) {
    const e = entries[id + '&' + t];
    if (!e) continue;
    if (!fallback) fallback = e;
    if (e.desc && e.desc.trim()) return e; // 优先取有描述的 tier
  }
  return fallback;
};

// 获取 entry 的 6 个 tier 数值
const getTierValues = (id) => {
  const vals = [];
  for (let t = 1; t <= 6; t++) {
    const e = entries[id + '&' + t];
    vals.push(e?.attr_value_list?.[0] ?? null);
  }
  return vals;
};

// buff 词条（attr_value_list 为空的词条）：从 buff_level_data 取每级真实数值
// buff_level_data 存品质 1-5 五级，映射为 6 tier（第 6 tier 重复第 5 级，模组 L17=品质5）
// 返回 { values: [首值百分比小数]*6, descValues: [[所有值百分比小数]]*6, desc: 词条描述模板 }
const getBuffValues = (buffId) => {
  const lvVals = [];
  const allLvVals = []; // 每个 tier 的完整 desc_value 数组
  for (let lv = 1; lv <= 5; lv++) {
    const b = buffLevel[buffId + '&' + lv];
    if (b && b.desc_value && b.desc_value.length > 0) {
      lvVals.push(parseFloat(b.desc_value[0]));
      allLvVals.push(b.desc_value.map(v => parseFloat(v)));
    } else {
      lvVals.push(null);
      allLvVals.push(null);
    }
  }
  const valid = lvVals.filter((v) => v !== null);
  if (valid.length === 0) return { values: [], descValues: [], desc: '' };
  const values = [...lvVals.map((v) => (v === null ? valid[valid.length - 1] : v / 100)), valid[valid.length - 1] / 100];
  // descValues: 每个 tier 的所有值（百分比小数），第6 tier 重复第5 tier
  const lastValid = allLvVals.filter(v => v !== null).pop() || [];
  const descValues = [...allLvVals.map(v => v === null ? lastValid.map(x => x) : v.map(x => x)), lastValid.map(x => x)];
  const desc = (buffLevel[buffId + '&1']?.buff_desc || '').replace(/#7#/g, '');
  return { values, descValues, desc };
};

// 闪光加成：shiny_buff_id → buff_level_data 的 buff_desc（固定文本）
const getShinyDesc = (buffId) => {
  if (!buffId) return '';
  const b = buffLevel[buffId + '&1'];
  return (b?.buff_desc || '').replace(/#7#/g, '');
};

// 获取 entry 名称
const getEntryName = (id) => {
  const e = findEntry(id);
  return e?.name || '';
};

// 格式化主词条 desc
const formatDesc = (entry) => {
  if (!entry || !entry.desc) return '';
  const dr = entry.desc_replace || [];
  const desc = entry.desc.replace(/#\d+#/g, '');
  const result = desc.replace(/\{(\d)\}/g, (match, n, offset) => {
    const v = dr[parseInt(n) - 1];
    if (v === undefined) return '?';
    const num = parseFloat(v);
    if (isNaN(num)) return v;
    // 仅当 % 紧跟在占位符后面时才乘100
    const after = desc.slice(offset + match.length);
    if (after.startsWith('%')) return (num * 100).toFixed(1) + '%';
    return num.toString();
  });
  // 去掉因 {N}% + 格式化输出 % 导致的双百分号
  return result.replace(/%%/g, '%');
};

// buff 描述格式化（值已是最终值，不乘100）
const formatBuffDesc = (buffId) => {
  if (!buffId) return '';
  const b = buffLevel[buffId + '&1'];
  if (!b || !b.buff_desc) return '';
  const dv = b.desc_value || [];
  return b.buff_desc.replace(/#\d+#/g, '').replace(/\{(\d)\}/g, (_, n) => {
    const v = dv[parseInt(n) - 1];
    if (v === undefined) return '?';
    return v;
  });
};

// 按 name+suffix 聚合
const byName = {};
for (const p of Object.values(propsRaw)) {
  if (!p.mod_name) continue;
  const m = p.mod_name.match(/^(.+?)<(.+)>$/);
  if (!m) continue;
  const [, name, suffix] = m;
  if (!byName[name]) byName[name] = { name, slot: '武器', glowing: false, variants: [] };

  const existing = byName[name].variants.find((v) => v.suffix === suffix);
  if (existing) {
    if (p.is_shiny_mod) {
      existing.isShiny = true;
      existing.shinyBuffId = p.shiny_buff_id;
      existing.shinyDesc = getShinyDesc(p.shiny_buff_id); // 闪光版合并时回填加成描述
    }
    continue;
  }

  // 主词条 desc（entry desc → buff desc → entry name 三级回退）
  const mainEntry = findMainEntry(p.main_entry_no);
  const dumpDesc = formatDesc(mainEntry);
  const buffDesc = formatBuffDesc(p.shiny_buff_id || (mainEntry && mainEntry.buff_id) || 0);
  const descOut = dumpDesc || buffDesc || (mainEntry ? mainEntry.name : '（词条数据待补）');

  // 官方图标（拆包 icon_path → mods_new 目录）
  const iconFile = iconResolve(p.icon_path);

  // 4 词条（从 frame lib 获取；attr 词条取 attr_value_list，buff 词条取 buff_level_data 每级数值）
  const frameData = framesLib[String(p.frame)];
  const stats = [];
  if (frameData && frameData.sub_entry_item_no) {
    for (const subId of frameData.sub_entry_item_no) {
      const e = findEntry(subId);
      const eName = e?.name || '未知词条';
      const attrVals = getTierValues(subId);
      if (attrVals.some((v) => v !== null)) {
        // 存原始模板（去掉 #N# 但保留 {N}）+ 所有 tier 的 desc_replace 值
        const rawDesc = e.desc ? e.desc.replace(/#\d+#/g, '') : '';
        const allDescVals = [];
        for (let t = 1; t <= 5; t++) {
          const te = entries[subId + '&' + t];
          if (te && te.desc_replace && te.desc_replace.length) {
            allDescVals.push(te.desc_replace.map(v => parseFloat(v)));
          } else if (te && te.attr_value_list && te.attr_value_list.length) {
            allDescVals.push(te.attr_value_list.map(v => v));
          } else {
            allDescVals.push([]);
          }
        }
        // 第6个tier重复第5个（L16-17=L13-15）
        allDescVals.push(allDescVals[4] ? allDescVals[4].map(x => x) : []);
        // 共享条目调整：游戏内 tier 映射与专属条目不同
        // 共享 attr 条目：L4-17 统一用 tier2 值
        if (sharedEntryIds.has(subId)) {
          if (allDescVals[1]) {
            for (let i = 2; i <= 5; i++) allDescVals[i] = allDescVals[1].map(x => x);
          }
        }
        stats.push({ name: eName, desc: rawDesc || eName, values: attrVals, descValues: allDescVals, descIsPercent: false });
      } else if (e?.buff_id) {
        // 固定效果词条：从 buff_level_data 取每级真实数值
        const bv = getBuffValues(e.buff_id);
        const dv = bv.descValues || [];
        // 共享条目调整：游戏内 tier 映射与专属条目不同
        // 共享 buff 条目：L4-17 统一用 lv2 值（除最后 tier 保留 lv5）
        if (sharedEntryIds.has(subId) && dv.length >= 6 && dv[1]) {
          for (let i = 2; i <= 4; i++) dv[i] = dv[1].map(x => x);
        }
        stats.push({ name: eName, desc: bv.desc || eName, values: bv.values.length ? bv.values : [], descValues: dv, descIsPercent: true });
      } else {
        stats.push({ name: eName, desc: eName, values: [] });
      }
    }
  }

  // 闪光加成描述（L17 闪光模组专属）
  const shinyDesc = getShinyDesc(p.shiny_buff_id);

  byName[name].variants.push({
    suffix,
    desc: descOut,
    extra: mainEntry?.name || '',
    iconFile,
    mainEntryNo: p.main_entry_no,
    isShiny: !!p.is_shiny_mod,
    frame: p.frame,
    genreLib: p.genre_lib,
    genreName: GENRE_NAMES[p.genre_lib] || '其他',
    applyRange: p.apply_range,
    applySlot: applyIdToSlot[p.apply_range] || '',
    shinyBuffId: p.shiny_buff_id,
    shinyDesc,
    stats,
  });
}

// 闪光判断 + slot 校准
const slotOrder = ['武器', '头盔', '面罩', '上身', '手套', '下身', '鞋子'];
for (const it of Object.values(byName)) {
  it.glowing = it.variants.some((v) => v.isShiny);
  const slotText = it.variants[0]?.applySlot || '';
  if (slotText.includes('武器')) it.slot = '武器';
  else if (slotText.includes('面具')) it.slot = '面罩';
  else if (slotText.includes('头盔')) it.slot = '头盔';
  else if (slotText.includes('上身')) it.slot = '上身';
  else if (slotText.includes('手套')) it.slot = '手套';
  else if (slotText.includes('下身')) it.slot = '下身';
  else if (slotText.includes('鞋子')) it.slot = '鞋子';
}

const items = Object.values(byName).sort((a, b) => {
  const sa = slotOrder.indexOf(a.slot);
  const sb = slotOrder.indexOf(b.slot);
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, 'zh');
});

const out = {
  section: '模组图鉴',
  slug: 'mods',
  description: `七日世界全量模组图鉴：${items.length} 个模组、${items.reduce((n, i) => n + i.variants.length, 0)} 个变体，含 4 词条等级数值、闪光标识、流派归属。`,
  seoTitle: '七日世界模组图鉴：全量模组 + 4词条 + 闪光 + 等级数值 - xingchuan',
  seoDescription: `七日世界全量模组图鉴：${items.length} 个模组，基于 BINDICT 拆包数据，含主词条、4 词条等级数值、闪光标识、流派归属。`,
  items,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');

// 复制官方图标（只复制拆包 icon_path 引用的文件）
mkdirSync(OUT_ICONS, { recursive: true });
let copied = 0;
for (const p of Object.values(propsRaw)) {
  if (!p.icon_path || !officialFiles.has(p.icon_path)) continue;
  const src = join(OFFICIAL_ICONS, p.icon_path);
  const dst = join(OUT_ICONS, p.icon_path);
  if (!existsSync(dst)) copyFileSync(src, dst);
  copied++;
}
console.log('复制官方图标:', copied, '张');

console.log('模组数:', items.length, '| 总变体数:', items.reduce((n, i) => n + i.variants.length, 0));
console.log('闪光模组:', items.filter((i) => i.glowing).length);
console.log('有 4 词条的变体:', items.reduce((n, i) => n + i.variants.filter((v) => v.stats.length === 4).length, 0));

// 验证：冰霜碎裂〈通用〉
const ics = items.find((i) => i.name === '冰霜碎裂');
if (ics) {
  const v = ics.variants.find((x) => x.suffix === '通用');
  console.log('\n冰霜碎裂〈通用〉:');
  console.log('  desc:', v.desc.slice(0, 50));
  console.log('  isShiny:', v.isShiny);
  console.log('  stats:');
  v.stats.forEach((s) => console.log('    ', s.name, '|', s.values.map((x) => x !== null ? (x * 100).toFixed(1) + '%' : '-').join(' / ')));
}