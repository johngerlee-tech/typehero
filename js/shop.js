/**
 * TypeHero 虛擬幣經濟、等級成就與外觀商城模組
 * 負責金幣（Star Coins）、經驗值、軍階計算、背包解鎖狀態與樣式套用
 * 支援依「班級_座號」分帳號獨立保存，防止換座號時繼承或污染前人資料
 */

class ShopManager {
  constructor() {
    this.storageKey = 'typehero_player_data';
    this.currentStudentId = null;

    // 若本地已有現行學生身份，自動綁定至該帳號
    if (window.cloudSync && window.cloudSync.profile && window.cloudSync.profile.className && window.cloudSync.profile.seatNumber) {
      this.currentStudentId = `${window.cloudSync.profile.className}_${window.cloudSync.profile.seatNumber}`;
    }

    this.data = this.loadData(this.currentStudentId);
    this.catalog = {
      skins: [
        { id: 'default', name: '活力科技深藍', price: 0, preview: '💻', desc: '經典電競深藍配色，護眼清晰', themeClass: '' },
        { id: 'macaron', name: '櫻花草莓馬卡龍', price: 150, preview: '🌸', desc: '粉嫩溫柔甜點風格，少女心爆棚', themeClass: 'theme-macaron' },
        { id: 'cyberpunk', name: '賽博霓虹電競', price: 300, preview: '⚡', desc: '酷炫黑底螢光霓虹，電競感十足', themeClass: 'theme-cyberpunk' },
        { id: 'forest', name: '清新森林抹茶', price: 350, preview: '🍃', desc: '綠意盎然自然護眼，如漫步森林校園', themeClass: 'theme-forest' },
        { id: 'galaxy', name: '深空星幻紫', price: 450, preview: '🌌', desc: '神秘夢幻紫羅蘭，星空宇宙漫遊', themeClass: 'theme-galaxy' },
        { id: 'sunset', name: '暖陽金橘暮光', price: 500, preview: '🌅', desc: '溫暖朝氣的晚霞夕陽，熱情活力充沛', themeClass: 'theme-sunset' },
        { id: 'retro', name: '復古經典打字機', price: 600, preview: '📜', desc: '溫暖典雅羊皮紙，重回古典文豪時代', themeClass: 'theme-retro' },
        { id: 'ice', name: '極地冰雪冰晶', price: 700, preview: '❄️', desc: '清涼晶瑩極地冰霜，透亮純淨極致爽快', themeClass: 'theme-ice' }
      ],
      sounds: [
        { id: 'mechanical', name: 'Cherry MX 青軸', price: 0, preview: '⌨️', desc: '清脆有力的段落撞擊與彈簧餘音' },
        { id: 'bubble', name: 'Q彈水晶泡泡音', price: 120, preview: '🫧', desc: '輕快療癒的啵啵泡泡水音' },
        { id: 'wood', name: '原木敲擊響板', price: 180, preview: '🪵', desc: '溫潤清脆的原木打擊聲，清爽質樸不刺耳' },
        { id: 'arcade', name: '8-bit 像素電玩', price: 250, preview: '👾', desc: '童年紅白機復古方波音階' },
        { id: 'waterdrop', name: '空靈清澈水滴', price: 320, preview: '💧', desc: '叮咚悅耳的空靈水滴聲，水潤純淨放鬆心靈' },
        { id: 'piano', name: '優雅鋼琴單音', price: 400, preview: '🎹', desc: '高雅純淨的清脆琴鍵聲' },
        { id: 'laser', name: '未來雷射光束', price: 480, preview: '⚡', desc: '充滿科技感的星際光束射擊，科幻打擊爽感十足' },
        { id: 'chime', name: '夢幻水晶風鈴', price: 650, preview: '🔔', desc: '晶瑩剔透的八音盒風鈴，每一下敲擊如星塵滑落' }
      ],
      avatars: [
        { id: 'cat', name: '探險貓咪', price: 0, preview: '🐱', desc: '好奇心滿滿的打字小學徒' },
        { id: 'shiba', name: '雷霆柴犬', price: 100, preview: '🐶', desc: '元氣充沛，打字絕不卡關！' },
        { id: 'astronaut', name: '星際太空人', price: 200, preview: '🚀', desc: '勇往直前，探索鍵盤宇宙' },
        { id: 'robot', name: '科技機甲', price: 350, preview: '🤖', desc: '精準無誤，零失誤率運算核心' },
        { id: 'wizard', name: '魔法鍵術士', price: 500, preview: '🧙‍♂️', desc: '指尖生風，鍵盤化作魔法杖' },
        { id: 'dragon', name: '烈焰祥龍', price: 600, preview: '🐲', desc: '霸氣威武的祥龍化身，鍵盤騰雲駕霧無人能擋！' },
        { id: 'unicorn', name: '夢幻獨角獸', price: 750, preview: '🦄', desc: '象徵純淨神速的傳奇神獸，七彩流光奔馳在按鍵間！' },
        { id: 'crown', name: '鍵盤神話至尊', price: 800, preview: '👑', desc: '登上打字神壇的最高榮譽徽章' }
      ]
    };

    // 套用初始外觀與音效
    this.applySkin(this.data.equippedSkin);
    if (window.soundEngine) {
      window.soundEngine.setSoundPack(this.data.equippedSound);
    }
  }

