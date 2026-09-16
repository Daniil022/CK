// Firebase модуль
// Импортируется как type="module"

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, onSnapshot, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Конфиг
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyAjP2Ny_xRIhMwoVZ-HWiW7nxlAIUV3HIo",
  authDomain: "sk-terminal.firebaseapp.com",
  projectId: "sk-terminal",
  storageBucket: "sk-terminal.firebasestorage.app",
  messagingSenderId: "286319815156",
  appId: "1:286319815156:web:1d5901ca091894477271a1"
};

let firebaseReady = false;
let db = null, cloudDoc = null, presenceDoc = null;

try {
  const fbApp = initializeApp(firebaseConfig);
  db = getFirestore(fbApp);
  cloudDoc = doc(db, 'sk', 'shared');
  presenceDoc = doc(db, 'sk', 'presence');
  firebaseReady = true;
  console.log('✅ Firebase OK');
} catch (e) {
  console.error('❌ Firebase:', e);
}

// Статус в шапке
function updateCloudStatus(state) {
  const d = document.getElementById('saveDot');
  const t = document.getElementById('saveText');
  if (!d || !t) return;

  if (state === 'online') {
    d.className = 'dot';
    t.textContent = 'Онлайн ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } else if (state === 'connecting') {
    d.className = 'dot syncing';
    t.textContent = 'Подключение...';
  } else if (state === 'error') {
    d.className = 'dot error';
    t.textContent = 'Ошибка';
  } else {
    d.className = 'dot offline';
    t.textContent = 'Офлайн';
  }
}

if (firebaseReady) {

  // ═══════════ РУЧНАЯ ЗАГРУЗКА (для экрана логина) ═══════════
  window._manualPullCloud = async function() {
    if (!firebaseReady || !cloudDoc) throw new Error('Firebase не готов');
    const snap = await getDoc(cloudDoc);
    if (!snap.exists()) {
      console.log('Облако пусто');
      return;
    }
    const d = snap.data();

    if (d.users && typeof d.users === 'object') {
      DB.set('users', { ...DB.get('users', {}), ...d.users });
    }
    if (d.pwds && typeof d.pwds === 'object') {
      DB.set('pwds', { ...DB.get('pwds', {}), ...d.pwds });
    }
    console.log('✅ Загружено. Сотрудников:', Object.keys(DB.get('users', {})).length);
  };

  // ═══════════ СТАРТ СИНХРОНИЗАЦИИ ═══════════
  window.startCloud = async function() {
    if (!window.CURRENT_USER) {
      toast('Сначала войди', 'error');
      return;
    }

    window.CLOUD_MODE = true;
    DB.set('cloudMode', true);
    updateCloudStatus('connecting');

    try {
      onSnapshot(cloudDoc, snap => {
        updateCloudStatus('online');
        if (!snap.exists()) {
          window.pushCloud(false);
          return;
        }
        const d = snap.data();
        window.applyAll(d, false);
      }, err => {
        console.error('snapshot:', err);
        updateCloudStatus('error');
      });

      const snap = await getDoc(cloudDoc);
      if (!snap.exists()) {
        await window.pushCloud(false);
        toast('Данные загружены в облако ✓');
      } else {
        window.applyAll(snap.data(), false);
        toast('Подключено ✓');
      }
    } catch (e) {
      updateCloudStatus('error');
      window.CLOUD_MODE = false;
      DB.set('cloudMode', false);
      toast('Ошибка: ' + e.message, 'error');
    }
  };

  // ═══════════ СТОП ═══════════
  window.stopCloud = function() {
    window.CLOUD_MODE = false;
    DB.set('cloudMode', false);
    updateCloudStatus('offline');
    toast('Отключено');
    render();
  };

  // ═══════════ ОТПРАВКА ═══════════
  window.pushCloud = async function(showToast) {
    if (!firebaseReady || !cloudDoc) return;
    if (!window.CLOUD_MODE) return;

    try {
      const d = window.collectAll();
      d.users = DB.get('users', {});
      d.pwds = DB.get('pwds', {});
      await setDoc(cloudDoc, d, { merge: false });
      if (showToast) toast('Отправлено ✓');
    } catch (e) {
      toast('Ошибка: ' + e.message, 'error');
    }
  };

  // ═══════════ ОНЛАЙН ═══════════
  window.updatePresence = async function() {
    if (!firebaseReady || !presenceDoc || !window.CLOUD_MODE || !window.CURRENT_USER) return;

    try {
      const snap = await getDoc(presenceDoc);
      const data = snap.exists() ? snap.data() : { users: {} };
      if (!data.users) data.users = {};

      data.users[window.MY_ID] = {
        name: window.MY_NAME,
        ts: Date.now()
      };

      const cutoff = Date.now() - 3 * 60 * 1000;
      Object.keys(data.users).forEach(k => {
        if (data.users[k].ts < cutoff) delete data.users[k];
      });

      await setDoc(presenceDoc, data);
    } catch (e) {}
  };

  window.getOnlineUsers = function() {
    if (!firebaseReady || !presenceDoc) return Promise.resolve([]);

    return getDoc(presenceDoc).then(snap => {
      if (!snap.exists()) return [];
      const data = snap.data();
      if (!data.users) return [];
      const cutoff = Date.now() - 3 * 60 * 1000;
      return Object.values(data.users).filter(u => u.ts > cutoff).map(u => u.name);
    }).catch(() => []);
  };

  // ═══════════ ОТЛОЖЕННАЯ ОТПРАВКА ═══════════
  let _pushTimer = null;
  window.schedulePushCloud = function() {
    if (!firebaseReady || !window.CLOUD_MODE || window._cloudUpdating) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(() => { window.pushCloud(false); }, 800);
  };

  // Автоподключение если было включено
  if (DB.get('cloudMode', false)) {
    setTimeout(() => {
      if (window.CURRENT_USER) window.startCloud();
    }, 1000);
  }

  // Пульс каждую минуту
  setInterval(() => {
    if (window.CLOUD_MODE) window.updatePresence();
  }, 60000);
}
