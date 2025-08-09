(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const speedSlider = document.getElementById('speedSlider');
  const speedLabel = document.getElementById('speedLabel');

  const CELL_SIZE = 20; // 24x24 = 576; We will use 24 cells for 480 px
  const COLS = Math.floor(canvas.width / CELL_SIZE);
  const ROWS = Math.floor(canvas.height / CELL_SIZE);

  const Key = {
    ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
    KeyW: 'KeyW', KeyS: 'KeyS', KeyA: 'KeyA', KeyD: 'KeyD', Space: 'Space'
  };

  const Direction = {
    Up: { x: 0, y: -1 },
    Down: { x: 0, y: 1 },
    Left: { x: -1, y: 0 },
    Right: { x: 1, y: 0 }
  };

  let animationTimerId = null;
  let isRunning = false;
  let isGameOver = false;
  let currentDirection = Direction.Right;
  let nextDirection = Direction.Right;
  let snake = [];
  let food = null;
  let score = 0;
  let highScore = Number(localStorage.getItem('snake_high_score') || 0);
  highScoreEl.textContent = String(highScore);

  const speedLevelToMs = (level) => {
    // level 1..5 -> 180..60ms
    const clamped = Math.max(1, Math.min(5, Number(level)));
    return 240 - clamped * 36; // 1->204, 5->60; feels good
  };

  const colors = {
    grid: '#1f294a',
    snakeHead: '#6ee7b7',
    snakeBody: '#34d399',
    snakeShadow: 'rgba(110,231,183,0.18)',
    food: '#60a5fa',
    foodGlow: 'rgba(96,165,250,0.35)'
  };

  function resetGame() {
    score = 0;
    scoreEl.textContent = '0';
    isGameOver = false;
    isRunning = false;
    currentDirection = Direction.Right;
    nextDirection = Direction.Right;
    const startX = Math.floor(COLS / 3);
    const startY = Math.floor(ROWS / 2);
    snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    spawnFood();
    drawAll();
    updateOverlay('按 开始 或 空格 键开始');
    pauseBtn.disabled = true;
    restartBtn.disabled = true;
  }

  function updateOverlay(text = '') {
    if (!text) {
      overlay.classList.add('overlay--hidden');
      overlay.textContent = '';
    } else {
      overlay.classList.remove('overlay--hidden');
      overlay.textContent = text;
    }
  }

  function spawnFood() {
    while (true) {
      const x = Math.floor(Math.random() * COLS);
      const y = Math.floor(Math.random() * ROWS);
      if (!snake.some((s) => s.x === x && s.y === y)) {
        food = { x, y };
        return;
      }
    }
  }

  function drawGrid() {
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 0; c <= COLS; c++) {
      const x = c * CELL_SIZE + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = r * CELL_SIZE + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
  }

  function drawSnake() {
    // shadow
    ctx.fillStyle = colors.snakeShadow;
    snake.forEach(({ x, y }) => {
      ctx.fillRect(
        x * CELL_SIZE + 2,
        y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      );
    });
    // body
    ctx.fillStyle = colors.snakeBody;
    for (let i = snake.length - 1; i >= 1; i--) {
      const { x, y } = snake[i];
      roundRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4, 6);
    }
    // head
    ctx.fillStyle = colors.snakeHead;
    const head = snake[0];
    roundRect(head.x * CELL_SIZE + 1, head.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2, 8);
  }

  function drawFood() {
    if (!food) return;
    // glow
    ctx.fillStyle = colors.foodGlow;
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE * 0.46,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // core
    ctx.fillStyle = colors.food;
    roundRect(
      food.x * CELL_SIZE + 4,
      food.y * CELL_SIZE + 4,
      CELL_SIZE - 8,
      CELL_SIZE - 8,
      6
    );
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawFood();
    drawSnake();
  }

  function tick() {
    if (!isRunning || isGameOver) return;
    step();
    drawAll();
  }

  function step() {
    // apply nextDirection, prevent 180° turn
    if (nextDirection) {
      const [hx, hy] = [snake[0].x, snake[0].y];
      const [nx, ny] = [hx + nextDirection.x, hy + nextDirection.y];
      const [bx, by] = [snake[1].x, snake[1].y];
      if (!(nx === bx && ny === by)) {
        currentDirection = nextDirection;
      }
    }

    const newHead = {
      x: (snake[0].x + currentDirection.x + COLS) % COLS,
      y: (snake[0].y + currentDirection.y + ROWS) % ROWS
    };

    // self-collision
    if (snake.some((s, i) => i !== 0 && s.x === newHead.x && s.y === newHead.y)) {
      endGame();
      return;
    }

    snake.unshift(newHead);

    // eat
    if (food && newHead.x === food.x && newHead.y === food.y) {
      score += 10;
      scoreEl.textContent = String(score);
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('snake_high_score', String(highScore));
        highScoreEl.textContent = String(highScore);
      }
      spawnFood();
    } else {
      snake.pop();
    }
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    isGameOver = false;
    updateOverlay('');
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    restartBtn.disabled = false;
    scheduleLoop();
  }

  function pause() {
    if (!isRunning) return;
    isRunning = false;
    if (animationTimerId) clearInterval(animationTimerId);
    updateOverlay('已暂停 · 空格继续');
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  }

  function endGame() {
    isGameOver = true;
    isRunning = false;
    if (animationTimerId) clearInterval(animationTimerId);
    updateOverlay('游戏结束 · 重开试试');
    startBtn.disabled = true;
    pauseBtn.disabled = true;
    restartBtn.disabled = false;
  }

  function restart() {
    if (animationTimerId) clearInterval(animationTimerId);
    resetGame();
  }

  function scheduleLoop() {
    if (animationTimerId) clearInterval(animationTimerId);
    const ms = speedLevelToMs(speedSlider.value);
    speedLabel.textContent = speedSlider.value + 'x';
    animationTimerId = setInterval(tick, ms);
  }

  function handleKey(e) {
    const code = e.code;
    if (code === Key.Space) {
      e.preventDefault();
      if (isGameOver) return;
      if (isRunning) pause(); else start();
      return;
    }
    const map = {
      [Key.ArrowUp]: Direction.Up,
      [Key.KeyW]: Direction.Up,
      [Key.ArrowDown]: Direction.Down,
      [Key.KeyS]: Direction.Down,
      [Key.ArrowLeft]: Direction.Left,
      [Key.KeyA]: Direction.Left,
      [Key.ArrowRight]: Direction.Right,
      [Key.KeyD]: Direction.Right
    };
    if (map[code]) {
      e.preventDefault();
      nextDirection = map[code];
    }
  }

  // Touch controls
  let touchStartX = 0, touchStartY = 0, touchMoved = false;
  function onTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchMoved = false;
  }
  function onTouchMove(e) {
    if (!e.touches || e.touches.length === 0) return;
    touchMoved = true;
  }
  function onTouchEnd(e) {
    if (!touchMoved) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      nextDirection = dx > 0 ? Direction.Right : Direction.Left;
    } else {
      nextDirection = dy > 0 ? Direction.Down : Direction.Up;
    }
  }

  // Events
  document.addEventListener('keydown', handleKey);
  startBtn.addEventListener('click', start);
  pauseBtn.addEventListener('click', pause);
  restartBtn.addEventListener('click', restart);
  speedSlider.addEventListener('input', scheduleLoop);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });

  // Bootstrap
  resetGame();
})();


