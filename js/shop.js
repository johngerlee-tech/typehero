/**
 * TypeHero 虛擬幣經濟、等級成就與外觀商城模組
 * 負責金幣（Star Coins）、經驗值、軍階計算、背包解鎖狀態與樣式套用
 */

class ShopManager {
  constructor() {
    this.storageKey = 'typehero_player_data';
    this.data = this.loadData();
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

  loadData() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('讀取存檔失敗，重設存檔');
      }
    }
    return {
      coins: 100, // 新手開學見面禮 100 幣
      exp: 0,
      level: 1,
      unlockedSkins: ['default'],
      equippedSkin: 'default',
      unlockedSounds: ['mechanical'],
      equippedSound: 'mechanical',
      unlockedAvatars: ['cat'],
      equippedAvatar: 'cat',
      lessonStars: {} // { 'zh-1': 3, 'en-1': 2 }
    };
  }

  saveData(syncCloud = true) {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    this.updateUI();

    // 雲端資料庫雙向同步
    if (syncCloud && window.cloudSync && window.cloudSync.isFirebaseReady) {
      window.cloudSync.syncProfileToCloud();
    }
  }

  /**
   * 自雲端漫遊還原學生進度（換電腦登入時觸發）
   */
  restoreFromCloud(cloudData) {
    if (!cloudData) return;

    // 1. 金幣與經驗值（合併雲端紀錄，取較優值）
    const cloudCoins = Number(cloudData.coins);
    if (!isNaN(cloudCoins)) {
      this.data.coins = Math.max(this.data.coins || 0, cloudCoins);
    }

    const cloudExp = Number(cloudData.exp);
    if (!isNaN(cloudExp)) {
      this.data.exp = Math.max(this.data.exp || 0, cloudExp);
      this.data.level = Math.floor(this.data.exp / 200) + 1;
    }

    // 2. 關卡星等 (合併本地與雲端，保留最高星數)
    const localStars = this.data.lessonStars || {};
    const cloudStars = cloudData.lessonStars || {};
    const mergedStars = { ...localStars };
    for (const [id, stars] of Object.entries(cloudStars)) {
      mergedStars[id] = Math.max(mergedStars[id] || 0, Number(stars) || 0);
    }
    this.data.lessonStars = mergedStars;

    // 3. 背包解鎖清單 (聯集不重複)
    const mergeArrays = (arr1, arr2) => Array.from(new Set([...(arr1 || []), ...(arr2 || [])]));
    this.data.unlockedSkins = mergeArrays(this.data.unlockedSkins, cloudData.unlockedSkins);
    this.data.unlockedSounds = mergeArrays(this.data.unlockedSounds, cloudData.unlockedSounds);
    this.data.unlockedAvatars = mergeArrays(this.data.unlockedAvatars, cloudData.unlockedAvatars);

    // 4. 裝備狀態 (以雲端紀錄為主)
    if (cloudData.equippedSkin && this.data.unlockedSkins.includes(cloudData.equippedSkin)) {
      this.data.equippedSkin = cloudData.equippedSkin;
    }
    if (cloudData.equippedSound && this.data.unlockedSounds.includes(cloudData.equippedSound)) {
      this.data.equippedSound = cloudData.equippedSound;
    }
    if (cloudData.equippedAvatar && this.data.unlockedAvatars.includes(cloudData.equippedAvatar)) {
      this.data.equippedAvatar = cloudData.equippedAvatar;
    }

    // 寫入本機快取（不重複上傳避免無窮迴圈）
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
