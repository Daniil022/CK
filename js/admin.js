'use strict';

// ═══════════ ПАНЕЛЬ АДМИНА ═══════════
function panelAdmin() {
  if (!isAdmin()) {
    return '<div class="panel"><div class="card"><h3>Доступ запрещён</h3></div></div>';
  }

  const users = DB.get(USERS_KEY, {});

  const usersList = Object.entries(users).map(([login, u]) => {
    const roleBadge = u.role === 'admin'
      ? '<span class="badge orange">👑 Админ</span>'
      : '<span class="badge">👮 Сотрудник</span>';

    return `<div class="item">
      <div class="info">
        <b>${esc(u.name)}</b> ${roleBadge}<br>
        <small>логин: <b>${esc(login)}</b></small>
      </div>
      <div style="display:flex;gap:2px">
        <button class="sm gray" data-showpwd="${esc(login)}" title="Сбросить пароль">🔑</button>
        <button class="sm gray" data-edituser="${esc(login)}" title="Изменить">✎</button>
        <span class="del" data-deluser="${esc(login)}" title="Удалить">✕</span>
      </div>
    </div>`;
  }).join('');

  const schemaList = Object.keys(SCHEMA).map(k => {
    const items = DB.get(k, []);
    return `<div class="item">
      <div class="info">
        <b>${esc(SCHEMA[k].label)}</b>
        <small>${SCHEMA[k].fields.length} полей • ${Array.isArray(items) ? items.length : 0} записей</small>
      </div>
      <div style="display:flex;gap:2px">
        <button class="sm gray" onclick="renameTab('${esc(k)}')">✎</button>
        <button class="sm red" onclick="delTab('${esc(k)}')">✕</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="panel ${activeTab === 'admin' ? 'active' : ''}">
    <div class="card" style="border-color:var(--warn)">
      <h3>👑 Панель администратора</h3>
      <div class="hint">Полный доступ. Только для админов.</div>
    </div>

    <div class="card">
      <h3>☁️ Синхронизация</h3>
      <div style="font-size:12px;padding:4px 0">Статус: <b>${CLOUD_MODE ? '🟢 Онлайн' : '🔴 Офлайн'}</b></div>
      ${CLOUD_MODE
        ? `<button class="red" onclick="stopCloud()">⛔ Отключиться</button><button class="green" onclick="pushCloud(true)">📤 Отправить сейчас</button>`
        : `<button class="green" onclick="startCloud()">☁️ Подключиться к отделу</button>`}
    </div>

    <div class="card">
      <h3>➕ Добавить сотрудника</h3>
      <div class="grid2">
        <div><label>Логин (латиница)</label><input id="nuLogin" placeholder="ivanov"></div>
        <div><label>Имя / позывной</label><input id="nuName" placeholder="Иванов И.И."></div>
      </div>
      <label>Роль</label>
      <select id="nuRole">
        <option value="user">👮 Сотрудник</option>
        <option value="admin">👑 Админ</option>
      </select>
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <input type="checkbox" id="nuLaws" style="width:auto">
        <label for="nuLaws" style="margin:0">Может изменять законы</label>
      </div>
      <label>Пароль</label>
      <div class="row">
        <input id="nuPwd" placeholder="Оставь пустым — сгенерируется" style="flex:3">
        <button class="gray" onclick="genNewUserPwd()">🎲</button>
      </div>
      <button class="green" onclick="adminAddUser()" style="margin-top:8px">➕ Создать</button>
    </div>

    <div class="card">
      <h3>👥 Сотрудники (${Object.keys(users).length})</h3>
      ${usersList || '<div class="empty">Пусто</div>'}
    </div>

    <div class="card">
      <h3>⚙ Вкладки</h3>
      ${schemaList || '<div class="empty">Нет</div>'}
      <button class="green" onclick="newTab()">➕ Создать вкладку</button>
    </div>

    <div class="card">
      <h3>📖 Управление законами</h3>
      <button class="green" onclick="go('codes')">Перейти в кодексы</button>
    </div>

    <div class="card">
      <h3>📜 Журнал действий</h3>
      <button class="green" onclick="go('journal')">Открыть журнал</button>
    </div>

    <div class="card">
      <h3>💾 Резервная копия</h3>
      <div class="row">
        <button class="green" onclick="expAll()">📤 Экспорт</button>
        <button onclick="document.getElementById('impFile').click()">📥 Импорт</button>
      </div>
    </div>

    <div class="card">
      <h3>⚠ Опасная зона</h3>
      <button class="gray" onclick="resetCodes()">Сбросить кодексы</button>
      <button class="red" onclick="adminResetUsers()">Сбросить всех сотрудников</button>
      <button class="red" onclick="fullReset()">ПОЛНЫЙ СБРОС ВСЕГО</button>
    </div>
  </div>`;
}

// ═══════════ СОЗДАНИЕ СОТРУДНИКА ═══════════
window.genNewUserPwd = function() {
  const pwd = genPwd(8);
  document.getElementById('nuPwd').value = pwd;
  toast('Пароль: ' + pwd);
};

window.adminAddUser = function() {
  if (!isAdmin()) return;

  const login = document.getElementById('nuLogin').value.trim().toLowerCase();
  const name = document.getElementById('nuName').value.trim();
  const role = document.getElementById('nuRole').value;
  const laws = document.getElementById('nuLaws').checked;
  let pwd = document.getElementById('nuPwd').value.trim();

  if (!login) { toast('Введите логин', 'error'); return; }
  if (!/^[a-z0-9_]+$/.test(login)) { toast('Логин: латиница, цифры, _', 'error'); return; }
  if (!name) { toast('Введите имя', 'error'); return; }

  const users = DB.get(USERS_KEY, {});
  if (users[login]) { toast('Логин занят', 'error'); return; }

  if (!pwd) pwd = genPwd(8);
  if (pwd.length < 4) { toast('Пароль минимум 4', 'error'); return; }

  users[login] = {
    login, name, role,
    perms: role === 'admin' ? { all: true } : { laws },
    created: Date.now(),
    createdBy: CURRENT_USER.login
  };
  DB.set(USERS_KEY, users);

  const pwds = DB.get(PWDS_KEY, {});
  pwds[login] = hashPwd(pwd);
  DB.set(PWDS_KEY, pwds);

  addLog('Сотрудник создан', login + ' / ' + name);

  setTimeout(() => {
    alert('✅ СОТРУДНИК СОЗДАН\n\nИмя: ' + name + '\nЛогин: ' + login + '\nПароль: ' + pwd + '\n\n⚠️ СКОПИРУЙ ПАРОЛЬ И ПЕРЕДАЙ СОТРУДНИКУ.');
  }, 100);

  if (window.CLOUD_MODE && window.pushCloud) window.pushCloud(false);
  render();
};

// ═══════════ УДАЛЕНИЕ СОТРУДНИКА ═══════════
window.adminDelUser = function(login) {
  if (!isAdmin()) return;
  if (login === 'admin') { toast('Нельзя удалить главного', 'error'); return; }
  if (login === CURRENT_USER.login) { toast('Нельзя удалить себя', 'error'); return; }
  if (!confirm('Удалить ' + login + '?')) return;

  const users = DB.get(USERS_KEY, {});
  delete users[login];
  DB.set(USERS_KEY, users);

  const pwds = DB.get(PWDS_KEY, {});
  delete pwds[login];
  DB.set(PWDS_KEY, pwds);

  addLog('Удалён', login);
  if (window.CLOUD_MODE && window.pushCloud) window.pushCloud(false);
  render();
};

// ═══════════ РЕДАКТИРОВАНИЕ СОТРУДНИКА ═══════════
window.adminEditUser = function(login) {
  if (!isAdmin()) return;

  const users = DB.get(USERS_KEY, {});
  const u = users[login];
  if (!u) return;

  const newName = prompt('Имя:', u.name);
  if (newName === null) return;

  const newRole = prompt('Роль (admin/user):', u.role);
  if (newRole === null) return;

  const newLaws = confirm('Разрешить изменять законы? OK = да, Отмена = нет');

  u.name = newName.trim() || u.name;
  u.role = (newRole === 'admin') ? 'admin' : 'user';
  u.perms = u.role === 'admin' ? { all: true } : { laws: newLaws };

  DB.set(USERS_KEY, users);
  if (window.CLOUD_MODE && window.pushCloud) window.pushCloud(false);
  render();
};

// ═══════════ СБРОС ПАРОЛЯ ═══════════
window.adminResetPwd = function(login) {
  if (!isAdmin()) return;

  const users = DB.get(USERS_KEY, {});
  const u = users[login];
  if (!u) return;

  const newPwd = prompt('Новый пароль для ' + u.name + '\n(пусто = сгенерировать)');
  if (newPwd === null) return;

  const pwd = newPwd.trim() || genPwd(8);
  const pwds = DB.get(PWDS_KEY, {});
  pwds[login] = hashPwd(pwd);
  DB.set(PWDS_KEY, pwds);

  addLog('Пароль сброшен', login);
  if (window.CLOUD_MODE && window.pushCloud) window.pushCloud(false);

  setTimeout(() => {
    alert('✅ ПАРОЛЬ СБРОШЕН\n\nИмя: ' + u.name + '\nЛогин: ' + login + '\nНовый пароль: ' + pwd);
  }, 100);
};

// ═══════════ СБРОС ВСЕХ ═══════════
window.adminResetUsers = function() {
  if (!isAdmin()) return;
  if (!confirm('Сбросить ВСЕХ? Останется admin/admin2026')) return;

  DB.set(USERS_KEY, {
    admin: {
      login: 'admin',
      name: 'Администратор',
      role: 'admin',
      perms: { all: true },
      created: Date.now()
    }
  });
  DB.set(PWDS_KEY, { admin: hashPwd('admin2026') });

  if (window.CLOUD_MODE && window.pushCloud) window.pushCloud(false);
  toast('Сброшено');
  render();
};

// ═══════════ ГЛОБАЛЬНЫЕ КЛИКИ ДЛЯ АДМИНА ═══════════
document.addEventListener('click', e => {
  const t = e.target.closest('[data-deluser],[data-edituser],[data-showpwd]');
  if (!t) return;
  const d = t.dataset;

  if (d.deluser) { adminDelUser(d.deluser); return; }
  if (d.edituser) { adminEditUser(d.edituser); return; }
  if (d.showpwd) { adminResetPwd(d.showpwd); return; }
});
