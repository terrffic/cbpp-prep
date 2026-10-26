# -*- coding: utf-8 -*-
"""按题号替换指定选项（中英同步，答案索引不变）。
用法：python tools/patch_options.py
数据表：DATA = { id: { index: (zh, en) } }
"""
import io, json, re

FILE = "CBPP备考中心.html"

DATA = {
 "x7-6": {
  0: ("两者完全等同，只是不同企业的习惯叫法不同", "They are entirely equivalent; the two titles are just local naming habits"),
  1: ("所有者负责画图与文档维护，绩效由职能经理承担", "The owner draws diagrams and maintains documents while functional managers carry performance"),
  2: ("流程经理职级通常更高，因此由经理做设计与变更决策", "The process manager is usually more senior and therefore decides design and change"),
 },
 "x7-13": {
  0: ("新旧指标同时保留，让各部门自行选择适用的一套", "Keep both old and new metrics and let each department choose which to use"),
  1: ("考核只保留财务利润指标，流程指标仅作参考不入考核", "Appraise on financial profit only; process metrics stay informational"),
  3: ("暂不把流程指标纳入考核，等流程文化成熟后再考虑", "Leave process metrics out of appraisal until the process culture matures"),
 },
 "x7-18": {
  0: ("外部顾问，因其方法论最系统且不受内部关系牵制", "An external consultant, since their method is systematic and free of internal ties"),
  1: ("由管理层随机指派，以避免部门之间争夺该职位", "Anyone assigned at random by management to avoid departments competing for the role"),
  2: ("级别最高但不管具体业务的高管，便于调动资源", "The most senior executive, even if unfamiliar with the business, to mobilize resources"),
 },
 "x7-19": {
  1: ("两者互不相关：架构师归 IT，分析师归业务部门", "They are unrelated: architects sit in IT, analysts in the business"),
  2: ("分析师负责召集并主持流程治理委员会的例会", "The analyst convenes and chairs the process governance board"),
  3: ("架构师只负责绘制单条流程的详细流程图", "The architect only draws detailed diagrams for a single process"),
 },
 "x7-26": {
  0: ("文化难以量化，因此以定性描述代替度量", "Culture is hard to quantify, so describe it qualitatively instead"),
  1: ("统计已发布的流程图数量与建模工具登录次数", "Count published diagrams and modelling-tool logins"),
  2: ("以股价与季度营收作为文化建设的替代指标", "Use share price and quarterly revenue as proxies"),
 },
 "x8-9": {
  0: ("EA 只管服务器与网络设备的选型与运维", "EA only covers server and network selection and operations"),
  2: ("EA 属于 IT 规划，与流程设计与治理无关", "EA belongs to IT planning and has nothing to do with process design"),
  3: ("EA 只输出网络拓扑图与技术标准清单", "EA only produces network topology diagrams and technology standards"),
 },
 "x8-14": {
  0: ("只通过财务报表与预算科目相连", "Only through financial statements and budget lines"),
  1: ("两者没有直接连接，各自独立运作", "No direct link; each operates independently"),
  3: ("只通过人力资源的岗位说明书相连", "Only through HR job descriptions"),
 },
 "x8-17": {
  0: ("EPM 是在全企业范围内绘制更多流程图与文档", "EPM means drawing more diagrams and documents across the enterprise"),
  2: ("两者没有本质区别，只是项目规模与预算不同", "No essential difference; only project scale and budget differ"),
  3: ("EPM 只关注建模标准，不涉及治理与问责", "EPM covers modelling standards only, not governance and accountability"),
 },
 "x8-24": {
  1: ("只保留一张汇总流程图，各层级共用同一份", "Keep one summary diagram shared by all levels"),
  2: ("全部内容写进一个受控文件，按章节区分层级", "Put everything in one controlled document with level-based chapters"),
  3: ("通过邮件逐级发布，不建立正式文件层级", "Distribute by email without a formal document hierarchy"),
 },
 "x8-27": {
  0: ("与流程治理无关的行政备案工作", "Administrative filing unrelated to process governance"),
  1: ("流程图下方的说明性附注，供评审时参考", "An explanatory footnote to the process diagram for reviews"),
  2: ("由项目组按经验随手记录的风险备忘", "Informal risk notes kept by the project team"),
 },
 "x9-8": {
  0: ("改回纯手工操作，等界面稳定后再评估自动化", "Return to manual work until the UI stabilises, then reassess"),
  1: ("RPA 不受界面变化影响，只需增加重试次数", "RPA is immune to UI change; just add retries"),
  2: ("删除全部机器人，改由人工加 Excel 处理", "Delete all robots and handle the work manually in spreadsheets"),
 },
 "x9-11": {
  0: ("BPMS 只能编排系统任务，不能分配人工任务", "BPMS orchestrates system tasks only and cannot assign human tasks"),
  1: ("工作流软件功能更强，BPMS 只是它的旧称", "Workflow software is more capable; BPMS is just its old name"),
  3: ("两者没有区别，只是厂商的营销用语不同", "No difference; only vendor marketing language differs"),
 },
 "x9-13": {
  1: ("先采购功能最全的平台，流程问题会被系统自动纠正", "Buy the fullest-featured platform first; the system will fix process problems"),
  2: ("技术选型属于 IT 决策，与流程目标没有关系", "Technology selection is an IT decision unrelated to process objectives"),
  3: ("流程基础越差越应尽早引入智能系统来弥补", "The weaker the process, the sooner intelligent systems should compensate"),
 },
 "x9-14": {
  0: ("ERP 只是记账系统，与流程设计无关", "ERP is a bookkeeping system unrelated to process design"),
  2: ("必须完全重写 ERP 内置流程以贴合本企业现状", "The embedded ERP processes must be fully rewritten to fit current practice"),
  3: ("流程必须 100% 服从系统默认配置，不做调整", "Processes must follow system defaults with no adjustment"),
 },
 "x9-17": {
  1: ("先采购更多机器人，加快审批环节的处理速度", "Buy more robots first to speed up the approval step"),
  2: ("清理事件日志，避免返工数据影响后续挖掘", "Clean the event log so rework does not distort mining"),
  3: ("上调返工次数上限，减少超限案例对指标的影响", "Raise the rework limit so fewer cases breach the metric"),
 },
 "x9-22": {
  0: ("对挖掘结果没有影响，工具会自动补齐时间", "No impact; the tool fills in missing timestamps"),
  2: ("挖掘工具会按平均值自动编造缺失的时间戳", "The tool fabricates missing timestamps from averages"),
  3: ("数据不完整，只能放弃该流程的全部挖掘", "With incomplete data, all mining of that process must be abandoned"),
 },
}

