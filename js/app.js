/**
 * TypeHero 遊戲核心驅動邏輯 (App Controller)
 * 整合：
 * 1. 雙語虛擬鍵盤 (QWERTY + 大千注音) 渲染與動態高亮
 * 2. 左右手 10 指指法動態引導 SVG
 * 3. 完美支援 Windows 微軟注音等中文輸入法 (IME Composition) 與實體鍵位盲打雙軌機制
 * 4. 嚴格精準的準確率計算（消除 0% 誤判為 100% 的問題）
 * 5. 70% 準確率通關門檻與循序關卡解鎖機制
 * 6. 連擊 Combo 系統與 FEVER 狂熱模式動態特效
 * 7. 結算獎勵、商城購買與排行榜互動
 */

// 鍵盤排版資料規格
const KEYBOARD_LAYOUT = [
  // 第 1 排：數字列與聲調
  [
    { key: '`', shift: '~', zh: '', code: 'Backquote', width: 'key-std', finger: 'LP' },
    { key: '1', shift: '!', zh: 'ㄅ', code: 'Digit1', width: 'key-std', finger: 'LP' },
    { key: '2', shift: '@', zh: 'ㄉ', code: 'Digit2', width: 'key-std', finger: 'LR' },
    { key: '3', shift: '#', zh: 'ˇ', code: 'Digit3', width: 'key-std', finger: 'LM' },
    { key: '4', shift: '$', zh: 'ˋ', code: 'Digit4', width: 'key-std', finger: 'LI' },
    { key: '5', shift: '%', zh: 'ㄓ', code: 'Digit5', width: 'key-std', finger: 'LI' },
    { key: '6', shift: '^', zh: 'ˊ', code: 'Digit6', width: 'key-std', finger: 'RI' },
    { key: '7', shift: '&', zh: '˙', code: 'Digit7', width: 'key-std', finger: 'RI' },
    { key: '8', shift: '*', zh: 'ㄚ', code: 'Digit8', width: 'key-std', finger: 'RM' },
    { key: '9', shift: '(', zh: 'ㄞ', code: 'Digit9', width: 'key-std', finger: 'RR' },
    { key: '0', shift: ')', zh: 'ㄢ', code: 'Digit0', width: 'key-std', finger: 'RP' },
    { key: '-', shift: '_', zh: 'ㄦ', code: 'Minus', width: 'key-std', finger: 'RP' },
    { key: '=', shift: '+', zh: '', code: 'Equal', width: 'key-std', finger: 'RP' },
    { key: 'backspace', text: 'Back', code: 'Backspace', width: 'key-back', finger: 'RP' }
  ],
  // 第 2 排：上排 (QWERTY)
  [
    { key: 'tab', text: 'Tab', code: 'Tab', width: 'key-tab', finger: 'LP' },
    { key: 'q', shift: 'Q', zh: 'ㄆ', code: 'KeyQ', width: 'key-std', finger: 'LP' },
    { key: 'w', shift: 'W', zh: 'ㄊ', code: 'KeyW', width: 'key-std', finger: 'LR' },
    { key: 'e', shift: 'E', zh: 'ㄍ', code: 'KeyE', width: 'key-std', finger: 'LM' },
    { key: 'r', shift: 'R', zh: 'ㄐ', code: 'KeyR', width: 'key-std', finger: 'LI' },
    { key: 't', shift: 'T', zh: 'ㄔ', code: 'KeyT', width: 'key-std', finger: 'LI' },
    { key: 'y', shift: 'Y', zh: 'ㄗ', code: 'KeyY', width: 'key-std', finger: 'RI' },
    { key: 'u', shift: 'U', zh: 'ㄧ', code: 'KeyU', width: 'key-std', finger: 'RI' },
    { key: 'i', shift: 'I', zh: 'ㄛ', code: 'KeyI', width: 'key-std', finger: 'RM' },
    { key: 'o', shift: 'O', zh: 'ㄟ', code: 'KeyO', width: 'key-std', finger: 'RR' },
    { key: 'p', shift: 'P', zh: 'ㄣ', code: 'KeyP', width: 'key-std', finger: 'RP' },
    { key: '[', shift: '{', zh: '', code: 'BracketLeft', width: 'key-std', finger: 'RP' },
    { key: ']', shift: '}', zh: '', code: 'BracketRight', width: 'key-std', finger: 'RP' }
  ],
  // 第 3 排：中排 (Home Row 基準排)
  [
    { key: 'capslock', text: 'Caps', code: 'CapsLock', width: 'key-caps', finger: 'LP' },
    { key: 'a', shift: 'A', zh: 'ㄇ', code: 'KeyA', width: 'key-std', finger: 'LP' },
    { key: 's', shift: 'S', zh: 'ㄋ', code: 'KeyS', width: 'key-std', finger: 'LR' },
    { key: 'd', shift: 'D', zh: 'ㄎ', code: 'KeyD', width: 'key-std', finger: 'LM' },
    { key: 'f', shift: 'F', zh: 'ㄑ', code: 'KeyF', width: 'key-std', finger: 'LI' },
    { key: 'g', shift: 'G', zh: 'ㄕ', code: 'KeyG', width: 'key-std', finger: 'LI' },
    { key: 'h', shift: 'H', zh: 'ㄘ', code: 'KeyH', width: 'key-std', finger: 'RI' },
    { key: 'j', shift: 'J', zh: 'ㄨ', code: 'KeyJ', width: 'key-std', finger: 'RI' },
    { key: 'k', shift: 'K', zh: 'ㄜ', code: 'KeyK', width: 'key-std', finger: 'RM' },
    { key: 'l', shift: 'L', zh: 'ㄠ', code: 'KeyL', width: 'key-std', finger: 'RR' },
    { key: ';', shift: ':', zh: 'ㄤ', code: 'Semicolon', width: 'key-std', finger: 'RP' },
    { key: "'", shift: '"', zh: '', code: 'Quote', width: 'key-std', finger: 'RP' },
    { key: 'enter', text: 'Enter', code: 'Enter', width: 'key-enter', finger: 'RP' }
  ],
  // 第 4 排：下排
  [
    { key: 'shift-l', text: 'Shift', code: 'ShiftLeft', width: 'key-shift-l', finger: 'LP' },
    { key: 'z', shift: 'Z', zh: 'ㄈ', code: 'KeyZ', width: 'key-std', finger: 'LP' },
    { key: 'x', shift: 'X', zh: 'ㄌ', code: 'KeyX', width: 'key-std', finger: 'LR' },
    { key: 'c', shift: 'C', zh: 'ㄏ', code: 'KeyC', width: 'key-std', finger: 'LM' },
    { key: 'v', shift: 'V', zh: 'ㄒ', code: 'KeyV', width: 'key-std', finger: 'LI' },
    { key: 'b', shift: 'B', zh: 'ㄖ', code: 'KeyB', width: 'key-std', finger: 'LI' },
    { key: 'n', shift: 'N', zh: 'ㄙ', code: 'KeyN', width: 'key-std', finger: 'RI' },
    { key: 'm', shift: 'M', zh: 'ㄩ', code: 'KeyM', width: 'key-std', finger: 'RI' },
    { key: ',', shift: '<', zh: 'ㄝ', code: 'Comma', width: 'key-std', finger: 'RM' },
    { key: '.', shift: '>', zh: 'ㄡ', code: 'Period', width: 'key-std', finger: 'RR' },
    { key: '/', shift: '?', zh: 'ㄥ', code: 'Slash', width: 'key-std', finger: 'RP' },
    { key: 'shift-r', text: 'Shift', code: 'ShiftRight', width: 'key-shift-r', finger: 'RP' }
  ],
  // 第 5 排：空白鍵
  [
    { key: 'space', text: 'Space (空白鍵 · 一聲)', code: 'Space', width: 'key-space', finger: 'RT' }
  ]
];

// 左右手 10 指詳細指法配置 (手指名稱、顏色、方向圖示)
const FINGER_INFO = {
  'LP': { hand: '左手', finger: '小指', en: 'Left Pinky', color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)', icon: '👈', homeKey: 'A' },
  'LR': { hand: '左手', finger: '無名指', en: 'Left Ring', color: '#fb923c', glow: 'rgba(251, 146, 60, 0.45)', icon: '👈', homeKey: 'S' },
  'LM': { hand: '左手', finger: '中指', en: 'Left Middle', color: '#10b981', glow: 'rgba(16, 185, 129, 0.45)', icon: '☝️', homeKey: 'D' },
  'LI': { hand: '左手', finger: '食指', en: 'Left Index', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)', icon: '👉', homeKey: 'F' },
  'LT': { hand: '左手', finger: '大拇指', en: 'Left Thumb', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.45)', icon: '👍', homeKey: 'Space' },
  'RT': { hand: '右手', finger: '大拇指', en: 'Right Thumb', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.45)', icon: '👍', homeKey: 'Space' },
  'RI': { hand: '右手', finger: '食指', en: 'Right Index', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)', icon: '👈', homeKey: 'J' },
  'RM': { hand: '右手', finger: '中指', en: 'Right Middle', color: '#10b981', glow: 'rgba(16, 185, 129, 0.45)', icon: '☝️', homeKey: 'K' },
  'RR': { hand: '右手', finger: '無名指', en: 'Right Ring', color: '#fb923c', glow: 'rgba(251, 146, 60, 0.45)', icon: '👉', homeKey: 'L' },
  'RP': { hand: '右手', finger: '小指', en: 'Right Pinky', color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)', icon: '👉', homeKey: ';' }
};

// 通關門檻標準：擊鍵準確率需達 70% 以上
const PASS_ACCURACY_THRESHOLD = 70;

// 全域遊戲狀態
let gameState = {
  currentCategory: 'zhuyin', // 'zhuyin' | 'chinese' | 'english'
  currentLesson: null,
  currentIndex: 0,
  subCharIndex: 0, // 簡易注音音節子按鍵進度 (0, 1, 2, 3...)
  correctCount: 0,
  totalKeyStrokes: 0,
  comboCount: 0,
  comboMax: 0,
  startTime: null,
  timerInterval: null,
  isFocused: false,
  isComposing: false // 輸入法組字狀態
};

// ----------------------------------------------------
// 1. 初始化與事件掛載
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  renderBilingualKeyboard();
  initCustomLessonSystem();
  initTabs();
  initModals();
  initShopUI();
  initInputListeners();
  initOpacityControls();

  // 預設載入注音第 1 關
  loadCategory('zhuyin');

  // 語音朗讀發音按鈕綁定 (Proposal III.1.1)
  const speakBtn = document.getElementById('btn-speak-text');
  if (speakBtn) speakBtn.onclick = speakPromptText;

  // 頂部導航成就榮譽牆按鈕綁定 (Proposal IV.3 & Req 6)
  const achModal = document.getElementById('modal-achievements');
  const achBtn = document.getElementById('nav-btn-achievements') || document.getElementById('btn-open-achievements');
  const closeAchBtn = document.getElementById('close-achievements-btn');
  if (achBtn && achModal) {
    achBtn.onclick = () => {
      renderAchievements();
      achModal.classList.add('active');
    };
  }
  if (closeAchBtn && achModal) {
    closeAchBtn.onclick = () => {
      achModal.classList.remove('active');
    };
  }

  // 初始化班級下拉選單與學生身分顯示
  if (window.cloudSync) {
    window.cloudSync.populateClassSelects();
    window.cloudSync.updateProfileBadgeUI();

    // 背景自雲端還原（若本機已有註冊學生身分）
    const curP = window.cloudSync.profile;
    if (curP && curP.hasRegistered && curP.className && curP.seatNumber) {
      window.cloudSync.loadProfileFromCloud(curP.className, curP.seatNumber).then(cloudData => {
        if (cloudData && gameState.currentCategory && window.COURSES) {
          renderLessonsGrid(window.COURSES[gameState.currentCategory]);
        }
      });
    }
  }

  // 需求 6: 全螢幕練習按鈕綁定
  const fsBtn = document.getElementById('btn-fullscreen');
  const fsIcon = document.getElementById('fullscreen-icon');
  if (fsBtn) {
    fsBtn.onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('全螢幕啟用受限:', err);
        });
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      if (fsIcon) fsIcon.innerText = isFs ? '✕' : '⛶';
      fsBtn.title = isFs ? '退出全螢幕 (Esc)' : '切換全螢幕練習模式';
      document.body.classList.toggle('in-fullscreen-mode', isFs);
      if (window.handsOverlay) {
        window.handsOverlay.updatePositions();
        window.handsOverlay.render();
      }
    });
  }

  // 頂部導航列雲端狀態徽章點擊
  const cloudPill = document.getElementById('cloud-status-pill');
  if (cloudPill) {
    cloudPill.onclick = () => {
      if (window.openAdminAuthModal) window.openAdminAuthModal();
    };
  }

  // 載入首頁先跳出學生班級、座號與姓名登載彈窗
  const loginModal = document.getElementById('modal-student-login');
  if (loginModal) {
    loginModal.classList.add('active');
    const p = window.cloudSync ? window.cloudSync.profile : null;
    const seatInp = document.getElementById('login-seat-input');
    const nameInp = document.getElementById('login-name-input');
    const classSel = document.getElementById('login-class-select');
    const passInp = document.getElementById('login-password-input');
    if (seatInp) seatInp.value = (p && p.seatNumber) ? p.seatNumber : '';
    // 需求 1: 預設為空白，無暱稱時留空顯示「請設定您的暱稱」placeholder
    if (nameInp) nameInp.value = '';
    // 需求: 網頁載入🏫 選擇所屬班級 可停留在"=選擇班級="
    if (classSel) classSel.value = '';
    if (passInp) passInp.value = '';
  }

  // 點擊舞台聚焦真實輸入框
  const arena = document.getElementById('typing-arena');
  const alertOverlay = document.getElementById('focus-alert');

  if (arena) arena.onclick = focusTyping;
  if (alertOverlay) alertOverlay.onclick = focusTyping;

  // 重來按鈕
  document.getElementById('btn-restart-lesson').onclick = () => {
    if (gameState.currentLesson) selectLesson(gameState.currentLesson.id);
  };

  // 音效開關切換
  document.getElementById('toggle-sound').onclick = () => {
    const isMuted = window.soundEngine ? window.soundEngine.toggleMute() : false;
    document.getElementById('sound-icon').innerText = isMuted ? '🔇' : '🔊';
  };

  // 視窗尺寸改變時重新校準浮動手指指示器位置
  window.addEventListener('resize', () => {
    if (gameState.currentLesson) {
      highlightTarget(gameState.currentLesson.text[gameState.currentIndex]);
    }
  });

  // 更新初始玩家數值顯示
  if (window.shopManager) window.shopManager.updateUI();
});

