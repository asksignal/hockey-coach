// ====================== HOCKEY PERFORMANCE COACH ======================
// Версия: 2.0.0 — Добавлена облачная синхронизация через Firebase Auth и Firestore.
// Функции: профили, нормативы ФХР, расчёт готовности, радар,
//          подбор звеньев по хвату и стилю, планы тренировок.

'use strict';

/*********************** FIREBASE ИНИЦИАЛИЗАЦИЯ *************************/
// 🔥 ВСТАВЬТЕ СЮДА КОНФИГУРАЦИЮ ИЗ КОНСОЛИ FIREBASE 🔥
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyARbCba06OX01T4CV9NooOU21vWo2LI72g",
  authDomain: "hockey-coach-162cb.firebaseapp.com",
  projectId: "hockey-coach-162cb",
  storageBucket: "hockey-coach-162cb.firebasestorage.app",
  messagingSenderId: "758328720863",
  appId: "1:758328720863:web:b84afdbd31224d8591986a",
  measurementId: "G-CZ6DJK53TK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

/*********************** ГЛОБАЛЬНОЕ СОСТОЯНИЕ ***************************/
let players = []; // Теперь это локальный кэш данных из Firestore
let currentUser = null;
let activeTab = 'profiles';
let currentEditingPlayerId = null;
let unsubscribeFirestore = null; // Для отписки от слушателя Firestore

/*********************** НОРМАТИВЫ ФХР ***********************/
const fhrNorms = {
  'НП': { speed: 7.5, strength: 40, endurance: 180, skating: 3, shooting: 2, technique: 2, flexibility: 4, physique: 3 },
  'УТ': { speed: 7.0, strength: 60, endurance: 240, skating: 4, shooting: 3, technique: 3, flexibility: 5, physique: 4 },
  'ССМ': { speed: 6.5, strength: 80, endurance: 300, skating: 5, shooting: 4, technique: 4, flexibility: 6, physique: 5 },
  'ВСМ': { speed: 6.0, strength: 100, endurance: 360, skating: 6, shooting: 5, technique: 5, flexibility: 7, physique: 6 }
};

/*********************** УТИЛИТЫ ****************************************/
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
    if (['speed', 'endurance'].includes(k)) {
      total += Math.min(1, norm / val);
    } else {
      total += Math.min(1, val / norm);
    }
  });
  return Math.round((total / keys.length) * 100);
}

function determineStyle(player) {
  if (!player.tests) return 'двусторонний';
  const { strength, speed, shooting, technique } = player.tests;
  if (shooting >= 4 && technique >= 3) return 'снайпер';
  if (technique >= 4 && speed <= 7.0) return 'разыгрывающий';
  if (strength >= 70) return 'силовик';
  return 'двусторонний';
}

/*********************** АВТОРИЗАЦИЯ ************************************/
// Наблюдатель состояния аутентификации
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    console.log('Пользователь вошел:', user.email);
    await loadPlayersFromFirestore(); // Загружаем данные из облака
    showToast(`Добро пожаловать, ${user.email}!`);
  } else {
    currentUser = null;
    players = [];
    console.log('Пользователь вышел');
  }
  updateUI();
});

// Функция регистрации
async function signUp(email, password) {
  try {
    await auth.createUserWithEmailAndPassword(email, password);
    showToast('Регистрация успешна!');
  } catch (error) {
    showToast(`Ошибка регистрации: ${error.message}`);
  }
}

// Функция входа
async function signIn(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast('Вход выполнен!');
  } catch (error) {
    showToast(`Ошибка входа: ${error.message}`);
  }
}

// Функция выхода
async function logout() {
  if (confirm('Выйти?')) {
    await auth.signOut();
  }
}

/*********************** РАБОТА С ДАННЫМИ В FIRESTORE ******************/
// Загрузка данных из Firestore
async function loadPlayersFromFirestore() {
  if (!currentUser) return;
  // Отписываемся от предыдущего слушателя, если он был
  if (unsubscribeFirestore) unsubscribeFirestore();

  const playersRef = db.collection('users').doc(currentUser.uid).collection('players');
  // Слушаем изменения в реальном времени
  unsubscribeFirestore = playersRef.onSnapshot((snapshot) => {
    players = [];
    snapshot.forEach((doc) => {
      players.push({ id: doc.id, ...doc.data() });
    });
    console.log('Данные игроков обновлены из облака');
    updateUI();
  }, (error) => {
    console.error('Ошибка загрузки данных:', error);
    showToast('Ошибка загрузки данных с сервера');
  });
}

