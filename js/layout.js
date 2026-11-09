/* 證書版面引擎：所有座標以底圖原始像素 (3627 x 2599) 為單位
 * layoutCertificate(data) → [{ch, x, y(基線), size, color}]
 * 預覽(canvas)與 PDF(pdf-lib) 共用同一份排版結果，確保所見即所得。 */
(function (global) {
  'use strict';

  const W = 3627, H = 2599;
  const FONT = 'WHTeMing';
  const FALLBACK = '"Noto Serif TC","PMingLiU","MingLiU","Songti TC",serif';
  const BLACK = '#000000', WHITE = '#ffffff';

  // 版面區塊設定（依範本量測）
  const CFG = {
    unit:  { cx: 2190, cy: 456, maxW: 880, size: 92, minSize: 48, color: WHITE },
    name:  { cx: 1890, cy: 1045, maxW: 1240, size: 220, minSize: 110, color: BLACK },
    body:  { left: 453, right: 3167, baseline1: 1474, size: 85, minSize: 72, lineGap: 1.435, indent: 2, color: BLACK },
    issue: { cx: 2000, baseline: 2296, size: 72, color: BLACK },
  };

  const BODY_TAIL = '」學習課程，學會更深入的程式編程，具備挑戰微軟邁客盃大賽的程式素養，期待同學繼續加油，創造更精進的程式設計。';

  let mctx = null;
  const wCache = new Map();
  let vCenter = 0.37; // 漢字視覺中心相對基線的比例（載入字型後量測）

  function ctx() {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    return mctx;
  }
  function fontStr(size) { return `${size}px "${FONT}",${FALLBACK}`; }
  function cw(ch, size) {
    const k = ch;
    let w = wCache.get(k);
    if (w === undefined) {
      const c = ctx(); c.font = fontStr(100);
      w = c.measureText(ch).width / 100;
      wCache.set(k, w);
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

  // 單行置中，字距自動
  function centerLine(out, text, cx, baseline, size, color, ls) {
    const chars = [...text];
    let x = cx - strW(text, size, ls) / 2;
    for (const ch of chars) { out.push({ ch, x, y: baseline, size, color }); x += cw(ch, size) + ls; }
  }

  function layoutUnit(out, text) {
    if (!text) return;
    const c = CFG.unit; const n = [...text].length;
    let size = c.size;
    let ls = n <= 4 ? size * 0.35 : n <= 6 ? size * 0.15 : size * 0.05;
    while (strW(text, size, ls) > c.maxW && size > c.minSize) { size -= 2; ls = Math.min(ls, size * 0.05); }
    if (strW(text, size, ls) > c.maxW) ls = 0;
    centerLine(out, text, c.cx, c.cy + size * vCenter, size, c.color, ls);
  }

  function layoutName(out, text) {
    if (!text) return;
    const c = CFG.name; const n = [...text].length;
    let size = c.size;
    // 2 字寬鬆、3 字適中、4 字以上緊湊（類似範本的字距效果）
    let ls = n <= 2 ? size * 1.0 : n === 3 ? size * 0.55 : n === 4 ? size * 0.18 : size * 0.04;
    while (strW(text, size, ls) > c.maxW && size > c.minSize) { size -= 4; ls = Math.min(ls, size * 0.04); }
    centerLine(out, text, c.cx, c.cy + size * vCenter, size, c.color, ls);
  }

  // ---- 內文排版：自動換行 + 左右對齊 + 避頭尾 ----
  const NO_START = new Set([...'，。、；：？！」』）〕】》〉…～,.;:?!)']);
  const NO_END = new Set([...'「『（〔【《〈(']);

  function bodyUnits(period, course, size) {
    const units = [];
    const push = (text, opts = {}) => units.push({ text, ...opts });
    push('於');
    if (period) {
      // 期程可在「～」處換行，前後日期各自不拆
      const [a, b] = period.split('～');
      if (b) { push(a, { gapL: 0.3 }); push('～' + b, { gapR: 0.3 }); }
      else push(period, { gapL: 0.3, gapR: 0.3 });
    } else push('　'.repeat(8));
    for (const ch of '完成「') push(ch);
    if (course) {
      // 課程名稱：中文逐字可換行，英文/數字單字不拆
      for (const tok of course.match(/[A-Za-z0-9][A-Za-z0-9.\-+#&']*\s?|\s|./gu)) push(tok);
    } else push('　'.repeat(6));
    for (const ch of BODY_TAIL) push(ch);
    for (const u of units) {
      u.w = strW(u.text, size) + ((u.gapL || 0) + (u.gapR || 0)) * size;
      u.first = [...u.text][0]; u.last = [...u.text].slice(-1)[0];
    }
    return units;
  }

  function breakLines(units, size, width) {
    const lines = []; let cur = []; let curW = 0; let avail = width - CFG.body.indent * size;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (curW + u.w <= avail + 0.5 || cur.length === 0) { cur.push(u); curW += u.w; continue; }
      // 避頭：標點不可在行首 → 把上一個單位帶到下一行
      let carry = [];
      if (NO_START.has(u.first) && cur.length > 1) carry.unshift(cur.pop());
      // 避尾：開括號不可在行尾
      while (cur.length > 1 && NO_END.has(cur[cur.length - 1].last)) carry.unshift(cur.pop());
      lines.push({ units: cur, avail });
      cur = [...carry, u]; curW = cur.reduce((a, x) => a + x.w, 0); avail = width;
    }
    if (cur.length) lines.push({ units: cur, avail, last: true });
    return lines;
  }

  function layoutBody(out, period, course) {
    const c = CFG.body; const width = c.right - c.left;
    let size = c.size, lines;
    for (;;) {
      lines = breakLines(bodyUnits(period, course, size), size, width);
      if (lines.length <= 3 || size <= c.minSize) break;
      size -= 1;
    }
    const lh = size * c.lineGap * (lines.length > 3 ? 0.97 : 1);
    lines.forEach((ln, li) => {
      const y = c.baseline1 + li * lh;
      const x0 = c.left + (li === 0 ? c.indent * size : 0);
      const used = ln.units.reduce((a, u) => a + u.w, 0);
      // 左右對齊：除最後一行，把剩餘空間平均分到每個單位之間
      const gaps = ln.units.length - 1;
      let extra = (!ln.last && gaps > 0) ? (ln.avail - used) / gaps : 0;
      if (extra > size * 0.6) extra = 0; // 異常時不拉伸
      let x = x0;
      for (const u of ln.units) {
        x += (u.gapL || 0) * size;
        for (const ch of u.text) {
          if (ch !== '　') out.push({ ch, x, y, size, color: c.color });
          x += cw(ch, size);
        }
        x += (u.gapR || 0) * size + extra;
      }
    });
  }

  function layoutIssue(out, roc) {
    if (!roc) return;
    const c = CFG.issue;
    const t = `民國${roc.y}年${roc.m}月${roc.d}日`;
    centerLine(out, t, c.cx, c.baseline, c.size, c.color, c.size * 0.18);
  }

  function layoutCertificate(d) {
    const out = [];
    layoutUnit(out, (d.unit || '').trim());
    layoutName(out, (d.name || '').trim());
    layoutBody(out, d.periodText || '', (d.course || '').trim());
    layoutIssue(out, d.issue);
    return out;
  }

  // canvas 繪製（預覽與縮圖用）
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

  global.CertLayout = { W, H, FONT, FALLBACK, CFG, layoutCertificate, drawGlyphs, measureMetrics, fontStr };
})(window);