// ----------------------------------------------------
// 2. 中文輸入法 (IME) 與鍵盤事件綁定核心
// ----------------------------------------------------
function initInputListeners() {
  const inputEl = document.getElementById('typing-input');
  if (!inputEl) return;

  // 輸入法開始組字 (例如輸入 ㄌㄠˇ)
  inputEl.addEventListener('compositionstart', () => {
    gameState.isComposing = true;
    const alertEl = document.getElementById('ime-smart-alert');
    if (alertEl) alertEl.classList.add('hidden');
    const badge = document.getElementById('ime-preview-badge');
    if (badge) badge.classList.remove('hidden');
    const preview = document.getElementById('ime-preview-text');
    if (preview) preview.innerText = '';
  });

  // 輸入法組字中即時更新
  inputEl.addEventListener('compositionupdate', (e) => {
    const preview = document.getElementById('ime-preview-text');
    if (preview) preview.innerText = e.data || '';
  });

  // 輸入法完成選字送出 (例如選了 "老")
  inputEl.addEventListener('compositionend', (e) => {
    gameState.isComposing = false;
    const badge = document.getElementById('ime-preview-badge');
    if (badge) badge.classList.add('hidden');
    const preview = document.getElementById('ime-preview-text');
    if (preview) preview.innerText = '';

    const committed = e.data || '';
    if (committed) {
      processCommittedText(committed);
    }
    inputEl.value = '';
  });

  // 直接文字輸入 (非 IME 情況，如英文、數字、空白或部分標點)
  inputEl.addEventListener('input', () => {
    if (gameState.isComposing) return;
    const val = inputEl.value;
    if (val) {
      processCommittedText(val);
      inputEl.value = '';
    }
  });

  // 鍵盤輔助按鍵監聽 (Backspace, Tab 等)
  inputEl.addEventListener('keydown', (e) => {
    // 若正在輸入法組字中，放行所有鍵（讓微軟注音選字、方向鍵與 Enter 正常運作）
    if (gameState.isComposing || e.isComposing || e.key === 'Process') {
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }

    if (e.key === 'Backspace') {
      if (gameState.subCharIndex > 0) {
        gameState.subCharIndex--;
        highlightTarget();
      }
      if (window.soundEngine) window.soundEngine.playKey('special', gameState.comboCount);
      return;
    }

    if (e.key === 'Escape') {
      blurTyping();
      return;
    }

    // 若為空白鍵且不在組字中，即時觸發
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      processCommittedText(' ');
      inputEl.value = '';
    }
  });

  // 焦點追蹤
  inputEl.addEventListener('focus', () => {
    gameState.isFocused = true;
    document.getElementById('focus-alert').classList.add('hidden');
  });

  inputEl.addEventListener('blur', () => {
    // 稍微延遲以避免因點擊彈窗產生閃爍
    setTimeout(() => {
      if (document.activeElement !== inputEl) {
        gameState.isFocused = false;
        document.getElementById('focus-alert').classList.remove('hidden');
      }
    }, 150);
  });
}

function focusTyping() {
  const inputEl = document.getElementById('typing-input');
  if (inputEl) {
    inputEl.focus();
    gameState.isFocused = true;
    document.getElementById('focus-alert').classList.add('hidden');
  }
}

function blurTyping() {
  const inputEl = document.getElementById('typing-input');
  if (inputEl) inputEl.blur();
  gameState.isFocused = false;
  document.getElementById('focus-alert').classList.remove('hidden');
}

// 需求 5: 智慧輸入法防呆切換泡泡提示
let imeAlertTimer = null;
function showImeSmartAlert() {
  const alertEl = document.getElementById('ime-smart-alert');
  if (!alertEl) return;
  alertEl.classList.remove('hidden');
  if (imeAlertTimer) clearTimeout(imeAlertTimer);
  imeAlertTimer = setTimeout(() => {
    alertEl.classList.add('hidden');
  }, 4000);
}

// ----------------------------------------------------
// 3. 簡易注音音節拆解與鍵位映射核心 (免選字、免切換輸入法)
// ----------------------------------------------------
function getCharSubKeys(char) {
  if (!char) return [];

  // 1. 標點符號 (支援英數狀態直接敲擊實體鍵)
  const puncMap = {
    '，': { key: ',', label: '， (,)', pureZhuyin: '，', hint: '逗號' },
    '。': { key: '.', label: '。 (.)', pureZhuyin: '。', hint: '句號' },
    '！': { key: '!', altKey: '1', label: '！ (Shift+1 或 1)', pureZhuyin: '！', hint: '驚嘆號' },
    '？': { key: '?', altKey: '/', label: '？ (Shift+/ 或 /)', pureZhuyin: '？', hint: '問號' },
    '：': { key: ':', altKey: ';', label: '： (Shift+;)', pureZhuyin: '：', hint: '冒號' },
    '；': { key: ';', label: '； (;)', pureZhuyin: '；', hint: '分號' },
    '、': { key: "'", label: "、 (')", pureZhuyin: '、', hint: '頓號' },
    '「': { key: '[', label: '「 ([)', pureZhuyin: '「', hint: '左引號' },
    '」': { key: ']', label: '」 (])', pureZhuyin: '」', hint: '右引號' },
    ',': { key: ',', label: ',', pureZhuyin: ',' },
    '.': { key: '.', label: '.', pureZhuyin: '.' },
    '!': { key: '!', altKey: '1', label: '!', pureZhuyin: '!' },
    '?': { key: '?', altKey: '/', label: '?', pureZhuyin: '?' },
    ':': { key: ':', altKey: ';', label: ':', pureZhuyin: ':' },
    ';': { key: ';', label: ';', pureZhuyin: ';' },
    "'": { key: "'", label: "'", pureZhuyin: "'" },
    '[': { key: '[', label: '[', pureZhuyin: '[' },
    ']': { key: ']', label: ']', pureZhuyin: ']' }
  };
  if (puncMap[char]) return [puncMap[char]];

  // 2. 空白鍵
  if (char === ' ') {
    return [{ key: ' ', label: '空白鍵 (Space)', pureZhuyin: '空白鍵', isSpace: true }];
  }

  // 3. 注音符號盲打 (ZHUYIN_COURSE 中的單一注音或聲調)
  if (window.ZHUYIN_KEY_MAP && window.ZHUYIN_KEY_MAP[char]) {
    const pk = window.ZHUYIN_KEY_MAP[char];
    const isTone = (char === 'ˊ' || char === 'ˇ' || char === 'ˋ' || char === '˙');
    const toneName = char === 'ˊ' ? '二聲' : char === 'ˇ' ? '三聲' : char === 'ˋ' ? '四聲' : char === '˙' ? '輕聲' : '';
    return [{ key: pk, label: `${char} (${pk.toUpperCase()}) ${toneName}`.trim(), pureZhuyin: char, zh: char, isTone }];
  }

  // 4. 英文字母或數字
  if (/^[a-zA-Z0-9]$/.test(char)) {
    return [{ key: char.toLowerCase(), label: char.toUpperCase(), pureZhuyin: char.toUpperCase() }];
  }

  // 5. 中文字詞：免選字音節拆解 (依據 ZHUYIN_CHAR_MAP 拆為大千注音鍵位)
  // 需求 1: 拿掉鍵盤符號，保持單純注音符號 (例如 老：ㄌ ㄠ ˇ)
  if (window.ZHUYIN_CHAR_MAP && window.ZHUYIN_CHAR_MAP[char]) {
    const zhStr = window.ZHUYIN_CHAR_MAP[char];
    const steps = [];
    let hasTone = false;
    let lightTone = false;

    for (const z of zhStr) {
      if (z === '˙') {
        lightTone = true;
        hasTone = true;
      } else if (z === 'ˊ' || z === 'ˇ' || z === 'ˋ') {
        hasTone = true;
        const k = window.ZHUYIN_KEY_MAP ? window.ZHUYIN_KEY_MAP[z] : null;
        const toneName = z === 'ˊ' ? '二聲' : z === 'ˇ' ? '三聲' : '四聲';
        if (k) steps.push({ key: k, label: `${z} (${k}) ${toneName}`, pureZhuyin: z, zh: z, isTone: true });
      } else {
        const k = window.ZHUYIN_KEY_MAP ? window.ZHUYIN_KEY_MAP[z] : null;
        if (k) steps.push({ key: k, label: `${z} (${k.toUpperCase()})`, pureZhuyin: z, zh: z });
      }
    }

    if (lightTone) {
      steps.push({ key: '7', label: '˙ (7) 輕聲', pureZhuyin: '˙', zh: '˙', isTone: true });
    } else if (!hasTone) {
      // 一聲以空白鍵完成，純注音顯示為「一聲」
      steps.push({ key: ' ', label: '一聲 (Space)', pureZhuyin: '一聲', zh: '一聲', isTone: true, isSpace: true });
    }

    return steps;
  }

  return [{ key: char, label: char, pureZhuyin: char }];
}

function isSubKeyMatch(typed, step) {
  if (!step) return false;
  const t = typed.toLowerCase();
  const k = step.key.toLowerCase();
  if (t === k) return true;
  if (step.altKey && t === step.altKey.toLowerCase()) return true;

  // 常用符號直接敲擊容錯
  if (k === '!' && (t === '1' || t === '!')) return true;
  if (k === '?' && (t === '/' || t === '?')) return true;
  if (k === ':' && (t === ';' || t === ':')) return true;
  if (k === '，' && t === ',') return true;
  if (k === '。' && t === '.') return true;

  return false;
}

// ----------------------------------------------------
// 4. 輸入字元推進與正誤判定 (簡易注音免選字核心)
// ----------------------------------------------------
function processCommittedText(text) {
  if (!text || !gameState.currentLesson) return;

  // 首次敲擊開始計時
  if (!gameState.startTime) {
    gameState.startTime = Date.now();
    gameState.timerInterval = setInterval(updateStats, 1000);
  }

  const targetText = gameState.currentLesson.text;
  const streamSpans = document.getElementById('typing-stream').children;

  for (let i = 0; i < text.length; i++) {
    if (gameState.currentIndex >= targetText.length) break;

    const typedChar = text[i];
    const expectedChar = targetText[gameState.currentIndex];
    const subKeys = getCharSubKeys(expectedChar);
    if (subKeys.length === 0) {
      gameState.currentIndex++;
      continue;
    }

    const currentStep = subKeys[gameState.subCharIndex] || subKeys[0];

    // 每次有效按鍵敲擊，計數器累加
    gameState.totalKeyStrokes++;

    // 1. 若整字完全一致 (例如直接貼上或輸入法直接送出中文「老」)
    if (typedChar === expectedChar) {
      gameState.correctCount++;
      gameState.comboCount++;
      if (gameState.comboCount > gameState.comboMax) gameState.comboMax = gameState.comboCount;
      updateComboUI(gameState.comboCount);
      if (typeof updateMascot === 'function') updateMascot('combo', gameState.comboCount);

      const activeTargetEl = document.querySelector('.key-target');
      const activeFinger = activeTargetEl ? activeTargetEl.dataset.finger : null;
      if (window.handsOverlay) window.handsOverlay.onKeyPress(activeFinger);
      if (expectedChar === ' ') {
        if (window.soundEngine) window.soundEngine.playKey('space', gameState.comboCount);
      } else {
        if (window.soundEngine) window.soundEngine.playKey('std', gameState.comboCount);
      }

      streamSpans[gameState.currentIndex].className = 'char-correct';
      gameState.currentIndex++;
      gameState.subCharIndex = 0;

      if (gameState.currentIndex >= targetText.length) {
        finishLesson();
        return;
      } else {
        streamSpans[gameState.currentIndex].className = 'char-pending char-cursor';
        highlightTarget();
      }
      continue;
    }

    // 2. 判斷子鍵位是否匹配
    const isStepMatched = isSubKeyMatch(typedChar, currentStep);

    if (isStepMatched) {
      gameState.correctCount++;
      gameState.subCharIndex++;

      const activeTargetEl = document.querySelector('.key-target');
      const activeFinger = activeTargetEl ? activeTargetEl.dataset.finger : null;
      if (window.handsOverlay) window.handsOverlay.onKeyPress(activeFinger);

      // 檢查是否整字完成
      if (gameState.subCharIndex >= subKeys.length) {
        // 整字完成！
        gameState.comboCount++;
        if (gameState.comboCount > gameState.comboMax) gameState.comboMax = gameState.comboCount;
        updateComboUI(gameState.comboCount);
        if (typeof updateMascot === 'function') updateMascot('combo', gameState.comboCount);

        if (currentStep.key === ' ' || expectedChar === ' ') {
          if (window.soundEngine) window.soundEngine.playKey('space', gameState.comboCount);
        } else {
          if (window.soundEngine) window.soundEngine.playKey('std', gameState.comboCount);
        }

        streamSpans[gameState.currentIndex].className = 'char-correct';
        gameState.currentIndex++;
        gameState.subCharIndex = 0;

        if (gameState.currentIndex >= targetText.length) {
          finishLesson();
          return;
        } else {
          streamSpans[gameState.currentIndex].className = 'char-pending char-cursor';
          highlightTarget();
        }
      } else {
        // 子鍵位正確，繼續敲擊同一個字的下一個注音！
        if (currentStep.key === ' ') {
          if (window.soundEngine) window.soundEngine.playKey('space', gameState.comboCount);
        } else {
          if (window.soundEngine) window.soundEngine.playKey('std', gameState.comboCount);
        }
        highlightTarget();
      }
    } else {
      // 3. 容錯處理：若當前步驟為一聲空白鍵，而學生直接按下下一個字的起首注音鍵，自動完成前一個字！
      if (currentStep.key === ' ' && gameState.currentIndex + 1 < targetText.length) {
        const nextChar = targetText[gameState.currentIndex + 1];
        const nextSubKeys = getCharSubKeys(nextChar);
        if (nextSubKeys.length > 0 && isSubKeyMatch(typedChar, nextSubKeys[0])) {
          streamSpans[gameState.currentIndex].className = 'char-correct';
          gameState.currentIndex++;
          gameState.subCharIndex = 1; // 下一個字的第一個鍵已命中！
          gameState.correctCount += 2;
          gameState.comboCount++;
          if (gameState.comboCount > gameState.comboMax) gameState.comboMax = gameState.comboCount;
          updateComboUI(gameState.comboCount);

          if (window.soundEngine) window.soundEngine.playKey('std', gameState.comboCount);

          if (nextSubKeys.length === 1) {
            streamSpans[gameState.currentIndex].className = 'char-correct';
            gameState.currentIndex++;
            gameState.subCharIndex = 0;
          }

          if (gameState.currentIndex >= targetText.length) {
            finishLesson();
            return;
          } else {
            streamSpans[gameState.currentIndex].className = 'char-pending char-cursor';
            highlightTarget();
          }
          continue;
        }
      }

      // 4. 輸入錯誤：震動警示與中斷連擊，但不卡關死當，讓學生可立刻按出正確按鍵
      gameState.comboCount = 0;
      updateComboUI(0);
      if (typeof updateMascot === 'function') updateMascot('wrong');
      if (window.soundEngine) window.soundEngine.playError();

      const curSpan = streamSpans[gameState.currentIndex];
      if (curSpan) {
        curSpan.classList.add('char-wrong');
        setTimeout(() => {
          if (curSpan.className.includes('char-wrong')) curSpan.classList.remove('char-wrong');
        }, 350);
      }
    }
  }

  updateStats();
}

