// 1. CONSTANTS & CONFIGURATION (Must be at the top)
const PLAYER_SIZE = 40;
const OBSTACLE_SIZE = 30;
const POWERUP_SIZE = 25;
const PLAYER_SPEED = 7;
const INITIAL_FALL_SPEED = 3;
const LEVEL_INTERVAL = 30000;

const POWERUP_TYPES = [
    { type: 'shield', color: '#00BFFF', duration: 5000, label: '🛡️ Shield' },
    { type: 'slowmo', color: '#FFD700', duration: 7000, label: '⏳ Slow Mo' },
    { type: 'double', color: '#FF00FF', duration: 10000, label: '2️⃣x Points' }
];

// 2. GAME STATE
let gameActive = false;
let gamePaused = false;
let pausedAt = 0;
let pauseOffset = 0;
let score = 0;
let level = 1;
let startTime;
let obstacles = [];
let powerups = [];
let keys = {};
let activePowerup = null;
let touchMovement = { left: false, right: false };

// 3. DOM ELEMENTS (Will be assigned in init)
let canvas, ctx, scoreElement, levelElement, finalScoreElement;
let startScreen, gameOverScreen, pauseScreen, startBtn, restartBtn, pauseBtn, resumeBtn;
let themeSelect, leaderboardList, powerupStatus, mobileControls, leftZone, rightZone;

// 4. PLAYER OBJECT
const player = {
    x: 0,
    y: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    color: '#00FF00'
};

// 5. AUDIO SYSTEM (Robust handling)
let audioCtx;
try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
        audioCtx = new AudioContextClass();
    }
} catch (e) {
    console.warn("Audio not supported or blocked by browser policy");
}

function playSound(freq, type, duration) {
    if (!audioCtx || audioCtx.state === 'closed') return;
    try {
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
    } catch (e) {}
}

const sounds = {
    collision: () => playSound(150, 'sawtooth', 0.2),
    powerup: () => playSound(600, 'sine', 0.3),
    levelUp: () => playSound(800, 'square', 0.4)
};

// 6. CORE GAME LOGIC
function resizeCanvas() {
    if (!canvas) return;
    if (window.innerWidth <= 768) {
        const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
        canvas.width = window.innerWidth;
        canvas.height = vh;
    } else {
        canvas.width = 400;
        canvas.height = 600;
    }
    player.y = canvas.height - PLAYER_SIZE - 20;
    if (!gameActive) {
        player.x = canvas.width / 2 - PLAYER_SIZE / 2;
    }
}

function startGame() {
    // Attempt to resume audio context on user interaction
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.log("Audio resume failed:", e));
    }

    gameActive = true;
    gamePaused = false;
    score = 0;
    level = 1;
    startTime = Date.now();
    obstacles = [];
    powerups = [];
    activePowerup = null;
    
    player.x = canvas.width / 2 - PLAYER_SIZE / 2;
    player.y = canvas.height - PLAYER_SIZE - 20;
    
    if (scoreElement) scoreElement.innerText = '0';
    if (levelElement) levelElement.innerText = '1';
    if (powerupStatus) powerupStatus.innerText = '';
    
    if (startScreen) startScreen.classList.add('hidden');
    if (gameOverScreen) gameOverScreen.classList.add('hidden');
    if (pauseScreen) pauseScreen.classList.add('hidden');
    if (pauseBtn) pauseBtn.classList.remove('hidden');
    
    updateMobileControls();
    requestAnimationFrame(gameLoop);
}

function pauseGame() {
    if (!gameActive || gamePaused) return;
    gamePaused = true;
    pausedAt = Date.now();
    if (pauseScreen) pauseScreen.classList.remove('hidden');
    if (pauseBtn) pauseBtn.textContent = '▶';
}

