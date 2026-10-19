/**
 * TypeHero Firebase 雲端資料庫與班級排行榜整合模組
 * 支援：
 * 1. 學校電腦教室免帳號模式 (LocalStorage 本機優先快取)
 * 2. 班級＋座號＋暱稱 雲端即時同步 (Firestore)
 * 3. 即時排行榜上傳與拉取
 * 4. 斷網或未配置 Firebase 憑證時自動切換至「智慧型本機模擬模式」，保證 100% 穩定不報錯！
 */

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
    this.profile = this.loadProfile();
    this.classList = this.loadClassList();
    this.isFirebaseReady = false;
    this.db = null;

    this.initFirebase();
  }

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

  saveProfile(className, seatNumber, nickname) {
    this.profile = { className, seatNumber, nickname, hasRegistered: true };
    localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
    this.updateProfileBadgeUI();
    this.syncProfileToCloud();
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
          console.log('☁️ 成功從雲端同步學校班級名單！');
        }
      }
    } catch (e) {
      console.warn('拉取雲端班級名冊失敗，使用本機配置', e);
    }
  }

  initFirebase() {
    // 檢查是否有儲存自訂 Firebase 配置
    const customConfig = localStorage.getItem(this.firebaseConfigKey);
    let config = null;

    if (customConfig) {
      try {
        config = JSON.parse(customConfig);
      } catch (e) {
        console.warn('自訂 Firebase 設定格式錯誤');
      }
    }

    // 若瀏覽器已載入 Firebase SDK 且有設定 config，則初始化
    if (window.firebase && config && config.apiKey) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(config);
        }
        this.db = firebase.firestore();
        this.isFirebaseReady = true;
        console.log('✅ Firebase 雲端資料庫連線成功！');
      } catch (err) {
        console.warn('Firebase 初始化失敗，使用本機安全模式', err);
        this.isFirebaseReady = false;
      }
    } else {
      console.log('ℹ️ 目前運行於「本機快取模式」，可於設定彈窗填入 Firebase 憑證以啟用全校雲端連線。');
    }
  }

  setFirebaseConfig(configObj) {
    localStorage.setItem(this.firebaseConfigKey, JSON.stringify(configObj));
    this.initFirebase();
  }

  /**
   * 同步個人等級與星幣到雲端
   */
  async syncProfileToCloud() {
    if (!this.isFirebaseReady || !this.db) return;

    try {
      const studentId = `${this.profile.className}_${this.profile.seatNumber}`;
      const playerData = window.shopManager ? window.shopManager.data : {};

      await this.db.collection('students').doc(studentId).set({
        className: this.profile.className,
        seatNumber: this.profile.seatNumber,
        nickname: this.profile.nickname,
        level: playerData.level || 1,
        exp: playerData.exp || 0,
        coins: playerData.coins || 0,
        equippedSkin: playerData.equippedSkin || 'default',
        equippedAvatar: playerData.equippedAvatar || 'cat',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log('☁️ 雲端個人存檔同步完成！');
    } catch (e) {
      console.error('雲端存檔同步失敗:', e);
    }
  }

  /**
   * 通關後上傳打字成績至排行榜
   */
  async submitScore(lessonId, lessonTitle, wpm, accuracy) {
    const record = {
      className: this.profile.className,
      seatNumber: this.profile.seatNumber,
      nickname: this.profile.nickname,
      lessonId: lessonId,
      lessonTitle: lessonTitle,
      wpm: wpm,
      accuracy: accuracy,
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

    // 2. 雲端 Firebase 上傳
    if (this.isFirebaseReady && this.db) {
      try {
        await this.db.collection('leaderboard').add({
          ...record,
          serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('🏆 成績已成功上傳至 Firebase 雲端排行榜！');
      } catch (e) {
        console.error('上傳成績至雲端失敗:', e);
      }
    }
  }

  /**
   * 獲取即時排行榜資料 (支援雲端與離線備援)
   */
  async fetchTopScores(limitCount = 10) {
    if (this.isFirebaseReady && this.db) {
      try {
        const snapshot = await this.db.collection('leaderboard')
          .orderBy('wpm', 'desc')
          .limit(limitCount)
          .get();

        const results = [];
        snapshot.forEach(doc => results.push(doc.data()));
        if (results.length > 0) return results;
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
}

window.cloudSync = new CloudSyncManager();