// ----------------------------------------------------
// 5.0 半透明人體工學十指盲打指法動態引導管理器 (Transparent Hands Overlay)
// ----------------------------------------------------
class HandsOverlayManager {
  constructor() {
    this.container = document.getElementById('keyboard-rows-container');
    this.wrapper = document.getElementById('hands-overlay-wrapper');
    this.svg = document.getElementById('hands-overlay-svg');
    this.palmsLayer = document.getElementById('hands-layer-palms');
    this.fingersLayer = document.getElementById('hands-layer-fingers');
    this.beaconsLayer = document.getElementById('hands-layer-beacons');

    this.activeFinger = null;
    this.activeKeyId = null;

    this.fingersConfig = {
      'LP': { hand: 'left',  name: '小指',   homeKey: 'key-a',     wBase: 22, wTip: 17 },
      'LR': { hand: 'left',  name: '無名指', homeKey: 'key-s',     wBase: 24, wTip: 18.5 },
      'LM': { hand: 'left',  name: '中指',   homeKey: 'key-d',     wBase: 25, wTip: 19.5 },
      'LI': { hand: 'left',  name: '食指',   homeKey: 'key-f',     wBase: 24, wTip: 18.5 },
      'LT': { hand: 'left',  name: '大拇指', homeKey: 'key-space', wBase: 27, wTip: 21, thumbSide: -1 },

      'RT': { hand: 'right', name: '大拇指', homeKey: 'key-space', wBase: 27, wTip: 21, thumbSide: 1 },
      'RI': { hand: 'right', name: '食指',   homeKey: 'key-j',     wBase: 24, wTip: 18.5 },
      'RM': { hand: 'right', name: '中指',   homeKey: 'key-k',     wBase: 25, wTip: 19.5 },
      'RR': { hand: 'right', name: '無名指', homeKey: 'key-l',     wBase: 24, wTip: 18.5 },
      'RP': { hand: 'right', name: '小指',   homeKey: 'key-;',     wBase: 22, wTip: 17 }
    };

    this.currentTips = {};
    this.targetTips = {};
    this.homeTips = {};
    this.knuckles = {};
    this.wristLeft = null;
    this.wristRight = null;
    this.initialized = false;
    this.rafId = null;

    this.init();
  }

  init() {
    this.updatePositions();
    if (this.initialized) {
      Object.keys(this.fingersConfig).forEach(f => {
        if (this.homeTips[f]) {
          this.currentTips[f] = { ...this.homeTips[f] };
          this.targetTips[f] = { ...this.homeTips[f] };
        }
      });
      this.render();
    }
    this.startLoop();

    window.addEventListener('resize', () => {
      this.updatePositions();
      this.render();
    });
  }

  updatePositions() {
    this.container = document.getElementById('keyboard-rows-container');
    if (!this.container) return;
    const cRect = this.container.getBoundingClientRect();
    if (cRect.width <= 0) return;

    const getKeyPos = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.left - cRect.left + r.width / 2,
        y: r.top - cRect.top + r.height / 2,
        top: r.top - cRect.top,
        bottom: r.bottom - cRect.top,
        left: r.left - cRect.left,
        right: r.right - cRect.left,
        width: r.width,
        height: r.height
      };
    };

    const space = getKeyPos('key-space');
    const keyA = getKeyPos('key-a');
    const keyS = getKeyPos('key-s');
    const keyD = getKeyPos('key-d');
    const keyF = getKeyPos('key-f');
    const keyJ = getKeyPos('key-j');
    const keyK = getKeyPos('key-k');
    const keyL = getKeyPos('key-l');
    const keySemi = getKeyPos('key-;');

    const keyZ = getKeyPos('key-z');
    const keyX = getKeyPos('key-x');
    const keyC = getKeyPos('key-c');
    const keyV = getKeyPos('key-v');
    const keyM = getKeyPos('key-m');
    const keyComma = getKeyPos('key-,');
    const keyPeriod = getKeyPos('key-.');
    const keySlash = getKeyPos('key-/');

    if (!space || !keyA || !keyJ) return;

    // Home Row 基準鍵停放位置
    this.homeTips['LP'] = { x: keyA.x, y: keyA.y };
    this.homeTips['LR'] = { x: keyS.x, y: keyS.y };
    this.homeTips['LM'] = { x: keyD.x, y: keyD.y };
    this.homeTips['LI'] = { x: keyF.x, y: keyF.y };
    this.homeTips['LT'] = { x: space.x - space.width * 0.22, y: space.y - 2 };

    this.homeTips['RT'] = { x: space.x + space.width * 0.22, y: space.y - 2 };
    this.homeTips['RI'] = { x: keyJ.x, y: keyJ.y };
    this.homeTips['RM'] = { x: keyK.x, y: keyK.y };
    this.homeTips['RR'] = { x: keyL.x, y: keyL.y };
    this.homeTips['RP'] = { x: keySemi.x, y: keySemi.y };

    // 掌指關節基底
    const leftBaseY = keyX ? (keyX.bottom + 8) : (keyS.bottom + 48);
    const rightBaseY = keyComma ? (keyComma.bottom + 8) : (keyK.bottom + 48);

    this.knuckles['LP'] = { x: keyZ ? keyZ.x : (keyA.x - 2), y: keyZ ? (keyZ.bottom + 6) : leftBaseY };
    this.knuckles['LR'] = { x: keyX ? keyX.x : keyS.x, y: leftBaseY };
    this.knuckles['LM'] = { x: keyC ? keyC.x : keyD.x, y: leftBaseY };
    this.knuckles['LI'] = { x: keyV ? keyV.x : keyF.x, y: leftBaseY };
    this.knuckles['LT'] = { x: (this.knuckles['LI'].x + space.x - space.width * 0.28) / 2, y: space.bottom + 8 };

    this.knuckles['RT'] = { x: ((keyM ? keyM.x : keyJ.x) + space.x + space.width * 0.28) / 2, y: space.bottom + 8 };
    this.knuckles['RI'] = { x: keyM ? keyM.x : keyJ.x, y: rightBaseY };
    this.knuckles['RM'] = { x: keyComma ? keyComma.x : keyK.x, y: rightBaseY };
    this.knuckles['RR'] = { x: keyPeriod ? keyPeriod.x : keyL.x, y: rightBaseY };
    this.knuckles['RP'] = { x: keySlash ? keySlash.x : (keySemi.x + 2), y: keySlash ? (keySlash.bottom + 6) : rightBaseY };

    // 鍵盤底緣人體工學手腕輪廓點
    const wristY = cRect.height + 25;
    const leftCenter = (this.knuckles['LP'].x + this.knuckles['LI'].x) / 2;
    this.wristLeft = {
      left: { x: leftCenter - 64, y: wristY },
      right: { x: leftCenter + 56, y: wristY }
    };

    const rightCenter = (this.knuckles['RI'].x + this.knuckles['RP'].x) / 2;
    this.wristRight = {
      left: { x: rightCenter - 56, y: wristY },
      right: { x: rightCenter + 64, y: wristY }
    };

    Object.keys(this.fingersConfig).forEach(f => {
      if (!this.currentTips[f] && this.homeTips[f]) {
        this.currentTips[f] = { ...this.homeTips[f] };
      }
      if (!this.targetTips[f] && this.homeTips[f]) {
        this.targetTips[f] = { ...this.homeTips[f] };
      }
    });

    this.initialized = true;
  }

  setTarget(targetKeyId, targetFinger, char) {
    if (!this.initialized) this.updatePositions();

    this.activeFinger = targetFinger;
    this.activeKeyId = targetKeyId;

    if (!char || !targetKeyId) {
      Object.keys(this.fingersConfig).forEach(f => {
        if (this.homeTips[f]) {
          this.targetTips[f] = { ...this.homeTips[f] };
        }
      });
      return;
    }

    if (this.container && targetFinger && this.targetTips[targetFinger]) {
      const el = document.getElementById(targetKeyId);
      if (el) {
        const cRect = this.container.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        this.targetTips[targetFinger] = {
          x: r.left - cRect.left + r.width / 2,
          y: r.top - cRect.top + r.height / 2
        };
      }
    }

    // 其餘 9 指安定回歸 Home Row
    Object.keys(this.fingersConfig).forEach(f => {
      if (f !== targetFinger && this.homeTips[f]) {
        this.targetTips[f] = { ...this.homeTips[f] };
      }
    });
  }

  onKeyPress(targetFinger) {
    const finger = targetFinger || this.activeFinger;
    if (finger && this.currentTips[finger]) {
      // 模擬指尖敲擊下壓反饋 (即時頓壓 + 回彈)
      this.currentTips[finger].y += 5;
    }
  }

  startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const tick = () => {
      let needsRender = false;
      const now = Date.now();
      const tapOffset = this.activeFinger ? Math.sin(now * 0.0075) * 3.5 : 0;

      Object.keys(this.fingersConfig).forEach(f => {
        const cur = this.currentTips[f];
        const tgt = this.targetTips[f];
        if (!cur || !tgt) return;

        const dx = tgt.x - cur.x;
        const dy = tgt.y - cur.y;
        if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
          cur.x += dx * 0.22;
          cur.y += dy * 0.22;
          needsRender = true;
        } else {
          cur.x = tgt.x;
          cur.y = tgt.y;
        }
      });

      if (this.activeFinger) needsRender = true;

      if (needsRender && this.initialized) {
        this.render(tapOffset);
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  render(tapOffset = 0) {
    if (!this.initialized) return;

    this.palmsLayer = document.getElementById('hands-layer-palms');
    this.fingersLayer = document.getElementById('hands-layer-fingers');
    this.beaconsLayer = document.getElementById('hands-layer-beacons');

    if (!this.palmsLayer || !this.fingersLayer || !this.beaconsLayer) return;

    // 1. 繪製左右手掌 (Soft Semi-Transparent Palms)
    const kLP = this.knuckles['LP'];
    const kLR = this.knuckles['LR'];
    const kLM = this.knuckles['LM'];
    const kLI = this.knuckles['LI'];
    const kLT = this.knuckles['LT'];

    const kRT = this.knuckles['RT'];
    const kRI = this.knuckles['RI'];
    const kRM = this.knuckles['RM'];
    const kRR = this.knuckles['RR'];
    const kRP = this.knuckles['RP'];

    const wLL = this.wristLeft.left;
    const wLR = this.wristLeft.right;
    const wRL = this.wristRight.left;
    const wRR = this.wristRight.right;

    const leftPalmD = `
      M ${wLL.x.toFixed(1)} ${wLL.y.toFixed(1)}
      C ${(wLL.x - 14).toFixed(1)} ${((wLL.y + kLP.y)/2).toFixed(1)}, ${(kLP.x - 18).toFixed(1)} ${(kLP.y + 16).toFixed(1)}, ${(kLP.x - 10).toFixed(1)} ${kLP.y.toFixed(1)}
      L ${kLR.x.toFixed(1)} ${(kLR.y + 2).toFixed(1)}
      L ${kLM.x.toFixed(1)} ${(kLM.y + 2).toFixed(1)}
      L ${kLI.x.toFixed(1)} ${(kLI.y + 2).toFixed(1)}
      C ${(kLI.x + 12).toFixed(1)} ${(kLI.y + 12).toFixed(1)}, ${(kLT.x - 10).toFixed(1)} ${(kLT.y - 14).toFixed(1)}, ${kLT.x.toFixed(1)} ${kLT.y.toFixed(1)}
      C ${(kLT.x + 10).toFixed(1)} ${((kLT.y + wLR.y)/2).toFixed(1)}, ${(wLR.x + 10).toFixed(1)} ${((kLT.y + wLR.y)/2).toFixed(1)}, ${wLR.x.toFixed(1)} ${wLR.y.toFixed(1)}
      L ${wLL.x.toFixed(1)} ${wLL.y.toFixed(1)} Z
    `;

    const rightPalmD = `
      M ${wRR.x.toFixed(1)} ${wRR.y.toFixed(1)}
      C ${(wRR.x + 14).toFixed(1)} ${((wRR.y + kRP.y)/2).toFixed(1)}, ${(kRP.x + 18).toFixed(1)} ${(kRP.y + 16).toFixed(1)}, ${(kRP.x + 10).toFixed(1)} ${kRP.y.toFixed(1)}
      L ${kRR.x.toFixed(1)} ${(kRR.y + 2).toFixed(1)}
      L ${kRM.x.toFixed(1)} ${(kRM.y + 2).toFixed(1)}
      L ${kRI.x.toFixed(1)} ${(kRI.y + 2).toFixed(1)}
      C ${(kRI.x - 12).toFixed(1)} ${(kRI.y + 12).toFixed(1)}, ${(kRT.x + 10).toFixed(1)} ${(kRT.y - 14).toFixed(1)}, ${kRT.x.toFixed(1)} ${kRT.y.toFixed(1)}
      C ${(kRT.x - 10).toFixed(1)} ${((kRT.y + wRL.y)/2).toFixed(1)}, ${(wRL.x - 10).toFixed(1)} ${((kRT.y + wRL.y)/2).toFixed(1)}, ${wRL.x.toFixed(1)} ${wRL.y.toFixed(1)}
      L ${wRR.x.toFixed(1)} ${wRR.y.toFixed(1)} Z
    `;

    this.palmsLayer.innerHTML = `
      <path class="hand-palm-path" d="${leftPalmD}" />
      <path class="hand-palm-path" d="${rightPalmD}" />
    `;

    // 2. 繪製十指 (10 Articulated Fingers)
    let fingersHtml = '';
    let beaconsHtml = '';
    const fingerOrder = ['LP', 'LR', 'LM', 'LI', 'LT', 'RP', 'RR', 'RM', 'RI', 'RT'];

    fingerOrder.forEach(f => {
      const cfg = this.fingersConfig[f];
      const kn = this.knuckles[f];
      const cur = this.currentTips[f];
      if (!kn || !cur) return;

      const isActive = (f === this.activeFinger);
      const bx = kn.x;
      const by = kn.y;
      const tx = cur.x;
      const ty = cur.y + (isActive ? tapOffset : 0);

      const dx = tx - bx;
      const dy = ty - by;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;

      const isThumb = (f === 'LT' || f === 'RT');
      const wBase = cfg.wBase * (isThumb ? 1.08 : 1.0);
      const wTip = cfg.wTip * (isThumb ? 1.08 : 1.0);

      // 需求 4: 人體工學三段擬真指節比例 (Knuckle -> PIP -> Waist -> DIP -> Rounded Tip Pad)
      const rPip = 0.44;  // 近端指節 (PIP Joint)
      const rDip = 0.74;  // 遠端指節 (DIP Joint)

      const pipW = wBase * 0.94;
      const waistW = wBase * 0.86;
      const dipW = wTip * 1.06;

      // 基底點 (Knuckle)
      const blx = bx + nx * (wBase / 2);
      const bly = by + ny * (wBase / 2);
      const brx = bx - nx * (wBase / 2);
      const bry = by - ny * (wBase / 2);

      // 近端指節點 (PIP Joint)
      const pipCx = bx + ux * (len * rPip);
      const pipCy = by + uy * (len * rPip);
      const pipLx = pipCx + nx * (pipW / 2);
      const pipLy = pipCy + ny * (pipW / 2);
      const pipRx = pipCx - nx * (pipW / 2);
      const pipRy = pipCy - ny * (pipW / 2);

      // 中節自然微收腰點
      const waistCx = bx + ux * (len * 0.58);
      const waistCy = by + uy * (len * 0.58);
      const waistLx = waistCx + nx * (waistW / 2);
      const waistLy = waistCy + ny * (waistW / 2);
      const waistRx = waistCx - nx * (waistW / 2);
      const waistRy = waistCy - ny * (waistW / 2);

      // 遠端指節點 (DIP Joint)
      const dipCx = bx + ux * (len * rDip);
      const dipCy = by + uy * (len * rDip);
      const dipLx = dipCx + nx * (dipW / 2);
      const dipLy = dipCy + ny * (dipW / 2);
      const dipRx = dipCx - nx * (dipW / 2);
      const dipRy = dipCy - ny * (dipW / 2);

      // 指尖飽滿肉墊指腹頂點 (Pulpar Tip Contour)
      const tlx = tx + nx * (wTip * 0.48);
      const tly = ty + ny * (wTip * 0.48);
      const trx = tx - nx * (wTip * 0.48);
      const try_ = ty - ny * (wTip * 0.48);
      const tipApexX = tx + ux * (wTip * 0.36);
      const tipApexY = ty + uy * (wTip * 0.36);

      // 繪製擬真人手多段平滑人體工學貝茲曲面輪廓
      const fingerD = `
        M ${blx.toFixed(1)} ${bly.toFixed(1)}
        Q ${((blx + pipLx)/2 + nx * 2).toFixed(1)} ${((bly + pipLy)/2).toFixed(1)}, ${pipLx.toFixed(1)} ${pipLy.toFixed(1)}
        Q ${waistLx.toFixed(1)} ${waistLy.toFixed(1)}, ${dipLx.toFixed(1)} ${dipLy.toFixed(1)}
        Q ${((dipLx + tlx)/2).toFixed(1)} ${((dipLy + tly)/2).toFixed(1)}, ${tlx.toFixed(1)} ${tly.toFixed(1)}
        C ${(tlx + ux * (wTip * 0.32)).toFixed(1)} ${(tly + uy * (wTip * 0.32)).toFixed(1)}, ${(tipApexX + nx * 4).toFixed(1)} ${tipApexY.toFixed(1)}, ${tipApexX.toFixed(1)} ${tipApexY.toFixed(1)}
        C ${(tipApexX - nx * 4).toFixed(1)} ${tipApexY.toFixed(1)}, ${(trx + ux * (wTip * 0.32)).toFixed(1)} ${(try_ + uy * (wTip * 0.32)).toFixed(1)}, ${trx.toFixed(1)} ${try_.toFixed(1)}
        Q ${((dipRx + trx)/2).toFixed(1)} ${((dipRy + try_)/2).toFixed(1)}, ${dipRx.toFixed(1)} ${dipRy.toFixed(1)}
        Q ${waistRx.toFixed(1)} ${waistRy.toFixed(1)}, ${pipRx.toFixed(1)} ${pipRy.toFixed(1)}
        Q ${((brx + pipRx)/2 - nx * 2).toFixed(1)} ${((bry + pipRy)/2).toFixed(1)}, ${brx.toFixed(1)} ${bry.toFixed(1)}
        Z
      `;

      // 擬真指甲 (立體甲緣與弧形高光指甲)
      const nailLen = wTip * 0.65;
      const nailW = wTip * 0.68;
      const nBaseCx = tx - ux * (nailLen * 0.45);
      const nBaseCy = ty - uy * (nailLen * 0.45);
      const nTipCx = tx + ux * (nailLen * 0.35);
      const nTipCy = ty + uy * (nailLen * 0.35);

      const nblX = nBaseCx + nx * (nailW * 0.45);
      const nblY = nBaseCy + ny * (nailW * 0.45);
      const nbrX = nBaseCx - nx * (nailW * 0.45);
      const nbrY = nBaseCy - ny * (nailW * 0.45);

      const ntlX = nTipCx + nx * (nailW * 0.40);
      const ntlY = nTipCy + ny * (nailW * 0.40);
      const ntrX = nTipCx - nx * (nailW * 0.40);
      const ntrY = nTipCy - ny * (nailW * 0.40);

      const nailD = `
        M ${nblX.toFixed(1)} ${nblY.toFixed(1)}
        C ${(nblX + nx * 1.5).toFixed(1)} ${(nblY + uy * 2).toFixed(1)}, ${(ntlX + nx * 1.5).toFixed(1)} ${(ntlY - uy * 2).toFixed(1)}, ${ntlX.toFixed(1)} ${ntlY.toFixed(1)}
        Q ${nTipCx.toFixed(1)} ${(nTipCy + uy * 2).toFixed(1)}, ${ntrX.toFixed(1)} ${ntrY.toFixed(1)}
        C ${(ntrX - nx * 1.5).toFixed(1)} ${(ntrY - uy * 2).toFixed(1)}, ${(nbrX - nx * 1.5).toFixed(1)} ${(nbrY + uy * 2).toFixed(1)}, ${nbrX.toFixed(1)} ${nbrY.toFixed(1)}
        Q ${nBaseCx.toFixed(1)} ${(nBaseCy - uy * 1.5).toFixed(1)}, ${nblX.toFixed(1)} ${nblY.toFixed(1)}
        Z
      `;

      // 擬真人手指關節雙褶皺 (Natural skin creases at PIP and DIP)
      const makeCrease = (cx, cy, cw, curveAmp) => {
        const p1x = cx + nx * (cw / 2) - ux * 0.8;
        const p1y = cy + ny * (cw / 2) - uy * 0.8;
        const p2x = cx - nx * (cw / 2) - ux * 0.8;
        const p2y = cy - ny * (cw / 2) - uy * 0.8;
        return `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} Q ${cx.toFixed(1)} ${(cy + uy * curveAmp).toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`;
      };

      const creasePip1 = makeCrease(pipCx - ux * 1.5, pipCy - uy * 1.5, pipW * 0.62, 2.2);
      const creasePip2 = makeCrease(pipCx + ux * 1.8, pipCy + uy * 1.8, pipW * 0.54, 1.8);
      const creaseDip = makeCrease(dipCx, dipCy, dipW * 0.58, 2.0);

      fingersHtml += `
        <g class="finger-group" id="hand-finger-${f}">
          <path class="hand-finger-path ${isActive ? 'finger-active' : ''}" d="${fingerD}" />
          <path class="finger-crease-line" d="${creasePip1}" />
          <path class="finger-crease-line" d="${creasePip2}" />
          <path class="finger-crease-line" d="${creaseDip}" />
          <path class="fingernail-path" d="${nailD}" />
        </g>
      `;

      if (isActive) {
        beaconsHtml += `
          <circle class="finger-target-beacon" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="14" />
        `;
      }
    });

    this.fingersLayer.innerHTML = fingersHtml;
    this.beaconsLayer.innerHTML = beaconsHtml;
  }
}

