'use strict';

// ═══════════ ХРАНИЛИЩЕ ═══════════
window.DB = {
  get(k, d) {
    try {
      const v = localStorage.getItem('sk_' + k);
      if (v === null) return d;
      const p = JSON.parse(v);
      return p === null ? d : p;
    } catch (e) { return d; }
  },
  set(k, v) {
    try {
      localStorage.setItem('sk_' + k, JSON.stringify(v));
      return true;
    } catch (e) {
      toast('Хранилище переполнено', 'error');
      return false;
    }
  },
  del(k) { try { localStorage.removeItem('sk_' + k); } catch (e) {} }
};

// ═══════════ СОСТОЯНИЕ ═══════════
window.CURRENT_USER = null;
window.MY_NAME = '';
window.MY_ID = DB.get('myId', '') || (() => {
  const id = 'u' + Date.now() + Math.random().toString(36).slice(2, 6);
  DB.set('myId', id);
  return id;
})();

window.USERS_KEY = 'users';
window.PWDS_KEY = 'pwds';
window.PENDING_USER = null;
window.activeTab = DB.get('activeTab', 'dash');
window.editMode = false;
window.fieldTarget = null;
window.itemTarget = null;
window.searchTerms = {};
window.caseFilter = 'all';
window.THEME = DB.get('theme', 'dark');
window._codeBooks = [];
window.CLOUD_MODE = false;
window._cloudUpdating = false;
window.customTimers = DB.get('customTimers', []);
if (!Array.isArray(customTimers)) customTimers = [];

// ═══════════ СХЕМА ═══════════
window.FACTORY = {
  cases: { label: '📁 Дела', fields: [
    { id: 'num', label: 'Номер дела', type: 'text', placeholder: '№ 001-2026' },
    { id: 'name', label: 'Фигурант', type: 'text' },
    { id: 'art', label: 'Статья', type: 'text' },
    { id: 'priority', label: 'Приоритет', type: 'select', options: ['Высокий','Средний','Низкий'] },
    { id: 'status', label: 'Статус', type: 'select', options: ['В производстве','На проверке','В суде','Приостановлено','Прекращено','Закрыто'] },
    { id: 'note', label: 'Заметка', type: 'textarea' }
  ]},
  wanted: { label: '🎯 Розыск', fields: [
    { id: 'name', label: 'ФИО', type: 'text' },
    { id: 'art', label: 'Статья', type: 'text' },
    { id: 'level', label: 'Уровень', type: 'select', options: ['Федеральный','Региональный','Местный'] },
    { id: 'desc', label: 'Приметы', type: 'textarea' }
  ]},
  arrests: { label: '🔒 Задержанные', fields: [
    { id: 'name', label: 'ФИО', type: 'text' },
    { id: 'art', label: 'Статья', type: 'text' },
    { id: 'time', label: 'Время', type: 'time' },
    { id: 'place', label: 'Место', type: 'text' },
    { id: 'witness', label: 'Свидетели', type: 'text' },
    { id: 'note', label: 'Примечание', type: 'textarea' }
  ]},
  persons: { label: '👤 Лица', fields: [
    { id: 'name', label: 'ФИО', type: 'text' },
    { id: 'role', label: 'Роль', type: 'select', options: ['Подозреваемый','Обвиняемый','Свидетель','Потерпевший','Понятой','Адвокат','Прокурор','Коллега СК'] },
    { id: 'contact', label: 'Контакт / ID', type: 'text' },
    { id: 'desc', label: 'Приметы', type: 'textarea' }
  ]},
  evidence: { label: '🧾 Доказательства', fields: [
    { id: 'name', label: 'Название', type: 'text' },
    { id: 'case', label: 'Дело', type: 'text' },
    { id: 'place', label: 'Место обнаружения', type: 'text' },
    { id: 'date', label: 'Дата', type: 'date' },
    { id: 'desc', label: 'Описание', type: 'textarea' }
  ]},
  addresses: { label: '🏠 Адреса', fields: [
    { id: 'address', label: 'Адрес', type: 'text' },
    { id: 'owner', label: 'Владелец', type: 'text' },
    { id: 'type', label: 'Тип', type: 'select', options: ['Жилой','Коммерческий','Склад','Гараж','Заброшенный'] },
    { id: 'note', label: 'Заметка', type: 'textarea' }
  ]},
  transport: { label: '🚗 Транспорт', fields: [
    { id: 'plate', label: 'Гос. номер', type: 'text' },
    { id: 'model', label: 'Марка / модель', type: 'text' },
    { id: 'owner', label: 'Владелец', type: 'text' },
    { id: 'color', label: 'Цвет', type: 'text' },
    { id: 'note', label: 'Заметка', type: 'textarea' }
  ]},
  contacts: { label: '📞 Контакты', fields: [
    { id: 'name', label: 'Имя / позывной', type: 'text' },
    { id: 'type', label: 'Тип', type: 'select', options: ['Телефон','Discord','Telegram','Другое'] },
    { id: 'value', label: 'Значение', type: 'text' },
    { id: 'note', label: 'Заметка', type: 'textarea' }
  ]},
  tasks: { label: '✅ Задачи', fields: [
    { id: 'text', label: 'Задача', type: 'text' },
    { id: 'priority', label: 'Приоритет', type: 'select', options: ['Высокий','Средний','Низкий'] },
    { id: 'deadline', label: 'Срок', type: 'date' },
    { id: 'note', label: 'Заметка', type: 'textarea' }
  ]},
  notes: { label: '🗒 Заметки', fields: [
    { id: 'text', label: 'Текст', type: 'textarea' }
  ]}
};

