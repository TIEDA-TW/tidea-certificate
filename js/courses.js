/* 各課程證書版面設定（座標皆為該課程底圖的原始像素）
 *
 * name   : 學生姓名（cx 水平中心、cy 視覺中心、size 字級、maxW 可用寬度）
 * unit   : 單位名稱（pill=綠框內有字距；inline=姓名左側）；tpl 可加固定字，如 '{unit}程式課程'
 * body   : 內文。tpl 中 {period} {course} 會被替換；align: justify(左右對齊) / center(置中)
 * issue  : 發證日期。fmt: roc(民國115年6月30日) / ymd(115年6月30日) / full(中華民國115年06月30日)
 *          / spread(中 華 民 國 115 年 06 月 30 日 平均分散於 x0~x1) / spreadChars(每個字都分散)
 * period : 授課期程格式。style: cjk(115年3月1日) / slash(115/3/1)；pad 補零；sep 分隔；yr2 第二個日期是否寫年份
 * course : 固定課程名稱（有此值時「課程名稱」欄位不可修改，內文已含課程名）
 */
(function (global) {
  'use strict';
  const B = '#000000', Wt = '#ffffff';

  const COURSES = [
    {
      id: 'minecraft', label: '麥塊課程（Minecraft Education）', short: '麥塊課程',
      W: 3627, H: 2599, ink: B,
      unit: { type: 'pill', cx: 2190, cy: 456, maxW: 880, size: 92, color: Wt },
      name: { cx: 1890, cy: 1045, maxW: 1240, size: 220, ls2: 1.0, ls3: 0.55 },
      body: { left: 453, right: 3167, maxLines: 3, baseline1: 1474, size: 85, lineGap: 1.435, indent: 2, periodGap: 0.3,
        tpl: '於{period}完成「{course}」學習課程，學會更深入的程式編程，具備挑戰微軟邁客盃大賽的程式素養，期待同學繼續加油，創造更精進的程式設計。' },
      issue: { fmt: 'roc', cx: 2000, baseline: 2296, size: 72, ls: 0.18 },
      period: { style: 'cjk', pad: false, sep: '～', yr2: true, prefix: '民國' },
      sample: { course: 'Minecraft 程式設計進階班' },
    },
    {
      id: 'jr', label: '妙妙貓 ScratchJr 課程', short: 'ScratchJr課程',
      W: 3579, H: 2553, ink: B,
      unit: { type: 'pill', cx: 1683, cy: 486, maxW: 900, size: 98, color: Wt },
      name: { cx: 1300, cy: 1150, maxW: 1050, size: 220 },
      body: { left: 268, right: 2372, baseline1: 1482, size: 80, lineGap: 1.41, indent: 2,
        tpl: '於{period}完成「{course}」程式課程，學會了序列、迴圈、除錯...等程式編碼，完成人生第一堂程式課的遊戲設計，期待同學繼續努力探究程式奧秘，迎接AI時代的挑戰。' },
      issue: { fmt: 'spread', x0: 286, x1: 1664, baseline: 2397, size: 70 },
      period: { style: 'slash', pad: false, sep: '～', yr2: true },
      sample: { course: '妙妙貓愛上ScratchJr大冒險' },
    },
    {
      id: 'xiaoq', label: '妙妙貓與小Q機器人', short: '妙妙貓與小Q',
      W: 3508, H: 2481, ink: B,
      name: { cx: 1230, cy: 1138, maxW: 1000, size: 200 },
      body: { left: 383, right: 2130, baseline1: 1415, size: 78, lineGap: 1.47, indent: 2,
        tpl: '{period}完成「妙妙貓與小Q程式課程」，學會了序列、迴圈、除錯...等程式編碼，完成人生第一堂程式課的遊戲設計，期待同學繼續努力探究程式奧秘，迎接AI時代的挑戰。' },
      issue: { fmt: 'spread', x0: 300, x1: 1644, baseline: 2346, size: 60 },
      period: { style: 'cjk', pad: true, sep: '-', yr2: false },
      course: '妙妙貓與小Q程式課程',
    },
    {
      id: 'kibo', label: 'KIBO 積寶機器貓闖天關', short: 'KIBO積寶機器貓',
      W: 3579, H: 2553, ink: B,
      unit: { type: 'inline', cx: 1072, cy: 1112, maxW: 660, size: 105 },
      name: { cx: 1810, cy: 1075, maxW: 700, size: 175 },
      unitLabel: '學校／幼兒園',
      body: { left: 377, right: 3130, maxLines: 3, baseline1: 1344, size: 86, lineGap: 1.29, indent: 2.5,
        tpl: '於{period}，完成{course}程式語言學習課程，學會了雙迴圈、隨機取數、副程式等進階程式編碼來指揮KIBO完成專案遊戲。迎接AI時代的挑戰，期待寶貝繼續探究KIBO的奧秘！' },
      issue: { fmt: 'ymd', pad: true, cx: 2757, baseline: 2005, size: 72, ls: 0 },
      period: { style: 'slash', pad: true, sep: '-', yr2: true },
      sample: { course: 'KIBO積寶機器貓闖天關B冊' },
    },
    {
      id: 'roblox', label: 'Roblox 機器磚塊', short: 'Roblox機器磚塊',
      W: 3579, H: 2552, ink: Wt,
      unit: { type: 'inline', cx: 850, cy: 1330, maxW: 600, size: 115 },
      name: { cx: 1790, cy: 1288, maxW: 880, size: 200 },
      body: { left: 308, right: 3223, maxLines: 3, baseline1: 1519, size: 78, lineGap: 1.14, indent: 1.6,
        tpl: '於{period}完成【{course}】學習，學會了迴圈、變數、跑酷關卡設計與3D建模等程式邏輯，期待同學繼續努力探究程式奧秘，迎接AI時代的挑戰！' },
      issue: { fmt: 'ymd', pad: false, cx: 2581, baseline: 1990, size: 64, ls: 0.15 },
      period: { style: 'cjk', pad: false, sep: '至', yr2: true },
      sample: { course: 'Roblox與微軟Copilot生成式AI遊戲設計營' },
    },
    {
      id: 'kody', label: '科迪遊戲國', short: '科迪遊戲國',
      W: 3580, H: 2552, ink: B,
      unit: { type: 'inline', cx: 850, cy: 1330, maxW: 600, size: 115 },
      name: { cx: 1790, cy: 1288, maxW: 880, size: 200 },
      body: { left: 315, right: 3247, maxLines: 3, baseline1: 1519, size: 78, lineGap: 1.14, indent: 1.6,
        tpl: '於{period}完成了【{course}】學習，學會了事件、序列、迴圈等程式概念與基本感應器運用，期待同學繼續努力探究程式奧秘，迎接AI時代的挑戰！' },
      issue: { fmt: 'ymd', pad: false, cx: 2556, baseline: 2019, size: 64, ls: 0.12 },
      period: { style: 'cjk', pad: false, sep: '至', yr2: true },
      sample: { course: '科迪闖天關' },
    },
    {
      id: 'octo', label: '章魚 AI 遊戲設計營（OctoStudio）', short: '章魚AI遊戲設計營',
      W: 3509, H: 2482, ink: Wt,
      unit: { type: 'pill', cx: 2111, cy: 640, maxW: 860, size: 90, color: '#5b1d8f' },
      name: { cx: 1750, cy: 1178, maxW: 1000, size: 195 },
      body: { left: 585, right: 2843, baseline1: 1423, size: 63, lineGap: 1.79, indent: 2.5,
        tpl: '於{period}完成「{course}」程式課程，學會了錄音、繪畫、程式編輯器等程式編碼，來完成自己的遊戲設計，創作出栩栩如生的動畫，以及刺激有趣的多人遊戲，期待同學繼續努力探究程式奧秘，創造更精進的程式設計。' },
      issue: { fmt: 'spread', x0: 240, x1: 1322, baseline: 2208, size: 58 },
      period: { style: 'cjk', pad: true, sep: '～', yr2: true },
      sample: { course: '章魚AI遊戲設計營' },
    },
    {
      id: 'esl', label: '美國小學 ESL 美語', short: 'ESL美語',
      W: 3551, H: 2523, ink: B,
      name: { cx: 1740, cy: 831, maxW: 1000, size: 200 },
      body: { left: 411, right: 3089, baseline1: 1249, size: 78, lineGap: 1.47, indent: 2,
        tpl: '於{period}完成「{course}」之學習課程，學會以ELLIS Essentials多媒體兒童美語教學系統，建立學習美語的興趣和自信。期盼未來的日子裡，同學能繼續探究美語的趣味，順利銜接雙語生活、與世界接軌。' },
      issue: { fmt: 'spread', x0: 274, x1: 1618, baseline: 2350, size: 60 },
      period: { style: 'cjk', pad: true, sep: '～', yr2: true },
      sample: { course: '美國小學ESL美語村基礎字彙班' },
    },
    {
      id: 'pandacat', label: '胖達貓遊戲國（mTiny）', short: '胖達貓遊戲國',
      W: 3627, H: 2600, ink: B,
      unit: { type: 'pill', cx: 2189, cy: 452, maxW: 900, size: 90, color: Wt, tpl: '{unit}程式課程' },
      name: { cx: 1850, cy: 1050, maxW: 1100, size: 230 },
      body: { left: 453, right: 3166, maxLines: 3, baseline1: 1475, size: 85, lineGap: 1.45, indent: 2,
        tpl: '於{period}恭喜寶貝完成mTina胖達貓遊戲國程式課程，學會用迴圈指令、重複指令、音樂卡、表情卡來設計程式，指揮mTina胖達貓完成專案遊戲。期待寶貝繼續努力，迎接AI時代的挑戰。' },
      issue: { fmt: 'spreadChars', x0: 1111, x1: 2513, baseline: 2281, size: 64 },
      period: { style: 'cjk', pad: true, sep: '～', yr2: true },
      course: 'mTina胖達貓遊戲國程式課程',
    },
    {
      id: 'mc-gpt', label: '麥塊AI程式 ChatGPT+Farmcraft 冒險營', short: '麥塊AI程式ChatGPT冒險營',
      W: 3580, H: 2552, ink: B,
      name: { cx: 1790, cy: 1219, maxW: 1100, size: 190 },
      body: { left: 635, right: 2965, baseline1: 1652, size: 86, lineGap: 1.17, align: 'center',
        tpl: '於{period}完成「麥塊AI程式ChatGPT+Farmcraft課程」課程，學會了AI程式機器人、指令方塊等程式編碼，來完成自己的遊戲設計期待同學繼續努力探究程式奧秘，迎接AI時代的挑戰！' },
      issue: { fmt: 'full', pad: true, cx: 2955, baseline: 2400, size: 50, ls: 0.06, color: Wt },
      period: { style: 'cjk', pad: true, sep: '至', yr2: false },
      course: '麥塊AI程式ChatGPT+Farmcraft課程',
    },
    {
      id: 'mc-science', label: '麥塊AI科學實驗王', short: '麥塊AI科學實驗王',
      W: 3580, H: 2552, ink: B,
      name: { cx: 1788, cy: 1046, maxW: 1100, size: 175 },
      body: { left: 762, right: 2820, maxLines: 3, baseline1: 1466, size: 70, lineGap: 1.2, indent: 1.4,
        tpl: '於{period}完成「麥塊AI科學實驗王」課程，積極學習、勇於探索，展現科學創意與解決問題的能力，表現優異，特頒此狀，以茲鼓勵！' },
      issue: { fmt: 'ymd', pad: false, cx: 1042, baseline: 1985, size: 64, ls: 0.15 },
      period: { style: 'cjk', pad: false, sep: '至', yr2: true },
      course: '麥塊AI科學實驗王',
    },
    {
      id: 'mc-redstone', label: '麥塊紅石 ChatGPT 魔法營', short: '麥塊紅石ChatGPT魔法營',
      W: 3580, H: 2552, ink: B,
      name: { cx: 1790, cy: 1054, maxW: 1100, size: 185 },
      body: { left: 611, right: 2930, baseline1: 1484, size: 86, lineGap: 1.2, indent: 2,
        tpl: '於{period}完成「麥塊紅石ChatGPT魔法營」課程，學會了AI程式機器人、指令方塊等程式編碼，來完成自己的遊戲設計期待同學繼續努力探究程式奧秘，迎接AI時代的挑戰！' },
      issue: { fmt: 'full', pad: true, cx: 2955, baseline: 2325, size: 50, ls: 0.06, color: '#fee704' },
      period: { style: 'slash', pad: false, sep: '～', yr2: true },
      course: '麥塊紅石ChatGPT魔法營',
    },
    {
      id: 'mc-sdgs', label: '麥塊SDGs電競爭霸戰', short: '麥塊SDGs電競爭霸戰',
      W: 3509, H: 2482, ink: B,
      name: { cx: 1767, cy: 1000, maxW: 1100, size: 170 },
      body: { left: 707, right: 2910, baseline1: 1412, size: 80, lineGap: 1.18, indent: 2,
        tpl: '於{period}完成「麥塊元SDGs電競爭霸戰」程式課程學習，學會了程式設計、指令方塊等程式編碼，完成自己的遊戲設計，期待同學繼續努力探究程式奧秘，迎接AI時代的挑戰！' },
      issue: { fmt: 'ymd', pad: true, cx: 1036, baseline: 1945, size: 60, ls: 0.06 },
      period: { style: 'cjk', pad: true, sep: '至', yr2: false },
      course: '麥塊元SDGs電競爭霸戰',
    },
  ];

  for (const c of COURSES) {
    c.bg = `assets/courses/${c.id}.jpg`;
    c.preview = `assets/courses/${c.id}-preview.jpg`;
  }
  global.CERT_COURSES = COURSES;
  global.getCourse = (id) => COURSES.find((c) => c.id === id) || COURSES[0];
})(window);
