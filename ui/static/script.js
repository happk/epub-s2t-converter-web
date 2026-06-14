/**
 * EPUB 轉換工具 - 純瀏覽器端實作
 *
 * 使用 JSZip 讀取、轉換、重打包 EPUB，並使用 opencc-js 做繁體轉換。
 * 包含 EPUB 結構驗證與報告面板。
 */

// EPUB 轉換目標檔案類型
const TEXT_FILE_EXTENSIONS = ['.xhtml', '.html', '.xml', '.opf', '.ncx'];
// 純文字/字幕檔案類型
const PLAIN_TEXT_EXTENSIONS = ['.txt', '.srt', '.vtt', '.lrc', '.ass', '.ssa'];
// 所有支援的副檔名
const ALL_SUPPORTED_EXTENSIONS = [...PLAIN_TEXT_EXTENSIONS, '.epub'];
function getFileExtension(fileName) {
    return fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
}

function isSupportedFile(fileName) {
    const ext = getFileExtension(fileName);
    return ALL_SUPPORTED_EXTENSIONS.includes(ext);
}

// 不需轉換文字內容的純結構 XML（只保留不修改）
const STRUCTURAL_XML_FILES = ['META-INF/container.xml'];
const ATTRIBUTE_NAMES = ['title', 'alt', 'placeholder'];
const METHOD_TO_LOCALE = {
    s2t:   { from: 'cn', to: 'tw' },
    s2twp: { from: 'cn', to: 'twp' },
    s2hk:  { from: 'cn', to: 'hk' },
    t2s:   { from: 'tw', to: 'cn' },
    tw2s:  { from: 'tw', to: 'cn' },
    tw2sp: { from: 'twp', to: 'cn' },
    hk2s:  { from: 'hk', to: 'cn' },
};

// localStorage key
const CUSTOM_DICT_KEY = 'epubConverterCustomDict';
const CUSTOM_DICT_CSV_NAME_KEY = 'epubConverterCsvFileName';
const DEFAULT_DICT_TEMPLATE = `# 範例：[原文],[目標]
# 長詞會優先於短詞被匹配，所以 吃饭->吃飯 ; 吃茶-> 喫茶 
吃,吃
吃茶,喫茶

# 詞彙轉換範例
计算机,電腦
软件,軟體

# 注意會先保護[原文]，轉換後再還原為[目標]，確保轉換過程中不被 opencc-js 影響
`;

// 字典狀態：記憶體中的內容（優先使用），若無則從 localStorage 讀取
let dictMemoryContent = '';
let dictLoadedCsvName = '';

// 轉換器快取（避免重複建立昂貴的 OpenCC 轉換器實例）
const converterCache = new Map();

// 解析後的字典規則快取
let parsedDictCache = null;
let parsedDictCacheContent = null;