def find_array_end(s, i):
    """s[i] 指向 '['，返回匹配 ']' 的下标（考虑双引号字符串）"""
    depth = 0; j = i; inq = False
    while j < len(s):
        c = s[j]
        if inq:
            if c == '\\': j += 1
            elif c == '"': inq = False
        else:
            if c == '"': inq = True
            elif c == '[': depth += 1
            elif c == ']':
                depth -= 1
                if depth == 0: return j
        j += 1
    raise ValueError("unmatched [")

def patch_array(s, start_idx, changes):
    """在 start_idx 之后找第一个 'o:[' 或 '"o":[' 数组，按 changes 替换元素（不改动答案索引）"""
    pos = -1
    for key in ('"o":', 'o:'):
        k = s.find(key, start_idx)
        if k >= 0 and (pos < 0 or k < pos):
            pos = k
            b = s.find('[', k)
    if pos < 0 or b < 0:
        return s, False
    e = find_array_end(s, b)
    arr = json.loads(s[b:e+1])
    for k, v in changes.items():
        arr[k] = v
    new = json.dumps(arr, ensure_ascii=False).replace('","', '","')
    return s[:b] + new + s[e+1:], True

src = io.open(FILE, encoding="utf-8").read()
changed = 0
for qid, changes in DATA.items():
    zh = {k: v[0] for k, v in changes.items()}
    en = {k: v[1] for k, v in changes.items()}
    # 1) 题库对象：{ id:"x7-6", ... }
    i = src.find('{ id:"%s"' % qid)
    if i < 0:
        print("  !! 未找到题目对象", qid); continue
    src, ok1 = patch_array(src, i, zh)
    # 2) ENQ 字典："x7-6":{"s": ...}
    j = src.find('"%s":{"s":' % qid)
    ok2 = False
    if j >= 0:
        src, ok2 = patch_array(src, j, en)
    if ok1 and ok2: changed += 1
    else: print("  !! 部分替换失败", qid, ok1, ok2)

io.open(FILE, "w", encoding="utf-8", newline="").write(src)
print("已替换 %d / %d 题" % (changed, len(DATA)))
