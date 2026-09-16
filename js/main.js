'use strict';

// ═══════════ ГЛАВНЫЙ ЗАПУСК ═══════════
function finalInit() {
  // Закрытие модалок по клику на фон
  document.querySelectorAll('.modal').forEach(m => {
    if (!m) return;
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.remove('show');
    });
  });

  // Смена типа поля в модалке
  const mft = document.getElementById('mfType');
  if (mft) {
    mft.addEventListener('change', () => {
      const w = document.getElementById('mfOptionsWrap');
      if (w) w.style.display = mft.value === 'select' ? 'block' : 'none';
    });
  }

  // Автологин
  if (tryAutoLogin()) {
    render();
  } else {
    renderLoginScreen();

    // Автозагрузка сотрудников из Firebase
    setTimeout(async () => {
      if (typeof window._manualPullCloud === 'function') {
        try {
          const sub = document.getElementById('loginSub');
          if (sub) sub.textContent = '⏳ Загрузка сотрудников...';
          await window._manualPullCloud();
          renderLoginScreen();
          console.log('✅ Сотрудники загружены');
        } catch (e) {
          console.log('Автозагрузка:', e.message);
          renderLoginScreen();
        }
      }
    }, 2000);
  }

  // Часы в футере
  setInterval(() => {
    const ft = document.getElementById('footerTime');
    if (ft) ft.textContent = new Date().toLocaleTimeString('ru-RU');
  }, 1000);

  // Обновление задержанных раз в минуту
  setInterval(() => {
    if (activeTab === 'arrests' && CURRENT_USER) renderListOnly('arrests');
  }, 60000);

  // Регистрация Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('SW OK'))
      .catch(e => console.log('SW:', e));
  }
}

// Запуск
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', finalInit);
} else {
  finalInit();
}