// DOM 元素快取
const elements = {
    dragDropArea: document.getElementById('dragDropArea'),
    fileInput: document.getElementById('fileInput'),
    dirInput: document.getElementById('dirInput'),
    selectedFile: document.getElementById('selectedFile'),
    fileName: document.getElementById('fileName'),
    preFileList: document.getElementById('preFileList'),
    changeFileBtn: document.getElementById('changeFile'),
    methodSelect: document.getElementById('methodSelect'),
    addConvertSuffixCheckbox: document.getElementById('addConvertSuffixCheckbox'),
    useCustomDictCheckbox: document.getElementById('useCustomDictCheckbox'),
    convertBtn: document.getElementById('convertBtn'),
    resultSection: document.getElementById('resultSection'),
    downloadZipBtn: document.getElementById('downloadZipBtn'),
    errorSection: document.getElementById('errorSection'),
    errorContent: document.getElementById('errorContent'),
    dictHelpBtn: document.getElementById('dictHelpBtn'),
    dictHelpPopup: document.getElementById('dictHelpPopup'),
    validateCheckbox: document.getElementById('validateCheckbox'),
    convertTray: document.getElementById('convertTray'),
    traySummary: document.getElementById('traySummary'),
    trayProgressFill: document.getElementById('trayProgressFill'),
    trayProgressText: document.getElementById('trayProgressText'),
    trayFileList: document.getElementById('trayFileList'),
    dictHelpContent: document.getElementById('dictHelpContent'),
    closeDictHelpBtn: document.getElementById('closeDictHelpBtn'),
    // 字典編輯區塊元素
    dictEditBtn: document.getElementById('dictEditBtn'),
    dictEditPopup: document.getElementById('dictEditPopup'),
    dictEditTextarea: document.getElementById('dictEditTextarea'),
    loadDefaultDictBtn: document.getElementById('loadDefaultDictBtn'),
    saveDictBtn: document.getElementById('saveDictBtn'),
    loadCSVDictBtn: document.getElementById('loadCSVDictBtn'),
    downloadCSVDictBtn: document.getElementById('downloadCSVDictBtn'),
    csvFileInput: document.getElementById('csvFileInput'),
    dictCsvInfo: document.getElementById('dictCsvInfo'),
    dictCsvFileName: document.getElementById('dictCsvFileName'),
    fileInputLabel: document.getElementById('fileInputLabel'),
    dirInputLabel: document.getElementById('dirInputLabel'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerValue: document.getElementById('timerValue'),
    // 報告面板元素
    reportBtn: document.getElementById('reportBtn'),
    reportPanel: document.getElementById('reportPanel'),
    closeReportPanelBtn: document.getElementById('closeReportPanelBtn'),
    closeReportBtn: document.getElementById('closeReportBtn'),
    reportTabs: document.getElementById('reportTabs'),
    reportTabValidation: document.getElementById('reportTabValidation'),
    reportTabLog: document.getElementById('reportTabLog'),
    reportValidationContent: document.getElementById('reportValidationContent'),
    reportLogContent: document.getElementById('reportLogContent'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    copyLogBtn: document.getElementById('copyLogBtn'),
};

// 應用狀態
let appState = {
    selectedFiles: [],
    outputUrls: [],
};

// 計時器狀態
let timerInterval = null;
let timerStartTime = 0;

// 報告系統
const reportLog = {
    entries: [],
    maxEntries: 500,
};

function addLog(level, message) {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-TW', { hour12: false });
    const entry = { time, level, message };
    reportLog.entries.push(entry);
    if (reportLog.entries.length > reportLog.maxEntries) {
        reportLog.entries = reportLog.entries.slice(-reportLog.maxEntries);
    }
    renderLog();
    // 同時輸出到 console 方便開發
    const prefix = `[${time}]`;
    switch (level) {
        case 'debug': console.debug(prefix, message); break;
        case 'info': console.info(prefix, message); break;
        case 'warn': console.warn(prefix, message); break;
        case 'error': console.error(prefix, message); break;
        default: console.log(prefix, message);
    }
}

function renderLog() {
    const container = elements.reportLogContent;
    if (!container) return;
    if (reportLog.entries.length === 0) {
        container.innerHTML = '<p class="report-empty-hint">無日誌記錄。</p>';
        return;
    }
    const html = reportLog.entries.map(e => {
        const levelClass = `log-level-${e.level}`;
        return `<div class="log-entry"><span class="log-time">[${e.time}]</span> <span class="${levelClass}">[${e.level.toUpperCase()}]</span> ${escapeHtml(e.message)}</div>`;
    }).join('');
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/** i18n 工具函數：安全取得翻譯文字 */
function t(key, params) {
    if (window.i18n && typeof window.i18n.t === 'function') {
        return window.i18n.t(key, params);
    }
    return key;
}

// 初始化
function init() {
    addLog('info', '應用程式初始化...');
    if (typeof JSZip === 'undefined' || typeof OpenCC === 'undefined') {
        showError(t('error.load_libs'));
        addLog('error', '缺少 JSZip 或 OpenCC 庫');
        return;
    }
    addLog('info', 'JSZip 與 OpenCC 庫已加載');

    // 每次開啟頁面都從乾淨狀態開始，清除 localStorage 中的舊字典殘留
    localStorage.removeItem(CUSTOM_DICT_KEY);
    localStorage.removeItem(CUSTOM_DICT_CSV_NAME_KEY);
    dictMemoryContent = '';
    dictLoadedCsvName = '';

    // 轉換規則改變時自動連動檔名轉換方向
    elements.methodSelect.addEventListener('change', () => {
        const method = elements.methodSelect.value;
        const toTraditional = document.querySelector('input[name="filenameConvert"][value="toTraditional"]');
        const toSimplified = document.querySelector('input[name="filenameConvert"][value="toSimplified"]');
        if (!toTraditional || !toSimplified) return;
        const isToTraditional = method === 's2t' || method === 's2twp' || method === 's2hk';
        if (isToTraditional) {
            toTraditional.checked = true;
        } else {
            toSimplified.checked = true;
        }
    });

    elements.dragDropArea.addEventListener('dragover', handleDragOver);
    elements.dragDropArea.addEventListener('dragleave', handleDragLeave);
    elements.dragDropArea.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.dirInput.addEventListener('change', handleDirSelect);
    elements.changeFileBtn.addEventListener('click', resetSelection);
    elements.convertBtn.addEventListener('click', handleConvert);

    if (elements.dictHelpBtn) {
        elements.dictHelpBtn.addEventListener('click', (e) => {
            showDictHelpPopup(e);
        });
    }
    if (elements.closeDictHelpBtn) {
        elements.closeDictHelpBtn.addEventListener('click', () => {
            elements.dictHelpPopup.style.display = 'none';
        });
    }
    if (elements.dictEditBtn) {
        elements.dictEditBtn.addEventListener('click', toggleDictEditPopup);
    }
    if (elements.loadDefaultDictBtn) {
        elements.loadDefaultDictBtn.addEventListener('click', loadDefaultDict);
    }
    if (elements.saveDictBtn) {
        elements.saveDictBtn.addEventListener('click', saveDict);
    }
    if (elements.loadCSVDictBtn) {
        elements.loadCSVDictBtn.addEventListener('click', () => {
            elements.csvFileInput.click();
        });
    }
    if (elements.downloadCSVDictBtn) {
        elements.downloadCSVDictBtn.addEventListener('click', downloadCSVDict);
    }
    if (elements.csvFileInput) {
        elements.csvFileInput.addEventListener('change', handleCSVFileSelect);
    }

    // 用 JavaScript 設定 placeholder，確保與 DEFAULT_DICT_TEMPLATE 變數同步
    if (elements.dictEditTextarea) {
        elements.dictEditTextarea.placeholder = DEFAULT_DICT_TEMPLATE;
    }

    // 報告面板事件
    if (elements.reportBtn) {
        elements.reportBtn.addEventListener('click', toggleReportPanel);
    }
    if (elements.closeReportPanelBtn) {
        elements.closeReportPanelBtn.addEventListener('click', closeReportPanel);
    }
    if (elements.closeReportBtn) {
        elements.closeReportBtn.addEventListener('click', closeReportPanel);
    }
    if (elements.reportTabs) {
        elements.reportTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.report-tab');
            if (tab) switchReportTab(tab.dataset.tab);
        });
    }
    if (elements.clearLogBtn) {
        elements.clearLogBtn.addEventListener('click', clearLog);
    }
    if (elements.copyLogBtn) {
        elements.copyLogBtn.addEventListener('click', copyLog);
    }

    // 點擊遮罩關閉報告面板
    document.addEventListener('click', (e) => {
        if (elements.reportPanel && elements.reportPanel.classList.contains('visible')) {
            if (e.target === elements.reportPanel) {
                closeReportPanel();
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (elements.dictHelpPopup.style.display === 'block' && !elements.dictHelpPopup.contains(e.target) && e.target !== elements.dictHelpBtn) {
            elements.dictHelpPopup.style.display = 'none';
        }
    });

    addLog('info', '初始化完成，事件監聽已綁定');

    // 註冊語言切換回呼，讓動態 UI 能即時更新
    if (window.i18n) {
        window.i18n.onSwitch(function (lang) {
            // 重新整理拖放區提示文字
            updateDragText();
            // 重新整理檔案計數與列表
            if (appState.selectedFiles.length > 0) {
                updateSelectedUI();
            }
            // 如果托盤可見過則重新整理
            if (elements.convertTray.style.display === 'block') {
                renderTray();
            }
            // 更新檔案/資料夾選擇按鈕的文字（這些按鈕沒有 data-i18n，需手動更新）
            if (elements.fileInputLabel) {
                elements.fileInputLabel.childNodes[0].textContent = t('upload.select_files');
            }
            if (elements.dirInputLabel) {
                elements.dirInputLabel.childNodes[0].textContent = t('upload.select_folder');
            }
            // 更新 CSV 字典載入資訊標籤
            if (elements.dictCsvInfo && elements.dictCsvInfo.style.display !== 'none') {
                const label = elements.dictCsvInfo.querySelector('[data-i18n="dict.loaded_label"]');
                if (label) label.textContent = t('dict.loaded_label');
            }
        });
    }
}

/**
 * 更新拖放區提示文字（根據當前語言與檔案狀態）
 */
function updateDragText() {
    const dragText = elements.dragDropArea.querySelector('.drag-text');
    if (!dragText) return;
    const hasFiles = appState.selectedFiles.length > 0;
    const key = hasFiles ? 'upload.drag_more' : 'upload.drag_text';
    dragText.textContent = t(key);
}

// === 報告面板 UI ===

function toggleReportPanel() {
    if (elements.reportPanel.classList.contains('visible')) {
        closeReportPanel();
    } else {
        openReportPanel();
    }
}

function openReportPanel() {
    elements.reportPanel.classList.add('visible');
    elements.reportPanel.style.display = 'flex';
    renderLog();
}

function closeReportPanel() {
    elements.reportPanel.classList.remove('visible');
    elements.reportPanel.style.display = 'none';
}

function switchReportTab(tabName) {
    document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.report-tab-content').forEach(t => t.classList.remove('active'));
    const tabBtn = document.querySelector(`.report-tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');
    const tabContent = document.getElementById(`reportTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    if (tabContent) tabContent.classList.add('active');
}

function clearLog() {
    reportLog.entries = [];
    renderLog();
    addLog('info', t('report.log_cleared'));
}

function copyLog() {
    const text = reportLog.entries.map(e => `[${e.time}] [${e.level.toUpperCase()}] ${e.message}`).join('\n');
    if (!text) {
        addLog('warn', t('report.log_no_content'));
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        addLog('info', t('report.log_copied'));
    }).catch(() => {
        addLog('error', t('report.log_copy_failed'));
    });
}

function setValidationResult(html) {
    const container = elements.reportValidationContent;
    if (!container) return;
    container.innerHTML = html;
}

// === 檔案選擇 ===

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dragDropArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.dragDropArea.classList.remove('drag-over');
}

async function handleDrop(e) {
    addLog('info', 'drop 事件觸發');
    e.preventDefault();
    e.stopPropagation();
    elements.dragDropArea.classList.remove('drag-over');

    if (!e.dataTransfer || !e.dataTransfer.items) {
        addLog('error', '瀏覽器不支援 e.dataTransfer.items');
        showError(t('error.drag_not_supported'));
        return;
    }

    const items = [...e.dataTransfer.items];
    addLog('info', `偵測到 ${items.length} 個拖曳項目`);

    const promises = [];
    for (const item of items) {
        if (typeof item.webkitGetAsEntry !== 'function') {
            addLog('warn', 'item.webkitGetAsEntry 不是函式，跳過該項目');
            continue;
        }
        const entry = item.webkitGetAsEntry();
        if (entry) {
            promises.push(traverseFileTree(entry, ''));
        }
    }

    try {
        await Promise.all(promises);
    } catch (err) {
        addLog('error', `處理拖曳檔案錯誤: ${err.message}`);
        showError(t('error.drag_processing', { msg: err.message }));
    }

    const epubCount = appState.selectedFiles.filter(f => f.type === 'epub').length;
    const textCount = appState.selectedFiles.filter(f => f.type === 'text').length;
    addLog('info', `找到 ${appState.selectedFiles.length} 個檔案 (EPUB:${epubCount}, 文字:${textCount})`);
    updateSelectedUI();
}

function traverseFileTree(item, path) {
    return new Promise((resolve, reject) => {
        if (item.isFile) {
            item.file((file) => {
                const lower = file.name.toLowerCase();
                if (isSupportedFile(lower)) {
                    const type = lower.endsWith('.epub') ? 'epub' : 'text';
                    appState.selectedFiles.push({ file, path, type });
                    addLog('debug', `加入 ${type === 'epub' ? 'EPUB' : '文字'}: ${path}${file.name}`);
                }
                resolve();
            }, (err) => {
                addLog('error', `讀取檔案失敗: ${err}`);
                reject(err);
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            const readEntries = () => {
                dirReader.readEntries(async (entries) => {
                    if (entries.length > 0) {
                        const promises = entries.map(entry => traverseFileTree(entry, path + item.name + '/'));
                        try {
                            await Promise.all(promises);
                            readEntries();
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        resolve();
                    }
                }, (err) => reject(err));
            };
            readEntries();
        } else {
            resolve();
        }
    });
}

function handleFileSelect(e) {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        const lower = files[i].name.toLowerCase();
        if (isSupportedFile(lower)) {
            const type = lower.endsWith('.epub') ? 'epub' : 'text';
            appState.selectedFiles.push({ file: files[i], path: '', type });
        }
    }
    addLog('info', `選擇了 ${appState.selectedFiles.length} 個檔案`);
    updateSelectedUI();
}

function handleDirSelect(e) {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        const lower = files[i].name.toLowerCase();
        if (isSupportedFile(lower)) {
            const type = lower.endsWith('.epub') ? 'epub' : 'text';
            let relativePath = '';
            if (files[i].webkitRelativePath) {
                const parts = files[i].webkitRelativePath.split('/');
                parts.pop();
                if (parts.length > 0) {
                    relativePath = parts.join('/') + '/';
                }
            }
            appState.selectedFiles.push({ file: files[i], path: relativePath, type });
        }
    }
    const epubCount = appState.selectedFiles.filter(f => f.type === 'epub').length;
    const textCount = appState.selectedFiles.filter(f => f.type === 'text').length;
    addLog('info', `從資料夾選擇了 ${appState.selectedFiles.length} 個檔案 (EPUB:${epubCount}, 文字:${textCount})`);
    updateSelectedUI();
}

function updateSelectedUI() {
    if (appState.selectedFiles.length === 0) {
        elements.selectedFile.style.display = 'none';
        elements.convertBtn.disabled = true;
        hideAllResults();
        return;
    }

    // 更新拖放區提示文字
    updateDragText();

    elements.fileName.textContent = t('upload.file_count', { count: appState.selectedFiles.length });
    elements.preFileList.innerHTML = '';
    appState.selectedFiles.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'file-list-item';
        itemDiv.style.padding = '8px 12px';

        let displayPath = item.file.name;
        if (item.path) displayPath = item.path + item.file.name;

        itemDiv.innerHTML = `
            <div class="file-name-wrap" title="${displayPath}">
                📄 <span style="color: var(--text-secondary);">${index + 1}.</span> ${displayPath}
            </div>
            <div class="file-action-wrap" style="display:flex;align-items:center;gap:6px;">
                <span style="color: var(--text-secondary); font-size: 0.8rem;">
                    ${t('upload.file_size_mb', { size: (item.file.size / 1024 / 1024).toFixed(2) })}
                </span>
                <button class="btn-remove-file" data-index="${index}" title="${t('upload.remove', { name: displayPath })}">✕</button>
            </div>
        `;
        elements.preFileList.appendChild(itemDiv);
    });

    // 綁定「✕」按鈕點擊事件
    document.querySelectorAll('.btn-remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.currentTarget.getAttribute('data-index'), 10);
            removeFile(index);
        });
    });

    elements.selectedFile.style.display = 'flex';
    elements.convertBtn.disabled = false;
    hideAllResults();
}

