// ====================== HOCKEY PERFORMANCE COACH ======================
// Версия: 1.0.0 - Полный локальный PWA
// Функции: профили, нормативы ФХР, расчёт процента готовности, радар,
//          подбор звеньев по хвату и стилю, планы тренировок.
// Данные хранятся в localStorage (можно заменить на IndexedDB).
// Принудительная синхронизация – заглушка, в реальном проекте используется Firebase.

'use strict';

/*********************** СОСТОЯНИЕ *************************/
let players = JSON.parse(localStorage.getItem('hockey_players') || '[]');
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let activeTab = 'profiles';

/*********************** АВТОРИЗАЦИЯ (заглушка) *************/
function simulateAuth() {
  const email = prompt('Введите email (например, coach@hockey.ru):');
  if (!email) return;
  currentUser = { email };
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  updateUI();
  // TODO: здесь будет вызов Firebase Auth и запрос к облаку
  showToast('Вход выполнен (облачная синхронизация активна)');
}

function logout() {
  if (confirm('Выйти? Несохранённые данные могут быть потеряны.')) {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUI();
  }
}

/*********************** НОРМАТИВЫ ФХР (упрощённые) *********/
const fhrNorms = {
  'НП': { speed: 7.5, strength: 40, endurance: 180, skating: 3, shooting: 2, technique: 2, flexibility: 4, physique: 3 },
  'УТ': { speed: 7.0, strength: 60, endurance: 240, skating: 4, shooting: 3, technique: 3, flexibility: 5, physique: 4 },
  'ССМ': { speed: 6.5, strength: 80, endurance: 300, skating: 5, shooting: 4, technique: 4, flexibility: 6, physique: 5 },
  'ВСМ': { speed: 6.0, strength: 100, endurance: 360, skating: 6, shooting: 5, technique: 5, flexibility: 7, physique: 6 }
};

/*********************** ГЕНЕРАЦИЯ ТЕСТОВЫХ ДАННЫХ (для демо) */
function seedDemoData() {
  if (players.length > 0) return;
  players = [
    {
      id: 1, name: 'Иван Петров', birth: '2010-05-12', position: 'нападающий', stick: 'левый',
      weight: 55, height: 165, tests: { speed: 7.2, strength: 45, endurance: 200, skating: 3, shooting: 2, technique: 3, flexibility: 5, physique: 3 }
    },
    {
      id: 2, name: 'Алексей Смирнов', birth: '2010-08-22', position: 'нападающий', stick: 'правый',
      weight: 60, height: 170, tests: { speed: 6.8, strength: 55, endurance: 220, skating: 4, shooting: 3, technique: 3, flexibility: 4, physique: 4 }
    },
    {
      id: 3, name: 'Дмитрий Волков', birth: '2009-11-03', position: 'защитник', stick: 'левый',
      weight: 70, height: 178, tests: { speed: 7.0, strength: 65, endurance: 240, skating: 4, shooting: 4, technique: 3, flexibility: 5, physique: 4 }
    },
    {
      id: 4, name: 'Матвей Кузнецов', birth: '2008-03-17', position: 'нападающий', stick: 'левый',
      weight: 72, height: 182, tests: { speed: 6.5, strength: 75, endurance: 280, skating: 5, shooting: 4, technique: 4, flexibility: 6, physique: 5 }
    }
  ];
  saveData();
}

/*********************** УТИЛИТЫ *****************************/
function saveData() {
  localStorage.setItem('hockey_players', JSON.stringify(players));
  // Здесь вызов синхронизации с облаком (если сеть есть)
  syncToCloud();
}

