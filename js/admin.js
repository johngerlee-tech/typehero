/**
 * TypeHero - 教學管理與教師後臺系統核心邏輯 (admin.js)
 * 涵蓋 Google 帳號授權登入、教師/管理員身分權限分級、
 * 課堂指定班級特訓題目發布、學生密碼查閱與修改、全校班級設定。
 */

document.addEventListener('DOMContentLoaded', () => {
  let adminRole = null; // 'teacher' | 'master_admin' | null
  let currentAuthUser = null;
  let showPasswords = false;

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

        handleLoginSuccess({
          name: user.displayName || '本校老師',
          email: user.email || 'Google 認證教師',
          photoURL: user.photoURL || '',
          role: 'teacher'
        });

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

    // 載入資料庫診斷、特訓題目與名冊
    runFirebaseDiagnostic();
    loadPublishedLessonsList();
    renderClassTags();
    loadStudentsRoster();
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

    if (isTeacher) {
      if (cardClass) cardClass.classList.add('locked-card');
      if (noticeClassLocked) noticeClassLocked.style.display = 'flex';
      if (badgeClassRole) badgeClassRole.innerText = '🔒 僅限最高管理員';
      if (newClassInp) newClassInp.disabled = true;
      if (addClassBtn) addClassBtn.disabled = true;
      if (toggleBatchBtn) toggleBatchBtn.disabled = true;
      if (resetClassesBtn) resetClassesBtn.disabled = true;
      if (saveBatchBtn) saveBatchBtn.disabled = true;
    } else {
      if (cardClass) cardClass.classList.remove('locked-card');
      if (noticeClassLocked) noticeClassLocked.style.display = 'none';
      if (badgeClassRole) badgeClassRole.innerText = '👑 具備完全權限';
      if (newClassInp) newClassInp.disabled = false;
      if (addClassBtn) addClassBtn.disabled = false;
      if (toggleBatchBtn) toggleBatchBtn.disabled = false;
      if (resetClassesBtn) resetClassesBtn.disabled = false;
      if (saveBatchBtn) saveBatchBtn.disabled = false;
    }

    // 卡片 4: 排行榜清空與主管理密碼修改
    const cardSecurity = document.getElementById('card-security-settings');
    const noticeSecurityLocked = document.getElementById('notice-security-locked');
    const badgeSecurityRole = document.getElementById('badge-security-role');
    const clearLbBtn = document.getElementById('admin-btn-clear-leaderboard');
    const newPwdInp = document.getElementById('admin-new-password');
    const savePwdBtn = document.getElementById('admin-btn-save-password');
    const pwdHint = document.getElementById('admin-current-pwd-hint');

    if (isTeacher) {
      if (cardSecurity) cardSecurity.classList.add('locked-card');
      if (noticeSecurityLocked) noticeSecurityLocked.style.display = 'flex';
      if (badgeSecurityRole) badgeSecurityRole.innerText = '🔒 僅限最高管理員';
      if (clearLbBtn) clearLbBtn.disabled = true;
      if (newPwdInp) newPwdInp.disabled = true;
      if (savePwdBtn) savePwdBtn.disabled = true;
      if (pwdHint) pwdHint.innerText = '••••';
    } else {
      if (cardSecurity) cardSecurity.classList.remove('locked-card');
      if (noticeSecurityLocked) noticeSecurityLocked.style.display = 'none';
      if (badgeSecurityRole) badgeSecurityRole.innerText = '👑 具備完全權限';
      if (clearLbBtn) clearLbBtn.disabled = false;
      if (newPwdInp) newPwdInp.disabled = false;
      if (savePwdBtn) savePwdBtn.disabled = false;
      if (pwdHint && window.cloudSync) pwdHint.innerText = window.cloudSync.getAdminPassword();
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
        loadPublishedLessonsList();
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
        <button class="btn-secondary btn-load-item" style="font-size:0.72rem; padding:0.2rem 0.55rem;">
          載入編輯
        </button>
      `;

      row.querySelector('.btn-load-item').onclick = () => {
        if (targetClassSelect) targetClassSelect.value = item.targetClass;
        if (customTitleInp) customTitleInp.value = item.title || '';
        if (customTextInp) {
          customTextInp.value = item.text || '';
          if (customCharCount) customCharCount.innerText = `字數統計：${item.text.length} 字`;
        }
      };

      publishedLessonsList.appendChild(row);
    });
  }

  if (btnRefreshLessons) btnRefreshLessons.onclick = loadPublishedLessonsList;

  // =========================================================================
  // 5. 學生帳號與通行密碼管理 (需求 7: 查閱班級密碼與協助修改)
  // =========================================================================
  const studentClassSelect = document.getElementById('admin-student-class-select');
  const studentsTableBody = document.getElementById('admin-students-table-body');
  const btnToggleShowPwd = document.getElementById('admin-btn-toggle-show-pwd');
  const btnRefreshStudents = document.getElementById('admin-btn-refresh-students');

  if (btnToggleShowPwd) {
    btnToggleShowPwd.onclick = () => {
      showPasswords = !showPasswords;
      btnToggleShowPwd.innerText = showPasswords ? '🙈 隱藏密碼' : '👁️ 顯示/隱藏密碼';
      loadStudentsRoster();
    };
  }

  if (studentClassSelect) {
    studentClassSelect.onchange = loadStudentsRoster;
  }
  if (btnRefreshStudents) {
    btnRefreshStudents.onclick = loadStudentsRoster;
  }

  async function loadStudentsRoster() {
    if (!studentsTableBody) return;
    const selectedClass = studentClassSelect ? studentClassSelect.value : (window.cloudSync ? window.cloudSync.classList[0] : '5年3班');

    studentsTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:1.2rem; color:var(--text-muted);">
          正在讀取【${selectedClass}】學生名冊...
        </td>
      </tr>
    `;

    let students = [];
    if (window.cloudSync && window.cloudSync.fetchClassStudents) {
      students = await window.cloudSync.fetchClassStudents(selectedClass);
    }

    if (!students || students.length === 0) {
      studentsTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:1.2rem; color:var(--text-muted);">
            ℹ️【${selectedClass}】目前尚無學生上線註冊紀錄。<br>
            當學生在打字學院首頁登載座號時，將會自動在此處建立專屬檔案與密碼。
          </td>
        </tr>
      `;
      return;
    }

    studentsTableBody.innerHTML = '';
    students.forEach(st => {
      const tr = document.createElement('tr');
      const pwdDisplay = showPasswords
        ? (st.password ? `<span class="pwd-code-badge">${st.password}</span>` : '<span style="color:var(--text-muted);">無密碼</span>')
        : (st.password ? '<span class="pwd-code-badge">••••</span>' : '<span style="color:var(--text-muted);">無密碼</span>');

      tr.innerHTML = `
        <td style="font-weight:bold;">${st.seatNumber || '0'}</td>
        <td style="font-weight:bold; color:var(--brand-primary);">${st.nickname || '未設定'}</td>
        <td>Lv.${st.level || 1}</td>
        <td style="color:#fbbf24; font-weight:bold;">🪙 ${st.coins || 0}</td>
        <td>${pwdDisplay}</td>
        <td style="text-align:center;">
          <button class="btn-secondary btn-modify-pwd" style="font-size:0.72rem; padding:0.25rem 0.55rem; border-color:var(--brand-primary); color:var(--brand-primary);">
            ✏️ 修改密碼
          </button>
        </td>
      `;

      // 點擊「修改密碼」彈窗迅速為學生重設
      tr.querySelector('.btn-modify-pwd').onclick = async () => {
        const studentDesc = `${selectedClass} ${st.seatNumber}號 (${st.nickname || '學生'})`;
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

      studentsTableBody.appendChild(tr);
    });
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
});
