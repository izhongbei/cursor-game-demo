const gameArea = document.getElementById("game-area");
const playerEl = document.getElementById("player");
const overlayEl = document.getElementById("overlay");
const overlayTextEl = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const statusEl = document.getElementById("status");

const PLAYER_SIZE = 28;
const OBSTACLE_SIZE = 24;
const BASE_SPEED = 170;
const MAX_SPEED = 360;
const SCORE_RATE = 10;

let gameState = "idle";
let player = { x: 0, y: 0, speed: 260 };
let obstacles = [];
let keys = {};
let score = 0;
let bestScore = Number(localStorage.getItem("avoid-block-best-score") || 0);
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 0.9;
let gameTime = 0;
let areaWidth = 0;
let areaHeight = 0;

bestScoreEl.textContent = String(bestScore);

function updateAreaSize() {
  const rect = gameArea.getBoundingClientRect();
  areaWidth = rect.width;
  areaHeight = rect.height;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
}

function createObstacle() {
  const x = Math.random() * (areaWidth - OBSTACLE_SIZE);
  const speedBoost = Math.min(gameTime * 8, 120);
  const speed = BASE_SPEED + speedBoost + Math.random() * 60;

  const obstacle = {
    id: crypto.randomUUID(),
    x,
    y: -OBSTACLE_SIZE - 6,
    speed,
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

  player.x += vx * player.speed * delta;
  player.y += vy * player.speed * delta;

  player.x = clamp(player.x, 0, areaWidth - PLAYER_SIZE);
  player.y = clamp(player.y, 0, areaHeight - PLAYER_SIZE);
}

function updateObstacles(delta) {
  for (const ob of obstacles) {
    ob.y += Math.min(ob.speed, MAX_SPEED) * delta;
  }
}

function updateDifficulty(delta) {
  spawnTimer += delta;
  gameTime += delta;

  const minInterval = 0.28;
  spawnInterval = Math.max(minInterval, 0.9 - gameTime * 0.03);

  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    createObstacle();
  }
}

function updateScore(delta) {
  score += SCORE_RATE * delta;
  scoreEl.textContent = String(Math.floor(score));
}

function checkGameOver() {
  const playerBox = { x: player.x, y: player.y };
  for (const ob of obstacles) {
    if (isColliding(playerBox, ob)) {
      return true;
    }
  }
  return false;
}

function clearObstacles() {
  for (const ob of obstacles) {
    ob.el.remove();
  }
  obstacles = [];
}

function endGame() {
  gameState = "ended";
  setStatus("已结束");

  const finalScore = Math.floor(score);
  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem("avoid-block-best-score", String(bestScore));
    bestScoreEl.textContent = String(bestScore);
  }

  showOverlay(`游戏结束！最终得分：${finalScore}`);
}

function gameLoop(timestamp) {
  if (gameState !== "running") return;

  if (!lastTime) lastTime = timestamp;
  const delta = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;

  updateDifficulty(delta);
  updatePlayer(delta);
  updateObstacles(delta);
  removeOffscreenObstacles();
  updateScore(delta);

  renderPlayer();
  renderObstacles();

  if (checkGameOver()) {
    endGame();
    return;
  }

  requestAnimationFrame(gameLoop);
}

function startGame() {
  updateAreaSize();
  clearObstacles();

  score = 0;
  scoreEl.textContent = "0";
  spawnTimer = 0;
  spawnInterval = 0.9;
  gameTime = 0;
  lastTime = 0;

  resetPlayer();
  hideOverlay();
  setStatus("进行中");
  gameState = "running";

  requestAnimationFrame(gameLoop);
}

function tryStartBySpace(event) {
  if (event.code !== "Space") return;
  if (gameState === "running") return;
  event.preventDefault();
  startGame();
}

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;
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

updateAreaSize();
resetPlayer();
showOverlay("按空格开始游戏");
setStatus("未开始");
