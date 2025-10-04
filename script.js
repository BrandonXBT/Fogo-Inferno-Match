// CONFIG
const SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbznPkMpl4pUYNqtOL-_5E0MGwOoBoo4acHQ2qeXOlKBwLripBmL-l83XkOEaJscBhBOIQ/exec";
const SUBMIT_SECRET = "!@ghfjrcx";  // harus sama dengan Apps Script

// GAME CONFIG
const BOARD_SIZE = 8;
const ECOSYSTEMS = 8; // sudah ditambah 1 gambar lagi (fogo1.png ... fogo8.png)
const THRESHOLD_SCORE = 500;
const GAME_DURATION_SEC = 60; // 1 minute

// state
let board = [];
let score = 0;
let gameTimerId = null;
let timeLeft = GAME_DURATION_SEC;
let gameActive = false;

const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const gameDiv = document.getElementById('game');
const scoreSpan = document.getElementById('score');
const timerEl = document.getElementById('timer');
const boardDiv = document.getElementById('board');

let discordName = "";
let walletAddress = "";

startBtn.addEventListener('click', () => {
  discordName = document.getElementById('discordName').value.trim();
  walletAddress = document.getElementById('walletAddress').value.trim();
  if (!discordName || !walletAddress) { alert("Please enter Discord name and Fogo wallet address"); return; }
  overlay.style.display = 'none';
  gameDiv.classList.remove('hidden');
  startGame();
});

function startGame() {
  score = 0;
  timeLeft = GAME_DURATION_SEC;
  gameActive = true;
  scoreSpan.textContent = score;
  timerEl.textContent = `Time: ${timeLeft}s`;
  boardDiv.innerHTML = '';
  initBoard();
  // start countdown
  gameTimerId = setInterval(() => {
    timeLeft--;
    timerEl.textContent = `Time: ${timeLeft}s`;
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function initBoard() {
  board = [];
  boardDiv.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 50px)`;
  boardDiv.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const type = Math.floor(Math.random() * ECOSYSTEMS) + 1;
      board[r][c] = type;
      const tile = createTile(type, r, c);
      boardDiv.appendChild(tile);
    }
  }
}

function createTile(type, r, c) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.style.backgroundImage = `url(assets/fogo${type}.png)`;
  tile.dataset.row = r;
  tile.dataset.col = c;
  tile.addEventListener('click', tileClick);
  return tile;
}

let firstTile = null;
function tileClick(e) {
  if (!gameActive) return;
  const tile = e.currentTarget;
  if (!firstTile) {
    firstTile = tile;
    tile.style.outline = '3px solid rgba(255,255,255,0.6)';
    return;
  }
  swapTiles(firstTile, tile);
  firstTile.style.outline = 'none';
  firstTile = null;
}

function swapTiles(t1, t2) {
  const r1 = Number(t1.dataset.row), c1 = Number(t1.dataset.col);
  const r2 = Number(t2.dataset.row), c2 = Number(t2.dataset.col);
  const dr = Math.abs(r1 - r2), dc = Math.abs(c1 - c2);
  if (dr + dc !== 1) return; // only adjacent
  const temp = board[r1][c1];
  board[r1][c1] = board[r2][c2];
  board[r2][c2] = temp;
  t1.style.backgroundImage = `url(assets/fogo${board[r1][c1]}.png)`;
  t2.style.backgroundImage = `url(assets/fogo${board[r2][c2]}.png)`;
  setTimeout(() => { checkMatchesAndResolve(); }, 120);
}

function checkMatchesAndResolve() {
  const toClear = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      const t = board[r][c];
      if (t === board[r][c+1] && t === board[r][c+2]) {
        toClear.add(`${r},${c}`); toClear.add(`${r},${c+1}`); toClear.add(`${r},${c+2}`);
      }
    }
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const t = board[r][c];
      if (t === board[r+1][c] && t === board[r+2][c]) {
        toClear.add(`${r},${c}`); toClear.add(`${r+1},${c}`); toClear.add(`${r+2},${c}`);
      }
    }
  }
  if (toClear.size === 0) return;
  const gained = toClear.size * 10;
  score += gained;
  scoreSpan.textContent = score;
  for (const key of toClear) {
    const [r,c] = key.split(',').map(Number);
    board[r][c] = null;
    const tileEl = document.querySelector(`.tile[data-row='${r}'][data-col='${c}']`);
    if (tileEl) tileEl.style.opacity = '0.35';
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    const col = [];
    for (let r = BOARD_SIZE - 1; r >= 0; r--) col.push(board[r][c]);
    const filtered = col.filter(v => v !== null);
    while (filtered.length < BOARD_SIZE) filtered.push(Math.floor(Math.random() * ECOSYSTEMS) + 1);
    for (let r = BOARD_SIZE - 1, k = 0; k < BOARD_SIZE; k++, r--) {
      board[r][c] = filtered[k];
    }
  }
  reRenderBoard();
  setTimeout(checkMatchesAndResolve, 160);
}

function reRenderBoard() {
  boardDiv.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tile = createTile(board[r][c], r, c);
      boardDiv.appendChild(tile);
    }
  }
}

function endGame() {
  if (!gameActive) return;
  gameActive = false;
  clearInterval(gameTimerId);
  if (score >= THRESHOLD_SCORE) {
    submitToSheet({ discordName, walletAddress, score })
      .then(ok => {
        if (ok) alert(`Well done! Score ${score} you will get the reward immediately in your wallet.`);
        else alert(`Score ${score} reached threshold but submission failed.`);
      });
  } else {
    alert(`Time's up! Score ${score} — minimum ${THRESHOLD_SCORE} to get rewards.`);
  }
  overlay.style.display = '';
  gameDiv.classList.add('hidden');
}

async function submitToSheet(payload) {
  const body = {
    secret: SUBMIT_SECRET,
    discordName: payload.discordName,
    walletAddress: payload.walletAddress,
    score: payload.score
  };
  try {
    const res = await fetch(SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const txt = await res.text();
    console.log('Sheet response:', txt);
    return res.ok;
  } catch (err) {
    console.error('Submit error', err);
    return false;
  }
}

/* HUD SYNC (append-only) */
(function(){
  function set(id, v){ const el=document.getElementById(id); if(el) el.textContent=String(v); }
  function renderHUD(){
    try {
      set('scoreTop', score);
      set('scoreBig', score);
      set('thresholdNum', score);
      const t = (typeof timeLeft!=='undefined'? timeLeft : 0) + 's';
      set('timeTop', t); set('timeLeftBig', t);
      // best
      const best = Math.max(Number(localStorage.getItem('bestScore')||0), Number(score||0));
      localStorage.setItem('bestScore', best); set('bestPill', best);
      // bar
      const bar=document.getElementById('progressBar');
      if (bar){ const pct=Math.max(0,Math.min(100,Math.round((Number(score||0)/THRESHOLD_SCORE)*100))); bar.style.width=pct+'%'; }
    } catch(e){}
  }
  setInterval(renderHUD, 200);
})();