// ═══════════ КОДЕКСЫ ═══════════
window.FACTORY_CODES = {
  "УК РФ": [
    { art: "Статья 10.1 (Убийство)", name: "Убийство", min: "6 уровня" },
    { art: "Статья 10.2 (Убийство)", name: "Убийство при отягчающих", min: "6 уровня" },
    { art: "Статья 11.1 (Тяжкий вред)", name: "Тяжкий вред здоровью", min: "5 уровня" },
    { art: "Статья 11.2", name: "Средний вред здоровью", min: "3 уровня" },
    { art: "Статья 11.3", name: "Лёгкий вред здоровью", min: "1 уровня" },
    { art: "Статья 12.1 (Угроза)", name: "Угроза убийством", min: "2 уровня" },
    { art: "Статья 12.2", name: "Угроза с оружием", min: "3 уровня" },
    { art: "Статья 13.1", name: "Оставление в опасности", min: "1 уровня" },
    { art: "Статья 14.1 (Похищение)", name: "Похищение человека", min: "5 уровня" },
    { art: "Статья 15.1 (Клевета)", name: "Клевета", min: "1 уровня" },
    { art: "Статья 17.1", name: "Проникновение в жилище", min: "1 уровня" },
    { art: "Статья 18.1 (Кража)", name: "Кража", min: "2 уровня" },
    { art: "Статья 18.2 (Грабёж)", name: "Грабёж", min: "4 уровня" },
    { art: "Статья 18.3 (Разбой)", name: "Разбой", min: "6 уровня" },
    { art: "Статья 19.1 (Мошенничество)", name: "Мошенничество", min: "2 уровня" },
    { art: "Статья 22.1 (Угон)", name: "Угон ТС", min: "2 уровня" },
    { art: "Статья 23.1 (Терроризм)", name: "Теракт", min: "6 уровня" },
    { art: "Статья 24.1 (ОПГ)", name: "Создание ОПГ", min: "6 уровня" },
    { art: "Статья 27.1", name: "Хранение наркотиков", min: "2 уровня" },
    { art: "Статья 27.2", name: "Сбыт наркотиков", min: "6 уровня" },
    { art: "Статья 29.1", name: "Злоупотребление", min: "2 уровня" },
    { art: "Статья 31.1 (Взятка)", name: "Получение взятки", min: "6 уровня" },
    { art: "Статья 31.2", name: "Дача взятки", min: "4 уровня" },
    { art: "Статья 40.1", name: "На представителя власти", min: "5 уровня" },
    { art: "Статья 46.1 (Подделка)", name: "Подделка документов", min: "2 уровня" }
  ],
  "УПК РФ": [],
  "КоАП РФ": [],
  "ФЗ": [],
  "ФЦК": []
};

window.SCHEMA = DB.get('schema', null);
if (!SCHEMA || typeof SCHEMA !== 'object' || !Object.keys(SCHEMA).length) {
  SCHEMA = JSON.parse(JSON.stringify(FACTORY));
  DB.set('schema', SCHEMA);
} else {
  let migrated = false;
  Object.keys(FACTORY).forEach(k => {
    if (!SCHEMA[k]) { SCHEMA[k] = JSON.parse(JSON.stringify(FACTORY[k])); migrated = true; }
  });
  if (migrated) DB.set('schema', SCHEMA);
}

window.CODES = DB.get('codes', null);
if (!CODES || typeof CODES !== 'object' || !Object.keys(CODES).length) {
  CODES = JSON.parse(JSON.stringify(FACTORY_CODES));
  DB.set('codes', CODES);
} else {
  const укEmpty = !CODES['УК РФ'] || !Array.isArray(CODES['УК РФ']) || CODES['УК РФ'].length === 0;
  if (укEmpty && FACTORY_CODES['УК РФ'].length > 0) {
    CODES['УК РФ'] = JSON.parse(JSON.stringify(FACTORY_CODES['УК РФ']));
    DB.set('codes', CODES);
  }
  ['УПК РФ','КоАП РФ','ФЗ','ФЦК'].forEach(k => { if (!Array.isArray(CODES[k])) CODES[k] = []; });
}

window.codeActive = DB.get('codeActive', 'УК РФ');
if (!CODES[codeActive]) codeActive = Object.keys(CODES)[0] || '';

