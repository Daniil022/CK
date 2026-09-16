'use strict';

// ═══════════ ГЛАВНЫЙ РЕНДЕР ═══════════
window.render = function() {
  try {
    document.body.className = THEME === 'light' ? 'light' : '';
    refreshCodeBooks();

    const tabs = [
      { id: 'dash', label: '📊 Дашборд' },
      ...Object.keys(SCHEMA).map(k => ({ id: k, label: SCHEMA[k].label || 'Без названия' })),
      { id: 'docs', label: '📄 Документы' },
      { id: 'codes', label: '📖 Кодексы' },
      { id: 'timer', label: '⏱ Таймеры' }
    ];

    if (isAdmin()) {
      tabs.push({ id: 'journal', label: '📜 Журнал' });
      tabs.push({ id: 'settings', label: '⚙ Настройки' });
      tabs.push({ id: 'admin', label: '👑 ADMIN' });
    }

    if (!tabs.find(t => t.id === activeTab)) activeTab = 'dash';

    document.getElementById('tabBar').innerHTML = tabs.map(t =>
      `<div class="tab ${t.id === activeTab ? 'active' : ''} ${t.id === 'admin' ? 'admin-tab' : ''}" data-tab="${esc(t.id)}">${esc(t.label)}</div>`
    ).join('');

    document.querySelectorAll('.tab').forEach(el => {
      el.onclick = () => go(el.dataset.tab);
    });

    let html = '';
    tabs.forEach(t => {
      if (t.id === 'dash') html += panelDash();
      else if (t.id === 'docs') html += panelDocs();
      else if (t.id === 'codes') html += panelCodes();
      else if (t.id === 'timer') html += panelTimer();
      else if (t.id === 'journal') html += panelJournal();
      else if (t.id === 'settings') html += panelSettings();
      else if (t.id === 'admin') html += panelAdmin();
      else html += panelData(t.id);
    });

    document.getElementById('panels').innerHTML = html;

    if (activeTab === 'timer') updTimer();
    if (activeTab === 'docs') renderDocForm();

    // Привязка обработчиков после рендера
    setTimeout(() => {
      const panel = document.getElementById('panel_' + activeTab);
      if (!panel) return;

      const s = panel.querySelector('[data-search]');
      if (s) {
        const key = s.dataset.search;
        s.oninput = () => { searchTerms[key] = s.value; renderListOnly(key); };
      }

      panel.querySelectorAll('[data-cfilter]').forEach(b => {
        b.onclick = () => { caseFilter = b.dataset.cfilter; render(); };
      });

      const cs = document.getElementById('codeSearch');
      if (cs) cs.oninput = () => {
        searchTerms['codes'] = cs.value;
        const cur = document.querySelector('.code-tab.active');
        if (cur) safeSetBook(parseInt(cur.dataset.book, 10));
      };

      const ab = document.querySelector('[data-action="addbook"]');
      if (ab) ab.onclick = addBook;
    }, 0);

  } catch (e) {
    console.error('Render error:', e);
    const eb = document.getElementById('bootError');
    if (eb) {
      eb.textContent = '❌ ' + e.message + '\n' + e.stack;
      eb.classList.add('show');
    }
  }
};

window.go = function(id) {
  if (id === 'admin' && !isAdmin()) { toast('Доступ запрещён', 'error'); return; }
  if (id === 'settings' && !isAdmin()) { toast('Доступ запрещён', 'error'); return; }
  if (id === 'journal' && !isAdmin()) { toast('Доступ запрещён', 'error'); return; }
  activeTab = id;
  DB.set('activeTab', id);
  editMode = false;
  render();
};

// ═══════════ ПАНЕЛЬ ДАННЫХ ═══════════
function panelData(key) {
  const sch = SCHEMA[key];
  if (!sch || !Array.isArray(sch.fields)) return '<div class="panel"></div>';

  let items = DB.get(key, []);
  if (!Array.isArray(items)) items = [];

  const q = (searchTerms[key] || '').toLowerCase();
  let filtered = q
    ? items.filter(it => sch.fields.some(f => String(it[f.id] || '').toLowerCase().includes(q)))
    : items;

  if (key === 'cases' && caseFilter !== 'all') {
    filtered = filtered.filter(it => it.status === caseFilter);
  }

  const form = `<div class="card">
    <h3><span>➕ ${esc(sch.label)}</span><span>
      <button class="sm ${editMode ? 'orange' : 'gray'}" onclick="toggleEdit()">${editMode ? 'Готово' : 'Правка'}</button>
      <button class="sm green" onclick="openAddField('${esc(key)}')">+ поле</button>
    </span></h3>
    ${sch.fields.map(f => fieldHTML(key, f)).join('')}
    <button class="green" onclick="addItem('${esc(key)}')">➕ Добавить</button>
  </div>`;

  let filters = '';
  if (key === 'cases') {
    filters = `<div class="filters">
      <button class="${caseFilter==='all'?'active':''}" data-cfilter="all">Все</button>
      <button class="${caseFilter==='В производстве'?'active':''}" data-cfilter="В производстве">В производстве</button>
      <button class="${caseFilter==='В суде'?'active':''}" data-cfilter="В суде">В суде</button>
      <button class="${caseFilter==='Закрыто'?'active':''}" data-cfilter="Закрыто">Закрыто</button>
    </div>`;
  }

  const search = items.length > 3
    ? `<input class="search-inp" placeholder="Поиск..." value="${esc(searchTerms[key] || '')}" data-search="${esc(key)}">`
    : '';

  const list = filtered.length
    ? filtered.map(it => itemHTML(key, it, items.indexOf(it))).join('')
    : '<div class="empty">' + (q ? 'Ничего не найдено' : 'Пока пусто') + '</div>';

  return `<div class="panel ${activeTab === key ? 'active' : ''}" id="panel_${esc(key)}">
    ${form}${filters}${search}
    <div id="list_${esc(key)}">${list}</div>
  </div>`;
}