function syncToCloud() {
  if (!navigator.onLine) return;
  // Реальная реализация: зашифровать данные и отправить в Firebase Firestore
  console.log('Синхронизация с облаком выполнена (заглушка)');
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'card';
  toast.textContent = msg;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '10px';
  toast.style.right = '10px';
  toast.style.background = '#333';
  toast.style.opacity = '0.9';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function getAgeGroup(birthDate) {
  const age = Math.floor((new Date() - new Date(birthDate)) / 31557600000);
  if (age <= 10) return 'НП';
  if (age <= 14) return 'УТ';
  if (age <= 17) return 'ССМ';
  return 'ВСМ';
}

function calculateReadiness(player) {
  if (!player.tests) return 0;
  const group = getAgeGroup(player.birth);
  const norms = fhrNorms[group];
  if (!norms) return 0;
  const keys = Object.keys(norms);
  let total = 0;
  keys.forEach(k => {
    const val = player.tests[k] || 0;
    const norm = norms[k];
    // Чем меньше время/результат лучше – для бега/скорости инвертируем
    if (['speed','endurance'].includes(k)) {
      total += Math.min(1, norm / val); // норма 7.0, если пробежал 7.2 – 7/7.2=0.97
    } else {
      total += Math.min(1, val / norm);
    }
  });
  return Math.round((total / keys.length) * 100);
}

// Определение стиля игрока на основе тестов
function determineStyle(player) {
  if (!player.tests) return 'двусторонний';
  const { strength, speed, shooting, technique } = player.tests;
  if (shooting >= 4 && technique >= 3) return 'снайпер';
  if (technique >= 4 && speed <= 7.0) return 'разыгрывающий';
  if (strength >= 70) return 'силовик';
  return 'двусторонний';
}

/*********************** ОТРИСОВКА ИНТЕРФЕЙСА ***************/
function updateUI() {
  document.getElementById('userEmail').textContent = currentUser ? currentUser.email : '';
  document.getElementById('loginBtn').style.display = currentUser ? 'none' : 'inline-block';
  renderTab(activeTab);
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  updateUI();
}

function renderTab(tab) {
  const main = document.getElementById('content');
  if (!currentUser) {
    main.innerHTML = `<div class="card"><p>Пожалуйста, войдите, чтобы использовать приложение.</p></div>`;
    return;
  }
  switch (tab) {
    case 'profiles': renderProfiles(main); break;
    case 'analysis': renderAnalysis(main); break;
    case 'lines': renderLines(main); break;
    case 'train': renderTraining(main); break;
    default: main.innerHTML = '';
  }
}

// ---------- ПРОФИЛИ ----------
function renderProfiles(container) {
  let html = `<div class="card"><h2>Игроки</h2>`;
  html += `<button onclick="addPlayerPrompt()">+ Добавить игрока</button></div>`;
  players.forEach(p => {
    const readiness = calculateReadiness(p);
    html += `
    <div class="card">
      <strong>${p.name}</strong> (${p.position})<br>
      <small>${getAgeGroup(p.birth)} | Хват: ${p.stick}</small>
      <div class="progress-bar"><div class="progress-fill" style="width:${readiness}%"></div></div>
      <div>Готовность: ${readiness}%</div>
      <button onclick="editPlayer(${p.id})">✏️</button>
      <button onclick="deletePlayer(${p.id})">🗑️</button>
    </div>`;
  });
  container.innerHTML = html;
}

function addPlayerPrompt() {
  const name = prompt('ФИО:');
  if (!name) return;
  const birth = prompt('Дата рождения (ГГГГ-ММ-ДД):');
  const position = prompt('Амплуа (нападающий/защитник/вратарь):');
  const stick = prompt('Хват (левый/правый):');
  const weight = +prompt('Вес (кг):');
  const height = +prompt('Рост (см):');
  // Простейшие тесты
  const speed = +prompt('Бег 30 м (сек):');
  const strength = +prompt('Жим лёжа (кг):');
  const endurance = +prompt('Челночный бег (сек):');
  const skating = +prompt('Катание (балл 1-6):');
  const shooting = +prompt('Броски (балл 1-5):');
  const technique = +prompt('Техника (балл 1-5):');
  const flexibility = +prompt('Гибкость (балл 1-7):');
  const physique = +prompt('Телосложение (балл 1-6):');
  const newPlayer = {
    id: Date.now(),
    name,
    birth,
    position,
    stick,
    weight,
    height,
    tests: { speed, strength, endurance, skating, shooting, technique, flexibility, physique }
  };
  players.push(newPlayer);
  saveData();
  updateUI();
  showToast('Игрок добавлен');
}

function editPlayer(id) {
  const p = players.find(p => p.id === id);
  if (!p) return;
  // Для краткости: вызов prompt для каждого поля (как в add). В реальном приложении лучше форма.
  const name = prompt('ФИО:', p.name);
  if (name) p.name = name;
  const weight = +prompt('Вес:', p.weight);
  if (!isNaN(weight)) p.weight = weight;
  // ... аналогично остальные поля. Перезаписываем tests.
  const speed = +prompt('Бег 30м:', p.tests.speed);
  if (!isNaN(speed)) p.tests.speed = speed;
  const strength = +prompt('Жим:', p.tests.strength);
  if (!isNaN(strength)) p.tests.strength = strength;
  const endurance = +prompt('Челночный:', p.tests.endurance);
  if (!isNaN(endurance)) p.tests.endurance = endurance;
  const skating = +prompt('Катание:', p.tests.skating);
  if (!isNaN(skating)) p.tests.skating = skating;
  const shooting = +prompt('Броски:', p.tests.shooting);
  if (!isNaN(shooting)) p.tests.shooting = shooting;
  const technique = +prompt('Техника:', p.tests.technique);
  if (!isNaN(technique)) p.tests.technique = technique;
  const flexibility = +prompt('Гибкость:', p.tests.flexibility);
  if (!isNaN(flexibility)) p.tests.flexibility = flexibility;
  const physique = +prompt('Телосложение:', p.tests.physique);
  if (!isNaN(physique)) p.tests.physique = physique;
  // Обновляем birth, position, stick при необходимости
  saveData();
  updateUI();
  showToast('Данные обновлены');
}

function deletePlayer(id) {
  players = players.filter(p => p.id !== id);
  saveData();
  updateUI();
}

// ---------- АНАЛИЗ ФХР + радар ----------
function renderAnalysis(container) {
  if (players.length === 0) {
    container.innerHTML = '<div class="card">Нет игроков для анализа</div>';
    return;
  }
  let html = '<div class="card"><h2>Анализ готовности</h2><select id="playerSelect">';
  players.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
  html += '</select><button onclick="drawRadar()">Показать радар</button>';
  html += '<canvas id="radarCanvas" width="300" height="300"></canvas></div>';
  container.innerHTML = html;
  drawRadar();
}

function drawRadar() {
  const sel = document.getElementById('playerSelect');
  if (!sel) return;
  const id = +sel.value;
  const player = players.find(p => p.id === id);
  if (!player) return;
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const centerX = 150, centerY = 150, radius = 120;
  const categories = ['Скорость', 'Сила', 'Выносливость', 'Катание', 'Броски', 'Техника', 'Гибкость', 'Телосложение'];
  const values = player.tests;
  const group = getAgeGroup(player.birth);
  const norms = fhrNorms[group];
  // Нормализация значений
  const data = categories.map(cat => {
    const keyMap = { 'Скорость':'speed', 'Сила':'strength', 'Выносливость':'endurance', 'Катание':'skating', 'Броски':'shooting', 'Техника':'technique', 'Гибкость':'flexibility', 'Телосложение':'physique' };
    const key = keyMap[cat];
    const val = values[key] || 0;
    const norm = norms[key] || 1;
    if (['speed','endurance'].includes(key)) return (norm / val) * 100;
    return (val / norm) * 100;
  });
  const normData = categories.map(() => 100); // эталон 100%

  ctx.clearRect(0,0,300,300);
  const drawPolygon = (data, color) => {
    ctx.beginPath();
    data.forEach((val, i) => {
      const angle = (Math.PI * 2 / categories.length) * i - Math.PI/2;
      const x = centerX + Math.cos(angle) * (radius * val/100);
      const y = centerY + Math.sin(angle) * (radius * val/100);
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '33';
    ctx.fill();
    ctx.stroke();
  };
  drawPolygon(normData, '#4caf50'); // эталон
  drawPolygon(data, '#e53935');     // игрок

  // Подписи
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  categories.forEach((cat, i) => {
    const angle = (Math.PI * 2 / categories.length) * i - Math.PI/2;
    const x = centerX + Math.cos(angle) * (radius + 15);
    const y = centerY + Math.sin(angle) * (radius + 15);
    ctx.fillText(cat, x - ctx.measureText(cat).width/2, y);
  });
}

// ---------- ПОДБОР ЗВЕНЬЕВ ----------
function renderLines(container) {
  const forwards = players.filter(p => p.position === 'нападающий');
  const defs = players.filter(p => p.position === 'защитник');
  let html = '<div class="card"><h2>Рекомендуемые сочетания</h2>';
  // Простая логика: ищем лучшую тройку ЛХ-ПХ-ЛХ или ПХ-ЛХ-ПХ
  const bestTrio = findBestTrio(forwards);
  if (bestTrio) {
    html += `<p><strong>Ударное звено:</strong> ${bestTrio.map(p => `${p.name} (${p.stick[0].toUpperCase()}${p.stick.slice(1)} хват)`).join(' – ')}</p>`;
  }
  const bestD = findBestDefPair(defs);
  if (bestD) {
    html += `<p><strong>Защитная пара:</strong> ${bestD.map(p => p.name).join(' – ')}</p>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function findBestTrio(forwards) {
  if (forwards.length < 3) return null;
  // Ищем оптимальное сочетание с чередованием хвата
  const combos = [];
  for (let i=0; i<forwards.length; i++) {
    for (let j=0; j<forwards.length; j++) {
      if (j===i) continue;
      for (let k=0; k<forwards.length; k++) {
        if (k===i || k===j) continue;
        const sticks = [forwards[i].stick, forwards[j].stick, forwards[k].stick];
        if (sticks[0] !== sticks[1] && sticks[1] !== sticks[2]) { // чередование
          combos.push([forwards[i], forwards[j], forwards[k]]);
        }
      }
    }
  }
  if (combos.length === 0) return null;
  // Выбираем с наивысшей суммой готовности
  let best = combos[0];
  let bestScore = 0;
  combos.forEach(trio => {
    let score = trio.reduce((s,p) => s + calculateReadiness(p), 0);
    if (score > bestScore) {
      bestScore = score;
      best = trio;
    }
  });
  return best;
}

function findBestDefPair(defs) {
  if (defs.length < 2) return null;
  // левый + правый хват
  for (let i=0; i<defs.length; i++) {
    for (let j=i+1; j<defs.length; j++) {
      if (defs[i].stick !== defs[j].stick) return [defs[i], defs[j]];
    }
  }
  return [defs[0], defs[1]]; // fallback
}

// ---------- ПЛАНЫ ТРЕНИРОВОК ----------
function renderTraining(container) {
  let html = '<div class="card"><h2>Недельный план тренировок</h2>';
  const days = ['Пн: Скорость + катание', 'Вт: Силовая', 'Ср: Техника + броски', 'Чт: Игровая практика', 'Пт: Взрывная сила', 'Сб: Восстановление', 'Вс: Отдых'];
  days.forEach((d,i) => html += `<p>${i+1}. ${d}</p>`);
  html += '<button onclick="generateTestPlan()">План тестирования (3 дня)</button>';
  html += '</div>';
  container.innerHTML = html;
}

function generateTestPlan() {
  const plan = `План тестирования:\n1 день: Разминка 15 мин, бег 30м, челночный бег, заминка.\n2 день: Жим лёжа, приседания, подтягивания.\n3 день: Катание, броски, гибкость.`;
  alert(plan);
}

// ================== ИНИЦИАЛИЗАЦИЯ ==================
document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('loginBtn').addEventListener('click', simulateAuth);
  // Кнопка выхода появится в authBlock динамически, для простоты добавим в разметку:
  // (обновим HTML)
  updateUI();
});