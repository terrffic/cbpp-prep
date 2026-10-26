#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""通过 GitHub REST API（Git Data API）部署 cbpp-prep，全程 HTTPS。

为什么用 API 而不是 git push：
  本机 git 走本地代理 CONNECT github.com:443 会返回 502（代理只放通 api.github.com 等域名），
  而 api.github.com 直连正常。用 Git Data API 可以只靠 api.github.com 完成 blob → tree →
  commit → 更新 ref 的全过程，效果与 push 等价。

凭据处理（不落盘、不进命令行、不进日志）：
  1) 环境变量 GITHUB_TOKEN / GH_TOKEN；或
  2) 环境变量 GITHUB_TOKEN_FILE 指向的文件（首行为 token）；或
  3) 交互式 getpass 输入（不回显）。
  token 只出现在 Authorization 请求头里，脚本任何输出都不含 token。

用法：
  python tools/deploy.py --dry-run          # 只看差异，不需要 token
  python tools/deploy.py                    # 真正提交并推送
  python tools/deploy.py --verify-only      # 只做线上逐字节校验
"""
import argparse
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

OWNER, REPO = "terrffic", "cbpp-prep"
API = "https://api.github.com"
BRANCH = "main"
PAGES_URL = "https://terrffic.github.io/cbpp-prep/"


def log(msg):
    print(msg, flush=True)


def die(msg, code=1):
    print("FATAL: " + msg, flush=True)
    sys.exit(code)


# ---------------------------------------------------------------- 凭据
def get_token(required=True):
    tok = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not tok:
        fp = os.environ.get("GITHUB_TOKEN_FILE")
        if fp and os.path.exists(fp):
            with open(fp, "r", encoding="utf-8") as fh:
                tok = fh.read().strip()
    if not tok and required and sys.stdin.isatty():
        import getpass
        tok = getpass.getpass("GitHub token (输入不回显): ").strip()
    if not tok and required:
        die("未取得 token。请用环境变量 GITHUB_TOKEN 传入，或设置 GITHUB_TOKEN_FILE 指向一个只读文件。")
    return tok or ""


# ---------------------------------------------------------------- HTTP
class Api:
    def __init__(self, token):
        self.token = token

    def call(self, method, path, payload=None, raw=False):
        url = path if path.startswith("http") else API + path
        data = None
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "cbpp-prep-deploy",
        }
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                body = resp.read()
                return resp.status, (body if raw else json.loads(body.decode("utf-8") or "{}"))
        except urllib.error.HTTPError as e:
            text = e.read().decode("utf-8", "replace")
            return e.code, text


# ---------------------------------------------------------------- 本地 git
def git(*args, cwd):
    r = subprocess.run(["git"] + list(args), cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        die("git %s 失败: %s" % (" ".join(args), r.stderr.strip()))
    return r.stdout


def local_files(repo):
    """返回 {path: (git_blob_sha, size)}，只含已跟踪文件。"""
    out = git("ls-files", "-z", cwd=repo).split("\0")
    files = {}
    for p in out:
        if not p:
            continue
        sha = git("hash-object", p, cwd=repo).strip()
        size = os.path.getsize(os.path.join(repo, p))
        files[p] = (sha, size)
    return files


def blob_bytes(repo, path):
    """取「git 会存进去的那份字节」：HEAD 里的内容（LF 归一化），
    而不是工作区原始字节。这样入库 blob 与 `git hash-object` 一致，
    别人的 clone 不会因为 core.autocrlf 而永远显示 modified。"""
    r = subprocess.run(["git", "cat-file", "blob", "HEAD:" + path], cwd=repo, capture_output=True)
    if r.returncode == 0:
        return r.stdout
    return open(os.path.join(repo, path), "rb").read()


# ---------------------------------------------------------------- 主流程
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verify-only", action="store_true")
    ap.add_argument("--message", default="")
    args = ap.parse_args()
    repo = os.path.abspath(args.repo)

    token = get_token(required=not args.dry_run and not args.verify_only)
    api = Api(token)

    st, head = api.call("GET", "/repos/%s/%s/git/ref/heads/%s" % (OWNER, REPO, BRANCH))
    if st != 200:
        die("读取分支失败 HTTP %s: %s" % (st, head))
    head_sha = head["object"]["sha"]
    log("远端 HEAD  %s  (%s/%s)" % (head_sha[:12], OWNER, REPO))

    st, tree = api.call("GET", "/repos/%s/%s/git/trees/%s?recursive=1" % (OWNER, REPO, head_sha))
    if st != 200:
        die("读取远端树失败 HTTP %s: %s" % (st, tree))
    remote = {e["path"]: e["sha"] for e in tree.get("tree", []) if e["type"] == "blob"}
    log("远端文件 %d 个%s" % (len(remote), "（树被截断）" if tree.get("truncated") else ""))

    local = local_files(repo)
    added = sorted(p for p in local if p not in remote)
    deleted = sorted(p for p in remote if p not in local)
    changed = sorted(p for p in local if p in remote and local[p][0] != remote[p])
    same = len(local) - len(added) - len(changed)

    log("本地文件 %d 个：未变 %d / 修改 %d / 新增 %d / 删除 %d"
        % (len(local), same, len(changed), len(added), len(deleted)))
    for p in changed[:40]:
        log("  M %-52s %7.1f KB" % (p, local[p][1] / 1024))
    for p in added[:20]:
        log("  A %-52s %7.1f KB" % (p, local[p][1] / 1024))
    for p in deleted[:20]:
        log("  D %s" % p)

    if args.dry_run:
        log("\n--dry-run：不做任何写入。")
        return 0

    if args.verify_only:
        verify_all(api, repo=repo)
        return 0

    if not (changed or added or deleted):
        log("\n远端已与本地一致，无需提交。")
        verify_all(api, repo=repo)
        return 0

    # 1) 上传 blob（仅变动的文件）
    new_entries = []
    for i, p in enumerate(changed + added, 1):
        content = blob_bytes(repo, p)
        st, res = api.call("POST", "/repos/%s/%s/git/blobs" % (OWNER, REPO), {
            "content": base64.b64encode(content).decode("ascii"),
            "encoding": "base64",
        })
        if st not in (200, 201):
            die("上传 blob 失败 %s HTTP %s: %s" % (p, st, res))
        new_entries.append({"path": p, "mode": "100644", "type": "blob", "sha": res["sha"]})
        log("  ↑ blob %2d/%d %s" % (i, len(changed) + len(added), p))
    for p in deleted:
        new_entries.append({"path": p, "mode": "100644", "type": "blob", "sha": None})

    # 2) 建树
    st, newtree = api.call("POST", "/repos/%s/%s/git/trees" % (OWNER, REPO), {
        "base_tree": tree["sha"],
        "tree": new_entries,
    })
    if st not in (200, 201):
        die("建树失败 HTTP %s: %s" % (st, newtree))
    log("新树 %s" % newtree["sha"][:12])

    # 3) 建提交
    msg = args.message or default_message(repo)
    st, commit = api.call("POST", "/repos/%s/%s/git/commits" % (OWNER, REPO), {
        "message": msg,
        "tree": newtree["sha"],
        "parents": [head_sha],
    })
    if st not in (200, 201):
        die("创建提交失败 HTTP %s: %s" % (st, commit))
    log("新提交 %s" % commit["sha"])

    # 4) 移动分支（非强制：带上旧值，远端被别人推进则失败而不覆盖）
    st, ref = api.call("PATCH", "/repos/%s/%s/git/refs/heads/%s" % (OWNER, REPO, BRANCH), {
        "sha": commit["sha"],
        "force": False,
    })
    if st != 200:
        die("更新分支失败 HTTP %s: %s" % (st, ref))
    log("分支 %s 已更新 → %s" % (BRANCH, commit["sha"]))

    log("\n最终提交 SHA: " + commit["sha"])
    verify_all(api, commit["sha"], repo=repo)
    return 0


def default_message(repo):
    try:
        return git("log", "-1", "--pretty=%B", cwd=repo).strip()
    except SystemExit:
        return "deploy: sync cbpp-prep"


def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()


def verify_all(api, expect_sha=None, repo=None):
    """逐文件核对「本地 = 分支 = Pages 线上」，并打印 Pages 构建状态。"""
    if repo is None:
        repo = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

    st, head = api.call("GET", "/repos/%s/%s/git/ref/heads/%s" % (OWNER, REPO, BRANCH))
    head_sha = head["object"]["sha"] if st == 200 else "?"
    log("\n== 线上核验 ==")
    log("分支 %s 当前 SHA：%s" % (BRANCH, head_sha))
    if expect_sha and head_sha != expect_sha:
        log("  !! 与本次提交不一致")

    # 远端每个文件的 blob sha 与本地 git blob sha 对比（等价于逐字节一致）
    st, tree = api.call("GET", "/repos/%s/%s/git/trees/%s?recursive=1" % (OWNER, REPO, head_sha))
    remote = {e["path"]: e["sha"] for e in tree.get("tree", []) if e["type"] == "blob"} if st == 200 else {}
    local = local_files(repo)
    miss = [p for p in local if p not in remote]
    diff = [p for p in local if p in remote and remote[p] != local[p][0]]
    extra = [p for p in remote if p not in local]
    log("远端文件 %d 个；本地 %d 个；缺失 %d / 不一致 %d / 多余 %d"
        % (len(remote), len(local), len(miss), len(diff), len(extra)))
    for p in (miss + diff)[:10]:
        log("  !! %s" % p)

    # Pages 构建
    st, pg = api.call("GET", "/repos/%s/%s/pages" % (OWNER, REPO))
    if st == 200:
        log("Pages：status=%s  源=%s/%s  URL=%s"
            % (pg.get("status"), pg.get("source", {}).get("branch"), pg.get("source", {}).get("path"), pg.get("html_url")))
        for attempt in range(20):
            st, b = api.call("GET", "/repos/%s/%s/pages/builds/latest" % (OWNER, REPO))
            if st == 200:
                log("  最近构建：%s / %s / commit=%s"
                    % (b.get("status"), b.get("error", {}).get("message", "-"), str(b.get("commit"))[:12]))
                if b.get("status") == "built" and str(b.get("commit", "")).startswith(head_sha[:7]):
                    break
            time.sleep(10)
    else:
        log("Pages 状态读取失败 HTTP %s（可能未启用 Pages）" % st)

    # 逐字节对比 Pages 线上文件
    log("Pages 线上逐文件校验（SHA-256，对照 git 入库字节）：")
    ok = fail = 0
    targets = ["index.html", "CBPP备考中心.html", "CBPP考点思维导图.html", "CBPP模拟考试系统.html"]
    for p in targets:
        url = PAGES_URL + urllib.parse.quote(p)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "cbpp-prep-verify", "Cache-Control": "no-cache"})
            with urllib.request.urlopen(req, timeout=60) as r:
                served = r.read()
        except Exception as e:
            log("  ERR %-28s %s" % (p, e))
            fail += 1
            continue
        # 与「git 入库的那份字节」比（Pages 直接服务 blob，LF 归一化后的内容）
        lh = sha256_bytes(blob_bytes(repo, p))
        sh = sha256_bytes(served)
        if lh == sh:
            log("  OK  %-28s %6.1f KB  %s" % (p, len(served) / 1024, sh[:16]))
            ok += 1
        else:
            log("  DIFF %-28s 本地 %s / 线上 %s" % (p, lh[:16], sh[:16]))
            fail += 1
    log("线上校验：%d 一致 / %d 不一致或不可达" % (ok, fail))
    return fail == 0


if __name__ == "__main__":
    sys.exit(main() or 0)
