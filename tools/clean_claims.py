# -*- coding: utf-8 -*-
"""清理讲义/文案中无权威依据的断言式表述（必考 / 送分题 / 高频 / 失败率 70% / 完全一致 等）。
用法：python tools/clean_claims.py
可重复执行（幂等）。
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE = os.path.join(ROOT, "CBPP备考中心.html")

# (旧串, 新串) —— 精确匹配，逐条记录命中次数
RULES = [
    # 1) 首页卷组标题与英文说明（原含 "Identical to the real exam" / "pass mark 70%"）
    ("五套全真模拟卷（严格对照官方考试）", "五套全真模拟卷（按官方蓝图组卷）"),
    ("Identical to the real exam: 140 single-choice questions · 180 minutes · pass mark 70% (98 correct) · all English.",
     "Format aligned with the official handbook: 140 single-choice questions · 180 minutes · English stem and options. "
     "70% (98 correct) is this system’s training target, not an ABPMP-published pass mark — the handbook only states "
     "that the passing score is set by psychometric methods and that the cut score is not published as a fixed percentage."),
    ("140 items · 180 min · blueprint-based · random order · 70% to pass",
     "140 items · 180 min · blueprint-based · random order · 70% training target"),
    ("Accuracy ${pct}% — official pass line is 70%",
     "Accuracy ${pct}% — 70% is our training target, not an official pass mark"),

    # 2) 「必考」→「重点」（学习重点，不宣称考试频次）
    ("★ 必考", "★ 重点"),
    ("必考", "重点"),

    # 3) 「送分题」
    ("官方仅 9 题但均为送分题，目标是全对。", "官方蓝图给 9 题，属基础概念，目标是把定义与边界答准。"),
    ("都是记忆型送分题，务必全对。", "多为概念记忆型，需答准职责边界。"),

    # 4) 「高频」→ 中性表述
    ("★ 高频对比：", "★ 对比要点："),
    ("★ 本节高频：", "★ 本节要点："),
    ("三大高频题源", "三类主要考点"),
    ("是高频错误选项", "是常见错误选项"),
    ("本章双高频", "本章两大重点"),
    ("三大高频角色", "三大核心角色"),
    ("（高频题型）", "（常见题型）"),

    # 5) 「必背」→ 学习要求（不暗示考题命中）
    ("七阶段闭环（必背）", "七阶段闭环（需掌握）"),
    ("七大浪费（必背）", "七大浪费（需掌握）"),
    ("改进连续体（由浅到深，必背排序）", "改进连续体（由浅到深，按程度排序）"),
    ("成熟度五级（必背）", "成熟度五级（需掌握）"),
    ("精讲（特征匹配必背）", "精讲（特征匹配要点）"),
    ("三角色的分工（必背）", "三角色的分工（要点）"),
    ("精讲（必背分工）", "精讲（分工要点）"),
    ("APQC PCF（必背层级）", "APQC PCF（层级要点）"),
    ("流程挖掘（必背三类型）", "流程挖掘（三种类型）"),
    ("精讲（必背）", "精讲（要点）"),

    # 6) 无来源统计数字：BPR 失败率 70%
    ("★失败率约 70%，主因忽视人的因素/变革管理", "★失败多被归因于忽视人的因素与变革管理"),
    ("失败率约 70%，主因是忽视人的因素与变革管理。", "实践中失败常被归因于忽视人的因素与变革管理缺位。"),
    ("失败率约 70%：忽视人的因素、变革管理缺位、把'自动化'误当'再造'。",
     "常见失败原因：忽视人的因素、变革管理缺位、把'自动化'误当'再造'。"),

    # 7) 绝对化顺序断言
    ("<b>顺序不可颠倒</b>，自动化放最后。", "<b>实践顺序</b>：先清除、再简化与整合，最后才考虑自动化。"),
    ("<b>标准化 → 集成 → 自动化 → 智能化</b>，顺序不可颠倒。",
     "通常按 <b>标准化 → 集成 → 自动化 → 智能化</b> 推进；跳步（如未标准化就自动化）往往导致返工。"),
]

def main():
    src = io.open(FILE, encoding="utf-8").read()
    before = src
    total = 0
    for old, new in RULES:
        n = src.count(old)
        if n:
            src = src.replace(old, new)
            total += n
            print("  %-3d × %s" % (n, old[:58]))
    if src != before:
        io.open(FILE, "w", encoding="utf-8", newline="").write(src)
    print("共替换 %d 处；文件%s" % (total, "已更新" if src != before else "无变化"))
    return 0

if __name__ == "__main__":
    sys.exit(main())