// ----------------------------------------------------
// 5. 渲染雙語鍵盤 (英文字母 + 大千注音 + Shift符號 + 手指歸屬色點)
// ----------------------------------------------------
function renderBilingualKeyboard() {
  const container = document.getElementById('keyboard-rows-container');
  // 保留 hands-overlay-wrapper 元素
  const overlayEl = document.getElementById('hands-overlay-wrapper');
  container.innerHTML = '';
  if (overlayEl) container.appendChild(overlayEl);

  KEYBOARD_LAYOUT.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'kb-row';

    row.forEach(item => {
      const btn = document.createElement('div');
      btn.id = `key-${item.key}`;
      btn.className = `keycap ${item.width}`;
      btn.dataset.code = item.code;
      btn.dataset.finger = item.finger;

      const fingerInfo = FINGER_INFO[item.finger] || { color: '#38bdf8' };
      const dotHtml = (item.key !== 'space')
        ? `<span class="keycap-finger-dot" style="background: ${fingerInfo.color}; color: ${fingerInfo.color};" title="${fingerInfo.hand}${fingerInfo.finger}"></span>`
        : '';

      // Proposal III.2.2: 實體鍵盤 F & J 基準鍵定位凸點標記 (Tactile Bumps)
      const bumpHtml = (item.key === 'f' || item.key === 'j')
        ? '<span class="key-home-bump" title="食指休息的基準鍵 (定位凸起橫線)"></span>'
        : '';

      if (item.text) {
        btn.innerHTML = `<span class="key-char-en">${item.text}</span>${bumpHtml}${dotHtml}`;
      } else {
        const enChar = item.key.toUpperCase();
        const zhChar = item.zh || '';
        const shiftChar = item.shift || '';

        btn.innerHTML = `
          ${shiftChar ? `<span class="key-char-shift">${shiftChar}</span>` : ''}
          ${zhChar ? `<span class="key-char-zh">${zhChar}</span>` : ''}
          <span class="key-char-en">${enChar}</span>
          ${bumpHtml}
          ${dotHtml}
        `;
      }

      rowEl.appendChild(btn);
    });

    container.appendChild(rowEl);
  });

  // 鍵盤建立完成後，初始化或重算半透明指法引導層
  if (!window.handsOverlay) {
    window.handsOverlay = new HandsOverlayManager();
  } else {
    setTimeout(() => {
      if (window.handsOverlay) window.handsOverlay.updatePositions();
    }, 60);
  }
}

// ----------------------------------------------------
// 5.1 指法動態透明度調節控制器
// ----------------------------------------------------
function initOpacityControls() {
  const slider = document.getElementById('guide-opacity-slider');
  const badge = document.getElementById('guide-opacity-val');
  const presets = document.querySelectorAll('.btn-preset-opacity');
  const container = document.getElementById('keyboard-rows-container');

  const savedOpacity = localStorage.getItem('typehero_guide_opacity') || '65';
  setGuideOpacity(savedOpacity);

  if (slider) {
    slider.value = savedOpacity;
    slider.addEventListener('input', (e) => {
      setGuideOpacity(e.target.value);
    });
  }

  presets.forEach(btn => {
    btn.onclick = () => {
      const val = btn.dataset.val;
      if (slider) slider.value = val;
      setGuideOpacity(val);
    };
  });

  function setGuideOpacity(val) {
    const num = parseInt(val, 10);
    const alpha = (num / 100).toFixed(2);
    if (container) {
      container.style.setProperty('--guide-opacity', alpha);
    }
    if (badge) badge.innerText = `${num}%`;

    presets.forEach(b => {
      if (b.dataset.val === String(num)) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    localStorage.setItem('typehero_guide_opacity', val);
  }
}

// ----------------------------------------------------
// 6. 課程分頁與關卡地圖切換 (Tabs & 解鎖判斷)
// ----------------------------------------------------
function initTabs() {
  const tabBtns = document.querySelectorAll('.course-tab-btn');
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.category;
      loadCategory(cat);
    };
  });
}

function loadCategory(category) {
  gameState.currentCategory = category;
  const courseList = window.COURSES[category];
  if (!courseList || courseList.length === 0) return;

  const badgeEl = document.getElementById('stage-mode-badge');
  const inputEl = document.getElementById('typing-input');
  const imeIcon = document.getElementById('ime-guide-icon');
  const imeIconBg = document.getElementById('ime-guide-icon-bg');
  const imeModeText = document.getElementById('ime-guide-mode-text');
  const imeHintText = document.getElementById('ime-guide-hint-text');

  if (category === 'zhuyin') {
    badgeEl.innerText = '🇹🇼 台灣大千注音符號盲打特訓';
    if (inputEl) {
      inputEl.setAttribute('inputmode', 'latin');
      inputEl.setAttribute('lang', 'en');
    }
    if (imeIcon) imeIcon.innerText = '🔤';
    if (imeIconBg) imeIconBg.style.background = 'linear-gradient(135deg, #38bdf8, #0284c7)';
    if (imeModeText) imeModeText.innerText = '英數 / 簡易注音免選字';
    if (imeHintText) imeHintText.innerText = '保持英數狀態，直接敲鍵盲打（免切換、免選字）';
  } else if (category === 'chinese') {
    badgeEl.innerText = '📖 國小生字詞與常用標點（免選字簡易注音）';
    if (inputEl) {
      inputEl.setAttribute('inputmode', 'latin');
      inputEl.setAttribute('lang', 'en');
    }
    if (imeIcon) imeIcon.innerText = '🔤';
    if (imeIconBg) imeIconBg.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
    if (imeModeText) imeModeText.innerText = '英數 / 簡易注音免選字';
    if (imeHintText) imeHintText.innerText = '依生字注音拆解直接敲鍵，自動完成不需選字換字！';
  } else if (category === 'custom') {
    badgeEl.innerText = '🏫 教師課堂自訂特訓關卡';
    if (inputEl) {
      inputEl.setAttribute('inputmode', 'latin');
      inputEl.setAttribute('lang', 'en');
    }
    if (imeIcon) imeIcon.innerText = '🏫';
    if (imeIconBg) imeIconBg.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    if (imeModeText) imeModeText.innerText = '英數 / 簡易注音免選字';
    if (imeHintText) imeHintText.innerText = '保持英數狀態，依指定題目直接敲鍵盲打（免選字）';
  } else {
    badgeEl.innerText = '🔤 國小標準英文盲打挑戰';
    if (inputEl) {
      inputEl.setAttribute('inputmode', 'latin');
      inputEl.setAttribute('lang', 'en');
    }
    if (imeIcon) imeIcon.innerText = '🔤';
    if (imeIconBg) imeIconBg.style.background = 'linear-gradient(135deg, #38bdf8, #0284c7)';
    if (imeModeText) imeModeText.innerText = '英數 / 英文盲打模式';
    if (imeHintText) imeHintText.innerText = '保持英數狀態，直接敲擊實體按鍵盲打';
  }

  // 繪製關卡地圖卡片 (含鎖定判定)
  renderLessonsGrid(courseList);

  // 預設選取該分類第 1 關
  selectLesson(courseList[0].id);
}

