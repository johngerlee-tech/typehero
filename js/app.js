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
  initTabs();
  initModals();
  initShopUI();
  initInputListeners();
  initOpacityControls();

  // 預設載入注音第 1 關
  loadCategory('zhuyin');

  // 初始化班級下拉選單與學生身分顯示
  if (window.cloudSync) {
    window.cloudSync.populateClassSelects();
    window.cloudSync.updateProfileBadgeUI();
  }

  // 載入首頁先跳出學生班級、座號與姓名登載彈窗
  const loginModal = document.getElementById('modal-student-login');
  if (loginModal) {
    loginModal.classList.add('active');
    const p = window.cloudSync ? window.cloudSync.profile : null;
    if (p) {
      const seatInp = document.getElementById('login-seat-input');
      const nameInp = document.getElementById('login-name-input');
      const classSel = document.getElementById('login-class-select');
      if (seatInp) seatInp.value = p.seatNumber || '';
      if (nameInp) nameInp.value = p.nickname || '';
      if (classSel) classSel.value = p.className || (window.cloudSync.classList[0] || '5年3班');
    }
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

// ----------------------------------------------------
// 3. 字元匹配比對核心 (支援全形標點相容與注音鍵對應)
// ----------------------------------------------------
function isCharMatch(typed, expected) {
  if (typed === expected) return true;

  // 1. 全形/半形常用標點相容處理
  const puncMap = {
    ',': '，', '，': ',',
    '.': '。', '。': '.',
    '!': '！', '！': '!',
    '?': '？', '？': '?',
    ';': '；', '；': ';',
    ':': '：', '：': ':',
    '\'': '、', '、': '\'',
    '[': '「', '「': '[',
    ']': '」', '」': ']'
  };
  if (puncMap[typed] === expected || puncMap[expected] === typed) {
    return true;
  }

  // 2. 注音符號實體鍵位映射 (例如在注音盲打關卡，敲擊實體鍵 '1' 等同 'ㄅ')
  if (window.ZHUYIN_KEY_MAP) {
    if (window.ZHUYIN_KEY_MAP[expected] === typed.toLowerCase()) return true;
    if (window.ZHUYIN_KEY_MAP[typed] === expected) return true;
  }

  // 3. 英文字母大小寫相容
  if (typed.toLowerCase() === expected.toLowerCase() && expected.length === 1 && expected >= 'a' && expected <= 'z') {
    return true;
  }

  return false;
}

// ----------------------------------------------------
// 4. 輸入字元推進與正誤判定 (嚴格準確率計數)
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

    // 每次有效按鍵敲擊，計數器確實累加
    gameState.totalKeyStrokes++;

    const isCorrect = isCharMatch(typedChar, expectedChar);

    if (isCorrect) {
      streamSpans[gameState.currentIndex].className = 'char-correct';
      gameState.correctCount++;
      gameState.comboCount++;
      if (gameState.comboCount > gameState.comboMax) {
        gameState.comboMax = gameState.comboCount;
      }

      // 手指動態敲擊下壓反饋
      const activeTargetEl = document.querySelector('.key-target');
      const activeFinger = activeTargetEl ? activeTargetEl.dataset.finger : null;
      if (window.handsOverlay) {
        window.handsOverlay.onKeyPress(activeFinger);
      }

      if (expectedChar === ' ') {
        if (window.soundEngine) window.soundEngine.playKey('space', gameState.comboCount);
      } else {
        if (window.soundEngine) window.soundEngine.playKey('std', gameState.comboCount);
      }
    } else {
      // 標註為錯誤，打錯不卡關，游標依舊向前
      streamSpans[gameState.currentIndex].className = 'char-wrong';
      gameState.comboCount = 0; // 中斷連擊
      if (window.soundEngine) window.soundEngine.playError();
    }

    updateComboUI(gameState.comboCount);
    gameState.currentIndex++;

    if (gameState.currentIndex >= targetText.length) {
      // 抵達終點，進行結算審查
      finishLesson();
      return;
    } else {
      // 更新下游標與鍵盤/手指引導
      streamSpans[gameState.currentIndex].className = 'char-pending char-cursor';
      highlightTarget(targetText[gameState.currentIndex]);
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

      const wBase = cfg.wBase;
      const wTip = cfg.wTip;

      const blx = bx + nx * (wBase / 2);
      const bly = by + ny * (wBase / 2);
      const brx = bx - nx * (wBase / 2);
      const bry = by - ny * (wBase / 2);

      const tlx = tx + nx * (wTip / 2);
      const tly = ty + ny * (wTip / 2);
      const trx = tx - nx * (wTip / 2);
      const try_ = ty - ny * (wTip / 2);

      const fingerD = `M ${blx.toFixed(1)} ${bly.toFixed(1)} L ${tlx.toFixed(1)} ${tly.toFixed(1)} A ${(wTip/2).toFixed(1)} ${(wTip/2).toFixed(1)} 0 0 1 ${trx.toFixed(1)} ${try_.toFixed(1)} L ${brx.toFixed(1)} ${bry.toFixed(1)} Z`;

      // 指甲 (Fingernail)
      const nLx = tx + nx * (wTip * 0.32) - ux * (wTip * 0.22);
      const nLy = ty + ny * (wTip * 0.32) - uy * (wTip * 0.22);
      const nRx = tx - nx * (wTip * 0.32) - ux * (wTip * 0.22);
      const nRy = ty - ny * (wTip * 0.32) - uy * (wTip * 0.22);
      const nTopX = tx + ux * (wTip * 0.22);
      const nTopY = ty + uy * (wTip * 0.22);
      const nailD = `M ${nLx.toFixed(1)} ${nLy.toFixed(1)} Q ${nTopX.toFixed(1)} ${nTopY.toFixed(1)} ${nRx.toFixed(1)} ${nRy.toFixed(1)} Q ${tx.toFixed(1)} ${(ty - uy * (wTip * 0.42)).toFixed(1)} ${nLx.toFixed(1)} ${nLy.toFixed(1)} Z`;

      // 關節摺痕線 (Creases)
      const makeCrease = (ratio, wRatio) => {
        const cx = bx + ux * len * ratio;
        const cy = by + uy * len * ratio;
        const w = (wBase + (wTip - wBase) * ratio) * wRatio;
        const p1x = cx + nx * (w / 2) - ux * 1.5;
        const p1y = cy + ny * (w / 2) - uy * 1.5;
        const p2x = cx - nx * (w / 2) - ux * 1.5;
        const p2y = cy - ny * (w / 2) - uy * 1.5;
        return `M ${p1x.toFixed(1)} ${p1y.toFixed(1)} Q ${cx.toFixed(1)} ${(cy + uy * 2).toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`;
      };

      const crease1 = makeCrease(0.42, 0.48);
      const crease2 = makeCrease(0.70, 0.44);

      fingersHtml += `
        <g class="finger-group" id="hand-finger-${f}">
          <path class="hand-finger-path ${isActive ? 'finger-active' : ''}" d="${fingerD}" />
          <path class="finger-crease-line" d="${crease1}" />
          <path class="finger-crease-line" d="${crease2}" />
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

      if (item.text) {
        btn.innerHTML = `<span class="key-char-en">${item.text}</span>${dotHtml}`;
      } else {
        const enChar = item.key.toUpperCase();
        const zhChar = item.zh || '';
        const shiftChar = item.shift || '';

        btn.innerHTML = `
          ${shiftChar ? `<span class="key-char-shift">${shiftChar}</span>` : ''}
          ${zhChar ? `<span class="key-char-zh">${zhChar}</span>` : ''}
          <span class="key-char-en">${enChar}</span>
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
  if (category === 'zhuyin') {
    badgeEl.innerText = '🇹🇼 台灣大千注音盲打特訓';
  } else if (category === 'chinese') {
    badgeEl.innerText = '📖 國小生字詞與全形標點選字';
  } else {
    badgeEl.innerText = '🔤 國小標準英文盲打挑戰';
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

  // 自動聚焦
  setTimeout(focusTyping, 60);
}

// ----------------------------------------------------
// 8. 鍵位指引與手指高亮 (Hands & Key Highlight)
// ----------------------------------------------------
function highlightFinger(fingerId) {
  // 左右手指動態已整合至全覆蓋人體工學半透明引導層中，此處保留供相容性呼叫
}

function highlightTarget(char) {
  // 清除現有鍵位高亮
  document.querySelectorAll('.keycap').forEach(el => el.classList.remove('key-target'));

  const hudBadge = document.getElementById('hud-finger-badge');
  const hudName = document.getElementById('hud-finger-name');
  const hudIcon = document.getElementById('hud-hand-icon');
  const hudHint = document.getElementById('hud-action-hint');

  if (!char) {
    if (window.handsOverlay) window.handsOverlay.setTarget(null, null, null);
    if (hudName) hudName.innerText = '關卡完成';
    if (hudHint) hudHint.innerText = '請進行成績結算';
    return;
  }

  let targetKeyId = null;
  let targetFinger = null;
  let charDisplay = (char === ' ') ? '空白鍵 (一聲)' : char;

  // A. 空白鍵
  if (char === ' ') {
    targetKeyId = 'key-space';
    targetFinger = 'RT';
  }
  // B. 注音符號匹配 (從 ZHUYIN_KEY_MAP 反查對應實體鍵)
  else if (window.ZHUYIN_KEY_MAP && window.ZHUYIN_KEY_MAP[char]) {
    const physicalKey = window.ZHUYIN_KEY_MAP[char];
    targetKeyId = `key-${physicalKey}`;
  }
  // C. 常用全形標點映射
  else if (char === '，') targetKeyId = 'key-,';
  else if (char === '。') targetKeyId = 'key-.';
  else if (char === '！') targetKeyId = 'key-1';
  else if (char === '？') targetKeyId = 'key-/';
  else if (char === '、') targetKeyId = 'key-\'';
  else if (char === '；') targetKeyId = 'key-;';
  else if (char === '：') targetKeyId = 'key-;';
  else if (char === '「' || char === '」') targetKeyId = 'key-[';
  // D. 英文字母直接匹配
  else {
    const lower = char.toLowerCase();
    targetKeyId = `key-${lower}`;
  }

  const targetEl = document.getElementById(targetKeyId);
  if (targetEl) {
    targetEl.classList.add('key-target');
    targetFinger = targetEl.dataset.finger;

    const info = FINGER_INFO[targetFinger] || { hand: '單手', finger: '按鍵', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', icon: '👆', homeKey: '' };

    // 1. 更新鍵盤頂部 HUD 指法導引列 (紅框風格)
    if (hudBadge) {
      hudBadge.style.borderColor = '#ef4444';
      hudBadge.style.boxShadow = `0 0 12px rgba(239, 68, 68, 0.4)`;
    }
    if (hudIcon) hudIcon.innerText = info.icon;
    if (hudName) hudName.innerText = `${info.hand} · ${info.finger}`;
    if (hudHint) {
      hudHint.innerHTML = `請使用 <strong style="color:#ef4444; font-size:0.95rem;">${info.hand}${info.finger}</strong> 輕敲 [ <strong style="color:var(--text-main); font-size:1.05rem;">${charDisplay}</strong> ]`;
    }
  }

  // 2. 驅動覆蓋於鍵盤上的半透明人體工學十指動畫
  if (window.handsOverlay) {
    window.handsOverlay.setTarget(targetKeyId, targetFinger, char);
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

  // 排行榜彈窗
  const leaderModal = document.getElementById('modal-leaderboard');
  document.getElementById('nav-btn-leaderboard').onclick = async () => {
    leaderModal.classList.add('active');
    await renderLeaderboard();
  };
  document.getElementById('close-leader-btn').onclick = () => leaderModal.classList.remove('active');

  // 1. 個人班級雲端設定彈窗
  const profileModal = document.getElementById('modal-profile');
  document.getElementById('user-profile-badge').onclick = () => {
    const p = window.cloudSync ? window.cloudSync.profile : { className: '5年3班', seatNumber: '01', nickname: '鍵盤小英雄' };
    if (window.cloudSync) window.cloudSync.populateClassSelects(p.className);
    const classSel = document.getElementById('input-class-name');
    const seatInp = document.getElementById('input-seat-num');
    const nickInp = document.getElementById('input-nickname');

    if (classSel) classSel.value = p.className;
    if (seatInp) seatInp.value = p.seatNumber;
    if (nickInp) nickInp.value = p.nickname;

    // 同步顯示目前裝備的冒險角色大貼紙
    const modalAvatar = document.getElementById('profile-modal-avatar');
    if (modalAvatar && window.shopManager) {
      const activeAvatar = window.shopManager.catalog.avatars.find(a => a.id === window.shopManager.data.equippedAvatar);
      modalAvatar.innerText = activeAvatar ? activeAvatar.preview : '🐱';
    }

    profileModal.classList.add('active');
  };
  document.getElementById('close-profile-btn').onclick = () => profileModal.classList.remove('active');
  document.getElementById('save-profile-btn').onclick = () => {
    const c = document.getElementById('input-class-name').value.trim() || '5年3班';
    const s = document.getElementById('input-seat-num').value.trim() || '01';
    const n = document.getElementById('input-nickname').value.trim() || '鍵盤小英雄';
    if (window.cloudSync) window.cloudSync.saveProfile(c, s, n);
    if (window.shopManager) window.shopManager.updateUI();
    profileModal.classList.remove('active');
    alert('✅ 個人檔案與班級設定已更新！');
  };

  // 2. 學生登載資料歡迎彈窗 (首頁載入)
  const loginModal = document.getElementById('modal-student-login');
  const loginForm = document.getElementById('form-student-login');
  const loginClassSel = document.getElementById('login-class-select');
  const loginSeatInp = document.getElementById('login-seat-input');
  const loginNameInp = document.getElementById('login-name-input');

  if (loginForm) {
    loginForm.onsubmit = (e) => {
      e.preventDefault();
      const selClass = loginClassSel ? loginClassSel.value : '5年3班';
      const seatVal = loginSeatInp ? loginSeatInp.value.trim() : '';
      const nameVal = loginNameInp ? loginNameInp.value.trim() : '';

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

      if (window.cloudSync) {
        window.cloudSync.saveProfile(selClass, seatVal, nameVal);
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

  // 3. 教師與後臺班級參數管理系統彈窗
  const adminModal = document.getElementById('modal-admin');
  const openAdminBtns = [
    document.getElementById('nav-btn-admin'),
    document.getElementById('login-admin-quicklink')
  ].filter(Boolean);

  openAdminBtns.forEach(btn => {
    btn.onclick = () => {
      if (adminModal) adminModal.classList.add('active');
      renderAdminClassTags();
    };
  });

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
// 14. 排行榜資料渲染
// ----------------------------------------------------
async function renderLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">正在載入即時榮譽榜...</div>';

  if (!window.cloudSync) return;
  const list = await window.cloudSync.fetchTopScores(10);

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
        <div style="font-size:0.72rem; color:#10b981;">準確率 ${item.accuracy}%</div>
      </div>
    `;
    container.appendChild(row);
  });
}
