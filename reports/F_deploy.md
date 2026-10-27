# F · 部署验证（已完成，含线上实测）

## 1. 最终结果

| 项 | 值 |
|---|---|
| 仓库 | `terrffic/cbpp-prep`（public） |
| 分支 | `main`（Pages 源：`main` / 根目录） |
| **内容 Commit SHA** | **`8b914e661dca5b04b2b00a0a1f9a08be57677e94`**（导图改版 + 练习扩容 + 错题分析；此后只提交 `reports/`、`README.md`、`tools/`，**四个 HTML 的哈希恒定**，见 §2） |
| **访问链接** | **https://terrffic.github.io/cbpp-prep/** |
| Pages 构建 | `status=built`，构建 commit = `8b914e66` ✅ |
| 交付时分支 HEAD | 见 GitHub 仓库页 `main` 最新提交（**内容基线 = `8b914e66`**；此后只提交 `reports/`、`README.md`、`tools/`，**四个 HTML 的哈希恒定**，见 §2） |
| 远端文件数 | 29（缺失 0 / 不一致 0 / 多余 0） |
| 线上逐字节校验 | 4/4 入口文件 SHA-256 与入库内容完全一致 |
| 线上冒烟 | `node tools/live_check.js` → **45 passed / 0 failed** |

> **历史链说明（避免误解）**：远端提交由 REST API 生成，与本地 `.git` 不是同一条历史链（本地提交仅作工作副本记录）。
> 两者的**内容完全一致**：远端 29 个文件的 blob SHA 与本地 `git hash-object` 逐一相同，HEAD 树哈希也相同（`99098f5e…`）。
> 因此"线上与源码一致"的判定基准是**文件哈希**，不是 commit SHA。若要统一历史，可在网络允许时重新 `git clone` 一份作为工作副本。

内容落地用 3 个提交（一次推送受代理限制，改用 API 分三步落库；之后的提交只改 `reports/`、`README.md`、`tools/`，不动四个 HTML）：

| # | SHA | 内容 |
|---|---|---|
| 1 | `9bbe3cd` | 全量整改落库：4 HTML + README + `tools/`(9) + `reports/`(9) |
| 2 | `5f18f97` | 4 个文件以 LF 归一化内容重新入库（消掉 CRLF 造成的 blob 不一致） |
| 3 | `0273adc` | `deploy.py` 核验口径对齐 Pages 实际服务内容 |
| 4 | `336d46bf` | 文档补充：F 报告的 HEAD 写法改为不随文档提交失效 |
| 5 | `8b914e66` | **2026-10 学习体验改版**：导图线条细化、关键考核点前置、115 段展开讲解、练习题池扩到 323 题、新增错题分析与靶向练习 |

## 2. 线上文件 SHA-256（对 Pages 实际响应字节计算）

```
818dab8a4854c112b34d4924d3c05742aba7630c9bfb85dbfe2719028657bc66  CBPP备考中心.html   554.7 KB
4d4ddf9451435dbf76323b12693d00175a7910268627cc7ff53577fbb33b5de7  index.html          13.7 KB
e84fc202cb2f3cf00cf8d9f58f319072244ae6e11e7e651a24e22604b783a1c1  CBPP考点思维导图.html   1.5 KB
d5dcace56d56174fe0cf655c225327ff28019d3d9f6ae8a3c00045b0df7cabad  CBPP模拟考试系统.html   1.5 KB
```

> 口径说明：Pages 服务的字节 = git 里存的 blob（LF 归一化后）。本机 `core.autocrlf=true`，
> 工作区 4 个文件是 CRLF，直接对工作区文件算 SHA-256 会得到不同的值（与上表不同）。
> 上表用 `git cat-file blob HEAD:<path>` 的字节计算，与线上一致；
> 比对脚本也按这个口径（`tools/deploy.py` 的 `blob_bytes()`）。

## 3. 线上冒烟实测（`tools/live_check.js`）