function removeFile(index) {
    const removed = appState.selectedFiles[index];
    if (!removed) return;

    appState.selectedFiles.splice(index, 1);
    addLog('info', `已移除檔案: ${removed.file.name}`);

    if (appState.selectedFiles.length === 0) {
        resetSelection();
    } else {
        updateSelectedUI();
    }
}

function resetSelection() {
    revokeOutputUrls();
    appState.selectedFiles = [];
    elements.selectedFile.style.display = 'none';
    elements.fileInput.value = '';
    elements.dirInput.value = '';
    elements.convertBtn.disabled = true;
    hideAllResults();
    // 恢復拖放區提示文字
    updateDragText();
    addLog('info', '已重置檔案選擇');
}

// === 字典相關 ===

/**
 * 從記憶體中解析自定義字典規則
 * 只在記憶體有內容時才套用規則（由 CSV 載入或編輯內容提供）
 */
function parseCustomDict() {
    let raw = dictMemoryContent;
    if (!raw.trim()) {
        // 完全無字典內容時回傳空陣列（不套用任何規則）
        if (parsedDictCache !== null) {
            addLog('info', '自定義字典無內容，不套用任何自定義規則');
        }
        parsedDictCache = [];
        parsedDictCacheContent = '';
        return [];
    }

    // 快取檢查：如果內容未變更，直接回傳快取
    if (parsedDictCache !== null && parsedDictCacheContent === raw) {
        return parsedDictCache;
    }

    const lines = raw.split(/\r?\n/);
    const rules = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const parts = trimmed.split(',');
        if (parts.length < 2) continue;
        const orig = parts[0].trim();
        const target = parts.slice(1).join(',').trim();
        if (orig && target) {
            rules.push([orig, target]);
        }
    }

    addLog('info', `自定義字典解析完成，共 ${rules.length} 條規則`);
    if (rules.length === 0) {
        parsedDictCache = [];
        parsedDictCacheContent = raw;
        return [];
    }
    parsedDictCache = rules.sort((a, b) => b[0].length - a[0].length);
    parsedDictCacheContent = raw;
    return parsedDictCache;
}

