# EPUB Simplified-Traditional Chinese Converter

**English** | [繁體中文](README-cht.md) | [简体中文](README-chs.md)



A browser-based tool for converting EPUB files and subtitle files (SRT, ASS, SSA, VTT, LRC, TXT) between Simplified and Traditional Chinese. All processing runs locally in your browser — no files are uploaded.



## Usage

> **Important:** Opening `index.html` directly via `file://` protocol may cause certain features (e.g., drag-and-drop upload) to malfunction due to browser security restrictions. Please use a local HTTP server instead.

### Option A: Use the provided batch script (Windows)

Double-click `start-webui.bat` (or `start-webui-en.bat` for English console output). The script will auto-detect Python and start a local server at `http://127.0.0.1:8000`.

### Option B: Manual start

```bash
# Python
python -m http.server 8000

# Node.js (npx)
npx serve .
```

Then open `http://127.0.0.1:8000` in your browser.



## Acknowledgements

This project uses the following open-source libraries:

- [**JSZip**](https://stuk.github.io/jszip/) — A JavaScript library for creating, reading, and editing `.zip` files.
  Copyright © 2009–2024 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso. **MIT License**.

- [**opencc-js**](https://github.com/nk2028/opencc-js) — Pure JavaScript OpenCC (Open Chinese Convert) library for Chinese character conversion.
  Copyright © The nk2028 Project. **MIT License**.

- [**jschardet**](https://github.com/aadsm/jschardet) — Character encoding auto-detection for JavaScript.
  Copyright © 2016 António Afonso. **LGPL-2.1+ License**.



## License

This project is released under the [MIT License](LICENSE).