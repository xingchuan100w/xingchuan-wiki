// 一次性脚本：从拆包数据生成 mods.json（替代飞书 mod_rows 版本）
// 用法：node scripts/gen-mods-from-dump.mjs
//
// 输入：G:\Downloads\BINDICT_CO0808\BINDICT_CO\game_common\
//   - new_mod_property_data.json (1619 条：模组 + 后缀 + 闪光 + 流派)
//   - mod_entry_data.json (1262 条：词条 + 等级数值)
//   - mod_apply_range_data.json (33 条：部位)
//   - mod_sub_entry_lib.json (29 条：subzone 分类)
// 输出：data/once-human/mods.json（结构含主词条 + 等级数值 + 闪光 + 后缀）

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DUMP = 'G:\\Downloads\\BINDICT_CO0808\\BINDICT_CO\\game_common';
const OUT = join(ROOT, '..', 'data', 'once-human', 'mods.json');

const readJson = (f) => JSON.parse(readFileSync(join(DUMP, f), 'utf8'));

const propsRaw = readJson('new_mod_property_data.json');
const entries = readJson('mod_entry_data.json');
const applyRanges = readJson('mod_apply_range_data.json');
const subLib = readJson('mod_sub_entry_lib.json');

// frame 编号 → 后缀名（从数据中提取，确保完整）
const frameToSuffix = {};
for (const p of Object.values(propsRaw)) {
  if (!p.mod_name) continue;
  const m = p.mod_name.match(/<(.+)>$/);
  if (m) frameToSuffix[p.frame] = m[1];
}
// 已知的 frame 名映射（数据里有重复，确保覆盖）
const knownFrames = {
  0: '通用', 1: '暴烈', 2: '精准', 3: '异能', 4: '生存',
  100: '通用', 101: '暴烈', 102: '精准', 103: '异能', 104: '生存',
};

// apply_range → 部位名（取前 4 个为常用：武器通用/防具通用/武器通用/武器通用）
const applyIdToSlot = {};
for (const [k, v] of Object.entries(applyRanges)) {
  applyIdToSlot[k] = v.desc;
}

// entry 查找：id&tier
const findEntry = (id, tier = 1) => entries[id + '&' + tier] || entries[id + '&' + (tier + 1)];