// Сохранение/обновление игрока в Firestore
async function savePlayerToFirestore(player) {
  if (!currentUser) return;
  const playerRef = db.collection('users').doc(currentUser.uid).collection('players').doc(String(player.id));
  try {
    await playerRef.set(player);
    console.log('Игрок сохранен в облаке');
  } catch (error) {
    console.error('Ошибка сохранения игрока:', error);
    showToast('Ошибка сохранения данных');
  }
}

// Удаление игрока из Firestore
async function deletePlayerFromFirestore(playerId) {
  if (!currentUser) return;
  const playerRef = db.collection('users').doc(currentUser.uid).collection('players').doc(String(playerId));
  try {
    await playerRef.delete();
    console.log('Игрок удален из облака');
  } catch (error) {
    console.error('Ошибка удаления игрока:', error);
    showToast('Ошибка удаления данных');
  }
}

/*********************** ИНТЕРФЕЙС **************************************/
function updateUI() {
  const authForm = document.getElementById('authForm');
  const userInfo = document.getElementById('userInfo');
  const loginBtn = document.getElementById('loginBtn');

  if (currentUser) {
    // Пользователь авторизован
    if (authForm) authForm.style.display = 'none';
    if (userInfo) {
      userInfo.style.display = 'block';
      document.getElementById('userEmail').textContent = currentUser.email;
    }
  } else {
    // Пользователь не авторизован
    if (authForm) authForm.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
  }

  renderTab(activeTab);
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  updateUI();
}

