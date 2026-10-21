/**
 * TypeHero Firebase 雲端資料庫與全校即時漫遊模組
 * 支援：
 * 1. 內建全校共用 Firebase 配置（各電腦開箱即連，免個別手動輸入憑證）
 * 2. 班級＋座號＋暱稱 雙向雲端漫遊 (Firestore: students 集合)
 * 3. 換電腦登入時，自動從雲端還原星幣、等級、關卡星星、外觀與音效背包
 * 4. 全校即時打字榮譽榜 (Firestore: leaderboard 集合)
 * 5. 全校班級名單與教師後臺密碼自動雙向同步 (Firestore: config/school_config)
 * 6. 具備即時連線診斷機制 (Pill 燈號與後臺一鍵測速診斷)
 * 7. 斷網或權限未開時自動無痛切換「本機快取安全模式」，保證 100% 穩定不卡關！
 */

// ==========================================
// 1. 全校共用預設 Firebase 憑證設定
// ==========================================
const DEFAULT_FIREBASE_CONFIG = { 
  apiKey: "AIzaSyDWbWFjGra5ul1mShoMbHm26SOIqyz_cSI", 
  authDomain: "typehero-1c28f.firebaseapp.com", 
  projectId: "typehero-1c28f", 
  storageBucket: "typehero-1c28f.firebasestorage.app", 
  messagingSenderId: "557883116904", 
  appId: "1:557883116904:web:ed55d47dfb9780e47bdadd", 
  measurementId: "G-D6C1TXC226" 
};
window.DEFAULT_FIREBASE_CONFIG = DEFAULT_FIREBASE_CONFIG;

// 預設全校班級清單（置頂體驗測試組，溪洲國小編制）
const DEFAULT_CLASS_LIST = [
  '🧪 體驗測試組 (自由測試)',
  '一年甲班', '一年乙班',
  '二年甲班', '二年乙班',
  '三年甲班', '三年乙班',
  '四年甲班', '四年乙班',
  '五年甲班', '五年乙班',
  '六年甲班', '六年乙班',
  '教師示範組'
];

class CloudSyncManager {
  constructor() {
    this.storageKey = 'typehero_student_profile';
    this.firebaseConfigKey = 'typehero_firebase_config';
    this.classListKey = 'typehero_class_list';
    this.adminPasswordKey = 'typehero_admin_password';
    this.teacherPasscodeKey = 'typehero_teacher_passcode';
    this.classPasscodesKey = 'typehero_class_passcodes';

    this.profile = this.loadProfile();
    this.classList = this.loadClassList();
    this.classPasscodes = this.loadClassPasscodes();
    this.isFirebaseReady = false;
    this.db = null;
    this.config = null;
    this.lastDiagnostic = null;

    // 初始化 Firebase
    this.initFirebase();
  }

  // ==========================================
  // 後臺管理密碼機制
  // ==========================================
  getAdminPassword() {
    return localStorage.getItem(this.adminPasswordKey) || '1234';
  }

  // 本校教師註冊與授權通關密碼機制 (預設 TK6341106)
  getTeacherPasscode() {
    return localStorage.getItem(this.teacherPasscodeKey) || 'TK6341106';
  }

  verifyTeacherPasscode(input) {
    const target = this.getTeacherPasscode();
    return String(input).trim() === target;
  }

