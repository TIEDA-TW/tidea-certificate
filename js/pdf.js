/* PDF 產生：pdf-lib + 字型子集嵌入（文字為向量、檔案小、列印清晰）
 * 底圖每份 PDF 只嵌入一次，多頁共用。 */
(function (global) {
  'use strict';
  const { W, H, FONT, FALLBACK } = global.CertLayout;
  const PAGE_W = 841.89, PAGE_H = 595.28; // A4 橫式 (pt)
  const K = PAGE_W / W;
  const OFF_Y = (H * K - PAGE_H) / 2;     // 底圖比例略高於 A4，上下各裁約 1.4mm

  let assets = null;      // {fontBytes, bgBytes, cmap:Set}
  let fkFont = null;      // 快取已解析的字型，避免每份 PDF 重新解析 9MB 字型

  const fontkitCached = {
    create(bytes) {
      if (!fkFont) fkFont = global.fontkit.create(bytes);
      return fkFont;
    },
  };

  function setAssets(a) { assets = a; }
  const hasGlyph = (ch) => assets.cmap.has(ch.codePointAt(0));

  function fallbackPng(ch, sizePt, color) {
    const px = Math.ceil(sizePt * 4); // ~288dpi
    const c = document.createElement('canvas');
    c.width = Math.ceil(px * 1.2); c.height = Math.ceil(px * 1.3);
    const x = c.getContext('2d');
    x.font = `${px}px ${FALLBACK}`; x.fillStyle = color; x.textBaseline = 'alphabetic';
    x.fillText(ch, 0, px);
    return { url: c.toDataURL('image/png'), w: c.width / 4, h: c.height / 4, base: px / 4 };
  }

  async function buildDoc(list, onPage) {
    const { PDFDocument, rgb } = global.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkitCached);
    doc.setTitle('結業證書'); doc.setCreator('喵星人證書套印平台'); doc.setProducer('pdf-lib');
    const font = await doc.embedFont(assets.fontBytes, { subset: true });
    const bg = await doc.embedJpg(assets.bgBytes);
    const imgCache = new Map();
    const bw = W * K, bh = H * K;

    for (let i = 0; i < list.length; i++) {
      const glyphs = list[i];
      const page = doc.addPage([PAGE_W, PAGE_H]);
      page.drawImage(bg, { x: 0, y: -OFF_Y, width: bw, height: bh });
      for (const g of glyphs) {
        const size = g.size * K;
        const x = g.x * K;
        const y = PAGE_H + OFF_Y - g.y * K;
        const col = g.color === '#ffffff' ? rgb(1, 1, 1) : rgb(0, 0, 0);
        if (hasGlyph(g.ch)) {
          page.drawText(g.ch, { x, y, size, font, color: col });
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
