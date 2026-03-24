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
let waveFlashTimer = 0;
let areaWidth = 0;
let areaHeight = 0;
let powerupTimer = randomRange(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
let dashCooldownTimer = 0;
let dashTimer = 0;
let shieldCount = 0;
let slowTimer = 0;
let doubleScoreTimer = 0;

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

function createObstacle() {
  const x = Math.random() * (areaWidth - OBSTACLE_SIZE);
  const speedBoost = Math.min(gameTime * 8, 120);
  const waveSpeedBoost = (wave - 1) * WAVE_SPEED_STEP;
  const speed = BASE_SPEED + speedBoost + Math.random() * 60;

  const obstacle = {
    id: crypto.randomUUID(),
    x,
    y: -OBSTACLE_SIZE - 6,
    speed: speed + waveSpeedBoost,
    size: OBSTACLE_SIZE
  };

  const el = document.createElement("div");
  el.className = "obstacle";
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
  const powerup = {
    id: crypto.randomUUID(),
    x,
    y,
    size: POWERUP_SIZE,
    type,
    life: POWERUP_LIFETIME
  };

  const el = document.createElement("div");
  el.className = `powerup ${type}`;
  powerup.el = el;
  gameArea.appendChild(el);
  powerups.push(powerup);
}

function maybeSpawnPowerup(delta) {
  powerupTimer -= delta;
  if (powerupTimer > 0) return;

  const nextTypePool = ["shield", "slow", "double"];
  const type = nextTypePool[Math.floor(Math.random() * nextTypePool.length)];
  createPowerup(type);
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

function collectPowerups() {
  const playerBox = { x: player.x, y: player.y, size: PLAYER_SIZE };
  powerups = powerups.filter((item) => {
    if (!isColliding(playerBox, item)) {
      return true;
    }

    item.el.remove();
    applyPowerup(item.type);
    return false;
  });
}

function applyPowerup(type) {
  if (type === "shield") {
    shieldCount = clamp(shieldCount + 1, 0, MAX_SHIELD_COUNT);
  }
  if (type === "slow") {
    slowTimer = SLOW_EFFECT_DURATION;
  }
  if (type === "double") {
    doubleScoreTimer = DOUBLE_SCORE_DURATION;
  }
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

function isColliding(a, b) {
  return (
    a.x < b.x + b.size &&
    a.x + PLAYER_SIZE > b.x &&
    a.y < b.y + b.size &&
    a.y + PLAYER_SIZE > b.y
  );
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
  }
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

  // Keep increasing the simultaneous obstacle count over time.
  while (obstacles.length < targetObstacles) {
    createObstacle();
  }
}

function updateScore(delta) {
  const multiplier = doubleScoreTimer > 0 ? 2 : 1;
  score += SCORE_RATE * multiplier * delta;
  scoreEl.textContent = String(Math.floor(score));
}

function checkGameOver() {
  const playerBox = { x: player.x, y: player.y };
  const hitIndex = obstacles.findIndex((ob) => isColliding(playerBox, ob));
  if (hitIndex < 0) return false;

  if (shieldCount > 0) {
    shieldCount -= 1;
    const [hitObstacle] = obstacles.splice(hitIndex, 1);
    if (hitObstacle) hitObstacle.el.remove();
    return false;
  }

  return true;
}

function clearObstaclesAndPowerups() {
  for (const ob of obstacles) {
    ob.el.remove();
  }
  obstacles = [];

  for (const item of powerups) {
    item.el.remove();
  }
  powerups = [];
}

function endGame() {
  gameState = "ended";
  setStatus("已结束");
  pauseBtn.disabled = true;
  pauseBtn.textContent = "暂停";

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
  if (waveFlashTimer > 0) waveFlashTimer -= delta;

  if (dashCooldownTimer < 0) dashCooldownTimer = 0;
  if (dashTimer < 0) dashTimer = 0;
  if (slowTimer < 0) slowTimer = 0;
  if (doubleScoreTimer < 0) doubleScoreTimer = 0;
  if (waveFlashTimer < 0) waveFlashTimer = 0;
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
  const delta = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;

  updateTimers(delta);
  updateDifficulty(delta);
  maybeSpawnPowerup(delta);
  updatePlayer(delta);
  updateObstacles(delta);
  updatePowerups(delta);
  removeOffscreenObstacles();
  collectPowerups();
  updateScore(delta);

  renderPlayer();
  renderObstacles();
  renderPowerups();
  updateHud();

  if (checkGameOver()) {
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
  if (gameState === "paused") {
    resumeGame();
  }
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
  if (gameState === "running") {
    pauseGame();
    return;
  }
  if (gameState === "paused") {
    resumeGame();
  }
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
  if (gameState !== "running") {
    resetPlayer();
  } else {
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
