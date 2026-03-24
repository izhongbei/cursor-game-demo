const gameArea = document.getElementById("game-area");
const playerEl = document.getElementById("player");
const overlayEl = document.getElementById("overlay");
const overlayTextEl = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const waveEl = document.getElementById("wave");
const shieldCountEl = document.getElementById("shield-count");
const dashCooldownEl = document.getElementById("dash-cooldown");
const slowStatusEl = document.getElementById("slow-status");
const doubleStatusEl = document.getElementById("double-status");
const bossBannerEl = document.getElementById("boss-banner");
const laserEl = document.getElementById("laser");
const dangerVignetteEl = document.getElementById("danger-vignette");
const statusEl = document.getElementById("status");

const PLAYER_SIZE = 28;
const OBSTACLE_SIZE = 24;
const BASE_SPEED = 170;
const MAX_SPEED = 360;
const SCORE_RATE = 10;
const BASE_TARGET_OBSTACLES = 3;
const TARGET_OBSTACLE_GROWTH = 0.25;
const MAX_TARGET_OBSTACLES = 12;
const WAVE_DURATION = 20;
const WAVE_SPEED_STEP = 18;
const WAVE_SPAWN_STEP = 0.06;
const WAVE_TARGET_STEP = 1;
const TRACKING_STEER = 2.4;
const BOUNCE_VX_MAX = 150;
const SPLIT_TRIGGER_Y_RATIO = 0.38;

const DASH_MULTIPLIER = 2.4;
const DASH_DURATION = 0.22;
const DASH_COOLDOWN = 3.5;
const MAX_SHIELD_COUNT = 3;

const POWERUP_SIZE = 22;
const POWERUP_LIFETIME = 8;
const POWERUP_SPAWN_MIN = 7;
const POWERUP_SPAWN_MAX = 11;
const SLOW_EFFECT_DURATION = 5;
const SLOW_EFFECT_MULTIPLIER = 0.55;
const DOUBLE_SCORE_DURATION = 6;

const BOSS_INTERVAL = 60;
const BOSS_DURATION = 10;
const SLOWMO_DURATION = 0.1;
const COMBO_WINDOW = 2.2;

