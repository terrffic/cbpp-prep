# -*- coding: utf-8 -*-
"""修正 16 题：整体重写选项数组（正确项统一放在索引 0，运行时再按题序轮转），
   并同步英文选项。原 patch_options.py 按「渲染后的选项位置」去改源码数组，
   而源码顺序与渲染顺序不同，导致个别题的正确答案被覆盖——这里改为整组重写，避免错位。
用法：python tools/fix_options.py
"""
import io, json

FILE = "CBPP备考中心.html"

# id -> (中文四选项，正确项在 [0] , 英文四选项，正确项在 [0])
DATA = {
 "x7-6": (
  ["流程所有者对端到端设计与整体绩效负最终责任；流程经理负责日常运行与协调执行",
   "两者完全等同，只是不同企业的习惯叫法不同",
   "所有者负责画图与文档维护，绩效由职能经理承担",
   "流程经理职级通常更高，因此由经理做设计与变更决策"],
  ["The process owner is ultimately accountable for end-to-end design and overall performance, while the process manager runs day-to-day operations and coordinates execution",
   "They are entirely equivalent; the two titles are just local naming habits",
   "The owner draws diagrams and maintains documents while functional managers carry performance",
   "The process manager is usually more senior and therefore decides design and change"]),
 "x7-13": (
  ["把流程 KPI 纳入相关部门与岗位的考核，与激励对齐",
   "新旧指标同时保留，让各部门自行选择适用的一套",
   "考核只保留财务利润指标，流程指标仅作参考不入考核",
   "暂不把流程指标纳入考核，等流程文化成熟后再考虑"],
  ["Build process KPIs into the appraisal of relevant departments and roles and align them with incentives",
   "Keep both old and new metrics and let each department choose which to use",
   "Appraise on financial profit only; process metrics stay informational",
   "Leave process metrics out of appraisal until the process culture matures"]),
 "x7-18": (
  ["对业务最懂、具备端到端视野且能协调资源的关键管理者（不一定是级别最高者）",
   "外部顾问，因其方法论最系统且不受内部关系牵制",
   "由管理层随机指派，以避免部门之间争夺该职位",
   "级别最高但不管具体业务的高管，便于调动资源"],
  ["A key manager who understands the business best, has an end-to-end view and can mobilize resources (not necessarily the most senior person)",
   "An external consultant, since their method is systematic and free of internal ties",
   "Anyone assigned at random by management to avoid departments competing for the role",
   "The most senior executive, even if unfamiliar with the business, to mobilize resources"]),
 "x7-19": (
  ["架构师负责企业级流程架构与标准；分析师负责具体流程的建模、分析与优化",
   "两者互不相关：架构师归 IT，分析师归业务部门",
   "分析师负责召集并主持流程治理委员会的例会",
   "架构师只负责绘制单条流程的详细流程图"],
  ["The architect owns the enterprise process architecture and standards; the analyst models, analyzes and optimizes specific processes",
   "They are unrelated: architects sit in IT, analysts in the business",
   "The analyst convenes and chairs the process governance board",
   "The architect only draws detailed diagrams for a single process"]),
 "x7-26": (
  ["定期调研员工的流程意识、协作行为与工具采纳情况",
   "文化难以量化，因此以定性描述代替度量",
   "统计已发布的流程图数量与建模工具登录次数",
   "以股价与季度营收作为文化建设的替代指标"],
  ["Periodic surveys of process awareness, collaborative behavior and tool adoption",
   "Culture is hard to quantify, so describe it qualitatively instead",
   "Count published diagrams and modelling-tool logins",
   "Use share price and quarterly revenue as proxies"]),
 "x8-9": (
  ["业务架构提供流程、组织、能力蓝图，使流程转型与 IT 架构协同演进",
   "EA 只管服务器与网络设备的选型与运维",
   "EA 属于 IT 规划，与流程设计与治理无关",
   "EA 只输出网络拓扑图与技术标准清单"],
  ["Business architecture provides the process, organization and capability blueprint so process transformation and IT architecture evolve together",
   "EA only covers server and network selection and operations",
   "EA belongs to IT planning and has nothing to do with process design",
   "EA only produces network topology diagrams and technology standards"]),
 "x8-14": (
  ["内部流程维度：关键流程决定客户与财务目标能否达成",
   "只通过财务报表与预算科目相连",
   "两者没有直接连接，各自独立运作",
   "只通过人力资源的岗位说明书相连"],
  ["The internal process perspective: key processes determine whether customer and financial objectives can be achieved",
   "Only through financial statements and budget lines",
   "No direct link; each operates independently",
   "Only through HR job descriptions"]),
 "x8-17": (
  ["EPM 是覆盖全企业流程资产、架构、治理与绩效的系统性管理；单点改进只针对个别项目",
   "EPM 是在全企业范围内绘制更多流程图与文档",
   "两者没有本质区别，只是项目规模与预算不同",
   "EPM 只关注建模标准，不涉及治理与问责"],
  ["EPM systematically manages all enterprise process assets, architecture, governance and performance; isolated improvement targets individual projects",
   "EPM means drawing more diagrams and documents across the enterprise",
   "No essential difference; only project scale and budget differ",
   "EPM covers modelling standards only, not governance and accountability"]),
 "x8-24": (
  ["流程手册（政策/架构）→程序文件（跨职能流程）→作业指导书（岗位操作）→记录/表单",
   "只保留一张汇总流程图，各层级共用同一份",
   "全部内容写进一个受控文件，按章节区分层级",
   "通过邮件逐级发布，不建立正式文件层级"],
  ["Process manual (policy and architecture) → procedures (cross-functional processes) → work instructions (role-level operations) → records and forms",
   "Keep one summary diagram shared by all levels",
   "Put everything in one controlled document with level-based chapters",
   "Distribute by email without a formal document hierarchy"]),
 "x8-27": (
  ["流程风险管理与内控的治理安排",
   "与流程治理无关的行政备案工作",
   "流程图下方的说明性附注，供评审时参考",
   "由项目组按经验随手记录的风险备忘"],
  ["A governance arrangement for process risk management and internal control",
   "Administrative filing unrelated to process governance",
   "An explanatory footnote to the process diagram for reviews",
   "Informal risk notes kept by the project team"]),
 "x9-8": (
  ["RPA 依赖界面层、较脆弱；需 RPA 治理、变更监控与 API 优先原则",
   "改回纯手工操作，等界面稳定后再评估自动化",
   "RPA 不受界面变化影响，只需增加重试次数",
   "删除全部机器人，改由人工加 Excel 处理"],
  ["RPA depends on the UI layer and is fragile; it needs RPA governance, change monitoring and an API-first principle",
   "Return to manual work until the UI stabilises, then reassess",
   "RPA is immune to UI change; just add retries",
   "Delete all robots and handle the work manually in spreadsheets"]),
 "x9-11": (
  ["覆盖建模、执行、集成、监控、优化的端到端全生命周期管理",
   "BPMS 只能编排系统任务，不能分配人工任务",
   "工作流软件功能更强，BPMS 只是它的旧称",
   "两者没有区别，只是厂商的营销用语不同"],
  ["It covers the end-to-end lifecycle of modeling, execution, integration, monitoring and optimization",
   "BPMS orchestrates system tasks only and cannot assign human tasks",
   "Workflow software is more capable; BPMS is just its old name",
   "No difference; only vendor marketing language differs"]),
 "x9-13": (
  ["先明确流程目标与设计，技术选型服务于流程战略；技术与流程互为使能",
   "先采购功能最全的平台，流程问题会被系统自动纠正",
   "技术选型属于 IT 决策，与流程目标没有关系",
   "流程基础越差越应尽早引入智能系统来弥补"],
  ["Clarify process objectives and design first; technology selection serves process strategy, and technology and process enable each other",
   "Buy the fullest-featured platform first; the system will fix process problems",
   "Technology selection is an IT decision unrelated to process objectives",
   "The weaker the process, the sooner intelligent systems should compensate"]),
 "x9-14": (
  ["ERP 内嵌行业最佳实践流程，落地时应与企业流程架构对齐，必要时做配置或定制的权衡",
   "ERP 只是记账系统，与流程设计无关",
   "必须完全重写 ERP 内置流程以贴合本企业现状",
   "流程必须 100% 服从系统默认配置，不做调整"],
  ["ERP embeds industry best-practice processes; implementation should align with the enterprise process architecture, trading off configuration versus customization where necessary",
   "ERP is a bookkeeping system unrelated to process design",
   "The embedded ERP processes must be fully rewritten to fit current practice",
   "Processes must follow system defaults with no adjustment"]),
 "x9-17": (
  ["深入分析返工原因（规则、数据质量、审批设计）并针对性改进，再考虑自动化",
   "先采购更多机器人，加快审批环节的处理速度",
   "清理事件日志，避免返工数据影响后续挖掘",
   "上调返工次数上限，减少超限案例对指标的影响"],
  ["Analyze the causes of rework (rules, data quality, approval design) and fix them before considering automation",
   "Buy more robots first to speed up the approval step",
   "Clean the event log so rework does not distort mining",
   "Raise the rework limit so fewer cases breach the metric"]),
 "x9-22": (
  ["无法准确还原活动顺序与计时，需先修复数据质量",
   "对挖掘结果没有影响，工具会自动补齐时间",
   "挖掘工具会按平均值自动编造缺失的时间戳",
   "数据不完整，只能放弃该流程的全部挖掘"],
  ["Activity order and timing cannot be reconstructed accurately, so data quality must be fixed first",
   "No impact; the tool fills in missing timestamps",
   "The tool fabricates missing timestamps from averages",
   "With incomplete data, all mining of that process must be abandoned"]),
}

def arr_end(s, i):
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
    raise ValueError('unmatched [')

def set_array(s, start, items):
    b = s.find('[', start)
    e = arr_end(s, b)
    return s[:b] + json.dumps(items, ensure_ascii=False) + s[e+1:], b

src = io.open(FILE, encoding='utf-8').read()
ok = 0
for qid, (zh, en) in DATA.items():
    i = src.find('{ id:"%s"' % qid)
    if i < 0:
        print('!! 缺少题目对象', qid); continue
    src, b = set_array(src, i, zh)
    # a 改为 0（正确项已在索引 0；运行时组卷/展示会再按题序轮转）
    ai = src.find(', a:', b)
    ae = src.find(',', ai + 4)
    src = src[:ai] + ', a:0' + src[ae:]
    j = src.find('"%s":{"s":' % qid)
    if j < 0:
        print('!! 缺少英文条目', qid); continue
    src, _ = set_array(src, j, en)
    ok += 1

io.open(FILE, 'w', encoding='utf-8', newline='').write(src)
print('重写完成 %d / %d' % (ok, len(DATA)))