function renderLessonsGrid(lessons) {
  const grid = document.getElementById('lessons-grid');
  grid.innerHTML = '';

  const savedStars = (window.shopManager && window.shopManager.data.lessonStars) || {};

  lessons.forEach((lesson, index) => {
    const card = document.createElement('div');
    card.id = `lesson-card-${lesson.id}`;
    card.className = 'lesson-card';

    // 關卡解鎖門檻：第 1 關預設解鎖，其餘關卡需前一關取得至少 1 顆星（準確率 >= 70% 通關）
    const isUnlocked = (index === 0) || (savedStars[lessons[index - 1].id] && savedStars[lessons[index - 1].id] >= 1);

    if (!isUnlocked) {
      card.classList.add('locked');
    }

    if (gameState.currentLesson && gameState.currentLesson.id === lesson.id) {
      card.classList.add('active');
    }

    card.onclick = () => {
      if (!isUnlocked) {
        alert(`🔒 第 ${index + 1} 關尚未解鎖！\n請先通過第 ${index} 關（擊鍵準確率需達到 70% 以上）才能解鎖本關喔！`);
        return;
      }
      selectLesson(lesson.id);
    };

    const stars = savedStars[lesson.id] || 0;
    let starsHtml = '';
    for (let i = 1; i <= 3; i++) {
      starsHtml += `<span class="star-icon ${i <= stars ? 'filled' : ''}">★</span>`;
    }

    card.innerHTML = `
      <div class="lesson-card-top">
        <span class="lesson-tag">${isUnlocked ? `LEVEL ${index + 1}` : '🔒 鎖定中'}</span>
        <div class="stars-container">${starsHtml}</div>
      </div>
      <div>
        <h4 class="lesson-name">${lesson.title}</h4>
        <p class="lesson-summary">${lesson.summary}</p>
      </div>
      <div class="lesson-footer-row">
        <span style="color:var(--text-muted); font-size:0.7rem;">按鍵數：${lesson.text.length}</span>
        <span style="color:${isUnlocked ? 'var(--brand-primary)' : 'var(--text-muted)'}; font-weight:bold;">
          ${isUnlocked ? '開始挑戰 →' : '未解鎖 🔒'}
        </span>
      </div>
    `;

    grid.appendChild(card);
  });
}

// ----------------------------------------------------
// 7. 關卡載入與文字渲染
// ----------------------------------------------------
function selectLesson(lessonId) {
  const courseList = window.COURSES[gameState.currentCategory];
  const target = courseList.find(l => l.id === lessonId);
  if (!target) return;

  // 重設狀態
  gameState.currentLesson = target;
  gameState.currentIndex = 0;
  gameState.subCharIndex = 0;
  gameState.correctCount = 0;
  gameState.totalKeyStrokes = 0;
  gameState.comboCount = 0;
  gameState.comboMax = 0;
  gameState.startTime = null;
  gameState.isComposing = false;
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);

  // 清空輸入框與預覽
  const inputEl = document.getElementById('typing-input');
  if (inputEl) inputEl.value = '';
  const previewBadge = document.getElementById('ime-preview-badge');
  if (previewBadge) previewBadge.classList.add('hidden');

  // 更新介面狀態板
  document.getElementById('stat-lesson-title').innerText = target.title;
  document.getElementById('stat-wpm').innerText = '0';
  document.getElementById('stat-accuracy').innerText = '100%';
  document.getElementById('stat-progress-text').innerText = '0%';
  document.getElementById('stat-progress-bar').style.width = '0%';
  updateComboUI(0);

  // 高亮目前選定卡片
  document.querySelectorAll('.lesson-card').forEach(c => c.classList.remove('active'));
  const activeCard = document.getElementById(`lesson-card-${lessonId}`);
  if (activeCard) activeCard.classList.add('active');

  // 渲染打字文字區
  const streamEl = document.getElementById('typing-stream');
  streamEl.innerHTML = '';

  for (let i = 0; i < target.text.length; i++) {
    const span = document.createElement('span');
    span.innerText = target.text[i];
    span.className = 'char-pending';
    if (i === 0) span.classList.add('char-cursor');
    streamEl.appendChild(span);
  }

  // 高亮預期按鍵與指位
  highlightTarget(target.text[0]);
  if (typeof updateMascot === 'function') updateMascot('start');

  // 自動聚焦
  setTimeout(focusTyping, 60);
}

// ----------------------------------------------------
// 8.0 語音朗讀、伴學精靈與停頓指引輔助控制器
// ----------------------------------------------------
let idleGuidanceTimer = null;
let currentGuidanceKeyEl = null;

function clearIdleGuidance() {
  if (idleGuidanceTimer) {
    clearTimeout(idleGuidanceTimer);
    idleGuidanceTimer = null;
  }
  if (currentGuidanceKeyEl) {
    currentGuidanceKeyEl.classList.remove('key-guidance-active');
    currentGuidanceKeyEl = null;
  }
}

function resetIdleGuidanceTimer(targetEl) {
  clearIdleGuidance();
  if (!targetEl) return;
  idleGuidanceTimer = setTimeout(() => {
    targetEl.classList.add('key-guidance-active');
    currentGuidanceKeyEl = targetEl;
    if (typeof updateMascot === 'function') updateMascot('stuck');
  }, 3200);
}

// Proposal III.1.1: Web Speech API 語音朗讀輔助 (兒童友善語調)
function speakPromptText() {
  if (!('speechSynthesis' in window)) {
    alert('您的瀏覽器不支援語音朗讀功能');
    return;
  }
  window.speechSynthesis.cancel();

  const lesson = gameState.currentLesson;
  if (!lesson || !lesson.text) return;

  const utter = new SpeechSynthesisUtterance(lesson.text.trim());
  if (gameState.currentCategory === 'english') {
    utter.lang = 'en-US';
    utter.rate = 0.85;
    utter.pitch = 1.05;
  } else {
    utter.lang = 'zh-TW';
    utter.rate = 0.85;
    utter.pitch = 1.1;
  }

  const btnSpeak = document.getElementById('btn-speak-text');
  if (btnSpeak) btnSpeak.classList.add('speaking');
  utter.onend = () => {
    if (btnSpeak) btnSpeak.classList.remove('speaking');
  };
  utter.onerror = () => {
    if (btnSpeak) btnSpeak.classList.remove('speaking');
  };

  window.speechSynthesis.speak(utter);
}

// Proposal IV.2: 鍵盤守護精靈伴學小卡 (動態問候與情緒回饋)
function updateMascot(type, param) {
  const bubble = document.getElementById('mascot-speech-bubble');
  const icon = document.getElementById('mascot-character-icon');
  if (!bubble) return;

  switch (type) {
    case 'start':
      bubble.innerText = '加油！看著螢幕手指，不要低頭看鍵盤，慢慢打最快喔！';
      if (icon) icon.innerText = '🐱';
      break;
    case 'combo':
      if (param >= 20) {
        bubble.innerText = '🔥 太狂啦！連續擊中 20 次！進入狂熱 FEVER 模式！';
        if (icon) icon.innerText = '🦁';
      } else if (param >= 10) {
        bubble.innerText = '⚡ 節奏超棒！連續命中 10 次！手腕要放鬆喔！';
        if (icon) icon.innerText = '🦊';
      } else if (param >= 5) {
        bubble.innerText = '✨ 很好！五連擊！保持端正坐姿！';
        if (icon) icon.innerText = '🐱';
      }
      break;
    case 'wrong':
      bubble.innerText = '沒關係！不要慌張，看清楚指引手指再按下！';
      if (icon) icon.innerText = '🐶';
      break;
    case 'stuck':
      bubble.innerText = '卡住了嗎？看鍵盤上的金黃色呼吸光暈，就是那個鍵！';
      if (icon) icon.innerText = '💡';
      break;
    case 'pass':
      bubble.innerText = '🎉 太棒了！順利通過考驗，你又往前邁進一步了！';
      if (icon) icon.innerText = '🏆';
      break;
    case 'fail':
      bubble.innerText = '別灰心！雙手放回基準鍵，我們再來挑戰一次！';
      if (icon) icon.innerText = '🌱';
      break;
    default:
      bubble.innerText = '雙手食指放在 F 與 J 上，準備開始練習囉！';
      if (icon) icon.innerText = '🐱';
  }
}

// ----------------------------------------------------
// 8. 鍵位指引與手指高亮 (Hands & Key Highlight)
// ----------------------------------------------------
function highlightFinger(fingerId) {
  // 左右手指動態已整合至全覆蓋人體工學半透明引導層中，此處保留供相容性呼叫
}

function highlightTarget(char) {
  // 清除現有鍵位高亮與停頓發光
  clearIdleGuidance();
  document.querySelectorAll('.keycap').forEach(el => el.classList.remove('key-target'));

  const hudBadge = document.getElementById('hud-finger-badge');
  const hudName = document.getElementById('hud-finger-name');
  const hudIcon = document.getElementById('hud-hand-icon');
  const hudHint = document.getElementById('hud-action-hint');
  const zhuyinBadge = document.getElementById('zhuyin-decompose-badge');
  const zhuyinText = document.getElementById('zhuyin-decompose-text');

  if (!gameState.currentLesson) return;
  if (gameState.currentIndex >= gameState.currentLesson.text.length) {
    if (window.handsOverlay) window.handsOverlay.setTarget(null, null, null);
    if (hudName) hudName.innerText = '關卡完成';
    if (hudHint) hudHint.innerText = '請進行成績結算';
    if (zhuyinBadge) zhuyinBadge.classList.add('hidden');
    return;
  }

  const currentChar = char || gameState.currentLesson.text[gameState.currentIndex];
  const subKeys = getCharSubKeys(currentChar);
  if (subKeys.length === 0) return;

  const currentStep = subKeys[gameState.subCharIndex] || subKeys[0];
  const targetKeyChar = currentStep.key;

  // 1. 更新注音拆解 Badge (免選字即時進度導引)
  // 需求 1: 拿掉鍵盤符號，保持單純注音符號 (如 老：ㄌ ㄠ ˇ)
  if (zhuyinBadge && zhuyinText) {
    if (subKeys.length > 1) {
      let partsHtml = `<strong style="color:var(--text-main); margin-right:4px;">${currentChar}：</strong>`;
      subKeys.forEach((step, sIdx) => {
        const stateClass = sIdx < gameState.subCharIndex ? 'zh-done' : (sIdx === gameState.subCharIndex ? 'zh-active' : 'zh-pending');
        const checkIcon = sIdx < gameState.subCharIndex ? '✓ ' : '';
        const displaySymbol = step.pureZhuyin || step.zh || step.label.replace(/\s*\([^)]*\)/g, '');
        partsHtml += `<span class="zh-part ${stateClass}">${checkIcon}${displaySymbol}</span>`;
      });
      zhuyinText.innerHTML = partsHtml;
      zhuyinBadge.classList.remove('hidden');
    } else if (currentStep.hint || currentStep.zh) {
      const displaySymbol = currentStep.pureZhuyin || currentStep.zh || currentChar;
      zhuyinText.innerHTML = `<strong style="color:var(--text-main); margin-right:4px;">${currentChar}</strong> → <span class="zh-part zh-active">${displaySymbol}</span>`;
      zhuyinBadge.classList.remove('hidden');
    } else {
      zhuyinBadge.classList.add('hidden');
    }
  }

  // 2. 獲取按鍵在虛擬鍵盤上的 DOM ID
  let targetKeyId = null;
  if (targetKeyChar === ' ') targetKeyId = 'key-space';
  else if (targetKeyChar === ',') targetKeyId = 'key-,';
  else if (targetKeyChar === '.') targetKeyId = 'key-.';
  else if (targetKeyChar === '/' || targetKeyChar === '?') targetKeyId = 'key-/';
  else if (targetKeyChar === ';' || targetKeyChar === ':') targetKeyId = 'key-;';
  else if (targetKeyChar === "'") targetKeyId = "key-'";
  else if (targetKeyChar === '[') targetKeyId = 'key-[';
  else if (targetKeyChar === ']') targetKeyId = 'key-]';
  else if (targetKeyChar === '!') targetKeyId = 'key-1';
  else targetKeyId = `key-${targetKeyChar.toLowerCase()}`;

  const targetEl = document.getElementById(targetKeyId);
  let targetFinger = null;

  if (targetEl) {
    targetEl.classList.add('key-target');
    targetFinger = targetEl.dataset.finger;

    // 啟動 3.2 秒停頓指引計時器
    resetIdleGuidanceTimer(targetEl);

    const info = FINGER_INFO[targetFinger] || { hand: '單手', finger: '按鍵', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', icon: '👆', homeKey: '' };

    // 3. 更新鍵盤頂部 HUD 指法導引列 (紅框風格)
    if (hudBadge) {
      hudBadge.style.borderColor = '#ef4444';
      hudBadge.style.boxShadow = `0 0 12px rgba(239, 68, 68, 0.4)`;
    }
    if (hudIcon) hudIcon.innerText = info.icon;
    if (hudName) hudName.innerText = `${info.hand} · ${info.finger}`;

    const stepProgress = subKeys.length > 1 ? `（${currentChar} 注音拆解 ${gameState.subCharIndex + 1}/${subKeys.length}）` : '';
    if (hudHint) {
      const keyName = targetKeyChar === ' ' ? '空白鍵' : targetKeyChar.toUpperCase();
      const symbolDesc = currentStep.pureZhuyin ? ` (${currentStep.pureZhuyin})` : '';
      hudHint.innerHTML = `請使用 <strong style="color:#ef4444; font-size:0.95rem;">${info.hand}${info.finger}</strong> 輕敲 [ <strong style="color:var(--text-main); font-size:1.05rem;">${keyName}${symbolDesc}</strong> ] <span style="font-size:0.75rem; color:var(--accent-gold); font-weight:bold;">${stepProgress}</span>`;
    }
  }

  // 4. 驅動覆蓋於鍵盤上的半透明人體工學十指動畫
  if (window.handsOverlay) {
    window.handsOverlay.setTarget(targetKeyId, targetFinger, targetKeyChar);
  }
}

// ----------------------------------------------------
// 9. 連擊 Combo 與 FEVER 狂熱模式特效
// ----------------------------------------------------
function updateComboUI(combo) {
  const badgeWrapper = document.getElementById('combo-badge-wrapper');
  const arena = document.getElementById('typing-arena');

  if (combo >= 5) {
    badgeWrapper.innerHTML = `
      <div class="combo-badge">🔥 COMBO x${combo}</div>
      <span style="font-size:0.65rem; color:#fbbf24; font-weight:bold;">金幣與經驗值加倍！</span>
    `;
  } else {
    badgeWrapper.innerHTML = '';
  }

  // 連擊達 20 進入狂熱模式 (Fever Mode)
  if (combo >= 20) {
    arena.classList.add('fever-mode');
  } else {
    arena.classList.remove('fever-mode');
  }
}