把 Pages 返回的**真实字节**下载下来，用 jsdom 启动，而不是验本地源码：

```
== 线上字节启动 ==
  ok  两个模块均已在线上字节中导出（__CBPP_EXAM / __CBPP_LEARN）
  ok  九个知识域（9）              ok  题库题量（323）
  ok  单卷配额合计 140
  ok  知识树节点（116）            ok  知识树可渲染（116 行）
  ok  考试答题卡容器存在           ok  入口切换函数可用
== 线上入口 ==
  ok  目录页 9 个域练习入口 / 5 个套卷入口 / 模考·错题·统计入口
  ok  线上页面无禁止性表述
  ok  思维导图与考试两个兼容入口均已收敛到统一页
== 本轮增量：精讲改版 ==
  ok  关键考核点蓝框（115 / 知识点 115）      ok  展开讲解段落（115 段）
  ok  考点框为卡片首元素，已前置（115/115）   ok  考点框无空条目
  ok  展开讲解均有实质内容（≥20 字）
  ok  思维导图连接线 = 1px                    ok  卡片左侧竖条 = 2px
  ok  九章各一个练习入口（9）
  ok  每章练习池 ≥30 题（31 / 38 / 34 / 36 / 39 / 34 / 30 / 40 / 41）
  ok  练习池合计 323 题
  ok  首页有「错题分析」入口                  ok  错题分析视图可打开
  ok  六个指标块（6）                         ok  指标含错题总数与已掌握
  ok  按域 / 二级领域条形图有数据（5 行）     ok  给出「最需要先补」的结论句
  ok  靶向练习按钮可用                        ok  靶向练习已开考并渲染作答选项
  ok  「只练未掌握」入口存在
RESULT(live): 45 passed, 0 failed
```

## 4. 部署方式（复现）

本机 `git` 经本地代理 `CONNECT github.com:443` 会返回 `502`（代理只放通 `api.github.com` 等域名），
因此部署走 **GitHub REST API 的 Git Data 接口**（blob → tree → commit → 更新 ref），效果与 `push` 等价。

```bash
python tools/deploy.py --repo cbpp-prep --dry-run   # 只看差异，无需凭据
python tools/deploy.py --repo cbpp-prep             # 部署 + 自动核验
python tools/deploy.py --repo cbpp-prep --verify-only
```

`deploy.py` 结束时必须同时满足四条，否则退出码非 0：

1. 分支 `main` 的 SHA = 本次提交；
2. 远端每个文件的 blob SHA = `git hash-object`（缺失 0 / 不一致 0）；
3. Pages 最近构建 `built` 且 commit 与本次一致；
4. 4 个入口 HTML 的线上 SHA-256 = 入库字节 SHA-256。

## 5. 凭据处理

- token 只经 HTTPS 发到 `api.github.com`，只出现在 `Authorization` 请求头；
- 脚本不接受命令行参数传 token（避免进 shell history / 进程列表），只从 `GITHUB_TOKEN`、
  `GITHUB_TOKEN_FILE` 指向的文件、或无回显 `getpass` 读取；
- 脚本所有输出均不含 token；`reports/`、`tools/` 均无任何密钥。

> **仍需你处理**：本轮之前贴出的 classic token 已在对话中明文出现，请到
> https://github.com/settings/tokens 撤销，换 fine-grained token（仅 `terrffic/cbpp-prep`，
> Contents: Read and write；如需读 Pages 构建状态再加 Pages: Read）。

## 6. 本地门禁（与线上一致）

| 项 | 结果 |
|---|---|
| `node tools/audit.js` | P0 = 0，P1 = 2，GATE: PASS |
| `node tools/e2e.js` | 102 passed / 0 failed |
| `node tools/coverage.js` | 19 个二级领域全覆盖，台账 323 行 |
| `node tools/live_check.js` | 45 passed / 0 failed（对线上字节） |
