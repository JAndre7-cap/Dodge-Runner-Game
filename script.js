const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const pauseScreen = document.getElementById('pause-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const themeSelect = document.getElementById('theme-select');
const leaderboardList = document.getElementById('leaderboard-list');
const powerupStatus = document.getElementById('powerup-status');
const mobileControls = document.getElementById('mobile-controls');
const leftZone = document.getElementById('left-zone');
const rightZone = document.getElementById('right-zone');

// Detect if device is mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Audio Context for Procedural Sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, type, duration) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

const sounds = {
    collision: () => playSound(150, 'sawtooth', 0.2),
    powerup: () => playSound(600, 'sine', 0.3),
    levelUp: () => playSound(800, 'square', 0.4)
};

// Set canvas size - responsive for mobile
function resizeCanvas() {
    if (window.innerWidth <= 768) {
        // Use visualViewport to avoid browser chrome clipping the canvas
        const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
        canvas.width = window.innerWidth;
        canvas.height = vh;
    } else {
        canvas.width = 400;
        canvas.height = 600;
    }
    // Always reposition player to sit fully inside the (possibly resized) canvas
    player.y = canvas.height - PLAYER_SIZE - 20;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game State
let gameActive = false;
let gamePaused = false;
let pausedAt = 0;      // timestamp when pause began
let pauseOffset = 0;   // total ms spent paused
let score = 0;
let level = 1;
let startTime;
let obstacles = [];
let powerups = [];
let keys = {};
let activePowerup = null; // { type: 'shield', endTime: timestamp }
let touchMovement = { left: false, right: false }; // For mobile touch controls

// Constants
const PLAYER_SIZE = 40;
const OBSTACLE_SIZE = 30;
const POWERUP_SIZE = 25;
const PLAYER_SPEED = 7;
const INITIAL_FALL_SPEED = 3;
const LEVEL_INTERVAL = 30000; // 30 seconds

// Player Object
const player = {
    x: canvas.width / 2 - PLAYER_SIZE / 2,
    y: canvas.height - PLAYER_SIZE - 20,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    color: '#00FF00'
};

// Powerup Types
const POWERUP_TYPES = [
    { type: 'shield', color: '#00BFFF', duration: 5000, label: '🛡️ Shield' },
    { type: 'slowmo', color: '#FFD700', duration: 7000, label: '⏳ Slow Mo' },
    { type: 'double', color: '#FF00FF', duration: 10000, label: '2️⃣x Points' }
];

// Event Listeners - Keyboard
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (gameActive && !gamePaused) pauseGame();
        else if (gamePaused) resumeGame();
    }
});
window.addEventListener('keyup', e => keys[e.key] = false);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
resumeBtn.addEventListener('click', resumeGame);
themeSelect.addEventListener('change', (e) => {
    document.body.className = 'theme-' + e.target.value;
});

// Event Listeners - Touch Controls
if (isMobile || window.innerWidth <= 768) {
    mobileControls.classList.remove('hidden');
    
    // Left zone
    leftZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchMovement.left = true;
        leftZone.classList.add('active');
    });
    leftZone.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchMovement.left = false;
        leftZone.classList.remove('active');
    });
    
    // Right zone
    rightZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchMovement.right = true;
        rightZone.classList.add('active');
    });
    rightZone.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchMovement.right = false;
        rightZone.classList.remove('active');
    });
    
    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
        if (gameActive) e.preventDefault();
    }, { passive: false });
}

function startGame() {
    gameActive = true;
    gamePaused = false;
    pauseOffset = 0;
    pausedAt = 0;
    score = 0;
    level = 1;
    startTime = Date.now();
    obstacles = [];
    powerups = [];
    activePowerup = null;
    touchMovement = { left: false, right: false };
    player.x = canvas.width / 2 - PLAYER_SIZE / 2;
    player.y = canvas.height - PLAYER_SIZE - 20;
    
    scoreElement.innerText = '0';
    levelElement.innerText = '1';
    powerupStatus.innerText = '';
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    pauseBtn.classList.remove('hidden');
    updateMobileControls();
    
    requestAnimationFrame(gameLoop);
}

function pauseGame() {
    if (!gameActive || gamePaused) return;
    gamePaused = true;
    pausedAt = Date.now();
    pauseScreen.classList.remove('hidden');
    pauseBtn.textContent = '▶';
}

function resumeGame() {
    if (!gamePaused) return;
    gamePaused = false;
    // Shift all time-sensitive references forward by how long we were paused
    const elapsed = Date.now() - pausedAt;
    pauseOffset += elapsed;
    startTime += elapsed;
    if (activePowerup) activePowerup.endTime += elapsed;
    pauseScreen.classList.add('hidden');
    pauseBtn.textContent = '⏸';
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameActive = false;
    gamePaused = false;
    touchMovement = { left: false, right: false };
    pauseBtn.classList.add('hidden');
    updateMobileControls();
    finalScoreElement.innerText = Math.floor(score);
    saveHighScore(Math.floor(score));
    displayLeaderboard();
    gameOverScreen.classList.remove('hidden');
}

