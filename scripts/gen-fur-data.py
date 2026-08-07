#!/usr/bin/env python3
"""
gen-fur-data.py
Reconstruct the complete fur-bonuses data by merging base furs (from original codex)
with golden furs (from HTML reference), then write to codex.json.

Usage: python gen-fur-data.py
"""

import json
import re
import os
import subprocess

# ── Paths ──────────────────────────────────────────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODEX_PATH = os.path.join(PROJECT_ROOT, "data", "once-human", "codex.json")
HTML_PATH = r"D:\WorkBuddy\2026-08-06\金色皮毛效果图鉴.html"

# ── Animal icon mapping (from BINDICT client_icons) ────────────────────────
ANIMAL_ICONS = {
    "狼": "assets/fur-icons/wolf.png",
    "熊": "assets/fur-icons/bear.png",
    "兔": "assets/fur-icons/rabbit.png",
    "鳄": "assets/fur-icons/crocodile.png",
    "羊": "assets/fur-icons/sheep.png",
    "牛": "assets/fur-icons/cow.png",
    "鹿": "assets/fur-icons/deer.png",
    "狐": "assets/fur-icons/fox.png",
    "羽绒": "assets/fur-icons/feather.png",
    "海豹": "assets/fur-icons/seal.png",
    "驯鹿": "assets/fur-icons/reindeer.png",
    "兽皮": "assets/fur-icons/beast.png",
    "其他": "assets/fur-icons/beast.png",
}

# ── Hidden animal types ────────────────────────────────────────────────────
HIDDEN_ANIMALS = {"乌贼", "鲨鱼"}

# ── Animal sort order ──────────────────────────────────────────────────────
ANIMAL_ORDER = ["狼", "熊", "兔", "鳄", "羊", "牛", "鹿", "狐", "羽绒", "其他"]

# ── HTML animal mapping ───────────────────────────────────────────────────
HTML_ANIMAL_MAP = {
    "狼类": "狼", "熊类": "熊", "兔类": "兔", "鳄类": "鳄",
    "羊类": "羊", "牛类": "牛", "鹿类": "鹿", "狐类": "狐",
    "羽绒类": "羽绒", "乌贼类": "乌贼", "鲨鱼类": "鲨鱼",
}

