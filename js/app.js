(function () {
  'use strict';
  const L = window.CertLayout, D = window.CertData, P = window.CertPDF;
  const $ = (id) => document.getElementById(id);

  const state = {
    source: 'manual',
    manualNames: [],
    fileRecords: [],
    fileName: '',
    current: 0,
    ready: false,
    busy: false,
    cancel: false,
  };
  const assets = { fontBytes: null, cmap: null };
  const bgBytesCache = new Map();   // 課程 id → 高解析底圖 (PDF 用)
  const bgImgCache = new Map();     // 課程 id → 預覽底圖 Image
  const COURSE_KEY = 'cert-course-v1';
  try { state.courseId = localStorage.getItem(COURSE_KEY) || 'minecraft'; } catch (e) { state.courseId = 'minecraft'; }
  const course = () => window.getCourse(state.courseId);
  function previewImg(c) {
    let im = bgImgCache.get(c.id);
    if (!im) { im = new Image(); im.onload = () => schedulePreview(); im.src = c.preview; bgImgCache.set(c.id, im); }
    return im;
  }
  async function bgBytesFor(c) {
    if (!bgBytesCache.has(c.id)) bgBytesCache.set(c.id, fetch(c.bg).then((r) => { if (!r.ok) throw new Error('底圖載入失敗'); return r.arrayBuffer(); }));
    return bgBytesCache.get(c.id);
  }

  // ---------- 資產載入 ----------
  const scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) scriptCache[src] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('載入失敗：' + src));
      document.head.appendChild(s);
    });
    return scriptCache[src];
  }
  async function fetchWithProgress(url, onP) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    const total = +r.headers.get('content-length') || 0;
    if (!r.body || !total) return r.arrayBuffer();
    const reader = r.body.getReader(); const chunks = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); got += value.length; onP && onP(got / total);
    }
    const out = new Uint8Array(got); let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out.buffer;
  }

  async function init() {
    const st = $('fontStatus');
    // 預覽底圖
    previewImg(course());
    try {
      const [fontBuf, cmap] = await Promise.all([
        fetchWithProgress('assets/font.ttf', (p) => { st.textContent = `字型載入中 ${Math.round(p * 100)}%`; }),
        fetch('assets/cmap.json').then((r) => r.json()),
      ]);
      assets.fontBytes = fontBuf;
      const set = new Set();
      for (const [a, b] of cmap) for (let c = a; c <= b; c++) set.add(c);
      assets.cmap = set;
      const ff = new FontFace(L.FONT, fontBuf);
      await ff.load(); document.fonts.add(ff);
      L.measureMetrics();
      state.ready = true;
      st.textContent = '✓ 王漢宗特明體 已就緒'; st.className = 'status ready';
      schedulePreview();
      // 閒置時預先載入 PDF 模組與高解析底圖，按下輸出時可立即開始
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 800));
      idle(() => {
        loadScript('vendor/pdf-lib.min.js'); loadScript('vendor/fontkit.umd.min.js');
        bgBytesFor(course()).catch(() => {});
      });
    } catch (e) {
      console.error(e);
      st.textContent = '字型載入失敗，請重新整理'; st.className = 'status error';
    }
  }

  // ---------- 資料 ----------
  const common = () => ({
    unit: $('unitInput').value.trim(),
    period: $('periodInput').value.trim(),
    course: $('courseInput').value.trim(),
    issue: $('issueInput').value.trim(),
  });
  function rows() {
    if (state.source === 'file') return state.fileRecords;
    return state.manualNames.map((name) => ({ name }));
  }
  function pick(rowVal, commonVal) {
    const v = rowVal == null ? '' : rowVal;
    return (v instanceof Date || typeof v === 'number' || String(v).trim() !== '') ? v : commonVal;
  }
  function record(i) {
    const c = common(); const r = rows()[i] || { name: '' }; const cs = course();
    const period = D.parsePeriod(pick(r.period, c.period));
    const issue = D.parseDate(pick(r.issue, c.issue));
    return {
      name: String(r.name || ''),
      unit: String(pick(r.unit, c.unit) || '').trim(),
      course: cs.course || String(pick(r.course, c.course) || '').trim(),
      period, periodText: D.periodText(period, cs.period), issue,
      rawPeriod: pick(r.period, c.period), rawIssue: pick(r.issue, c.issue),
    };
  }
  function problems(rec) {
    const p = [];
    const cs = course();
    if (!rec.unit && cs.unit) p.push('單位名稱未填');
    if (!rec.course) p.push('課程名稱未填');
    if (!rec.period) p.push(rec.rawPeriod ? '授課期程格式無法辨識' : '授課期程未填');
    if (!rec.issue) p.push(rec.rawIssue ? '發證日期格式無法辨識' : '發證日期未填');
    if (state.ready && assets.cmap) {
      const miss = [...new Set([...(rec.name + rec.unit + rec.course)].filter((ch) => ch.trim() && !assets.cmap.has(ch.codePointAt(0))))];
      if (miss.length) p.push(`「${miss.join('、')}」字型無此字，將以系統明體替代顯示`);
    }
    return p;
  }

  // ---------- 預覽 ----------
  let rafId = 0;
  function schedulePreview() { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(renderPreview); }
  function renderPreview() {
    const cv = $('preview');
    const cssW = cv.clientWidth || 800;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.min(Math.round(cssW * dpr), 2000);
    const cs = course();
    const h = Math.round(w * cs.H / cs.W);
    cv.style.aspectRatio = `${cs.W} / ${cs.H}`;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    const bgi = previewImg(cs);
    if (bgi.complete && bgi.naturalWidth) c.drawImage(bgi, 0, 0, w, h);
    const list = rows();
    const n = list.length;
    if (state.current >= n) state.current = Math.max(0, n - 1);
    const rec = n ? record(state.current) : { ...record(-1), name: '' };
    if (!n) rec.name = '';
    if (state.ready) L.drawGlyphs(c, L.layoutCertificate(rec, cs), w / cs.W);
    $('pvIndex').textContent = n ? `${state.current + 1} / ${n}` : '0 / 0';
    $('previewWho').textContent = n ? `— ${rec.name}` : '— 尚未輸入學生';
    const warns = n ? problems(rec) : ['請先輸入或匯入學生姓名'];
    $('warnings').innerHTML = warns.map((t) => `<li>⚠︎ ${esc(t)}</li>`).join('');
    highlightList();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 名單 ----------
  function renderList() {
    const list = rows();
    $('listCount').textContent = list.length;
    $('namesCount').textContent = state.manualNames.length;
    $('studentList').innerHTML = list.map((r, i) => {
      const bad = problems(record(i)).length ? ' warn' : '';
      return `<li data-i="${i}" class="${bad}"><span class="n">${i + 1}</span><span class="nm">${esc(r.name)}</span><button type="button" class="dl" data-dl="${i}" title="下載此位的 PDF">PDF</button></li>`;
    }).join('');
    schedulePreview();
  }
  function highlightList() {
    for (const li of $('studentList').children) li.classList.toggle('active', +li.dataset.i === state.current);
  }

  // ---------- 輸出 ----------
  const fileBase = (rec) => ['結業證書', D.safeName(rec.unit), D.safeName(rec.course || course().short)].filter(Boolean).join('_');

  async function ensurePdfReady() {
    if (!state.ready) throw new Error('字型尚未載入完成，請稍候');
    await Promise.all([loadScript('vendor/pdf-lib.min.js'), loadScript('vendor/fontkit.umd.min.js')]);
    P.setAssets(assets);
    return bgBytesFor(course());
  }

  function showProgress(text, ratio) {
    $('progress').classList.remove('hidden');
    $('progText').textContent = text;
    $('progBar').style.width = Math.round((ratio || 0) * 100) + '%';
  }
  const hideProgress = () => $('progress').classList.add('hidden');
  const tick = () => new Promise((r) => setTimeout(r, 0));

  let lastUrl = null;
  function deliver(blob, filename) {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = lastUrl; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    const box = $('lastFile');
    const canShare = navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] });
    box.innerHTML = `✓ 已產生：<b>${esc(filename)}</b>（${(blob.size / 1048576).toFixed(1)} MB）
      <a class="btn ghost small" href="${lastUrl}" download="${esc(filename)}">再次下載</a>
      ${canShare ? '<button type="button" class="btn ghost small" id="shareBtn">分享 / 存到檔案</button>' : ''}`;
    box.classList.remove('hidden');
    const sb = $('shareBtn');
    if (sb) sb.onclick = () => navigator.share({ files: [new File([blob], filename, { type: blob.type })], title: filename }).catch(() => {});
  }

  async function run(job) {
    if (state.busy) return;
    state.busy = true; state.cancel = false;
    try { await job(); }
    catch (e) { if (e.message !== 'cancel') { console.error(e); alert('產生失敗：' + e.message); } }
    finally { state.busy = false; hideProgress(); }
  }

  function checkAll(indexes) {
    const bad = indexes.map((i) => [i, problems(record(i)).filter((p) => !p.includes('替代'))]).filter(([, p]) => p.length);
    if (!bad.length) return true;
    const msg = bad.slice(0, 5).map(([i, p]) => `${record(i).name}：${p.join('、')}`).join('\n');
    return confirm(`以下資料不完整，仍要繼續輸出嗎？\n\n${msg}${bad.length > 5 ? `\n…等 ${bad.length} 筆` : ''}`);
  }

  function exportSingle(i) {
    const n = rows().length;
    if (!n) return alert('請先輸入學生姓名');
    if (!checkAll([i])) return;
    run(async () => {
      showProgress('準備中…', 0.1);
      const bgB = await ensurePdfReady(); const cs = course();
      const rec = record(i);
      showProgress(`產生 ${rec.name} 的證書…`, 0.5); await tick();
      const bytes = await P.buildDoc([L.layoutCertificate(rec, cs)], cs, bgB);
      deliver(new Blob([bytes], { type: 'application/pdf' }), `${fileBase(rec)}_${D.safeName(rec.name)}.pdf`);
    });
  }

  function exportMerged() {
    const n = rows().length;
    if (!n) return alert('請先輸入學生姓名');
    const idx = [...Array(n).keys()];
    if (!checkAll(idx)) return;
    run(async () => {
      showProgress('準備中…', 0.02);
      const bgB = await ensurePdfReady(); const cs = course();
      const pages = idx.map((i) => L.layoutCertificate(record(i), cs));
      const bytes = await P.buildDoc(pages, cs, bgB, async (p) => {
        if (state.cancel) throw new Error('cancel');
        if (p % 3 === 0) { showProgress(`排版中 ${p + 1} / ${n}`, (p + 1) / n * 0.9); await tick(); }
      });
      showProgress('完成，下載中…', 1);
      const first = record(0);
      const who = n === 1 ? D.safeName(first.name) : `${D.safeName(first.name)}等${n}人`;
      deliver(new Blob([bytes], { type: 'application/pdf' }), `${fileBase(first)}_${who}.pdf`);
    });
  }

  function exportZip() {
    const n = rows().length;
    if (!n) return alert('請先輸入學生姓名');
    const idx = [...Array(n).keys()];
    if (!checkAll(idx)) return;
    run(async () => {
      showProgress('準備中…', 0.02);
      const [bgB] = await Promise.all([ensurePdfReady(), loadScript('vendor/jszip.min.js')]); const cs = course();
      const zip = new JSZip();
      const used = new Set();
      for (const i of idx) {
        if (state.cancel) throw new Error('cancel');
        const rec = record(i);
        showProgress(`產生 ${i + 1} / ${n}：${rec.name}`, i / n * 0.92); await tick();
        const bytes = await P.buildDoc([L.layoutCertificate(rec, cs)], cs, bgB);
        let fn = `${fileBase(rec)}_${D.safeName(rec.name)}`;
        let k = 2; while (used.has(fn)) fn = `${fileBase(rec)}_${D.safeName(rec.name)}(${k++})`;
        used.add(fn);
        zip.file(fn + '.pdf', bytes);
      }
      showProgress('壓縮中…', 0.96); await tick();
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const first = record(0);
      deliver(blob, `${fileBase(first)}_共${n}人.zip`);
    });
  }

  // ---------- 範本 ----------
  const TEMPLATE_ROWS = [
    ['姓名', '單位名稱', '授課期程', '課程名稱', '發證日期'],
    ['王小明', '喵喵國小', '115/3/1~115/6/30', 'Minecraft 程式設計進階班', '115/6/30'],
    ['陳美美', '', '', '', ''],
    ['林大同', '', '', '', ''],
  ];
  function downloadCsvTemplate() {
    const csv = '﻿' + TEMPLATE_ROWS.map((r) => r.map((c) => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\r\n');
    deliver(new Blob([csv], { type: 'text/csv;charset=utf-8' }), '結業證書_匯入範本.csv');
  }
  async function downloadXlsxTemplate() {
    await loadScript('vendor/xlsx.full.min.js');
    const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
    ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 12 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '學生名單');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    deliver(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), '結業證書_匯入範本.xlsx');
  }

  async function importFile(file) {
    const info = $('fileInfo');
    info.textContent = '讀取中…';
    try {
      await loadScript('vendor/xlsx.full.min.js');
      const { records, cols } = await D.readTable(file);
      state.fileRecords = records; state.fileName = file.name; state.current = 0;
      // 檔案中若只有一種值，也帶入共用欄位方便檢視/修改
      const fill = (key, inputId, fmt) => {
        const vals = [...new Set(records.map((r) => r[key]).filter((v) => v !== '' && v != null).map((v) => fmt ? fmt(v) : String(v).trim()))];
        if (vals.length >= 1 && !$(inputId).value.trim()) $(inputId).value = vals[0];
      };
      fill('unit', 'unitInput');
      fill('course', 'courseInput');
      fill('period', 'periodInput', (v) => { const p = D.parsePeriod(v); return p ? `${p.from.y}/${p.from.m}/${p.from.d}~${p.to.y}/${p.to.m}/${p.to.d}` : String(v); });
      fill('issue', 'issueInput', (v) => { const d = D.parseDate(v); return d ? `${d.y}/${d.m}/${d.d}` : String(v); });
      updateParsed();
      const named = { name: '姓名', unit: '單位名稱', period: '授課期程', course: '課程名稱', issue: '發證日期' };
      info.innerHTML = `✓ <b>${esc(file.name)}</b>：${records.length} 位學生；讀到欄位：${cols.map((c) => named[c]).join('、')}<br>檔案中空白的欄位會使用下方「課程資料」。`;
      renderList();
    } catch (e) {
      console.error(e);
      info.textContent = '讀取失敗：' + e.message;
    }
  }

  // ---------- 說明視窗 ----------
  const HELP = {
    names: { t: '學生姓名填寫說明', b: `<p>一次可輸入多位學生，每行一位最清楚：</p><pre>王小明\n陳美美\n林大同</pre><p>也可用逗號、頓號或空白分隔：</p><pre>王小明、陳美美、林大同</pre><ul><li>姓名 2～3 字會自動拉開字距；4 字以上（含外籍姓名）自動縮小字級。</li><li>罕用字若字型沒有，會以系統明體補字並提示。</li></ul>`, ex: () => { $('namesInput').value = '王小明\n陳美美\n林大同\n歐陽小琪'; onNames(); } },
    unit: { t: '單位名稱填寫說明', b: `<p>顯示在 Minecraft 標誌右側綠色框內（白字）。</p><pre>喵喵國小</pre><pre>喵星人程式補習班</pre><p>字數多時會自動縮小以放入綠框。</p>`, ex: () => { $('unitInput').value = '喵喵國小'; onCommon(); } },
    period: { t: '授課期程填寫說明', b: `<p>同一批學生共用。可用民國或西元，以下寫法皆可：</p><pre>115/3/1~115/6/30\n115.3.1-115.6.30\n115年3月1日至115年6月30日\n115/3/1~6/30（同年可省略）\n2026/3/1~2026/6/30</pre><p>證書上統一印成：<br><b>民國115年3月1日～民國115年6月30日</b></p>`, ex: () => { $('periodInput').value = '115/3/1~115/6/30'; onCommon(); } },
    course: { t: '課程名稱填寫說明', get b() { const cs = course(); return cs.course ? `<p>「${esc(cs.label)}」證書的課程名稱已固定寫在內文中：</p><pre>${esc(cs.course)}</pre><p>不需填寫。若要改套其他課程名稱，請在上方切換證書種類。</p>` : `<p>會套印在內文中，內文會依名稱長短自動換行、左右對齊。</p><pre>${esc((cs.sample && cs.sample.course) || 'Minecraft 程式設計進階班')}</pre>`; }, ex: () => { const cs = course(); if (!cs.course) { $('courseInput').value = (cs.sample && cs.sample.course) || ''; onCommon(); } } },
    issue: { t: '發證日期填寫說明', b: `<p>印在理事長簽名下方。民國或西元皆可：</p><pre>115/6/30\n115年6月30日\n2026-06-30</pre><p>證書上印成：<b>民國115年6月30日</b>；按「今天」可快速帶入今日日期。</p>`, ex: () => { $('issueInput').value = '115/6/30'; onCommon(); } },
    file: { t: 'CSV / Excel 檔案格式', b: `<p>第一列為欄位名稱，只有「姓名」必填：</p><table><tr><th>姓名</th><th>單位名稱</th><th>授課期程</th><th>課程名稱</th><th>發證日期</th></tr><tr><td>王小明</td><td>喵喵國小</td><td>115/3/1~115/6/30</td><td>Minecraft 進階班</td><td>115/6/30</td></tr><tr><td>陳美美</td><td></td><td></td><td></td><td></td></tr></table><ul><li>其他欄位留空，會使用畫面上「課程資料」的共用值。</li><li>若某位學生需要不同課程或日期，就在那一列填寫即可覆蓋。</li><li>支援 .csv（UTF-8 或 Big5）、.xlsx、.xls。</li><li>沒有欄位名稱時，第一欄視為姓名。</li></ul>` },
  };
  let helpKey = null;
  function openHelp(key) {
    const h = HELP[key]; if (!h) return;
    helpKey = key;
    $('helpTitle').textContent = h.t; $('helpBody').innerHTML = h.b;
    $('helpApply').classList.toggle('hidden', !h.ex);
    const dlg = $('helpDlg');
    if (dlg.showModal) dlg.showModal(); else alert(h.t);
  }

  // ---------- 事件 ----------
  function updateParsed() {
    const pp = $('periodParsed'), ip = $('issueParsed');
    const pv = $('periodInput').value.trim(), iv = $('issueInput').value.trim();
    const p = D.parsePeriod(pv), d = D.parseDate(iv);
    pp.textContent = pv ? (p ? '→ ' + D.periodText(p, course().period) : '⚠︎ 無法辨識，請參考 ? 說明') : '';
    pp.className = 'hint parsed ' + (pv ? (p ? 'ok' : 'bad') : '');
    ip.textContent = iv ? (d ? '→ ' + D.rocText(d) : '⚠︎ 無法辨識，請參考 ? 說明') : '';
    ip.className = 'hint parsed ' + (iv ? (d ? 'ok' : 'bad') : '');
  }
  let listTimer = 0;
  function onCommon() {
    const cs = course(); if (cs.unit && cs.unit.tpl) $('unitHint').textContent = `會印成「${cs.unit.tpl.replace('{unit}', $('unitInput').value.trim() || 'XX國小')}」`;
    updateParsed(); schedulePreview(); clearTimeout(listTimer); listTimer = setTimeout(renderList, 250); saveDraft(); }
  function onNames() {
    state.manualNames = D.parseNames($('namesInput').value);
    clearTimeout(listTimer); listTimer = setTimeout(renderList, 120);
    $('namesCount').textContent = state.manualNames.length;
    saveDraft();
  }

  // 草稿暫存（僅存在本機瀏覽器）
  const DRAFT_KEY = 'cert-draft-v1';
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        names: $('namesInput').value, unit: $('unitInput').value, period: $('periodInput').value,
        course: $('courseInput').disabled ? ($('courseInput').dataset.user || '') : $('courseInput').value, issue: $('issueInput').value,
      }));
    } catch (e) { /* 忽略 */ }
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (!d) return;
      $('namesInput').value = d.names || ''; $('unitInput').value = d.unit || ''; $('periodInput').value = d.period || '';
      $('courseInput').value = d.course || ''; $('issueInput').value = d.issue || '';
    } catch (e) { /* 忽略 */ }
  }

  // ---------- 證書種類 ----------
  function applyCourse() {
    const cs = course();
    $('courseSelect').value = cs.id;
    const ci = $('courseInput');
    if (cs.course) {
      if (!ci.disabled) ci.dataset.user = ci.value;
      ci.value = cs.course; ci.disabled = true;
      $('courseHint').textContent = '此證書的課程名稱已固定，不需填寫';
    } else {
      if (ci.disabled) ci.value = ci.dataset.user || '';
      ci.disabled = false;
      ci.placeholder = '例：' + ((cs.sample && cs.sample.course) || '');
      $('courseHint').textContent = '';
    }
    $('unitLabel').textContent = cs.unitLabel || '單位名稱';
    $('unitHint').textContent = !cs.unit ? '此證書不印單位名稱（只用於檔名）'
      : cs.unit.tpl ? `會印成「${cs.unit.tpl.replace('{unit}', $('unitInput').value.trim() || 'XX國小')}」` : '';
    updateParsed();
    renderList();
  }
  function setCourse(id) {
    state.courseId = window.getCourse(id).id;
    try { localStorage.setItem(COURSE_KEY, state.courseId); } catch (e) { /* 忽略 */ }
    previewImg(course());
    applyCourse();
    if (state.ready) { const idle = window.requestIdleCallback || ((f) => setTimeout(f, 500)); idle(() => bgBytesFor(course()).catch(() => {})); }
  }

  function setTab(t) {
    state.source = t; state.current = 0;
    document.querySelectorAll('.tab').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $('pane-manual').classList.toggle('hidden', t !== 'manual');
    $('pane-file').classList.toggle('hidden', t !== 'file');
    if (t === 'file') loadScript('vendor/xlsx.full.min.js').catch(() => {});
    renderList();
  }

  function bind() {
    const sel = $('courseSelect');
    sel.innerHTML = window.CERT_COURSES.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
    sel.addEventListener('change', () => setCourse(sel.value));
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('namesInput').addEventListener('input', onNames);
    ['unitInput', 'periodInput', 'courseInput', 'issueInput'].forEach((id) => $(id).addEventListener('input', onCommon));
    $('todayBtn').onclick = () => { const t = new Date(); $('issueInput').value = `${t.getFullYear() - 1911}/${t.getMonth() + 1}/${t.getDate()}`; onCommon(); };
    document.querySelectorAll('.help').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openHelp(b.dataset.help); }));
    $('helpApply').onclick = () => { const h = HELP[helpKey]; h && h.ex && h.ex(); $('helpDlg').close(); };
    $('fileInput').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
    const dz = $('dropzone');
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) importFile(f); });
    $('tplCsv').onclick = downloadCsvTemplate;
    $('tplXlsx').onclick = () => downloadXlsxTemplate().catch((e) => alert(e.message));
    $('prevBtn').onclick = () => { const n = rows().length; if (n) { state.current = (state.current - 1 + n) % n; schedulePreview(); } };
    $('nextBtn').onclick = () => { const n = rows().length; if (n) { state.current = (state.current + 1) % n; schedulePreview(); } };
    $('studentList').addEventListener('click', (e) => {
      const dl = e.target.closest('[data-dl]');
      if (dl) { exportSingle(+dl.dataset.dl); return; }
      const li = e.target.closest('li'); if (li) { state.current = +li.dataset.i; schedulePreview(); }
    });
    $('btnSingle').onclick = () => exportSingle(state.current);
    $('btnMerged').onclick = exportMerged;
    $('btnZip').onclick = exportZip;
    $('progCancel').onclick = () => { state.cancel = true; $('progText').textContent = '取消中…'; };
    let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(schedulePreview, 120); });
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input,textarea')) return;
      if (e.key === 'ArrowLeft') $('prevBtn').click();
      if (e.key === 'ArrowRight') $('nextBtn').click();
    });
  }

  loadDraft();
  bind();
  state.manualNames = D.parseNames($('namesInput').value);
  applyCourse();
  init();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  window.__certApp = { state, record, exportMerged, exportSingle, exportZip };
})();