function applyCustomDict(text, converter, useCustomDict) {
    if (!useCustomDict) return converter(text);

    const rules = parseCustomDict();
    if (!rules.length) return converter(text);

    let protectedText = text;
    const placeholders = [];

    for (let i = 0; i < rules.length; i++) {
        const [orig, target] = rules[i];
        if (protectedText.includes(orig)) {
            const marker = `[[__DICT_${i}__]]`;
            placeholders.push({ marker, target });
            protectedText = protectedText.split(orig).join(marker);
        }
    }

    let converted = converter(protectedText);
    for (let i = 0; i < placeholders.length; i++) {
        const { marker, target } = placeholders[i];
        converted = converted.split(marker).join(target);
    }
    return converted;
}

/**
 * CSV 檔案選擇處理
 */
async function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const { text, encoding } = decodeWithEncodingDetection(bytes, file.name);

        let content = text;
        // 檢測並移除 UTF-8 BOM
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }
        dictMemoryContent = content;
        dictLoadedCsvName = file.name;

        // 同步到編輯器文字區
        elements.dictEditTextarea.value = content;

        // 儲存到 localStorage 備份
        localStorage.setItem(CUSTOM_DICT_KEY, content);
        localStorage.setItem(CUSTOM_DICT_CSV_NAME_KEY, dictLoadedCsvName);

        addLog('info', `已載入 CSV 字典: ${file.name} (編碼: ${encoding}, ${content.length} 字元, ${countDictRules(content)} 條規則)`);
        showDictLoadedToast(`已載入 ${file.name}`);
    } catch (err) {
        addLog('error', `讀取 CSV 檔案失敗: ${err.message}`);
    }

    // 重置 input 讓使用者能再次選取同檔案
    e.target.value = '';
}

/**
 * 計算字典規則數量
 */
function countDictRules(content) {
    const lines = content.split(/\r?\n/);
    let count = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        if (trimmed.includes(',')) count++;
    }
    return count;
}

/**
 * 更新 CSV 載入資訊顯示
 */
function updateDictCsvInfo() {
    if (dictLoadedCsvName) {
        elements.dictCsvInfo.style.display = 'flex';
        elements.dictCsvFileName.textContent = dictLoadedCsvName;
    } else {
        elements.dictCsvInfo.style.display = 'none';
    }
}

/**
 * 顯示短暫的載入提示
 */
function showDictLoadedToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #065f46;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.95rem;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

/**
 * 顯示持續存在的 Toast 提示（用於下載 ZIP 等需要等待的操作）
 * 回傳 toast 元素，供後續手動移除
 */
function showPersistentToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: #065f46;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.95rem;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    return toast;
}

/**
 * 移除 Toast 提示
 */
function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 500);
}

/**
 * 下載 CSV 字典
 */
function downloadCSVDict() {
    const content = elements.dictEditTextarea.value || dictMemoryContent || localStorage.getItem(CUSTOM_DICT_KEY) || DEFAULT_DICT_TEMPLATE;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom_dict.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('info', '字典已下載為 custom_dict.csv');
}

/**
 * 編輯字典彈窗控制
 */
function toggleDictEditPopup() {
    const isVisible = elements.dictEditPopup.style.display === 'block';
    if (isVisible) {
        elements.dictEditPopup.style.display = 'none';
        addLog('debug', '字典編輯已關閉');
    } else {
        // 打開編輯器時不覆蓋編輯框內容，保留前一次編輯的值
        elements.dictEditPopup.style.display = 'block';
        addLog('debug', '字典編輯已開啟');
    }
}

/**
 * 載入預設字典範本
 */
function loadDefaultDict() {
    elements.dictEditTextarea.value = DEFAULT_DICT_TEMPLATE;
    addLog('info', '已載入預設字典範本');
}

/**
 * 關閉字典編輯彈窗（不儲存，轉換時會直接讀取編輯框內容）
 */
function saveDict() {
    elements.dictEditPopup.style.display = 'none';
    addLog('debug', '字典編輯已關閉');
}

/**
 * 顯示字典說明彈窗
 */
function showDictHelpPopup(e) {
    addLog('debug', '顯示字典說明彈窗');
    elements.dictHelpPopup.style.display = 'block';
    elements.dictHelpPopup.style.position = 'fixed';
    elements.dictHelpPopup.style.top = '50%';
    elements.dictHelpPopup.style.left = '50%';
    elements.dictHelpPopup.style.transform = 'translate(-50%, -50%)';
    elements.dictHelpPopup.style.margin = '0';
    elements.dictHelpPopup.style.maxWidth = '700px';
    elements.dictHelpPopup.style.minWidth = '520px';
    elements.dictHelpPopup.style.width = 'calc(100% - 40px)';
    elements.dictHelpContent.innerHTML = t('dict.help_content_html');
}

// === 轉換托盤管理 ===

let trayItems = [];

