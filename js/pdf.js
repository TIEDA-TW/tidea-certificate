/* PDF 產生：pdf-lib + 字型子集嵌入（文字為向量、檔案小、列印清晰）
 * 底圖每份 PDF 只嵌入一次，多頁共用。A4 橫式，底圖等比例填滿（裁切極少量邊緣）。 */
(function (global) {
  'use strict';
  const { FALLBACK } = global.CertLayout;
  const PAGE_W = 841.89, PAGE_H = 595.28;

  let assets = null;      // {fontBytes, cmap:Set}
  let fkFont = null;      // 快取已解析的字型，避免每份 PDF 重新解析 9MB 字型

  const fontkitCached = {
    create(bytes) {
      if (!fkFont) fkFont = global.fontkit.create(bytes);
      return fkFont;
    },
  };

  function setAssets(a) { assets = a; }
  const hasGlyph = (ch) => assets.cmap.has(ch.codePointAt(0));
  const hexRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return global.PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };

  function fallbackPng(ch, sizePt, color) {
    const px = Math.ceil(sizePt * 4); // ~288dpi
    const c = document.createElement('canvas');
    c.width = Math.ceil(px * 1.2); c.height = Math.ceil(px * 1.3);
    const x = c.getContext('2d');
    x.font = `${px}px ${FALLBACK}`; x.fillStyle = color; x.textBaseline = 'alphabetic';
    x.fillText(ch, 0, px);
    return { url: c.toDataURL('image/png'), w: c.width / 4, h: c.height / 4, base: px / 4 };
  }

  // pages: 每頁的 glyph 陣列；course: 課程設定；bgBytes: 該課程底圖 JPG
  async function buildDoc(pages, course, bgBytes, onPage) {
    const { PDFDocument } = global.PDFLib;
    const K = Math.max(PAGE_W / course.W, PAGE_H / course.H);
    const offX = (course.W * K - PAGE_W) / 2, offY = (course.H * K - PAGE_H) / 2;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkitCached);
    doc.setTitle('結業證書 ' + course.short); doc.setCreator('結業證書套印平台'); doc.setProducer('pdf-lib');
    const font = await doc.embedFont(assets.fontBytes, { subset: true });
    const bg = await doc.embedJpg(bgBytes);
    const imgCache = new Map(), colCache = new Map();
    const col = (h) => { let c = colCache.get(h); if (!c) { c = hexRgb(h); colCache.set(h, c); } return c; };

    for (let i = 0; i < pages.length; i++) {
      const page = doc.addPage([PAGE_W, PAGE_H]);
      page.drawImage(bg, { x: -offX, y: -offY, width: course.W * K, height: course.H * K });
      for (const g of pages[i]) {
        const size = g.size * K;
        const x = g.x * K - offX;
        const y = PAGE_H + offY - g.y * K;
        if (hasGlyph(g.ch)) {
          page.drawText(g.ch, { x, y, size, font, color: col(g.color) });
        } else {
          const key = g.ch + '|' + g.color + '|' + size.toFixed(2);
          let im = imgCache.get(key);
          if (!im) {
            const f = fallbackPng(g.ch, size, g.color);
            im = { img: await doc.embedPng(f.url), ...f };
            imgCache.set(key, im);
          }
          page.drawImage(im.img, { x, y: y - (im.h - im.base), width: im.w, height: im.h });
        }
      }
      if (onPage) await onPage(i);
    }
    return doc.save({ useObjectStreams: true });
  }

  global.CertPDF = { setAssets, buildDoc, hasGlyph: (ch) => assets && hasGlyph(ch) };
})(window);