# ── Base furs from original codex (extracted from the 900-line file) ──────
# Format: (animal, name, head, mask, jacket, glove, pants, boots)
# Note: original codex column order was: 头, 面罩, 上衣, 手套, 裤子, 鞋子
# New order: 头, 面罩, 上衣, 下身, 手套, 鞋子
BASE_FURS_RAW = [
    # ── 牛皮系 ──
    ("牛", "牛皮", "暴击伤害减免+7%", "耐力≥100时物理伤害+5%", "负重上限+20", "谷物产量+10%", "负重上限+20", "最大耐力+10"),
    ("牛", "群山牛皮", "暴击伤害减免+7%", "耐力≥120时物理伤害+8%", "寒冷/霜冻抗性+15，负重+20", "谷物产量+15%", "寒冷/霜冻抗性+15，负重+20", "最大耐力+15"),
    ("牛", "河谷牛皮", "受暴击后恢复15%生命(30s CD)", "耐力<30时恢复30耐力(30s CD)", "炎热/燃烧抗性+10，潮湿+5，负重+20", "谷物产量+15%", "炎热/燃烧抗性+10，潮湿+5，负重+20", "耐力恢复+20%"),
    # ── 鹿皮系 ──
    ("鹿", "鹿皮", "冲刺免伤+3%", "冲撞伤害+12%", "寒冷/霜冻抗性+5", "伐木/采矿速度+10%", "寒冷/霜冻抗性+5", "冲刺速度+6%"),
    ("鹿", "高原鹿皮", "冲刺免伤+5%", "冲撞伤害+10%(速度>120%翻倍)", "寒冷/霜冻+10，冲刺速度+5%", "伐木/采矿+12%", "寒冷/霜冻+10，冲刺速度+5%", "冲刺速度+8%"),
    ("鹿", "森林鹿皮", "开镜免伤+5%", "冲撞暴击率+20%", "寒冷/霜冻+5，被察觉速度-10%", "伐木/采矿+12%", "寒冷/霜冻+5，被察觉速度-10%", "冲刺速度+12%，冲刺耐力消耗+30%"),
    ("鹿", "苔原鹿皮", "移动免伤+3%", "冲撞伤害+15%", "寒冷/霜冻抗性+15", "伐木/采矿+12%", "寒冷/霜冻抗性+15", "冲刺耐力消耗-50%"),
    # ── 狼皮系 ──
    ("狼", "狼皮", "弱点伤害减免+5%", "弱点伤害+3%", "最大耐力+15", "禽肉/兔肉产量+10%", "最大耐力+15", "移动速度+4%"),
    ("狼", "荒原狼皮", "移动时弱点减免+7%", "耐力>90时弱点伤害+6%", "最大耐力+20，冲刺速度+5%", "禽肉/兔肉+15%", "最大耐力+20，冲刺速度+5%", "移动速度+6%"),
    ("狼", "草原狼皮", "组队>1时弱点减免+8%", "弱点伤害+4.5%", "炎热/燃烧+10，最大耐力+15", "禽肉/兔肉+15%", "炎热/燃烧+10，最大耐力+15", "移动速度+8%(耐力>80)"),
    ("狼", "丛林狼皮", "蹲伏时弱点减免+10%", "耐力<60时枪械伤害+6%", "寒冷/霜冻+10，最大耐力+15", "禽肉/兔肉+15%", "寒冷/霜冻+10，最大耐力+15", "蹲伏移动速度+30%"),
    # ── 兔皮系 ──
    ("兔", "兔皮", "空中免伤+5%", "元素伤害+4%", "寒冷/霜冻抗性+5", "药草种子产量+10%", "寒冷/霜冻抗性+5", "跳跃高度+8%"),
    ("兔", "梦境兔皮", "翻滚免伤+8%", "元素伤害+6%", "寒冷/霜冻+10，炎热/燃烧+5", "药草种子+15%", "寒冷/霜冻+10，炎热/燃烧+5", "跳跃高度+10%"),
    ("兔", "幸运兔皮", "翻滚异常减免+10%", "暴击后元素伤害+10%(3s)", "寒冷/霜冻+10，非战斗免伤+5%", "药草种子+15%", "寒冷/霜冻+10，非战斗免伤+5%", "跳跃高度+15%(二段跳)"),
    # ── 羊毛系 ──
    ("羊", "羊毛", "非弱点伤害减免+5%", "异常伤害+4%", "寒冷/霜冻+10，潮湿时间+100%", "药草产量+10%", "寒冷/霜冻+10，潮湿时间+100%", "攀爬速度+10%"),
    ("羊", "岩壁羊毛", "移动时非弱点减免+7%", "移动时异常伤害+6%", "寒冷/霜冻+10，每队友+3", "药草+15%", "寒冷/霜冻+10，每队友+3", "攀爬速度+15%"),
    ("羊", "高山羊毛", "耐力>90时非弱点减免+8%", "耐力>90时异常伤害+6%", "寒冷/霜冻+15，潮湿+100%", "药草+15%", "寒冷/霜冻+15，潮湿+100%", "攀爬/翻越速度+10%"),
    ("羊", "金羊毛", "免伤率每秒波动1~10%", "枪械+异常伤害总计+12%波动", "寒冷/霜冻+20，炎热/燃烧-5", "金矿+20%小概率出金锭", "寒冷/霜冻+20，炎热/燃烧-5", "翻滚速度波动1~15%"),
    # ── 熊皮系 ──
    ("熊", "熊皮", "饱食100时免伤+3%", "冰霜伤害+5%", "寒冷/霜冻+10，<10℃击杀回3%血", "鹿/牛/羊肉+10%", "寒冷/霜冻+10，<10℃击杀回3%血", "<10℃移动速度+8%"),
    ("熊", "浮冰熊皮", "饱食60时免伤+4%", "饱食100时冰霜伤害+8%", "寒冷/霜冻+15，<10℃击杀回5%血", "鹿/牛/羊肉+15%", "寒冷/霜冻+15，<10℃击杀回5%血", "<-10℃移动速度+15%"),
    ("熊", "雪原熊皮", "饱食60时最大生命+800", "饱食<60时电离伤害+8%", "寒冷/霜冻+15，<10℃翻滚速度+10%", "鹿/牛/羊肉+15%", "寒冷/霜冻+15，<10℃翻滚速度+10%", "<10℃移动速度+12%"),
    ("熊", "深穴熊皮", "受伤消耗10饱食回10%血(30s CD)", "蹲伏时元素伤害+7%", "寒冷/霜冻+10，寒冷时饱食消耗-25%", "鹿/牛/羊肉+15%", "寒冷/霜冻+10，寒冷时饱食消耗-25%", "聚落内移动速度+20%"),
    # ── 鳄鱼皮系 ──
    ("鳄", "鳄鱼皮", "饮用100时免伤+3%", "近战伤害+10%", "炎热/燃烧+10，濡湿+50%", "伐木/采矿最后一击+20%", "炎热/燃烧+10，濡湿+50%", "翻滚速度+8%"),
    ("鳄", "沙漠鳄皮", "战斗时饮用消耗+30%，免伤+4%", "近战暴击率+7%", "炎热/燃烧+15，濡湿+50%，濡湿免伤+5%", "伐木/采矿最后一击+25%", "炎热/燃烧+15，濡湿+50%，濡湿免伤+5%", "翻滚速度+20%(耐力>80)"),
    ("鳄", "海湾鳄皮", "隐身免伤+10%", "隐身暴击伤害+10%", "炎热/燃烧+15，异常减免+5%", "伐木/采矿最后一击+25%", "炎热/燃烧+15，异常减免+5%", "翻滚速度+12%"),
    # ── 狐皮系 ──
    ("狐", "狐皮", "非战斗免伤+10%", "非战斗暴击伤害+6%", "被察觉速度-10%", "蛋产量+10%", "被察觉速度-10%", "蹲伏移动速度+16%"),
    ("狐", "极地狐皮", "非战斗免伤+14%", "非战斗暴击率+5%", "被察觉速度-10%，非战斗免伤+5%", "蛋+15%", "被察觉速度-10%，非战斗免伤+5%", "<10℃蹲伏速度+50%"),
    ("狐", "沙漠狐皮", "每秒回0.5%血，非战斗饮用消耗+50%", "非战斗暴击伤害+10%", "被察觉速度-15%", "蛋+15%", "被察觉速度-15%", "蹲伏速度+30%"),
    # ── 其他皮类 ──
    ("其他", "兽皮", "最大生命+100", "近战伤害+8%", "寒冷/霜冻抗性+5", "羽毛产量+10%", "寒冷/霜冻抗性+5", "匍匐移动速度+30%"),
    ("羽绒", "羽绒", "污染抗性+15", "潴湿时异常伤害+10%", "寒冷/霜冻+15，濡湿+150%", "浆果产量+10%", "寒冷/霜冻+15，濡湿+150%", "滑翔降落速度-10%"),
    ("其他", "海豹皮", "游泳免伤+15%", "潴湿时枪械伤害+8%", "寒冷/霜冻+10，潴湿+5", "钓鱼时耐力+25", "寒冷/霜冻+10，潴湿+5", "游泳速度+15%"),
    ("其他", "驯鹿皮", "负重>80时免伤+3%", "负重>80时近战伤害+12%", "寒冷/霜冻+5，负重+10", "菌类产量+10%", "寒冷/霜冻+5，负重+10", "负重+10"),
    # ── 剧本专属皮类 ──
    ("鹿", "月兆鹿皮", "冲刺免伤+4%(翻倍)", "冲撞+13%(翻倍)", "寒冷/霜冻+10，击杀回5%护盾", "月之低语+20%(翻倍)", "寒冷/霜冻+10，击杀回5%护盾", "冲刺速度+7%(翻倍)"),
    ("狼", "月兆狼皮", "弱点减免+6%(翻倍)", "弱点+4%(额外+8%)", "最大耐力+15，腰射/开镜速度+5%", "月之低语+20%(翻倍)", "最大耐力+15，腰射/开镜速度+5%", "移动速度+5%(翻倍)"),
    ("兔", "月兆兔皮", "空中免伤+7%(翻倍)", "元素+5%(翻倍)", "寒冷/霜冻/炎热/燃烧+5", "月之低语+20%(翻倍)", "寒冷/霜冻/炎热/燃烧+5", "跳跃+8%(翻倍)"),
    ("羊", "月兆羊皮", "每降10%血免伤+1.8%(上限10.5%)", "每降10%血异常+1%(上限7%)", "寒冷/霜冻+15，免疫失温症", "月之低语+20%(翻倍)", "寒冷/霜冻+15，免疫失温症", "翻滚速度+8%(翻倍)"),
    ("狐", "星临狐皮", "非战斗免伤+10%(空中+5%)", "非战斗暴击率+5%(空中翻倍)", "被察觉-10%，击杀回5耐力(空中)", "重力水晶+10%(空中翻倍)", "被察觉-10%，击杀回5耐力(空中)", "蹲伏速度+16%(非战斗翻倍)"),
    ("鳄", "星临鳄皮", "饮用100免伤+3%(空中翻倍)", "近战+7%(空中翻倍)", "炎热/燃烧+15(空中10s再+5)", "重力水晶+10%(空中翻倍)", "炎热/燃烧+15(空中10s再+5)", "翻滚速度+10%"),
    ("牛", "星临牛皮", "暴击减免+8%(空中+4%)", "耐力≥100枪械+5%(空中翻倍)", "负重+20，空中耐力恢复+5%", "重力水晶+10%(空中翻倍)", "负重+20，空中耐力恢复+5%", "最大耐力+10，空中耐力消耗-5%"),
    ("羽绒", "星临羽绒", "污染抗性+15(空中+5%)", "空中异常伤害+10%", "寒冷/霜冻+15(空中10s再+5)", "重力水晶+10%(空中翻倍)", "寒冷/霜冻+15(空中10s再+5)", "滑翔降落-5%，水平+5%"),
    ("鹿", "梦域鹿皮", "冲刺免伤+3%(翻倍)", "冲撞+12%(翻倍)", "寒冷/霜冻+5(翻倍)", "10%概率清醒之沙翻倍", "寒冷/霜冻+5(翻倍)", "冲刺速度+6%(翻倍)"),
    ("狼", "梦域狼皮", "弱点减免+5%(翻倍)", "弱点+3%(翻倍)", "最大耐力+15(翻倍)", "4%概率清醒之沙翻4倍", "最大耐力+15(翻倍)", "移动速度+4%(翻倍)"),
    ("兔", "梦域兔皮", "空中免伤+5%(翻倍)", "元素+4%(翻倍)", "寒冷/霜冻+5(翻倍)", "10%概率开箱清醒之沙翻倍", "寒冷/霜冻+5(翻倍)", "跳跃+8%(翻倍)"),
    ("牛", "梦域牛皮", "暴击减免+7%(翻倍)", "耐力≥100枪械+5%(翻倍)", "负重+20(翻倍)", "4%概率开箱清醒之沙翻4倍", "负重+20(翻倍)", "耐力+10(翻倍)"),
    ("羊", "梦域羊毛", "非弱点减免+5%(翻倍)", "异常+4%(翻倍)", "寒冷/霜冻+10(翻倍)", "5%概率伐木/采矿/开箱清醒之沙翻倍", "寒冷/霜冻+10(翻倍)", "攀爬+10%(翻倍)"),
]


