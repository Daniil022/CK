'use strict';

// ═══════════ ЭКРАН ВХОДА ═══════════
window.renderLoginScreen = function() {
  const list = document.getElementById('userList');
  const sub = document.getElementById('loginSub');
  if (!list) return;

  const users = DB.get(USERS_KEY, {});
  const logins = Object.keys(users);

  if (!logins.length) {
    list.innerHTML = '<div class="empty">Нет сотрудников. Обнови список.</div>';
    sub.textContent = 'Список пуст';
    return;
  }

  logins.sort((a, b) => {
    const ua = users[a], ub = users[b];
    if (ua.role !== ub.role) return ua.role === 'admin' ? -1 : 1;
    return (ua.name || '').localeCompare(ub.name || '');
  });

  sub.textContent = 'Выбери себя из списка (' + logins.length + ')';

  list.innerHTML = logins.map(login => {
    const u = users[login];
    const isAdmin = u.role === 'admin';
    return `<div class="user-choice ${isAdmin ? 'admin-choice' : ''}" data-pickuser="${esc(login)}">
      <div>
        <b>${esc(u.name)}</b>
        <small>${isAdmin ? '👑 Администратор' : '👮 Сотрудник СК'}</small>
      </div>
      <div class="arrow">→</div>
    </div>`;
  }).join('');
};

// ═══════════ ОБНОВИТЬ СПИСОК ИЗ ОБЛАКА ═══════════
window.cloudRefresh = function() {
  const sub = document.getElementById('loginSub');
  if (sub) sub.textContent = 'Обновление...';

  if (typeof window._manualPullCloud !== 'function') {
    toast('Firebase не готов, попробуй через 2 сек', 'error');
    setTimeout(() => renderLoginScreen(), 1500);
    return;
  }

  window._manualPullCloud()
    .then(() => {
      renderLoginScreen();
      toast('Список обновлён ✓');
    })
    .catch(e => {
      console.error('cloudRefresh:', e);
      toast('Ошибка: ' + (e.message || ''), 'error');
      renderLoginScreen();
    });
};

// ═══════════ КЛИК ПО СОТРУДНИКУ — ОТКРЫТЬ МОДАЛКУ ═══════════
document.addEventListener('click', e => {
  const t = e.target.closest('[data-pickuser]');
  if (!t) return;
  e.preventDefault();
  e.stopPropagation();

  const login = t.dataset.pickuser;
  const users = DB.get(USERS_KEY, {});
  const u = users[login];
  if (!u) { toast('Пользователь не найден', 'error'); return; }

  PENDING_USER = login;

  const who = document.getElementById('pwdWho');
  if (who) {
    who.innerHTML = `<b>${esc(u.name)}</b><br><small style="color:var(--muted);font-size:11px">${
      u.role === 'admin' ? '👑 Администратор' : '👮 Сотрудник'
    }</small>`;
  }

  const pwdInp = document.getElementById('pwdInput');
  if (pwdInp) pwdInp.value = '';

  const errEl = document.getElementById('pwdError');
  if (errEl) errEl.textContent = '';

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('modalPwd').classList.add('show');

  setTimeout(() => { if (pwdInp) pwdInp.focus(); }, 250);
}, true);

// ═══════════ ОТМЕНА ═══════════
window.cancelPwd = function() {
  PENDING_USER = null;
  document.getElementById('modalPwd').classList.remove('show');
  const errEl = document.getElementById('pwdError');
  if (errEl) errEl.textContent = '';
  document.getElementById('loginScreen').style.display = 'flex';
  renderLoginScreen();
};

// ═══════════ ПРОВЕРКА ПАРОЛЯ ═══════════
window.submitPwd = function() {
  if (!PENDING_USER) return;

  const pwd = document.getElementById('pwdInput').value;
  const errEl = document.getElementById('pwdError');
  if (!pwd) { errEl.textContent = 'Введи пароль'; return; }

  const users = DB.get(USERS_KEY, {});
  const pwds = DB.get(PWDS_KEY, {});
  const u = users[PENDING_USER];

  if (!u) { errEl.textContent = 'Пользователь исчез'; return; }
  if (pwds[PENDING_USER] !== hashPwd(pwd)) {
    errEl.textContent = 'Неверный пароль';
    return;
  }

  // Успех
  CURRENT_USER = {
    login: PENDING_USER,
    name: u.name,
    role: u.role,
    perms: u.perms || {}
  };
  MY_NAME = u.name;

  DB.set('sessionLogin', PENDING_USER);
  DB.set('myName', u.name);
  PENDING_USER = null;

  document.getElementById('modalPwd').classList.remove('show');
  document.getElementById('loginScreen').style.display = 'none';

  updateUserInfo();
  toast('Добро пожаловать, ' + u.name);
  render();

  if (typeof window.updatePresence === 'function') window.updatePresence();
};

// ═══════════ ВЫХОД ═══════════
window.doLogout = function() {
  if (!confirm('Выйти?')) return;
  CURRENT_USER = null;
  DB.del('sessionLogin');
  document.getElementById('loginScreen').style.display = 'flex';
  renderLoginScreen();
  toast('Вы вышли');
};

// ═══════════ ОБНОВИТЬ ИНФО В ШАПКЕ ═══════════
window.updateUserInfo = function() {
  const el = document.getElementById('userInfo');
  if (!el) return;
  if (!CURRENT_USER) { el.innerHTML = ''; return; }

  const roleLabel = CURRENT_USER.role === 'admin' ? '👑 Админ' : '👮 Сотрудник';
  el.innerHTML = `<b>${esc(CURRENT_USER.name)}</b> <span class="badge">${roleLabel}</span> <button class="sm gray" onclick="doLogout()" style="margin-left:4px">Выйти</button>`;
};

// ═══════════ АВТОЛОГИН ═══════════
window.tryAutoLogin = function() {
  const login = DB.get('sessionLogin', '');
  const users = DB.get(USERS_KEY, {});
  if (login && users[login]) {
    CURRENT_USER = {
      login,
      name: users[login].name,
      role: users[login].role,
      perms: users[login].perms || {}
    };
    MY_NAME = users[login].name;
    document.getElementById('loginScreen').style.display = 'none';
    updateUserInfo();
    return true;
  }
  return false;
};