// ----------------------------------------------------
// 10. 即時數據計算 (嚴格準確率計算，防止 100% 誤判)
// ----------------------------------------------------
function updateStats() {
  if (!gameState.startTime) return;

  const elapsedMinutes = (Date.now() - gameState.startTime) / 60000;
  if (elapsedMinutes <= 0) return;

  // WPM = (正確字元數 / 5) / 分鐘
  const wpm = Math.round((gameState.correctCount / 5) / elapsedMinutes);
  document.getElementById('stat-wpm').innerText = wpm;

  // 擊鍵準確率：若尚未按鍵顯示 100%，一旦開始按鍵，正確數為 0 則如實顯示 0%
  const acc = gameState.totalKeyStrokes > 0
    ? Math.round((gameState.correctCount / gameState.totalKeyStrokes) * 100)
    : 100;
  document.getElementById('stat-accuracy').innerText = `${acc}%`;

  // 關卡進度
  const total = gameState.currentLesson.text.length;
  const progress = Math.min(100, Math.round((gameState.currentIndex / total) * 100));
  document.getElementById('stat-progress-text').innerText = `${progress}%`;
  document.getElementById('stat-progress-bar').style.width = `${progress}%`;
}

// ----------------------------------------------------
// 10.1 成就勳章系統 (Proposal IV.3)
// ----------------------------------------------------
const ACHIEVEMENTS_LIST = [
  { id: 'first_pass', icon: '🌱', name: '啟航學徒', desc: '成功通過任何一個打字挑戰關卡', reward: 50 },
  { id: 'combo_10', icon: '🔥', name: '連擊好手', desc: '單一關卡中達成 10 連擊 Combo', reward: 50 },
  { id: 'combo_30', icon: '⚡', name: '狂熱連擊王', desc: '單一關卡中達成 30 連擊 Combo', reward: 50 },
  { id: 'accuracy_100', icon: '🎯', name: '百步穿楊', desc: '以 100% 完美輸入準確率通關', reward: 50 },
  { id: 'speed_30', icon: '🏎️', name: '疾速小神童', desc: '單關打字速度突破 30 WPM', reward: 50 },
  { id: 'speed_50', icon: '🚀', name: '音速大師', desc: '單關打字速度突破 50 WPM', reward: 50 },
  { id: 'stars_10', icon: '🌟', name: '群星閃耀', desc: '累計收集滿 10 個關卡三星評等', reward: 50 }
];

function checkAndUnlockAchievement(id) {
  if (!window.shopManager) return;
  const pData = window.shopManager.data;
  if (!pData.unlockedAchievements) pData.unlockedAchievements = [];
  if (pData.unlockedAchievements.includes(id)) return;

  const ach = ACHIEVEMENTS_LIST.find(a => a.id === id);
  if (!ach) return;

  pData.unlockedAchievements.push(id);
  pData.coins += ach.reward;
  window.shopManager.saveData();
  window.shopManager.updateUI();

  if (window.soundEngine) window.soundEngine.playCoin();

  // 彈出精緻成就解鎖 Toast
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div style="font-size: 2rem; line-height: 1;">${ach.icon}</div>
    <div>
      <div style="font-weight: 800; font-size: 0.92rem; color: #fbbf24;">🏅 解鎖新成就：【${ach.name}】！</div>
      <div style="font-size: 0.74rem; color: #fff; margin-top: 2px;">${ach.desc} (+${ach.reward} 星幣)</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4200);
}

