# 部署（GitHub Pages）

线上地址：https://terrffic.github.io/cbpp-prep/
分支：`main`（Pages 源为 `main` 根目录）

## 为什么不用 `git push`

本机 `git` 经本地代理 `CONNECT github.com:443` 会返回 `502`（代理只放通 `api.github.com` 等域名），
而 `api.github.com` 直连正常。因此部署走 **GitHub REST API 的 Git Data 接口**
（blob → tree → commit → 更新 ref），效果与 `push` 等价，且可逐文件核对。

## 用法

```bash
# 只看差异，不需要凭据
python tools/deploy.py --dry-run

# 部署（token 只从环境变量/文件/无回显输入取得，不写入命令行与日志）
export GITHUB_TOKEN=...        # 或 GITHUB_TOKEN_FILE=/path/to/file
python tools/deploy.py

# 只做线上核验（分支 SHA、逐文件 blob 比对、Pages 构建状态、线上 SHA-256 对比）
python tools/deploy.py --verify-only

# 把线上文件拉下来，对「真正发给浏览器的字节」跑启动与数据断言
node tools/live_check.js .workbuddy/tmp/live
```

需要的权限（fine-grained token，仅本仓库）：`Contents: Read and write`；若要读 Pages 构建状态再加
`Pages: Read`。

## 核验标准

`tools/deploy.py` 结束时必须满足：

1. 分支 `main` 的 SHA ＝ 本次提交 SHA；
2. 远端每个文件的 blob SHA ＝ 本地 `git hash-object` 结果（等价于逐字节一致），缺失 0、不一致 0；
3. Pages 最近构建 `built` 且 commit 与本次一致；
4. 四个入口 HTML 线上 SHA-256 与本地一致。

## 本次部署记录（2026-10-26）

- 最终提交：`0273adc8af782acf93f0ab1746152e5d2e271be3`
- Pages：`built`，构建 commit 与上一致
- 远端 28 个文件：缺失 0 / 不一致 0 / 多余 0
- 线上 SHA-256（四个入口）与入库字节逐一一致：
  `a9875e8a…` 备考中心 · `4eb5527c…` index · `e84fc202…` 思维导图 · `d5dcace5…` 考试
- 线上字节冒烟：26 passed / 0 failed