  /**
   * 取得乾淨的初始新帳號資料結構
   */
  getDefaultPlayerData() {
    return {
      coins: 0, // 初始星幣為 0
      exp: 0,
      level: 1,
      unlockedSkins: ['default'],
      equippedSkin: 'default',
      unlockedSounds: ['mechanical'],
      equippedSound: 'mechanical',
      unlockedAvatars: ['cat'],
      equippedAvatar: 'cat',
      lessonStars: {}, // { 'zh-1': 3, 'en-1': 2 }
      unlockedAchievements: []
    };
  }

  /**
   * 依據學生識別碼取得專屬的 localStorage 鍵名
   */
  getStorageKey(studentId = this.currentStudentId) {
    if (studentId) {
      return `typehero_player_data_${studentId}`;
    }
    return this.storageKey;
  }

  /**
   * 讀取存檔（優先讀取學生獨立存檔）
   */
  loadData(studentId = null) {
    const key = this.getStorageKey(studentId);
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.unlockedAchievements = Array.isArray(parsed.unlockedAchievements) ? parsed.unlockedAchievements : [];
        parsed.lessonStars = (parsed.lessonStars && typeof parsed.lessonStars === 'object') ? parsed.lessonStars : {};
        parsed.unlockedSkins = Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length ? parsed.unlockedSkins : ['default'];
        parsed.unlockedSounds = Array.isArray(parsed.unlockedSounds) && parsed.unlockedSounds.length ? parsed.unlockedSounds : ['mechanical'];
        parsed.unlockedAvatars = Array.isArray(parsed.unlockedAvatars) && parsed.unlockedAvatars.length ? parsed.unlockedAvatars : ['cat'];
        parsed.coins = Number(parsed.coins) >= 0 ? Number(parsed.coins) : 0;
        parsed.exp = Number(parsed.exp) >= 0 ? Number(parsed.exp) : 0;
        parsed.level = Number(parsed.level) >= 1 ? Number(parsed.level) : 1;
        parsed.equippedSkin = parsed.equippedSkin || 'default';
        parsed.equippedSound = parsed.equippedSound || 'mechanical';
        parsed.equippedAvatar = parsed.equippedAvatar || 'cat';
        return parsed;
      } catch (e) {
        console.error('讀取存檔失敗，使用初始設定:', e);
      }
    }
    return this.getDefaultPlayerData();
  }

  /**
   * 重設為乾淨的新帳號模式（新座號首次登入時調用）
   */
  resetToDefault(studentId) {
    this.currentStudentId = studentId || null;
    this.data = this.getDefaultPlayerData();
    const key = this.getStorageKey(studentId);
    localStorage.setItem(key, JSON.stringify(this.data));
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    
    this.applySkin(this.data.equippedSkin);
    if (window.soundEngine) {
      window.soundEngine.setSoundPack(this.data.equippedSound);
    }
    this.updateUI();
    console.log(`✨ 已為學生 [${studentId || '新帳號'}] 初始化乾淨的新帳號資料（等級1、0星幣、零進度）`);
  }

  /**
   * 切換學生帳號並載入該學生專屬進度（換電腦或換座號時調用）
   */
  switchToStudent(studentId, cloudData = null) {
    this.currentStudentId = studentId;
    if (cloudData) {
      // 來自雲端漫遊資料：完全以該座號的雲端存檔還原，絕對不與本機前一學生資料混雜
      this.restoreFromCloud(cloudData);
    } else {
      // 離線或無雲端快照：檢查本機是否有此學生的專屬快取
      const key = this.getStorageKey(studentId);
      if (localStorage.getItem(key)) {
        this.data = this.loadData(studentId);
        this.applySkin(this.data.equippedSkin);
        if (window.soundEngine) {
          window.soundEngine.setSoundPack(this.data.equippedSound);
        }
        this.updateUI();
      } else {
        // 全新學生：乾淨新帳號
        this.resetToDefault(studentId);
      }
    }
  }

  saveData(syncCloud = true) {
    const studentKey = this.getStorageKey();
    localStorage.setItem(studentKey, JSON.stringify(this.data));
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    this.updateUI();

    // 雲端資料庫雙向同步
    if (syncCloud && window.cloudSync && window.cloudSync.isFirebaseReady) {
      window.cloudSync.syncProfileToCloud();
    }
  }

  /**
   * 自雲端漫遊還原學生進度（以雲端該帳號為唯一真實來源，徹底隔絕不同座號間的資料污染）
   */
  restoreFromCloud(cloudData) {
    if (!cloudData) return;

    // 1. 金幣與經驗值（完全依據雲端存檔還原）
    const cloudCoins = Number(cloudData.coins);
    const coins = (!isNaN(cloudCoins) && cloudCoins >= 0) ? cloudCoins : 0;

    const cloudExp = Number(cloudData.exp);
    const exp = (!isNaN(cloudExp) && cloudExp >= 0) ? cloudExp : 0;
    const level = Number(cloudData.level) >= 1 ? Number(cloudData.level) : (Math.floor(exp / 200) + 1);

    // 2. 關卡星等（完全以該座號雲端存檔為準）
    const lessonStars = (cloudData.lessonStars && typeof cloudData.lessonStars === 'object')
      ? { ...cloudData.lessonStars }
      : {};

    // 3. 背包解鎖清單（確保預設項目存在）
    const unlockedSkins = Array.isArray(cloudData.unlockedSkins) && cloudData.unlockedSkins.length
      ? Array.from(new Set(['default', ...cloudData.unlockedSkins]))
      : ['default'];
    const unlockedSounds = Array.isArray(cloudData.unlockedSounds) && cloudData.unlockedSounds.length
      ? Array.from(new Set(['mechanical', ...cloudData.unlockedSounds]))
      : ['mechanical'];
    const unlockedAvatars = Array.isArray(cloudData.unlockedAvatars) && cloudData.unlockedAvatars.length
      ? Array.from(new Set(['cat', ...cloudData.unlockedAvatars]))
      : ['cat'];

    // 4. 成就解鎖清單
    const unlockedAchievements = Array.isArray(cloudData.unlockedAchievements)
      ? [...cloudData.unlockedAchievements]
      : [];

    // 5. 裝備狀態（驗證合法性）
    let equippedSkin = cloudData.equippedSkin || 'default';
    if (!unlockedSkins.includes(equippedSkin)) equippedSkin = 'default';

    let equippedSound = cloudData.equippedSound || 'mechanical';
    if (!unlockedSounds.includes(equippedSound)) equippedSound = 'mechanical';

    let equippedAvatar = cloudData.equippedAvatar || 'cat';
    if (!unlockedAvatars.includes(equippedAvatar)) equippedAvatar = 'cat';

    // 完整重設該學生的資料結構
    this.data = {
      coins,
      exp,
      level,
      lessonStars,
      unlockedSkins,
      equippedSkin,
      unlockedSounds,
      equippedSound,
      unlockedAvatars,
      equippedAvatar,
      unlockedAchievements
    };

    // 寫入學生專屬本機快取與通用快取（不重複上傳避免無窮迴圈）
    this.saveData(false);

    // 套用外觀、音效與畫面
    this.applySkin(this.data.equippedSkin);
    if (window.soundEngine) {
      window.soundEngine.setSoundPack(this.data.equippedSound);
    }
    this.updateUI();
  }

  /**
   * 結算增加經驗值與星幣
   */
  rewardMatch(wpm, accuracy, stars, comboMax) {
    // 金幣計算公式：星星獎勵 + WPM 獎勵 + 連擊獎勵
    const baseCoins = stars * 15;
    const speedBonus = Math.floor(wpm * 0.8);
    const comboBonus = Math.floor(comboMax * 0.5);
    const earnedCoins = baseCoins + speedBonus + comboBonus;

    // 經驗值計算公式
    const earnedExp = Math.floor(wpm * 10 + (accuracy / 100) * 80 + stars * 50);

    this.data.coins += earnedCoins;
    this.data.exp += earnedExp;

    // 升級計算 (每 200 EXP 一級)
    const newLevel = Math.floor(this.data.exp / 200) + 1;
    const isLevelUp = newLevel > this.data.level;
    this.data.level = newLevel;

    this.saveData();

    if (window.soundEngine) {
      window.soundEngine.playCoin();
    }

    return { earnedCoins, earnedExp, isLevelUp, newLevel };
  }

  getTitleByLevel(level) {
    if (level < 5) return '鍵盤見習生 🥉';
    if (level < 15) return '拼字小高手 🥈';
    if (level < 25) return '神速打字官 🥇';
    if (level < 40) return '疾風鍵魔導 💎';
    return '傳奇鍵盤至尊 👑';
  }

  buyItem(category, itemId) {
    const item = this.catalog[category]?.find(i => i.id === itemId);
    if (!item) return false;

    const unlockedList = category === 'skins' ? this.data.unlockedSkins
      : category === 'sounds' ? this.data.unlockedSounds
      : this.data.unlockedAvatars;

    if (unlockedList.includes(itemId)) {
      // 已經擁有，直接裝備
      this.equipItem(category, itemId);
      return true;
    }

    if (this.data.coins >= item.price) {
      this.data.coins -= item.price;
      unlockedList.push(itemId);
      this.equipItem(category, itemId);
      this.saveData();
      if (window.soundEngine) window.soundEngine.playCoin();
      return true;
    } else {
      alert(`星幣不足！還差 ${item.price - this.data.coins} 幣，快去挑戰關卡賺金幣吧！`);
      return false;
    }
  }

  equipItem(category, itemId) {
    if (category === 'skins') {
      this.data.equippedSkin = itemId;
      this.applySkin(itemId);
    } else if (category === 'sounds') {
      this.data.equippedSound = itemId;
      if (window.soundEngine) window.soundEngine.setSoundPack(itemId);
    } else if (category === 'avatars') {
      this.data.equippedAvatar = itemId;
    }
    this.saveData();
  }

  applySkin(skinId) {
    const target = this.catalog.skins.find(s => s.id === skinId);
    // 移除所有主題 class
    this.catalog.skins.forEach(s => {
      if (s.themeClass) document.body.classList.remove(s.themeClass);
    });
    if (target && target.themeClass) {
      document.body.classList.add(target.themeClass);
    }
  }

  updateUI() {
    const coinEl = document.getElementById('user-coins-display');
    const levelEl = document.getElementById('user-level-display');
    const titleEl = document.getElementById('user-title-display');
    const avatarEl = document.getElementById('user-avatar-display');

    if (coinEl) coinEl.innerText = this.data.coins;
    if (levelEl) levelEl.innerText = `Lv.${this.data.level}`;
    if (titleEl) titleEl.innerText = this.getTitleByLevel(this.data.level);
    if (avatarEl) {
      const activeAvatar = this.catalog.avatars.find(a => a.id === this.data.equippedAvatar);
      avatarEl.innerText = activeAvatar ? activeAvatar.preview : '🐱';
    }
    const modalAvatar = document.getElementById('profile-modal-avatar');
    if (modalAvatar) {
      const activeAvatar = this.catalog.avatars.find(a => a.id === this.data.equippedAvatar);
      modalAvatar.innerText = activeAvatar ? activeAvatar.preview : '🐱';
    }
  }
}

window.shopManager = new ShopManager();
