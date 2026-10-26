#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""按题目 id 精确替换题库字段（不改变其余源码格式）。
用法：python tools/patch_bank.py overrides.json
overrides.json: { "<id>": { "s"?, "sEn"?, "e"?, "eEn"?, "o"?, "oEn"?, "a"? }, ... }
"""
import io, json, re, sys


def find_block(s, qid):
    """返回该 id 所属对象字面量的 [start, end) 区间（含花括号）。"""
    m = None
    for pat in ('id:"%s"' % qid, 'id: "%s"' % qid, "id:'%s'" % qid):
        i = s.find(pat)
        if i >= 0:
            m = i
            break
    if m is None:
        return None
    start = s.rfind('{', 0, m)
    depth = 0
    i = start
    n = len(s)
    quote = None
    while i < n:
        ch = s[i]
        if quote:
            if ch == '\\':
                i += 2
                continue
            if ch == quote:
                quote = None
        else:
            if ch in '"\'`':
                quote = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return (start, i + 1)
        i += 1
    return None


def find_string_value(s, block, key):
    """在 block 内定位 key:"...." 的字面量范围（返回值区间）。"""
    pat = re.compile(r'(?<![A-Za-z0-9_])' + key + r'\s*:\s*"')
    m = pat.search(s, block[0], block[1])
    if not m:
        return None
    i = m.end()
    start = i
    n = len(s)
    while i < n:
        if s[i] == '\\':
            i += 2
            continue
        if s[i] == '"':
            return (start, i)
        i += 1
    return None


def js_str(v):
    return json.dumps(v, ensure_ascii=False)


def js_arr(v):
    return '[' + ', '.join(js_str(x) for x in v) + ']'


def patch(path, overrides):
    s = io.open(path, encoding='utf-8').read()
    applied, missing = [], []
    for qid, fields in overrides.items():
        blk = find_block(s, qid)
        if not blk:
            missing.append(qid)
            continue
        # 先处理字符串字段（从后往前替换，避免位移）
        edits = []
        for key in ('s', 'sEn', 'e', 'eEn'):
            if key not in fields:
                continue
            rng = find_string_value(s, blk, key)
            if not rng:
                missing.append('%s.%s' % (qid, key))
                continue
            edits.append((rng[0] - 1, rng[1] + 1, js_str(fields[key])))
        for key, fmt in (('o', js_arr), ('oEn', js_arr)):
            if key not in fields:
                continue
            pat = re.compile(r'(?<![A-Za-z0-9_])' + key + r'\s*:\s*\[[^\]]*\]')
            m = pat.search(s, blk[0], blk[1])
            if not m:
                missing.append('%s.%s' % (qid, key))
                continue
            edits.append((m.start(), m.end(), key + ':' + fmt(fields[key])))
        if 'a' in fields:
            pat = re.compile(r'(?<![A-Za-z0-9_])a\s*:\s*\d')
            m = pat.search(s, blk[0], blk[1])
            if not m:
                missing.append(qid + '.a')
            else:
                edits.append((m.start(), m.end(), 'a:' + str(fields['a'])))
        for st, en, txt in sorted(edits, reverse=True):
            s = s[:st] + txt + s[en:]
        applied.append(qid)
    io.open(path, 'w', encoding='utf-8').write(s)
    print('applied %d, missing %d' % (len(applied), len(missing)))
    if missing:
        print('MISSING:', ', '.join(missing[:20]))
    return len(missing) == 0


if __name__ == '__main__':
    ov = json.load(io.open(sys.argv[1], encoding='utf-8'))
    target = sys.argv[2] if len(sys.argv) > 2 else 'CBPP备考中心.html'
    ok = patch(target, ov)
    sys.exit(0 if ok else 1)
