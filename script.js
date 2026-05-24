const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const finalScoreElement = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const themeSelect = document.getElementById('theme-select');
const leaderboardList = document.getElementById('leaderboard-list');
const powerupStatus = document.getElementById('powerup-status');

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

// Set canvas size
canvas.width = 400;
canvas.height = 600;

// Game State
let gameActive = false;
let score = 0;
let level = 1;
let startTime;
let obstacles = [];
let powerups = [];
let keys = {};
let activePowerup = null; // { type: 'shield', endTime: timestamp }

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

// Event Listeners
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
themeSelect.addEventListener('change', (e) => {
    document.body.className = 'theme-' + e.target.value;
});

function startGame() {
    gameActive = true;
    score = 0;
    level = 1;
    startTime = Date.now();
    obstacles = [];
    powerups = [];
    activePowerup = null;
    player.x = canvas.width / 2 - PLAYER_SIZE / 2;
    
    scoreElement.innerText = '0';
    levelElement.innerText = '1';
    powerupStatus.innerText = '';
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    gameActive = false;
    finalScoreElement.innerText = Math.floor(score);
    saveHighScore(Math.floor(score));
    displayLeaderboard();
    gameOverScreen.classList.remove('hidden');
}

function gameLoop() {
    if (!gameActive) return;

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

    // Player Movement
    if ((keys['ArrowLeft'] || keys['a'] || keys['A']) && player.x > 0) {
        player.x -= PLAYER_SPEED;
    }
    if ((keys['ArrowRight'] || keys['d'] || keys['D']) && player.x < canvas.width - player.width) {
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
    // Draw Player
    ctx.fillStyle = player.color;
    if (activePowerup && activePowerup.type === 'shield') {
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(player.x - 5, player.y - 5, player.width + 10, player.height + 10);
    }
    ctx.fillRect(player.x, player.y, player.width, player.height);

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