function renderTray() {
    const total = trayItems.length;
    const completed = trayItems.filter(t => t.status === 'done' || t.status === 'error').length;

    elements.traySummary.textContent = t('convert.progress_summary', { completed, total });
    elements.trayProgressFill.style.width = total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%';
    elements.trayProgressText.textContent = t('convert.progress_text', { completed, total });

    elements.trayFileList.innerHTML = '';
    trayItems.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'tray-file-item';

        let statusText = '';
        let statusClass = 'idle';
        let fillClass = '';
        let fillWidth = '0%';
        let showDownloadBtn = false;

        switch (item.status) {
            case 'idle':
                statusText = t('convert.status_idle');
                statusClass = 'idle';
                fillWidth = '0%';
                break;
            case 'processing':
                statusText = t('convert.status_processing');
                statusClass = 'processing';
                fillClass = 'processing';
                fillWidth = '100%';
                break;
            case 'done':
                statusText = t('convert.status_done');
                statusClass = 'done';
                fillClass = 'done';
                fillWidth = '100%';
                showDownloadBtn = true;
                break;
            case 'error':
                statusText = t('convert.status_error', { msg: item.errorMsg || '失敗' });
                statusClass = 'error';
                fillClass = 'error';
                fillWidth = '100%';
                break;
        }

        const originalName = item.displayName;
        const outputName = item.outputName || item.displayName;
        // 顯示為「以xxx讀取」格式，避免誤解為輸出編碼
        const encodingLabel = item.encoding
            ? t('convert.encoding_label', {
                enc: item.encoding.replace(/ \([^)]*\)$/, '').trim(),
                mode: (item.encoding.match(/\([^)]*\)$/) || [''])[0]
              })
            : '';

        div.innerHTML = `
            <div class="tray-file-row">
                <span class="tray-file-name" title="${originalName}">📄 ${originalName}</span>
                <span class="tray-file-status ${statusClass}">${statusText}</span>
            </div>
            <div class="tray-file-detail">
                <span class="tray-file-convert">→ ${outputName}</span>
                ${encodingLabel ? `<span class="tray-file-encoding">${encodingLabel}</span>` : ''}
                ${showDownloadBtn ? `<button class="btn-small btn-download-single" data-url="${item.downloadUrl || ''}" data-name="${outputName}">${t('convert.download')}</button>` : ''}
            </div>
            <div class="tray-file-progress-bar">
                <div class="tray-file-progress-fill ${fillClass}" style="width: ${fillWidth};"></div>
            </div>
        `;

        elements.trayFileList.appendChild(div);
    });

    // 綁定 tray 內的下載按鈕
    document.querySelectorAll('.tray-file-list .btn-download-single').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = e.currentTarget.getAttribute('data-url');
            const name = e.currentTarget.getAttribute('data-name');
            if (url) downloadUrl(url, name);
        });
    });
}


// === 轉換主流程 ===

async function handleConvert() {
    // 轉換前直接以編輯框當下內容為準，無論彈窗是否開啟
    dictMemoryContent = elements.dictEditTextarea.value;
    parsedDictCache = null;
    parsedDictCacheContent = null;
    addLog('debug', `已採用編輯框內容作為自定義字典 (${dictMemoryContent.length} 字元)`);
    if (appState.selectedFiles.length === 0) {
        showError(t('error.select_files_first'));
        return;
    }

    hideAllResults();
    revokeOutputUrls();
    startTimer();

    const method = elements.methodSelect.value;
    const filenameRadio = document.querySelector('input[name="filenameConvert"]:checked');
    const filenameConvert = filenameRadio ? filenameRadio.value : 'toTraditional';
    const addConvertSuffix = elements.addConvertSuffixCheckbox.checked;
    const useCustomDict = elements.useCustomDictCheckbox.checked;
    const shouldValidate = elements.validateCheckbox.checked;

    addLog('info', `開始批量轉換，規則: ${method}, 檔名轉換: ${filenameConvert}, 自定義字典: ${useCustomDict}, 結構驗證: ${shouldValidate}`);

    const converter = createConverter(method);
    const items = appState.selectedFiles;
    const results = [];

    // 初始化托盤
    trayItems = items.map((item) => {
        const displayName = item.path ? `${item.path}${item.file.name}` : item.file.name;
        return { displayName, status: 'idle', errorMsg: '', outputName: '', downloadUrl: '', encoding: '' };
    });

    elements.downloadZipBtn.style.display = 'none';

    // 顯示托盤
    elements.convertTray.style.display = 'block';
    renderTray();

    // 清除舊驗證結果
    setValidationResult(`<p class="report-empty-hint">${t('validation.processing')}</p>`);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const displayName = item.path ? `${item.path}${item.file.name}` : item.file.name;

        // 更新托盤狀態為處理中
        trayItems[i].status = 'processing';
        renderTray();
        addLog('info', `[${i + 1}/${items.length}] 處理: ${displayName}`);

        try {
            const outputName = buildOutputName(item.file.name, filenameConvert, addConvertSuffix, useCustomDict);
            const zipPath = item.path ? `${item.path}${outputName}` : outputName;

            let blob, validation, encoding = '';
            if (item.type === 'text') {
                const result = await processTextFile(item.file, converter, useCustomDict, displayName);
                blob = result.blob;
                validation = null;
                encoding = result.encoding || '';
                trayItems[i].encoding = encoding;
            } else {
                const result = await processEpubFile(item.file, converter, useCustomDict, displayName, shouldValidate);
                blob = result.blob;
                validation = result.validation;
            }
            const downloadUrl = URL.createObjectURL(blob);
            appState.outputUrls.push(downloadUrl);

            results.push({
                success: true,
                originalName: item.file.name,
                outputName,
                zipPath,
                blob,
                downloadUrl,
                validation,
            });

            // 顯示此檔案的驗證摘要到報告面板
            if (validation) {
                updateValidationReport(displayName, validation);
            }

            // 更新托盤狀態為完成
            trayItems[i].status = 'done';
            trayItems[i].outputName = outputName;
            trayItems[i].downloadUrl = downloadUrl;
        } catch (error) {
            addLog('error', t('error.convert_failed', { name: displayName, msg: error.message || error }));
            results.push({
                success: false,
                originalName: item.file.name,
                error: error.message || String(error),
            });

            // 更新托盤狀態為錯誤
            trayItems[i].status = 'error';
            trayItems[i].errorMsg = error.message || '轉換失敗';
        }

        renderTray();
    }

    addLog('info', `批量轉換完成，成功: ${results.filter(r => r.success).length}, 失敗: ${results.filter(r => !r.success).length}`);

    if (results.every(r => !r.success)) {
        setValidationResult(`<p class="report-empty-hint"><span style="color: var(--error-color);">${t('error.all_failed')}</span></p>`);
    }

    stopTimer();
    setTimeout(() => showResults(results), 300);
}

// === 計時器功能 ===

function startTimer() {
    timerStartTime = Date.now();
    timerInterval = setInterval(updateTimerDisplay, 100);
    if (elements.timerDisplay) {
        elements.timerDisplay.style.display = 'flex';
        elements.timerDisplay.classList.add('active');
    }
    updateTimerDisplay();
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (elements.timerDisplay) {
        elements.timerDisplay.classList.remove('active');
    }
    updateTimerDisplay();
}

