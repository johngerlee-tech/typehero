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

// 預設全校班級清單（溪洲國小）
const DEFAULT_CLASS_LIST = [
  '1年1班', '1年2班',
  '2年1班', '2年2班',
  '3年1班', '3年2班', '3年3班',
  '4年1班', '4年2班', '4年3班',
  '5年1班', '5年2班', '5年3班', '5年4班',
  '6年1班', '6年2班', '6年3班', '6年4班',
  '教師示範組', '來賓體驗組'
];

class CloudSyncManager {
  constructor() {
    this.storageKey = 'typehero_student_profile';
    this.firebaseConfigKey = 'typehero_firebase_config';
    this.classListKey = 'typehero_class_list';
    this.adminPasswordKey = 'typehero_admin_password';

    this.profile = this.loadProfile();
    this.classList = this.loadClassList();
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
      seatNumber: '01',
      nickname: '鍵盤小英雄',
      hasRegistered: false
    };
  }

  saveProfile(className, seatNumber, nickname) {
    this.profile = { 
      className: String(className).trim() || '5年3班', 
      seatNumber: String(seatNumber).padStart(2, '0'), 
      nickname: String(nickname).trim() || '鍵盤小英雄', 
      hasRegistered: true 
    };
    localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
    this.updateProfileBadgeUI();
  }

  updateProfileBadgeUI() {
    const titleEl = document.getElementById('user-title-display');
    const badgeEl = document.getElementById('user-profile-badge');
    const tagEl = document.getElementById('user-student-tag');
    if (tagEl && this.profile) {
      tagEl.innerText = `${this.profile.className} ${this.profile.seatNumber}號`;
    }
    if (titleEl && this.profile) {
      titleEl.innerText = this.profile.nickname || '鍵盤小英雄';
    }
    if (badgeEl && this.profile) {
      badgeEl.title = `目前學生：${this.profile.className} ${this.profile.seatNumber}號 ${this.profile.nickname} (點擊可切換)`;
    }
  }

  // ==========================================
  // 班級名單維護
  // ==========================================
  loadClassList() {
    const raw = localStorage.getItem(this.classListKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('讀取班級清單失敗', e);
      }
    }
    return [...DEFAULT_CLASS_LIST];
  }

  saveClassList(classes) {
    if (!Array.isArray(classes)) return this.classList;
    const cleanList = Array.from(new Set(classes.map(c => String(c).trim()).filter(Boolean)));
    this.classList = cleanList.length > 0 ? cleanList : [...DEFAULT_CLASS_LIST];
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
    this.classList = [...DEFAULT_CLASS_LIST];
    this.saveClassList(this.classList);
    return this.classList;
  }

  populateClassSelects(preferredClass) {
    const selects = [
      document.getElementById('login-class-select'),
      document.getElementById('input-class-name')
    ].filter(Boolean);

    const targetClass = preferredClass || this.profile.className || (this.classList[0] || '5年3班');

    selects.forEach(sel => {
      const currentVal = sel.value || targetClass;
      sel.innerHTML = '';
      this.classList.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = cls;
        opt.innerText = cls;
        if (cls === currentVal) opt.selected = true;
        sel.appendChild(opt);
      });
      if (!this.classList.includes(currentVal) && this.classList.length > 0) {
        sel.value = this.classList[0];
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
        this.isFirebaseReady = true;

        console.log(`✅ Firebase 雲端資料庫初始化成功！專案 ID: [${config.projectId}]`);
        this.updateStatusBadge('connected', '☁️ 雲端已連線');

        // 初始化成功後自動自雲端拉取最新班級名冊與管理密碼
        setTimeout(() => {
          this.fetchCloudClassList();
        }, 100);

      } catch (err) {
        console.warn('⚠️ Firebase 初始化發生異常，切換至本機快取安全模式:', err);
        this.isFirebaseReady = false;
        this.updateStatusBadge('error', '⚠️ 雲端初始化異常');
      }
    } else {
      console.log('ℹ️ 未偵測到 Firebase SDK 或憑證，目前運行於本機快取模式。');
      this.isFirebaseReady = false;
      this.updateStatusBadge('offline', '💾 本機離線模式');
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
      pillText.innerText = text;
      if (pillIcon) {
        pillIcon.innerText = status === 'connected' ? '☁️' : status === 'error' ? '⚠️' : '💾';
      }
      pill.title = `Firebase 資料庫狀態：${text} (專案：${this.config ? this.config.projectId : '未設定'})`;
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
      
      this.updateStatusBadge('connected', '☁️ 雲端已連線');
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
      } else {
        // 雲端首次執行，自動寫入預設班級清單與預設密碼建立 school_config
        await this.db.collection('config').doc('school_config').set({
          classList: this.classList,
          adminPassword: this.getAdminPassword(),
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
  // 雙向雲端漫遊核心：拉取學生雲端存檔 (換電腦時自動還原)
  // ==========================================
  async loadProfileFromCloud(className, seatNumber) {
    if (!this.isFirebaseReady || !this.db) return null;
    if (!className || !seatNumber) return null;

    const studentId = `${className}_${seatNumber}`;
    try {
      console.log(`🔍 正在為 [${studentId}] 查詢雲端進度...`);
      const docSnap = await this.db.collection('students').doc(studentId).get();

      if (docSnap.exists) {
        const cloudData = docSnap.data();
        console.log('🎉 成功拉取到雲端學生存檔！', cloudData);

        // 1. 還原基本身份檔案
        if (cloudData.nickname) {
          this.profile.nickname = cloudData.nickname;
        }
        this.profile.className = className;
        this.profile.seatNumber = seatNumber;
        this.profile.hasRegistered = true;
        localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
        this.updateProfileBadgeUI();

        // 2. 還原 ShopManager 經濟與裝備進度（金幣、經驗、等級、關卡最高星、造型背包）
        if (window.shopManager) {
          window.shopManager.restoreFromCloud(cloudData);
        }

        // 3. 顯示漫遊成功視覺提示
        this.showToast(`☁️ 歡迎回來！已自雲端漫遊還原【${this.profile.nickname}】的進度（Lv.${cloudData.level || 1} · ${cloudData.coins || 0} 星幣）`, 'success');
        return cloudData;
      } else {
        console.log(`ℹ️ 雲端尚無 [${studentId}] 的歷史進度，將以目前本機設定初始化雲端存檔。`);
        // 新座號首次使用，將現有基礎檔案註冊上傳
        await this.syncProfileToCloud();
        return null;
      }
    } catch (e) {
      console.warn('拉取雲端學生個人存檔失敗:', e);
      return null;
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
        nickname: this.profile.nickname || '鍵盤小英雄',
        level: Number(playerData.level) || 1,
        exp: Number(playerData.exp) || 0,
        coins: Number(playerData.coins) || 0,
        equippedSkin: playerData.equippedSkin || 'default',
        equippedSound: playerData.equippedSound || 'mechanical',
        equippedAvatar: playerData.equippedAvatar || 'cat',
        unlockedSkins: playerData.unlockedSkins || ['default'],
        unlockedSounds: playerData.unlockedSounds || ['mechanical'],
        unlockedAvatars: playerData.unlockedAvatars || ['cat'],
        lessonStars: playerData.lessonStars || {},
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await this.db.collection('students').doc(studentId).set(payload, { merge: true });
      console.log(`☁️ 學生 [${studentId}] 雲端個人存檔已同步完成！`);
      return true;
    } catch (e) {
      console.error('雲端存檔同步失敗:', e);
      return false;
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
}

// 實例化為全域單例
window.cloudSync = new CloudSyncManager();