function renderAchievements() {
  const grid = document.getElementById('achievement-grid');
  if (!grid || !window.shopManager) return;

  const unlocked = window.shopManager.data.unlockedAchievements || [];
  grid.innerHTML = '';

  ACHIEVEMENTS_LIST.forEach(ach => {
    const isUnlocked = unlocked.includes(ach.id);
    const card = document.createElement('div');
    card.className = `achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-info" style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="achievement-name">${ach.name}</div>
          <span class="achievement-status-tag ${isUnlocked ? 'achievement-status-unlocked' : 'achievement-status-locked'}">
            ${isUnlocked ? '✓ 已達成' : '🔒 未解鎖'}
          </span>
        </div>
        <div class="achievement-desc">${ach.desc}</div>
        <div class="achievement-reward">達成獎勵：💰 ${ach.reward} 星幣</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ----------------------------------------------------
// 11. 關卡完成結算 (70% 通關門檻分支與彈窗)
// ----------------------------------------------------
function finishLesson() {
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);

  const elapsedMinutes = Math.max(0.01, (Date.now() - gameState.startTime) / 60000);
  const finalWpm = Math.round((gameState.correctCount / 5) / elapsedMinutes) || 0;

  // 嚴格準確率：未輸入或全部打錯直接為 0%
  const finalAcc = gameState.totalKeyStrokes > 0
    ? Math.round((gameState.correctCount / gameState.totalKeyStrokes) * 100)
    : 0;

  // 判斷是否通過標準（準確率需達 70%）
  const isPassed = (finalAcc >= PASS_ACCURACY_THRESHOLD);

  const bannerEl = document.getElementById('modal-result-banner');
  const iconEl = document.getElementById('modal-result-icon');
  const titleEl = document.getElementById('modal-result-title');
  const feedbackEl = document.getElementById('modal-feedback-msg');
  const nextBtn = document.getElementById('modal-btn-next');
  const retryBtn = document.getElementById('modal-btn-retry');
  const starsEl = document.getElementById('modal-stars-celebration');

  document.getElementById('modal-lesson-title').innerText = gameState.currentLesson.title;
  document.getElementById('modal-wpm').innerText = `${finalWpm} 字/分 (WPM)`;
  document.getElementById('modal-accuracy').innerText = `${finalAcc}%`;

  if (isPassed) {
    // === 通關成功 (準確率 >= 70%) ===
    let stars = 1;
    if (finalAcc >= 95 && finalWpm >= 25) {
      stars = 3;
    } else if (finalAcc >= 85 || finalWpm >= 15) {
      stars = 2;
    }

    if (window.soundEngine) window.soundEngine.playFanfare();
    if (typeof updateMascot === 'function') updateMascot('pass');

    // 檢查通關成就 (Proposal IV.3)
    checkAndUnlockAchievement('first_pass');
    if (finalAcc === 100) checkAndUnlockAchievement('accuracy_100');
    if (finalWpm >= 30) checkAndUnlockAchievement('speed_30');
    if (finalWpm >= 50) checkAndUnlockAchievement('speed_50');

    let reward = { earnedCoins: 30, earnedExp: 50 };
    if (window.shopManager) {
      reward = window.shopManager.rewardMatch(finalWpm, finalAcc, stars, gameState.comboMax);

      // 儲存關卡最高星等
      const savedStars = window.shopManager.data.lessonStars || {};
      const oldStars = savedStars[gameState.currentLesson.id] || 0;
      if (stars > oldStars) {
        savedStars[gameState.currentLesson.id] = stars;
        window.shopManager.data.lessonStars = savedStars;
        window.shopManager.saveData();
      }

      // 檢查累計 10 個三星成就
      const total3Stars = Object.values(savedStars).filter(s => s >= 3).length;
      if (total3Stars >= 10) checkAndUnlockAchievement('stars_10');
    }

    if (window.cloudSync) {
      window.cloudSync.submitScore(gameState.currentLesson.id, gameState.currentLesson.title, finalWpm, finalAcc);
    }

    bannerEl.style.background = 'linear-gradient(90deg, #38bdf8, #818cf8, #c084fc, #f43f5e, #fbbf24)';
    iconEl.innerText = '🏆';
    titleEl.innerText = '🎉 關卡挑戰成功！';
    document.getElementById('modal-accuracy').style.color = '#10b981';
    document.getElementById('modal-coins').innerText = `+${reward.earnedCoins} 幣`;

    starsEl.innerHTML = '';
    for (let i = 1; i <= 3; i++) {
      starsEl.innerHTML += `<span style="color: ${i <= stars ? '#fbbf24' : 'rgba(255,255,255,0.2)'}; text-shadow: ${i <= stars ? '0 0 15px #fbbf24' : 'none'};">★</span>`;
    }

    feedbackEl.className = 'modal-feedback-msg modal-feedback-pass';
    feedbackEl.innerHTML = `🌟 恭喜達標！準確率達 <strong>${finalAcc}%</strong>，已成功解鎖下一關！`;

    retryBtn.innerHTML = '<span>🔄 重來一次</span>';
    retryBtn.className = 'btn-secondary';

    nextBtn.style.display = 'inline-flex';
    nextBtn.innerHTML = '<span>下一關卡 ➔</span>';

  } else {
    // === 未達標準 (準確率 < 70%) ===
    if (window.soundEngine) window.soundEngine.playError();
    if (typeof updateMascot === 'function') updateMascot('fail');

    // 未達標僅給予 5 幣安慰參加獎
    if (window.shopManager) {
      window.shopManager.data.coins += 5;
      window.shopManager.saveData();
    }

    bannerEl.style.background = 'linear-gradient(90deg, #ef4444, #f97316)';
    iconEl.innerText = '❌';
    titleEl.innerText = '挑戰未達標，請再接再厲！';
    document.getElementById('modal-accuracy').style.color = '#f87171';
    document.getElementById('modal-coins').innerText = '+5 幣 (參加獎)';

    starsEl.innerHTML = `
      <span style="color: rgba(255,255,255,0.2);">★</span>
      <span style="color: rgba(255,255,255,0.2);">★</span>
      <span style="color: rgba(255,255,255,0.2);">★</span>
    `;

    feedbackEl.className = 'modal-feedback-msg modal-feedback-fail';
    feedbackEl.innerHTML = `
      ⚠️ <strong>未達通關標準（門檻需 70%）</strong><br>
      本關準確率為 <strong>${finalAcc}%</strong>。請放慢打字速度，不要著急亂按，抬頭專注看著螢幕上的發光手指指引，再試一次吧！
    `;

    retryBtn.innerHTML = '<span>🔄 重新挑戰本關</span>';
    retryBtn.className = 'btn-primary';

    nextBtn.style.display = 'none'; // 隱藏下一關按鈕，強制必須重新挑戰通過才能繼續！
  }

  // 連擊成就檢驗
  if (gameState.comboMax >= 10) checkAndUnlockAchievement('combo_10');
  if (gameState.comboMax >= 30) checkAndUnlockAchievement('combo_30');

  document.getElementById('modal-result').classList.add('active');

  // 重新渲染關卡地圖卡片的星星與解鎖狀態
  const courseList = window.COURSES[gameState.currentCategory];
  renderLessonsGrid(courseList);
}

// ----------------------------------------------------
// 12. 彈窗與選單管理 (Modals & Shop & Leaderboard)
// ----------------------------------------------------
function initModals() {
  // 結算彈窗按鈕
  document.getElementById('modal-btn-retry').onclick = () => {
    document.getElementById('modal-result').classList.remove('active');
    selectLesson(gameState.currentLesson.id);
  };

  document.getElementById('modal-btn-next').onclick = () => {
    document.getElementById('modal-result').classList.remove('active');
    const courseList = window.COURSES[gameState.currentCategory];
    const currIdx = courseList.findIndex(l => l.id === gameState.currentLesson.id);
    if (currIdx !== -1 && currIdx + 1 < courseList.length) {
      selectLesson(courseList[currIdx + 1].id);
    } else {
      alert('🎉 恭喜您！您已經完成了此分類的所有關卡，您是真正的鍵盤大師！');
      document.getElementById('lessons-panel').scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 商城彈窗
  const shopModal = document.getElementById('modal-shop');
  document.getElementById('nav-btn-shop').onclick = () => {
    renderShopItems('skins');
    shopModal.classList.add('active');
  };
  document.getElementById('close-shop-btn').onclick = () => shopModal.classList.remove('active');

  // 排行榜彈窗 (Proposal IV.4 多元榮譽評價榜單)
  const leaderModal = document.getElementById('modal-leaderboard');
  document.getElementById('nav-btn-leaderboard').onclick = async () => {
    leaderModal.classList.add('active');
    await renderLeaderboard('wpm');
  };
  document.getElementById('close-leader-btn').onclick = () => leaderModal.classList.remove('active');

  const lbWpm = document.getElementById('lb-tab-wpm');
  const lbAcc = document.getElementById('lb-tab-accuracy');
  const lbDil = document.getElementById('lb-tab-diligence');
  if (lbWpm) lbWpm.onclick = () => renderLeaderboard('wpm');
  if (lbAcc) lbAcc.onclick = () => renderLeaderboard('accuracy');
  if (lbDil) lbDil.onclick = () => renderLeaderboard('diligence');

  // 1. 個人班級雲端設定彈窗 (需求 3: 點擊不應切換班級座號，而是修改暱稱與通行密碼)
  const profileModal = document.getElementById('modal-profile');
  document.getElementById('user-profile-badge').onclick = () => {
    const p = window.cloudSync ? window.cloudSync.profile : { className: '5年3班', seatNumber: '01', nickname: '鍵盤小英雄' };
    const classSeatTag = document.getElementById('profile-modal-class-seat');
    const nickInp = document.getElementById('input-nickname');
    const passInp = document.getElementById('input-profile-password');

    if (classSeatTag) classSeatTag.innerText = `${p.className} ${p.seatNumber}號`;
    if (nickInp) nickInp.value = p.nickname || '';
    if (passInp) passInp.value = ''; // 保持空白，使用者輸入時才變更

    // 同步顯示目前裝備的冒險角色大貼紙
    const modalAvatar = document.getElementById('profile-modal-avatar');
    if (modalAvatar && window.shopManager) {
      const activeAvatar = window.shopManager.catalog.avatars.find(a => a.id === window.shopManager.data.equippedAvatar);
      modalAvatar.innerText = activeAvatar ? activeAvatar.preview : '🐱';
    }

    profileModal.classList.add('active');
  };

  document.getElementById('close-profile-btn').onclick = () => profileModal.classList.remove('active');

  document.getElementById('save-profile-btn').onclick = async () => {
    const p = window.cloudSync ? window.cloudSync.profile : null;
    if (!p) return;
    const nickInp = document.getElementById('input-nickname');
    const passInp = document.getElementById('input-profile-password');
    const newNick = (nickInp ? nickInp.value.trim() : '') || p.nickname || '鍵盤小英雄';
    const newPass = passInp ? passInp.value.trim() : '';

    p.nickname = newNick;
    if (newPass) {
      p.password = newPass;
    }
    window.cloudSync.profile = p;
    localStorage.setItem(window.cloudSync.storageKey, JSON.stringify(p));
    window.cloudSync.updateProfileBadgeUI();

    if (window.cloudSync.isFirebaseReady) {
      await window.cloudSync.syncProfileToCloud();
    }
    if (window.shopManager) window.shopManager.updateUI();
    profileModal.classList.remove('active');
    if (window.cloudSync.showToast) {
      window.cloudSync.showToast('✅ 暱稱與通行密碼已更新！', 'success');
    } else {
      alert('✅ 暱稱與通行密碼已更新！');
    }
  };

  // 2. 學生登載資料歡迎彈窗 (首頁載入)
  const loginModal = document.getElementById('modal-student-login');
  const loginForm = document.getElementById('form-student-login');
  const loginClassSel = document.getElementById('login-class-select');
  const loginClassPasscodeGroup = document.getElementById('login-class-passcode-group');
  const loginClassPasscodeInp = document.getElementById('login-class-passcode-input');
  const loginClassPasscodeError = document.getElementById('login-class-passcode-error');
  const loginSeatInp = document.getElementById('login-seat-input');
  const loginNameInp = document.getElementById('login-name-input');
  const loginPassInp = document.getElementById('login-password-input');
  const loginPassError = document.getElementById('login-password-error');

  function updateClassPasscodeVisibility(cls) {
    if (!loginClassPasscodeGroup) return;
    const isRequired = window.cloudSync ? window.cloudSync.isClassPasscodeRequired(cls) : false;
    if (isRequired) {
      loginClassPasscodeGroup.style.display = 'block';
      if (loginClassPasscodeInp) loginClassPasscodeInp.required = true;
    } else {
      loginClassPasscodeGroup.style.display = 'none';
      if (loginClassPasscodeInp) {
        loginClassPasscodeInp.required = false;
        loginClassPasscodeInp.value = '';
      }
    }
    if (loginClassPasscodeError) loginClassPasscodeError.style.display = 'none';
  }

  if (loginClassSel) {
    loginClassSel.addEventListener('change', () => {
      updateClassPasscodeVisibility(loginClassSel.value);
    });
  }

  window.openStudentLoginModal = function() {
    if (loginClassSel) loginClassSel.value = '';
    if (loginPassError) loginPassError.style.display = 'none';
    updateClassPasscodeVisibility('');
    if (loginModal) loginModal.classList.add('active');
  };

  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const selClass = loginClassSel ? loginClassSel.value : '';
      const seatVal = loginSeatInp ? loginSeatInp.value.trim() : '';
      const nameVal = loginNameInp ? loginNameInp.value.trim() : '';
      const passVal = loginPassInp ? loginPassInp.value.trim() : '';

      if (loginPassError) loginPassError.style.display = 'none';
      if (loginClassPasscodeError) loginClassPasscodeError.style.display = 'none';

      if (!selClass || selClass === '=選擇班級=') {
        alert('⚠️ 請先選擇您的所屬班級喔！');
        if (loginClassSel) loginClassSel.focus();
        return;
      }

      // 需求 5: 班級專屬通關密碼驗證（若該班級老師有在後台開啟）
      if (window.cloudSync && window.cloudSync.isClassPasscodeRequired(selClass)) {
        const enteredClassPass = loginClassPasscodeInp ? loginClassPasscodeInp.value.trim() : '';
        const isClassPassOk = window.cloudSync.verifyClassPasscode(selClass, enteredClassPass);
        if (!isClassPassOk) {
          if (loginClassPasscodeError) loginClassPasscodeError.style.display = 'block';
          if (loginClassPasscodeInp) {
            loginClassPasscodeInp.select();
            loginClassPasscodeInp.focus();
          }
          return;
        } else {
          if (loginClassPasscodeError) loginClassPasscodeError.style.display = 'none';
        }
      }

      if (!seatVal) {
        alert('⚠️ 請輸入學生座號喔！');
        if (loginSeatInp) loginSeatInp.focus();
        return;
      }
      if (!nameVal) {
        alert('⚠️ 請輸入姓名或打字暱稱喔！');
        if (loginNameInp) loginNameInp.focus();
        return;
      }
      if (!passVal) {
        alert('⚠️ 請設定或輸入學生通行密碼！');
        if (loginPassInp) loginPassInp.focus();
        return;
      }

      if (window.cloudSync) {
        // 先向雲端查詢並驗證密碼
        const cloudRes = await window.cloudSync.loadProfileFromCloud(selClass, seatVal, passVal);

        if (cloudRes && cloudRes.error === 'PASSWORD_MISMATCH') {
          if (loginPassError) {
            loginPassError.style.display = 'block';
            if (loginPassInp) {
              loginPassInp.select();
              loginPassInp.focus();
            }
          } else {
            alert(cloudRes.message || '密碼錯誤！');
          }
          return;
        }

        window.cloudSync.saveProfile(selClass, seatVal, nameVal, passVal);

        if (cloudRes && cloudRes.data) {
          const cloudData = cloudRes.data;
          // 若有輸入新暱稱，同步更新到雲端
          if (nameVal && nameVal !== cloudData.nickname) {
            window.cloudSync.profile.nickname = nameVal;
            window.cloudSync.syncProfileToCloud();
          }
          // 重新整理關卡地圖卡片的解鎖狀態（根據雲端星星解鎖關卡）
          if (gameState.currentCategory && window.COURSES) {
            renderLessonsGrid(window.COURSES[gameState.currentCategory]);
          }
        }
      }
      if (window.shopManager) {
        window.shopManager.updateUI();
      }
      if (window.soundEngine) {
        window.soundEngine.playCoin();
      }

      if (loginModal) loginModal.classList.remove('active');
      focusTyping();
    };
  }

  // 3. 教師與後臺班級參數管理系統彈窗 (含密碼防護與修改機制)
  const adminModal = document.getElementById('modal-admin');
  const adminAuthModal = document.getElementById('modal-admin-auth');
  const authForm = document.getElementById('form-admin-auth');
  const authPasswordInp = document.getElementById('admin-auth-password');
  const authErrorEl = document.getElementById('admin-auth-error');

  // 開啟教師身分密碼驗證視窗
  window.openAdminAuthModal = function() {
    if (adminAuthModal) {
      if (authPasswordInp) authPasswordInp.value = '';
      if (authErrorEl) authErrorEl.style.display = 'none';
      adminAuthModal.classList.add('active');
      setTimeout(() => {
        if (authPasswordInp) authPasswordInp.focus();
      }, 100);
    }
  };

  const openAdminBtns = [
    document.getElementById('nav-btn-admin'),
    document.getElementById('login-admin-quicklink'),
    document.getElementById('login-teacher-quicklink')
  ].filter(Boolean);

  openAdminBtns.forEach(btn => {
    btn.onclick = (e) => {
      if (e) e.preventDefault();
      window.open('admin.html', '_blank');
    };
  });

  // 驗證密碼送出
  if (authForm) {
    authForm.onsubmit = (e) => {
      e.preventDefault();
      const entered = authPasswordInp ? authPasswordInp.value : '';
      const isCorrect = window.cloudSync ? window.cloudSync.verifyAdminPassword(entered) : (entered === '1234');

      if (isCorrect) {
        if (adminAuthModal) adminAuthModal.classList.remove('active');
        if (adminModal) adminModal.classList.add('active');
        window.renderAdminClassTags();

        // 更新後臺面板上的目前密碼提示
        const currentPwdHint = document.getElementById('admin-current-pwd-hint');
        if (currentPwdHint && window.cloudSync) {
          currentPwdHint.innerText = window.cloudSync.getAdminPassword();
        }

        // 自動執行一次 Firebase 即時連線診斷
        runFirebaseDiagnostic();

        // 需求 2: 自動載入學生帳號與通行密碼管理名冊
        renderAdminStudentTable();
      } else {
        if (authErrorEl) authErrorEl.style.display = 'block';
        if (authPasswordInp) {
          authPasswordInp.select();
          authPasswordInp.focus();
        }
      }
    };
  }

  // 關閉驗證視窗
  const closeAuthBtn = document.getElementById('close-admin-auth-btn');
  if (closeAuthBtn) {
    closeAuthBtn.onclick = () => {
      if (adminAuthModal) adminAuthModal.classList.remove('active');
    };
  }

  // 關閉後臺視窗
  const closeAdminBtns = [
    document.getElementById('close-admin-btn'),
    document.getElementById('admin-btn-finish')
  ].filter(Boolean);

  closeAdminBtns.forEach(btn => {
    btn.onclick = () => {
      if (adminModal) adminModal.classList.remove('active');
    };
  });

  // 繪製後臺班級標籤與清單
  window.renderAdminClassTags = function() {
    const container = document.getElementById('admin-class-tags-container');
    const countEl = document.getElementById('admin-class-count');
    const batchTextarea = document.getElementById('admin-batch-textarea');
    if (!container || !window.cloudSync) return;

    container.innerHTML = '';
    const list = window.cloudSync.classList || [];
    if (countEl) countEl.innerText = list.length;
    if (batchTextarea) batchTextarea.value = list.join('\n');

    list.forEach(cls => {
      const tag = document.createElement('span');
      tag.className = 'admin-class-tag';
      tag.innerHTML = `
        <span>${cls}</span>
        <button type="button" class="btn-tag-del" title="刪除「${cls}」">✕</button>
      `;
      tag.querySelector('.btn-tag-del').onclick = () => {
        if (confirm(`確定要從下拉選單中刪除「${cls}」嗎？`)) {
          window.cloudSync.removeClass(cls);
          window.renderAdminClassTags();
        }
      };
      container.appendChild(tag);
    });
  };

  // 後臺：新增單一班級
  const addClassBtn = document.getElementById('admin-add-class-btn');
  const addClassInp = document.getElementById('admin-new-class-input');
  if (addClassBtn && addClassInp) {
    addClassBtn.onclick = () => {
      const val = addClassInp.value.trim();
      if (!val) {
        alert('請輸入要新增的班級名稱（例如：5年4班）！');
        addClassInp.focus();
        return;
      }
      const ok = window.cloudSync.addClass(val);
      if (!ok) {
        alert(`班級「${val}」已經在選單中囉！`);
      } else {
        addClassInp.value = '';
        window.renderAdminClassTags();
      }
    };
    addClassInp.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addClassBtn.click();
      }
    };
  }

  // 後臺：切換批次編輯
  const toggleBatchBtn = document.getElementById('admin-btn-toggle-batch');
  const batchWrapper = document.getElementById('admin-batch-wrapper');
  if (toggleBatchBtn && batchWrapper) {
    toggleBatchBtn.onclick = () => {
      batchWrapper.classList.toggle('hidden');
    };
  }

  // 後臺：儲存批次名冊
  const saveBatchBtn = document.getElementById('admin-btn-save-batch');
  const batchTextarea = document.getElementById('admin-batch-textarea');
  if (saveBatchBtn && batchTextarea) {
    saveBatchBtn.onclick = () => {
      const lines = batchTextarea.value.split(/[\n,，]+/).map(s => s.trim()).filter(Boolean);
      if (lines.length === 0) {
        alert('班級名冊不能為空！請至少輸入一個班級名稱。');
        return;
      }
      window.cloudSync.saveClassList(lines);
      window.renderAdminClassTags();
      if (batchWrapper) batchWrapper.classList.add('hidden');
      alert(`✅ 班級清單已更新！目前下拉選單共有 ${window.cloudSync.classList.length} 個班級。`);
    };
  }

  // 後臺：還原全校預設
  const resetClassesBtn = document.getElementById('admin-btn-reset-classes');
  if (resetClassesBtn) {
    resetClassesBtn.onclick = () => {
      if (confirm('確定要還原為溪洲國小預設班級清單（1~6年級各班）嗎？')) {
        window.cloudSync.resetClassList();
        window.renderAdminClassTags();
        alert('✅ 已成功還原為全校預設班級！');
      }
    };
  }

  // 後臺：修改管理密碼
  const savePasswordBtn = document.getElementById('admin-btn-save-password');
  const newPasswordInp = document.getElementById('admin-new-password');
  if (savePasswordBtn && newPasswordInp) {
    savePasswordBtn.onclick = () => {
      const newPass = newPasswordInp.value.trim();
      if (!newPass) {
        alert('⚠️ 請輸入有效的新密碼（不可為空白）！');
        newPasswordInp.focus();
        return;
      }
      if (newPass.length < 2) {
        alert('⚠️ 密碼長度建議至少 2 個字元以上！');
        newPasswordInp.focus();
        return;
      }

      if (window.cloudSync) {
        window.cloudSync.setAdminPassword(newPass);
      }
      newPasswordInp.value = '';

      const currentPwdHint = document.getElementById('admin-current-pwd-hint');
      if (currentPwdHint) currentPwdHint.innerText = newPass;

      alert(`✅ 後臺管理密碼已成功變更為：【 ${newPass} 】！\n請老師妥善記住新密碼。`);
    };
  }

  // 後臺：清除本機競賽紀錄
  const clearLeaderBtn = document.getElementById('admin-btn-clear-leaderboard');
  if (clearLeaderBtn) {
    clearLeaderBtn.onclick = () => {
      if (confirm('⚠️ 確定要清除本機累積的所有學生打字競賽紀錄嗎？\n此動作適合於新學期或新班級特訓前進行。')) {
        localStorage.removeItem('typehero_local_leaderboard');
        alert('✅ 本機排行榜紀錄已成功清空！');
      }
    };
  }

  // 後臺：Firebase 雲端連線測試按鈕
  const testFirebaseBtn = document.getElementById('admin-btn-test-firebase');
  if (testFirebaseBtn) {
    testFirebaseBtn.onclick = runFirebaseDiagnostic;
  }

  // 後臺：課堂自訂特訓題目發布與清除 (Proposal IV.1)
  const saveCustomBtn = document.getElementById('admin-btn-save-custom');
  const clearCustomBtn = document.getElementById('admin-btn-clear-custom');
  const customTitleInp = document.getElementById('admin-custom-title');
  const customTextInp = document.getElementById('admin-custom-text');

  if (saveCustomBtn && customTextInp) {
    const savedCustom = localStorage.getItem('typehero_custom_lesson');
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        if (customTitleInp) customTitleInp.value = parsed.title || '';
        customTextInp.value = parsed.text || '';
      } catch (e) {}
    }

    saveCustomBtn.onclick = () => {
      const text = customTextInp.value.trim();
      const title = (customTitleInp ? customTitleInp.value.trim() : '') || '課堂自訂特訓題目';
      if (!text) {
        alert('⚠️ 請輸入特訓題目的內容文字！');
        customTextInp.focus();
        return;
      }
      const data = { title, summary: '今日課堂專屬題目', text };
      localStorage.setItem('typehero_custom_lesson', JSON.stringify(data));
      initCustomLessonSystem();

      alert(`✅ 課堂特訓題目已成功發布！\n學生於課程分類點選「🏫 課堂自訂」即可開始打字！`);
    };
  }

  if (clearCustomBtn) {
    clearCustomBtn.onclick = () => {
      if (confirm('確定要清除目前發布的課堂自訂題目嗎？')) {
        localStorage.removeItem('typehero_custom_lesson');
        delete window.COURSES.custom;
        const tabCustom = document.getElementById('tab-custom-lesson');
        if (tabCustom) tabCustom.style.display = 'none';
        if (customTitleInp) customTitleInp.value = '';
        if (customTextInp) customTextInp.value = '';
        alert('✅ 已清除自訂題目！');
        if (gameState.currentCategory === 'custom') {
          loadCategory('zhuyin');
        }
      }
    };
  }
}

/**
 * 載入指定班級之課堂自訂特訓題目 (Proposal VI.1 & Req 5)
 */
async function loadCustomLessonForClass(targetClass) {
  const customContainer = document.getElementById('custom-tab-container') || document.getElementById('tab-custom-lesson');
  const classDropdown = document.getElementById('custom-lesson-class-select');
  const studentClass = (window.cloudSync && window.cloudSync.profile) ? window.cloudSync.profile.className : 'all';
  const queryClass = targetClass || (classDropdown ? classDropdown.value : studentClass) || 'all';

  let lessonData = null;
  if (window.cloudSync && window.cloudSync.fetchCustomLessonFromCloud) {
    lessonData = await window.cloudSync.fetchCustomLessonFromCloud(queryClass);
  }

  // 備援讀取本地
  if (!lessonData) {
    try {
      const allLessons = JSON.parse(localStorage.getItem('typehero_custom_lessons') || '{}');
      lessonData = allLessons[queryClass] || allLessons['all'] || JSON.parse(localStorage.getItem('typehero_custom_lesson') || 'null');
    } catch (e) {}
  }

  if (lessonData && lessonData.text) {
    window.COURSES.custom = [{
      id: 'custom-1',
      title: lessonData.title || (queryClass === 'all' ? '全校今日特訓' : `${queryClass}今日特訓`),
      summary: lessonData.summary || `${queryClass === 'all' ? '全校' : queryClass}專屬題目`,
      keys: [],
      text: lessonData.text
    }];

    if (customContainer) customContainer.style.display = 'inline-flex';
    if (classDropdown && queryClass) classDropdown.value = queryClass;

    // 若當前正處於自訂分類中，即時重新繪製關卡與載入第一關
    if (gameState.currentCategory === 'custom') {
      renderLessonsGrid(window.COURSES.custom);
      loadLesson(window.COURSES.custom[0]);
    }
    return true;
  } else {
    // 若該班無特訓且全校亦無特訓
    if (window.COURSES && !window.COURSES.custom) {
      if (customContainer) customContainer.style.display = 'none';
    }
    return false;
  }
}

/**
 * 初始化課堂自訂題目系統與班級下拉選單綁定 (Proposal VI.1 & Req 5)
 */
function initCustomLessonSystem() {
  const classDropdown = document.getElementById('custom-lesson-class-select');
  if (classDropdown) {
    classDropdown.onchange = () => {
      loadCustomLessonForClass(classDropdown.value);
    };
  }

  // 嘗試載入學生所屬班級或全校特訓
  const studentClass = (window.cloudSync && window.cloudSync.profile) ? window.cloudSync.profile.className : 'all';
  loadCustomLessonForClass(studentClass);
}

/**
 * 執行 Firebase 連線診斷並渲染至後臺狀態框
 */
async function runFirebaseDiagnostic() {
  const statusBox = document.getElementById('admin-firebase-status-box');
  if (!statusBox) return;

  statusBox.innerHTML = '<span style="color:var(--brand-primary); font-weight:bold;">🔄 正在連線至 Firebase 測試伺服器...</span>';
  if (!window.cloudSync) {
    statusBox.innerHTML = '<span style="color:#ef4444; font-weight:bold;">❌ 雲端同步模組未載入</span>';
    return;
  }

  const res = await window.cloudSync.testConnection();
  if (res.success) {
    statusBox.innerHTML = `
      <div style="color:#10b981; font-weight:bold; margin-bottom:0.25rem;">
        ✅ ${res.message}
      </div>
      <div style="color:var(--text-muted); font-size:0.75rem;">
        全校即時排行榜已連線 · 學生跨電腦漫遊已啟動 · 班級設定已同步！
      </div>
    `;
  } else {
    statusBox.innerHTML = `
      <div style="color:#ef4444; font-weight:bold; margin-bottom:0.25rem;">
        ❌ 連線異常 (${res.code || '連線受阻'})
      </div>
      <div style="color:#f87171; font-size:0.75rem; line-height:1.4;">
        ${res.reason}
      </div>
    `;
  }
}

/**
 * 需求 2: 繪製教師後臺之學生帳號與通行密碼名冊 (支援依班級篩選與即時重設密碼)
 */
function renderAdminStudentTable() {
  const container = document.getElementById('admin-students-table-container');
  const classFilter = document.getElementById('admin-student-class-filter');
  const refreshBtn = document.getElementById('admin-btn-refresh-students');
  if (!container || !window.cloudSync) return;

  // 1. 填充班級篩選下拉選單
  if (classFilter) {
    const classList = window.cloudSync.classList || ['5年3班'];
    const currentVal = classFilter.value || (window.cloudSync.profile ? window.cloudSync.profile.className : classList[0]);
    classFilter.innerHTML = classList.map(cls => `<option value="${cls}" ${cls === currentVal ? 'selected' : ''}>${cls}</option>`).join('');

    classFilter.onchange = () => {
      loadStudentsForClass(classFilter.value);
    };
  }

  // 2. 重新整理按鈕
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      const cls = classFilter ? classFilter.value : (window.cloudSync.profile ? window.cloudSync.profile.className : '5年3班');
      loadStudentsForClass(cls);
    };
  }

  // 3. 預設載入選定班級名冊
  const initialClass = classFilter ? classFilter.value : (window.cloudSync.profile ? window.cloudSync.profile.className : '5年3班');
  loadStudentsForClass(initialClass);
}

window.renderAdminStudentTable = renderAdminStudentTable;

/**
 * 自雲端載入指定班級的所有學生帳號、密碼與打字進度
 */
async function loadStudentsForClass(className) {
  const container = document.getElementById('admin-students-table-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; padding:1.2rem; font-size:0.78rem; color:var(--text-muted);">
      🔄 正在自 Firebase 讀取【${className}】學生帳號名冊...
    </div>
  `;

  if (!window.cloudSync) {
    container.innerHTML = '<div style="text-align:center; padding:1.2rem; color:#ef4444; font-size:0.78rem;">雲端模組未載入</div>';
    return;
  }

  const list = await window.cloudSync.fetchClassStudents(className);

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:1.5rem; font-size:0.8rem; color:var(--text-muted); line-height:1.6;">
        📂 班級【${className}】目前尚無學生雲端帳號紀錄。<br>
        <span style="font-size:0.72rem; color:var(--text-muted);">（學生於首頁登入並輸入密碼後，系統會自動雲端建檔並顯示於此名冊）</span>
      </div>
    `;
    return;
  }

  let tableHtml = `
    <table class="admin-students-table">
      <thead>
        <tr>
          <th style="width: 50px;">座號</th>
          <th>暱稱 / 姓名</th>
          <th style="width: 90px;">通行密碼</th>
          <th style="width: 65px;">等級</th>
          <th style="width: 75px;">星幣</th>
          <th style="width: 80px; text-align: center;">操作</th>
        </tr>
      </thead>
      <tbody>
  `;

  list.forEach(stu => {
    const seat = stu.seatNumber || '00';
    const nickname = stu.nickname ? stu.nickname : '<span style="color:var(--text-muted); font-style:italic;">尚未設定</span>';
    const pwd = stu.password || '無';
    const level = stu.level || 1;
    const coins = stu.coins || 0;

    tableHtml += `
      <tr>
        <td style="font-weight:bold; color:var(--brand-primary);">${seat}號</td>
        <td><strong>${nickname}</strong></td>
        <td><span class="admin-pwd-badge" title="學生通行密碼">${pwd}</span></td>
        <td>Lv.${level}</td>
        <td>💰 ${coins}</td>
        <td style="text-align:center;">
          <button class="admin-btn-action-mini btn-reset-pwd" data-seat="${seat}" data-name="${stu.nickname || ''}" data-pwd="${pwd}" title="重設此學生密碼">
            🔑 修改
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  container.innerHTML = tableHtml;

  // 綁定重設密碼按鈕事件
  container.querySelectorAll('.btn-reset-pwd').forEach(btn => {
    btn.onclick = async () => {
      const seat = btn.dataset.seat;
      const sName = btn.dataset.name || `${seat}號學生`;
      const oldPwd = btn.dataset.pwd !== '無' ? btn.dataset.pwd : '';
      const input = prompt(`【密碼維護】請輸入 ${className} ${seat}號（${sName}）的新通行密碼：`, oldPwd || '1234');
      if (input !== null) {
        const newPwd = input.trim();
        if (!newPwd) {
          alert('⚠️ 密碼不可為空白！');
          return;
        }
        btn.disabled = true;
        btn.innerText = '處理中...';
        const ok = await window.cloudSync.adminUpdateStudentPassword(className, seat, newPwd);
        if (ok) {
          alert(`✅ 成功！已將 ${className} ${seat}號 密碼重設為：【 ${newPwd} 】`);
          loadStudentsForClass(className);
        } else {
          alert('❌ 密碼變更失敗，請確認 Firebase 網路連線狀態。');
          btn.disabled = false;
          btn.innerText = '🔑 修改';
        }
      }
    };
  });
}

// ----------------------------------------------------
// 13. 商城項目渲染 (大貼紙視覺設計)
// ----------------------------------------------------
function initShopUI() {
  const shopTabs = document.querySelectorAll('.shop-tab-btn');
  shopTabs.forEach(btn => {
    btn.onclick = () => {
      shopTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderShopItems(btn.dataset.tab);
    };
  });
}

function renderShopItems(tabCategory) {
  const container = document.getElementById('shop-items-container');
  container.innerHTML = '';

  if (!window.shopManager) return;
  const items = window.shopManager.catalog[tabCategory] || [];
  const pData = window.shopManager.data;

  const unlockedList = tabCategory === 'skins' ? pData.unlockedSkins
    : tabCategory === 'sounds' ? pData.unlockedSounds
    : pData.unlockedAvatars;

  const equippedItem = tabCategory === 'skins' ? pData.equippedSkin
    : tabCategory === 'sounds' ? pData.equippedSound
    : pData.equippedAvatar;

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'shop-item-card';

    const isUnlocked = unlockedList.includes(item.id);
    const isEquipped = equippedItem === item.id;

    let btnText = isEquipped ? '✓ 使用中' : isUnlocked ? '裝備' : `💰 ${item.price} 幣`;
    let btnStyle = isEquipped ? 'background: #10b981; color: white;' : isUnlocked ? 'background: var(--brand-primary); color: white;' : 'background: #fbbf24; color: #78350f;';
    const activeRingStyle = isEquipped ? 'box-shadow: 0 0 20px var(--brand-glow); border-color: var(--brand-primary);' : '';
    const stickerBadge = isEquipped ? '<span style="position:absolute; top:8px; right:8px; background:#10b981; color:#fff; font-size:0.7rem; font-weight:800; border-radius:999px; padding:0.15rem 0.5rem; box-shadow:0 2px 6px rgba(0,0,0,0.3);">✓ 使用中</span>' : '';

    card.innerHTML = `
      ${stickerBadge}
      <div class="shop-item-preview" style="${activeRingStyle}">${item.preview}</div>
      <div class="shop-item-title">${item.name}</div>
      <div class="shop-item-desc">${item.desc}</div>
      <button class="shop-item-btn" style="${btnStyle}" id="shop-btn-${item.id}">${btnText}</button>
    `;

    container.appendChild(card);

    document.getElementById(`shop-btn-${item.id}`).onclick = () => {
      if (isEquipped) return;
      window.shopManager.buyItem(tabCategory, item.id);
      renderShopItems(tabCategory);
    };
  });
}

