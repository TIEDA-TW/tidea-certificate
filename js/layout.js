/* 證書版面引擎（多課程）
 * layoutCertificate(data, course) → [{ch, x, y(基線), size, color}]
 * 座標以各課程底圖的原始像素為單位；預覽(canvas)與 PDF(pdf-lib) 共用同一份排版結果。 */
(function (global) {
  'use strict';

  const FONT = 'WHTeMing';
  const FALLBACK = '"Noto Serif TC","PMingLiU","MingLiU","Songti TC",serif';

  let mctx = null;
  const wCache = new Map();
  let vCenter = 0.37; // 漢字視覺中心相對基線的比例（載入字型後量測）

  function ctx() {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    return mctx;
  }
  function fontStr(size) { return `${size}px "${FONT}",${FALLBACK}`; }
  function cw(ch, size) {
    let w = wCache.get(ch);
    if (w === undefined) {
      const c = ctx(); c.font = fontStr(100);
      w = c.measureText(ch).width / 100;
      wCache.set(ch, w);
    }
    return w * size;
  }
  function measureMetrics() {
    const c = ctx(); c.font = fontStr(100);
    const m = c.measureText('國');
    if (m.actualBoundingBoxAscent) vCenter = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 / 100;
    wCache.clear();
  }
  const strW = (s, size, ls = 0) => [...s].reduce((a, ch) => a + cw(ch, size), 0) + ls * Math.max(0, [...s].length - 1);

  function centerLine(out, text, cx, baseline, size, color, ls) {
    let x = cx - strW(text, size, ls) / 2;
    for (const ch of text) { out.push({ ch, x, y: baseline, size, color }); x += cw(ch, size) + ls; }
  }

  // ---- 單位名稱 ----
  function layoutUnit(out, unit, cfg, ink) {
    if (!cfg || !unit) return;
    const text = (cfg.tpl || '{unit}').replace('{unit}', unit);
    const n = [...text].length;
    let size = cfg.size;
    let ls = cfg.type === 'pill'
      ? (n <= 4 ? size * 0.35 : n <= 6 ? size * 0.15 : size * 0.05)
      : (n <= 3 ? size * 0.25 : n <= 5 ? size * 0.08 : 0);
    while (strW(text, size, ls) > cfg.maxW && size > cfg.size * 0.45) { size -= 2; ls = Math.min(ls, size * 0.05); }
    if (strW(text, size, ls) > cfg.maxW) ls = 0;
    centerLine(out, text, cfg.cx, cfg.cy + size * vCenter, size, cfg.color || ink, ls);
  }

  // ---- 姓名 ----
  function layoutName(out, text, cfg, ink) {
    if (!text) return;
    const n = [...text].length;
    let size = cfg.size;
    // 2 字寬鬆、3 字適中、4 字以上緊湊；過長自動縮小
    let ls = n <= 2 ? size * (cfg.ls2 != null ? cfg.ls2 : 0.6) : n === 3 ? size * (cfg.ls3 != null ? cfg.ls3 : 0.15) : n === 4 ? size * 0.08 : size * 0.03;
    const maxLs = (cfg.maxW - strW(text, size)) / Math.max(1, n - 1);
    if (ls > maxLs) ls = Math.max(size * 0.04, maxLs);
    while (strW(text, size, ls) > cfg.maxW && size > cfg.size * 0.5) { size -= 4; ls = Math.min(ls, size * 0.04); }
    centerLine(out, text, cfg.cx, cfg.cy + size * vCenter, size, cfg.color || ink, ls);
  }

  // ---- 內文：自動換行 + 左右對齊(或置中) + 避頭尾 ----
  const NO_START = new Set([...'，。、；：？！」』）〕】》〉…～,.;:?!)']);
  const NO_END = new Set([...'「『（〔【《〈(']);
  const WORD_RE = /[A-Za-z0-9][A-Za-z0-9.\-+#&'/]*|\s|./gu;

  function tokens(str) { return str.match(WORD_RE) || []; }

  function bodyUnits(cfg, periodText, course, size) {
    const units = [];
    const push = (text, o = {}) => units.push({ text, ...o });
    const gap = cfg.periodGap != null ? cfg.periodGap : 0.12;
    const parts = cfg.tpl.split(/(\{period\}|\{course\})/);
    for (const p of parts) {
      if (!p) continue;
      if (p === '{period}') {
        if (!periodText) { push('　'.repeat(8)); continue; }
        const idx = periodText.search(/[～~至\-]/);
        if (idx > 0) {
          push(periodText.slice(0, idx), { gapL: gap });
          push(periodText.slice(idx), { gapR: gap });
        } else push(periodText, { gapL: gap, gapR: gap });
      } else if (p === '{course}') {
        if (!course) { push('　'.repeat(6)); continue; }
        for (const t of tokens(course)) push(t);
      } else {
        for (const t of tokens(p)) push(t);
      }
    }
    for (const u of units) {
      u.w = strW(u.text, size) + ((u.gapL || 0) + (u.gapR || 0)) * size;
      u.first = [...u.text][0]; u.last = [...u.text].slice(-1)[0];
      u.space = /^\s$/.test(u.text);
    }
    return units;
  }

  function breakLines(units, size, width, indent) {
    const lines = []; let cur = []; let curW = 0; let avail = width - indent * size;
    for (const u of units) {
      if (cur.length === 0 && u.space) continue; // 行首不留空白
      if (curW + u.w <= avail + 0.5 || cur.length === 0) { cur.push(u); curW += u.w; continue; }
      const carry = [];
      if (NO_START.has(u.first) && cur.length > 1) carry.unshift(cur.pop());
      while (cur.length > 1 && NO_END.has(cur[cur.length - 1].last)) carry.unshift(cur.pop());
      while (cur.length && cur[cur.length - 1].space) cur.pop();
      lines.push({ units: cur, avail });
      cur = [...carry, u]; curW = cur.reduce((a, x) => a + x.w, 0); avail = width;
    }
    if (cur.length) lines.push({ units: cur, avail, last: true });
    return lines;
  }

  function layoutBody(out, cfg, periodText, course, ink) {
    const width = cfg.right - cfg.left;
    const center = cfg.align === 'center';
    const indent = center ? 0 : (cfg.indent || 0);
    const maxLines = cfg.maxLines || 4;
    let size = cfg.size, lines;
    for (;;) { // 超過預定行數時，字級最多縮小 15%
      lines = breakLines(bodyUnits(cfg, periodText, course, size), size, width, indent);
      if (lines.length <= maxLines || size <= cfg.size * 0.85) break;
      size -= 1;
    }
    const lh = cfg.size * cfg.lineGap * (size / cfg.size);
    const color = cfg.color || ink;
    lines.forEach((ln, li) => {
      const y = cfg.baseline1 + li * lh;
      const used = ln.units.reduce((a, u) => a + u.w, 0);
      let x, extra = 0;
      if (center) {
        x = cfg.left + (width - used) / 2;
      } else {
        x = cfg.left + (li === 0 ? indent * size : 0);
        const gaps = ln.units.length - 1;
        extra = (!ln.last && gaps > 0) ? (ln.avail - used) / gaps : 0;
        if (extra > size * 0.6) extra = 0;
      }
      for (const u of ln.units) {
        x += (u.gapL || 0) * size;
        for (const ch of u.text) {
          if (ch !== '　' && ch.trim()) out.push({ ch, x, y, size, color });
          x += cw(ch, size);
        }
        x += (u.gapR || 0) * size + extra;
      }
    });
  }

  // ---- 發證日期 ----
  const p2 = (n) => String(n).padStart(2, '0');
  function layoutIssue(out, roc, cfg, ink) {
    if (!roc || !cfg) return;
    const color = cfg.color || ink;
    const m = cfg.pad ? p2(roc.m) : String(roc.m);
    const d = cfg.pad ? p2(roc.d) : String(roc.d);
    const ls = (cfg.ls || 0) * cfg.size;
    if (cfg.fmt === 'roc') return centerLine(out, `民國${roc.y}年${roc.m}月${roc.d}日`, cfg.cx, cfg.baseline, cfg.size, color, ls);
    if (cfg.fmt === 'ymd') return centerLine(out, `${roc.y}年${m}月${d}日`, cfg.cx, cfg.baseline, cfg.size, color, ls);
    if (cfg.fmt === 'full') return centerLine(out, `中華民國${roc.y}年${p2(roc.m)}月${p2(roc.d)}日`, cfg.cx, cfg.baseline, cfg.size, color, ls);
    // spread / spreadChars：平均分散在 x0 ~ x1
    const parts = cfg.fmt === 'spreadChars'
      ? [...`中華民國${roc.y}年${p2(roc.m)}月${p2(roc.d)}日`]
      : ['中', '華', '民', '國', String(roc.y), '年', p2(roc.m), '月', p2(roc.d), '日'];
    const ws = parts.map((t) => strW(t, cfg.size));
    const gap = (cfg.x1 - cfg.x0 - ws.reduce((a, b) => a + b, 0)) / (parts.length - 1);
    let x = cfg.x0;
    parts.forEach((t, i) => {
      for (const ch of t) { out.push({ ch, x, y: cfg.baseline, size: cfg.size, color }); x += cw(ch, cfg.size); }
      x += gap;
    });
  }

  function layoutCertificate(d, course) {
    const out = [];
    const ink = course.ink || '#000000';
    layoutUnit(out, (d.unit || '').trim(), course.unit, ink);
    layoutName(out, (d.name || '').trim(), course.name, ink);
    layoutBody(out, course.body, d.periodText || '', (d.course || '').trim(), ink);
    layoutIssue(out, d.issue, course.issue, ink);
    return out;
  }

  function drawGlyphs(c, glyphs, scale) {
    c.textBaseline = 'alphabetic';
    let lastFont = '', lastColor = '';
    for (const g of glyphs) {
      const f = fontStr(g.size * scale);
      if (f !== lastFont) { c.font = f; lastFont = f; }
      if (g.color !== lastColor) { c.fillStyle = g.color; lastColor = g.color; }
      c.fillText(g.ch, g.x * scale, g.y * scale);
    }
  }

  global.CertLayout = { FONT, FALLBACK, layoutCertificate, drawGlyphs, measureMetrics, fontStr };
})(window);