# ── Parse HTML reference ───────────────────────────────────────────────────
def parse_html_reference(html_path):
    """Extract all golden furs from the HTML reference file."""
    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    furs = []
    sections = re.split(r'<div class="at-title">', html)[1:]

    for section in sections:
        # Get animal type from title
        title_match = re.match(r"(.*?)</div>", section)
        if not title_match:
            continue
        title = title_match.group(1).strip()
        animal_match = re.match(r"(\S+?)类", title)
        if not animal_match:
            continue
        animal_key = animal_match.group(1) + "类"
        animal = HTML_ANIMAL_MAP.get(animal_key, animal_key)

        # Find all cards in this section
        card_blocks = section.split('<div class="card">')[1:]
        for card in card_blocks:
            nm_match = re.search(r'<div class="nm">(.*?)</div>', card)
            if not nm_match:
                continue
            raw_name = nm_match.group(1)
            cleaned = re.sub(r'<span class="badge[^"]*">[^<]*</span>', '', raw_name)
            name = re.sub(r'<[^>]+>', '', cleaned).strip()

            effects = {}
            table_match = re.search(
                r'<table class="eff">(.*?)</table>', card, re.DOTALL
            )
            if table_match:
                rows = re.findall(
                    r'<td class="part">(.*?)</td><td>(.*?)</td>',
                    table_match.group(1),
                )
                for part, effect in rows:
                    part = part.strip()
                    effect = effect.strip()
                    if part == "口罩":
                        part = "面罩"
                    effects[part] = effect

            furs.append({
                "name": name,
                "animal": animal,
                "hidden": animal in HIDDEN_ANIMALS,
                "quality": 4,  # golden furs from HTML reference
                "effects": effects,
            })

    return furs


