# EPUB 简体字转繁体字转换工具

[English](README.md) | [繁體中文](README-cht.md) | **简体中文**



一个纯浏览器端的 EPUB 与字幕文件（SRT、ASS、SSA、VTT、LRC、TXT）繁简转换工具。所有处理均在本地浏览器中完成，不会上传任何文件。



## 使用方法

> **重要：** 直接以 `file://` 协议打开 `index.html` 可能会导致部分功能（如拖拽上传）因浏览器安全限制而无法正常运作。请使用本地 HTTP 服务器启动。

### 方式 A：使用内置批处理脚本（Windows）

双击 `start-webui.bat`（或 `start-webui-en.bat` 以英文界面启动）。脚本会自动检测 Python 并在 `http://127.0.0.1:8000` 启动本地服务器。

### 方式 B：手动启动

```bash
# Python
python -m http.server 8000

# Node.js (npx)
npx serve .
```

然后在浏览器中打开 `http://127.0.0.1:8000`。



## 致谢

本项目使用以下开源库：

- [**JSZip**](https://stuk.github.io/jszip/) — 用于创建、读取和编辑 `.zip` 文件的 JavaScript 库。
  Copyright © 2009–2024 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso. **MIT License**。

- [**opencc-js**](https://github.com/nk2028/opencc-js) — 纯 JavaScript 的 OpenCC（开放中文转换）库，用于中文字符转换。
  Copyright © The nk2028 Project. **MIT License**。

- [**jschardet**](https://github.com/aadsm/jschardet) — JavaScript 字符编码自动检测库。
  Copyright © 2016 António Afonso. **LGPL-2.1+ License**。



## 授权条款

本项目以 [MIT License](LICENSE) 授权发布。