let gameState = "idle";
let player = { x: 0, y: 0, speed: 260 };
let obstacles = [];
let powerups = [];
let keys = {};
let score = 0;
let bestScore = Number(localStorage.getItem("avoid-block-best-score") || 0);
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 0.9;
let gameTime = 0;
let wave = 1;
let areaWidth = 0;
let areaHeight = 0;
let powerupTimer = randomRange(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
let dashCooldownTimer = 0;
let dashTimer = 0;
let shieldCount = 0;
let slowTimer = 0;
let doubleScoreTimer = 0;
let timeScale = 1;
let slowmoTimer = 0;
let nearHitCooldown = 0;
let comboCount = 0;
let comboTimer = 0;
let bossState = { active: false, mode: "none", timer: 0, nextAt: BOSS_INTERVAL, laserAngle: 0 };

bestScoreEl.textContent = String(bestScore);
updateHud();

function updateAreaSize() {
  const rect = gameArea.getBoundingClientRect();
  areaWidth = rect.width;
  areaHeight = rect.height;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function showOverlay(text) {
  overlayTextEl.textContent = text;
  overlayEl.classList.add("show");
}

function hideOverlay() {
  overlayEl.classList.remove("show");
}

function addScreenShake() {
  gameArea.classList.remove("shake");
  void gameArea.offsetWidth;
  gameArea.classList.add("shake");
}

function playBeep(freq = 620, duration = 0.05, volume = 0.016) {
  try {
    const ctx = playBeep.ctx || new (window.AudioContext || window.webkitAudioContext)();
    playBeep.ctx = ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // audio optional
  }
}

function resetPlayer() {
  player.x = areaWidth / 2 - PLAYER_SIZE / 2;
  player.y = areaHeight - PLAYER_SIZE - 14;
  renderPlayer();
}

function renderPlayer() {
  playerEl.style.transform = `translate(${player.x}px, ${player.y}px)`;
  playerEl.classList.toggle("shielded", shieldCount > 0);
  playerEl.classList.toggle("dashing", dashTimer > 0);
}

function pickObstacleType() {
  const progress = Math.min(0.28, (wave - 1) * 0.035 + gameTime * 0.0015);
  const r = Math.random();
  if (r < 0.58 - progress) return "normal";
  if (r < 0.78) return "tracking";
  if (r < 0.93) return "bouncing";
  return "splitter";
}

function createObstacle() {
  const x = Math.random() * (areaWidth - OBSTACLE_SIZE);
  const speedBoost = Math.min(gameTime * 8, 120);
  const waveSpeedBoost = (wave - 1) * WAVE_SPEED_STEP;
  const speed = BASE_SPEED + speedBoost + Math.random() * 60;
  const type = pickObstacleType();

  const obstacle = {
    id: crypto.randomUUID(),
    x,
    y: -OBSTACLE_SIZE - 6,
    speed: speed + waveSpeedBoost,
    size: OBSTACLE_SIZE,
    type,
    vx: type === "bouncing" ? randomRange(-BOUNCE_VX_MAX, BOUNCE_VX_MAX) : 0,
    hasSplit: false,
    splitAtY: areaHeight * SPLIT_TRIGGER_Y_RATIO + randomRange(-20, 20)
  };

  const el = document.createElement("div");
  el.className = `obstacle ${type}`;
  obstacle.el = el;
  gameArea.appendChild(el);
  obstacles.push(obstacle);
}

function createSplitChild(x, y, speed, vx) {
  const childSize = 16;
  const obstacle = {
    id: crypto.randomUUID(),
    x: clamp(x, 0, areaWidth - childSize),
    y,
    speed: speed * 1.05,
    size: childSize,
    type: "split-child",
    vx,
    hasSplit: true,
    splitAtY: Infinity
  };
  const el = document.createElement("div");
  el.className = "obstacle split-child";
  obstacle.el = el;
  gameArea.appendChild(el);
  obstacles.push(obstacle);
}

function renderObstacles() {
  for (const ob of obstacles) {
    ob.el.style.transform = `translate(${ob.x}px, ${ob.y}px)`;
  }
}

function createPowerup(type) {
  const x = Math.random() * (areaWidth - POWERUP_SIZE);
  const y = randomRange(areaHeight * 0.2, areaHeight * 0.72);
  const powerup = { id: crypto.randomUUID(), x, y, size: POWERUP_SIZE, type, life: POWERUP_LIFETIME };
  const el = document.createElement("div");
  el.className = `powerup ${type}`;
  powerup.el = el;
  gameArea.appendChild(el);
  powerups.push(powerup);
}

function maybeSpawnPowerup(delta) {
  powerupTimer -= delta;
  if (powerupTimer > 0) return;
  const pool = ["shield", "slow", "double"];
  createPowerup(pool[Math.floor(Math.random() * pool.length)]);
  powerupTimer = randomRange(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
}

function renderPowerups() {
  for (const item of powerups) {
    item.el.style.transform = `translate(${item.x}px, ${item.y}px)`;
  }
}

function updatePowerups(delta) {
  powerups = powerups.filter((item) => {
    item.life -= delta;
    if (item.life <= 0) {
      item.el.remove();
      return false;
    }
    return true;
  });
}

function isColliding(a, b) {
  const aSize = a.size ?? PLAYER_SIZE;
  const bSize = b.size ?? OBSTACLE_SIZE;
  return a.x < b.x + bSize && a.x + aSize > b.x && a.y < b.y + bSize && a.y + aSize > b.y;
}

function onComboEvent() {
  comboCount = comboTimer > 0 ? comboCount + 1 : 1;
  comboTimer = COMBO_WINDOW;
  playBeep(640 + comboCount * 70, 0.045, 0.018);
}

function applyPowerup(type) {
  if (type === "shield") shieldCount = clamp(shieldCount + 1, 0, MAX_SHIELD_COUNT);
  if (type === "slow") slowTimer = SLOW_EFFECT_DURATION;
  if (type === "double") doubleScoreTimer = DOUBLE_SCORE_DURATION;
  onComboEvent();
}

function collectPowerups() {
  const playerBox = { x: player.x, y: player.y, size: PLAYER_SIZE };
  powerups = powerups.filter((item) => {
    if (!isColliding(playerBox, item)) return true;
    item.el.remove();
    applyPowerup(item.type);
    return false;
  });
}

function removeOffscreenObstacles() {
  obstacles = obstacles.filter((ob) => {
    if (ob.y > areaHeight + ob.size + 4) {
      ob.el.remove();
      return false;
    }
    return true;
  });
}

function updatePlayer(delta) {
  const dirX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const dirY = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  let vx = dirX;
  let vy = dirY;
  if (vx !== 0 && vy !== 0) {
    const inv = 1 / Math.sqrt(2);
    vx *= inv;
    vy *= inv;
  }
  const speedFactor = dashTimer > 0 ? DASH_MULTIPLIER : 1;
  player.x += vx * player.speed * speedFactor * delta;
  player.y += vy * player.speed * speedFactor * delta;
  player.x = clamp(player.x, 0, areaWidth - PLAYER_SIZE);
  player.y = clamp(player.y, 0, areaHeight - PLAYER_SIZE);
}

function updateObstacles(delta) {
  const slowFactor = slowTimer > 0 ? SLOW_EFFECT_MULTIPLIER : 1;
  for (const ob of obstacles) {
    ob.y += Math.min(ob.speed, MAX_SPEED + (wave - 1) * 25) * slowFactor * delta;
    if (ob.type === "tracking") {
      const targetX = player.x + PLAYER_SIZE * 0.5;
      const cx = ob.x + ob.size * 0.5;
      ob.x += clamp((targetX - cx) * TRACKING_STEER * delta, -120 * delta, 120 * delta);
    } else if (ob.type === "bouncing" || ob.type === "split-child") {
      ob.x += ob.vx * delta;
      if (ob.x <= 0 || ob.x >= areaWidth - ob.size) {
        ob.x = clamp(ob.x, 0, areaWidth - ob.size);
        ob.vx *= -1;
      }
    } else if (ob.type === "splitter" && !ob.hasSplit && ob.y >= ob.splitAtY) {
      ob.hasSplit = true;
      createSplitChild(ob.x - 6, ob.y, ob.speed * 0.88, -110);
      createSplitChild(ob.x + 6, ob.y, ob.speed * 0.88, 110);
      ob.el.remove();
      ob._removed = true;
    }
    ob.x = clamp(ob.x, 0, areaWidth - ob.size);
  }
  obstacles = obstacles.filter((ob) => !ob._removed);
}

function beginBossEvent() {
  bossState.active = true;
  bossState.timer = BOSS_DURATION;
  bossState.nextAt = gameTime + BOSS_INTERVAL;
  bossState.mode = Math.random() < 0.5 ? "barrage" : "laser";
  bossBannerEl.textContent = bossState.mode === "barrage" ? "BOSS 事件：弹幕模式" : "BOSS 事件：旋转激光区";
  bossBannerEl.classList.add("show");
  addScreenShake();
  playBeep(180, 0.12, 0.03);
}

function updateBoss(delta) {
  if (!bossState.active && gameTime >= bossState.nextAt) beginBossEvent();
  if (!bossState.active) {
    laserEl.classList.remove("show");
    bossBannerEl.classList.remove("show");
    return;
  }

  bossState.timer -= delta;
  if (bossState.mode === "barrage") {
    if (Math.random() < 0.22) createObstacle();
    if (Math.random() < 0.11) createObstacle();
  } else {
    bossState.laserAngle += 115 * delta;
    laserEl.style.transform = `translate(-50%, -50%) rotate(${bossState.laserAngle}deg)`;
    laserEl.classList.add("show");
  }

  if (bossState.timer <= 0) {
    bossState.active = false;
    bossState.mode = "none";
    laserEl.classList.remove("show");
    bossBannerEl.classList.remove("show");
  }
}

function checkLaserCollision() {
  if (!bossState.active || bossState.mode !== "laser") return false;
  const px = player.x + PLAYER_SIZE * 0.5 - areaWidth * 0.5;
  const py = player.y + PLAYER_SIZE * 0.5 - areaHeight * 0.5;
  const angle = (bossState.laserAngle * Math.PI) / 180;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const dist = Math.abs(px * nx + py * ny);
  return dist < 9;
}

function updateDifficulty(delta) {
  spawnTimer += delta;
  gameTime += delta;
  wave = Math.floor(gameTime / WAVE_DURATION) + 1;
  waveEl.textContent = String(wave);
  const minInterval = 0.28;
  spawnInterval = Math.max(minInterval, 0.9 - gameTime * 0.03 - (wave - 1) * WAVE_SPAWN_STEP);
  const targetObstacles = Math.min(
    MAX_TARGET_OBSTACLES + (wave - 1) * 2,
    Math.floor(BASE_TARGET_OBSTACLES + gameTime * TARGET_OBSTACLE_GROWTH + (wave - 1) * WAVE_TARGET_STEP)
  );
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    createObstacle();
  }
  while (obstacles.length < targetObstacles) createObstacle();
}

function updateScore(delta) {
  const multiplier = doubleScoreTimer > 0 ? 2 : 1;
  score += SCORE_RATE * multiplier * delta;
  scoreEl.textContent = String(Math.floor(score));
}

function tryConsumeShield() {
  if (shieldCount <= 0) return false;
  shieldCount -= 1;
  addScreenShake();
  playBeep(240, 0.07, 0.02);
  return true;
}

function checkObstacleHit() {
  const playerBox = { x: player.x, y: player.y };
  const hitIndex = obstacles.findIndex((ob) => isColliding(playerBox, ob));
  if (hitIndex < 0) return false;
  if (tryConsumeShield()) {
    const [hit] = obstacles.splice(hitIndex, 1);
    if (hit) hit.el.remove();
    return false;
  }
  return true;
}

function maybeTriggerNearHitSlowmo() {
  if (nearHitCooldown > 0 || slowmoTimer > 0 || shieldCount > 0) return;
  const px = player.x + PLAYER_SIZE * 0.5;
  const py = player.y + PLAYER_SIZE * 0.5;
  for (const ob of obstacles) {
    const ox = ob.x + ob.size * 0.5;
    const oy = ob.y + ob.size * 0.5;
    const d2 = (px - ox) * (px - ox) + (py - oy) * (py - oy);
    const t = (PLAYER_SIZE + ob.size + 8) * (PLAYER_SIZE + ob.size + 8);
    if (d2 < t && !isColliding({ x: player.x, y: player.y, size: PLAYER_SIZE }, ob)) {
      slowmoTimer = SLOWMO_DURATION;
      nearHitCooldown = 0.5;
      addScreenShake();
      break;
    }
  }
}

function updateDangerFeedback() {
  const near = obstacles.reduce((acc, ob) => {
    const dx = ob.x - player.x;
    const dy = ob.y - player.y;
    return acc + (dx * dx + dy * dy < 120 * 120 ? 1 : 0);
  }, 0);
  dangerVignetteEl.style.opacity = shieldCount === 0 && near >= 3 ? "1" : "0";
}

function clearObstaclesAndPowerups() {
  for (const ob of obstacles) ob.el.remove();
  obstacles = [];
  for (const item of powerups) item.el.remove();
  powerups = [];
}

function endGame() {
  gameState = "ended";
  setStatus("已结束");
  pauseBtn.disabled = true;
  pauseBtn.textContent = "暂停";
  dangerVignetteEl.style.opacity = "0";
  laserEl.classList.remove("show");
  bossBannerEl.classList.remove("show");

  const finalScore = Math.floor(score);
  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem("avoid-block-best-score", String(bestScore));
    bestScoreEl.textContent = String(bestScore);
  }
  showOverlay(`游戏结束！最终得分：${finalScore}`);
}

function updateTimers(delta) {
  if (dashCooldownTimer > 0) dashCooldownTimer -= delta;
  if (dashTimer > 0) dashTimer -= delta;
  if (slowTimer > 0) slowTimer -= delta;
  if (doubleScoreTimer > 0) doubleScoreTimer -= delta;
  if (slowmoTimer > 0) slowmoTimer -= delta;
  if (nearHitCooldown > 0) nearHitCooldown -= delta;
  if (comboTimer > 0) comboTimer -= delta;
  if (comboTimer < 0) {
    comboTimer = 0;
    comboCount = 0;
  }
  dashCooldownTimer = Math.max(0, dashCooldownTimer);
  dashTimer = Math.max(0, dashTimer);
  slowTimer = Math.max(0, slowTimer);
  doubleScoreTimer = Math.max(0, doubleScoreTimer);
  slowmoTimer = Math.max(0, slowmoTimer);
  nearHitCooldown = Math.max(0, nearHitCooldown);
  timeScale = slowmoTimer > 0 ? 0.4 : 1;
}

function updateHud() {
  shieldCountEl.textContent = String(shieldCount);
  dashCooldownEl.textContent = dashCooldownTimer > 0 ? `${dashCooldownTimer.toFixed(1)}s` : "就绪";
  slowStatusEl.textContent = slowTimer > 0 ? `减速: ${slowTimer.toFixed(1)}s` : "减速: 关闭";
  doubleStatusEl.textContent = doubleScoreTimer > 0 ? `双倍分: ${doubleScoreTimer.toFixed(1)}s` : "双倍分: 关闭";
  slowStatusEl.classList.toggle("active", slowTimer > 0);
  doubleStatusEl.classList.toggle("active", doubleScoreTimer > 0);
}

function tryDash(event) {
  if (event.code !== "ShiftLeft" && event.code !== "ShiftRight") return;
  if (gameState !== "running") return;
  if (dashCooldownTimer > 0 || dashTimer > 0) return;
  dashTimer = DASH_DURATION;
  dashCooldownTimer = DASH_COOLDOWN;
}

function gameLoop(timestamp) {
  if (gameState !== "running") return;
  if (!lastTime) lastTime = timestamp;
  const rawDelta = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;
  const delta = rawDelta * timeScale;

  updateTimers(delta);
  updateDifficulty(delta);
  updateBoss(delta);
  maybeSpawnPowerup(delta);
  updatePlayer(delta);
  updateObstacles(delta);
  updatePowerups(delta);
  removeOffscreenObstacles();
  collectPowerups();
  updateScore(delta);
  maybeTriggerNearHitSlowmo();

  renderPlayer();
  renderObstacles();
  renderPowerups();
  updateDangerFeedback();
  updateHud();

  const laserHit = checkLaserCollision();
  const obstacleHit = checkObstacleHit();
  if (laserHit || obstacleHit) {
    if (laserHit && tryConsumeShield()) {
      requestAnimationFrame(gameLoop);
      return;
    }
    addScreenShake();
    endGame();
    return;
  }

  requestAnimationFrame(gameLoop);
}

function startGame() {
  updateAreaSize();
  clearObstaclesAndPowerups();
  score = 0;
  scoreEl.textContent = "0";
  spawnTimer = 0;
  spawnInterval = 0.9;
  gameTime = 0;
  wave = 1;
  waveEl.textContent = "1";
  lastTime = 0;
  powerupTimer = randomRange(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
  dashCooldownTimer = 0;
  dashTimer = 0;
  shieldCount = 0;
  slowTimer = 0;
  doubleScoreTimer = 0;
  slowmoTimer = 0;
  nearHitCooldown = 0;
  comboCount = 0;
  comboTimer = 0;
  timeScale = 1;
  bossState = { active: false, mode: "none", timer: 0, nextAt: BOSS_INTERVAL, laserAngle: 0 };
  laserEl.classList.remove("show");
  bossBannerEl.classList.remove("show");
  dangerVignetteEl.style.opacity = "0";
  updateHud();

  resetPlayer();
  hideOverlay();
  setStatus("进行中");
  gameState = "running";
  pauseBtn.disabled = false;
  pauseBtn.textContent = "暂停";
  requestAnimationFrame(gameLoop);
}

function tryStartBySpace(event) {
  if (event.code !== "Space") return;
  event.preventDefault();
  if (gameState === "idle" || gameState === "ended") {
    startGame();
    return;
  }
  if (gameState === "paused") resumeGame();
}

function pauseGame() {
  if (gameState !== "running") return;
  gameState = "paused";
  setStatus("已暂停");
  pauseBtn.textContent = "继续";
}

function resumeGame() {
  if (gameState !== "paused") return;
  gameState = "running";
  setStatus("进行中");
  pauseBtn.textContent = "暂停";
  lastTime = 0;
  requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (gameState === "running") pauseGame();
  else if (gameState === "paused") resumeGame();
}

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  tryDash(event);
});
window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});
window.addEventListener("keydown", tryStartBySpace);
window.addEventListener("resize", () => {
  updateAreaSize();
  if (gameState !== "running") resetPlayer();
  else {
    player.x = clamp(player.x, 0, areaWidth - PLAYER_SIZE);
    player.y = clamp(player.y, 0, areaHeight - PLAYER_SIZE);
    renderPlayer();
  }
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);

updateAreaSize();
resetPlayer();
showOverlay("按空格开始游戏");
setStatus("未开始");