# ── Build base furs list ──────────────────────────────────────────────────
def build_base_furs():
    """Convert raw base fur data into the new card structure."""
    furs = []
    for animal, name, head, mask, jacket, glove, pants, boots in BASE_FURS_RAW:
        furs.append({
            "name": name,
            "animal": animal,
            "hidden": animal in HIDDEN_ANIMALS,
            "quality": 1,
            "effects": {
                "头": head,
                "面罩": mask,
                "上衣": jacket,
                "下身": pants,
                "手套": glove,
                "鞋子": boots,
            },
        })
    return furs


# ── Merge furs ─────────────────────────────────────────────────────────────
def merge_furs(base_furs, html_furs):
    """Merge base furs with HTML golden furs.
    For furs in both: use HTML effects (more accurate/complete).
    For furs only in base: keep base effects.
    For furs only in HTML: add them.
    """
    merged = {}
    for fur in base_furs:
        merged[fur["name"]] = fur.copy()

    for fur in html_furs:
        if fur["name"] in merged:
            # HTML has more accurate effects for golden furs
            merged[fur["name"]]["effects"] = fur["effects"]
            merged[fur["name"]]["hidden"] = fur["hidden"]
            merged[fur["name"]]["quality"] = fur.get("quality", 4)
            if fur.get("scenario"):
                merged[fur["name"]]["scenario"] = fur["scenario"]
        else:
            merged[fur["name"]] = fur.copy()

    return list(merged.values())