  async saveTeacherPasscode(newCode) {
    const clean = String(newCode || '').trim() || 'TK6341106';
    localStorage.setItem(this.teacherPasscodeKey, clean);
    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('config').doc('school_config').set({
          teacherPasscode: clean,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`☁️ 本校教師註冊通關密碼已同步至雲端: [${clean}]`);
      } catch (err) {
        console.error('儲存教師通關密碼至雲端失敗:', err);
      }
    }
    return clean;
  }

  verifyAdminPassword(input) {
    const target = this.getAdminPassword();
    return String(input).trim() === target;
  }

  setAdminPassword(newPassword) {
    const cleanPass = String(newPassword).trim();
    if (!cleanPass) return false;
    localStorage.setItem(this.adminPasswordKey, cleanPass);

    // 雲端同步
    if (this.isFirebaseReady && this.db) {
      this.db.collection('config').doc('school_config').set({
        adminPassword: cleanPass,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(err => console.warn('雲端管理密碼同步失敗:', err));
    }
    return true;
  }

  // ==========================================
  // 學生本機身分讀取與儲存
  // ==========================================
  loadProfile() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        p.hasRegistered = true;
        return p;
      } catch (e) {
        console.error('讀取個人檔案失敗');
      }
    }
    return {
      className: '5年3班',
      seatNumber: '',
      nickname: '',
      password: '',
      hasRegistered: false
    };
  }

  saveProfile(className, seatNumber, nickname, password) {
    this.profile = { 
      className: String(className).trim() || '5年3班', 
      seatNumber: String(seatNumber).trim(), 
      nickname: String(nickname || '').trim(), 
      password: password !== undefined ? String(password).trim() : (this.profile ? (this.profile.password || '') : ''),
      hasRegistered: true 
    };
    localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
    this.updateProfileBadgeUI();
  }

  logoutStudent() {
    this.profile = {
      className: '',
      seatNumber: '',
      nickname: '',
      password: '',
      hasRegistered: false
    };
    localStorage.removeItem(this.storageKey);
    this.updateProfileBadgeUI();
  }

  updateProfileBadgeUI() {
    const titleEl = document.getElementById('user-title-display');
    const badgeEl = document.getElementById('user-profile-badge');
    const tagEl = document.getElementById('user-student-tag');
    const nameEl = document.getElementById('user-name-display');

    if (!this.profile || !this.profile.hasRegistered) {
      if (tagEl) tagEl.innerText = '未登入';
      if (nameEl) nameEl.innerText = '';
      if (titleEl && !window.shopManager) titleEl.innerText = '鍵盤學徒';
      if (badgeEl) badgeEl.title = '尚未登入學生帳號，點擊可立即登入';
      return;
    }

    if (tagEl) {
      tagEl.innerText = `${this.profile.className} ${this.profile.seatNumber}號`;
    }
    if (nameEl) {
      const displayName = this.profile.nickname || (this.profile.realName ? `${this.profile.realName}` : '');
      nameEl.innerText = displayName;
    }
    if (titleEl && !window.shopManager) {
      titleEl.innerText = this.profile.nickname || (this.profile.realName ? `${this.profile.realName}` : '鍵盤學徒');
    }
    if (badgeEl) {
      const namePart = this.profile.realName ? ` (${this.profile.realName})` : '';
      const nickPart = this.profile.nickname ? ` · 暱稱: ${this.profile.nickname}` : '';
      const noPart = this.profile.studentNo ? ` · 學號: ${this.profile.studentNo}` : '';
      badgeEl.title = `目前學生：${this.profile.className} ${this.profile.seatNumber}號${namePart}${nickPart}${noPart} (點擊可修改暱稱、密碼或登出)`;
    }
  }

  // ==========================================
  // 班級名單維護
  // ==========================================
  // 班級名單維護與智慧排序（置頂體驗測試組）
  // ==========================================
  loadClassList() {
    const raw = localStorage.getItem(this.classListKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.getSortedClassList(parsed);
        }
      } catch (e) {
        console.error('讀取班級清單失敗', e);
      }
    }
    return this.getSortedClassList([...DEFAULT_CLASS_LIST]);
  }

  /**
   * 智慧班級排序演算法：
   * 1. 「🧪 體驗測試組 (自由測試)」或包含「測試/體驗」的項目永遠置於最頂端 (Index 0)
   * 2. 「教師示範組」置於測試組之後
   * 3. 正常年級班級 (一年級～六年級甲乙班)
   * 4. 其他自訂組別
   */
  getSortedClassList(classes) {
    const list = Array.isArray(classes) && classes.length > 0 ? [...classes] : [...DEFAULT_CLASS_LIST];
    const testKeywords = ['測試', '體驗', '自由測試', '來賓體驗'];

    // 若清單內完全沒有測試項目，自動補入體驗測試組
    const hasTest = list.some(c => testKeywords.some(k => String(c).includes(k)));
    if (!hasTest) {
      list.unshift('🧪 體驗測試組 (自由測試)');
    }

    const testItems = [];
    const demoItems = [];
    const gradeItems = [];
    const otherItems = [];

    list.forEach(item => {
      const str = String(item || '').trim();
      if (!str) return;
      if (testKeywords.some(k => str.includes(k))) {
        // 優先將標準「🧪 體驗測試組 (自由測試)」排在測試項第一位
        if (str.includes('自由測試') || str.startsWith('🧪')) {
          testItems.unshift(str);
        } else {
          testItems.push(str);
        }
      } else if (str.includes('示範')) {
        demoItems.push(str);
      } else if (/[一二三四五六123456]年/.test(str)) {
        gradeItems.push(str);
      } else {
        otherItems.push(str);
      }
    });

    // 依序組合並去重複，確保測試組永遠在最上方第 1 個
    const combined = [...testItems, ...gradeItems, ...demoItems, ...otherItems];
    return Array.from(new Set(combined));
  }

  saveClassList(classes) {
    if (!Array.isArray(classes)) return this.classList;
    const cleanList = Array.from(new Set(classes.map(c => String(c).trim()).filter(Boolean)));
    this.classList = cleanList.length > 0 ? this.getSortedClassList(cleanList) : this.getSortedClassList([...DEFAULT_CLASS_LIST]);
    localStorage.setItem(this.classListKey, JSON.stringify(this.classList));

    // 雲端同步
    if (this.isFirebaseReady && this.db) {
      this.db.collection('config').doc('school_config').set({
        classList: this.classList,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(err => console.warn('雲端班級名冊同步失敗:', err));
    }

    this.populateClassSelects();
    return this.classList;
  }

  addClass(className) {
    const name = String(className).trim();
    if (!name) return false;
    if (!this.classList.includes(name)) {
      this.classList.push(name);
      this.saveClassList(this.classList);
      return true;
    }
    return false;
  }

  removeClass(className) {
    this.classList = this.classList.filter(c => c !== className);
    this.saveClassList(this.classList);
  }

  resetClassList() {
    this.classList = this.getSortedClassList([...DEFAULT_CLASS_LIST]);
    this.saveClassList(this.classList);
    return this.classList;
  }

  // ==========================================
  // 班級專屬通關密碼防護機制 (預設不開啟，防冒用與亂入)
  // ==========================================
  loadClassPasscodes() {
    const raw = localStorage.getItem(this.classPasscodesKey);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') return obj;
      } catch (e) {
        console.warn('讀取班級通關密碼快取失敗:', e);
      }
    }
    return {};
  }

  getClassPasscodes() {
    if (!this.classPasscodes || typeof this.classPasscodes !== 'object') {
      this.classPasscodes = this.loadClassPasscodes();
    }
    return this.classPasscodes;
  }

  getClassPasscodeInfo(className) {
    if (!className) return { enabled: false, passcode: '' };
    const cleanName = String(className).trim();
    // 自由測試組永遠免通關密碼，方便隨時體驗
    if (cleanName.includes('測試') || cleanName.includes('體驗')) {
      return { enabled: false, passcode: '' };
    }
    const all = this.getClassPasscodes();
    const info = all[cleanName];
    if (info && typeof info === 'object') {
      return {
        enabled: Boolean(info.enabled),
        passcode: String(info.passcode || '').trim()
      };
    }
    return { enabled: false, passcode: '' };
  }

  isClassPasscodeRequired(className) {
    const info = this.getClassPasscodeInfo(className);
    return info.enabled === true && info.passcode.length > 0;
  }

  verifyClassPasscode(className, inputPasscode) {
    const info = this.getClassPasscodeInfo(className);
    if (!info.enabled || !info.passcode) return true; // 未開啟防護則直接通過
    const cleanInput = String(inputPasscode || '').trim();
    return cleanInput === info.passcode;
  }

  async saveClassPasscode(className, enabled, passcode) {
    const cleanName = String(className).trim();
    if (!cleanName) return false;
    const cleanPass = String(passcode || '').trim();
    const isEnabled = Boolean(enabled) && cleanPass.length > 0;

    const all = this.getClassPasscodes();
    all[cleanName] = {
      enabled: isEnabled,
      passcode: isEnabled ? cleanPass : (all[cleanName] ? (all[cleanName].passcode || '') : ''),
      updatedAt: new Date().toISOString()
    };
    this.classPasscodes = all;
    localStorage.setItem(this.classPasscodesKey, JSON.stringify(all));

    // 雲端同步到 Firestore config/school_config
    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('config').doc('school_config').set({
          classPasscodes: {
            [cleanName]: {
              enabled: isEnabled,
              passcode: isEnabled ? cleanPass : '',
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
          },
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`☁️ 班級【${cleanName}】通關密碼防護已同步至雲端 (開啟: ${isEnabled})`);
      } catch (err) {
        console.error('儲存班級通關密碼至雲端失敗:', err);
      }
    }
    return true;
  }

  populateClassSelects(preferredClass) {
    const sortedList = this.getSortedClassList(this.classList);
    this.classList = sortedList;

    const selects = [
      document.getElementById('login-class-select'),
      document.getElementById('input-class-name'),
      document.getElementById('admin-student-class-filter'),
      document.getElementById('admin-student-class-select')
    ].filter(Boolean);

    const targetClass = preferredClass || this.profile.className || (sortedList[0] || '🧪 體驗測試組 (自由測試)');

    selects.forEach(sel => {
      const isLoginClass = sel.id === 'login-class-select';
      const currentVal = isLoginClass ? (sel.value || '') : (sel.value || targetClass);
      sel.innerHTML = '';

      if (isLoginClass) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.innerText = '=選擇班級=';
        defaultOpt.disabled = true;
        if (!currentVal) defaultOpt.selected = true;
        sel.appendChild(defaultOpt);
      }

      sortedList.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.innerText = cls;
        if (!isLoginClass && cls === targetClass) opt.selected = true;
        else if (isLoginClass && cls === currentVal && currentVal !== '') opt.selected = true;
        sel.appendChild(opt);
      });

      if (isLoginClass) {
        if (!currentVal || !sortedList.includes(currentVal)) {
          sel.value = '';
        }
      } else {
        if (!sortedList.includes(currentVal) && sortedList.length > 0) {
          sel.value = sortedList[0];
        }
      }
    });

    // 填入「班級排行榜」前臺下拉選單
    const classLeaderboardSelect = document.getElementById('class-leaderboard-select');
    if (classLeaderboardSelect) {
      classLeaderboardSelect.innerHTML = '';
      const promptOpt = document.createElement('option');
      promptOpt.value = '';
      promptOpt.innerText = '🏆 班級排行...';
      classLeaderboardSelect.appendChild(promptOpt);

      sortedList.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.innerText = cls;
        classLeaderboardSelect.appendChild(opt);
      });
      classLeaderboardSelect.value = '';
    }

    // 填入「課堂自訂特訓」前臺與後臺目標班級下拉選單 (含全校共用選項)
    const customSelects = [
      document.getElementById('custom-lesson-class-select'),
      document.getElementById('admin-custom-target-class')
    ].filter(Boolean);

    customSelects.forEach(sel => {
      const currentVal = sel.value || (sel.id === 'custom-lesson-class-select' ? targetClass : 'all');
      sel.innerHTML = '';

      // 全校共用選項
      const allOpt = document.createElement('option');
      allOpt.value = 'all';
      allOpt.innerText = sel.id === 'admin-custom-target-class' ? '🌐 全校所有班級 (共用特訓)' : '🌐 全校共用特訓';
      sel.appendChild(allOpt);

      sortedList.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.innerText = cls;
        sel.appendChild(opt);
      });

      if (currentVal && (currentVal === 'all' || sortedList.includes(currentVal))) {
        sel.value = currentVal;
      } else {
        sel.value = sel.id === 'custom-lesson-class-select' ? targetClass : 'all';
      }
    });
  }

  // ==========================================
  // Firebase 核心初始化與連線狀態指示
  // ==========================================
  initFirebase() {
    // 優先順序：1. LocalStorage 自訂設定 ➜ 2. 全校預設 DEFAULT_FIREBASE_CONFIG
    let config = null;
    const customConfigStr = localStorage.getItem(this.firebaseConfigKey);
    if (customConfigStr) {
      try {
        config = JSON.parse(customConfigStr);
      } catch (e) {
        console.warn('自訂 Firebase 設定解析失敗，改用預設配置');
      }
    }

    if (!config || !config.apiKey) {
      config = DEFAULT_FIREBASE_CONFIG;
    }

    this.config = config;

    // 檢查瀏覽器是否已正確載入 Firebase Compat SDK
    if (window.firebase && config && config.apiKey && config.projectId) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(config);
        }
        this.db = firebase.firestore();
        if (firebase.auth) {
          this.auth = firebase.auth();
        }
        this.isFirebaseReady = true;

        console.log(`✅ Firebase 雲端資料庫初始化成功！專案 ID: [${config.projectId}]`);
        this.updateStatusBadge('connected', '雲端已連線');

        // 初始化成功後自動自雲端拉取最新班級名冊與管理密碼
        setTimeout(() => {
          this.fetchCloudClassList();
        }, 100);

      } catch (err) {
        console.warn('⚠️ Firebase 初始化發生異常，切換至本機快取安全模式:', err);
        this.isFirebaseReady = false;
        this.updateStatusBadge('error', '雲端初始化異常');
      }
    } else {
      console.log('ℹ️ 未偵測到 Firebase SDK 或憑證，目前運行於本機快取模式。');
      this.isFirebaseReady = false;
      this.updateStatusBadge('offline', '本機離線模式');
    }
  }

  /**
   * 更新導覽列與後臺的連線指示燈 UI
   */
  updateStatusBadge(status, text) {
    const pill = document.getElementById('cloud-status-pill');
    const pillText = document.getElementById('cloud-status-text');
    const pillIcon = document.getElementById('cloud-status-icon');

    if (pill && pillText) {
      pill.className = `stat-pill pill-cloud ${status}`;
      // 清除傳入文字中重複的 emoji 圖示 (保持 icon 與文字單純，避免出現 ☁️☁️)
      const cleanText = String(text || '').replace(/[☁️⚠️💾]/g, '').trim();
      pillText.innerText = cleanText;
      if (pillIcon) {
        pillIcon.innerText = status === 'connected' ? '☁️' : status === 'error' ? '⚠️' : '💾';
      }
      pill.title = `Firebase 資料庫狀態：${cleanText} (專案：${this.config ? this.config.projectId : '未設定'})`;
    }

    const adminStatusBox = document.getElementById('admin-firebase-status-box');
    if (adminStatusBox) {
      if (status === 'connected') {
        adminStatusBox.innerHTML = `
          <div style="color:#10b981; font-weight:bold; display:flex; align-items:center; gap:0.35rem;">
            <span>🟢 雲端資料庫連線正常</span>
          </div>
          <div style="margin-top:0.25rem; color:var(--text-muted); font-size:0.75rem;">
            專案名稱：<code style="color:var(--brand-primary);">${this.config.projectId}</code> · 即時排行榜與全校漫遊已就緒！
          </div>
        `;
      } else if (status === 'error') {
        adminStatusBox.innerHTML = `
          <div style="color:#ef4444; font-weight:bold; display:flex; align-items:center; gap:0.35rem;">
            <span>🔴 雲端連線失敗或權限未開啟</span>
          </div>
          <div style="margin-top:0.25rem; color:#f87171; font-size:0.75rem;">
            請確認 Firestore 安全性規則已設定為 <code>allow read, write: if true;</code> 並已點擊「發布」！
          </div>
        `;
      } else {
        adminStatusBox.innerHTML = `
          <div style="color:var(--text-muted);">
            ⚪ 目前處於本機模擬模式
          </div>
        `;
      }
    }
  }

  /**
   * 診斷測試：對 Firestore 進行即時 Ping 讀寫測試
   */
  async testConnection() {
    if (!window.firebase) {
      return { success: false, reason: 'Firebase SDK 尚未成功載入，請確認電腦網路是否能訪問 gstatic.com' };
    }
    if (!this.config || !this.config.apiKey) {
      return { success: false, reason: '未配置有效的 Firebase 憑證' };
    }
    if (!this.isFirebaseReady || !this.db) {
      return { success: false, reason: 'Firebase 模組尚未準備就緒' };
    }

    try {
      const startTime = Date.now();
      // 測試讀取學校設定文檔
      const doc = await this.db.collection('config').doc('school_config').get();
      const ping = Date.now() - startTime;
      
      this.updateStatusBadge('connected', '雲端已連線');
      return {
        success: true,
        ping: ping,
        projectId: this.config.projectId,
        docExists: doc.exists,
        message: `連線成功！Firestore 伺服器響應延遲：${ping} 毫秒 (專案：${this.config.projectId})`
      };
    } catch (err) {
      console.error('Firebase 連線診斷失敗:', err);
      let hint = err.message || '未知錯誤';
      if (err.code === 'permission-denied') {
        hint = '【權限不足 permission-denied】Firestore 的安全規則阻擋了連線！請至 Firebase Console -> Firestore Database ->「規則」標籤，將規則設為 allow read, write: if true; 並點擊「發布」。';
      } else if (err.code === 'unavailable') {
        hint = '【伺服器連線中斷 unavailable】無法連線到 Firestore 伺服器，請檢查電腦網路連線或校園網路防火牆。';
      }
      this.updateStatusBadge('error', '⚠️ 雲端權限/連線異常');
      return {
        success: false,
        code: err.code,
        reason: hint
      };
    }
  }

  // ==========================================
  // 全校班級名單與設定雲端雙向同步
  // ==========================================
  async fetchCloudClassList() {
    if (!this.isFirebaseReady || !this.db) return;
    try {
      const doc = await this.db.collection('config').doc('school_config').get();
      if (doc.exists) {
        const data = doc.data();
        if (Array.isArray(data.classList) && data.classList.length > 0) {
          this.classList = data.classList;
          localStorage.setItem(this.classListKey, JSON.stringify(this.classList));
          this.populateClassSelects();
          console.log(`☁️ 成功自雲端同步學校班級名單（共 ${data.classList.length} 個班級）！`);
        }
        if (data.adminPassword) {
          localStorage.setItem(this.adminPasswordKey, data.adminPassword);
        }
        if (data.teacherPasscode) {
          localStorage.setItem(this.teacherPasscodeKey, data.teacherPasscode);
        }
        if (data.classPasscodes && typeof data.classPasscodes === 'object') {
          this.classPasscodes = Object.assign({}, this.loadClassPasscodes(), data.classPasscodes);
          localStorage.setItem(this.classPasscodesKey, JSON.stringify(this.classPasscodes));
        }
      } else {
        // 雲端首次執行，自動寫入預設班級清單與預設密碼建立 school_config
        await this.db.collection('config').doc('school_config').set({
          classList: this.classList,
          adminPassword: this.getAdminPassword(),
          teacherPasscode: this.getTeacherPasscode(),
          schoolName: '溪洲國小',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('☁️ 雲端首次初始化：已自動建立 config/school_config 文件！');
      }
    } catch (e) {
      if (e.code === 'permission-denied') {
        console.warn('⚠️ Firestore 讀取受限，請至 Firebase 後台發布允許讀寫規則。');
      } else {
        console.warn('拉取雲端班級名冊失敗，使用本機安全備份', e);
      }
    }
  }

  // ==========================================
  // 雙向雲端漫遊核心：拉取學生雲端存檔 (換電腦時自動還原 & 密碼驗證)
  // ==========================================
  async loadProfileFromCloud(className, seatNumber, inputPassword) {
    if (!className || !seatNumber) return { success: false, reason: '缺少班級或座號' };
    const studentId = `${className}_${seatNumber}`;

    // 離線或 Firebase 尚未就緒時的安全切換
    if (!this.isFirebaseReady || !this.db) {
      this.profile.className = className;
      this.profile.seatNumber = seatNumber;
      this.profile.hasRegistered = true;
      if (inputPassword) this.profile.password = String(inputPassword).trim();
      localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
      this.updateProfileBadgeUI();
      if (window.shopManager) {
        window.shopManager.switchToStudent(studentId, null);
      }
      return { success: true, localOnly: true };
    }

    try {
      console.log(`🔍 正在為 [${studentId}] 查詢雲端進度...`);
      const docSnap = await this.db.collection('students').doc(studentId).get();

      if (docSnap.exists) {
        const cloudData = docSnap.data();

        // 專屬通行密碼驗證 (防止他人冒用學號)
        if (cloudData.password) {
          const cleanInput = String(inputPassword || '').trim();
          const cleanCloud = String(cloudData.password).trim();
          if (cleanInput && cleanCloud && cleanInput !== cleanCloud) {
            console.warn(`❌ 學生 [${studentId}] 密碼驗證不符`);
            return {
              success: false,
              error: 'PASSWORD_MISMATCH',
              message: '❌ 密碼錯誤！該座號已有專屬密碼。\n若忘記密碼，請洽任課老師至「教師後臺」查看或重設！'
            };
          }
        }

        // 1. 還原基本身份檔案
        if (cloudData.nickname) {
          this.profile.nickname = cloudData.nickname;
        }
        if (cloudData.realName) {
          this.profile.realName = cloudData.realName;
        }
        if (cloudData.studentNo) {
          this.profile.studentNo = cloudData.studentNo;
        }
        if (cloudData.academicYear) {
          this.profile.academicYear = cloudData.academicYear;
        }
        this.profile.className = className;
        this.profile.seatNumber = seatNumber;
        this.profile.password = inputPassword || cloudData.password || '';
        this.profile.hasRegistered = true;
        localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
        this.updateProfileBadgeUI();

        // 若雲端原本未設定密碼（舊紀錄），學生此回有設定，自動補存保護
        if (!cloudData.password && inputPassword) {
          await this.db.collection('students').doc(studentId).set({
            password: String(inputPassword).trim()
          }, { merge: true });
        }

        // 2. 還原 ShopManager 經濟、成就與裝備進度（切換至該座號，徹底防止前一帳號資料污染）
        if (window.shopManager) {
          window.shopManager.switchToStudent(studentId, cloudData);
        }

        // 3. 顯示漫遊成功視覺提示
        const displayName = this.profile.nickname || this.profile.realName || `${className} ${seatNumber}號`;
        this.showToast(`☁️ 歡迎回來！已自雲端漫遊還原【${displayName}】的專屬進度（Lv.${cloudData.level || 1} · ${cloudData.coins || 0} 星幣）`, 'success');
        return { success: true, data: cloudData };
      } else {
        console.log(`ℹ️ 雲端尚無 [${studentId}] 的歷史進度，初始化全新乾淨新帳號模式...`);
        // 新座號首次使用：註冊基本身份
        this.profile.className = className;
        this.profile.seatNumber = seatNumber;
        this.profile.hasRegistered = true;
        if (inputPassword) {
          this.profile.password = String(inputPassword).trim();
        }
        localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
        this.updateProfileBadgeUI();

        // 關鍵修復：重設為全新乾淨的新帳號模式（Lv.1、0經驗、100金幣新手禮、零關卡星數、零成就、預設外觀）
        if (window.shopManager) {
          window.shopManager.resetToDefault(studentId);
        }

        // 將乾淨的新帳號存檔同步建立於雲端
        await this.syncProfileToCloud();

        const displayName = this.profile.nickname || this.profile.realName || `${className} ${seatNumber}號`;
        this.showToast(`🎉 歡迎【${displayName}】加入打字冒險學院！已為您開通全新專屬帳號！`, 'success');
        return { success: true, isNew: true };
      }
    } catch (e) {
      console.warn('拉取雲端學生個人存檔失敗:', e);
      return { success: true, error: e };
    }
  }

  // ==========================================
  // 雙向雲端漫遊核心：同步個人檔案與遊戲進度至雲端
  // ==========================================
  async syncProfileToCloud() {
    if (!this.isFirebaseReady || !this.db) return false;
    if (!this.profile || !this.profile.className || !this.profile.seatNumber) return false;

    try {
      const studentId = `${this.profile.className}_${this.profile.seatNumber}`;
      const playerData = window.shopManager ? window.shopManager.data : {};

      const payload = {
        className: this.profile.className,
        seatNumber: this.profile.seatNumber,
        nickname: this.profile.nickname || '',
        realName: this.profile.realName || '',
        studentNo: this.profile.studentNo || '',
        academicYear: this.profile.academicYear || '115',
        password: this.profile.password || '',
        level: Number(playerData.level) || 1,
        exp: Number(playerData.exp) || 0,
        coins: Number(playerData.coins) >= 0 ? Number(playerData.coins) : 0,
        equippedSkin: playerData.equippedSkin || 'default',
        equippedSound: playerData.equippedSound || 'mechanical',
        equippedAvatar: playerData.equippedAvatar || 'cat',
        unlockedSkins: playerData.unlockedSkins || ['default'],
        unlockedSounds: playerData.unlockedSounds || ['mechanical'],
        unlockedAvatars: playerData.unlockedAvatars || ['cat'],
        lessonStars: playerData.lessonStars || {},
        unlockedAchievements: playerData.unlockedAchievements || [],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('students').doc(studentId).set(payload, { merge: true });
      console.log(`☁️ 學生 [${studentId}] 雲端個人存檔已同步完成（含等級、經驗、星幣、裝備、成就）！`);
      return true;
    } catch (e) {
      console.error('雲端存檔同步失敗:', e);
      return false;
    }
  }

  // ==========================================
  // 教師後臺管理：拉取班級學生清單與密碼重設
  // ==========================================
  async fetchClassStudents(className) {
    if (!this.isFirebaseReady || !this.db) return [];
    try {
      const snapshot = await this.db.collection('students')
        .where('className', '==', className)
        .get();

      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });

      // 依座號排序
      list.sort((a, b) => {
        const numA = parseInt(a.seatNumber, 10);
        const numB = parseInt(b.seatNumber, 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
        return String(a.seatNumber || '').localeCompare(String(b.seatNumber || ''));
      });
      return list;
    } catch (e) {
      console.error('拉取班級學生名冊失敗:', e);
      return [];
    }
  }
  /**
   * 獲取指定班級所有同學之即時排行榜資料 (結合名冊學生資料與最新打字測驗成績)
   */
  async fetchClassRankings(className) {
    if (!className) return [];
    try {
      const students = await this.fetchClassStudents(className);
      let leaderboardRecords = [];

      if (this.isFirebaseReady && this.db) {
        try {
          const snap = await this.db.collection('leaderboard')
            .where('className', '==', className)
            .get();
          snap.forEach(doc => leaderboardRecords.push(doc.data()));
        } catch (err) {
          console.warn('拉取班級排行榜紀錄失敗:', err);
        }
      }

      // 本機備援排行榜紀錄
      try {
        const local = JSON.parse(localStorage.getItem('typehero_local_leaderboard') || '[]');
        local.filter(item => item.className === className).forEach(item => leaderboardRecords.push(item));
      } catch (e) {}

      // 統計每位座號的最高速成績
      const bestBySeat = {};
      leaderboardRecords.forEach(rec => {
        const seat = String(rec.seatNumber || '').trim();
        if (!seat) return;
        if (!bestBySeat[seat] || (rec.wpm || 0) > (bestBySeat[seat].wpm || 0)) {
          bestBySeat[seat] = {
            wpm: rec.wpm || 0,
            accuracy: rec.accuracy || 0,
            lessonTitle: rec.lessonTitle || ''
          };
        }
      });

      // 將成績與學生名冊資料整合
      const resultList = students.map(st => {
        const seat = String(st.seatNumber || '').trim();
        const score = bestBySeat[seat] || {};
        const starsCount = (st.lessonStars && typeof st.lessonStars === 'object')
          ? Object.values(st.lessonStars).reduce((sum, v) => sum + (Number(v) || 0), 0)
          : 0;

        return {
          className: st.className || className,
          seatNumber: seat,
          realName: st.realName || '',
          nickname: st.nickname || '',
          displayName: st.nickname ? `${st.nickname} (${st.realName || seat + '號'})` : (st.realName || `${seat}號`),
          wpm: score.wpm || 0,
          accuracy: score.accuracy || (score.wpm ? 100 : 0),
          lessonTitle: score.lessonTitle || '',
          level: st.level || 1,
          coins: Number(st.coins) || 0,
          stars: starsCount,
          hasScore: typeof score.wpm === 'number' && score.wpm > 0
        };
      });

      // 若名冊尚無資料但排行榜已有紀錄
      if (resultList.length === 0 && leaderboardRecords.length > 0) {
        Object.keys(bestBySeat).forEach(seat => {
          const score = bestBySeat[seat];
          resultList.push({
            className,
            seatNumber: seat,
            realName: '',
            nickname: '',
            displayName: `${seat}號`,
            wpm: score.wpm || 0,
            accuracy: score.accuracy || 0,
            lessonTitle: score.lessonTitle || '',
            level: 1,
            coins: 0,
            stars: 0,
            hasScore: true
          });
        });
      }

      // 排序規則：有成績者優先依 WPM 降序（WPM 同者比準確率），未測驗者依座號升序排列
      resultList.sort((a, b) => {
        if (a.hasScore && !b.hasScore) return -1;
        if (!a.hasScore && b.hasScore) return 1;
        if (a.hasScore && b.hasScore) {
          if (b.wpm !== a.wpm) return b.wpm - a.wpm;
          return (b.accuracy || 0) - (a.accuracy || 0);
        }
        const numA = parseInt(a.seatNumber, 10);
        const numB = parseInt(b.seatNumber, 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
        return String(a.seatNumber || '').localeCompare(String(b.seatNumber || ''));
      });

      return resultList;
    } catch (e) {
      console.error('產生班級排行榜失敗:', e);
      return [];
    }
  }


  async adminUpdateStudentPassword(className, seatNumber, newPassword) {
    if (!this.isFirebaseReady || !this.db) return false;
    const cleanPass = String(newPassword).trim();
    if (!cleanPass) return false;
    const studentId = `${className}_${seatNumber}`;
    try {
      await this.db.collection('students').doc(studentId).set({
        password: cleanPass,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`✅ 教師後臺已將學生 [${studentId}] 密碼修改為：${cleanPass}`);
      return true;
    } catch (e) {
      console.error('教師後臺修改學生密碼失敗:', e);
      return false;
    }
  }

  /**
   * 解除學生身分綁定 (解除他人冒用該座號之密碼與暱稱，保留真實姓名與學號)
   */
  async adminUnbindStudent(className, seatNumber, realName = '', studentNo = '') {
    if (!this.isFirebaseReady || !this.db) return false;
    const cleanSeat = String(seatNumber).trim();
    const studentId = `${className}_${cleanSeat}`;
    try {
      let keepRealName = realName;
      let keepStudentNo = studentNo;
      let academicYear = '115';

      try {
        const docSnap = await this.db.collection('students').doc(studentId).get();
        if (docSnap.exists) {
          const d = docSnap.data();
          if (!keepRealName && d.realName) keepRealName = d.realName;
          if (!keepStudentNo && d.studentNo) keepStudentNo = d.studentNo;
          if (d.academicYear) academicYear = d.academicYear;
        }
      } catch (err) {
        console.warn('讀取既有學生資料以便保留學籍:', err);
      }

      await this.db.collection('students').doc(studentId).set({
        className: className,
        seatNumber: cleanSeat,
        password: '',
        nickname: '',
        realName: keepRealName || '',
        studentNo: keepStudentNo || '',
        academicYear: academicYear,
        level: 1,
        coins: 0,
        xp: 0,
        items: [],
        unlockedLessons: [],
        achievements: [],
        status: 'active',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 同步清除本地該學生快取，確保星幣徹底歸零
      localStorage.removeItem('typehero_player_data_' + studentId);
      if (window.shopManager && window.shopManager.currentStudentId === studentId) {
        window.shopManager.resetToDefault(studentId);
      }
      console.log(`✅ 已解除 [${studentId}] 冒用綁定並將星幣重設為0，保留真實學籍`);
      return true;
    } catch (e) {
      console.error('解除學生綁定失敗:', e);
      return false;
    }
  }

  /**
   * 徹底刪除指定座號之學生雲端存檔
   */
  async adminDeleteStudent(className, seatNumber) {
    if (!this.isFirebaseReady || !this.db) return false;
    const cleanSeat = String(seatNumber).trim();
    const studentId = `${className}_${cleanSeat}`;
    try {
      await this.db.collection('students').doc(studentId).delete();
      console.log(`✅ 已從 Firestore 刪除學生檔案 [${studentId}]`);
      return true;
    } catch (e) {
      console.error('刪除學生失敗:', e);
      return false;
    }
  }

  // ==========================================
  // 全校名冊身分綁定與學年度升級移轉引擎
  // ==========================================

  /**
   * 批次取得全校所有學生雲端文檔
   */
  async fetchAllStudents() {
    if (!this.isFirebaseReady || !this.db) return [];
    try {
      const snapshot = await this.db.collection('students').get();
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (e) {
      console.error('拉取全校學生紀錄失敗:', e);
      return [];
    }
  }

  /**
   * 批次將 CSV 名冊資料與目前 Firestore 學生紀錄進行身分綁定
   * @param {Array} rosterList - [{ className, seatNumber, realName, studentNo, academicYear }]
   * @param {Function} onProgress - 回呼函式 ({ current, total, log, percent })
   */
  async bindStudentRoster(rosterList, onProgress = () => {}) {
    if (!this.isFirebaseReady || !this.db) {
      return { success: false, reason: 'Firebase 尚未連線就緒，請檢查雲端連線狀態！' };
    }
    if (!Array.isArray(rosterList) || rosterList.length === 0) {
      return { success: false, reason: '傳入名冊為空，無法執行綁定。' };
    }

    try {
      const total = rosterList.length;
      let matchedCount = 0;
      const classSet = new Set();

      onProgress({ current: 0, total, percent: 0, log: `🚀 開始執行名冊身分綁定作業，共 ${total} 筆學生資料...` });

      // 分批處理 (每次最多 400 筆，避免超過 Firestore 單次批次上限 500)
      const chunkSize = 400;
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = rosterList.slice(i, i + chunkSize);
        const batch = this.db.batch();

        for (let j = 0; j < chunk.length; j++) {
          const item = chunk[j];
          const currentIndex = i + j + 1;
          const cleanClass = String(item.className || '').trim();
          const cleanSeat = String(item.seatNumber || '').trim();
          const cleanName = String(item.realName || '').trim();
          const cleanNo = String(item.studentNo || '').trim();
          const cleanYear = String(item.academicYear || '115').trim();

          if (!cleanClass || !cleanSeat) continue;
          classSet.add(cleanClass);

          const studentId = `${cleanClass}_${cleanSeat}`;
          const docRef = this.db.collection('students').doc(studentId);

          // 寫入身分綁定 payload (以 merge: true 方式，不覆蓋學生原本之星幣、密碼與裝備)
          const bindPayload = {
            className: cleanClass,
            seatNumber: cleanSeat,
            realName: cleanName,
            studentNo: cleanNo,
            academicYear: cleanYear,
            status: 'active',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          };

          batch.set(docRef, bindPayload, { merge: true });
          matchedCount++;

          const percent = Math.round((currentIndex / total) * 100);
          if (currentIndex % 15 === 0 || currentIndex === total) {
            onProgress({
              current: currentIndex,
              total,
              percent,
              log: `[${currentIndex}/${total}] 處理：${cleanClass} ${cleanSeat}號 ${cleanName} (學號: ${cleanNo || '無'})`
            });
          }
        }

        await batch.commit();
      }

      // 同步更新學校班級清單 (若有新班級)
      if (classSet.size > 0) {
        const sortedClasses = Array.from(classSet);
        ['教師示範組', '來賓體驗組'].forEach(extra => {
          if (!sortedClasses.includes(extra)) sortedClasses.push(extra);
        });

        this.classList = sortedClasses;
        localStorage.setItem(this.classListKey, JSON.stringify(this.classList));
        this.populateClassSelects();

        // 寫入雲端學校設定
        await this.db.collection('config').doc('school_config').set({
          classList: this.classList,
          currentAcademicYear: rosterList[0].academicYear || '115',
          lastRosterSyncAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        onProgress({
          current: total,
          total,
          percent: 100,
          log: `✅ 班級清單已成功同步至全校雲端設定（共 ${sortedClasses.length} 個班級）！`
        });
      }

      onProgress({
        current: total,
        total,
        percent: 100,
        log: `🎉 綁定完成！成功為全校 ${matchedCount} 位學生完成學號、姓名與 115 學年度身分綁定！`
      });

      return {
        success: true,
        total,
        matchedCount,
        classesCount: classSet.size
      };
    } catch (err) {
      console.error('名冊身分綁定失敗:', err);
      onProgress({ current: 0, total: rosterList.length, percent: 0, log: `❌ 發生錯誤: ${err.message}` });
      return { success: false, reason: err.message };
    }
  }

  /**
   * 智慧比對並預覽新學年度升級移轉報告 (Dry-Run 模擬)
   */
  async previewSchoolYearMigration(newRosterList, targetYear) {
    if (!this.isFirebaseReady || !this.db) {
      return { success: false, reason: 'Firebase 尚未連線就緒！' };
    }
    if (!Array.isArray(newRosterList) || newRosterList.length === 0) {
      return { success: false, reason: '請先上傳有效的新學年度名冊 CSV！' };
    }

    try {
      const existingStudents = await this.fetchAllStudents();

      // 建立現有資料庫快速索引 (優先以 studentNo 學號索引，其次以 realName 姓名索引)
      const studentNoMap = new Map();
      const realNameMap = new Map();

      existingStudents.forEach(st => {
        if (st.studentNo) {
          studentNoMap.set(String(st.studentNo).trim(), st);
        }
        if (st.realName) {
          realNameMap.set(String(st.realName).trim(), st);
        }
      });

      const plan = [];
      const matchedOldIds = new Set();

      newRosterList.forEach(item => {
        const cleanNo = String(item.studentNo || '').trim();
        const cleanName = String(item.realName || '').trim();
        const newClass = String(item.className || '').trim();
        const newSeat = String(item.seatNumber || '').trim();

        let matched = null;
        let matchBy = '';

        if (cleanNo && studentNoMap.has(cleanNo)) {
          matched = studentNoMap.get(cleanNo);
          matchBy = '學號比對';
        } else if (cleanName && realNameMap.has(cleanName)) {
          matched = realNameMap.get(cleanName);
          matchBy = '姓名比對';
        }

        if (matched) {
          matchedOldIds.add(matched.id);
          const starsCount = matched.lessonStars ? Object.keys(matched.lessonStars).length : 0;
          plan.push({
            type: 'upgrade',
            statusText: `🔄 升級對齊 (${matchBy})`,
            studentNo: cleanNo || matched.studentNo || '',
            realName: cleanName || matched.realName || '未知名',
            oldClass: matched.className || '未知舊班',
            oldSeat: matched.seatNumber || '0',
            newClass: newClass,
            newSeat: newSeat,
            oldDocId: matched.id,
            newDocId: `${newClass}_${newSeat}`,
            retainedSummary: `Lv.${matched.level || 1} · 🪙 ${matched.coins || 0} · ⭐ ${starsCount}關 · 密碼: ${matched.password ? '已保留' : '無'}`,
            originalData: matched
          });
        } else {
          plan.push({
            type: 'new_student',
            statusText: '🆕 新生或轉入生',
            studentNo: cleanNo,
            realName: cleanName,
            oldClass: '（新入學）',
            oldSeat: '-',
            newClass: newClass,
            newSeat: newSeat,
            newDocId: `${newClass}_${newSeat}`,
            retainedSummary: '建立乾淨全新學籍檔案',
            originalData: null
          });
        }
      });

      // 檢查原資料庫中未出現在新名冊中的學生 (例如畢業生)
      existingStudents.forEach(oldSt => {
        if (!matchedOldIds.has(oldSt.id) && oldSt.className && !oldSt.className.includes('示範') && !oldSt.className.includes('體驗')) {
          plan.push({
            type: 'graduated',
            statusText: '🎓 畢業封存',
            studentNo: oldSt.studentNo || '',
            realName: oldSt.realName || oldSt.nickname || '舊生',
            oldClass: oldSt.className,
            oldSeat: oldSt.seatNumber || '0',
            newClass: '（畢業歸檔）',
            newSeat: '-',
            oldDocId: oldSt.id,
            retainedSummary: `已封存紀錄 (Lv.${oldSt.level || 1} · 🪙 ${oldSt.coins || 0})`,
            originalData: oldSt
          });
        }
      });

      const upgradeCount = plan.filter(p => p.type === 'upgrade').length;
      const newCount = plan.filter(p => p.type === 'new_student').length;
      const gradCount = plan.filter(p => p.type === 'graduated').length;

      return {
        success: true,
        plan,
        counts: {
          upgrade: upgradeCount,
          newStudent: newCount,
          graduated: gradCount,
          total: plan.length
        }
      };
    } catch (e) {
      console.error('升級模擬比對失敗:', e);
      return { success: false, reason: e.message };
    }
  }

  /**
   * 正式執行全校學生學年度升級移轉 (無損遷移)
   */
  async executeSchoolYearMigration(plan, sourceYear, targetYear, onProgress = () => {}) {
    if (!this.isFirebaseReady || !this.db) {
      return { success: false, reason: 'Firebase 尚未連線！' };
    }
    if (!Array.isArray(plan) || plan.length === 0) {
      return { success: false, reason: '移轉計畫為空！' };
    }

    try {
      const total = plan.length;
      onProgress({ current: 0, total, percent: 0, log: `🚀 啟動學年度移轉程序：${sourceYear} 學年度 ➔ ${targetYear} 學年度...` });

      const chunkSize = 400;
      const classSet = new Set();

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = plan.slice(i, i + chunkSize);
        const batch = this.db.batch();

        for (let j = 0; j < chunk.length; j++) {
          const item = chunk[j];
          const currentIndex = i + j + 1;

          if (item.type === 'upgrade') {
            classSet.add(item.newClass);
            const newDocRef = this.db.collection('students').doc(item.newDocId);
            const orig = item.originalData || {};

            // 轉移並完整繼承全部成就、星幣、等級、密碼與商城解鎖
            const migratedPayload = {
              ...orig,
              className: item.newClass,
              seatNumber: item.newSeat,
              realName: item.realName,
              studentNo: item.studentNo,
              academicYear: String(targetYear),
              previousClass: item.oldClass,
              previousSeat: item.oldSeat,
              previousAcademicYear: String(sourceYear),
              status: 'active',
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            batch.set(newDocRef, migratedPayload, { merge: true });

            // 若舊座號不同，將舊學年紀錄標記為封存
            if (item.oldDocId !== item.newDocId) {
              const oldDocRef = this.db.collection('students').doc(item.oldDocId);
              batch.set(oldDocRef, {
                status: `archived_${sourceYear}`,
                transferredTo: item.newDocId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            }

          } else if (item.type === 'new_student') {
            classSet.add(item.newClass);
            const newDocRef = this.db.collection('students').doc(item.newDocId);
            batch.set(newDocRef, {
              className: item.newClass,
              seatNumber: item.newSeat,
              realName: item.realName,
              studentNo: item.studentNo,
              academicYear: String(targetYear),
              nickname: '',
              password: '',
              level: 1,
              exp: 0,
              coins: 0,
              equippedSkin: 'default',
              equippedSound: 'mechanical',
              equippedAvatar: 'cat',
              unlockedSkins: ['default'],
              unlockedSounds: ['mechanical'],
              unlockedAvatars: ['cat'],
              lessonStars: {},
              status: 'active',
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

          } else if (item.type === 'graduated') {
            if (item.oldDocId) {
              const oldDocRef = this.db.collection('students').doc(item.oldDocId);
              batch.set(oldDocRef, {
                status: `graduated_${sourceYear}`,
                graduatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            }
          }

          const percent = Math.round((currentIndex / total) * 100);
          if (currentIndex % 15 === 0 || currentIndex === total) {
            onProgress({
              current: currentIndex,
              total,
              percent,
              log: `[${currentIndex}/${total}] 執行：${item.realName} (${item.statusText})`
            });
          }
        }

        await batch.commit();
      }

      // 同步更新學校新學年度班級名冊與當前學年
      if (classSet.size > 0) {
        const sortedClasses = Array.from(classSet);
        ['教師示範組', '來賓體驗組'].forEach(extra => {
          if (!sortedClasses.includes(extra)) sortedClasses.push(extra);
        });

        this.classList = sortedClasses;
        localStorage.setItem(this.classListKey, JSON.stringify(this.classList));
        this.populateClassSelects();

        await this.db.collection('config').doc('school_config').set({
          classList: this.classList,
          currentAcademicYear: String(targetYear),
          lastMigrationAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      onProgress({
        current: total,
        total,
        percent: 100,
        log: `🎉 恭喜！${targetYear} 學年度升級移轉已全數成功執行完畢！學生現在可直接以新班級座號登入！`
      });

      return { success: true, count: total };
    } catch (e) {
      console.error('升級移轉執行失敗:', e);
      onProgress({ current: 0, total: plan.length, percent: 0, log: `❌ 移轉發生異常: ${e.message}` });
      return { success: false, reason: e.message };
    }
  }

  // ==========================================
  // 通關後上傳打字成績至全校排行榜
  // ==========================================
  async submitScore(lessonId, lessonTitle, wpm, accuracy) {
    const record = {
      className: this.profile.className,
      seatNumber: this.profile.seatNumber,
      nickname: this.profile.nickname || '鍵盤小英雄',
      lessonId: lessonId,
      lessonTitle: lessonTitle,
      wpm: Math.round(Number(wpm) || 0),
      accuracy: Math.round(Number(accuracy) || 0),
      timestamp: Date.now()
    };

    // 1. 本地排行榜備份
    let localBoard = [];
    try {
      localBoard = JSON.parse(localStorage.getItem('typehero_local_leaderboard') || '[]');
    } catch (e) {}

    localBoard.push(record);
    localBoard.sort((a, b) => b.wpm - a.wpm);
    localBoard = localBoard.slice(0, 30);
    localStorage.setItem('typehero_local_leaderboard', JSON.stringify(localBoard));

    // 2. 雲端 Firebase 排行榜上傳
    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('leaderboard').add({
          ...record,
          serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log(`🏆 成績已成功上傳至 Firebase 雲端全校排行榜！ (${record.wpm} WPM)`);
      } catch (e) {
        console.error('上傳成績至雲端失敗:', e);
      }
    }
  }

  // ==========================================
  // 獲取即時排行榜資料 (支援雲端與離線備援)
  // ==========================================
  async fetchTopScores(limitCount = 15) {
    if (this.isFirebaseReady && this.db) {
      try {
        const snapshot = await this.db.collection('leaderboard')
          .orderBy('wpm', 'desc')
          .limit(limitCount)
          .get();

        const results = [];
        snapshot.forEach(doc => results.push(doc.data()));
        if (results.length > 0) {
          console.log(`🏆 成功從雲端拉取 ${results.length} 筆最新即時排行榜！`);
          return results;
        }
      } catch (e) {
        console.warn('從雲端拉取排行榜失敗，改用本機紀錄', e);
      }
    }

    // 備援：讀取本地資料庫排行榜
    try {
      const localBoard = JSON.parse(localStorage.getItem('typehero_local_leaderboard') || '[]');
      if (localBoard.length > 0) {
        return localBoard.slice(0, limitCount);
      }
    } catch (e) {}

    // 若皆無，提供預設有趣的 NPC 挑戰紀錄
    return [
      { nickname: '閃電閃光貓', className: '5年1班', wpm: 75, accuracy: 99, lessonTitle: '注音神速王' },
      { nickname: '鍵盤魔法師', className: '6年2班', wpm: 68, accuracy: 98, lessonTitle: '全形標點大會操' },
      { nickname: '疾風柴犬', className: '5年3班', wpm: 55, accuracy: 95, lessonTitle: '食指基準雙煞' },
      { nickname: '星際旅人', className: '4年4班', wpm: 48, accuracy: 96, lessonTitle: '基準排綜合練習' },
      { nickname: '打字小達人', className: '3年1班', wpm: 38, accuracy: 92, lessonTitle: '快樂校園生字詞' }
    ];
  }

  // 輕量級提示小窗
  showToast(message, type = 'info') {
    let toast = document.getElementById('typehero-global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'typehero-global-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(56, 189, 248, 0.5);
        color: #f8fafc;
        padding: 0.75rem 1.25rem;
        border-radius: 9999px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.3);
        font-size: 0.85rem;
        font-weight: 600;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 0;
        transform: translateY(12px);
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }

    toast.innerText = message;
    if (type === 'success') {
      toast.style.borderColor = 'rgba(16, 185, 129, 0.6)';
      toast.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(16, 185, 129, 0.3)';
    }

    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
    }, 4000);
  }

  // ==========================================
  // 教師與管理員身分認證 (Google Auth / Master Admin)
  // ==========================================
  async signInWithGoogle() {
    if (!this.auth) {
      if (window.firebase && window.firebase.auth) {
        if (!firebase.apps.length && this.config) {
          firebase.initializeApp(this.config);
        }
        this.auth = window.firebase.auth();
      } else {
        throw new Error('Firebase Auth 模組尚未載入，請確認已載入 firebase-auth-compat.js');
      }
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await this.auth.signInWithPopup(provider);
    return result.user;
  }

  // 查詢該 Google UID 是否已是經審核通過的授權教師
  async getTeacherStatus(uid) {
    if (!uid) return null;
    if (this.isFirebaseReady && this.db) {
      try {
        const doc = await this.db.collection('teachers').doc(uid).get();
        if (doc.exists) {
          return doc.data();
        }
      } catch (err) {
        console.warn('查詢教師審核狀態警告:', err);
      }
    }
    return null;
  }

  // 審核通過並登記教師資料至 Firestore
  async approveTeacher(user) {
    if (!user || !user.uid) return null;
    if (this.isFirebaseReady && this.db) {
      try {
        const teacherData = {
          uid: user.uid,
          name: user.displayName || '本校老師',
          email: user.email || '',
          photoURL: user.photoURL || '',
          role: 'teacher',
          approved: true,
          schoolName: '溪洲國小',
          approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        await this.db.collection('teachers').doc(user.uid).set(teacherData, { merge: true });
        console.log(`✅ 教師 [${user.displayName || user.email}] 已正式授權！`);
        return teacherData;
      } catch (err) {
        console.error('登記教師授權失敗:', err);
      }
    }
    return null;
  }

  // 取得全校已授權教師名單
  async fetchTeachersList() {
    const list = [];
    if (this.isFirebaseReady && this.db) {
      try {
        const snap = await this.db.collection('teachers').get();
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
      } catch (err) {
        console.warn('拉取教師名冊警告:', err);
      }
    }
    return list;
  }

  // 刪除教師帳號 (離校或不再任教)
  async deleteTeacher(uid) {
    if (!uid) return false;
    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('teachers').doc(uid).delete();
        console.log(`🗑️ 已成功刪除教師授權紀錄 [${uid}]`);
        return true;
      } catch (err) {
        console.error('刪除教師紀錄失敗:', err);
        throw err;
      }
    }
    return false;
  }

  async signOut() {
    if (this.auth) {
      await this.auth.signOut();
    }
  }

  onAuthStateChanged(callback) {
    if (this.auth) {
      return this.auth.onAuthStateChanged(callback);
    }
    if (window.firebase && window.firebase.auth) {
      this.auth = window.firebase.auth();
      return this.auth.onAuthStateChanged(callback);
    }
    return () => {};
  }

  // ==========================================
  // 課堂自訂特訓：分班發布與雲端同步 (Proposal VI.1 & Req 5, 7)
  // ==========================================
  async saveCustomLessonToCloud(targetClass, title, text, summary = '', author = '教師') {
    const cleanClass = targetClass || 'all';
    const docId = `lesson_${cleanClass}`;
    const lessonData = {
      targetClass: cleanClass,
      title: title || (cleanClass === 'all' ? '全校今日特訓' : `${cleanClass}今日特訓`),
      text: text,
      summary: summary || `${cleanClass === 'all' ? '全校' : cleanClass}專屬生字詞練習`,
      author: author,
      updatedAt: Date.now()
    };

    // 1. 本地 LocalStorage 快取
    let allLessons = {};
    try {
      allLessons = JSON.parse(localStorage.getItem('typehero_custom_lessons') || '{}');
    } catch (e) {}
    allLessons[cleanClass] = lessonData;
    localStorage.setItem('typehero_custom_lessons', JSON.stringify(allLessons));
      localStorage.removeItem('typehero_custom_lesson');
    // 同時相容單一 lesson 鍵名供舊元件讀取
    localStorage.setItem('typehero_custom_lesson', JSON.stringify(lessonData));

    // 2. 雲端同步
    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('custom_lessons').doc(docId).set({
          ...lessonData,
          serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`☁️ 課堂自訂特訓 [${cleanClass}] 已成功儲存至雲端！`);
      } catch (err) {
        console.error('儲存雲端特訓失敗:', err);
      }
    }
    return lessonData;
  }

  async fetchCustomLessonFromCloud(targetClass) {
    const cleanClass = targetClass || 'all';

    // 先查本地快取
    let allLessons = {};
    try {
      allLessons = JSON.parse(localStorage.getItem('typehero_custom_lessons') || '{}');
      if (allLessons[cleanClass]) return allLessons[cleanClass];
    } catch (e) {}

    // 查詢雲端 Firestore
    if (this.isFirebaseReady && this.db) {
      try {
        const docSnap = await this.db.collection('custom_lessons').doc(`lesson_${cleanClass}`).get();
        if (docSnap.exists) {
          const data = docSnap.data();
          allLessons[cleanClass] = data;
          localStorage.setItem('typehero_custom_lessons', JSON.stringify(allLessons));
          return data;
        } else if (cleanClass !== 'all') {
          // 若本班尚未發布，自動回退查詢全校共用特訓
          const allDoc = await this.db.collection('custom_lessons').doc('lesson_all').get();
          if (allDoc.exists) {
            return allDoc.data();
          }
        }
      } catch (err) {
        console.warn('拉取雲端特訓失敗:', err);
      }
    }

    return allLessons[cleanClass] || allLessons['all'] || null;
  }

  async fetchAllCustomLessonsFromCloud() {
    if (this.isFirebaseReady && this.db) {
      try {
        const snapshot = await this.db.collection('custom_lessons').get();
        const list = [];
        snapshot.forEach(doc => {
          const d = doc.data();
          if (d && d.targetClass) list.push(d);
        });
        // 雲端是唯一真實來源，更新本地快取
        const cache = {};
        list.forEach(item => { cache[item.targetClass] = item; });
        localStorage.setItem('typehero_custom_lessons', JSON.stringify(cache));
        return list;
      } catch (err) {
        console.warn('拉取全部特訓清單失敗:', err);
      }
    }

    // 本地備援（僅離線時）
    try {
      const allLessons = JSON.parse(localStorage.getItem('typehero_custom_lessons') || '{}');
      return Object.values(allLessons);
    } catch (e) {
      return [];
    }
  }

  async deleteCustomLessonFromCloud(targetClass) {
    const cleanClass = targetClass || 'all';
    let allLessons = {};
    try {
      allLessons = JSON.parse(localStorage.getItem('typehero_custom_lessons') || '{}');
      delete allLessons[cleanClass];
      localStorage.setItem('typehero_custom_lessons', JSON.stringify(allLessons));
    } catch (e) {}

    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('custom_lessons').doc(`lesson_${cleanClass}`).delete();
        console.log(`☁️ 課堂特訓 [${cleanClass}] 已自雲端刪除`);
      } catch (err) {
        console.error('刪除雲端特訓失敗:', err);
      }
    }
  }

  // ==========================================
  // 最高管理員：清除全校排行榜 (限 Master Admin)
  // ==========================================
  async clearLeaderboardRecords() {
    localStorage.removeItem('typehero_local_leaderboard');
    if (this.isFirebaseReady && this.db) {
      try {
        const snap = await this.db.collection('leaderboard').limit(100).get();
        const batch = this.db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log('🧹 雲端排行榜紀錄已清除！');
      } catch (err) {
        console.error('清除雲端排行榜失敗:', err);
      }
    }
  }
}

// 實例化為全域單例
window.cloudSync = new CloudSyncManager();