function gameLoop() {
    if (!gameActive || gamePaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    update();
    draw();
    
    requestAnimationFrame(gameLoop);
}

function update() {
    // Update Score and Level
    let multiplier = (activePowerup && activePowerup.type === 'double') ? 2 : 1;
    score += (1/60) * 10 * multiplier; // 10 points per second
    scoreElement.innerText = Math.floor(score);

    let currentLevel = Math.floor((Date.now() - startTime) / LEVEL_INTERVAL) + 1;
    if (currentLevel > level) {
        level = currentLevel;
        levelElement.innerText = level;
        sounds.levelUp();
    }

    // Powerup expiry
    if (activePowerup && Date.now() > activePowerup.endTime) {
        activePowerup = null;
        powerupStatus.innerText = '';
    }

    // Player Movement - Keyboard and Touch
    if ((keys['ArrowLeft'] || keys['a'] || keys['A'] || touchMovement.left) && player.x > 0) {
        player.x -= PLAYER_SPEED;
    }
    if ((keys['ArrowRight'] || keys['d'] || keys['D'] || touchMovement.right) && player.x < canvas.width - player.width) {
        player.x += PLAYER_SPEED;
    }

    // Obstacle Spawning
    let fallSpeed = INITIAL_FALL_SPEED + (level * 0.5);
    if (activePowerup && activePowerup.type === 'slowmo') {
        fallSpeed *= 0.5;
    }

    if (Math.random() < 0.02 + (level * 0.005)) {
        obstacles.push({
            x: Math.random() * (canvas.width - OBSTACLE_SIZE),
            y: -OBSTACLE_SIZE,
            width: OBSTACLE_SIZE,
            height: OBSTACLE_SIZE,
            color: '#FF4500'
        });
    }

    // Powerup Spawning
    if (Math.random() < 0.005) {
        const typeInfo = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        powerups.push({
            x: Math.random() * (canvas.width - POWERUP_SIZE),
            y: -POWERUP_SIZE,
            ...typeInfo
        });
    }

    // Update Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.y += fallSpeed;

        // Collision Detection
        if (rectIntersect(player, obs)) {
            if (activePowerup && activePowerup.type === 'shield') {
                obstacles.splice(i, 1);
                activePowerup = null; // Shield breaks
                powerupStatus.innerText = '';
                continue;
            } else {
                sounds.collision();
                gameOver();
            }
        }

        if (obs.y > canvas.height) obstacles.splice(i, 1);
    }

    // Update Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        let p = powerups[i];
        p.y += fallSpeed * 0.8;

        if (rectIntersect(player, { x: p.x, y: p.y, width: POWERUP_SIZE, height: POWERUP_SIZE })) {
            activePowerup = {
                type: p.type,
                endTime: Date.now() + p.duration
            };
            powerupStatus.innerText = p.label + ' Active!';
            sounds.powerup();
            powerups.splice(i, 1);
        }

        if (p.y > canvas.height) powerups.splice(i, 1);
    }
}

function draw() {
    // Draw Player with scaling for responsive canvas
    ctx.fillStyle = player.color;
    if (activePowerup && activePowerup.type === 'shield') {
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(player.x - 5, player.y - 5, player.width + 10, player.height + 10);
    }
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Draw instruction text on mobile
    if (isMobile && !gameActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Tap left or right to move', canvas.width / 2, 50);
    }

    // Draw Obstacles
    ctx.fillStyle = '#FF4500';
    obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });

    // Draw Powerups
    powerups.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x + POWERUP_SIZE/2, p.y + POWERUP_SIZE/2, POWERUP_SIZE/2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.width || 
             r2.x + r2.width < r1.x || 
             r2.y > r1.y + r1.height ||
             r2.y + r2.height < r1.y);
}

// Update mobile controls visibility based on game state
function updateMobileControls() {
    if (gameActive && !gamePaused && (isMobile || window.innerWidth <= 768)) {
        mobileControls.classList.remove('hidden');
    } else if (!gameActive) {
        mobileControls.classList.add('hidden');
    }
}

// Leaderboard Logic
function saveHighScore(score) {
    let scores = JSON.parse(localStorage.getItem('dodgeRunnerScores') || '[]');
    scores.push({ score, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 5); // Keep top 5
    localStorage.setItem('dodgeRunnerScores', JSON.stringify(scores));
}

function displayLeaderboard() {
    let scores = JSON.parse(localStorage.getItem('dodgeRunnerScores') || '[]');
    leaderboardList.innerHTML = scores.map(s => `<li><span>${s.date}</span> <span>${s.score}</span></li>`).join('');
}

// Initialize mobile controls on page load
window.addEventListener('load', () => {
    resizeCanvas();
    if (isMobile || window.innerWidth <= 768) {
        mobileControls.classList.remove('hidden');
    }
});