function resumeGame() {
    if (!gamePaused) return;
    gamePaused = false;
    const elapsed = Date.now() - pausedAt;
    startTime += elapsed;
    if (activePowerup) activePowerup.endTime += elapsed;
    if (pauseScreen) pauseScreen.classList.add('hidden');
    if (pauseBtn) pauseBtn.textContent = '⏸';
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameActive = false;
    if (pauseBtn) pauseBtn.classList.add('hidden');
    updateMobileControls();
    if (finalScoreElement) finalScoreElement.innerText = Math.floor(score);
    saveHighScore(Math.floor(score));
    displayLeaderboard();
    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
}

function gameLoop() {
    if (!gameActive || gamePaused) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    let multiplier = (activePowerup && activePowerup.type === 'double') ? 2 : 1;
    score += (1/60) * 10 * multiplier;
    if (scoreElement) scoreElement.innerText = Math.floor(score);

    let currentLevel = Math.floor((Date.now() - startTime) / LEVEL_INTERVAL) + 1;
    if (currentLevel > level) {
        level = currentLevel;
        if (levelElement) levelElement.innerText = level;
        sounds.levelUp();
    }

    if (activePowerup && Date.now() > activePowerup.endTime) {
        activePowerup = null;
        if (powerupStatus) powerupStatus.innerText = '';
    }

    if ((keys['ArrowLeft'] || keys['a'] || keys['A'] || touchMovement.left) && player.x > 0) {
        player.x -= PLAYER_SPEED;
    }
    if ((keys['ArrowRight'] || keys['d'] || keys['D'] || touchMovement.right) && player.x < canvas.width - player.width) {
        player.x += PLAYER_SPEED;
    }

    let fallSpeed = INITIAL_FALL_SPEED + (level * 0.5);
    if (activePowerup && activePowerup.type === 'slowmo') fallSpeed *= 0.5;

    if (Math.random() < 0.02 + (level * 0.005)) {
        obstacles.push({
            x: Math.random() * (canvas.width - OBSTACLE_SIZE),
            y: -OBSTACLE_SIZE,
            width: OBSTACLE_SIZE,
            height: OBSTACLE_SIZE
        });
    }

    if (Math.random() < 0.005) {
        const typeInfo = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        powerups.push({
            x: Math.random() * (canvas.width - POWERUP_SIZE),
            y: -POWERUP_SIZE,
            ...typeInfo
        });
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.y += fallSpeed;
        if (rectIntersect(player, obs)) {
            if (activePowerup && activePowerup.type === 'shield') {
                obstacles.splice(i, 1);
                activePowerup = null;
                if (powerupStatus) powerupStatus.innerText = '';
                continue;
            } else {
                sounds.collision();
                gameOver();
            }
        }
        if (obs.y > canvas.height) obstacles.splice(i, 1);
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
        let p = powerups[i];
        p.y += fallSpeed * 0.8;
        if (rectIntersect(player, { x: p.x, y: p.y, width: POWERUP_SIZE, height: POWERUP_SIZE })) {
            activePowerup = { type: p.type, endTime: Date.now() + p.duration };
            if (powerupStatus) powerupStatus.innerText = p.label + ' Active!';
            sounds.powerup();
            powerups.splice(i, 1);
        }
        if (p.y > canvas.height) powerups.splice(i, 1);
    }
}

function draw() {
    ctx.fillStyle = player.color;
    if (activePowerup && activePowerup.type === 'shield') {
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(player.x - 5, player.y - 5, player.width + 10, player.height + 10);
    }
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    ctx.fillStyle = '#FF4500';
    obstacles.forEach(obs => ctx.fillRect(obs.x, obs.y, obs.width, obs.height));

    powerups.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x + POWERUP_SIZE/2, p.y + POWERUP_SIZE/2, POWERUP_SIZE/2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.width || r2.x + r2.width < r1.x || r2.y > r1.y + r1.height || r2.y + r2.height < r1.y);
}