# ── Animal sort key ────────────────────────────────────────────────────────
def animal_sort_key(fur):
    animal = fur.get("animal", "其他")
    try:
        return ANIMAL_ORDER.index(animal)
    except ValueError:
        return len(ANIMAL_ORDER)


# ── Build new fur-bonuses item ─────────────────────────────────────────────
def build_fur_bonuses_item(furs):
    """Build the new fur-bonuses item with card-based data structure."""
    # Only golden quality: quality >= 4 OR has scenario (月兆/星临/梦域)
    golden_furs = [f for f in furs if f.get("quality", 0) >= 4 or f.get("scenario")]
    if not golden_furs:
        golden_furs = furs  # fallback: show all if no quality info
    furs_sorted = sorted(golden_furs, key=lambda f: (animal_sort_key(f), f["name"]))

    animal_counts = {}
    for fur in furs_sorted:
        a = fur["animal"]
        animal_counts[a] = animal_counts.get(a, 0) + 1

    animal_parts = []
    for a in ANIMAL_ORDER:
        if a in animal_counts:
            animal_parts.append(f"{a}×{animal_counts[a]}")
    summary = f"共{len(furs_sorted)}种皮类×6部位增益效果，按动物类型分组（{'、'.join(animal_parts)}）。"

    # Group furs by animal for sections
    animal_groups = {}
    for f in furs_sorted:
        a = f["animal"]
        if a not in animal_groups:
            animal_groups[a] = []
        animal_groups[a].append(f)

    sections = []
    for animal in ANIMAL_ORDER:
        if animal not in animal_groups:
            continue
        cards = []
        for f in animal_groups[animal]:
            icon = ANIMAL_ICONS.get(f["animal"], "")
            cards.append({
                "name": f["name"],
                "animal": f["animal"],
                "hidden": f["hidden"],
                "icon": icon,
                "scenario": f.get("scenario", ""),
                "effects": f["effects"],
            })
        # Build table rows for this animal group
        rows = []
        for f in animal_groups[animal]:
            e = f["effects"]
            badge = f.get("scenario", "")
            rows.append([
                f["name"] + (f" [{badge}]" if badge else ""),
                e.get("头", "—"),
                e.get("面罩", "—"),
                e.get("上衣", "—"),
                e.get("手套", "—"),
                e.get("下身", "—"),
                e.get("鞋子", "—"),
            ])
        sections.append({
            "heading": f"{animal}类",
            "blocks": [
                {
                    "type": "table",
                    "cols": ["皮类", "头部", "面罩", "上衣", "手套", "下身", "鞋子"],
                    "rows": rows,
                }
            ]
        })

    return {
        "slug": "fur-bonuses",
        "title": "皮毛增益图鉴",
        "seoTitle": "七日世界皮毛增益图鉴：全皮类×6部位增益一览 - xingchuan",
        "seoDescription": "七日世界皮毛增益图鉴：狼皮/熊皮/兔皮/鳄鱼皮/羊毛/牛皮/鹿皮/狐皮/羽绒等全部皮类在6个装备部位的增益效果完整一览。",
        "summary": summary,
        "updatedAt": "2026-08-08",
        "status": "完整",
        "sections": sections,
    }


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    print("Building base furs from embedded data...")
    base_furs = build_base_furs()
    print(f"  {len(base_furs)} base furs loaded")

    print(f"Reading HTML reference: {HTML_PATH}")
    html_furs = parse_html_reference(HTML_PATH)
    print(f"  {len(html_furs)} golden furs found in HTML")

    print("Merging furs...")
    all_furs = merge_furs(base_furs, html_furs)
    print(f"  {len(all_furs)} unique furs after merge")

    hidden_count = sum(1 for f in all_furs if f["hidden"])
    print(f"  Hidden furs: {hidden_count}")

    new_item = build_fur_bonuses_item(all_furs)

    # Read existing codex.json
    print(f"Reading codex: {CODEX_PATH}")
    with open(CODEX_PATH, "r", encoding="utf-8") as f:
        codex = json.load(f)

    # Check if fur-bonuses already exists
    found = False
    for i, item in enumerate(codex.get("items", [])):
        if item.get("slug") == "fur-bonuses":
            codex["items"][i] = new_item
            found = True
            print("  Replaced existing fur-bonuses item")
            break

    if not found:
        codex["items"].insert(0, new_item)
        print("  Added new fur-bonuses item")

    print(f"Writing codex: {CODEX_PATH}")
    with open(CODEX_PATH, "w", encoding="utf-8") as f:
        json.dump(codex, f, ensure_ascii=False, indent=2)

    print("Done!\n")

    # Print summary
    print("── Summary ──")
    for animal in ANIMAL_ORDER:
        animal_furs = [f for f in all_furs if f["animal"] == animal]
        if animal_furs:
            hidden_mark = " [HIDDEN]" if animal in HIDDEN_ANIMALS else ""
            print(f"  {animal}类 ({len(animal_furs)}种){hidden_mark}:")
            for fur in animal_furs:
                print(f"    - {fur['name']}")


if __name__ == "__main__":
    main()
