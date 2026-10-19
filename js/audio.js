/**
 * TypeHero 音效合成核心模組 (Web Audio API)
 * 完全離線零外部依賴，支援 4 種自訂鍵盤音效包 (Cherry MX 機械軸、Q彈水晶泡泡、8-bit 電玩、優雅鋼琴)
 * 包含連擊音調音階變化、過關祝賀和弦與金幣音效
 */

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.soundPack = 'mechanical'; // 'mechanical' | 'bubble' | 'arcade' | 'piano'
    this.isMuted = false;
    this.scaleNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]; // 五聲音階
  }

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setSoundPack(packName) {
    this.soundPack = packName;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * 敲擊音效路由
   * @param {string} keyType - 'std' | 'space' | 'special'
   * @param {number} combo - 當前連擊數，用於升調
   */
  playKey(keyType = 'std', combo = 0) {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    if (keyType === 'space') {
      this.playSpaceThud();
      return;
    }

    switch (this.soundPack) {
      case 'bubble':
        this.playBubbleSound(combo);
        break;
      case 'wood':
        this.playWoodSound(combo);
        break;
      case 'arcade':
        this.playArcadeSound(combo);
        break;
      case 'waterdrop':
        this.playWaterDropSound(combo);
        break;
      case 'piano':
        this.playPianoNote(combo);
        break;
      case 'laser':
        this.playLaserSound(combo);
        break;
      case 'chime':
        this.playChimeSound(combo);
        break;
      case 'mechanical':
      default:
        this.playMechanicalClick();
        break;
    }
  }

  /**
   * 1. 仿真 Cherry MX 機械青軸聲學模型 (雙階段段落聲 + 觸底回音 + 彈簧微震)
   */
  playMechanicalClick() {
    const now = this.audioCtx.currentTime;

    // A. 尖銳金屬簧片段落音 (Click)
    const oscClick = this.audioCtx.createOscillator();
    const gainClick = this.audioCtx.createGain();
    oscClick.type = 'triangle';
    oscClick.frequency.setValueAtTime(1800, now);
    oscClick.frequency.exponentialRampToValueAtTime(4200, now + 0.005);
    gainClick.gain.setValueAtTime(0.18, now);
    gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
    oscClick.connect(gainClick);
    gainClick.connect(this.audioCtx.destination);
    oscClick.start(now);
    oscClick.stop(now + 0.01);

    // B. PBT 鍵帽觸底敲擊聲 (Thud)
    const oscThud = this.audioCtx.createOscillator();
    const gainThud = this.audioCtx.createGain();
    const filterThud = this.audioCtx.createBiquadFilter();
    oscThud.type = 'sine';
    oscThud.frequency.setValueAtTime(260, now);
    oscThud.frequency.exponentialRampToValueAtTime(120, now + 0.035);
    filterThud.type = 'lowpass';
    filterThud.frequency.setValueAtTime(400, now);
    gainThud.gain.setValueAtTime(0.22, now);
    gainThud.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    oscThud.connect(filterThud);
    filterThud.connect(gainThud);
    gainThud.connect(this.audioCtx.destination);
    oscThud.start(now);
    oscThud.stop(now + 0.045);
  }

  /**
   * 空白鍵大平衡桿深沉腔體音
   */
  playSpaceThud() {
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * 2. Q 彈水晶泡泡音 (Bubble Pop)
   */
  playBubbleSound(combo = 0) {
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    // 隨著連擊數稍微提高泡泡音高
    const baseFreq = 480 + Math.min(combo * 15, 600);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.04);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  /**
   * 3. 8-bit 復古電玩音 (Retro Arcade Square Wave)
   */
  playArcadeSound(combo = 0) {
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    const noteIdx = combo % this.scaleNotes.length;
    const freq = this.scaleNotes[noteIdx];

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.setValueAtTime(freq * 1.5, now + 0.02);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  /**
   * 4. 優雅鋼琴單音 (Piano Tone)
   */
  playPianoNote(combo = 0) {
    const now = this.audioCtx.currentTime;
    const noteIdx = combo % this.scaleNotes.length;
    const freq = this.scaleNotes[noteIdx];

    // 基頻 + 諧波
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  /**
   * 5. 原木敲擊響板 (Wooden Clack / Marimba)
   */
  playWoodSound(combo = 0) {
    const now = this.audioCtx.currentTime;
    const noteIdx = combo % this.scaleNotes.length;
    const freq = this.scaleNotes[noteIdx] * 1.25;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.04);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.1, now);
    filter.Q.setValueAtTime(4.5, now);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * 6. 空靈清澈水滴 (Zen Water Drop)
   */
  playWaterDropSound(combo = 0) {
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    const baseFreq = 1050 + (combo % 8) * 65;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.15, now + 0.042);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * 7. 未來雷射光束 (Sci-Fi Laser Blaster)
   */
  playLaserSound(combo = 0) {
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    const startFreq = 2600 + (combo % 6) * 110;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.05);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  /**
   * 8. 夢幻水晶風鈴 (Dreamy Crystal Chime / Celesta)
   */
  playChimeSound(combo = 0) {
    const now = this.audioCtx.currentTime;
    const noteIdx = combo % this.scaleNotes.length;
    const freq = this.scaleNotes[noteIdx] * 2.0;

    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.76, now); // 高次諧波泛音

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  }

  /**
   * 打錯字時的溫和提示音 (Educational gentle buzz, 不刺耳)
   */
  playError() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.09);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * 獲得金幣音效 (Coin Ping)
   */
  playCoin() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.06); // E6

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * 達成三星通關祝賀和弦 (Victory Fanfare)
   */
  playFanfare() {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const now = this.audioCtx.currentTime + idx * 0.08;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    });
  }
}

// 建立全局音效實例
window.soundEngine = new SoundEngine();