function updateMobileControls() {
    if (!mobileControls) return;
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (gameActive && !gamePaused && (isMobileDevice || window.innerWidth <= 768)) {
        mobileControls.classList.remove('hidden');
    } else {
        mobileControls.classList.add('hidden');
    }
}

function saveHighScore(score) {
    try {
        let scores = JSON.parse(localStorage.getItem('dodgeRunnerScores') || '[]');
        scores.push({ score, date: new Date().toLocaleDateString() });
        scores.sort((a, b) => b.score - a.score);
        scores = scores.slice(0, 5);
        localStorage.setItem('dodgeRunnerScores', JSON.stringify(scores));
    } catch(e) {}
}

function displayLeaderboard() {
    if (!leaderboardList) return;
    try {
        let scores = JSON.parse(localStorage.getItem('dodgeRunnerScores') || '[]');
        leaderboardList.innerHTML = scores.map(s => `<li><span>${s.date}</span> <span>${s.score}</span></li>`).join('');
    } catch(e) {}
}

// 7. INITIALIZATION
function init() {
    console.log("Initializing Dodge Runner...");
    
    // Assign DOM Elements
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');
    
    scoreElement = document.getElementById('score');
    levelElement = document.getElementById('level');
    finalScoreElement = document.getElementById('final-score');
    startScreen = document.getElementById('start-screen');
    gameOverScreen = document.getElementById('game-over-screen');
    pauseScreen = document.getElementById('pause-screen');
    startBtn = document.getElementById('start-btn');
    restartBtn = document.getElementById('restart-btn');
    pauseBtn = document.getElementById('pause-btn');
    resumeBtn = document.getElementById('resume-btn');
    themeSelect = document.getElementById('theme-select');
    leaderboardList = document.getElementById('leaderboard-list');
    powerupStatus = document.getElementById('powerup-status');
    mobileControls = document.getElementById('mobile-controls');
    leftZone = document.getElementById('left-zone');
    rightZone = document.getElementById('right-zone');

    // Set initial layout
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Keyboard Listeners
    window.addEventListener('keydown', e => {
        keys[e.key] = true;
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
            if (gameActive && !gamePaused) pauseGame();
            else if (gamePaused) resumeGame();
        }
    });
    window.addEventListener('keyup', e => keys[e.key] = false);

    // Button Listeners
    if (startBtn) startBtn.addEventListener('click', startGame);
    if (restartBtn) restartBtn.addEventListener('click', startGame);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseGame);
    if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
    if (themeSelect) themeSelect.addEventListener('change', (e) => {
        document.body.className = 'theme-' + e.target.value;
    });

    // Touch Controls
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobileDevice || window.innerWidth <= 768) {
        if (leftZone) {
            leftZone.addEventListener('touchstart', (e) => { e.preventDefault(); touchMovement.left = true; leftZone.classList.add('active'); });
            leftZone.addEventListener('touchend', (e) => { e.preventDefault(); touchMovement.left = false; leftZone.classList.remove('active'); });
        }
        if (rightZone) {
            rightZone.addEventListener('touchstart', (e) => { e.preventDefault(); touchMovement.right = true; rightZone.classList.add('active'); });
            rightZone.addEventListener('touchend', (e) => { e.preventDefault(); touchMovement.right = false; rightZone.classList.remove('active'); });
        }
        document.addEventListener('touchmove', (e) => { if (gameActive) e.preventDefault(); }, { passive: false });
    }
    
    // Toggle Instructions based on device
    const desktopInst = document.getElementById('desktop-instructions');
    const mobileInst = document.getElementById('mobile-instructions');
    
    if (isMobileDevice || window.innerWidth <= 768) {
        if (desktopInst) desktopInst.classList.add('hidden');
        if (mobileInst) mobileInst.classList.remove('hidden');
    } else {
        if (desktopInst) desktopInst.classList.remove('hidden');
        if (mobileInst) mobileInst.classList.add('hidden');
    }

    console.log("Initialization complete. Ready to play.");
}

// Ensure init runs when page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