// ----------------------------------------------------
// 14. 多元評價排行榜資料渲染 (Proposal IV.4)
// ----------------------------------------------------
let currentLeaderboardTab = 'wpm';

async function renderLeaderboard(type = currentLeaderboardTab) {
  currentLeaderboardTab = type;
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  // 更新分頁按鈕視覺狀態
  const tabMap = {
    'wpm': document.getElementById('lb-tab-wpm'),
    'accuracy': document.getElementById('lb-tab-accuracy'),
    'diligence': document.getElementById('lb-tab-diligence')
  };

  Object.keys(tabMap).forEach(key => {
    const btn = tabMap[key];
    if (btn) {
      if (key === type) {
        btn.style.background = 'var(--brand-primary)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--brand-primary)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted)';
        btn.style.borderColor = 'var(--border-color)';
      }
    }
  });

  container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">正在載入即時榮譽榜...</div>';

  if (!window.cloudSync) {
    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:#ef4444;">雲端模組未載入</div>';
    return;
  }

  const rawList = await window.cloudSync.fetchTopScores(30);

  let filtered = [...rawList];
  if (type === 'wpm') {
    // 神速榜：依 WPM 降序
    filtered.sort((a, b) => (b.wpm || 0) - (a.wpm || 0));
  } else if (type === 'accuracy') {
    // 百步穿楊榜：100% 準確率優先，次之按 WPM
    filtered = filtered.filter(item => (item.accuracy || 0) >= 95);
    filtered.sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0) || (b.wpm || 0) - (a.wpm || 0));
  } else if (type === 'diligence') {
    // 勤學毅力榜：依累積練習按鍵總數或星星數
    filtered.sort((a, b) => ((b.stars || 0) + (b.totalKeys || 0)) - ((a.stars || 0) + (a.totalKeys || 0)) || (b.wpm || 0) - (a.wpm || 0));
  }

  const list = filtered.slice(0, 10);

  if (list.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">目前尚無符合此評價維度的紀錄，快來搶先上榜！</div>';
    return;
  }

  container.innerHTML = '';
  list.forEach((item, index) => {
    const rank = index + 1;
    const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
    const crown = rank === 1 ? '👑 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';

    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <span class="leaderboard-rank ${rankClass}">${crown}${rank}</span>
        <div>
          <div style="font-weight:bold;">${item.nickname} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${item.className || '學生'})</span></div>
          <div style="font-size:0.72rem; color:var(--text-muted);">${item.lessonTitle || '打字特訓'}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.1rem; font-weight:800; color:var(--brand-primary);">${item.wpm} <span style="font-size:0.7rem;">字/分 (WPM)</span></div>
        <div style="font-size:0.72rem; color:#10b981; font-weight:600;">輸入準確率 ${item.accuracy}%</div>
      </div>
    `;
    container.appendChild(row);
  });
}

