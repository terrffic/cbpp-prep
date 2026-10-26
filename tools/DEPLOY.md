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
```

需要的权限（fine-grained token，仅本仓库）：`Contents: Read and write`；若要读 Pages 构建状态再加
`Pages: Read`。

## 核验标准

`tools/deploy.py` 结束时必须满足：

1. 分支 `main` 的 SHA ＝ 本次提交 SHA；
2. 远端每个文件的 blob SHA ＝ 本地 `git hash-object` 结果（等价于逐字节一致），缺失 0、不一致 0；
3. Pages 最近构建 `built` 且 commit 与本次一致；
4. 四个入口 HTML 线上 SHA-256 与本地一致。