function renderTab(tab) {
  const main = document.getElementById('content');
  if (!currentUser) {
    main.innerHTML = `<div class="card"><p>Пожалуйста, войдите или зарегистрируйтесь, чтобы использовать приложение.</p></div>`;
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

// ---------- ПРОФИЛИ (с фото) ----------
function renderProfiles(container) {
  let html = `<div class="card"><h2>Игроки</h2>`;
  html += `<button onclick="addPlayerPrompt()">+ Добавить игрока</button></div>`;
  players.forEach(p => {
    const readiness = calculateReadiness(p);
    const photoHtml = p.photo
      ? `<img src="${p.photo}" alt="photo" style="width:60px;height:60px;border-radius:50%;object-fit:cover;margin-right:10px;">`
      : `<div style="width:60px;height:60px;border-radius:50%;background:#444;display:inline-flex;align-items:center;justify-content:center;margin-right:10px;">📷</div>`;

    html += `
    <div class="card">
      <div style="display:flex;align-items:center;">
        ${photoHtml}
        <div style="flex:1;">
          <strong>${p.name}</strong> (${p.position})<br>
          <small>${getAgeGroup(p.birth)} | Хват: ${p.stick}</small>
          <div class="progress-bar"><div class="progress-fill" style="width:${readiness}%"></div></div>
          <div>Готовность: ${readiness}%</div>
          <button onclick="editPlayer(${p.id})">✏️</button>
          <button onclick="deletePlayer(${p.id})">🗑️</button>
          <button onclick="requestPhotoForPlayer(${p.id})">📸 Фото</button>
        </div>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

async function addPlayerPrompt() {
  const name = prompt('ФИО:');
  if (!name) return;
  const birth = prompt('Дата рождения (ГГГГ-ММ-ДД):');
  const position = prompt('Амплуа (нападающий/защитник/вратарь):');
  const stick = prompt('Хват (левый/правый):');
  const weight = +prompt('Вес (кг):');
  const height = +prompt('Рост (см):');
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
    photo: null,
    tests: { speed, strength, endurance, skating, shooting, technique, flexibility, physique }
  };
  await savePlayerToFirestore(newPlayer);
  showToast('Игрок добавлен');
}

async function editPlayer(id) {
  const p = players.find(p => p.id === id);
  if (!p) return;
  const name = prompt('ФИО:', p.name);
  if (name) p.name = name;
  const weight = +prompt('Вес:', p.weight);
  if (!isNaN(weight)) p.weight = weight;
  const height = +prompt('Рост:', p.height);
  if (!isNaN(height)) p.height = height;
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
  await savePlayerToFirestore(p);
  showToast('Данные обновлены');
}

async function deletePlayer(id) {
  await deletePlayerFromFirestore(id);
  showToast('Игрок удалён');
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
  const data = categories.map(cat => {
    const keyMap = { 'Скорость':'speed', 'Сила':'strength', 'Выносливость':'endurance', 'Катание':'skating', 'Броски':'shooting', 'Техника':'technique', 'Гибкость':'flexibility', 'Телосложение':'physique' };
    const key = keyMap[cat];
    const val = values[key] || 0;
    const norm = norms[key] || 1;
    if (['speed','endurance'].includes(key)) return (norm / val) * 100;
    return (val / norm) * 100;
  });
  const normData = categories.map(() => 100);

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
  drawPolygon(normData, '#4caf50');
  drawPolygon(data, '#e53935');

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
  const bestTrio = findBestTrio(forwards);
  if (bestTrio) {
    html += `<p><strong>Ударное звено:</strong> ${bestTrio.map(p => `${p.name} (${p.stick?.[0]?.toUpperCase() || ''}${p.stick?.slice(1) || ''} хват)`).join(' – ')}</p>`;
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
  const combos = [];
  for (let i = 0; i < forwards.length; i++) {
    for (let j = 0; j < forwards.length; j++) {
      if (j === i) continue;
      for (let k = 0; k < forwards.length; k++) {
        if (k === i || k === j) continue;
        const sticks = [forwards[i].stick, forwards[j].stick, forwards[k].stick];
        if (sticks[0] !== sticks[1] && sticks[1] !== sticks[2]) {
          combos.push([forwards[i], forwards[j], forwards[k]]);
        }
      }
    }
  }
  if (combos.length === 0) return null;
  let best = combos[0];
  let bestScore = 0;
  combos.forEach(trio => {
    let score = trio.reduce((s, p) => s + calculateReadiness(p), 0);
    if (score > bestScore) {
      bestScore = score;
      best = trio;
    }
  });
  return best;
}

function findBestDefPair(defs) {
  if (defs.length < 2) return null;
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      if (defs[i].stick !== defs[j].stick) return [defs[i], defs[j]];
    }
  }
  return [defs[0], defs[1]];
}

// ---------- ПЛАНЫ ТРЕНИРОВОК ----------
function renderTraining(container) {
  let html = '<div class="card"><h2>Недельный план тренировок</h2>';
  const days = ['Пн: Скорость + катание', 'Вт: Силовая', 'Ср: Техника + броски', 'Чт: Игровая практика', 'Пт: Взрывная сила', 'Сб: Восстановление', 'Вс: Отдых'];
  days.forEach((d, i) => html += `<p>${i + 1}. ${d}</p>`);
  html += '<button onclick="generateTestPlan()">План тестирования (3 дня)</button>';
  html += '</div>';
  container.innerHTML = html;
}

function generateTestPlan() {
  const plan = `План тестирования:\n1 день: Разминка 15 мин, бег 30м, челночный бег, заминка.\n2 день: Жим лёжа, приседания, подтягивания.\n3 день: Катание, броски, гибкость.`;
  alert(plan);
}

/*********************** ФОТО ******************************************/
async function compressImage(file, maxWidth = 400, maxHeight = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) {
          if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; }
        } else {
          if (h > maxHeight) { w *= maxHeight / h; h = maxHeight; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function requestPhotoForPlayer(id) {
  currentEditingPlayerId = id;
  document.getElementById('photoInput').click();
}

// ================== ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ ============================
document.addEventListener('DOMContentLoaded', () => {
  // Навигация
  document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Кнопки аутентификации
  document.getElementById('signUpBtn')?.addEventListener('click', () => {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    signUp(email, password);
  });

  document.getElementById('signInBtn')?.addEventListener('click', () => {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    signIn(email, password);
  });

  // Обработчик загрузки фото
  const photoInput = document.getElementById('photoInput');
  if (photoInput) {
    photoInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const compressedDataUrl = await compressImage(file, 400, 400, 0.7);
        const playerId = currentEditingPlayerId;
        if (playerId) {
          const player = players.find(p => p.id === playerId);
          if (player) {
            player.photo = compressedDataUrl;
            await savePlayerToFirestore(player);
            showToast('Фото обновлено');
          }
        }
      } catch (err) {
        showToast('Ошибка загрузки фото: ' + err.message);
      }
      event.target.value = '';
    });
  }

  // Первоначальная отрисовка интерфейса
  updateUI();
});