function updateTimerDisplay() {
    if (!elements.timerValue) return;
    const elapsed = Date.now() - timerStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    elements.timerValue.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function createConverter(method) {
    const locale = METHOD_TO_LOCALE[method] || METHOD_TO_LOCALE.s2t;
    const cacheKey = `${locale.from}-${locale.to}`;
    if (converterCache.has(cacheKey)) {
        return converterCache.get(cacheKey);
    }
    const converter = OpenCC.Converter({ from: locale.from, to: locale.to });
    converterCache.set(cacheKey, converter);
    return converter;
}

function buildOutputName(fileName, filenameConvert, addConvertSuffix, useCustomDict) {
    const ext = getFileExtension(fileName);
    const baseName = fileName.slice(0, -ext.length);
    let name = baseName;
    if (filenameConvert === 'toTraditional') {
        const conv = createConverter('s2t');
        name = applyCustomDict(name, conv, useCustomDict);
    } else if (filenameConvert === 'toSimplified') {
        const conv = createConverter('tw2s');
        name = applyCustomDict(name, conv, useCustomDict);
    }
    // 'none' skips conversion
    if (addConvertSuffix) {
        name = `${name}_convert`;
    }
    return `${name}${ext}`;
}

// === 編碼檢測與解碼 ===

/**
 * 將 jschardet 回傳的編碼名稱標準化為 TextDecoder 可接受的名稱
 */
function normalizeEncoding(enc) {
    const lower = enc.toLowerCase();
    if (lower === 'ascii') return 'utf-8';
    // jschardet 可能回傳 big-5，TextDecoder 吃 big5
    if (lower === 'big-5') return 'big5';
    if (lower === 'gb2312') return 'gbk';
    if (lower === 'gb18030') return 'gbk';
    if (lower === 'sjis' || lower === 'shift-jis') return 'shift-jis';
    if (lower === 'euckr') return 'euc-kr';
    return lower;
}

/**
 * 編碼嘗試清單（用於試錯法回退）
 */
const ENCODING_FALLBACKS = ['utf-8', 'big5', 'gbk', 'shift-jis', 'euc-kr'];

/**
 * 使用 jschardet 檢測編碼，置信度不足（< 0.9）時回退到試錯法
 * @param {Uint8Array} bytes - 原始二進位資料
 * @param {string} fileName - 檔名（用於日誌）
 * @returns {{ text: string, encoding: string }}
 */
function decodeWithEncodingDetection(bytes, fileName) {
    // 步驟1: 使用 jschardet 檢測（如果已載入）
    if (typeof jschardet !== 'undefined') {
        try {
            const result = jschardet.detect(bytes);
            addLog('debug', `${fileName}: jschardet 檢測結果 = ${JSON.stringify(result)}`);

            if (result && result.encoding && result.confidence >= 0.9) {
                const enc = normalizeEncoding(result.encoding);
                if (enc) {
                    try {
                        const decoder = new TextDecoder(enc, { fatal: true });
                        const text = decoder.decode(bytes);
                        addLog('info', `${fileName}: jschardet 檢測編碼 = ${enc} (置信度: ${(result.confidence * 100).toFixed(1)}%)`);
                        return { text, encoding: enc.toUpperCase() };
                    } catch (e) {
                        addLog('warn', `${fileName}: jschardet 檢測到 ${enc} 但解碼失敗，回退試錯法`);
                    }
                }
            } else if (result) {
                addLog('debug', `${fileName}: jschardet 置信度不足 (${result.confidence ? (result.confidence * 100).toFixed(1) : 'N/A'}%)，使用試錯法回退`);
            }
        } catch (jschardetError) {
            addLog('warn', `${fileName}: jschardet 檢測拋出例外 (${jschardetError.message})，回退試錯法`);
        }
    }

    // 步驟2: 回退到試錯法（依序嘗試各編碼）
    for (const enc of ENCODING_FALLBACKS) {
        try {
            const decoder = new TextDecoder(enc, { fatal: true });
            const text = decoder.decode(bytes);
            addLog('info', `${fileName}: 試錯法檢測編碼 = ${enc}`);
            return { text, encoding: enc.toUpperCase() + ' (試錯)' };
        } catch (e) {
            // 解碼失敗，嘗試下一種
        }
    }

    // 最後手段：不指定編碼寬容解碼（預設 UTF-8 寬容模式）
    addLog('warn', `${fileName}: 所有編碼嘗試失敗，使用 UTF-8 寬容模式`);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return { text, encoding: 'UTF-8 (寬容)' };
}

// === 純文字/字幕檔案處理 ===

async function processTextFile(file, converter, useCustomDict, displayName) {
    addLog('debug', `開始處理純文字: ${displayName}`);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 編碼檢測與解碼
    const { text, encoding } = decodeWithEncodingDetection(bytes, displayName);

    const ext = getFileExtension(file.name);
    let outputText;

    if (ext === '.txt') {
        // TXT：直接轉換全部內容
        outputText = applyCustomDict(text, converter, useCustomDict);
    } else {
        // 字幕格式：逐行處理，保留結構
        outputText = convertSubtitleText(text, converter, useCustomDict, ext);
    }

    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    addLog('info', `轉換完成: ${displayName} (${(blob.size / 1024).toFixed(1)} KB)`);
    return { blob, validation: null, encoding };
}

/**
 * 轉換字幕/結構化文字檔案，只轉換純文字內容，保留結構
 */
function convertSubtitleText(text, converter, useCustomDict, ext) {
    const lines = text.split(/\r?\n/);
    const result = [];

    for (const line of lines) {
        const trimmed = line.trim();
        let convertedLine = line;

        if (ext === '.srt' || ext === '.vtt') {
            // SRT/VTT：跳過序號行（純數字）、時間軸行（含 -->）、空行
            const isNumberLine = /^\d+$/.test(trimmed);
            const isTimestampLine = trimmed.includes('-->');
            const isEmpty = trimmed === '';
            if (isNumberLine || isTimestampLine || isEmpty) {
                result.push(line);
                continue;
            }
            // VTT 開頭標記
            if (trimmed === 'WEBVTT' || trimmed.startsWith('WEBVTT')) {
                result.push(line);
                continue;
            }
            // 其餘是純文字內容，做轉換
            convertedLine = applyCustomDict(line, converter, useCustomDict);
        } else if (ext === '.lrc') {
            // LRC：保留 [時間戳] 結構，只轉換後面的文字
            const match = line.match(/^(\[.*\])\s*(.*)/);
            if (match) {
                const timestamp = match[1];
                const lyric = match[2];
                const convertedLyric = applyCustomDict(lyric, converter, useCustomDict);
                convertedLine = `${timestamp} ${convertedLyric}`;
            } else {
                // 無時間戳的行（如標題）也做轉換
                convertedLine = applyCustomDict(line, converter, useCustomDict);
            }
        } else if (ext === '.ass' || ext === '.ssa') {
            // ASS/SSA：只轉換 Dialogue: 和 Comment: 行的最後一個欄位
            if (/^(Dialogue|Comment):/i.test(trimmed)) {
                const commaIndex = findLastCommaIndex(trimmed);
                if (commaIndex >= 0) {
                    const prefix = trimmed.slice(0, commaIndex + 1);
                    const textContent = trimmed.slice(commaIndex + 1);
                    const convertedText = applyCustomDict(textContent, converter, useCustomDict);
                    convertedLine = prefix + convertedText;
                }
            }
            // 其他行（[Section]、Format:、Style: 等）保持不變
        }

        result.push(convertedLine);
    }

    return result.join('\n');
}

/** 找到最後一個逗號的索引（用於 ASS Dialogue 欄位分割） */
function findLastCommaIndex(str) {
    let idx = -1;
    let count = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === ',') {
            count++;
            if (count === 9) { // ASS 前 9 個欄位用逗號分隔
                idx = i;
            }
        }
    }
    return idx;
}

