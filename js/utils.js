'use strict';

// Глобальный перехват ошибок
window.addEventListener('error', e => {
  console.error('Global error:', e.error);
  const eb = document.getElementById('bootError');
  if (eb) {
    eb.textContent = '❌ ' + (e.message || '') + '\n' + (e.filename || '') + ':' + (e.lineno || '');
    eb.classList.add('show');
  }
});

// Экранирование HTML
window.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Тосты
window.toast = (msg, type) => {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 2500);
};

// ID для полей
window.uid = () => 'f' + Date.now() + Math.random().toString(36).slice(2, 6);

// Формат времени
window.fmtTime = s => {
  s = Math.max(0, Math.floor(s || 0));
  return String(Math.floor(s / 3600)).padStart(2, '0') + ':' +
         String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' +
         String(s % 60).padStart(2, '0');
};

// Дата/время
window.today = () => new Date().toLocaleDateString('ru-RU');
window.nowTime = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

// Копирование в буфер
window.copyText = text => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
};
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

// Хэш пароля (простой, для игры хватает)
window.hashPwd = function(s) {
  let h = 0;
  const str = String(s) + '|sksalt';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = ((h << 5) - h) + c;
    h = h & h;
  }
  return 'h' + Math.abs(h).toString(36) + '_' + String(s).length;
};

// Генератор пароля
window.genPwd = function(len) {
  len = len || 8;
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  try {
    const arr = new Uint32Array(len);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  } catch (e) {
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};