// ═══════════ АДМИН ПО УМОЛЧАНИЮ ═══════════
function ensureAdmin() {
  const users = DB.get(USERS_KEY, {});
  if (!users.admin) {
    users.admin = {
      login: 'admin',
      name: 'Администратор',
      role: 'admin',
      perms: { all: true },
      created: Date.now()
    };
    DB.set(USERS_KEY, users);
    const pwds = DB.get(PWDS_KEY, {});
    pwds.admin = hashPwd('admin2026');
    DB.set(PWDS_KEY, pwds);
  }
}
ensureAdmin();

// ═══════════ ХЕЛПЕРЫ ═══════════
window.refreshCodeBooks = function() { _codeBooks = Object.keys(CODES); };
window.canEditLaws = function() {
  return CURRENT_USER && (CURRENT_USER.role === 'admin' || (CURRENT_USER.perms && CURRENT_USER.perms.laws));
};
window.isAdmin = function() {
  return CURRENT_USER && CURRENT_USER.role === 'admin';
};

// ═══════════ ЛОГИ ═══════════
window.LOG = DB.get('log', []);
window.addLog = function(action, detail) {
  LOG.unshift({ t: Date.now(), action, detail: detail || '', user: MY_NAME });
  if (LOG.length > 300) LOG = LOG.slice(0, 300);
  DB.set('log', LOG);
};
window.addTimeline = function(entity, entityId, action, detail) {
  let tl = DB.get('timeline', []);
  tl.unshift({
    t: Date.now(), entity, entityId: String(entityId),
    action, detail: detail || '', user: MY_NAME
  });
  if (tl.length > 500) tl = tl.slice(0, 500);
  DB.set('timeline', tl);
};
window.getTimeline = function(entity, entityId) {
  return DB.get('timeline', []).filter(x => x.entity === entity && x.entityId === String(entityId));
};

// ═══════════ СИНХРОНИЗАЦИЯ — ЗАГЛУШКИ ═══════════
// Переопределяются в firebase.js когда Firebase готов
window.collectAll = function() {
  const data = {
    schema: SCHEMA, codes: CODES, codeActive, log: LOG,
    timeline: DB.get('timeline', []),
    users: DB.get(USERS_KEY, {}),
    pwds: DB.get(PWDS_KEY, {}),
    customTimers: customTimers,
    _updated: Date.now(), _updatedBy: MY_ID, _version: 1
  };
  Object.keys(SCHEMA).forEach(k => { data[k] = DB.get(k, []); });
  return data;
};

window.applyAll = function(d, silent) {
  if (!d || typeof d !== 'object') return;
  if (d._updatedBy === MY_ID && Date.now() - d._updated < 3000) return;
  _cloudUpdating = true;
  try {
    if (d.schema && typeof d.schema === 'object' && Object.keys(d.schema).length) {
      const merged = { ...d.schema };
      Object.keys(SCHEMA).forEach(k => { if (!merged[k]) merged[k] = SCHEMA[k]; });
      SCHEMA = merged; DB.set('schema', SCHEMA);
    }
    if (d.codes && typeof d.codes === 'object') { CODES = d.codes; DB.set('codes', CODES); }
    if (d.codeActive && CODES[d.codeActive]) { codeActive = d.codeActive; DB.set('codeActive', codeActive); }
    if (Array.isArray(d.log)) { LOG = d.log; DB.set('log', LOG); }
    if (Array.isArray(d.timeline)) DB.set('timeline', d.timeline);
    if (d.users && typeof d.users === 'object') {
      DB.set(USERS_KEY, { ...DB.get(USERS_KEY, {}), ...d.users });
    }
    if (d.pwds && typeof d.pwds === 'object') {
      DB.set(PWDS_KEY, { ...DB.get(PWDS_KEY, {}), ...d.pwds });
    }
    if (Array.isArray(d.customTimers)) {
      customTimers = d.customTimers;
      DB.set('customTimers', customTimers);
    }
    Object.keys(SCHEMA).forEach(k => { if (Array.isArray(d[k])) DB.set(k, d[k]); });
    refreshCodeBooks();
    if (!silent) {
      render();
      if (!CURRENT_USER) renderLoginScreen();
    }
  } catch (e) { console.error('applyAll:', e); }
  _cloudUpdating = false;
};

window.startCloud = function() { toast('Firebase не загрузился', 'error'); };
window.stopCloud = function() { toast('Firebase не загрузился', 'error'); };
window.pushCloud = function() {};
window.updatePresence = function() {};
window.getOnlineUsers = function() { return Promise.resolve([]); };
window.schedulePushCloud = function() {};

window.markSaving = function() {
  const d = document.getElementById('saveDot');
  const t = document.getElementById('saveText');
  if (d) d.className = 'dot saving';
  if (t) t.textContent = 'Сохранение...';
  clearTimeout(window._saveTimer);
  window._saveTimer = setTimeout(() => {
    if (d) d.className = 'dot ' + (CLOUD_MODE ? '' : 'offline');
    if (t) t.textContent = CLOUD_MODE ? 'Онлайн ' + nowTime() : 'Офлайн ' + nowTime();
  }, 500);
};

window.toggleTheme = function() {
  THEME = THEME === 'light' ? 'dark' : 'light';
  DB.set('theme', THEME);
  render();
};
