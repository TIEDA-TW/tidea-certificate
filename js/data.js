/* 資料解析：日期(民國/西元)、期程、姓名清單、CSV/Excel 匯入 */
(function (global) {
  'use strict';

  const toHalf = (s) => String(s ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[／．－]/g, (c) => ({ '／': '/', '．': '.', '－': '-' }[c]))
    .trim();

  function norm(y, m, d) {
    y = +y; m = +m; d = +d;
    if (y > 1911) y -= 1911;
    if (!(y > 0 && y < 300 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    return { y, m, d };
  }

  function excelSerialToDate(n) {
    const ms = Math.round((n - 25569) * 86400000);
    const dt = new Date(ms);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  const DATE_RE = /(?:民國|中華民國)?\s*(\d{2,4})\s*(?:年|\/|\.|-)\s*(\d{1,2})\s*(?:月|\/|\.|-)\s*(\d{1,2})\s*日?/g;

  // 單一日期 → {y,m,d}（民國）
  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return norm(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number' && v > 20000 && v < 80000) { const t = excelSerialToDate(v); return norm(t.y, t.m, t.d); }
    const s = toHalf(v);
    DATE_RE.lastIndex = 0;
    const m = DATE_RE.exec(s);
    if (m) return norm(m[1], m[2], m[3]);
    const c = s.match(/^(\d{3})(\d{2})(\d{2})$/) || s.match(/^(\d{4})(\d{2})(\d{2})$/); // 1150301 / 20260301
    if (c) return norm(c[1], c[2], c[3]);
    return null;
  }

  // 授課期程 → {from,to}
  function parsePeriod(v) {
    if (v == null || v === '') return null;
    const s = toHalf(v);
    const found = [];
    DATE_RE.lastIndex = 0;
    let m;
    while ((m = DATE_RE.exec(s))) found.push({ d: norm(m[1], m[2], m[3]), end: DATE_RE.lastIndex });
    if (found.length >= 2 && found[0].d && found[1].d) return { from: found[0].d, to: found[1].d };
    if (found.length === 1 && found[0].d) {
      // 第二個日期省略年份：115/3/1~6/30
      const rest = s.slice(found[0].end);
      const r = rest.match(/(\d{1,2})\s*(?:月|\/|\.|-)\s*(\d{1,2})/);
      if (r) { const to = norm(found[0].d.y, r[1], r[2]); if (to) return { from: found[0].d, to }; }
    }
    return null;
  }

  const rocText = (d) => d ? `民國${d.y}年${d.m}月${d.d}日` : '';
  const periodText = (p) => p ? `${rocText(p.from)}～${rocText(p.to)}` : '';

  // 手動姓名：換行、逗號、頓號、空白皆可分隔
  function parseNames(text) {
    return String(text || '')
      .split(/[\n\r,，、;；\t]+|\s{1,}/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // ---- 檔案匯入 ----
  const ALIAS = {
    name: ['姓名', '學生姓名', '學員姓名', '名字', '學生', '學員', 'name'],
    period: ['授課期程', '期程', '上課期程', '上課期間', '授課期間', '課程期間', '日期', 'period'],
    course: ['課程名稱', '課程', 'course'],
    issue: ['發證日期', '頒發日期', '發證日', '頒證日期', 'issue', 'issuedate'],
    unit: ['單位名稱', '學校名稱', '學校', '單位', '國小', '補習班', '開課單位', 'school', 'unit'],
  };
  const keyOf = (h) => {
    const k = String(h || '').replace(/\s/g, '').toLowerCase();
    for (const [f, list] of Object.entries(ALIAS)) if (list.some((a) => k === a.toLowerCase())) return f;
    for (const [f, list] of Object.entries(ALIAS)) if (list.some((a) => a.length > 1 && k.includes(a.toLowerCase()))) return f;
    return null;
  };

  function decodeText(buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return new TextDecoder('utf-8').decode(u8.subarray(3));
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
    catch (e) { return new TextDecoder('big5').decode(u8); } // Windows Excel 存的 CSV 常為 Big5
  }

  async function readTable(file) {
    if (typeof XLSX === 'undefined') throw new Error('Excel 模組尚未載入');
    const buf = await file.arrayBuffer();
    const isText = /\.(csv|txt|tsv)$/i.test(file.name);
    const wb = isText
      ? XLSX.read(decodeText(buf), { type: 'string', raw: true, cellDates: true })
      : XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
      .filter((r) => r.some((c) => String(c).trim() !== ''));
    if (!rows.length) return { records: [], cols: [] };
    const head = rows[0].map(keyOf);
    let start = 1, map = head;
    if (!head.includes('name')) { map = rows[0].map((_, i) => (i === 0 ? 'name' : null)); start = 0; }
    const records = [];
    for (let i = start; i < rows.length; i++) {
      const r = {};
      map.forEach((k, ci) => { if (k && r[k] === undefined) r[k] = rows[i][ci]; });
      if (!String(r.name ?? '').trim()) continue;
      r.name = String(r.name).trim();
      records.push(r);
    }
    return { records, cols: [...new Set(map.filter(Boolean))] };
  }

  const safeName = (s) => String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, '').trim().slice(0, 40);

  global.CertData = { parseDate, parsePeriod, rocText, periodText, parseNames, readTable, safeName };
})(window);
