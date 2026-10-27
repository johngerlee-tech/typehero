/**
 * TypeHero - 教學管理與教師後臺系統核心邏輯 (admin.js)
 * 涵蓋 Google 帳號授權登入、教師/管理員身分權限分級、
 * 課堂指定班級特訓題目發布、學生密碼查閱與修改、全校班級設定。
 */

/**
 * 安全過濾 HTML 特殊字元防止 XSS 與 undefined 錯誤
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  let adminRole = null; // 'teacher' | 'master_admin' | null
  let currentAuthUser = null;
  let showPasswords = false;
  let rosterMap = new Map();
  let parsed115Roster = [];

  // DOM 元素快取
  const loginView = document.getElementById('admin-login-view');
  const workspaceView = document.getElementById('admin-workspace');
  const userInfoPill = document.getElementById('admin-user-info-pill');
  const userAvatar = document.getElementById('admin-user-avatar');
  const userName = document.getElementById('admin-user-name');
  const userEmail = document.getElementById('admin-user-email');
  const userRoleBadge = document.getElementById('admin-user-role-badge');
  const logoutBtn = document.getElementById('admin-btn-logout');

  // 初始化班級下拉選單
  if (window.cloudSync) {
    window.cloudSync.populateClassSelects();
  }

  // 需求 1: 返回打字學院超連結處理 (target="_Parent"，若由前台打字頁開啟新分頁則自動聚焦原視窗並關閉本管理頁，避免重複多開)
  const returnLinks = document.querySelectorAll('a[href="index.html"]');
  returnLinks.forEach(link => {
    link.setAttribute('target', '_Parent');
    link.addEventListener('click', (e) => {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.focus();
          window.close();
          e.preventDefault();
        } catch (err) {
          // 若無法 close，則依預設 target="_Parent" 導向原頁面
        }
      }
    });
  });

  // =========================================================================
  // 1. 身分驗證模組 (Google Auth 教師登入 & 最高管理員密碼登入)
  // =========================================================================

  // A. Google 帳號登入 (需求 7: 本校老師註冊與登入)
  const btnGoogleLogin = document.getElementById('btn-google-login');
  if (btnGoogleLogin) {
    btnGoogleLogin.onclick = async () => {
      try {
        btnGoogleLogin.disabled = true;
        btnGoogleLogin.innerHTML = '<span>🔄 正在呼叫 Google 授權視窗...</span>';

        let user = null;
        if (window.cloudSync && typeof window.cloudSync.signInWithGoogle === 'function') {
          user = await window.cloudSync.signInWithGoogle();
        } else {
          // 備援直接呼叫 Firebase Auth (防止因瀏覽器快取導致舊版 signInWithGoogle 函式未載入)
          if (!window.firebase || !window.firebase.auth) {
            throw new Error('Firebase Auth 模組尚未載入完成，請重新整理網頁！');
          }
          if (!firebase.apps.length) {
            const cfg = (window.cloudSync && window.cloudSync.config) || window.DEFAULT_FIREBASE_CONFIG || {
              apiKey: "AIzaSyDWbWFjGra5ul1mShoMbHm26SOIqyz_cSI",
              authDomain: "typehero-1c28f.firebaseapp.com",
              projectId: "typehero-1c28f",
              storageBucket: "typehero-1c28f.firebasestorage.app",
              messagingSenderId: "557883116904",
              appId: "1:557883116904:web:ed55d47dfb9780e47bdadd",
              measurementId: "G-D6C1TXC226"
            };
            firebase.initializeApp(cfg);
          }
          const auth = firebase.auth();
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          const result = await auth.signInWithPopup(provider);
          user = result.user;

          // 登記教師身分至 Firestore (若資料庫可用)
          if (window.firebase.firestore && firebase.apps.length) {
            try {
              const db = firebase.firestore();
              await db.collection('teachers').doc(user.uid).set({
                uid: user.uid,
                name: user.displayName || '本校老師',
                email: user.email || '',
                photoURL: user.photoURL || '',
                role: 'teacher',
                schoolName: '溪洲國小',
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            } catch (e) {
              console.warn('登記教師資訊警告:', e);
            }
          }
        }

        if (!user) {
          throw new Error('未取得授權使用者資訊，請重試！');
        }

        // 查詢該 Google 帳號在雲端是否已通過通關密語審核 (approved === true)
        let teacherRecord = null;
        if (window.cloudSync && window.cloudSync.getTeacherStatus) {
          teacherRecord = await window.cloudSync.getTeacherStatus(user.uid);
        } else if (window.firebase && window.firebase.firestore && firebase.apps.length) {
          try {
            const doc = await firebase.firestore().collection('teachers').doc(user.uid).get();
            if (doc.exists) teacherRecord = doc.data();
          } catch (e) {}
        }

        // 若該 Google 帳號先前已成功通過通關密碼授權，直接進入教師後臺！
        if (teacherRecord && teacherRecord.approved === true) {
          if (window.cloudSync && window.cloudSync.approveTeacher) {
            await window.cloudSync.approveTeacher(user);
          }
          handleLoginSuccess({
            name: user.displayName || teacherRecord.name || '本校老師',
            email: user.email || teacherRecord.email || 'Google 認證教師',
            photoURL: user.photoURL || teacherRecord.photoURL || '',
            role: 'teacher'
          });
          return;
        }

        // 尚未通過通關密語驗證 (新註冊或先前被管理者刪除者)，開啟通關密碼彈窗
        promptTeacherPasscodeModal(user);

      } catch (err) {
        console.warn('Google 登入失敗或取消:', err);
        let msg = err.message || '登入失敗';
        const hostname = window.location.hostname || '此網域';
        if (err.code === 'auth/popup-closed-by-user') {
          msg = '您已關閉 Google 授權視窗。';
        } else if (err.code === 'auth/unauthorized-domain') {
          msg = `【Firebase 授權網域未設定】\n您目前的網域「${hostname}」尚未加入 Firebase 授權名單。\n\n💡 設定方法：\n請至 Firebase 控制台 (console.firebase.google.com)\n➔ Authentication (身分驗證)\n➔ Settings (設定) 標籤頁\n➔ Authorized domains (已授權的網域)\n➔ 點擊「新增網域」並輸入：「${hostname}」即可！`;
        } else if (err.code === 'auth/operation-not-allowed') {
          msg = '【尚未啟用 Google 登入提供者】\n請至 Firebase 控制台 ➔ Authentication ➔ Sign-in method 啟用「Google」登入提供者！';
        } else if (err.code === 'auth/popup-blocked') {
          msg = 'Google 登入視窗被瀏覽器阻擋，請在網址列點擊允許彈出式視窗後重試！';
        } else if (err.code === 'auth/operation-not-supported-in-this-environment') {
          msg = '本機環境 (file://) 限制跨網域彈窗，請透過 HTTP/HTTPS (例如 GitHub Pages 或本機伺服器) 開啟進行 Google 登入！';
        }
        alert(`⚠️ ${msg}`);
      } finally {
        btnGoogleLogin.disabled = false;
        btnGoogleLogin.innerHTML = '<span>🌐 使用 Google 帳號登入 / 註冊</span>';
      }
    };
  }

  // B. 系統最高管理員密碼登入
  const formAdminPwd = document.getElementById('form-admin-pwd-login');
  const inputAdminPwd = document.getElementById('input-admin-pwd-login');
  const pwdErrorEl = document.getElementById('login-pwd-error');

  if (formAdminPwd) {
    formAdminPwd.onsubmit = (e) => {
      e.preventDefault();
      const entered = inputAdminPwd ? inputAdminPwd.value.trim() : '';
      const isCorrect = window.cloudSync ? window.cloudSync.verifyAdminPassword(entered) : (entered === '1234');

      if (isCorrect) {
        if (pwdErrorEl) pwdErrorEl.style.display = 'none';
        handleLoginSuccess({
          name: '系統最高管理員',
          email: 'admin@system',
          photoURL: '',
          role: 'master_admin'
        });
      } else {
        if (pwdErrorEl) pwdErrorEl.style.display = 'block';
        if (inputAdminPwd) inputAdminPwd.focus();
      }
    };
  }

  // 登入成功後身分設定與畫面切換
  function handleLoginSuccess(userProfile) {
    adminRole = userProfile.role;
    currentAuthUser = userProfile;

    // 更新 Header 使用者指示器
    if (userName) userName.innerText = userProfile.name;
    if (userEmail) userEmail.innerText = userProfile.email;
    if (userAvatar) {
      if (userProfile.photoURL) {
        userAvatar.src = userProfile.photoURL;
        userAvatar.style.display = 'block';
      } else {
        userAvatar.style.display = 'none';
      }
    }

    if (userRoleBadge) {
      if (adminRole === 'master_admin') {
        userRoleBadge.className = 'role-badge admin';
        userRoleBadge.innerText = '👑 系統最高管理員';
      } else {
        userRoleBadge.className = 'role-badge teacher';
        userRoleBadge.innerText = '🏫 授課教師';
      }
    }

    if (userInfoPill) userInfoPill.style.display = 'flex';
    if (loginView) loginView.style.display = 'none';
    if (workspaceView) workspaceView.style.display = 'block';

    // 依據角色套用權限限制 (需求 7: 教師不能修改班級名稱、不能清空紀錄)
    applyRolePermissions(adminRole);

    // 載入資料庫診斷、特訓題目、通關門檻與名冊
    runFirebaseDiagnostic();
    loadPublishedLessonsList();
    renderAdminLeaderboard();
    renderClassTags();
    loadStudentsRoster();
    refreshPassAccuracyUI();

    // 需求 4: 介面載入時即自動在背景進行既有資料與真實姓名綁定
    autoSyncRosterOnLoad();
  }

  // 登出邏輯
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (window.cloudSync && window.cloudSync.signOut) {
        await window.cloudSync.signOut();
      }
      adminRole = null;
      currentAuthUser = null;
      if (userInfoPill) userInfoPill.style.display = 'none';
      if (workspaceView) workspaceView.style.display = 'none';
      if (loginView) loginView.style.display = 'block';
      if (inputAdminPwd) inputAdminPwd.value = '';
    };
  }

  // =========================================================================
  // 2. 角色權限分級防護控制 (需求 7)
  // =========================================================================
  function applyRolePermissions(role) {
    const isTeacher = (role === 'teacher');

    // 卡片 3: 學校班級名稱清單維護
    const cardClass = document.getElementById('card-class-settings');
    const noticeClassLocked = document.getElementById('notice-class-locked');
    const badgeClassRole = document.getElementById('badge-class-settings-role');
    const newClassInp = document.getElementById('admin-new-class-input');
    const addClassBtn = document.getElementById('admin-add-class-btn');
    const toggleBatchBtn = document.getElementById('admin-btn-toggle-batch');
    const resetClassesBtn = document.getElementById('admin-btn-reset-classes');
    const saveBatchBtn = document.getElementById('admin-btn-save-batch');

    // 卡片 4: 排行榜清空與主管理密碼修改
    const cardSecurity = document.getElementById('card-security-settings');
    const noticeSecurityLocked = document.getElementById('notice-security-locked');
    const badgeSecurityRole = document.getElementById('badge-security-role');
    const clearLbBtn = document.getElementById('admin-btn-clear-leaderboard');
    const newPwdInp = document.getElementById('admin-new-password');
    const savePwdBtn = document.getElementById('admin-btn-save-password');
    const pwdHint = document.getElementById('admin-current-pwd-hint');

    // 通關密語控制項
    const teacherPasscodeInp = document.getElementById('admin-input-teacher-passcode');
    const saveTeacherPasscodeBtn = document.getElementById('admin-btn-save-teacher-passcode');
    const teacherPasscodeHint = document.getElementById('admin-current-teacher-passcode-hint');

    // 卡片 5: 本校已授權教師帳號名單管理
    const cardTeachers = document.getElementById('card-teachers-management');
    const noticeTeachersLocked = document.getElementById('notice-teachers-locked');
    const badgeTeachersRole = document.getElementById('badge-teachers-role');
    const refreshTeachersBtn = document.getElementById('admin-btn-refresh-teachers');

    // 卡片 6: 學年度編班名冊與學生資產升級移轉精靈
    const cardMigration = document.getElementById('card-roster-migration');
    const noticeMigrationLocked = document.getElementById('notice-migration-locked');
    const badgeMigrationRole = document.getElementById('badge-migration-role');
    const btnExecute115 = document.getElementById('btn-execute-115-binding');
    const btnExecuteMigration = document.getElementById('btn-execute-migration');
    const btnSyncClasses = document.getElementById('btn-sync-115-classes');

    // 需求 1: "教師登入"後台只需看到"教師完全可用"的區塊部分即可，"👑 具備完全權限"反正不能操作就完全隱藏不顯示
    if (isTeacher) {
      if (cardClass) cardClass.style.display = 'none';
      if (cardSecurity) cardSecurity.style.display = 'none';
      if (cardTeachers) cardTeachers.style.display = 'none';
      if (cardMigration) cardMigration.style.display = 'none';
    } else {
      if (cardClass) {
        cardClass.style.display = '';
        cardClass.classList.remove('locked-card');
      }
      if (noticeClassLocked) noticeClassLocked.style.display = 'none';
      if (badgeClassRole) badgeClassRole.innerText = '👑 具備完全權限';
      if (newClassInp) newClassInp.disabled = false;
      if (addClassBtn) addClassBtn.disabled = false;
      if (toggleBatchBtn) toggleBatchBtn.disabled = false;
      if (resetClassesBtn) resetClassesBtn.disabled = false;
      if (saveBatchBtn) saveBatchBtn.disabled = false;

      if (cardSecurity) {
        cardSecurity.style.display = '';
        cardSecurity.classList.remove('locked-card');
      }
      if (noticeSecurityLocked) noticeSecurityLocked.style.display = 'none';
      if (badgeSecurityRole) badgeSecurityRole.innerText = '👑 具備完全權限';
      if (clearLbBtn) clearLbBtn.disabled = false;
      if (newPwdInp) newPwdInp.disabled = false;
      if (savePwdBtn) savePwdBtn.disabled = false;
      if (pwdHint && window.cloudSync) pwdHint.innerText = window.cloudSync.getAdminPassword();

      if (teacherPasscodeInp) teacherPasscodeInp.disabled = false;
      if (saveTeacherPasscodeBtn) saveTeacherPasscodeBtn.disabled = false;
      if (teacherPasscodeHint && window.cloudSync) {
        const curCode = window.cloudSync.getTeacherPasscode();
        teacherPasscodeHint.innerText = curCode;
        if (teacherPasscodeInp) teacherPasscodeInp.value = curCode;
      }

      if (cardTeachers) {
        cardTeachers.style.display = '';
        cardTeachers.classList.remove('locked-card');
      }
      if (noticeTeachersLocked) noticeTeachersLocked.style.display = 'none';
      if (badgeTeachersRole) badgeTeachersRole.innerText = '👑 具備完全權限';
      if (refreshTeachersBtn) refreshTeachersBtn.disabled = false;
      loadTeachersList();

      if (cardMigration) {
        cardMigration.style.display = '';
      }
      if (noticeMigrationLocked) noticeMigrationLocked.style.display = 'none';
      if (badgeMigrationRole) badgeMigrationRole.innerText = '👑 具備完全權限';
      if (btnExecute115) btnExecute115.disabled = false;
      if (btnExecuteMigration) btnExecuteMigration.disabled = false;

  // =========================================================================
  // 全校名冊記憶庫與自動綁定引擎 (需求 4)
  // =========================================================================
  function initRosterData() {
    try {
      parsed115Roster = parseRosterCSV(DEFAULT_115_ROSTER_CSV);
      rosterMap.clear();
      parsed115Roster.forEach(s => {
        rosterMap.set(`${s.className}_${s.seatNumber}`, s);
      });
      console.log(`📋 [全校名冊記憶庫] 已成功預載 115 學年度全校名冊，共 ${rosterMap.size} 筆學生學籍`);
    } catch (e) {
      console.warn('預載名冊失敗:', e);
    }

    // 嘗試非同步載入最新的 student_115.csv
    fetch('student_115.csv').then(resp => {
      if (resp.ok) return resp.text();
      throw new Error('No local csv file');
    }).then(text => {
      const fresh = parseRosterCSV(text);
      if (fresh && fresh.length > 0) {
        parsed115Roster = fresh;
        rosterMap.clear();
        parsed115Roster.forEach(s => {
          rosterMap.set(`${s.className}_${s.seatNumber}`, s);
        });
        console.log(`📋 [全校名冊即時更新] 已同步 student_115.csv 最新名冊 (${rosterMap.size} 筆)`);
      }
    }).catch(() => {});
  }

  async function autoSyncRosterOnLoad() {
    if (!window.cloudSync || !window.cloudSync.isFirebaseReady) return;
    try {
      if (!parsed115Roster || parsed115Roster.length === 0) {
        initRosterData();
      }
      if (!parsed115Roster || parsed115Roster.length === 0) return;

      const syncKey = 'typehero_roster_auto_synced_115_v2';
      const lastSync = localStorage.getItem(syncKey);
      const now = Date.now();
      if (lastSync && (now - Number(lastSync) < 12 * 60 * 60 * 1000)) {
        console.log('ℹ️ 全校名冊身分綁定近期已同步過，維持即時智慧補齊。');
        return;
      }

      console.log('🚀 [自動身分綁定] 正在為全校學生名冊自動執行 Firestore 身分綁定...');
      const res = await window.cloudSync.bindStudentRoster(parsed115Roster, () => {});
      if (res && res.success) {
        localStorage.setItem(syncKey, String(now));
        console.log(`✅ [自動身分綁定完成] 成功自動補齊 ${res.matchedCount || parsed115Roster.length} 筆學生身分綁定！`);
      }
    } catch (err) {
      console.warn('背景自動名冊身分綁定遭遇問題:', err);
    }
  }

  // 頁面就緒時立即預載名冊
  initRosterData();

      if (btnSyncClasses) btnSyncClasses.disabled = false;
    }
  }

  // =========================================================================
  // 3. Firebase 雲端連線診斷
  // =========================================================================
  const btnPing = document.getElementById('admin-btn-ping');
  const pingStatusEl = document.getElementById('admin-db-ping-status');

  async function runFirebaseDiagnostic() {
    if (!pingStatusEl) return;
    pingStatusEl.innerHTML = '<span style="color:#38bdf8; font-weight:bold;">🔄 正在連線測試中...</span>';

    if (!window.cloudSync) {
      pingStatusEl.innerText = '❌ CloudSyncManager 未載入';
      return;
    }

    const res = await window.cloudSync.testConnection();
    if (res.success) {
      pingStatusEl.innerHTML = `
        <span style="color:#10b981; font-weight:bold;">🟢 雲端資料庫連線暢通！</span>
        伺服器響應延遲：<strong>${res.ping} ms</strong> · 專案：<code>${res.projectId}</code>
      `;
    } else {
      pingStatusEl.innerHTML = `
        <span style="color:#ef4444; font-weight:bold;">⚠️ 雲端連線異常：</span>
        ${res.reason || '連線逾時'}
      `;
    }
  }

  if (btnPing) btnPing.onclick = runFirebaseDiagnostic;

  // =========================================================================
  
  // =========================================================================
  // 3. 班級/全校即時打字排行榜總覽 (上課教師完全可用)
  // =========================================================================
  const adminLeaderboardSelect = document.getElementById('admin-leaderboard-class-select');
  const adminLeaderboardContainer = document.getElementById('admin-leaderboard-table-container');
  const adminLeaderboardCount = document.getElementById('admin-leaderboard-count');
  const adminBtnRefreshLeaderboard = document.getElementById('admin-btn-refresh-leaderboard');

  async function renderAdminLeaderboard() {
    if (!adminLeaderboardContainer) return;
    const selectedClass = adminLeaderboardSelect ? adminLeaderboardSelect.value : 'all';
    adminLeaderboardContainer.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem;">正在載入排行榜資料...</div>';

    if (!window.cloudSync) {
      adminLeaderboardContainer.innerHTML = '<div style="text-align:center; padding:1.5rem; color:#ef4444; font-size:0.8rem;">雲端模組未載入</div>';
      return;
    }

    if (selectedClass === 'all') {
      // 全校排行榜
      const rawList = await window.cloudSync.fetchTopScores(50);
      const list = Array.isArray(rawList) ? rawList : [];
      if (adminLeaderboardCount) adminLeaderboardCount.innerText = list.length;

      if (list.length === 0) {
        adminLeaderboardContainer.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem;">目前尚無打字挑戰成績紀錄。</div>';
        return;
      }

      let html = `
        <table class="students-table" style="font-size:0.78rem;">
          <thead>
            <tr>
              <th style="width:45px; text-align:center;">名次</th>
              <th style="width:80px;">班級座號</th>
              <th>學生英雄</th>
              <th style="width:70px; text-align:center;">打字速度</th>
              <th style="width:60px; text-align:center;">準確率</th>
              <th>挑戰關卡</th>
            </tr>
          </thead>
          <tbody>
      `;

      list.forEach((item, idx) => {
        let rankBadge = `${idx + 1}`;
        if (idx === 0) rankBadge = '🥇 1';
        else if (idx === 1) rankBadge = '🥈 2';
        else if (idx === 2) rankBadge = '🥉 3';

        const seatClean = item.seatNumber ? String(item.seatNumber).trim() : '';
        const classSeat = `${item.className || '全校'} ${seatClean ? seatClean + '號' : ''}`;
        
        // 嘗試自本機學籍名冊比對真實姓名
        let realName = '';
        if (item.className && seatClean && rosterMap && rosterMap.has(`${item.className}_${seatClean}`)) {
          realName = rosterMap.get(`${item.className}_${seatClean}`).realName;
        }

        const nickname = item.nickname || '';
        let heroDisplay = '';
        if (realName && nickname && realName !== nickname) {
          heroDisplay = `<span style="font-weight:700; color:var(--text-main);">${escapeHtml(realName)}</span> <span style="color:var(--brand-primary); font-size:0.72rem;">(${escapeHtml(nickname)})</span>`;
        } else {
          heroDisplay = `<span style="font-weight:700; color:var(--brand-primary);">${escapeHtml(nickname || realName || '打字英雄')}</span>`;
        }

        const wpmVal = Math.round(Number(item.wpm) || 0);
        const accVal = Math.round(Number(item.accuracy) || 0);

        html += `
          <tr>
            <td style="text-align:center; font-weight:800; color:${idx < 3 ? '#fbbf24' : 'var(--text-muted)'}; font-size:0.82rem;">
              ${rankBadge}
            </td>
            <td style="font-weight:bold; color:var(--text-main); font-size:0.75rem;">
              ${escapeHtml(classSeat)}
            </td>
            <td>
              ${heroDisplay}
            </td>
            <td style="text-align:center; font-weight:800; color:#38bdf8; font-size:0.85rem;">
              ${wpmVal} <span style="font-size:0.65rem; color:var(--text-muted);">WPM</span>
            </td>
            <td style="text-align:center; font-weight:bold; color:${accVal >= 95 ? '#10b981' : 'var(--text-main)'};">
              ${accVal}%
            </td>
            <td style="color:var(--text-muted); font-size:0.72rem; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(item.lessonTitle || '綜合特訓')}
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      adminLeaderboardContainer.innerHTML = html;
    } else {
      // 指定班級排行榜
      const list = await window.cloudSync.fetchClassRankings(selectedClass);
      const studentList = Array.isArray(list) ? list : [];
      if (adminLeaderboardCount) adminLeaderboardCount.innerText = studentList.length;

      if (studentList.length === 0) {
        adminLeaderboardContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem;">【${escapeHtml(selectedClass)}】目前尚無學生登入或測驗資料。</div>`;
        return;
      }

      let html = `
        <table class="students-table" style="font-size:0.78rem;">
          <thead>
            <tr>
              <th style="width:45px; text-align:center;">名次</th>
              <th style="width:55px; text-align:center;">座號</th>
              <th>學生身分</th>
              <th style="width:70px; text-align:center;">最佳速度</th>
              <th style="width:60px; text-align:center;">準確率</th>
              <th style="width:85px; text-align:center;">等級/星幣</th>
            </tr>
          </thead>
          <tbody>
      `;

      studentList.forEach((item, idx) => {
        let rankBadge = `${idx + 1}`;
        if (item.hasScore) {
          if (idx === 0) rankBadge = '🥇 1';
          else if (idx === 1) rankBadge = '🥈 2';
          else if (idx === 2) rankBadge = '🥉 3';
        } else {
          rankBadge = '-';
        }

        const seatStr = `${item.seatNumber}號`;
        const studentName = item.realName || item.displayName || seatStr;
        const wpmDisplay = item.hasScore
          ? `<strong style="color:#38bdf8; font-size:0.85rem;">${item.wpm}</strong> <span style="font-size:0.65rem; color:var(--text-muted);">WPM</span>`
          : `<span style="color:var(--text-muted); font-size:0.72rem;">未測驗</span>`;

        const accDisplay = item.hasScore
          ? `<span style="font-weight:bold; color:${item.accuracy >= 95 ? '#10b981' : 'var(--text-main)'};">${item.accuracy}%</span>`
          : `<span style="color:var(--text-muted);">-</span>`;

        html += `
          <tr>
            <td style="text-align:center; font-weight:800; color:${idx < 3 && item.hasScore ? '#fbbf24' : 'var(--text-muted)'}; font-size:0.82rem;">
              ${rankBadge}
            </td>
            <td style="text-align:center; font-family:monospace; font-weight:bold; color:var(--text-main);">
              ${escapeHtml(seatStr)}
            </td>
            <td>
              <span style="font-weight:700; color:var(--text-main);">${escapeHtml(studentName)}</span>
              ${item.nickname && item.realName ? `<span style="color:var(--brand-primary); font-size:0.7rem; margin-left:3px;">(${escapeHtml(item.nickname)})</span>` : ''}
            </td>
            <td style="text-align:center;">
              ${wpmDisplay}
            </td>
            <td style="text-align:center;">
              ${accDisplay}
            </td>
            <td style="text-align:center; font-size:0.72rem; color:var(--text-muted);">
              Lv.${item.level || 1} · 🪙 ${item.coins || 0}
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      adminLeaderboardContainer.innerHTML = html;
    }
  }

  if (adminLeaderboardSelect) {
    adminLeaderboardSelect.onchange = () => {
      renderAdminLeaderboard();
    };
  }
  if (adminBtnRefreshLeaderboard) {
    adminBtnRefreshLeaderboard.onclick = () => {
      renderAdminLeaderboard();
    };
  }

  // 4. 課堂自訂特訓題目發布 (需求 5: 支援指定班級下拉選單)
  // =========================================================================
  const targetClassSelect = document.getElementById('admin-custom-target-class');
  const customTitleInp = document.getElementById('admin-custom-title');
  const customTextInp = document.getElementById('admin-custom-text');
  const customCharCount = document.getElementById('admin-custom-char-count');
  const btnSaveCustom = document.getElementById('admin-btn-save-custom');
  const btnClearCustom = document.getElementById('admin-btn-clear-custom');
  const publishedLessonsList = document.getElementById('admin-published-lessons-list');
  const btnRefreshLessons = document.getElementById('admin-btn-refresh-lessons');

  // 即時字數統計
  if (customTextInp && customCharCount) {
    customTextInp.oninput = () => {
      customCharCount.innerText = `字數統計：${customTextInp.value.length} 字`;
    };
  }

  // 切換欲發布的班級時，自動載入該班已儲存的特訓草稿
  if (targetClassSelect) {
    targetClassSelect.onchange = async () => {
      const cls = targetClassSelect.value;
      if (window.cloudSync) {
        const lesson = await window.cloudSync.fetchCustomLessonFromCloud(cls);
        if (lesson && lesson.text) {
          if (customTitleInp) customTitleInp.value = lesson.title || '';
          if (customTextInp) customTextInp.value = lesson.text || '';
          if (customCharCount) customCharCount.innerText = `字數統計：${lesson.text.length} 字`;
        } else {
          if (customTitleInp) customTitleInp.value = '';
          if (customTextInp) customTextInp.value = '';
          if (customCharCount) customCharCount.innerText = '字數統計：0 字';
        }
      }
    };
  }

  // 發布課堂特訓
  if (btnSaveCustom) {
    btnSaveCustom.onclick = async () => {
      const targetClass = targetClassSelect ? targetClassSelect.value : 'all';
      const text = customTextInp ? customTextInp.value.trim() : '';
      const defaultTitle = targetClass === 'all' ? '全校今日特訓' : `${targetClass}今日特訓`;
      const title = (customTitleInp ? customTitleInp.value.trim() : '') || defaultTitle;

      if (!text) {
        alert('⚠️ 請輸入特訓題目的內容文字！');
        if (customTextInp) customTextInp.focus();
        return;
      }

      btnSaveCustom.disabled = true;
      btnSaveCustom.innerText = '🚀 正在同步至雲端...';

      const authorName = (currentAuthUser && currentAuthUser.name) ? currentAuthUser.name : '授課教師';
      if (window.cloudSync) {
        await window.cloudSync.saveCustomLessonToCloud(targetClass, title, text, `${targetClass}專屬題目`, authorName);
      }

      btnSaveCustom.disabled = false;
      btnSaveCustom.innerText = '🚀 發布為今日特訓';

      const classNameDisplay = targetClass === 'all' ? '全校所有班級' : targetClass;
      alert(`✅ 成功發布【${classNameDisplay}】的今日特訓題目！\n學生端切換至該班即可直接練習！`);
      loadPublishedLessonsList();
    };
  }

  // 清除特訓
  if (btnClearCustom) {
    btnClearCustom.onclick = async () => {
      const targetClass = targetClassSelect ? targetClassSelect.value : 'all';
      const classNameDisplay = targetClass === 'all' ? '全校所有班級' : targetClass;

      if (confirm(`確定要清除【${classNameDisplay}】目前發布的課堂特訓題目嗎？`)) {
        if (window.cloudSync) {
          await window.cloudSync.deleteCustomLessonFromCloud(targetClass);
        }
        if (customTitleInp) customTitleInp.value = '';
        if (customTextInp) customTextInp.value = '';
        if (customCharCount) customCharCount.innerText = '字數統計：0 字';
        alert(`✅ 已清空【${classNameDisplay}】之自訂特訓！`);
        await loadPublishedLessonsList();
      }
    };
  }

  // 載入全校所有已發布特訓清單
  async function loadPublishedLessonsList() {
    if (!publishedLessonsList) return;
    publishedLessonsList.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:0.4rem;">讀取中...</div>';

    let list = [];
    if (window.cloudSync) {
      list = await window.cloudSync.fetchAllCustomLessonsFromCloud();
    }

    if (!list || list.length === 0) {
      publishedLessonsList.innerHTML = '<div style="color:var(--text-muted); padding:0.35rem;">目前尚未發布任何班級自訂題目。</div>';
      return;
    }

    publishedLessonsList.innerHTML = '';
    list.forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--border-color);
        padding: 0.45rem 0.75rem;
        border-radius: var(--radius-sm);
      `;
      const isAll = item.targetClass === 'all';
      const badgeStyle = isAll ? 'background:rgba(56,189,248,0.2); color:#38bdf8;' : 'background:rgba(16,185,129,0.2); color:#34d399;';

      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem; overflow:hidden;">
          <span style="${badgeStyle} font-weight:800; padding:0.12rem 0.5rem; border-radius:4px; font-size:0.72rem; flex-shrink:0;">
            ${isAll ? '全校共用' : item.targetClass}
          </span>
          <span style="font-weight:bold; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">
            ${item.title || '特訓題目'}
          </span>
          <span style="color:var(--text-muted); font-size:0.7rem;">(${item.text ? item.text.length : 0} 字)</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <button class="btn-secondary btn-load-item" style="font-size:0.72rem; padding:0.2rem 0.55rem;">
            載入編輯
          </button>
          <button class="btn-secondary btn-delete-item" style="font-size:0.72rem; padding:0.2rem 0.55rem; color:#f87171; border-color:rgba(239,68,68,0.4);" title="徹底刪除此特訓題目">
            🗑️ 刪除
          </button>
        </div>
      `;

      row.querySelector('.btn-load-item').onclick = () => {
        if (targetClassSelect) targetClassSelect.value = item.targetClass;
        if (customTitleInp) customTitleInp.value = item.title || '';
        if (customTextInp) {
          customTextInp.value = item.text || '';
          if (customCharCount) customCharCount.innerText = `字數統計：${item.text.length} 字`;
        }
      };

      row.querySelector('.btn-delete-item').onclick = async () => {
        const isAll = item.targetClass === 'all';
        const label = isAll ? '全校共用' : item.targetClass;
        if (!confirm(`確定要徹底刪除【${label}】的課堂特訓題目嗎？\n\n特訓主題：${item.title || '特訓題目'}`)) return;
        if (window.cloudSync) {
          await window.cloudSync.deleteCustomLessonFromCloud(item.targetClass);
        }
        if (targetClassSelect && targetClassSelect.value === item.targetClass) {
          if (customTitleInp) customTitleInp.value = '';
          if (customTextInp) customTextInp.value = '';
          if (customCharCount) customCharCount.innerText = '字數統計：0 字';
        }
        alert(`✅ 已成功刪除【${label}】特訓題目！`);
        await loadPublishedLessonsList();
      };

      publishedLessonsList.appendChild(row);
    });
  }

  if (btnRefreshLessons) btnRefreshLessons.onclick = loadPublishedLessonsList;

  // =========================================================================
  // 5. 學生帳號與通行密碼管理 (需求 7: 查閱班級密碼與協助修改)
  // 加上「班級專屬通關密碼防護」控制 (預設關閉，防冒用與亂入)
  // =========================================================================
  const studentClassSelect = document.getElementById('admin-student-class-select');
  const studentsTableBody = document.getElementById('admin-students-table-body');
  const btnToggleShowPwd = document.getElementById('admin-btn-toggle-show-pwd');
  const btnRefreshStudents = document.getElementById('admin-btn-refresh-students');

  // 班級專屬通關密碼控制元素
  const classPasscodeTargetName = document.getElementById('admin-class-passcode-target-name');
  const classPasscodeBadge = document.getElementById('admin-class-passcode-badge');
  const classPasscodeToggle = document.getElementById('admin-class-passcode-toggle');
  const classPasscodeInputWrap = document.getElementById('admin-class-passcode-input-wrap');
  const classPasscodeInput = document.getElementById('admin-class-passcode-input');
  const btnSaveClassPasscode = document.getElementById('admin-btn-save-class-passcode');
  const classPasscodeStatusMsg = document.getElementById('admin-class-passcode-status-msg');

  function updateClassPasscodeUI(clsName) {
    const targetClass = clsName || (studentClassSelect ? studentClassSelect.value : '');
    if (!targetClass) return;

    if (classPasscodeTargetName) {
      classPasscodeTargetName.innerText = targetClass;
    }

    // 自由測試組永遠免防護
    if (targetClass.includes('測試') || targetClass.includes('體驗')) {
      if (classPasscodeToggle) {
        classPasscodeToggle.checked = false;
        classPasscodeToggle.disabled = true;
      }
      if (classPasscodeInputWrap) classPasscodeInputWrap.style.display = 'none';
      if (classPasscodeBadge) {
        classPasscodeBadge.innerText = '🧪 自由測試組免密碼';
        classPasscodeBadge.style.color = '#38bdf8';
        classPasscodeBadge.style.background = 'rgba(56, 189, 248, 0.15)';
      }
      if (classPasscodeStatusMsg) {
        classPasscodeStatusMsg.style.display = 'block';
        classPasscodeStatusMsg.style.color = '#38bdf8';
        classPasscodeStatusMsg.innerText = '💡 體驗測試組專供自由練習，無需設定班級通關密碼。';
      }
      return;
    }

    if (classPasscodeToggle) {
      classPasscodeToggle.disabled = false;
    }
    if (classPasscodeStatusMsg) classPasscodeStatusMsg.style.display = 'none';

    const info = window.cloudSync ? window.cloudSync.getClassPasscodeInfo(targetClass) : { enabled: false, passcode: '' };

    if (info.enabled && info.passcode) {
      if (classPasscodeToggle) classPasscodeToggle.checked = true;
      if (classPasscodeInputWrap) classPasscodeInputWrap.style.display = 'flex';
      if (classPasscodeInput) classPasscodeInput.value = info.passcode;
      if (classPasscodeBadge) {
        classPasscodeBadge.innerText = `🛡️ 已開啟防護（通關密碼：${info.passcode}）`;
        classPasscodeBadge.style.color = '#34d399';
        classPasscodeBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      }
    } else {
      if (classPasscodeToggle) classPasscodeToggle.checked = false;
      if (classPasscodeInputWrap) classPasscodeInputWrap.style.display = 'none';
      if (classPasscodeInput) classPasscodeInput.value = info.passcode || '';
      if (classPasscodeBadge) {
        classPasscodeBadge.innerText = '預設未開啟 (免通關密碼)';
        classPasscodeBadge.style.color = 'var(--text-muted)';
        classPasscodeBadge.style.background = 'rgba(255, 255, 255, 0.08)';
      }
    }
  }

  // 勾選/取消開關
  if (classPasscodeToggle) {
    classPasscodeToggle.onchange = async () => {
      const targetClass = studentClassSelect ? studentClassSelect.value : '';
      if (!targetClass) return;

      if (classPasscodeToggle.checked) {
        if (classPasscodeInputWrap) classPasscodeInputWrap.style.display = 'flex';
        if (classPasscodeInput) {
          classPasscodeInput.focus();
        }
      } else {
        // 取消勾選直接關閉該班防護
        if (confirm(`確定要關閉【${targetClass}】的專屬通關密碼防護嗎？\n關閉後學生登入該班級將不需輸入班級密碼。`)) {
          if (classPasscodeInputWrap) classPasscodeInputWrap.style.display = 'none';
          if (window.cloudSync) {
            await window.cloudSync.saveClassPasscode(targetClass, false, '');
          }
          updateClassPasscodeUI(targetClass);
          alert(`✅ 已關閉【${targetClass}】之班級通關密碼防護！`);
        } else {
          classPasscodeToggle.checked = true;
        }
      }
    };
  }

  // 點擊儲存密碼按鈕
  if (btnSaveClassPasscode) {
    btnSaveClassPasscode.onclick = async () => {
      const targetClass = studentClassSelect ? studentClassSelect.value : '';
      if (!targetClass) return;
      const code = classPasscodeInput ? classPasscodeInput.value.trim() : '';

      if (!code) {
        alert('⚠️ 請輸入班級通關密碼！');
        if (classPasscodeInput) classPasscodeInput.focus();
        return;
      }

      btnSaveClassPasscode.disabled = true;
      btnSaveClassPasscode.innerText = '💾 儲存中...';

      if (window.cloudSync) {
        await window.cloudSync.saveClassPasscode(targetClass, true, code);
      }

      btnSaveClassPasscode.disabled = false;
      btnSaveClassPasscode.innerText = '💾 儲存班級密碼';

      updateClassPasscodeUI(targetClass);
      alert(`✅ 成功設定【${targetClass}】專屬通關密碼為：[${code}]！\n學生登入該班級前必須輸入此密碼才能進入打字！`);
    };
  }

  if (btnToggleShowPwd) {
    btnToggleShowPwd.onclick = () => {
      showPasswords = !showPasswords;
      btnToggleShowPwd.innerText = showPasswords ? '🙈 隱藏密碼' : '👁️ 顯示/隱藏密碼';
      loadStudentsRoster();
    };
  }

  if (studentClassSelect) {
    studentClassSelect.onchange = () => {
      loadStudentsRoster();
      updateClassPasscodeUI(studentClassSelect.value);
    };
  }
  if (btnRefreshStudents) {
    btnRefreshStudents.onclick = () => {
      loadStudentsRoster();
      if (studentClassSelect) updateClassPasscodeUI(studentClassSelect.value);
    };
  }

  async function loadStudentsRoster() {
    if (!studentsTableBody) return;
    const selectedClass = studentClassSelect ? studentClassSelect.value : (window.cloudSync ? window.cloudSync.classList[0] : '5年3班');
    updateClassPasscodeUI(selectedClass);

    studentsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:1.2rem; color:var(--text-muted);">
          正在讀取【${selectedClass}】學生名冊...
        </td>
      </tr>
    `;

    let students = [];
    if (window.cloudSync && window.cloudSync.fetchClassStudents) {
      students = await window.cloudSync.fetchClassStudents(selectedClass);
    }

    // 需求 4: 自動與名冊即時比對，無縫補齊真實姓名與學號
    if (rosterMap && rosterMap.size > 0) {
      students.forEach(st => {
        const match = rosterMap.get(`${selectedClass}_${st.seatNumber}`);
        if (match) {
          if (!st.realName || st.realName === '未綁定') st.realName = match.realName;
          if (!st.studentNo || st.studentNo === '-') st.studentNo = match.studentNo;
          if (!st.academicYear) st.academicYear = match.academicYear || '115';
        }
      });
    }

    // 若雲端尚未有任何學生註冊紀錄，但名冊有該班學生名單，直接呈現名冊清單
    if ((!students || students.length === 0) && parsed115Roster && parsed115Roster.length > 0) {
      const rosterStudents = parsed115Roster.filter(s => s.className === selectedClass);
      if (rosterStudents.length > 0) {
        students = rosterStudents.map(s => ({
          className: s.className,
          seatNumber: s.seatNumber,
          realName: s.realName,
          studentNo: s.studentNo,
          academicYear: s.academicYear || '115',
          nickname: '',
          level: 1,
          coins: 0,
          password: ''
        }));
      }
    }

    if (!students || students.length === 0) {
      studentsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:1.2rem; color:var(--text-muted);">
            ℹ️【${selectedClass}】目前尚無學生上線註冊紀錄。<br>
            當學生在打字學院首頁登載座號時，將會自動在此處建立專屬檔案與密碼。
          </td>
        </tr>
      `;
      return;
    }

    // 若有學生缺少雲端真實姓名綁定，背景靜默補寫入 Firestore
    if (window.cloudSync && window.cloudSync.db && rosterMap) {
      students.forEach(st => {
        const match = rosterMap.get(`${selectedClass}_${st.seatNumber}`);
        if (match && !st._syncedToDb) {
          st._syncedToDb = true;
          window.cloudSync.db.collection('students').doc(`${selectedClass}_${st.seatNumber}`).set({
            className: selectedClass,
            seatNumber: String(st.seatNumber).trim(),
            realName: match.realName,
            studentNo: match.studentNo,
            academicYear: match.academicYear || '115',
            status: 'active'
          }, { merge: true }).catch(e => console.warn('背景自動補齊學生身分失敗:', e));
        }
      });
    }

    studentsTableBody.innerHTML = '';
    students.forEach(st => {
      const tr = document.createElement('tr');
      const pwdDisplay = showPasswords
        ? (st.password ? `<span class="pwd-code-badge">${st.password}</span>` : '<span style="color:var(--text-muted); font-size:0.75rem;">無密碼</span>')
        : (st.password ? '<span class="pwd-code-badge">••••</span>' : '<span style="color:var(--text-muted); font-size:0.75rem;">無密碼</span>');

      const studentNoDisplay = st.studentNo ? `<code style="color:#38bdf8; font-size:0.78rem; font-weight:bold;">${st.studentNo}</code>` : '<span style="color:var(--text-muted); font-size:0.75rem;">-</span>';
      const realNameDisplay = st.realName ? `<span style="font-weight:bold; color:#fff;">${st.realName}</span>` : '<span style="color:var(--text-muted); font-size:0.75rem;">未綁定</span>';

      tr.innerHTML = `
        <td style="font-weight:bold; font-size:0.92rem; color:var(--text-main);">${st.seatNumber || '0'}</td>
        <td>${studentNoDisplay}</td>
        <td>${realNameDisplay}</td>
        <td style="font-weight:bold; color:var(--brand-primary);">${st.nickname || '<span style="color:var(--text-muted); font-weight:normal;">未設定</span>'}</td>
        <td><span style="background:rgba(99,102,241,0.15); color:#818cf8; padding:0.12rem 0.45rem; border-radius:4px; font-weight:bold; font-size:0.75rem;">Lv.${st.level || 1}</span></td>
        <td class="cell-student-coins" style="color:#fbbf24; font-weight:bold; cursor:pointer;" title="點擊為此學生手動補發或調整星幣">
          <span style="display:inline-flex; align-items:center; gap:2px; padding:0.12rem 0.45rem; border-radius:4px; background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.25);">
            🪙 ${st.coins || 0}
          </span>
        </td>
        <td>${pwdDisplay}</td>
        <td style="text-align:center; white-space:nowrap;">
          <div style="display:flex; gap:0.3rem; justify-content:center; align-items:center; flex-wrap:nowrap;">
            <button class="btn-secondary btn-adjust-coins" style="font-size:0.72rem; padding:0.25rem 0.5rem; border-color:#10b981; color:#34d399; background:rgba(16, 185, 129, 0.12); font-weight:bold;" title="【上課老師可用】增減或補發此學生星幣，即時救援損失或獎勵表現">
              💰 補發金幣
            </button>
            <button class="btn-secondary btn-modify-pwd" style="font-size:0.72rem; padding:0.25rem 0.45rem; border-color:var(--brand-primary); color:var(--brand-primary);" title="協助學生重設通行密碼">
              ✏️ 改密碼
            </button>
            <button class="btn-secondary btn-unbind-student" style="font-size:0.72rem; padding:0.25rem 0.5rem; border-color:#f59e0b; color:#fbbf24; background:rgba(245, 158, 11, 0.12); font-weight:bold;" title="【上課老師可用】解除他人冒用綁定，清空密碼與暱稱讓原座號學生重新登入">
              🔓 解除綁定
            </button>
            <button class="btn-secondary btn-delete-student" style="font-size:0.72rem; padding:0.25rem 0.45rem; border-color:rgba(239, 68, 68, 0.5); color:#f87171; background:rgba(239, 68, 68, 0.08);" title="刪除此座號之雲端存檔">
              🗑️ 刪除
            </button>
          </div>
        </td>
      `;

      // 0. 點擊「補發金幣」按鈕或星幣儲存格
      const handleOpenCoinsModal = () => {
        openStudentCoinsModal(selectedClass, st);
      };
      const btnCoins = tr.querySelector('.btn-adjust-coins');
      if (btnCoins) btnCoins.onclick = handleOpenCoinsModal;
      const cellCoins = tr.querySelector('.cell-student-coins');
      if (cellCoins) cellCoins.onclick = handleOpenCoinsModal;

      // 1. 點擊「修改密碼」彈窗迅速為學生重設
      tr.querySelector('.btn-modify-pwd').onclick = async () => {
        const studentDesc = `${selectedClass} ${st.seatNumber}號 ${st.realName ? st.realName + ' ' : ''}(${st.nickname || '學生'})`;
        const newPass = prompt(`請輸入【${studentDesc}】的新通行密碼：\n(目前密碼：${st.password || '無'})`, st.password || '');
        if (newPass !== null && newPass.trim() !== '') {
          const clean = newPass.trim();
          if (window.cloudSync) {
            const ok = await window.cloudSync.adminUpdateStudentPassword(selectedClass, st.seatNumber, clean);
            if (ok) {
              alert(`✅ 成功！已將【${studentDesc}】的通行密碼修改為：${clean}`);
              loadStudentsRoster();
            } else {
              alert('❌ 修改失敗，請確認網路連線。');
            }
          }
        }
      };

      // 2. 點擊「解除綁定」 (需求 2: 解除別人亂使用該座號的綁定)
      tr.querySelector('.btn-unbind-student').onclick = async () => {
        const studentDesc = `${selectedClass} ${st.seatNumber}號 ${st.realName ? st.realName + ' ' : ''}`;
        const confirmMsg = `確定要為【${studentDesc}】解除身分綁定嗎？\n\n🎯 上課教師即時處置情境：\n當學生座號遭其他非本班同學或他人亂登入占用時，授課教師可立即執行此解除綁定！\n\n執行後將會：\n1. 立即清空該座號被亂設定的通行密碼、自訂暱稱與累積星幣（星幣歸 0，原座號同學當場可重新自由登入並設定密碼）\n2. 100% 完整保留原本校內名冊記載之「真實姓名」與「學號」學籍\n3. 重設該座號的冒用累積紀錄\n\n確定立即解除冒用綁定？`;
        if (!confirm(confirmMsg)) return;

        if (window.cloudSync && window.cloudSync.adminUnbindStudent) {
          const ok = await window.cloudSync.adminUnbindStudent(selectedClass, st.seatNumber, st.realName, st.studentNo);
          if (ok) {
            alert(`✅ 成功！已解除【${studentDesc}】的冒用綁定！\n密碼與自訂暱稱已清除，原座號同學現在可以正常重新登入了。`);
            loadStudentsRoster();
          } else {
            alert('❌ 解除綁定失敗，請確認 Firebase 網路連線。');
          }
        }
      };

      // 3. 點擊「刪除」 (需求 2: 徹底刪除指定座號檔案)
      tr.querySelector('.btn-delete-student').onclick = async () => {
        const studentDesc = `${selectedClass} ${st.seatNumber}號 ${st.realName ? st.realName + ' ' : ''}(${st.nickname || '無暱稱'})`;
        const confirmMsg = `⚠️ 警告：確定要徹底「刪除」【${studentDesc}】的雲端學生存檔紀錄嗎？\n\n刪除後該座號之所有雲端紀錄（含星幣、等級與密碼）將被永久移除。\n（若僅是被他人冒用登入，建議使用「解除綁定」即可）\n\n確定徹底刪除？`;
        if (!confirm(confirmMsg)) return;

        if (window.cloudSync && window.cloudSync.adminDeleteStudent) {
          const ok = await window.cloudSync.adminDeleteStudent(selectedClass, st.seatNumber);
          if (ok) {
            alert(`✅ 已成功刪除【${studentDesc}】之雲端檔案！`);
            loadStudentsRoster();
          } else {
            alert('❌ 刪除失敗，請確認 Firebase 網路連線。');
          }
        }
      };

      studentsTableBody.appendChild(tr);
    });
  }

  // =========================================================================
  // 5.5 學生星幣補發與手動調整功能（授課教師與最高管理員完全可用）
  // =========================================================================
  let activeStudentForCoins = null;
  let activeCoinMode = 'add'; // 'add' | 'set' | 'subtract'

  function openStudentCoinsModal(className, student) {
    activeStudentForCoins = { className, ...student };
    activeCoinMode = 'add';

    const modal = document.getElementById('modal-adjust-coins');
    const descEl = document.getElementById('adjust-coins-student-desc');
    const levelEl = document.getElementById('adjust-coins-student-level');
    const noEl = document.getElementById('adjust-coins-student-no');
    const nickEl = document.getElementById('adjust-coins-student-nick');
    const curValEl = document.getElementById('adjust-coins-current-val');
    const inputVal = document.getElementById('input-adjust-coins-val');

    const displayName = student.realName ? `${student.realName} (${student.nickname || '無暱稱'})` : (student.nickname || '學員');
    if (descEl) descEl.innerText = `${className} ${student.seatNumber}號 ${displayName}`;
    if (levelEl) levelEl.innerText = `Lv.${student.level || 1}`;
    if (noEl) noEl.innerText = student.studentNo || '-';
    if (nickEl) nickEl.innerText = student.nickname || '未設定';
    if (curValEl) curValEl.innerText = student.coins || 0;
    if (inputVal) inputVal.value = '100';

    updateCoinModeUI('add');
    refreshCoinsPreview();

    if (modal) modal.style.display = 'flex';
  }

  function closeAdjustCoinsModal() {
    const modal = document.getElementById('modal-adjust-coins');
    if (modal) modal.style.display = 'none';
    activeStudentForCoins = null;
  }

  function updateCoinModeUI(mode) {
    activeCoinMode = mode;
    const modeBtns = document.querySelectorAll('.btn-coin-mode');
    modeBtns.forEach(btn => {
      const isCur = (btn.dataset.mode === mode);
      if (isCur) {
        btn.classList.add('active');
        if (mode === 'add') {
          btn.style.borderColor = '#10b981';
          btn.style.color = '#34d399';
          btn.style.background = 'rgba(16, 185, 129, 0.15)';
        } else if (mode === 'set') {
          btn.style.borderColor = '#38bdf8';
          btn.style.color = '#38bdf8';
          btn.style.background = 'rgba(56, 189, 248, 0.15)';
        } else if (mode === 'subtract') {
          btn.style.borderColor = '#ef4444';
          btn.style.color = '#f87171';
          btn.style.background = 'rgba(239, 68, 68, 0.15)';
        }
      } else {
        btn.classList.remove('active');
        btn.style.borderColor = 'var(--border-color)';
        btn.style.color = 'var(--text-muted)';
        btn.style.background = 'rgba(255, 255, 255, 0.04)';
      }
    });

    const inputLabel = document.getElementById('adjust-coins-input-label');
    const presetsLabel = document.getElementById('adjust-coins-presets-label');
    const presetsBox = document.getElementById('adjust-coins-presets-buttons');

    if (mode === 'add') {
      if (inputLabel) inputLabel.innerText = '請輸入欲補發增加的星幣數量：';
      if (presetsLabel) presetsLabel.innerText = '快速增額預設：';
      if (presetsBox) {
        presetsBox.innerHTML = `
          <button type="button" class="btn-coin-preset btn-secondary" data-val="100" style="padding:0.25rem 0.6rem; font-size:0.75rem;">+100 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="200" style="padding:0.25rem 0.6rem; font-size:0.75rem;">+200 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="300" style="padding:0.25rem 0.6rem; font-size:0.75rem;">+300 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="400" style="padding:0.25rem 0.6rem; font-size:0.75rem;">+400 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="500" style="padding:0.25rem 0.6rem; font-size:0.75rem;">+500 幣</button>
        `;
        bindPresetClicks();
      }
    } else if (mode === 'set') {
      if (inputLabel) inputLabel.innerText = '請輸入欲直接設定之總星幣數值：';
      if (presetsLabel) presetsLabel.innerText = '快速指定數值：';
      if (presetsBox) {
        presetsBox.innerHTML = `
          <button type="button" class="btn-coin-preset btn-secondary" data-val="100" style="padding:0.25rem 0.6rem; font-size:0.75rem;">100 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="300" style="padding:0.25rem 0.6rem; font-size:0.75rem;">300 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="500" style="padding:0.25rem 0.6rem; font-size:0.75rem;">500 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="800" style="padding:0.25rem 0.6rem; font-size:0.75rem;">800 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="1000" style="padding:0.25rem 0.6rem; font-size:0.75rem;">1000 幣</button>
        `;
        bindPresetClicks();
      }
    } else if (mode === 'subtract') {
      if (inputLabel) inputLabel.innerText = '請輸入欲扣除的星幣數量：';
      if (presetsLabel) presetsLabel.innerText = '快速扣除預設：';
      if (presetsBox) {
        presetsBox.innerHTML = `
          <button type="button" class="btn-coin-preset btn-secondary" data-val="50" style="padding:0.25rem 0.6rem; font-size:0.75rem;">-50 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="100" style="padding:0.25rem 0.6rem; font-size:0.75rem;">-100 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="200" style="padding:0.25rem 0.6rem; font-size:0.75rem;">-200 幣</button>
          <button type="button" class="btn-coin-preset btn-secondary" data-val="300" style="padding:0.25rem 0.6rem; font-size:0.75rem;">-300 幣</button>
        `;
        bindPresetClicks();
      }
    }
  }

  function bindPresetClicks() {
    const presets = document.querySelectorAll('.btn-coin-preset');
    const inputVal = document.getElementById('input-adjust-coins-val');
    presets.forEach(p => {
      p.onclick = () => {
        if (inputVal) {
          inputVal.value = p.dataset.val;
          refreshCoinsPreview();
        }
      };
    });
  }

  function refreshCoinsPreview() {
    if (!activeStudentForCoins) return;
    const current = Number(activeStudentForCoins.coins) || 0;
    const inputVal = document.getElementById('input-adjust-coins-val');
    const previewVal = document.getElementById('adjust-coins-preview-val');
    const val = Math.max(0, parseInt(inputVal ? inputVal.value : '0', 10) || 0);

    let projected = current;
    if (activeCoinMode === 'add') projected = current + val;
    else if (activeCoinMode === 'set') projected = val;
    else if (activeCoinMode === 'subtract') projected = Math.max(0, current - val);

    if (previewVal) previewVal.innerText = projected;
  }

  // 初始化星幣彈窗事件監聽
  const btnCloseAdjustCoins = document.getElementById('btn-close-adjust-coins-modal');
  const btnCancelAdjustCoins = document.getElementById('btn-cancel-adjust-coins');
  const btnConfirmAdjustCoins = document.getElementById('btn-confirm-adjust-coins');
  const inputAdjustCoins = document.getElementById('input-adjust-coins-val');

  if (btnCloseAdjustCoins) btnCloseAdjustCoins.onclick = closeAdjustCoinsModal;
  if (btnCancelAdjustCoins) btnCancelAdjustCoins.onclick = closeAdjustCoinsModal;

  const modeAdd = document.getElementById('btn-mode-add');
  const modeSet = document.getElementById('btn-mode-set');
  const modeSub = document.getElementById('btn-mode-sub');
  if (modeAdd) modeAdd.onclick = () => { updateCoinModeUI('add'); refreshCoinsPreview(); };
  if (modeSet) modeSet.onclick = () => { updateCoinModeUI('set'); refreshCoinsPreview(); };
  if (modeSub) modeSub.onclick = () => { updateCoinModeUI('subtract'); refreshCoinsPreview(); };

  if (inputAdjustCoins) {
    inputAdjustCoins.addEventListener('input', refreshCoinsPreview);
  }
  bindPresetClicks();

  if (btnConfirmAdjustCoins) {
    btnConfirmAdjustCoins.onclick = async () => {
      if (!activeStudentForCoins) return;
      const inputVal = document.getElementById('input-adjust-coins-val');
      const amount = parseInt(inputVal ? inputVal.value : '0', 10);
      if (isNaN(amount) || amount < 0) {
        alert('⚠️ 請輸入有效的星幣數量！');
        return;
      }

      btnConfirmAdjustCoins.disabled = true;
      btnConfirmAdjustCoins.innerText = '⏳ 正在寫入雲端...';

      try {
        if (window.cloudSync && window.cloudSync.adminAdjustStudentCoins) {
          const res = await window.cloudSync.adminAdjustStudentCoins(
            activeStudentForCoins.className,
            activeStudentForCoins.seatNumber,
            amount,
            activeCoinMode,
            '授課教師課堂調整'
          );
          if (res && res.success) {
            alert(`✅ 成功！已為【${activeStudentForCoins.className} ${activeStudentForCoins.seatNumber}號】更新星幣！\n\n🪙 調整前：${res.oldCoins} 幣\n🪙 調整後：${res.newCoins} 幣 (異動: ${res.delta >= 0 ? '+' : ''}${res.delta})\n\n數值已直接回存雲端資料庫，學童無論換電腦或新關卡重載皆會完整保留！`);
            closeAdjustCoinsModal();
            loadStudentsRoster();
          } else {
            alert(`❌ 調整失敗：${res ? res.error : '未知錯誤，請檢查網路連線'}`);
          }
        }
      } catch (err) {
        alert(`❌ 發生例外錯誤：${err.message}`);
      } finally {
        btnConfirmAdjustCoins.disabled = false;
        btnConfirmAdjustCoins.innerText = '💾 確定儲存並同步至雲端';
      }
    };
  }

  // -------------------------------------------------------------
  // 全班批次補發星幣彈窗邏輯
  // -------------------------------------------------------------
  const btnBatchCoins = document.getElementById('admin-btn-batch-add-coins');
  const modalBatch = document.getElementById('modal-batch-coins');
  const btnCloseBatch = document.getElementById('btn-close-batch-coins-modal');
  const btnCancelBatch = document.getElementById('btn-cancel-batch-coins');
  const btnConfirmBatch = document.getElementById('btn-confirm-batch-coins');
  const inputBatchVal = document.getElementById('input-batch-coins-val');
  const inputBatchReason = document.getElementById('input-batch-coins-reason');
  const batchClassNameEl = document.getElementById('batch-coins-class-name');
  const batchCountEl = document.getElementById('batch-coins-student-count');

  function openBatchCoinsModal(targetClass) {
    if (!targetClass) {
      alert('請先在上方「班級篩選」下拉選單選擇班級！');
      return;
    }
    if (batchClassNameEl) batchClassNameEl.innerText = targetClass;
    if (inputBatchVal) inputBatchVal.value = '100';

    // 統計當前班級已登載名額
    let count = 0;
    const rows = studentsTableBody ? studentsTableBody.querySelectorAll('tr') : [];
    rows.forEach(r => {
      if (r.querySelector('.btn-modify-pwd')) count++;
    });
    if (batchCountEl) batchCountEl.innerText = count || '全班';

    if (modalBatch) modalBatch.style.display = 'flex';
  }

  function closeBatchCoinsModal() {
    if (modalBatch) modalBatch.style.display = 'none';
  }

  if (btnBatchCoins) {
    btnBatchCoins.onclick = () => {
      const selectedClass = studentClassSelect ? studentClassSelect.value : '';
      if (!selectedClass) {
        alert('請先在上方「班級篩選」選擇欲補發金幣的班級！');
        return;
      }
      openBatchCoinsModal(selectedClass);
    };
  }

  if (btnCloseBatch) btnCloseBatch.onclick = closeBatchCoinsModal;
  if (btnCancelBatch) btnCancelBatch.onclick = closeBatchCoinsModal;

  // 批次快速預設值
  const batchPresets = document.querySelectorAll('.btn-batch-preset');
  batchPresets.forEach(b => {
    b.onclick = () => {
      if (inputBatchVal) inputBatchVal.value = b.dataset.val;
    };
  });

  if (btnConfirmBatch) {
    btnConfirmBatch.onclick = async () => {
      const selectedClass = studentClassSelect ? studentClassSelect.value : '';
      if (!selectedClass) return;
      const amount = parseInt(inputBatchVal ? inputBatchVal.value : '0', 10);
      if (isNaN(amount) || amount <= 0) {
        alert('⚠️ 請輸入大於 0 的每人補發數量！');
        return;
      }
      const reason = inputBatchReason ? inputBatchReason.value.trim() : '全班課堂獎勵';

      btnConfirmBatch.disabled = true;
      btnConfirmBatch.innerText = '⏳ 正在批次寫入雲端...';

      try {
        if (window.cloudSync && window.cloudSync.adminBatchAdjustClassCoins) {
          const res = await window.cloudSync.adminBatchAdjustClassCoins(selectedClass, amount, reason);
          if (res && res.success) {
            alert(`🎉 成功！已為【${selectedClass}】全班共 ${res.count} 名學員每人增加 🪙 ${res.amount} 星幣！\n\n原因：${reason}\n雲端資料庫已即時同步更新！`);
            closeBatchCoinsModal();
            loadStudentsRoster();
          } else {
            alert(`❌ 批次補發失敗：${res ? res.error : '未知錯誤'}`);
          }
        }
      } catch (err) {
        alert(`❌ 批次補發發生錯誤：${err.message}`);
      } finally {
        btnConfirmBatch.disabled = false;
        btnConfirmBatch.innerText = '🎁 確定執行全班批次補發';
      }
    };
  }

  // =========================================================================
  // 6. 學校班級清單基本設定維護 (Master Admin Only)
  // =========================================================================
  const tagsContainer = document.getElementById('admin-class-tags-container');
  const classCountEl = document.getElementById('admin-class-count');
  const addClassInput = document.getElementById('admin-new-class-input');
  const addClassBtn = document.getElementById('admin-add-class-btn');
  const batchWrapper = document.getElementById('admin-batch-wrapper');
  const btnToggleBatch = document.getElementById('admin-btn-toggle-batch');
  const batchTextarea = document.getElementById('admin-batch-textarea');
  const btnSaveBatch = document.getElementById('admin-btn-save-batch');
  const btnResetClasses = document.getElementById('admin-btn-reset-classes');

  function renderClassTags() {
    if (!tagsContainer || !window.cloudSync) return;
    const classes = window.cloudSync.classList || [];
    tagsContainer.innerHTML = '';
    if (classCountEl) classCountEl.innerText = classes.length;

    const isLocked = (adminRole === 'teacher');

    classes.forEach(cls => {
      const tag = document.createElement('div');
      tag.className = 'admin-class-tag';
      tag.innerHTML = `
        <span>${cls}</span>
        ${isLocked ? '' : `<button type="button" class="tag-del-btn" title="刪除此班級" data-class="${cls}">✕</button>`}
      `;
      if (!isLocked) {
        tag.querySelector('.tag-del-btn').onclick = (e) => {
          e.stopPropagation();
          if (confirm(`確定要自全校清單中刪除【${cls}】嗎？`)) {
            window.cloudSync.removeClass(cls);
            renderClassTags();
          }
        };
      }
      tagsContainer.appendChild(tag);
    });
  }

  if (addClassBtn && addClassInput) {
    addClassBtn.onclick = () => {
      if (adminRole === 'teacher') return;
      const val = addClassInput.value.trim();
      if (!val) {
        alert('請輸入班級名稱！');
        return;
      }
      if (window.cloudSync && window.cloudSync.addClass(val)) {
        addClassInput.value = '';
        renderClassTags();
      } else {
        alert('該班級已存在或新增失敗！');
      }
    };
  }

  if (btnToggleBatch && batchWrapper) {
    btnToggleBatch.onclick = () => {
      if (adminRole === 'teacher') return;
      batchWrapper.classList.toggle('hidden');
      if (!batchWrapper.classList.contains('hidden') && batchTextarea && window.cloudSync) {
        batchTextarea.value = window.cloudSync.classList.join('\n');
      }
    };
  }

  if (btnSaveBatch && batchTextarea) {
    btnSaveBatch.onclick = () => {
      if (adminRole === 'teacher') return;
      const text = batchTextarea.value;
      const lines = text.split(/[\r\n,，]+/).map(s => s.trim()).filter(Boolean);
      if (lines.length === 0) {
        alert('請輸入至少一個班級名稱！');
        return;
      }
      if (window.cloudSync) {
        window.cloudSync.saveClassList(lines);
        renderClassTags();
        batchWrapper.classList.add('hidden');
        alert(`✅ 已成功批次儲存 ${lines.length} 個班級名冊！`);
      }
    };
  }

  if (btnResetClasses) {
    btnResetClasses.onclick = () => {
      if (adminRole === 'teacher') return;
      if (confirm('確定要還原為全校預設班級清單（3年級至6年級共18班）嗎？')) {
        if (window.cloudSync) {
          window.cloudSync.resetClassList();
          renderClassTags();
          alert('✅ 已還原為全校預設班級名冊！');
        }
      }
    };
  }

  // =========================================================================
  // 7. 排行榜清空與管理員密碼維護 (Master Admin Only)
  // =========================================================================
  const btnClearLeaderboard = document.getElementById('admin-btn-clear-leaderboard');
  const btnSavePassword = document.getElementById('admin-btn-save-password');
  const newPasswordInput = document.getElementById('admin-new-password');

  if (btnClearLeaderboard) {
    btnClearLeaderboard.onclick = async () => {
      if (adminRole === 'teacher') {
        alert('🔒 授課教師身分無權清空全校紀錄，此功能僅限「最高管理員」操作。');
        return;
      }
      if (confirm('⚠️ 警告：確定要清空全校即時排行榜的所有紀錄嗎？此動作無法復原！')) {
        if (window.cloudSync && window.cloudSync.clearLeaderboardRecords) {
          await window.cloudSync.clearLeaderboardRecords();
        }
        alert('✅ 全校排行榜紀錄已成功清空！');
      }
    };
  }

  if (btnSavePassword && newPasswordInput) {
    btnSavePassword.onclick = () => {
      if (adminRole === 'teacher') {
        alert('🔒 授課教師身分無權修改最高管理員密碼。');
        return;
      }
      const newPwd = newPasswordInput.value.trim();
      if (!newPwd) {
        alert('請輸入新密碼！');
        return;
      }
      if (window.cloudSync) {
        window.cloudSync.setAdminPassword(newPwd);
        const pwdHint = document.getElementById('admin-current-pwd-hint');
        if (pwdHint) pwdHint.innerText = newPwd;
        newPasswordInput.value = '';
        alert('✅ 最高管理員密碼已更新！');
      }
    };
  }

  // =========================================================================
  // 8. 教師首次授權通關密碼彈窗邏輯
  // =========================================================================
  function promptTeacherPasscodeModal(user) {
    const modal = document.getElementById('modal-teacher-passcode');
    const nameEl = document.getElementById('passcode-modal-name');
    const emailEl = document.getElementById('passcode-modal-email');
    const avatarEl = document.getElementById('passcode-modal-avatar');
    const inputPass = document.getElementById('input-teacher-passcode');
    const errEl = document.getElementById('teacher-passcode-error');
    const formPass = document.getElementById('form-teacher-passcode');
    const cancelBtn = document.getElementById('btn-cancel-passcode');
    const closeBtn = document.getElementById('btn-close-passcode-modal');

    if (nameEl) nameEl.innerText = `${user.displayName || '本校教師'} 老師`;
    if (emailEl) emailEl.innerText = user.email || '';
    if (avatarEl) {
      if (user.photoURL) {
        avatarEl.src = user.photoURL;
        avatarEl.style.display = 'block';
      } else {
        avatarEl.style.display = 'none';
      }
    }
    if (inputPass) inputPass.value = '';
    if (errEl) errEl.style.display = 'none';

    if (modal) modal.classList.add('active');
    if (inputPass) setTimeout(() => inputPass.focus(), 150);

    const closeModal = async () => {
      if (modal) modal.classList.remove('active');
      if (window.cloudSync && window.cloudSync.signOut) {
        await window.cloudSync.signOut();
      }
    };

    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (closeBtn) closeBtn.onclick = closeModal;

    if (formPass) {
      formPass.onsubmit = async (e) => {
        e.preventDefault();
        const entered = inputPass ? inputPass.value.trim() : '';
        const correctCode = window.cloudSync ? window.cloudSync.getTeacherPasscode() : 'TK6341106';

        if (entered === correctCode) {
          if (errEl) errEl.style.display = 'none';
          if (modal) modal.classList.remove('active');

          // 通過通關密碼驗證，正式登記至雲端 Firestore 建立白名單憑證
          if (window.cloudSync && window.cloudSync.approveTeacher) {
            await window.cloudSync.approveTeacher(user);
          }

          if (window.cloudSync && window.cloudSync.showToast) {
            window.cloudSync.showToast(`🎉 歡迎 ${user.displayName || '老師'}！教師後臺管理權限已正式開通！`, 'success');
          } else {
            alert(`🎉 歡迎 ${user.displayName || '老師'}！教師後臺管理權限已正式開通！`);
          }

          handleLoginSuccess({
            name: user.displayName || '本校老師',
            email: user.email || 'Google 認證教師',
            photoURL: user.photoURL || '',
            role: 'teacher'
          });
        } else {
          if (errEl) errEl.style.display = 'block';
          if (inputPass) {
            inputPass.select();
            inputPass.focus();
          }
        }
      };
    }
  }

  // =========================================================================
  // 9. 已授權教師名單管理與通關密碼維護 (Master Admin Only)
  // =========================================================================
  async function loadTeachersList() {
    const tbody = document.getElementById('admin-teachers-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">正在載入教師名冊...</td></tr>';

    let teachers = [];
    if (window.cloudSync && window.cloudSync.fetchTeachersList) {
      teachers = await window.cloudSync.fetchTeachersList();
    }

    if (!teachers || teachers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">目前尚無 Google 授權之教師帳號</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    teachers.forEach(t => {
      const tr = document.createElement('tr');

      let loginTimeStr = '剛剛';
      if (t.lastLogin) {
        if (typeof t.lastLogin.toDate === 'function') {
          loginTimeStr = t.lastLogin.toDate().toLocaleString('zh-TW', { hour12: false });
        } else if (typeof t.lastLogin === 'number') {
          loginTimeStr = new Date(t.lastLogin).toLocaleString('zh-TW', { hour12: false });
        }
      }

      tr.innerHTML = `
        <td style="display:flex; align-items:center; gap:0.55rem;">
          <img src="${t.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(t.name || 'teacher')}" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid rgba(16,185,129,0.4);">
          <span style="font-weight:700; color:var(--text-main); font-size:0.85rem;">${escapeHtml(t.name || '未具名教師')}</span>
        </td>
        <td>
          <span style="font-family:monospace; color:var(--text-muted); font-size:0.8rem;">${escapeHtml(t.email || '(無 Email)')}</span>
        </td>
        <td style="color:var(--text-muted); font-size:0.75rem;">
          ${escapeHtml(loginTimeStr)}
        </td>
        <td style="text-align:center;">
          <span style="background:rgba(16,185,129,0.18); color:#34d399; padding:0.18rem 0.55rem; border-radius:4px; font-size:0.72rem; font-weight:700; border:1px solid rgba(16,185,129,0.35);">
            🟢 授權中
          </span>
        </td>
        <td style="text-align:center;">
          <button class="btn-secondary btn-delete-teacher" data-uid="${escapeHtml(t.id || t.uid)}" data-name="${escapeHtml(t.name || '教師')}" data-email="${escapeHtml(t.email || '')}" style="padding:0.25rem 0.65rem; font-size:0.72rem; color:#f87171; border-color:rgba(239,68,68,0.35);">
            🗑️ 移除授權
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // 綁定刪除教師授權按鈕
    tbody.querySelectorAll('.btn-delete-teacher').forEach(btn => {
      btn.onclick = async () => {
        const uid = btn.getAttribute('data-uid');
        const name = btn.getAttribute('data-name');
        const email = btn.getAttribute('data-email');
        if (!uid) return;

        const ok = confirm(`⚠️ 確定要移除教師【${name}】(${email}) 的後臺管理授權嗎？\n\n移除後該 Google 帳號將無法登入教師後臺，若未來該老師需要登入，必須重新輸入正確通關密碼才能進入。`);
        if (!ok) return;

        try {
          btn.disabled = true;
          btn.innerText = '處理中...';
          if (window.cloudSync && window.cloudSync.deleteTeacher) {
            await window.cloudSync.deleteTeacher(uid);
          }
          if (window.cloudSync && window.cloudSync.showToast) {
            window.cloudSync.showToast(`✅ 已成功移除教師【${name}】的授權！`, 'success');
          } else {
            alert(`✅ 已成功移除教師【${name}】的授權！`);
          }
          loadTeachersList();
        } catch (err) {
          alert('❌ 移除教師失敗：' + (err.message || '未知錯誤'));
          btn.disabled = false;
          btn.innerText = '🗑️ 移除授權';
        }
      };
    });
  }

  // 重新整理教師名冊按鈕
  const btnRefreshTeachers = document.getElementById('admin-btn-refresh-teachers');
  if (btnRefreshTeachers) {
    btnRefreshTeachers.onclick = () => {
      loadTeachersList();
    };
  }

  // 變更教師通關密碼按鈕
  const btnSaveTeacherPasscode = document.getElementById('admin-btn-save-teacher-passcode');
  const inputTeacherPasscode = document.getElementById('admin-input-teacher-passcode');
  const teacherPasscodeHint = document.getElementById('admin-current-teacher-passcode-hint');

  if (btnSaveTeacherPasscode && inputTeacherPasscode) {
    btnSaveTeacherPasscode.onclick = async () => {
      if (adminRole === 'teacher') {
        alert('🔒 授課教師身分無權修改通關密碼。');
        return;
      }
      const newCode = inputTeacherPasscode.value.trim();
      if (!newCode) {
        alert('⚠️ 請輸入有效的通關密語！');
        inputTeacherPasscode.focus();
        return;
      }
      if (window.cloudSync && window.cloudSync.saveTeacherPasscode) {
        btnSaveTeacherPasscode.disabled = true;
        btnSaveTeacherPasscode.innerText = '儲存中...';
        await window.cloudSync.saveTeacherPasscode(newCode);
        if (teacherPasscodeHint) teacherPasscodeHint.innerText = newCode;
        btnSaveTeacherPasscode.disabled = false;
        btnSaveTeacherPasscode.innerText = '💾 變更通關密語';
        if (window.cloudSync.showToast) {
          window.cloudSync.showToast(`✅ 教師註冊通關密語已成功變更為：${newCode}`, 'success');
        } else {
          alert(`✅ 教師註冊通關密語已成功變更為：${newCode}`);
        }
      }
    };
  }

  // =========================================================================
  // 6. 全校挑戰關卡通關準確率門檻設定 (Card: 通過率可在管理者後台調整設定值)
  // =========================================================================
  const passAccInput = document.getElementById('admin-pass-accuracy-input');
  const savePassAccBtn = document.getElementById('admin-btn-save-pass-accuracy');
  const passAccHint = document.getElementById('admin-current-pass-accuracy-hint');
  const presetAccBtns = document.querySelectorAll('.btn-preset-acc');

  function refreshPassAccuracyUI() {
    const currentAcc = (window.cloudSync && typeof window.cloudSync.getPassAccuracy === 'function')
      ? window.cloudSync.getPassAccuracy()
      : 70;
    if (passAccInput) passAccInput.value = currentAcc;
    if (passAccHint) passAccHint.innerText = `${currentAcc}%`;

    if (presetAccBtns) {
      presetAccBtns.forEach(btn => {
        const isMatch = (parseInt(btn.dataset.val, 10) === currentAcc);
        btn.style.borderColor = isMatch ? '#10b981' : '';
        btn.style.color = isMatch ? '#34d399' : '';
      });
    }
  }

  if (presetAccBtns && presetAccBtns.length > 0) {
    presetAccBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.val;
        if (passAccInput) {
          passAccInput.value = val;
          presetAccBtns.forEach(b => {
            b.style.borderColor = (b === btn) ? '#10b981' : '';
            b.style.color = (b === btn) ? '#34d399' : '';
          });
        }
      });
    });
  }

  if (savePassAccBtn && passAccInput) {
    savePassAccBtn.addEventListener('click', async () => {
      const val = parseInt(passAccInput.value, 10);
      if (isNaN(val) || val < 30 || val > 100) {
        alert('⚠️ 請輸入有效的準確率門檻數值（介於 30% 到 100% 之間）！');
        passAccInput.focus();
        return;
      }
      savePassAccBtn.disabled = true;
      savePassAccBtn.innerText = '⏳ 儲存中...';
      try {
        if (window.cloudSync && typeof window.cloudSync.savePassAccuracy === 'function') {
          await window.cloudSync.savePassAccuracy(val);
        } else {
          localStorage.setItem('typehero_pass_accuracy', String(val));
        }
        refreshPassAccuracyUI();
        if (window.cloudSync && typeof window.cloudSync.showToast === 'function') {
          window.cloudSync.showToast(`✅ 全校關卡通關準確率門檻已成功設定為：${val}%！`, 'success');
        } else {
          alert(`✅ 全校關卡通關準確率門檻已成功設定為：${val}%！\n首頁提示與學生關卡挑戰結算將立即依此標準判定。`);
        }
      } catch (err) {
        console.error('儲存通關門檻失敗:', err);
        alert('❌ 儲存失敗，請檢查網路或 Firebase 連線！');
      } finally {
        savePassAccBtn.disabled = false;
        savePassAccBtn.innerText = '💾 儲存通關門檻';
      }
    });
  }

  // 立即初始化顯示目前的通關門檻
  refreshPassAccuracyUI();

  // =========================================================================
  // 7. 學年度編班名冊與學生資產升級移轉精靈 (Card 6)
  // =========================================================================
  const DEFAULT_115_ROSTER_CSV = `班級,座號,姓名,學號,學年度
一年甲班,1,陽侑辰,115001,115
一年甲班,2,莊富程,115002,115
一年甲班,3,廖英晟,115003,115
一年甲班,4,林元海,115004,115
一年甲班,5,詹博勛,115005,115
一年甲班,6,蔡杰倫,115006,115
一年甲班,7,吳竑諭,115007,115
一年甲班,8,蔡煜晨,115008,115
一年甲班,9,何詠宸,115009,115
一年甲班,10,孔芝婷,115010,115
一年甲班,11,張杏慈,115011,115
一年甲班,12,黃雅樂,115012,115
一年甲班,13,陳羽心,115013,115
一年甲班,14,彭芷淇,115014,115
一年甲班,15,楊秀英,115015,115
一年甲班,16,賴姿蓉,115016,115
一年甲班,17,王辰希,115017,115
一年甲班,18,李璦希,115018,115
一年乙班,1,林冠橙,115019,115
一年乙班,2,林宸詳,115020,115
一年乙班,3,吳侑祐,115021,115
一年乙班,4,邱福笙,115022,115
一年乙班,5,張宸禕,115023,115
一年乙班,6,張智宸,115024,115
一年乙班,7,張秉豪,115025,115
一年乙班,8,張嘉紘,115026,115
一年乙班,9,裴宏田,115027,115
一年乙班,10,張詠絜,115028,115
一年乙班,11,陳姵妘,115029,115
一年乙班,12,陳湘畇,115030,115
一年乙班,13,張依慈,115031,115
一年乙班,14,張語宸,115032,115
一年乙班,15,吳語涵,115033,115
一年乙班,16,姜欣羽,115034,115
一年乙班,17,許喬茵,115035,115
一年乙班,18,陳詩雨,115036,115
二年甲班,1,林駿庭,114001,115
二年甲班,2,張東憲,114002,115
二年甲班,3,何旼祐,114003,115
二年甲班,4,吳祐丞,114004,115
二年甲班,5,姜信竹,114005,115
二年甲班,6,張有志,114006,115
二年甲班,7,何秉鴻,114007,115
二年甲班,8,陳柏汎,114008,115
二年甲班,9,張芷瑄,114009,115
二年甲班,10,賴芷柔,114010,115
二年甲班,11,李怡萱,114011,115
二年甲班,12,張語芮,114012,115
二年甲班,13,何予錝,114026,115
二年甲班,14,黃妤恩,114027,115
二年乙班,1,陳威宇,114013,115
二年乙班,2,張凱睿,114014,115
二年乙班,3,曾鉑華,114015,115
二年乙班,4,田詠傑,114016,115
二年乙班,5,李威佑,114017,115
二年乙班,6,張祐丞,114018,115
二年乙班,7,沈宥町,114019,115
二年乙班,8,葉科鋒,114020,115
二年乙班,9,李子茵,114021,115
二年乙班,10,林思媛,114022,115
二年乙班,11,林俐言,114023,115
二年乙班,12,陳昀汝,114024,115
二年乙班,13,陳鈺文,114025,115
三年甲班,1,吳宇炘,113036,115
三年甲班,2,陳雍潤,113019,115
三年甲班,3,賴畋佑,113003,115
三年甲班,4,張宸揚,113020,115
三年甲班,5,蔡定騫,113022,115
三年甲班,6,王祐嘉,113023,115
三年甲班,7,廖晙邑,113025,115
三年甲班,8,鄭祺穎,113008,115
三年甲班,9,林威佑,113009,115
三年甲班,10,鄭叡安,113026,115
三年甲班,11,陳亭羽,113027,115
三年甲班,12,潘禹彤,113011,115
三年甲班,13,張雅絜,113012,115
三年甲班,14,林吏瑩,113014,115
三年甲班,15,詹幃甯,113032,115
三年甲班,16,蕭愉潔,113037,115
三年乙班,1,李家郡,113001,115
三年乙班,2,郭韋柏,113018,115
三年乙班,3,陳昱辰,113035,115
三年乙班,4,林權智,113002,115
三年乙班,5,許士雄,113021,115
三年乙班,6,張斈亦,113004,115
三年乙班,7,蔡侑廷,113006,115
三年乙班,8,黃仲唯,113007,115
三年乙班,9,楊又瑾,113024,115
三年乙班,10,陳姵蓁,113010,115
三年乙班,11,林品均,113028,115
三年乙班,12,廖宥欣,113029,115
三年乙班,13,林歆澄,113015,115
三年乙班,14,劉媜心,113016,115
三年乙班,15,林芳熏,113033,115
三年乙班,16,林昀臻,113017,115
三年乙班,17,董文君,113034,115
四年甲班,1,林揮憫,112020,115
四年甲班,2,林佑宸,112022,115
四年甲班,3,陳承裕,112004,115
四年甲班,4,林威廷,112005,115
四年甲班,5,林柏睿,112023,115
四年甲班,6,何睿展,112006,115
四年甲班,7,林元凱,112007,115
四年甲班,8,陳星愷,112025,115
四年甲班,9,陳亭羽,112028,115
四年甲班,10,李梓榆,112029,115
四年甲班,11,彭宸希,112030,115
四年甲班,12,陳意尋,112012,115
四年甲班,13,胡甯淇,112038,115
四年甲班,14,張詠晴,112015,115
四年甲班,15,廖玉晨,112016,115
四年甲班,16,孫莛嵐,112017,115
四年甲班,17,吳昀禎,112035,115
四年甲班,18,郭禹彤,112036,115
四年乙班,1,鄧夏夜,112001,115
四年乙班,2,張舜銓,112019,115
四年乙班,3,陳則均,112002,115
四年乙班,4,張祐嘉,112003,115
四年乙班,5,詹瓅崴,112021,115
四年乙班,6,王彥允,112024,115
四年乙班,7,陳定玨,112039,115
四年乙班,8,吳俊融,112037,115
四年乙班,9,丁芃溱,112026,115
四年乙班,10,葉滋云,112009,115
四年乙班,11,林品言,112010,115
四年乙班,12,張吟安,112011,115
四年乙班,13,李亮希,112013,115
四年乙班,14,吳侑蓁,112031,115
四年乙班,15,鄭瑜涵,112032,115
四年乙班,16,李芸瑄,112014,115
四年乙班,17,蘇語蓉,112033,115
四年乙班,18,張可馨,112034,115
四年乙班,19,廖苡琋,112018,115
四年乙班,20,許譯予,112040,115
五年甲班,1,葉建宏,111018,115
五年甲班,2,許棋逸,111039,115
五年甲班,3,林睿煜,111003,115
五年甲班,4,張孝瑞,111022,115
五年甲班,5,石振宇,111004,115
五年甲班,6,張智翔,111024,115
五年甲班,7,林宥翔,111006,115
五年甲班,8,何崑銘,111025,115
五年甲班,9,張凱鈞,111026,115
五年甲班,10,楊舒貽,111009,115
五年甲班,11,林樂婷,111027,115
五年甲班,12,陳芃嫙,111010,115
五年甲班,13,賴昫秀,111029,115
五年甲班,14,廖昱晴,111011,115
五年甲班,15,張巧蓁,111036,115
五年甲班,16,曾愛,111032,115
五年甲班,17,卓庭芸,111014,115
五年甲班,18,張菱恩,111037,115
五年甲班,19,廖妤心,111015,115
五年甲班,20,董正君,111035,115
五年乙班,1,許宥杰,111040,115
五年乙班,2,洪翊程,111001,115
五年乙班,3,林家榞,111019,115
五年乙班,4,陳桓宇,111002,115
五年乙班,5,廖苡恩,111020,115
五年乙班,6,張詰詠,111021,115
五年乙班,7,李子軒,111005,115
五年乙班,8,黃禹皓,111023,115
五年乙班,9,黃迦勒,111007,115
五年乙班,10,林舒婷,111028,115
五年乙班,11,陳宣妤,111012,115
五年乙班,12,李芯羽,111030,115
五年乙班,13,張宜芮,111031,115
五年乙班,14,劉佩倢,111013,115
五年乙班,15,闕翊庭,111033,115
五年乙班,16,張宸瑄,111038,115
五年乙班,17,鄭安妤,111034,115
五年乙班,18,陳姵妤,111016,115
五年乙班,19,邱弈沐,111017,115
五年乙班,20,謝允睿,111041,115
六年甲班,1,郭鴻霖,110001,115
六年甲班,2,嚴昱惟,110023,115
六年甲班,3,林建中,110002,115
六年甲班,4,林承翰,110003,115
六年甲班,5,吳長恩,110024,115
六年甲班,6,許育瑞,110050,115
六年甲班,7,丁芃宇,110026,115
六年甲班,8,莊宸燁,110007,115
六年甲班,9,洪莛羱,110028,115
六年甲班,10,江昕庭,110010,115
六年甲班,11,賴妍皙,110032,115
六年甲班,12,蕭莛蓁,110033,115
六年甲班,13,張依晨,110013,115
六年甲班,14,陳沚筠,110035,115
六年甲班,15,陳葦珊,110034,115
六年甲班,16,林芮榆,110036,115
六年甲班,17,王郁雯,110045,115
六年甲班,18,邱弈臻,110039,115
六年甲班,19,林家渝,110040,115
六年甲班,20,林紫茵,110021,115
六年甲班,21,林宜蒨,110041,115
六年乙班,1,林俊吉,110022,115
六年乙班,2,賴毓霆,110043,115
六年乙班,3,曾寶,110004,115
六年乙班,4,魏薪宸,110005,115
六年乙班,5,李偉茗,110046,115
六年乙班,6,張廷睿,110044,115
六年乙班,7,張允致,110006,115
六年乙班,8,林家豪,110027,115
六年乙班,9,白昇翰,110008,115
六年乙班,10,吳嫣然,110031,115
六年乙班,11,林芷葳,110011,115
六年乙班,12,王語萱,110012,115
六年乙班,13,王宛儒,110049,115
六年乙班,14,張宜蓁,110014,115
六年乙班,15,吳芸蓁,110015,115
六年乙班,16,鄭意潔,110017,115
六年乙班,17,林慕函,110038,115
六年乙班,18,林妍芝,110018,115
六年乙班,19,林孟璇,110019,115
六年乙班,20,吳怡蓁,110020,115
六年乙班,21,張祐芯,110048,115`;

  // parsed115Roster 已於全域由 initRosterData 統一維護
  let parsedUpgradeRoster = null;
  let currentMigrationPlan = null;

  // CSV 解析輔助函式
  function parseRosterCSV(csvText) {
    if (!csvText) return [];
    const cleanText = csvText.replace(/^\uFEFF/, '').trim();
    const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    let classIdx = -1, seatIdx = -1, nameIdx = -1, idIdx = -1, yearIdx = -1;

    headers.forEach((h, idx) => {
      if (/班級|class/i.test(h)) classIdx = idx;
      else if (/座號|seat/i.test(h)) seatIdx = idx;
      else if (/姓名|name/i.test(h)) nameIdx = idx;
      else if (/學號|student.*no|student.*id|id/i.test(h)) idIdx = idx;
      else if (/學年度|年度|year/i.test(h)) yearIdx = idx;
    });

    if (classIdx === -1) classIdx = 0;
    if (seatIdx === -1) seatIdx = 1;
    if (nameIdx === -1) nameIdx = 2;
    if (idIdx === -1 && headers.length > 3) idIdx = 3;
    if (yearIdx === -1 && headers.length > 4) yearIdx = 4;

    const list = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length <= Math.max(classIdx, seatIdx)) continue;

      const className = parts[classIdx] || '';
      const seatRaw = parts[seatIdx] || '';
      const seatNumber = seatRaw ? seatRaw.trim() : '';
      const realName = nameIdx !== -1 ? (parts[nameIdx] || '') : '';
      const studentNo = idIdx !== -1 ? (parts[idIdx] || '') : '';
      const academicYear = yearIdx !== -1 ? (parts[yearIdx] || '115') : '115';

      if (className && seatNumber) {
        list.push({
          className,
          seatNumber,
          realName,
          studentNo,
          academicYear
        });
      }
    }
    return list;
  }

  // 子標籤切換
  const tabBtnBind115 = document.getElementById('tab-btn-bind-115');
  const tabBtnUpgradeFuture = document.getElementById('tab-btn-upgrade-future');
  const panelBind115 = document.getElementById('panel-migration-bind115');
  const panelUpgrade = document.getElementById('panel-migration-upgrade');

  if (tabBtnBind115 && tabBtnUpgradeFuture) {
    tabBtnBind115.onclick = () => {
      tabBtnBind115.classList.add('active');
      tabBtnUpgradeFuture.classList.remove('active');
      if (panelBind115) panelBind115.style.display = 'block';
      if (panelUpgrade) panelUpgrade.style.display = 'none';
    };
    tabBtnUpgradeFuture.onclick = () => {
      tabBtnUpgradeFuture.classList.add('active');
      tabBtnBind115.classList.remove('active');
      if (panelBind115) panelBind115.style.display = 'none';
      if (panelUpgrade) panelUpgrade.style.display = 'block';
    };
  }

  // 115 名冊讀取與綁定
  const btnLoad115 = document.getElementById('btn-load-115-embedded');
  const inputCustom115 = document.getElementById('input-custom-115-file');
  const box115Summary = document.getElementById('box-115-summary');
  const stat115Year = document.getElementById('stat-115-year');
  const stat115Classes = document.getElementById('stat-115-classes');
  const stat115Students = document.getElementById('stat-115-students');
  const stat115Coverage = document.getElementById('stat-115-coverage');
  const btnSync115Classes = document.getElementById('btn-sync-115-classes');
  const btnExecute115 = document.getElementById('btn-execute-115-binding');
  const boxBindingProgress = document.getElementById('box-binding-progress');
  const bindingProgressFill = document.getElementById('binding-progress-fill');
  const bindingProgressPercent = document.getElementById('binding-progress-percent');
  const bindingProgressStatus = document.getElementById('binding-progress-status');
  const bindingLogTerminal = document.getElementById('binding-log-terminal');

  function process115Roster(csvText, sourceName = 'student_115.csv') {
    const list = parseRosterCSV(csvText);
    if (!list || list.length === 0) {
      alert('⚠️ 名冊 CSV 解析失敗，未找到有效學生資料行！');
      return;
    }

    parsed115Roster = list;
    const classes = Array.from(new Set(list.map(s => s.className)));
    const hasIds = list.filter(s => s.studentNo).length;
    const coverage = Math.round((hasIds / list.length) * 100);

    if (stat115Year) stat115Year.innerText = list[0].academicYear || '115';
    if (stat115Classes) stat115Classes.innerText = `${classes.length} 班`;
    if (stat115Students) stat115Students.innerText = `${list.length} 人`;
    if (stat115Coverage) stat115Coverage.innerText = `${coverage}%`;
    if (box115Summary) box115Summary.style.display = 'block';

    if (window.cloudSync && window.cloudSync.showToast) {
      window.cloudSync.showToast(`✅ 成功讀取 115 學年度名冊 (${sourceName})！共 ${classes.length} 班、${list.length} 位學生`, 'success');
    }
  }

  if (btnLoad115) {
    btnLoad115.onclick = async () => {
      try {
        btnLoad115.disabled = true;
        btnLoad115.innerText = '讀取中...';
        const resp = await fetch('student_115.csv');
        if (resp.ok) {
          const text = await resp.text();
          process115Roster(text, 'student_115.csv');
        } else {
          throw new Error('無法直接 fetch student_115.csv');
        }
      } catch (e) {
        console.warn('使用內建 115 名冊資料載入:', e);
        process115Roster(DEFAULT_115_ROSTER_CSV, '內建 115 名冊');
      } finally {
        btnLoad115.disabled = false;
        btnLoad115.innerText = '⚡ 一鍵讀取目前 115 名冊 (216人)';
      }
    };
  }

  if (inputCustom115) {
    inputCustom115.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        process115Roster(evt.target.result, file.name);
      };
      reader.readAsText(file);
    };
  }

  if (btnSync115Classes) {
    btnSync115Classes.onclick = async () => {
      if (!parsed115Roster || parsed115Roster.length === 0) {
        alert('請先讀取 115 學年度名冊！');
        return;
      }
      const classes = Array.from(new Set(parsed115Roster.map(s => s.className)));
      ['教師示範組', '來賓體驗組'].forEach(extra => {
        if (!classes.includes(extra)) classes.push(extra);
      });

      if (window.cloudSync) {
        btnSync115Classes.disabled = true;
        btnSync115Classes.innerText = '同步中...';
        await window.cloudSync.saveClassList(classes);
        renderClassTags();
        window.cloudSync.populateClassSelects();
        btnSync115Classes.disabled = false;
        btnSync115Classes.innerText = '🔄 同步班級清單為全校下拉預設';
        alert(`✅ 成功！全校班級選單已同步為名冊的 ${classes.length} 個班級！`);
      }
    };
  }

  if (btnExecute115) {
    btnExecute115.onclick = async () => {
      if (!parsed115Roster || parsed115Roster.length === 0) {
        alert('請先點擊「⚡ 一鍵讀取目前 115 名冊」！');
        return;
      }

      if (!confirm(`確定要為 115 學年度全校 ${parsed115Roster.length} 位學生執行身分綁定嗎？\n\n系統將自動把「學號」與「真實姓名」寫入雲端學生檔案中，學生原有之星幣、等級與密碼將完整保留！`)) {
        return;
      }

      btnExecute115.disabled = true;
      if (boxBindingProgress) boxBindingProgress.style.display = 'block';
      if (bindingLogTerminal) bindingLogTerminal.innerHTML = '';

      const appendLog = (msg) => {
        if (!bindingLogTerminal) return;
        const line = document.createElement('div');
        line.innerText = msg;
        bindingLogTerminal.appendChild(line);
        bindingLogTerminal.scrollTop = bindingLogTerminal.scrollHeight;
      };

      const result = await window.cloudSync.bindStudentRoster(parsed115Roster, ({ current, total, percent, log }) => {
        if (bindingProgressFill) bindingProgressFill.style.width = `${percent}%`;
        if (bindingProgressPercent) bindingProgressPercent.innerText = `${percent}%`;
        if (bindingProgressStatus) bindingProgressStatus.innerText = `進度：${current} / ${total} (${percent}%)`;
        appendLog(log);
      });

      btnExecute115.disabled = false;
      if (result.success) {
        alert(`🎉 恭喜！全校 ${result.matchedCount} 位學生身分與學號已成功補齊綁定！\n班級選單亦已同步為全校 12 個班級！`);
        loadStudentsRoster();
      } else {
        alert(`❌ 綁定失敗：${result.reason}`);
      }
    };
  }

  // 升級移轉 (Tab 2)
  const upgradeDropzone = document.getElementById('upgrade-csv-dropzone');
  const inputUpgradeFile = document.getElementById('input-upgrade-csv-file');
  const upgradeFileNameHint = document.getElementById('upgrade-file-name-hint');
  const btnPreviewMigration = document.getElementById('btn-preview-migration');
  const boxUpgradePreview = document.getElementById('box-upgrade-preview');
  const statUpgradeCount = document.getElementById('stat-upgrade-count');
  const statNewCount = document.getElementById('stat-new-count');
  const statGradCount = document.getElementById('stat-grad-count');
  const upgradePreviewTableBody = document.getElementById('upgrade-preview-table-body');
  const btnExecuteMigration = document.getElementById('btn-execute-migration');
  const boxUpgradeProgress = document.getElementById('box-upgrade-progress');
  const upgradeProgressFill = document.getElementById('upgrade-progress-fill');
  const upgradeProgressPercent = document.getElementById('upgrade-progress-percent');
  const upgradeProgressStatus = document.getElementById('upgrade-progress-status');
  const upgradeLogTerminal = document.getElementById('upgrade-log-terminal');

  function handleUpgradeCSVLoaded(text, filename) {
    const list = parseRosterCSV(text);
    if (!list || list.length === 0) {
      alert('⚠️ 新學年 CSV 解析失敗，未找到學生資料！');
      return;
    }
    parsedUpgradeRoster = list;
    if (upgradeFileNameHint) {
      upgradeFileNameHint.style.display = 'block';
      upgradeFileNameHint.innerText = `📄 已選取：${filename}（共 ${list.length} 筆學生紀錄）`;
    }
    if (btnPreviewMigration) {
      btnPreviewMigration.disabled = false;
    }
    if (window.cloudSync && window.cloudSync.showToast) {
      window.cloudSync.showToast(`📄 已載入新學年名冊 (${filename})，請點擊「智慧比對並預覽」！`, 'success');
    }
  }

  if (upgradeDropzone && inputUpgradeFile) {
    upgradeDropzone.onclick = () => inputUpgradeFile.click();

    upgradeDropzone.ondragover = (e) => {
      e.preventDefault();
      upgradeDropzone.classList.add('dragover');
    };
    upgradeDropzone.ondragleave = () => {
      upgradeDropzone.classList.remove('dragover');
    };
    upgradeDropzone.ondrop = (e) => {
      e.preventDefault();
      upgradeDropzone.classList.remove('dragover');
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => handleUpgradeCSVLoaded(evt.target.result, file.name);
        reader.readAsText(file);
      }
    };

    inputUpgradeFile.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => handleUpgradeCSVLoaded(evt.target.result, file.name);
        reader.readAsText(file);
      }
    };
  }

  if (btnPreviewMigration) {
    btnPreviewMigration.onclick = async () => {
      if (!parsedUpgradeRoster || parsedUpgradeRoster.length === 0) {
        alert('請先上傳新學年度名冊 CSV！');
        return;
      }

      const inputTargetYear = document.getElementById('input-target-year');
      const targetYear = inputTargetYear ? inputTargetYear.value.trim() : '116';

      btnPreviewMigration.disabled = true;
      btnPreviewMigration.innerText = '比對分析中...';

      const previewRes = await window.cloudSync.previewSchoolYearMigration(parsedUpgradeRoster, targetYear);
      btnPreviewMigration.disabled = false;
      btnPreviewMigration.innerText = '🔍 智慧比對並預覽升級分析報告';

      if (!previewRes.success) {
        alert(`❌ 比對分析失敗：${previewRes.reason}`);
        return;
      }

      currentMigrationPlan = previewRes.plan;
      if (statUpgradeCount) statUpgradeCount.innerText = previewRes.counts.upgrade;
      if (statNewCount) statNewCount.innerText = previewRes.counts.newStudent;
      if (statGradCount) statGradCount.innerText = previewRes.counts.graduated;

      if (upgradePreviewTableBody) {
        upgradePreviewTableBody.innerHTML = '';
        previewRes.plan.forEach(item => {
          const tr = document.createElement('tr');
          const badgeClass = item.type === 'upgrade' ? 'badge-tag-upgrade' : (item.type === 'new_student' ? 'badge-tag-new' : 'badge-tag-graduated');

          tr.innerHTML = `
            <td><code>${item.studentNo || '-'}</code></td>
            <td style="font-weight:bold; color:#fff;">${item.realName}</td>
            <td style="color:var(--text-muted);">${item.oldClass} ${item.oldSeat !== '-' ? item.oldSeat + '號' : ''}</td>
            <td style="font-weight:bold; color:#38bdf8;">${item.newClass} ${item.newSeat !== '-' ? item.newSeat + '號' : ''}</td>
            <td style="text-align:center;"><span class="${badgeClass}">${item.statusText}</span></td>
            <td style="font-size:0.75rem; color:#fbbf24;">${item.retainedSummary}</td>
          `;
          upgradePreviewTableBody.appendChild(tr);
        });
      }

      if (boxUpgradePreview) boxUpgradePreview.style.display = 'block';
      if (window.cloudSync && window.cloudSync.showToast) {
        window.cloudSync.showToast(`✅ 升級分析完成！可升級：${previewRes.counts.upgrade} 人，新生：${previewRes.counts.newStudent} 人`, 'success');
      }
    };
  }

  if (btnExecuteMigration) {
    btnExecuteMigration.onclick = async () => {
      if (!currentMigrationPlan || currentMigrationPlan.length === 0) {
        alert('請先進行智慧比對分析！');
        return;
      }

      const inputSourceYear = document.getElementById('input-source-year');
      const inputTargetYear = document.getElementById('input-target-year');
      const srcYear = inputSourceYear ? inputSourceYear.value.trim() : '115';
      const tgtYear = inputTargetYear ? inputTargetYear.value.trim() : '116';

      if (!confirm(`⚠️【重要執行確認】\n\n您確定要將全校學生從【${srcYear} 學年度】正式升級移轉至【${tgtYear} 學年度】嗎？\n\n系統將自動完成：\n1. 將學生的通關密碼、暱稱、星幣、等級與商城物品移轉至新班級座號！\n2. 舊座號將乾淨釋出給新學年度學生使用！\n3. 全校選單將更新為 ${tgtYear} 學年度新班級清單！`)) {
        return;
      }

      btnExecuteMigration.disabled = true;
      if (boxUpgradeProgress) boxUpgradeProgress.style.display = 'block';
      if (upgradeLogTerminal) upgradeLogTerminal.innerHTML = '';

      const appendUpgradeLog = (msg) => {
        if (!upgradeLogTerminal) return;
        const line = document.createElement('div');
        line.innerText = msg;
        upgradeLogTerminal.appendChild(line);
        upgradeLogTerminal.scrollTop = upgradeLogTerminal.scrollHeight;
      };

      const result = await window.cloudSync.executeSchoolYearMigration(currentMigrationPlan, srcYear, tgtYear, ({ current, total, percent, log }) => {
        if (upgradeProgressFill) upgradeProgressFill.style.width = `${percent}%`;
        if (upgradeProgressPercent) upgradeProgressPercent.innerText = `${percent}%`;
        if (upgradeProgressStatus) upgradeProgressStatus.innerText = `升級進度：${current} / ${total} (${percent}%)`;
        appendUpgradeLog(log);
      });

      btnExecuteMigration.disabled = false;
      if (result.success) {
        alert(`🎉 恭喜！${tgtYear} 學年度全校升級移轉已全數成功完成！\n學生登入時即可直接選擇新班級與新座號使用！`);
        loadStudentsRoster();
      } else {
        alert(`❌ 移轉失敗：${result.reason}`);
      }
    };
  }

  // =========================================================================
  // 全校名冊記憶庫與自動綁定引擎 (需求 4)
  // =========================================================================
  function initRosterData() {
    try {
      parsed115Roster = parseRosterCSV(DEFAULT_115_ROSTER_CSV);
      rosterMap.clear();
      parsed115Roster.forEach(s => {
        rosterMap.set(`${s.className}_${s.seatNumber}`, s);
      });
      console.log(`📋 [全校名冊記憶庫] 已成功預載 115 學年度全校名冊，共 ${rosterMap.size} 筆學生學籍`);
    } catch (e) {
      console.warn('預載名冊失敗:', e);
    }

    // 嘗試非同步載入最新的 student_115.csv
    fetch('student_115.csv').then(resp => {
      if (resp.ok) return resp.text();
      throw new Error('No local csv file');
    }).then(text => {
      const fresh = parseRosterCSV(text);
      if (fresh && fresh.length > 0) {
        parsed115Roster = fresh;
        rosterMap.clear();
        parsed115Roster.forEach(s => {
          rosterMap.set(`${s.className}_${s.seatNumber}`, s);
        });
        console.log(`📋 [全校名冊即時更新] 已同步 student_115.csv 最新名冊 (${rosterMap.size} 筆)`);
      }
    }).catch(() => {});
  }

  async function autoSyncRosterOnLoad() {
    if (!window.cloudSync || !window.cloudSync.isFirebaseReady) return;
    try {
      if (!parsed115Roster || parsed115Roster.length === 0) {
        initRosterData();
      }
      if (!parsed115Roster || parsed115Roster.length === 0) return;

      const syncKey = 'typehero_roster_auto_synced_115_v2';
      const lastSync = localStorage.getItem(syncKey);
      const now = Date.now();
      if (lastSync && (now - Number(lastSync) < 12 * 60 * 60 * 1000)) {
        console.log('ℹ️ 全校名冊身分綁定近期已同步過，維持即時智慧補齊。');
        return;
      }

      console.log('🚀 [自動身分綁定] 正在為全校學生名冊自動執行 Firestore 身分綁定...');
      const res = await window.cloudSync.bindStudentRoster(parsed115Roster, () => {});
      if (res && res.success) {
        localStorage.setItem(syncKey, String(now));
        console.log(`✅ [自動身分綁定完成] 成功自動補齊 ${res.matchedCount || parsed115Roster.length} 筆學生身分綁定！`);
      }
    } catch (err) {
      console.warn('背景自動名冊身分綁定遭遇問題:', err);
    }
  }

  // 頁面就緒時立即預載名冊
  initRosterData();
});

