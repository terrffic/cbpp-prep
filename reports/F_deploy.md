# F · 部署验证（已完成，含线上实测）

## 1. 最终结果

| 项 | 值 |
|---|---|
| 仓库 | `terrffic/cbpp-prep`（public） |
| 分支 | `main`（Pages 源：`main` / 根目录） |
| **最终 Commit SHA** | **`0273adc8af782acf93f0ab1746152e5d2e271be3`** |
| **访问链接** | **https://terrffic.github.io/cbpp-prep/** |
| Pages 构建 | `status=built`，构建 commit = `0273adc` ✅ |
| 远端文件数 | 28（缺失 0 / 不一致 0 / 多余 0） |
| 线上逐字节校验 | 4/4 入口文件 SHA-256 与入库内容完全一致 |
| 线上冒烟 | `node tools/live_check.js` → **26 passed / 0 failed** |

本次有 3 个提交（一次推送受代理限制，改用 API 分三步落库）：

| # | SHA | 内容 |
|---|---|---|
| 1 | `9bbe3cd` | 全量整改落库：4 HTML + README + `tools/`(9) + `reports/`(9) |
| 2 | `5f18f97` | 4 个文件以 LF 归一化内容重新入库（消掉 CRLF 造成的 blob 不一致） |
| 3 | `0273adc` | `deploy.py` 核验口径对齐 Pages 实际服务内容 |

## 2. 线上文件 SHA-256（对 Pages 实际响应字节计算）

```
a9875e8a36f51abeb15a2acb0804a8d8095adf186b50b0ec2501fa2c8e1882d1  CBPP备考中心.html   476.5 KB
4eb5527c02cabdc311bd4c9a70c59a51ff6cba3e15ccfbdf27f2e2318cc8fb56  index.html          13.4 KB
e84fc202cb2f3cf00cf8d9f58f319072244ae6e11e7e651a24e22604b783a1c1  CBPP考点思维导图.html   1.5 KB
d5dcace56d56174fe0cf655c225327ff28019d3d9f6ae8a3c00045b0df7cabad  CBPP模拟考试系统.html   1.5 KB
```

> 口径说明：Pages 服务的字节 = git 里存的 blob（LF 归一化后）。本机 `core.autocrlf=true`，
> 工作区 4 个文件是 CRLF，直接对工作区文件算 SHA-256 会得到不同的值（如 `index.html`
> 工作区是 `c09b9ba5…`）。上表用 `git cat-file blob HEAD:<path>` 的字节计算，与线上一致；
> 比对脚本也按这个口径（`tools/deploy.py` 的 `blob_bytes()`）。

## 3. 线上冒烟实测（`tools/live_check.js`）

把 Pages 返回的**真实字节**下载下来，用 jsdom 启动，而不是验本地源码：

```
== 线上字节启动 ==
  ok  两个模块均已在线上字节中导出（__CBPP_EXAM / __CBPP_LEARN）
  ok  九个知识域（9）
  ok  题库题量（323）
  ok  单卷配额合计 140
  ok  知识树节点（116）         ok  知识树可渲染（116 行）
  ok  考试答题卡容器存在         ok  入口切换函数可用
== 线上入口 ==
  ok  目录页 9 个域练习入口 / 5 个套卷入口 / 模考·错题·统计入口
  ok  线上页面无禁止性表述
  ok  思维导图与考试两个兼容入口均已收敛到统一页
RESULT(live): 26 passed, 0 failed
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
| `node tools/audit.js` | P0 = 0，GATE: PASS |
| `node tools/e2e.js` | 73 passed / 0 failed |
| `node tools/coverage.js` | 19 个二级领域全覆盖，台账 323 行 |
| `node tools/live_check.js` | 26 passed / 0 failed（对线上字节） |