function renderListOnly(key) {
  const sch = SCHEMA[key];
  if (!sch) return;
  let items = DB.get(key, []);
  if (!Array.isArray(items)) items = [];

  const q = (searchTerms[key] || '').toLowerCase();
  let filtered = q
    ? items.filter(it => sch.fields.some(f => String(it[f.id] || '').toLowerCase().includes(q)))
    : items;

  if (key === 'cases' && caseFilter !== 'all') {
    filtered = filtered.filter(it => it.status === caseFilter);
  }

  const el = document.getElementById('list_' + key);
  if (!el) return;
  el.innerHTML = filtered.length
    ? filtered.map(it => itemHTML(key, it, items.indexOf(it))).join('')
    : '<div class="empty">' + (q ? 'Ничего не найдено' : 'Пока пусто') + '</div>';
}

function fieldHTML(key, f) {
  const id = 'f_' + key + '_' + f.id;
  const ph = esc(f.placeholder || '');
  const editBtn = editMode
    ? ` <span class="field-edit-btn" data-editfield="${esc(key)}|${esc(f.id)}">✎</span>`
    : '';
  const label = `<label>${esc(f.label)}${editBtn}</label>`;
  const type = f.type || 'text';

  if (type === 'textarea') {
    return label + `<textarea id="${id}" placeholder="${ph}"></textarea>`;
  }
  if (type === 'select') {
    return label + `<select id="${id}">${(f.options || []).map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
  }
  return label + `<input id="${id}" type="${type}" placeholder="${ph}">`;
}

function itemHTML(key, it, realIndex) {
  const sch = SCHEMA[key];
  if (!sch || !sch.fields.length) return '';

  const title = String(it[sch.fields[0].id] || '(без названия)');
  const rest = sch.fields.slice(1).map(f => it[f.id]).filter(v => v).join(' • ');
  const isArrest = key === 'arrests' && it._ts;
  const isWanted = key === 'wanted';
  const done = !!it._done;

  let extraClass = '';
  if (isWanted) extraClass = 'wanted';
  if (isArrest) extraClass = 'arrest';
  if (it.priority === 'Высокий') extraClass += ' priority-high';
  if (it.priority === 'Средний') extraClass += ' priority-med';
  if (it.priority === 'Низкий') extraClass += ' priority-low';

  let timerLine = '';
  if (isArrest) {
    const passed = Math.floor((Date.now() - it._ts) / 60000);
    const left = 48 * 60 - passed;
    const hh = Math.floor(passed / 60), mm = passed % 60;
    if (left <= 0) {
      timerLine = '<small style="color:#ff4d4d">48ч ИСТЕКЛО</small>';
    } else {
      const lh = Math.floor(left / 60), lm = left % 60;
      const color = left < 60 ? '#ff4d4d' : left < 240 ? '#ffaa00' : '#4dff88';
      timerLine = `<small>Прошло: ${hh}ч ${mm}м • Осталось: <b style="color:${color}">${lh}ч ${lm}м</b></small>`;
    }
  }

  let deadlineLine = '';
  if (key === 'tasks' && it.deadline) {
    const d = new Date(it.deadline);
    const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) deadlineLine = `<small style="color:#ff4d4d">Просрочено на ${Math.abs(diff)} дн</small>`;
    else if (diff === 0) deadlineLine = '<small style="color:#ffaa00">Сегодня</small>';
    else if (diff <= 3) deadlineLine = `<small style="color:#ffaa00">Через ${diff} дн</small>`;
    else deadlineLine = `<small>До ${it.deadline}</small>`;
  }

  const showProfile = ['cases', 'persons', 'wanted', 'arrests'].includes(key);
  const profileBtn = showProfile
    ? `<button class="sm gray" data-profile="${esc(key)}|${realIndex}">👤</button>`
    : '';
  const addedBy = it._addedBy
    ? `<small style="color:#5b7a99">добавил: ${esc(it._addedBy)}</small>`
    : '';

  return `<div class="item ${done ? 'done' : ''} ${extraClass}">
    <div class="info"><b>${esc(title)}</b>${rest ? '<small>' + esc(rest) + '</small>' : ''}${timerLine}${deadlineLine}${addedBy}</div>
    <div style="display:flex;gap:2px;align-items:flex-start">
      ${profileBtn}
      <button class="sm gray" data-toggleitem="${esc(key)}|${realIndex}">${done ? '↺' : '✓'}</button>
      <button class="sm gray" data-edititem="${esc(key)}|${realIndex}">✎</button>
      <span class="del" data-delitem="${esc(key)}|${realIndex}">✕</span>
    </div>
  </div>`;
}

// ═══════════ ГЛОБАЛЬНЫЕ КЛИКИ ═══════════
document.addEventListener('click', e => {
  const t = e.target.closest('[data-editfield],[data-edititem],[data-delitem],[data-toggleitem],[data-book],[data-editcode],[data-delcode],[data-profile],[data-ctstart],[data-ctdel]');
  if (!t) return;
  const d = t.dataset;

  if (d.editfield) { const [k, id] = d.editfield.split('|'); openField(k, id); return; }
  if (d.edititem) { const [k, i] = d.edititem.split('|'); openEditItem(k, parseInt(i, 10)); return; }
  if (d.delitem) { const [k, i] = d.delitem.split('|'); delItem(k, parseInt(i, 10)); return; }
  if (d.toggleitem) { const [k, i] = d.toggleitem.split('|'); toggleItem(k, parseInt(i, 10)); return; }
  if (d.book !== undefined) { safeSetBook(parseInt(d.book, 10)); return; }
  if (d.editcode !== undefined) { editCode(parseInt(d.editcode, 10)); return; }
  if (d.delcode !== undefined) { delCode(parseInt(d.delcode, 10)); return; }
  if (d.profile) { const [k, i] = d.profile.split('|'); openProfile(k, parseInt(i, 10)); return; }
  if (d.ctstart !== undefined) {
    const i = parseInt(d.ctstart, 10);
    if (customTimers[i]) { tPreset(customTimers[i].min); toast('Запущен: ' + customTimers[i].name); }
    return;
  }
  if (d.ctdel !== undefined) {
    const i = parseInt(d.ctdel, 10);
    if (customTimers[i] && confirm('Удалить?')) {
      customTimers.splice(i, 1);
      DB.set('customTimers', customTimers);
      render();
      schedulePushCloud();
    }
    return;
  }
});

window.safeSetBook = function(idx) {
  try {
    refreshCodeBooks();
    const name = _codeBooks[idx];
    if (name && CODES[name]) {
      codeActive = name;
      DB.set('codeActive', name);
      render();
    }
  } catch (e) { console.error(e); }
};

// ═══════════ CRUD ЗАПИСЕЙ ═══════════
window.addItem = function(key) {
  const sch = SCHEMA[key];
  if (!sch) return;

  const obj = {};
  let hasValue = false;
  sch.fields.forEach(f => {
    const el = document.getElementById('f_' + key + '_' + f.id);
    const v = el ? el.value.trim() : '';
    obj[f.id] = v;
    if (v) hasValue = true;
  });

  if (!hasValue) { toast('Заполни хотя бы одно поле', 'error'); return; }

  if (key === 'arrests') obj._ts = Date.now();
  obj._addedBy = MY_NAME;
  obj._addedAt = Date.now();

  let items = DB.get(key, []);
  if (!Array.isArray(items)) items = [];
  items.unshift(obj);
  markSaving();

  if (!DB.set(key, items)) return;

  addLog('Добавлено', sch.label + ': ' + (obj[sch.fields[0].id] || ''));
  addTimeline(key, items.length - 1, 'Создано', obj[sch.fields[0].id] || '');

  sch.fields.forEach(f => {
    const el = document.getElementById('f_' + key + '_' + f.id);
    if (el && f.type !== 'select') el.value = '';
  });

  toast('Добавлено ✓');
  render();
  schedulePushCloud();
};

window.delItem = function(key, i) {
  let items = DB.get(key, []);
  if (!Array.isArray(items) || !items[i]) return;
  if (!confirm('Удалить запись?')) return;

  const sch = SCHEMA[key];
  markSaving();
  addLog('Удалено', (sch ? sch.label : key) + ': ' + (items[i][sch.fields[0].id] || ''));

  items.splice(i, 1);
  DB.set(key, items);
  toast('Удалено');
  render();
  schedulePushCloud();
};

window.toggleItem = function(key, i) {
  let items = DB.get(key, []);
  if (!Array.isArray(items) || !items[i]) return;
  items[i]._done = !items[i]._done;
  markSaving();
  DB.set(key, items);
  render();
  schedulePushCloud();
};

window.toggleEdit = function() {
  editMode = !editMode;
  render();
};

// ═══════════ РЕДАКТОР ПОЛЯ ═══════════
window.openAddField = function(key) {
  if (!SCHEMA[key]) return;
  fieldTarget = { key, fieldId: null };
  document.getElementById('mfTitle').textContent = 'Добавить поле';
  document.getElementById('mfLabel').value = '';
  document.getElementById('mfType').value = 'text';
  document.getElementById('mfPlaceholder').value = '';
  document.getElementById('mfOptions').value = '';
  document.getElementById('mfOptionsWrap').style.display = 'none';
  document.getElementById('modalField').classList.add('show');
  setTimeout(() => document.getElementById('mfLabel').focus(), 100);
};

window.openField = function(key, fieldId) {
  if (!SCHEMA[key]) return;
  const f = SCHEMA[key].fields.find(x => x.id === fieldId);
  if (!f) return;

  fieldTarget = { key, fieldId };
  document.getElementById('mfTitle').textContent = 'Редактирование поля';
  document.getElementById('mfLabel').value = f.label || '';
  document.getElementById('mfType').value = f.type || 'text';
  document.getElementById('mfPlaceholder').value = f.placeholder || '';
  document.getElementById('mfOptions').value = (f.options || []).join(', ');
  document.getElementById('mfOptionsWrap').style.display = f.type === 'select' ? 'block' : 'none';
  document.getElementById('modalField').classList.add('show');
};

window.mfClose = function() {
  document.getElementById('modalField').classList.remove('show');
  fieldTarget = null;
};

window.mfSave = function() {
  if (!fieldTarget || !SCHEMA[fieldTarget.key]) return;

  const label = document.getElementById('mfLabel').value.trim();
  const type = document.getElementById('mfType').value;
  const placeholder = document.getElementById('mfPlaceholder').value.trim();
  const options = document.getElementById('mfOptions').value.split(',').map(s => s.trim()).filter(Boolean);

  if (!label) { toast('Введи название', 'error'); return; }

  if (fieldTarget.fieldId) {
    const f = SCHEMA[fieldTarget.key].fields.find(x => x.id === fieldTarget.fieldId);
    if (f) { f.label = label; f.type = type; f.placeholder = placeholder; f.options = options; }
  } else {
    SCHEMA[fieldTarget.key].fields.push({ id: uid(), label, type, placeholder, options });
  }

  markSaving();
  DB.set('schema', SCHEMA);
  mfClose();
  toast('Сохранено');
  render();
  schedulePushCloud();
};

window.mfDelete = function() {
  if (!fieldTarget || !fieldTarget.fieldId || !SCHEMA[fieldTarget.key]) return;
  if (!confirm('Удалить поле?')) return;

  SCHEMA[fieldTarget.key].fields = SCHEMA[fieldTarget.key].fields.filter(x => x.id !== fieldTarget.fieldId);
  markSaving();
  DB.set('schema', SCHEMA);
  mfClose();
  toast('Поле удалено');
  render();
  schedulePushCloud();
};

// ═══════════ РЕДАКТОР ЗАПИСИ ═══════════
window.openEditItem = function(key, index) {
  let items = DB.get(key, []);
  if (!Array.isArray(items)) return;
  const it = items[index];
  if (!it) return;

  const sch = SCHEMA[key];
  if (!sch) return;

  itemTarget = { key, index };

  document.getElementById('meFields').innerHTML = sch.fields.map(f => {
    const id = 'me_' + f.id;
    const v = esc(it[f.id] || '');
    if (f.type === 'textarea') {
      return `<label>${esc(f.label)}</label><textarea id="${id}">${v}</textarea>`;
    }
    if (f.type === 'select') {
      return `<label>${esc(f.label)}</label><select id="${id}">${(f.options || []).map(o => `<option ${o === it[f.id] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }
    return `<label>${esc(f.label)}</label><input id="${id}" type="${f.type || 'text'}" value="${v}">`;
  }).join('');

  document.getElementById('modalEditItem').classList.add('show');
};

window.meClose = function() {
  document.getElementById('modalEditItem').classList.remove('show');
  itemTarget = null;
};

window.meSave = function() {
  if (!itemTarget) return;
  const { key, index } = itemTarget;
  let items = DB.get(key, []);
  if (!Array.isArray(items) || !items[index]) return;

  const sch = SCHEMA[key];
  if (!sch) return;

  const oldName = items[index][sch.fields[0].id] || '';
  sch.fields.forEach(f => {
    const el = document.getElementById('me_' + f.id);
    if (el) items[index][f.id] = el.value.trim();
  });
  items[index]._editedBy = MY_NAME;
  items[index]._editedAt = Date.now();

  markSaving();
  DB.set(key, items);
  addTimeline(key, index, 'Изменено', oldName);
  meClose();
  toast('Сохранено');
  render();
  schedulePushCloud();
};

// ═══════════ ПРОФИЛЬ ФИГУРАНТА ═══════════
window.openProfile = function(key, index) {
  let items = DB.get(key, []);
  if (!Array.isArray(items) || !items[index]) return;

  const sch = SCHEMA[key];
  const it = items[index];
  const name = it[sch.fields[0].id] || '(без имени)';

  const matches = {};
  Object.keys(SCHEMA).forEach(k => {
    const arr = DB.get(k, []);
    if (!Array.isArray(arr)) return;
    const found = arr.filter(x => Object.values(x).some(v => String(v).toLowerCase() === name.toLowerCase()));
    if (found.length) matches[k] = found;
  });

  const tl = getTimeline(key, index);
  const tlAll = DB.get('timeline', []).filter(x => x.detail && x.detail.toLowerCase().includes(name.toLowerCase()));

  let html = `<h3>👤 ${esc(name)}</h3>`;
  html += `<div class="profile-section"><h4>Информация</h4>`;
  sch.fields.forEach(f => {
    if (it[f.id]) html += `<div style="font-size:12px;padding:2px 0"><b>${esc(f.label)}:</b> ${esc(it[f.id])}</div>`;
  });
  html += `</div>`;

  if (tl.length || tlAll.length) {
    const all = tl.concat(tlAll).sort((a, b) => b.t - a.t).slice(0, 20);
    html += `<div class="profile-section"><h4>Хронология (${all.length})</h4><div class="timeline">`;
    all.forEach(x => {
      const dd = new Date(x.t);
      const userTag = x.user ? ` <span class="badge">${esc(x.user)}</span>` : '';
      html += `<div class="timeline-item"><time>${dd.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time><b>${esc(x.action)}</b> ${esc(x.detail || '')}${userTag}</div>`;
    });
    html += `</div></div>`;
  }

  const matchKeys = Object.keys(matches);
  if (matchKeys.length) {
    html += `<div class="profile-section"><h4>Связи (${matchKeys.length})</h4>`;
    matchKeys.forEach(k => {
      html += `<div style="font-size:11px;margin-top:4px;color:var(--accent)"><b>${esc(SCHEMA[k].label)}:</b></div>`;
      matches[k].forEach(m => {
        const title = m[SCHEMA[k].fields[0].id] || '—';
        const rest = SCHEMA[k].fields.slice(1).map(f => m[f.id]).filter(Boolean).join(' • ');
        html += `<div class="item" style="margin:2px 0"><div class="info"><b>${esc(title)}</b>${rest ? '<small>' + esc(rest) + '</small>' : ''}</div></div>`;
      });
    });
    html += `</div>`;
  }

  html += `<div class="row" style="margin-top:12px">
    <button class="gray" onclick="document.getElementById('modalProfile').classList.remove('show')">Закрыть</button>
  </div>`;

  document.getElementById('profileBox').innerHTML = html;
  document.getElementById('modalProfile').classList.add('show');
};

// ═══════════ ПАНЕЛЬ ДАШБОРДА ═══════════
function panelDash() {
  const totalArticles = Object.values(CODES).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0);
  const wanted = (DB.get('wanted', []) || []).length;
  const arrests = (DB.get('arrests', []) || []).length;
  const tasks = (DB.get('tasks', []) || []).filter(t => !t._done).length;
  const cases = (DB.get('cases', []) || []).length;
  const persons = (DB.get('persons', []) || []).length;

  return `<div class="panel ${activeTab === 'dash' ? 'active' : ''}">
    <div class="stat">
      <div><b>${cases}</b><span>Дел</span></div>
      <div><b>${wanted}</b><span>В розыске</span></div>
      <div><b>${arrests}</b><span>Задержано</span></div>
      <div><b>${tasks}</b><span>Задач</span></div>
      <div><b>${persons}</b><span>Лиц</span></div>
      <div><b>${totalArticles}</b><span>Статей</span></div>
    </div>
    <div class="card">
      <h3>👥 Отдел</h3>
      <div style="font-size:12px;padding:4px 0">Вы: <b>${esc(CURRENT_USER ? CURRENT_USER.name : '—')}</b></div>
      <button class="green" onclick="showOnline()">👥 Кто онлайн</button>
      ${CLOUD_MODE
        ? `<button class="red" onclick="stopCloud()">⛔ Отключиться</button>`
        : `<button class="green" onclick="startCloud()">☁️ Подключиться</button>`}
      <div class="hint">${CLOUD_MODE ? '🟢 Синхронизация активна' : '🔴 Офлайн'}</div>
    </div>
    <div class="card">
      <h3>Последние действия</h3>
      ${LOG.slice(0, 8).map(l => {
        const dd = new Date(l.t);
        return `<div class="log-entry"><time>${dd.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time><span class="act">${esc(l.action)}</span>${esc(l.detail)}</div>`;
      }).join('') || '<div class="hint">Пусто</div>'}
    </div>
  </div>`;
}

window.showOnline = function() {
  const modal = document.getElementById('modalOnline');
  if (modal) modal.classList.add('show');
  const box = document.getElementById('onlineBox');
  if (!box) return;
  box.innerHTML = '<div class="hint">Загрузка...</div>';

  try {
    const p = getOnlineUsers();
    p.then(users => {
      users = Array.isArray(users) ? users : [];
      if (!users.length) box.innerHTML = '<div class="hint">Пока никого (или офлайн)</div>';
      else box.innerHTML = '<div class="online-list">' + users.map(u =>
        `<span class="online-user">${esc(u)}${u === MY_NAME ? ' (вы)' : ''}</span>`
      ).join('') + '</div>';
    }).catch(() => {
      box.innerHTML = '<div class="hint">Ошибка загрузки</div>';
    });
  } catch (e) {
    box.innerHTML = '<div class="hint">Ошибка</div>';
  }
};

// ═══════════ ПАНЕЛЬ ДОКУМЕНТОВ ═══════════
const DOCS = {
  arrest: { label: 'Протокол задержания', fields: [['name','ФИО'],['dob','Дата рождения'],['place','Место'],['time','Время'],['art','Статья'],['slead','Следователь'],['text','Обстоятельства','textarea']] },
  search: { label: 'Протокол обыска', fields: [['place','Адрес'],['date','Дата'],['time','Время'],['basis','Основание'],['persons','Присутствующие'],['found','Обнаружено'],['slead','Следователь'],['text','Ход обыска','textarea']] },
  interrog: { label: 'Протокол допроса', fields: [['name','ФИО'],['role','Статус'],['dob','Дата рождения'],['date','Дата'],['time','Время'],['slead','Следователь'],['questions','Вопросы и ответы','textarea']] },
  wanted: { label: 'Постановление в розыск', fields: [['name','ФИО'],['dob','Дата рождения'],['art','Статья'],['level','Уровень'],['desc','Приметы','textarea'],['slead','Следователь']] },
  report: { label: 'Рапорт', fields: [['slead','От кого'],['to','Кому'],['subject','Тема'],['text','Текст','textarea']] },
  inspection: { label: 'Протокол осмотра', fields: [['place','Место'],['date','Дата'],['time','Время'],['persons','Присутствующие'],['slead','Следователь'],['found','Обнаружено','textarea']] }
};
window.docType = DB.get('docType', 'arrest');
if (!DOCS[window.docType]) window.docType = 'arrest';

function panelDocs() {
  return `<div class="panel ${activeTab === 'docs' ? 'active' : ''}">
    <div class="card">
      <h3>📄 Документы</h3>
      <label>Тип</label>
      <select id="dType" onchange="onDocTypeChange()">
        ${Object.entries(DOCS).map(([k, v]) => `<option value="${esc(k)}" ${k === docType ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}
      </select>
      <div id="docForm"></div>
      <div class="row" style="margin-top:8px">
        <button class="green" onclick="genDoc()">Сформировать</button>
        <button onclick="copyDoc()">Копировать</button>
        <button class="gray" onclick="printDoc()">🖨 PDF</button>
      </div>
      <div class="code-out" id="docOut" style="display:none"></div>
    </div>
  </div>`;
}

window.onDocTypeChange = function() {
  const sel = document.getElementById('dType');
  if (!sel) return;
  window.docType = sel.value;
  DB.set('docType', sel.value);
  renderDocForm();
};

function renderDocForm() {
  const sel = document.getElementById('dType');
  if (!sel) return;
  window.docType = sel.value;
  const doc = DOCS[window.docType];
  if (!doc) return;

  document.getElementById('docForm').innerHTML = doc.fields.map(f => {
    const [id, label, kind] = f;
    if (kind === 'textarea') return `<label>${esc(label)}</label><textarea id="df_${esc(id)}"></textarea>`;
    return `<label>${esc(label)}</label><input id="df_${esc(id)}">`;
  }).join('');
}

window.genDoc = function() {
  const doc = DOCS[window.docType];
  if (!doc) return;

  const v = id => {
    const el = document.getElementById('df_' + id);
    return el && el.value.trim() ? el.value.trim() : '—';
  };
  const d = today();

  const T = {
    arrest: () => `ПРОТОКОЛ ЗАДЕРЖАНИЯ\n\nг. Москва, ${d}\n\nСледователь СК РФ ${v('slead')} задержал:\n\nФИО: ${v('name')}\nДата рождения: ${v('dob')}\nМесто: ${v('place')}\nВремя: ${v('time')}\nСтатья: ${v('art')}\n\n${v('text')}\n\nСледователь: _______________ / ${v('slead')}`,
    search: () => `ПРОТОКОЛ ОБЫСКА\n\nг. Москва, ${v('date') === '—' ? d : v('date')}\n\nСледователь ${v('slead')}\nАдрес: ${v('place')}\nВремя: ${v('time')}\nПрисутствуют: ${v('persons')}\n\n${v('text')}\n\nИзъято: ${v('found')}\n\nСледователь: _______________ / ${v('slead')}`,
    interrog: () => `ПРОТОКОЛ ДОПРОСА\n\nг. Москва, ${v('date') === '—' ? d : v('date')} ${v('time')}\n\nСледователь ${v('slead')}\nФИО: ${v('name')}\nСтатус: ${v('role')}\nДР: ${v('dob')}\n\n${v('questions')}\n\nСледователь: _______________ / ${v('slead')}`,
    wanted: () => `ПОСТАНОВЛЕНИЕ О РОЗЫСКЕ\n\nг. Москва, ${d}\n\n${v('level')} розыск:\n${v('name')}\nДР: ${v('dob')}\nСтатья: ${v('art')}\n\nПриметы:\n${v('desc')}\n\nСледователь: _______________ / ${v('slead')}`,
    report: () => `РАПОРТ\n\nКому: ${v('to')}\nОт: ${v('slead')}\nТема: ${v('subject')}\nДата: ${d}\n\n${v('text')}\n\nПодпись: _______________`,
    inspection: () => `ПРОТОКОЛ ОСМОТРА\n\nг. Москва, ${v('date') === '—' ? d : v('date')} ${v('time')}\n\nМесто: ${v('place')}\nПрисутствуют: ${v('persons')}\nСледователь: ${v('slead')}\n\nОбнаружено:\n${v('found')}\n\nСледователь: _______________ / ${v('slead')}`
  };

  const out = document.getElementById('docOut');
  out.style.display = 'block';
  out.textContent = (T[window.docType] || (() => ''))();
  addLog('Документ', DOCS[window.docType].label);
  markSaving();
};

window.copyDoc = function() {
  const out = document.getElementById('docOut');
  if (!out || !out.textContent) { toast('Сначала сформируй', 'error'); return; }
  copyText(out.textContent);
  toast('Скопировано');
};

window.printDoc = function() {
  const out = document.getElementById('docOut');
  if (!out || !out.textContent) { toast('Сначала сформируй', 'error'); return; }
  const w = window.open('', '_blank');
  w.document.write('<pre style="font-family:monospace;white-space:pre-wrap;padding:20px">' + esc(out.textContent) + '</pre>');
  w.document.close();
  setTimeout(() => w.print(), 300);
};

// ═══════════ ПАНЕЛЬ КОДЕКСОВ ═══════════
function panelCodes() {
  try {
    let books = Object.keys(CODES);
    if (!books.length) {
      CODES['УК РФ'] = JSON.parse(JSON.stringify(FACTORY_CODES['УК РФ']));
      DB.set('codes', CODES);
      window.codeActive = 'УК РФ';
      books = Object.keys(CODES);
    }
    if (!window.codeActive || !CODES[window.codeActive]) {
      window.codeActive = books[0];
      DB.set('codeActive', window.codeActive);
    }
    refreshCodeBooks();

    const tabsHTML = books.map((b, idx) =>
      `<span class="code-tab ${b === window.codeActive ? 'active' : ''}" data-book="${idx}">${esc(b)} <span class="cnt">${CODES[b].length}</span></span>`
    ).join('') + `<span class="code-tab" style="border-color:#4dff88" data-action="addbook">+ Кодекс</span>`;

    const current = CODES[window.codeActive] || [];
    const q = (searchTerms['codes'] || '').toLowerCase();
    const filtered = q
      ? current.map((c, i) => ({ ...c, _i: i })).filter(c => (c.art + c.name + c.min).toLowerCase().includes(q))
      : current.map((c, i) => ({ ...c, _i: i }));

    const canEdit = canEditLaws();
    const list = filtered.length
      ? filtered.map(c => `<div class="item">
          <div class="info"><b>${esc(c.art)}</b> — ${esc(c.name)}<small>${esc(c.min)}</small></div>
          <div style="display:flex;gap:2px">${canEdit ? `<button class="sm gray" data-editcode="${c._i}">✎</button><span class="del" data-delcode="${c._i}">✕</span>` : ''}</div>
        </div>`).join('')
      : '<div class="empty">' + (q ? 'Ничего не найдено' : 'Статей нет') + '</div>';

    return `<div class="panel ${activeTab === 'codes' ? 'active' : ''}">
      <div class="card"><h3>📖 Кодексы</h3><div class="code-tabs">${tabsHTML}</div></div>
      ${canEdit ? `<div class="card">
        <h3>➕ Статья</h3>
        <div class="grid2">
          <div><label>Статья</label><input id="acArt"></div>
          <div><label>Наказание</label><input id="acMin"></div>
        </div>
        <label>Название</label>
        <input id="acName">
        <button class="green" onclick="addCode()">➕ Добавить</button>
        <button class="gray" onclick="renameBook()">✎ Переименовать</button>
        <button class="red" onclick="delBook()">🗑 Удалить кодекс</button>
      </div>` : ''}
      ${current.length > 5 ? `<input class="search-inp" id="codeSearch" placeholder="Поиск..." value="${esc(searchTerms['codes'] || '')}">` : ''}
      <div>${list}</div>
    </div>`;
  } catch (e) {
    return `<div class="panel active"><div class="card"><h3>Ошибка</h3><div class="hint">${esc(e.message)}</div></div></div>`;
  }
}

window.resetCodes = function() {
  if (!canEditLaws()) { toast('Нет прав', 'error'); return; }
  if (!confirm('Сбросить кодексы?')) return;
  window.CODES = JSON.parse(JSON.stringify(FACTORY_CODES));
  DB.set('codes', CODES);
  window.codeActive = 'УК РФ';
  DB.set('codeActive', codeActive);
  refreshCodeBooks();
  render();
  schedulePushCloud();
};

window.addBook = function() {
  if (!canEditLaws()) { toast('Нет прав', 'error'); return; }
  const n = prompt('Название:');
  if (!n) return;
  CODES[n.trim()] = [];
  DB.set('codes', CODES);
  window.codeActive = n.trim();
  DB.set('codeActive', n.trim());
  refreshCodeBooks();
  render();
  schedulePushCloud();
};

window.renameBook = function() {
  if (!canEditLaws()) return;
  if (!window.codeActive) return;
  const old = window.codeActive;
  const n = prompt('Новое название:', old);
  if (!n || n.trim() === old) return;
  CODES[n.trim()] = CODES[old];
  delete CODES[old];
  window.codeActive = n.trim();
  DB.set('codes', CODES);
  DB.set('codeActive', codeActive);
  refreshCodeBooks();
  render();
  schedulePushCloud();
};

window.delBook = function() {
  if (!canEditLaws()) return;
  if (!window.codeActive) return;
  if (!confirm('Удалить?')) return;
  delete CODES[window.codeActive];
  const r = Object.keys(CODES);
  window.codeActive = r.length ? r[0] : 'УК РФ';
  if (!CODES[window.codeActive]) CODES[window.codeActive] = [];
  DB.set('codes', CODES);
  DB.set('codeActive', codeActive);
  refreshCodeBooks();
  render();
  schedulePushCloud();
};

window.addCode = function() {
  if (!canEditLaws()) return;
  if (!window.codeActive || !CODES[window.codeActive]) return;
  const a = document.getElementById('acArt');
  const n = document.getElementById('acName');
  const m = document.getElementById('acMin');
  if (!a || !n) return;
  if (!a.value.trim() || !n.value.trim()) { toast('Заполни', 'error'); return; }
  CODES[window.codeActive].push({
    art: a.value.trim(),
    name: n.value.trim(),
    min: m ? m.value.trim() : ''
  });
  DB.set('codes', CODES);
  a.value = '';
  n.value = '';
  if (m) m.value = '';
  render();
  schedulePushCloud();
};

window.delCode = function(i) {
  if (!canEditLaws()) return;
  if (!window.codeActive || !CODES[window.codeActive]) return;
  if (!confirm('Удалить статью?')) return;
  CODES[window.codeActive].splice(i, 1);
  DB.set('codes', CODES);
  render();
  schedulePushCloud();
};

window.editCode = function(i) {
  if (!canEditLaws()) return;
  if (!window.codeActive || !CODES[window.codeActive]) return;
  const c = CODES[window.codeActive][i];
  if (!c) return;
  const art = prompt('Статья:', c.art);
  if (art === null) return;
  const name = prompt('Название:', c.name);
  if (name === null) return;
  c.art = art.trim();
  c.name = name.trim();
  DB.set('codes', CODES);
  render();
  schedulePushCloud();
};

// ═══════════ ПАНЕЛЬ ТАЙМЕРОВ ═══════════
let tSec = 48 * 3600, tInt = null, tEnd = null;

function panelTimer() {
  return `<div class="panel ${activeTab === 'timer' ? 'active' : ''}">
    <div class="card">
      <h3>⏱ Срок задержания</h3>
      <div class="timer" id="tDisp">${fmtTime(tSec)}</div>
      <div class="row">
        <button class="green" onclick="tStart()">▶ Старт</button>
        <button onclick="tPause()">⏸ Пауза</button>
        <button class="red" onclick="tReset()">↻ Сброс</button>
      </div>
      <div class="hint" id="tInfo">Не запущен</div>
    </div>
    <div class="card">
      <h3>Пресеты</h3>
      <div class="row">
        <button onclick="tPreset(15)">15 мин</button>
        <button onclick="tPreset(60)">1 ч</button>
        <button onclick="tPreset(180)">3 ч</button>
        <button onclick="tPreset(1440)">24 ч</button>
      </div>
    </div>
    <div class="card">
      <h3>Свои таймеры</h3>
      <div class="row">
        <div><label>Название</label><input id="ctName"></div>
        <div><label>Минут</label><input id="ctMin" type="number" value="30"></div>
      </div>
      <button class="green" onclick="addCustomTimer()">Добавить</button>
      <div style="margin-top:8px">
        ${customTimers.map((ct, i) =>
          `<div class="item"><div class="info"><b>${esc(ct.name)}</b><small>${ct.min} мин</small></div><div><button class="sm green" data-ctstart="${i}">▶</button><span class="del" data-ctdel="${i}">✕</span></div></div>`
        ).join('') || '<div class="hint">Пусто</div>'}
      </div>
    </div>
  </div>`;
}

window.addCustomTimer = function() {
  const n = document.getElementById('ctName').value.trim();
  const m = parseInt(document.getElementById('ctMin').value, 10);
  if (!n || !m || m < 1) { toast('Заполни', 'error'); return; }
  customTimers.push({ name: n, min: m });
  DB.set('customTimers', customTimers);
  render();
  schedulePushCloud();
};

function updTimer() {
  const el = document.getElementById('tDisp');
  if (!el) return;
  el.textContent = fmtTime(tSec);
}

window.tStart = function() {
  if (tInt) return;
  const info = document.getElementById('tInfo');
  if (info) info.textContent = 'Запущен ' + nowTime();
  tEnd = Date.now() + tSec * 1000;
  tInt = setInterval(() => {
    tSec = Math.max(0, Math.round((tEnd - Date.now()) / 1000));
    updTimer();
    if (tSec <= 0) {
      clearInterval(tInt);
      tInt = null;
      toast('Время истекло!', 'error');
    }
  }, 1000);
};

window.tPause = function() {
  clearInterval(tInt);
  tInt = null;
};

window.tReset = function() {
  tPause();
  tSec = 48 * 3600;
  updTimer();
};

window.tPreset = function(min) {
  tPause();
  tSec = Math.round(min * 60);
  updTimer();
};

// ═══════════ ПАНЕЛЬ ЖУРНАЛА ═══════════
function panelJournal() {
  return `<div class="panel ${activeTab === 'journal' ? 'active' : ''}">
    <div class="card">
      <h3>📜 Журнал (${LOG.length})</h3>
      <button class="red" onclick="if(confirm('Очистить?')){window.LOG=[];DB.set('log',LOG);render();schedulePushCloud();}">Очистить</button>
    </div>
    <div class="card">
      ${LOG.map(l => {
        const dd = new Date(l.t);
        return `<div class="log-entry"><time>${dd.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time><span class="act">${esc(l.action)}</span>${esc(l.detail)}</div>`;
      }).join('') || '<div class="empty">Пусто</div>'}
    </div>
  </div>`;
}

// ═══════════ ПАНЕЛЬ НАСТРОЕК ═══════════
function panelSettings() {
  return `<div class="panel ${activeTab === 'settings' ? 'active' : ''}">
    <div class="card">
      <h3>👤 Профиль</h3>
      <div style="font-size:12px;padding:4px 0">
        Логин: <b>${esc(CURRENT_USER ? CURRENT_USER.login : '—')}</b><br>
        Имя: <b>${esc(CURRENT_USER ? CURRENT_USER.name : '—')}</b><br>
        Роль: <b>${esc(CURRENT_USER ? CURRENT_USER.role : '—')}</b>
      </div>
      <button class="red" onclick="doLogout()">🚪 Выйти</button>
    </div>
    <div class="card">
      <h3>☁️ Синхронизация</h3>
      <div style="font-size:12px;padding:4px 0">Статус: <b>${CLOUD_MODE ? '🟢 Онлайн' : '🔴 Офлайн'}</b></div>
      ${CLOUD_MODE
        ? `<button class="red" onclick="stopCloud()">⛔ Отключиться</button><button class="green" onclick="pushCloud(true)">📤 Отправить</button>`
        : `<button class="green" onclick="startCloud()">☁️ Подключиться</button>`}
    </div>
    <div class="card"><h3>🎨 Тема</h3><button onclick="toggleTheme()">${THEME === 'light' ? '🌙 Тёмная' : '☀️ Светлая'}</button></div>
  </div>`;
}

window.renameTab = function(k) {
  if (!isAdmin()) return;
  const n = prompt('Новое:', SCHEMA[k].label);
  if (!n) return;
  SCHEMA[k].label = n.trim();
  DB.set('schema', SCHEMA);
  render();
  schedulePushCloud();
};

window.delTab = function(k) {
  if (!isAdmin()) return;
  if (!confirm('Удалить?')) return;
  delete SCHEMA[k];
  DB.set('schema', SCHEMA);
  if (activeTab === k) window.activeTab = 'dash';
  render();
  schedulePushCloud();
};

window.newTab = function() {
  if (!isAdmin()) return;
  const n = prompt('Название:');
  if (!n) return;
  const k = 'c' + Date.now();
  SCHEMA[k] = {
    label: '📌 ' + n.trim(),
    fields: [{ id: 'name', label: 'Название', type: 'text' }]
  };
  DB.set('schema', SCHEMA);
  render();
  schedulePushCloud();
};

window.fullReset = function() {
  if (!isAdmin()) return;
  if (!confirm('УДАЛИТЬ ВСЁ?')) return;
  if (!confirm('Точно?')) return;
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.indexOf('sk_') === 0) localStorage.removeItem(k);
    });
  } catch (e) {}
  location.reload();
};

// ═══════════ ЭКСПОРТ / ИМПОРТ ═══════════
window.expAll = function() {
  if (!isAdmin()) { toast('Только для админов', 'error'); return; }
  try {
    const data = collectAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sk_backup_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Экспорт готов');
  } catch (e) { toast('Ошибка', 'error'); }
};

window.impAll = function(e) {
  if (!isAdmin()) { toast('Только для админов', 'error'); return; }
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      applyAll(d, false);
      toast('Импорт завершён');
      schedulePushCloud();
    } catch (err) { toast('Ошибка файла', 'error'); }
  };
  r.readAsText(f);
  e.target.value = '';
};
