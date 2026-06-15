/**
 * i18n.js - 國際化支援模組（繁體中文 / 簡體中文）
 *
 * 提供語言檢測、文字查詢、語言切換及頁面更新功能。
 * 載入後會暴露 window.i18n 全域物件。
 */
(function () {
    'use strict';

    // ========== 翻譯字典 ==========

    const LANG_KEY = 'epubConverterPreferredLang';
    const SUPPORTED_LANGS = ['zh-TW', 'zh-CN'];
    const DEFAULT_LANG = 'zh-TW';

    const TRANSLATIONS = {
        'zh-TW': {
            // ── Header ──
            'app.title': '📚 EPUB 繁簡轉換工具',
            'app.subtitle': '簡體字 ←→ 繁體字轉換',
            'app.supported_formats': '支援 EPUB、TXT、SRT、VTT、LRC、ASS、SSA 格式',
            'app.privacy_badge': '🔒 本工具完全在用戶瀏覽器運行，不會上傳文件',

            // ── 上傳區 ──
            'upload.drag_text': '拖拽 EPUB、字幕或txt檔案到此處',
            'upload.drag_more': '可繼續拖曳更多檔案至此處（累加）',
            'upload.or_text': '或',
            'upload.select_files': '選擇多個檔案',
            'upload.select_folder': '📁 選擇資料夾',
            'upload.file_count': '已選擇 {count} 個檔案',
            'upload.reselect': '重新選擇',
            'upload.remove': '移除 {name}',
            'upload.file_size_mb': '{size} MB',

            // ── 轉換選項 ──
            'options.rule_title': '1.轉換規則：',
            'options.filename_title': '2.檔名處理：',
            'options.special_title': '3.特殊處理：',

            'options.s2t': 's2t (简体 → 台灣繁體)',
            'options.s2twp': 's2twp (简体 → 台灣繁體 (+慣用詞轉換))',
            'options.s2hk': 's2hk (简体 → 香港繁體)',
            'options.tw2s': 'tw2s (台灣繁體 → 简体)',
            'options.tw2sp': 'tw2sp (台灣繁體 → 简体 (+惯用词转换))',
            'options.hk2s': 'hk2s (香港繁體 → 简体)',

            'options.filename_to_traditional': '轉換為台灣繁體',
            'options.filename_to_simplified': '轉換為簡體',
            'options.filename_none': '不轉換',
            'options.add_suffix': '檔名加上後綴 _convert',
            'options.enable_custom_dict': '啟用自定義字典',
            'options.enable_validate': '啟用 EPUB 結構驗證',
            'options.validate_note': '（取消勾選可加快轉換速度）',

            // ── 字典編輯 ──
            'dict.edit_title': '✏️ 編輯自定義字典',
            'dict.edit_desc': '請遵循 <code>原文,目標</code> 格式，每行一組。以 <code>#</code> 開頭的行會被忽略。',
            'dict.loaded_label': '已載入:',
            'dict.load_csv': '📂 載入字典規則',
            'dict.download_csv': '💾 下載字典規則',
            'dict.load_default': '載入預設範本',
            'dict.close': '關閉',

            // ── 字典說明彈窗 ──
            'dict.help_title': '📖 自定義字典說明',

            // ── 轉換按鈕 & 進度 ──
            'convert.start': '開始批量轉換',
            'convert.download_zip': '📦 下載全部轉換結果 (ZIP)',
            'convert.download_zip_count': '📦 下載全部成功結果 ({count} 個) ZIP',
            'convert.progress_title': '📋 轉換進度',
            'convert.progress_summary': '{completed} / {total} 完成',
            'convert.progress_text': '處理進度：{completed}/{total}',
            'convert.status_idle': '等待中',
            'convert.status_processing': '轉換中...',
            'convert.status_done': '✅ 完成',
            'convert.status_error': '❌ {msg}',
            'convert.download': '下載',
            'convert.prepare_zip': '準備下載zip......',
            'convert.timer_running_label': '已運行',
            'convert.encoding_label': ' 以{enc}讀取{mode}',

            // ── 使用說明 ──
            'info.title': '💡 使用說明',
            'info.step1': '選擇「1.轉換規則」，系統會將檔案內文的簡/繁體字詞進行轉換',
            'info.step2': '設定「2.檔名處理」，決定是否轉換檔名的繁簡、是否加上後綴 <code>_convert</code>',
            'info.step3': '設定「3.特殊處理」，可啟用自定義字典修正特定字詞的轉換 (包含檔名)<br>可使用 <strong>📂 載入字典規則</strong> 將本機的字典檔匯入',
            'info.convert_direction': '支援的轉換方向',
            'info.table_header_setting': '設定',
            'info.table_header_direction': '方向',
            'info.table_row_s2t': '简体 → 台灣繁體',
            'info.table_row_s2twp': '简体 → 台灣繁體 (+慣用詞轉換)',
            'info.table_row_s2hk': '简体 → 香港繁體',
            'info.table_row_tw2s': '台灣繁體 → 简体',
            'info.table_row_tw2sp': '台灣繁體 → 简体 (+惯用词转换)',
            'info.table_row_hk2s': '香港繁體 → 简体',
            'info.warning': '⚠️ 字幕檔案（SRT/ASS/SSA/VTT/LRC）轉換時，自訂字典規則也會套用至純文字內容。若原文或目標包含 <code>--></code>、<code>[時間]</code>、<code>Dialogue:</code> 等格式關鍵字，可能導致字幕結構異常，請謹慎設定。',

            // ── Footer ──
            'footer.version': 'EPUB 繁簡轉換工具 v1.0',
            'footer.copyright_line': '&copy; EPUB 繁簡轉換工具 · <a href="https://github.com/happk/epub-s2t-converter-web" target="_blank" rel="noopener noreferrer">GitHub Repo</a> · by happk',
            'footer.view_log': '📋 檢視運行日誌',

            // ── 報告面板 ──
            'report.title': '📋 轉換報告',
            'report.tab_validation': '📗 結構驗證',
            'report.tab_log': '📝 調試日誌',
            'report.validation_empty': '尚未執行轉換。完成轉換後，EPUB 結構驗證結果會顯示在這裡。',
            'report.log_empty': '無日誌記錄。',
            'report.clear_log': '清除日誌',
            'report.copy_log': '複製日誌',
            'report.close': '關閉',
            'report.log_copied': '日誌已複製到剪貼簿',
            'report.log_copy_failed': '複製日誌失敗',
            'report.log_cleared': '日誌已清除',
            'report.log_no_content': '無日誌內容可複製',

            // ── 字典說明內文 ──
            'dict.help_content_html': `
                <p>本系統採用 <strong>「長詞優先 + 標籤保護」</strong> 技術，確保自定義字典中的字詞具有最高優先權，並避免 opencc-js 的一般轉換干擾。</p>
                <h4>轉換流程：</h4>
                <ol>
                    <li><strong>標籤保護 (Protection)</strong>：依照 custom_dict 中的規則，由長至短搜尋原始文本。匹配到的字詞會先被替換為特殊保護標籤，避免 opencc-js 誤轉。</li>
                    <li><strong>標準轉換 (OpenCC)</strong>：執行您選擇的轉換規則（例如台灣繁體）。此時保護標籤內的內容維持不變。</li>
                    <li><strong>還原字詞 (Restore)</strong>：將保護標籤還原為您在字典中定義的目標繁體字詞。</li>
                </ol>
                <h4>範例：</h4>
                <ul>
                    <li>若設定 <code>吃,吃</code>，則「吃」會保留為「吃」，不會被轉為「喫」。</li>
                    <li>若同時設定 <code>吃茶,喫茶</code>，則「吃茶」會優先轉為「喫茶」，剩餘的「吃」才會套用單字規則。</li>
                </ul>
                <h4>CSV 載入說明：</h4>
                <ul>
                    <li>可使用 <strong>📂 載入字典規則</strong> 將本機的字典規則檔載入</li>
                    <li>載入後內容會顯示在編輯區，可直接修改</li>
                    <li>關閉編輯窗後按下轉換即套用編輯區的內容</li>
                    <li>點擊 <strong>💾 下載字典規則</strong> 可將目前內容儲存為檔案</li>
                </ul>
                <p style="color: var(--text-secondary); font-size: 0.95rem; margin-top: 16px;">※ 可使用「📋 檢視報告」面板查看轉換過程的詳細日誌與 EPUB 結構驗證結果。</p>
            `,

            // ── 錯誤訊息 ──
            'error.select_files_first': '❌ 請先選擇檔案',
            'error.load_libs': '載入必要庫失敗，請確認 JSZip 與 opencc-js 已正確加載。',
            'error.drag_not_supported': '您的瀏覽器不支援拖曳上傳功能。',
            'error.drag_processing': '處理拖曳檔案時發生錯誤: {msg}',
            'error.zip_packaging': '打包 ZIP 失敗: {msg}',
            'error.convert_failed': '轉換失敗: {name} - {msg}',
            'error.all_failed': '⚠️ 所有檔案轉換失敗，無驗證資訊。',

            // ── Validation ──
            'validation.processing': '正在轉換中，請稍候...',
        },

        'zh-CN': {
            // ── Header ──
            'app.title': '📚 EPUB 繁简转换工具',
            'app.subtitle': '简体字 ←→ 繁体字转换',
            'app.supported_formats': '支持 EPUB、TXT、SRT、VTT、LRC、ASS、SSA 格式',
            'app.privacy_badge': '🔒 本工具完全在用户浏览器运行，不会上传文件',

            // ── 上传区 ──
            'upload.drag_text': '拖拽 EPUB、字幕或txt文件到此',
            'upload.drag_more': '可继续拖拽更多文件至此（累加）',
            'upload.or_text': '或',
            'upload.select_files': '选择多个文件',
            'upload.select_folder': '📁 选择文件夹',
            'upload.file_count': '已选择 {count} 个文件',
            'upload.reselect': '重新选择',
            'upload.remove': '移除 {name}',
            'upload.file_size_mb': '{size} MB',

            // ── 转换选项 ──
            'options.rule_title': '1.转换规则：',
            'options.filename_title': '2.文件名处理：',
            'options.special_title': '3.特殊处理：',

            'options.s2t': 's2t (简体 → 台湾繁体)',
            'options.s2twp': 's2twp (简体 → 台湾繁体 (+惯用词转换))',
            'options.s2hk': 's2hk (简体 → 香港繁体)',
            'options.tw2s': 'tw2s (台湾繁体 → 简体)',
            'options.tw2sp': 'tw2sp (台湾繁体 → 简体 (+惯用词转换))',
            'options.hk2s': 'hk2s (香港繁体 → 简体)',

            'options.filename_to_traditional': '转换为台湾繁体',
            'options.filename_to_simplified': '转换为简体',
            'options.filename_none': '不转换',
            'options.add_suffix': '文件名加上后缀 _convert',
            'options.enable_custom_dict': '启用自定义字典',
            'options.enable_validate': '启用 EPUB 结构验证',
            'options.validate_note': '（取消勾选可加快转换速度）',

            // ── 字典编辑 ──
            'dict.edit_title': '✏️ 编辑自定义字典',
            'dict.edit_desc': '请遵循 <code>原文,目标</code> 格式，每行一组。以 <code>#</code> 开头的行会被忽略。',
            'dict.loaded_label': '已加载:',
            'dict.load_csv': '📂 加载字典规则',
            'dict.download_csv': '💾 下载字典规则',
            'dict.load_default': '加载默认模板',
            'dict.close': '关闭',

            // ── 字典说明弹窗 ──
            'dict.help_title': '📖 自定义字典说明',

            // ── 转换按钮 & 进度 ──
            'convert.start': '开始批量转换',
            'convert.download_zip': '📦 下载全部转换结果 (ZIP)',
            'convert.download_zip_count': '📦 下载全部成功结果 ({count} 个) ZIP',
            'convert.progress_title': '📋 转换进度',
            'convert.progress_summary': '{completed} / {total} 完成',
            'convert.progress_text': '处理进度：{completed}/{total}',
            'convert.status_idle': '等待中',
            'convert.status_processing': '转换中...',
            'convert.status_done': '✅ 完成',
            'convert.status_error': '❌ {msg}',
            'convert.download': '下载',
            'convert.prepare_zip': '准备下载zip......',
            'convert.timer_running_label': '已运行',
            'convert.encoding_label': ' 以{enc}读取{mode}',

            // ── 使用说明 ──
            'info.title': '💡 使用说明',
            'info.step1': '选择「1.转换规则」，系统会将文件内文的简/繁体字词进行转换',
            'info.step2': '设置「2.文件名处理」，决定是否转换文件名的繁简、是否加上后缀 <code>_convert</code>',
            'info.step3': '设置「3.特殊处理」，可启用自定义字典修正特定字词的转换 (包含文件名)<br>可使用 <strong>📂 加载字典规则</strong> 将本地的字典文件导入',
            'info.convert_direction': '支持的转换方向',
            'info.table_header_setting': '设置',
            'info.table_header_direction': '方向',
            'info.table_row_s2t': '简体 → 台湾繁体',
            'info.table_row_s2twp': '简体 → 台湾繁体 (+惯用词转换)',
            'info.table_row_s2hk': '简体 → 香港繁体',
            'info.table_row_tw2s': '台湾繁体 → 简体',
            'info.table_row_tw2sp': '台湾繁体 → 简体 (+惯用词转换)',
            'info.table_row_hk2s': '香港繁体 → 简体',
            'info.warning': '⚠️ 字幕文件（SRT/ASS/SSA/VTT/LRC）转换时，自定义字典规则也会应用到纯文本内容。若原文或目标包含 <code>--></code>、<code>[时间]</code>、<code>Dialogue:</code> 等格式关键字，可能导致字幕结构异常，请谨慎设置。',

            // ── Footer ──
            'footer.version': 'EPUB 繁简转换工具 v1.0',
            'footer.copyright_line': '&copy; EPUB 繁简转换工具 · <a href="https://github.com/happk/epub-s2t-converter-web" target="_blank" rel="noopener noreferrer">GitHub Repo</a> · by happk',
            'footer.view_log': '📋 查看运行日志',

            // ── 报告面板 ──
            'report.title': '📋 转换报告',
            'report.tab_validation': '📗 结构验证',
            'report.tab_log': '📝 调试日志',
            'report.validation_empty': '尚未执行转换。完成转换后，EPUB 结构验证结果会显示在这里。',
            'report.log_empty': '无日志记录。',
            'report.clear_log': '清除日志',
            'report.copy_log': '复制日志',
            'report.close': '关闭',
            'report.log_copied': '日志已复制到剪贴板',
            'report.log_copy_failed': '复制日志失败',
            'report.log_cleared': '日志已清除',
            'report.log_no_content': '无日志内容可复制',

            // ── 字典说明内文 ──
            'dict.help_content_html': `
                <p>本系统采用 <strong>「长词优先 + 标签保护」</strong> 技术，确保自定义字典中的字词具有最高优先权，并避免 opencc-js 的一般转换干扰。</p>
                <h4>转换流程：</h4>
                <ol>
                    <li><strong>标签保护 (Protection)</strong>：依照 custom_dict 中的规则，由长至短搜索原始文本。匹配到的字词会先被替换为特殊保护标签，避免 opencc-js 误转。</li>
                    <li><strong>标准转换 (OpenCC)</strong>：执行您选择的转换规则（例如台湾繁体）。此时保护标签内的内容维持不变。</li>
                    <li><strong>还原字词 (Restore)</strong>：将保护标签还原为您在字典中定义的目标繁体字词。</li>
                </ol>
                <h4>示例：</h4>
                <ul>
                    <li>若设置 <code>吃,吃</code>，则「吃」会保留为「吃」，不会被转为「喫」。</li>
                    <li>若同时设置 <code>吃茶,喫茶</code>，则「吃茶」会优先转为「喫茶」，剩余的「吃」才会套用单字规则。</li>
                </ul>
                <h4>CSV 加载说明：</h4>
                <ul>
                    <li>可使用 <strong>📂 加载字典规则</strong> 将本地的字典规则文件加载</li>
                    <li>加载后内容会显示在编辑区，可直接修改</li>
                    <li>关闭编辑窗后按下转换即套用编辑区的内容</li>
                    <li>点击 <strong>💾 下载字典规则</strong> 可将目前内容保存为文件</li>
                </ul>
                <p style="color: var(--text-secondary); font-size: 0.95rem; margin-top: 16px;">※ 可使用「📋 查看报告」面板查看转换过程的详细日志与 EPUB 结构验证结果。</p>
            `,

            // ── 错误消息 ──
            'error.select_files_first': '❌ 请先选择文件',
            'error.load_libs': '加载必要库失败，请确认 JSZip 与 opencc-js 已正确加载。',
            'error.drag_not_supported': '您的浏览器不支持拖拽上传功能。',
            'error.drag_processing': '处理拖拽文件时发生错误: {msg}',
            'error.zip_packaging': '打包 ZIP 失败: {msg}',
            'error.convert_failed': '转换失败: {name} - {msg}',
            'error.all_failed': '⚠️ 所有文件转换失败，无验证信息。',

            // ── Validation ──
            'validation.processing': '正在转换中，请稍候...',
        },
    };

    // ========== i18n 引擎 ==========

    const i18n = {
        currentLang: DEFAULT_LANG,
        _switchCallbacks: [],

        /**
         * 檢測使用者偏好的語言
         * 優先順序：localStorage → 瀏覽器語言 → 預設繁體
         * @returns {string} 'zh-TW' 或 'zh-CN'
         */
        detect: function () {
            // 1. 檢查 localStorage 中使用者先前手動選擇
            const saved = localStorage.getItem(LANG_KEY);
            if (saved && SUPPORTED_LANGS.includes(saved)) {
                return saved;
            }

            // 2. 從瀏覽器語言判斷
            const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
            if (lang === 'zh-cn' || lang === 'zh-hans' || lang === 'zh-sg') {
                return 'zh-CN';
            }

            // 3. 預設繁體
            return DEFAULT_LANG;
        },

        /**
         * 取得指定 key 的翻譯文字
         * @param {string} key 翻譯鍵值
         * @param {object} [params] 模板參數，例如 { count: 5 } 會取代 {count}
         * @returns {string} 翻譯結果
         */
        t: function (key, params) {
            const dict = TRANSLATIONS[this.currentLang];
            if (!dict) return key;

            let text = dict[key];
            if (text === undefined) {
                // fallback: 嘗試從另一語言取得
                const fallback = TRANSLATIONS[DEFAULT_LANG] && TRANSLATIONS[DEFAULT_LANG][key];
                return fallback !== undefined ? this._interpolate(fallback, params) : key;
            }

            return this._interpolate(text, params);
        },

        /**
         * 簡單模板插值
         */
        _interpolate: function (text, params) {
            if (!params) return text;
            return text.replace(/\{(\w+)\}/g, (match, key) => {
                return params[key] !== undefined ? params[key] : match;
            });
        },

        /**
         * 切換語言
         * @param {string} lang 'zh-TW' 或 'zh-CN'
         */
        switchLang: function (lang) {
            if (!SUPPORTED_LANGS.includes(lang)) return;
            if (lang === this.currentLang) return;

            this.currentLang = lang;
            localStorage.setItem(LANG_KEY, lang);
            this.applyLanguage();

            // 通知所有註冊的回呼
            for (let i = 0; i < this._switchCallbacks.length; i++) {
                try {
                    this._switchCallbacks[i](lang);
                } catch (e) {
                    console.warn('[i18n] switch callback error:', e);
                }
            }
        },

        /**
         * 註冊語言切換事件監聽
         * @param {function} callback 接收新語言字串參數
         */
        onSwitch: function (callback) {
            if (typeof callback === 'function') {
                this._switchCallbacks.push(callback);
            }
        },

        /**
         * 將目前語言套用到頁面上所有 data-i18n 元素
         */
        applyLanguage: function () {
            document.querySelectorAll('[data-i18n]').forEach(function (el) {
                const key = el.getAttribute('data-i18n');
                const attr = el.getAttribute('data-i18n-attr');
                const text = i18n.t(key);

                if (attr) {
                    // 更新指定屬性（如 placeholder、title 等）
                    el.setAttribute(attr, text);
                } else {
                    // 更新 textContent（保留內部 HTML 時改用 innerHTML）
                    const useHtml = el.getAttribute('data-i18n-html') === 'true';
                    if (useHtml) {
                        el.innerHTML = text;
                    } else {
                        el.textContent = text;
                    }
                }
            });

            // 更新語言切換按鈕 active 狀態
            document.querySelectorAll('[data-lang-switch]').forEach(function (btn) {
                const btnLang = btn.getAttribute('data-lang-switch');
                if (btnLang === i18n.currentLang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // 更新 HTML lang 屬性
            document.documentElement.lang = this.currentLang;
        },

        /**
         * 初始化 i18n：偵測語言、套用、綁定切換按鈕
         */
        init: function () {
            this.currentLang = this.detect();
            this.applyLanguage();

            // 綁定語言切換按鈕
            document.querySelectorAll('[data-lang-switch]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const lang = this.getAttribute('data-lang-switch');
                    i18n.switchLang(lang);
                });
            });
        },
    };

    // ========== 暴露到全域 ==========

    window.i18n = i18n;

    // 頁面載入完成後自動初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            i18n.init();
        });
    } else {
        i18n.init();
    }
})();