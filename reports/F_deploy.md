# F · 部署验证

## 1. 本地提交状态

| 项 | 值 |
|---|---|
| 分支 | `main` |
| 本地提交 | **`b6813e8`**（父提交 `7f88b00`） |
| 提交内容 | 4 个 HTML + README + `tools/`(9 个脚本) + `reports/`(9 个交付物) |
| 工作区 | 干净（`git status` 无未提交改动） |

本地文件校验和（SHA-256，用于与线上逐字比对）：

```
a9875e8a36f51abeb15a2acb0804a8d8095adf186b50b0ec2501fa2c8e1882d1  CBPP备考中心.html
c09b9ba5a8ceb3f1d6823dde8fe1735d3f1e4ef63fce1f8dd9ea947a8ecb6b16  index.html
4b24061ecc89129a19fae1cd0065cd42f0d5c9f61d99ca97cedb96021183382e  CBPP考点思维导图.html
a128af4df001dadfb4408751586b360158e7e87a259125984827c3ebd280a4b9  CBPP模拟考试系统.html
```

## 2. 推送状态：**未完成**（需要你授权）

- `git push` 失败：`schannel: server closed abruptly (missing close_notify)` —— 本机到 GitHub 的 git 协议被网络策略阻断（上一轮也是同样原因，当时改用 REST API 推送）。
- 改用 REST API 需要带 token 发请求，命令在审批环节**超时未获授权**，因此**本轮没有推送，也没有线上核验**。
- 我不把这一条写成"已部署"。

### 需要你做的一件事（二选一）

**A. 审批一次推送**：在会话里允许执行带凭据的 `curl`（或直接允许 `git push`），我立刻推送并完成 §3 的线上核验。

**B. 你本地推**（两条命令，token 用新生成的细粒度 token，只给这一个仓库的 Contents 读写权限）：

```bash
cd cbpp-prep
git push https://<你的token>@github.com/terrffic/cbpp-prep.git main
```

推送成功后告诉我，我再去拉线上文件做 §3 的比对。

> 安全提醒：之前在对话里贴出的 classic token `ghp_t1…` 已明文暴露，请到 https://github.com/settings/tokens 删除，改用 fine-grained token（仅 `terrffic/cbpp-prep`、仅 Contents: Read and write）。

## 3. 推送后要跑的线上核验（脚本已备好，尚未执行）

```bash
# 1) 拉线上文件（带时间戳绕过缓存）
curl -sL "https://terrffic.github.io/cbpp-prep/CBPP%E5%A4%87%E8%80%83%E4%B8%AD%E5%BF%83.html?t=$(date +%s)" -o /tmp/live.html

# 2) 逐字比对（应与本地 SHA-256 完全一致；Pages 构建可能注入无内容差异，若不一致看下一步）
sha256sum /tmp/live.html CBPP备考中心.html

# 3) 关键内容校验（文件一致之外，再验业务事实）
grep -c '训练参考线' /tmp/live.html          # 应 > 0
grep -c '官方及格线' /tmp/live.html          # 只允许出现在「非官方及格线」
grep -c '必考' /tmp/live.html                # 应为 0
grep -o 'id:"g5-dpmo1".\{0,200\}' /tmp/live.html | head -1   # 看答案索引是否为 3000 那项
```

核验通过后需要写进本文件的四项事实：**最终 Commit SHA / Pages 访问链接 / 线上文件 SHA-256 / 线上题库计数（323）**。目前这四项都还没有，因此本文件暂时是"待核验"状态。

## 4. 已确认的本地事实（不依赖线上）

| 项 | 结果 |
|---|---|
| `node tools/audit.js` | P0 = 0，GATE: PASS |
| `node tools/e2e.js` | 73 passed / 0 failed |
| 题库计数 | 323（页面徽章运行时回填，与脚本读数一致） |
| 四个入口的文件关系 | 主体应用 1 份内容 + 2 个跳转页 + 1 个目录页；跳转目标为 `#study` / `#exam` |
| 目录页链接 | 9 个 `#drillN`、5 个 `#paperN`、`#chapter` / `#wrong` / `#stats` 均指向主体应用 |
