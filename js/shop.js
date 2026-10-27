/**
 * TypeHero 虛擬幣經濟、等級成就與外觀商城模組
 * 負責金幣（Star Coins）、經驗值、軍階計算、背包解鎖狀態與樣式套用
 * 支援依「班級_座號」分帳號獨立保存，防止換座號時繼承或污染前人資料
 */

class ShopManager {
  constructor() {
    this.storageKey = 'typehero_player_data';
    this.currentStudentId = null;

    // 優先自 localStorage 檢查現行已登入之學生身分（避免依賴腳本載入順序）
    try {
      const savedProfile = JSON.parse(localStorage.getItem('typehero_student_profile') || 'null');
      if (savedProfile && savedProfile.hasRegistered && savedProfile.className && savedProfile.seatNumber) {
        this.currentStudentId = `${savedProfile.className}_${savedProfile.seatNumber}`;
      }
    } catch (e) {}

    if (!this.currentStudentId && window.cloudSync && window.cloudSync.profile && window.cloudSync.profile.className && window.cloudSync.profile.seatNumber) {
      this.currentStudentId = `${window.cloudSync.profile.className}_${window.cloudSync.profile.seatNumber}`;
    }

    // 先定義商品目錄（必須在 loadData 之前，供 loadData 驗證合法性）
    this.catalog = {
      skins: [
        { id: 'default', name: '活力科技深藍', price: 0, preview: '💻', desc: '經典電競深藍配色，護眼清晰', themeClass: '' },
        { id: 'macaron', name: '櫻花草莓馬卡龍', price: 150, preview: '🌸', desc: '粉嫩溫柔甜點風格，少女心爆棚', themeClass: 'theme-macaron' },
        { id: 'cyberpunk', name: '賽博霓虹電競', price: 300, preview: '⚡', desc: '酷炫黑底螢光霓虹，電競感十足', themeClass: 'theme-cyberpunk' },
        { id: 'forest', name: '清新森林抹茶', price: 350, preview: '🍃', desc: '綠意盎然自然護眼，如漫步森林校園', themeClass: 'theme-forest' },
        { id: 'galaxy', name: '深空星幻紫', price: 450, preview: '🌌', desc: '神秘夢幻紫羅蘭，星空宇宙漫遊', themeClass: 'theme-galaxy' },
        { id: 'sunset', name: '暖陽金橘暮光', price: 500, preview: '🌅', desc: '溫暖朝氣的晚霞夕陽，熱情活力充沛', themeClass: 'theme-sunset' },
        { id: 'retro', name: '復古經典打字機', price: 600, preview: '📜', desc: '溫暖典雅羊皮紙，重回古典文豪時代', themeClass: 'theme-retro' },
        { id: 'ice', name: '極地冰雪冰晶', price: 700, preview: '❄️', desc: '清涼晶瑩極地冰霜，透亮純淨極致爽快', themeClass: 'theme-ice' },
        { id: 'volcano', name: '熔岩黑曜戰魂', price: 750, preview: '🌋', desc: '熾熱赤紅流淌黑曜石岩盤，燃燒無畏鬥志', themeClass: 'theme-volcano' },
        { id: 'honey', name: '蜜糖檸檬向日葵', price: 800, preview: '🌻', desc: '明亮燦爛陽光奶油黃，溫暖清新活力滿點', themeClass: 'theme-honey' },
        { id: 'deepocean', name: '深海幽光水母', price: 850, preview: '🪼', desc: '萬米深海幽藍與水母青綠冷光，寧靜深邃的海洋奇景', themeClass: 'theme-deepocean' },
        { id: 'gold', name: '皇家黑金榮耀', price: 900, preview: '⚜️', desc: '尊榮極黑搭配璀璨香檳流金，打字至尊巔峰榮譽', themeClass: 'theme-gold' }
      ],
      sounds: [
        { id: 'mechanical', name: 'Cherry MX 青軸', price: 0, preview: '⌨️', desc: '清脆有力的段落撞擊與彈簧餘音' },
        { id: 'bubble', name: 'Q彈水晶泡泡音', price: 120, preview: '🫧', desc: '輕快療癒的啵啵泡泡水音' },
        { id: 'wood', name: '原木敲擊響板', price: 180, preview: '🪵', desc: '溫潤清脆的原木打擊聲，清爽質樸不刺耳' },
        { id: 'arcade', name: '8-bit 像素電玩', price: 250, preview: '👾', desc: '童年紅白機復古方波音階' },
        { id: 'waterdrop', name: '空靈清澈水滴', price: 320, preview: '💧', desc: '叮咚悅耳的空靈水滴聲，水潤純淨放鬆心靈' },
        { id: 'piano', name: '優雅鋼琴單音', price: 400, preview: '🎹', desc: '高雅純淨的清脆琴鍵聲' },
        { id: 'laser', name: '未來雷射光束', price: 480, preview: '⚡', desc: '充滿科技感的星際光束射擊，科幻打擊爽感十足' },
        { id: 'chime', name: '夢幻水晶風鈴', price: 650, preview: '🔔', desc: '晶瑩剔透的八音盒風鈴，每一下敲擊如星塵滑落' },
        { id: 'guitar', name: '晨曦清脆木吉他', price: 700, preview: '🎸', desc: '溫暖動聽的尼龍弦撥弦聲，如同指尖彈奏民謠吉他' },
        { id: 'drum', name: '搖滾節奏小軍鼓', price: 750, preview: '🥁', desc: '強勁俐落的金屬邊擊敲擊感，每一次擊鍵都充滿律動節奏' },
        { id: 'gameboy', name: '奇幻冒險金幣跳', price: 800, preview: '🪙', desc: '萌趣歡快的雙音琶音跳躍音，宛如經典主機吃金幣冒險闖關' },
        { id: 'thunder', name: '史詩雷霆重低音', price: 880, preview: '⚡', desc: '深沉震撼的次低頻能量衝擊，每一次敲擊都帶有萬鈞雷霆之威' }
      ],
      avatars: [
        { id: 'knight', name: '聖殿騎士', price: 0, preview: '🛡️', desc: '堅毅勇敢的鍵盤守護者，以絕對防禦守護打字準確率' },
        { id: 'warrior', name: '勇者劍士', price: 100, preview: '⚔️', desc: '熱血無畏的冒險先鋒，一往直前劈開字詞難關' },
        { id: 'archer', name: '精靈遊俠', price: 180, preview: '🏹', desc: '百步穿楊神射手，指尖出箭百發百中零失誤' },
        { id: 'mage', name: '元素法師', price: 260, preview: '🔮', desc: '掌控冰火奧術，鍵盤化作魔法杖施展疾風咒語' },
        { id: 'ninja', name: '暗影忍者', price: 340, preview: '🥷', desc: '神出鬼沒疾風幻影，極速連擊瞬息破百WPM' },
        { id: 'bard', name: '吟遊詩人', price: 420, preview: '🪕', desc: '音律流淌心曠神怡，每一下擊鍵如撥弄優雅琴弦' },
        { id: 'paladin', name: '光明聖騎', price: 500, preview: '⚜️', desc: '沐浴神聖榮光，堅毅不屈引領冒險團隊' },
        { id: 'mechanic', name: '魔導工匠', price: 580, preview: '⚙️', desc: '精密齒輪與蒸汽動力，打造極致零容錯的機械打字核心' },
        { id: 'monk', name: '武道宗師', price: 660, preview: '🥋', desc: '拳掌生風心手合一，擊鍵如疾風驟雨行雲流水' },
        { id: 'berserker', name: '狂戰先鋒', price: 740, preview: '🪓', desc: '雙斧狂暴疾風破浪，以雷霆萬鈞之勢橫掃所有字詞難關' },
        { id: 'valkyrie', name: '天界女武神', price: 820, preview: '🪽', desc: '展翼翱翔九天，傳說中的勝利之翼神速無雙' },
        { id: 'king', name: '傳奇帝王', price: 900, preview: '👑', desc: '加冕為王統治打字神殿，受萬千英雄景仰' }
      ],
      pets: [
        { id: 'shiba', name: '元氣柴犬', price: 0, preview: '🐶', desc: '元氣滿滿搖尾巴，打字累了隨時為你加油打氣！' },
        { id: 'cat', name: '招財橘貓', price: 80, preview: '🐱', desc: '呼嚕呼嚕趴在身邊，帶來滿滿的打字幸運與星幣！' },
        { id: 'fox', name: '星空靈狐', price: 150, preview: '🦊', desc: '聰慧靈動的小狐狸，眼神專注陪你辨識每個注音鍵位' },
        { id: 'rabbit', name: '櫻花玉兔', price: 220, preview: '🐰', desc: '輕盈敏捷蹦蹦跳跳，陪伴你的手速如脫兔般飛躍' },
        { id: 'panda', name: '軟萌熊貓', price: 280, preview: '🐼', desc: '圓滾滾的國寶小可愛，抱著竹子悠哉陪你無壓力練習' },
        { id: 'wolf', name: '疾風戰狼', price: 360, preview: '🐺', desc: '忠誠勇猛的荒野夥伴，守護每一次連擊決不中斷' },
        { id: 'penguin', name: '極地企鵝', price: 420, preview: '🐧', desc: '搖搖擺擺的冰雪紳士，冷靜沈著提醒你保持100%準確率' },
        { id: 'owl', name: '智者白鴞', price: 500, preview: '🦉', desc: '夜行智慧森林導師，目光如炬指引盲打最佳手位' },
        { id: 'dragon', name: '烈焰赤龍', price: 600, preview: '🐲', desc: '威風凜凜的東方小幼龍，吐出火熱鬥志點燃你的打字魂' },
        { id: 'unicorn', name: '彩虹獨角獸', price: 700, preview: '🦄', desc: '踏著雲朵與星辰而來，散發夢幻七彩光芒的神聖夥伴' },
        { id: 'dolphin', name: '海藍海豚', price: 780, preview: '🐬', desc: '在大海乘風破浪，以最流暢的節奏陪伴你的指尖起伏' },
        { id: 'turtle', name: '萬壽金龜', price: 850, preview: '🐢', desc: '穩紮穩打一步一腳印，象徵堅持不懈的勤學毅力王' }
      ]
    };

    // 目錄就緒後載入存檔
    this.data = this.loadData(this.currentStudentId);

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
      unlockedAvatars: ['knight'],
      equippedAvatar: 'knight',
      unlockedPets: ['shiba'],
      equippedPet: 'shiba',
      lessonStars: {},
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
  loadData(studentId = this.currentStudentId) {
    const key = this.getStorageKey(studentId);
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.unlockedAchievements = Array.isArray(parsed.unlockedAchievements) ? parsed.unlockedAchievements : [];
        parsed.lessonStars = (parsed.lessonStars && typeof parsed.lessonStars === 'object') ? parsed.lessonStars : {};
        parsed.unlockedSkins = Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length ? parsed.unlockedSkins : ['default'];
        parsed.unlockedSounds = Array.isArray(parsed.unlockedSounds) && parsed.unlockedSounds.length ? parsed.unlockedSounds : ['mechanical'];
        parsed.unlockedAvatars = Array.isArray(parsed.unlockedAvatars) && parsed.unlockedAvatars.length ? parsed.unlockedAvatars : ['knight'];
        if (!parsed.unlockedAvatars.includes('knight')) parsed.unlockedAvatars.push('knight');
        parsed.unlockedPets = Array.isArray(parsed.unlockedPets) && parsed.unlockedPets.length ? parsed.unlockedPets : ['shiba'];
        if (!parsed.unlockedPets.includes('shiba')) parsed.unlockedPets.push('shiba');
        parsed.coins = Number(parsed.coins) >= 0 ? Number(parsed.coins) : 0;
        parsed.exp = Number(parsed.exp) >= 0 ? Number(parsed.exp) : 0;
        parsed.level = Number(parsed.level) >= 1 ? Number(parsed.level) : 1;
        parsed.equippedSkin = parsed.equippedSkin || 'default';
        parsed.equippedSound = parsed.equippedSound || 'mechanical';
        const avatarCatalog = (this.catalog && this.catalog.avatars) ? this.catalog.avatars : [];
        parsed.equippedAvatar = (parsed.equippedAvatar && avatarCatalog.some(a => a.id === parsed.equippedAvatar)) ? parsed.equippedAvatar : 'knight';
        const petCatalog = (this.catalog && this.catalog.pets) ? this.catalog.pets : [];
        parsed.equippedPet = (parsed.equippedPet && petCatalog.some(p => p.id === parsed.equippedPet)) ? parsed.equippedPet : 'shiba';
        return parsed;
      } catch (e) {
        console.error('讀取存檔解析失敗，安全使用初始設定:', e);
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

    // 讀取既有本機存檔進行雙向防禦性合併（取較高數值，保證進度只增不減，徹底防止網路延遲歸零覆蓋）
    const localData = this.loadData(this.currentStudentId);

    // 1. 金幣與經驗值（取本機與雲端最大值，防止斷線或空快照覆蓋）
    const cloudCoins = Number(cloudData.coins);
    const validCloudCoins = (!isNaN(cloudCoins) && cloudCoins >= 0) ? cloudCoins : 0;
    const localCoins = Number(localData.coins) || 0;
    const coins = Math.max(localCoins, validCloudCoins);

    const cloudExp = Number(cloudData.exp);
    const validCloudExp = (!isNaN(cloudExp) && cloudExp >= 0) ? cloudExp : 0;
    const localExp = Number(localData.exp) || 0;
    const exp = Math.max(localExp, validCloudExp);

    const localLevel = Number(localData.level) || 1;
    const cloudLevelNum = Number(cloudData.level) || 1;
    const level = Math.max(localLevel, cloudLevelNum, Math.floor(exp / 200) + 1);

    // 2. 關卡星等：合併本機與雲端星等（取最高星）
    const lessonStars = Object.assign({}, localData.lessonStars || {});
    if (cloudData.lessonStars && typeof cloudData.lessonStars === 'object') {
      for (const [lid, cStar] of Object.entries(cloudData.lessonStars)) {
        lessonStars[lid] = Math.max(lessonStars[lid] || 0, Number(cStar) || 0);
      }
    }

    // 3. 背包解鎖清單（聯集合併，確保已購買的皮膚、音效、頭像與寵物絕對不丟失）
    const unlockedSkins = Array.from(new Set(['default', ...(cloudData.unlockedSkins || []), ...(localData.unlockedSkins || [])]));
    const unlockedSounds = Array.from(new Set(['mechanical', ...(cloudData.unlockedSounds || []), ...(localData.unlockedSounds || [])]));
    const unlockedAvatars = Array.from(new Set(['knight', ...(cloudData.unlockedAvatars || []), ...(localData.unlockedAvatars || [])]));
    const unlockedPets = Array.from(new Set(['shiba', ...(cloudData.unlockedPets || []), ...(localData.unlockedPets || [])]));

    // 4. 成就解鎖清單（聯集合併）
    const unlockedAchievements = Array.from(new Set([...(cloudData.unlockedAchievements || []), ...(localData.unlockedAchievements || [])]));

    // 5. 裝備狀態（優先取雲端設定，若未擁有則取本地或預設）
    let equippedSkin = cloudData.equippedSkin || localData.equippedSkin || 'default';
    if (!unlockedSkins.includes(equippedSkin)) equippedSkin = 'default';

    let equippedSound = cloudData.equippedSound || localData.equippedSound || 'mechanical';
    if (!unlockedSounds.includes(equippedSound)) equippedSound = 'mechanical';

    let equippedAvatar = cloudData.equippedAvatar || localData.equippedAvatar || 'knight';
    if (!unlockedAvatars.includes(equippedAvatar)) equippedAvatar = 'knight';

    let equippedPet = cloudData.equippedPet || localData.equippedPet || 'shiba';
    if (!unlockedPets.includes(equippedPet)) equippedPet = 'shiba';

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
      unlockedPets,
      equippedPet,
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
      : category === 'avatars' ? this.data.unlockedAvatars
      : (this.data.unlockedPets = this.data.unlockedPets || ['shiba']);

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
    } else if (category === 'pets') {
      this.data.equippedPet = itemId;
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
      avatarEl.innerText = activeAvatar ? activeAvatar.preview : '🛡️';
    }
    const modalAvatar = document.getElementById('profile-modal-avatar');
    if (modalAvatar) {
      const activeAvatar = this.catalog.avatars.find(a => a.id === this.data.equippedAvatar);
      modalAvatar.innerText = activeAvatar ? activeAvatar.preview : '🛡️';
    }
    const mascotAvatar = document.getElementById('mascot-avatar');
    if (mascotAvatar) {
      const activePet = (this.catalog.pets || []).find(p => p.id === this.data.equippedPet);
      mascotAvatar.innerText = activePet ? activePet.preview : '🐶';
    }
  }
}

window.shopManager = new ShopManager();