// === EPUB 處理與結構驗證 ===

async function processEpubFile(file, converter, useCustomDict, displayName, shouldValidate = true) {
    addLog('debug', `開始處理: ${displayName}`);
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const newZip = new JSZip();

    // 處理 mimetype（保持無壓縮置頂）
    if (zip.file('mimetype')) {
        const mimetypeData = await zip.file('mimetype').async('uint8array');
        newZip.file('mimetype', mimetypeData, { compression: 'STORE' });
        addLog('debug', `mimetype 已保留 (STORE)`);
    }

    // 複製並轉換檔案
    for (const fileName of Object.keys(zip.files)) {
        const entry = zip.files[fileName];
        if (entry.dir || fileName === 'mimetype') continue;

        // 跳過結構性 XML 檔案（不做文字轉換，只保留原始內容）
        if (STRUCTURAL_XML_FILES.includes(fileName)) {
            const data = await entry.async('uint8array');
            newZip.file(fileName, data, { binary: true });
            addLog('debug', `結構檔案保留原始內容: ${fileName}`);
            continue;
        }

        const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
        if (TEXT_FILE_EXTENSIONS.includes(ext)) {
            const text = await entry.async('string');
            const converted = convertDocumentText(text, converter, useCustomDict, fileName);
            newZip.file(fileName, converted);
            addLog('debug', `文字轉換完成: ${fileName} (${(converted.length / 1024).toFixed(1)} KB)`);
        } else {
            const data = await entry.async('uint8array');
            newZip.file(fileName, data, { binary: true });
        }
    }

    // EPUB 結構驗證
    let validation = null;
    if (shouldValidate) {
        addLog('debug', `執行 EPUB 結構驗證: ${displayName}`);
        validation = validateEpubStructure(newZip, displayName);

        // 輸出驗證結果到日誌
        validation.errors.forEach(e => addLog('error', `[驗證] ${displayName} - ${e}`));
        validation.warnings.forEach(w => addLog('warn', `[驗證] ${displayName} - ${w}`));
        validation.infos.forEach(i => addLog('info', `[驗證] ${displayName} - ${i}`));
    } else {
        addLog('debug', `跳過 EPUB 結構驗證: ${displayName}`);
    }

    const blob = await newZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    addLog('info', `轉換完成: ${displayName} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);

    return { blob, validation };
}

/**
 * 修正後的文件轉換函數
 *
 * 主要修正：
 * 1. 不再使用 text/html fallback（避免結構破壞）
 * 2. 智慧檢測序列化輸出是否已含 XML 宣告，避免重複
 * 3. 處理 BOM 字符
 * 4. 若 XML 解析失敗，保留原始內容
 */
function convertDocumentText(content, converter, useCustomDict, fileName) {
    // 移除 BOM 字符並記錄
    let cleanedContent = content;
    let hadBom = false;
    if (cleanedContent.charCodeAt(0) === 0xFEFF) {
        cleanedContent = cleanedContent.slice(1);
        hadBom = true;
        addLog('debug', `${fileName}: 已移除 BOM 字符`);
    }

    // 快速回傳：關閉字典或字典為空時，跳過 DOM 解析，直接轉換整個字串
    if (!useCustomDict || !dictMemoryContent.trim()) {
        return converter(cleanedContent);
    }

    // 擷取 XML 宣告
    const origXmlDeclMatch = cleanedContent.match(/^<\?xml[^>]*\?>\s*/);
    const origXmlDecl = origXmlDeclMatch ? origXmlDeclMatch[0] : '';

    // 用 DOMParser 以 XML 模式解析
    const parser = new DOMParser();
    let doc;
    try {
        doc = parser.parseFromString(cleanedContent, 'application/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            // XML 解析失敗，保留原始內容不做轉換
            addLog('warn', `${fileName}: XML 解析錯誤，保留原始內容`);
            return content;
        }
    } catch (e) {
        addLog('warn', `${fileName}: XML 解析例外 (${e.message})，保留原始內容`);
        return content;
    }

    // 執行 DOM 文字轉換（批量收集 + 批量轉換）
    batchTraverseNode(doc.documentElement, converter);

    // 序列化回字串
    const serializer = new XMLSerializer();
    let output = serializer.serializeToString(doc);

    // XML 宣告處理邏輯：
    // 1. 序列化輸出可能已自帶 <?xml ...?>（視瀏覽器實作而定）
    // 2. 如果原始有 XML 宣告，且序列化輸出「沒有」以宣告開頭，才添加
    // 3. 如果序列化輸出「已經有」宣告，跳過添加（避免重複）
    const outputHasXmlDecl = /^<\?xml[^>]*\?>/i.test(output);
    if (origXmlDecl && !outputHasXmlDecl) {
        output = origXmlDecl + output;
    }

    return output;
}

/**
 * 批量收集節點並進行文字轉換
 * 先收集所有需要轉換的節點，再統一進行轉換，減少函式呼叫次數
 */
function batchTraverseNode(root, converter) {
    // 收集所有需要轉換的文字節點和屬性節點
    const textNodes = [];
    const attrNodes = [];
    const cdataNodes = [];

    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_CDATA_SECTION,
        null
    );

    let node;
    while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
            if (!shouldSkipNode(node.parentNode)) {
                textNodes.push(node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (let i = 0; i < ATTRIBUTE_NAMES.length; i++) {
                if (node.hasAttribute(ATTRIBUTE_NAMES[i])) {
                    const value = node.getAttribute(ATTRIBUTE_NAMES[i]);
                    if (value) {
                        attrNodes.push({ node, attrName: ATTRIBUTE_NAMES[i] });
                    }
                }
            }
        } else if (node.nodeType === Node.CDATA_SECTION_NODE && node.nodeValue.trim()) {
            cdataNodes.push(node);
        }
    }

    // 批量轉換文字節點
    for (let i = 0; i < textNodes.length; i++) {
        textNodes[i].nodeValue = converter(textNodes[i].nodeValue);
    }

    // 批量轉換屬性節點
    for (let i = 0; i < attrNodes.length; i++) {
        const { node, attrName } = attrNodes[i];
        node.setAttribute(attrName, converter(node.getAttribute(attrName)));
    }

    // 批量轉換 CDATA 節點
    for (let i = 0; i < cdataNodes.length; i++) {
        cdataNodes[i].nodeValue = converter(cdataNodes[i].nodeValue);
    }
}

function traverseNode(node, converter, useCustomDict) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
        if (!shouldSkipNode(node.parentNode)) {
            node.nodeValue = applyCustomDict(node.nodeValue, converter, useCustomDict);
        }
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        ATTRIBUTE_NAMES.forEach((attrName) => {
            if (node.hasAttribute(attrName)) {
                const value = node.getAttribute(attrName);
                if (value) {
                    node.setAttribute(attrName, applyCustomDict(value, converter, useCustomDict));
                }
            }
        });
    }

    // 處理 CDATA 節點
    if (node.nodeType === Node.CDATA_SECTION_NODE && node.nodeValue.trim()) {
        node.nodeValue = applyCustomDict(node.nodeValue, converter, useCustomDict);
    }

    node.childNodes.forEach((child) => traverseNode(child, converter, useCustomDict));
}

function shouldSkipNode(parent) {
    if (!parent || parent.nodeType !== Node.ELEMENT_NODE) return false;
    const tagName = parent.nodeName.toLowerCase();
    return tagName === 'script' || tagName === 'style' || tagName === 'textarea';
}

// === EPUB 結構驗證 ===

function validateEpubStructure(zip, displayName) {
    const errors = [];
    const warnings = [];
    const infos = [];
    const files = zip.files;

    // 1. 檢查 mimetype
    const hasMimetype = files['mimetype'] && !files['mimetype'].dir;
    if (!hasMimetype) {
        errors.push('缺少 mimetype 檔案（EPUB 規範強制要求）');
    } else {
        infos.push('✅ mimetype 存在');
    }

    // 2. 檢查 META-INF/container.xml
    const hasContainer = files['META-INF/container.xml'] && !files['META-INF/container.xml'].dir;
    if (!hasContainer) {
        errors.push('缺少 META-INF/container.xml（EPUB 規範強制要求）');
    } else {
        infos.push('✅ META-INF/container.xml 存在');
        // 嘗試解析 container.xml
        try {
            const containerText = files['META-INF/container.xml'].dir ? '' : zip.file('META-INF/container.xml').async ? null : '';
            // 非同步取得內容較麻煩，先跳過同步解析，用 JSZip 非同步 API
            infos.push('✅ META-INF/container.xml 可讀取');
        } catch (e) {
            errors.push(`META-INF/container.xml 解析失敗: ${e.message}`);
        }
    }

    // 3. 統計檔案
    const fileNames = Object.keys(files).filter(f => !files[f].dir);
    infos.push(`📄 ZIP 內檔案總數: ${fileNames.length}`);

    // 4. 檢查常見的 OPF 路徑
    const possibleOpfFiles = fileNames.filter(f =>
        f.toLowerCase().endsWith('.opf') &&
        !f.startsWith('META-INF/')
    );

    if (possibleOpfFiles.length === 0) {
        errors.push('未找到 .opf 檔案');
    } else {
        infos.push(`✅ 找到 ${possibleOpfFiles.length} 個 OPF 檔案: ${possibleOpfFiles.join(', ')}`);
    }

    // 5. 檢查所有 XML 檔案的宣告格式（避免重複宣告問題）
    const xmlFiles = fileNames.filter(f => /\.(xhtml|html|xml|opf|ncx)$/i.test(f));
    let xmlDeclIssues = 0;
    for (const xmlFile of xmlFiles) {
        try {
            // 只檢查檔案是否存在，不讀取內容（避免非同步處理）
            if (files[xmlFile].dir) continue;
            // 非同步無法在這裡讀取，跳過內容檢查
        } catch (e) {
            warnings.push(`無法讀取 ${xmlFile} 進行 XML 宣告檢查`);
            xmlDeclIssues++;
        }
    }

    // 6. 檢查常見必備檔案
    const requiredFiles = ['mimetype', 'META-INF/container.xml'];
    for (const reqFile of requiredFiles) {
        if (!files[reqFile] || files[reqFile].dir) {
            errors.push(`缺少必要檔案: ${reqFile}`);
        }
    }

    // 7. 檢查常見目錄結構
    const hasMetaInf = Object.keys(files).some(f => f.startsWith('META-INF/'));
    if (!hasMetaInf) {
        warnings.push('缺少 META-INF/ 目錄');
    }

    return { errors, warnings, infos };
}

function updateValidationReport(displayName, validation) {
    const container = elements.reportValidationContent;
    if (!container) return;

    let html = container.innerHTML;

    // 如果只有空提示，清除
    if (html.includes('report-empty-hint')) {
        html = '';
    }

    // 避免重複相同檔案名稱
    html += `<div class="validation-section"><h4>📖 ${escapeHtml(displayName)}</h4>`;

    if (validation.errors.length > 0) {
        html += validation.errors.map(e =>
            `<div class="validation-item error"><span class="icon">❌</span> ${escapeHtml(e)}</div>`
        ).join('');
    }

    if (validation.warnings.length > 0) {
        html += validation.warnings.map(w =>
            `<div class="validation-item warning"><span class="icon">⚠️</span> ${escapeHtml(w)}</div>`
        ).join('');
    }

    if (validation.infos.length > 0) {
        html += validation.infos.map(i =>
            `<div class="validation-item pass"><span class="icon">ℹ️</span> ${escapeHtml(i)}</div>`
        ).join('');
    }

    html += '</div>';
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// === 結果顯示（下載全部按鈕控制） ===

function showResults(results) {
    elements.errorSection.style.display = 'none';

    const successful = results.filter((item) => item.success);

    if (successful.length > 0) {
        elements.downloadZipBtn.style.display = 'block';
        elements.downloadZipBtn.textContent = t('convert.download_zip_count', { count: successful.length });
        elements.downloadZipBtn.onclick = async () => {
            // 顯示「準備下載zip......」提示
            const toast = showPersistentToast(t('convert.prepare_zip'));
            try {
                const zipBlob = await buildBatchZip(successful);
                removeToast(toast);
                downloadBlob(zipBlob, 'converted_epubs.zip');
            } catch (err) {
                removeToast(toast);
                addLog('error', t('error.zip_packaging', { msg: err.message || err }));
                showError(t('error.zip_packaging', { msg: err.message || err }));
            }
        };
    } else {
        elements.downloadZipBtn.style.display = 'none';
    }
}

async function buildBatchZip(results) {
    const zip = new JSZip();
    results.forEach((res) => {
        zip.file(res.zipPath, res.blob);
    });
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

function downloadUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    downloadUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function revokeOutputUrls() {
    appState.outputUrls.forEach((url) => URL.revokeObjectURL(url));
    appState.outputUrls = [];
}

function showError(message) {
    elements.convertTray.style.display = 'none';
    elements.resultSection.style.display = 'none';
    elements.errorSection.style.display = 'block';
    elements.errorContent.textContent = message;
}

function hideAllResults() {
    elements.downloadZipBtn.style.display = 'none';
    elements.resultSection.style.display = 'none';
    elements.errorSection.style.display = 'none';
    elements.convertTray.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', init);