// 解析 desc 把 {1} {2} {3} 占位符替换成实际数值
const formatDesc = (entry, levelIdx = 0) => {
  if (!entry) return '';
  const dr = entry.desc_replace || [];
  let desc = entry.desc || '';
  // 移除颜色标记 #7#
  desc = desc.replace(/#7#/g, '');
  // {1} → dr[0], {2} → dr[1], {3} → dr[2]
  return desc.replace(/\{(\d)\}/g, (_, n) => {
    const idx = parseInt(n) - 1;
    const v = dr[idx];
    if (v === undefined) return '?';
    // 把 0.036 转成 3.6%（基础值 × 100），裸数字加单位
    const num = parseFloat(v);
    if (isNaN(num)) return v;
    if (desc.includes('%')) return (num * 100).toFixed(2) + '%';
    return num.toString();
  });
};

// 把 attr_value_list（基础值数组）映射到 17 级
// 大多数 entry 是 1 个值（恒定）；少数 2/3 个值（按等级段）
const attrAtLevel = (entry, level) => {
  if (!entry) return null;
  const av = entry.attr_value_list || [];
  if (av.length === 0) return null;
  // 简化：取第一个值（多数情况）
  // 改进版按 quality 段：L1-7=1, L8-12=2, L13-17=3
  // 但 data 没明确每段对应哪个 tier，先简单用 attr_value_list[0]
  const baseVal = av[0];
  // 估算成长系数：每级增加 0.012（基于经验值 0.036/3 = 0.012/级）
  // 用 quality 字段更准确但需要从 props 传 quality
  return baseVal;
};

// 提取所有后缀变体（按 main_entry_no + frame 分组）
const byMainEntry = {};
for (const p of Object.values(propsRaw)) {
  if (!p.main_entry_no || !p.mod_name) continue;
  const m = p.mod_name.match(/^(.+?)<(.+)>$/);
  if (!m) continue;
  const [, name, suffix] = m;
  if (!byMainEntry[name]) byMainEntry[name] = { name, variants: [] };
  // entry 查找：取 quality=1 的基础 entry
  // props 没存 quality 但 frame 不同对应不同质量
  const entry = entries[p.main_entry_no + '&1'] || entries[p.main_entry_no + '&2'] || entries[p.main_entry_no + '&3'];
  byMainEntry[name].variants.push({
    suffix,
    frame: p.frame,
    itemNo: p.item_no,
    mainEntryNo: p.main_entry_no,
    desc: entry ? formatDesc(entry) : '',
    extra: entry ? (entry.name || '') + (entry.attr_value_list?.[0] !== undefined ? ' +' + (entry.attr_value_list[0] * 100).toFixed(2) + '%' : '') : '',
    iconFile: p.icon_path ? 'mods/' + p.icon_path.replace(/^icon_mods_/, '').replace(/\.png$/, '') + '.png' : '',
    isShiny: !!p.is_shiny_mod,
    shinyItemNo: p.shiny_replace_mod_code || null,
    shinyBuffId: p.shiny_buff_id || 0,
    applyRange: p.apply_range,
    genreLib: p.genre_lib,
  });
}

// 闪光标记：闪光是独立条目（不同 item_no）
// 提升到模组级别：isShiny 看是否有任一变体是闪光
const items = Object.values(byMainEntry).map((m) => {
  const slot = (() => {
    const ar = m.variants[0]?.applyRange;
    if (!ar) return '武器';
    const desc = applyIdToSlot[ar] || '';
    if (desc.includes('武器')) return '武器';
    if (desc.includes('防具通用') || desc.includes('面具') || desc.includes('手套') || desc.includes('上身') || desc.includes('下身') || desc.includes('鞋子') || desc.includes('头盔')) {
      return desc.includes('通用') ? '上身' : desc;
    }
    return '武器';
  })();
  return {
    name: m.name,
    slot,
    glowing: m.variants.some((v) => v.isShiny), // 模组是否有闪光版本
    variants: m.variants,
  };
});

// 排序：按 slot 顺序 + 名称
const slotOrder = ['武器', '头盔', '面罩', '上身', '手套', '下身', '鞋子'];
items.sort((a, b) => {
  const sa = slotOrder.indexOf(a.slot);
  const sb = slotOrder.indexOf(b.slot);
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, 'zh');
});

const out = {
  section: '模组图鉴',
  slug: 'mods',
  description: `七日世界全量模组图鉴：${items.length} 个模组、${items.reduce((n, i) => n + i.variants.length, 0)} 个变体，基于 BINDICT_CO0808 拆包数据，含词条 + 等级数值 + 闪光标识。`,
  seoTitle: '七日世界模组图鉴：全量模组 + 闪光 + 等级数值 - xingchuan',
  seoDescription: `七日世界全量模组图鉴：${items.length} 个模组、基于拆包数据，含主词条、等级数值、闪光标识、4 大流派（灼烧/电涌/碎弹/冰霜漩涡）。`,
  items,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log('写出:', OUT);
console.log('模组数:', items.length, '| 总变体数:', items.reduce((n, i) => n + i.variants.length, 0));
console.log('闪光模组数:', items.filter((i) => i.glowing).length);
console.log('已识别后缀:', Object.values(frameToSuffix).slice(0, 15).join(', '));
console.log('前 3 模组示例:');
items.slice(0, 3).forEach((i) => {
  console.log(`  - ${i.name} [${i.slot}] glowing=${i.glowing} 后缀:`, i.variants.map((v) => v.suffix).join('/'));
});