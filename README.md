# 結業證書套印平台

純前端 PWA，資料不會上傳到任何伺服器。

## 本機測試
Windows：雙擊 `本機測試_啟動.bat`，瀏覽器會開啟 http://localhost:8080/
（需透過伺服器開啟，直接雙擊 index.html 無法載入字型）

## 部署
- GitHub Pages：把本資料夾內容推到 repo，Settings → Pages 選分支即可。
- Netlify：把本資料夾拖曳到 Netlify Drop。

## 檔案
- assets/font.ttf：王漢宗特明體繁
- assets/bg.jpg：證書底圖（PDF 用，高解析）；bg-preview.jpg：預覽用
- js/layout.js：版面座標與排版規則（要微調位置改這裡的 CFG）
