#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""更新英文题库字典（页面里有两处 `const ENQ = {...}`：分章练习 36 题、模考题库）中指定题目的 s / o / e。
用法：python tools/patch_enq.py en_overrides.json
"""
import io, json, sys


def find_obj(s, start):
    depth = 0
    i = start
    n = len(s)
    q = None
    while i < n:
        ch = s[i]
        if q:
            if ch == '\\':
                i += 2
                continue
            if ch == q:
                q = None
        else:
            if ch in '"\'`':
                q = ch
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return i + 1
        i += 1
    return None


def main():
    ov = json.load(io.open(sys.argv[1], encoding='utf-8'))
    path = sys.argv[2] if len(sys.argv) > 2 else 'CBPP备考中心.html'
    s = io.open(path, encoding='utf-8').read()

    starts = []
    idx = 0
    while True:
        j = s.find('const ENQ = ', idx)
        if j < 0:
            break
        starts.append(j + len('const ENQ = '))
        idx = j + 1

    total, missing = 0, set(ov.keys())
    # 从后往前替换，避免位置偏移
    for st in reversed(starts):
        end = find_obj(s, st)
        obj = json.loads(s[st:end])
        changed = 0
        for qid, fields in ov.items():
            if qid not in obj:
                continue
            for k in ('s', 'o', 'e'):
                if k in fields:
                    obj[qid][k] = fields[k]
            changed += 1
            missing.discard(qid)
        if changed:
            body = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
            s = s[:st] + body + s[end:]
            total += changed
    io.open(path, 'w', encoding='utf-8').write(s)
    print('ENQ updated %d, missing %d' % (total, len(missing)))
    if missing:
        print('MISSING:', ', '.join(sorted(missing)))


if __name__ == '__main__':
    main()
