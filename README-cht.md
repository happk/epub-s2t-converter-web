# EPUB 簡體字轉繁體字轉換工具

[English](README.md) | **繁體中文** | [简体中文](README-chs.md)



一個純瀏覽器端的 EPUB 與字幕檔案（SRT、ASS、SSA、VTT、LRC、TXT）繁簡轉換工具。所有處理均在本地瀏覽器中完成，不會上傳任何文件。



## 使用方法

> **重要：** 直接以 `file://` 協議開啟 `index.html` 可能會導致部分功能（如拖曳上傳）因瀏覽器安全限制而無法正常運作。請使用本地 HTTP 伺服器啟動。

### 方式 A：使用內建批次腳本（Windows）

雙擊 `start-webui.bat`（或 `start-webui-en.bat` 以英文介面啟動）。腳本會自動偵測 Python 並在 `http://127.0.0.1:8000` 啟動本地伺服器。

### 方式 B：手動啟動

```bash
# Python
python -m http.server 8000

# Node.js (npx)
npx serve .
```

然後在瀏覽器中開啟 `http://127.0.0.1:8000`。



## 致謝

本專案使用以下開源函式庫：

- [**JSZip**](https://stuk.github.io/jszip/) — 用於建立、讀取和編輯 `.zip` 檔案的 JavaScript 函式庫。
  Copyright © 2009–2024 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso. **MIT License**。

- [**opencc-js**](https://github.com/nk2028/opencc-js) — 純 JavaScript 的 OpenCC（開放中文轉換）函式庫，用於中文字符轉換。
  Copyright © The nk2028 Project. **MIT License**。

- [**jschardet**](https://github.com/aadsm/jschardet) — JavaScript 字元編碼自動偵測函式庫。
  Copyright © 2016 António Afonso. **LGPL-2.1+ License**。



## 授權條款

本專案以 [MIT License](LICENSE) 授權發布。