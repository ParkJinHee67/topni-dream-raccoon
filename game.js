// 게임 상수
const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    TILE_SIZE: 20,
    PLAYER_SPEED: 2,
    ENEMY_SPEED: 1,
    PEPPER_SPEED: 4,
    GRAVITY: 0.3,
    JUMP_FORCE: -8
};

// 오디오 시스템
class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.isMuted = false;
        this.masterVolume = 0.3;
        this.initAudio();
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createSounds();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    createSounds() {
        // 사운드 생성 함수들
        this.sounds = {
            move: this.createTone(220, 0.1, 'sine'),
            jump: this.createTone(330, 0.2, 'square'),
            pepper: this.createTone(440, 0.15, 'sawtooth'),
            hit: this.createTone(150, 0.3, 'square'),
            fall: this.createTone(100, 0.5, 'triangle'),
            levelComplete: this.createMelody([440, 550, 660, 880], [0.3, 0.3, 0.3, 0.6]),
            gameOver: this.createMelody([330, 220, 165, 110], [0.4, 0.4, 0.4, 0.8]),
            background: this.createBackgroundMusic()
        };
    }

    createTone(frequency, duration, type = 'sine') {
        return () => {
            if (this.isMuted || !this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.5, this.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }

    createMelody(frequencies, durations) {
        return () => {
            if (this.isMuted || !this.audioContext) return;
            
            let currentTime = this.audioContext.currentTime;
            
            frequencies.forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, currentTime);
                oscillator.type = 'square';
                
                gainNode.gain.setValueAtTime(0, currentTime);
                gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.3, currentTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + durations[index]);
                
                oscillator.start(currentTime);
                oscillator.stop(currentTime + durations[index]);
                
                currentTime += durations[index] * 0.8;
            });
        };
    }

    createBackgroundMusic() {
        const melody = [220, 247, 262, 294, 330, 349, 392, 440];
        return () => {
            if (this.isMuted || !this.audioContext) return;
            
            const playNote = (frequency, delay) => {
                setTimeout(() => {
                    if (this.isMuted) return;
                    
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                    oscillator.type = 'triangle';
                    
                    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.1, this.audioContext.currentTime + 0.1);
                    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.8);
                }, delay);
            };
            
            melody.forEach((freq, index) => {
                playNote(freq, index * 400);
            });
        };
    }

    play(soundName) {
        if (this.sounds[soundName] && !this.isMuted) {
            this.sounds[soundName]();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }

    resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
}

// 전역 오디오 매니저
const audioManager = new AudioManager();

// 게임 상태
let gameState = {
    score: 0,
    topScore: localStorage.getItem('topScore') || 10000,
    level: 1,
    lives: 3,
    gameStatus: 'menu', // menu, playing, paused, gameOver, levelComplete
    peppers: 3
};

// Canvas 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// 게임 객체들
let player;
let enemies = [];
let burgerParts = [];
let platforms = [];
let ladders = [];
let pepperShots = [];
let particles = [];

// 키 입력 상태
const keys = {};

// 플레이어 클래스
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 20;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.onLadder = false;
        this.direction = 1; // 1: 오른쪽, -1: 왼쪽
        this.animFrame = 0;
        this.animTimer = 0;
        this.invulnerable = false;
        this.invulnerableTimer = 0;
    }

    update() {
        // 무적 시간 처리
        if (this.invulnerable) {
            this.invulnerableTimer--;
            if (this.invulnerableTimer <= 0) {
                this.invulnerable = false;
            }
        }

        // 키 입력 처리
        let wasMoving = this.vx !== 0;
        this.vx = 0;
        
        if (keys['ArrowLeft'] || keys['a']) {
            this.vx = -GAME_CONFIG.PLAYER_SPEED;
            this.direction = -1;
        }
        if (keys['ArrowRight'] || keys['d']) {
            this.vx = GAME_CONFIG.PLAYER_SPEED;
            this.direction = 1;
        }

        // 이동 사운드
        if (this.vx !== 0 && !wasMoving && this.onGround) {
            audioManager.play('move');
        }

        // 사다리 체크
        let wasOnLadder = this.onLadder;
        this.checkLadder();

        if (this.onLadder) {
            this.vy = 0;
            if (keys['ArrowUp'] || keys['w']) {
                this.vy = -GAME_CONFIG.PLAYER_SPEED;
                if (!wasOnLadder) audioManager.play('jump');
            }
            if (keys['ArrowDown'] || keys['s']) {
                this.vy = GAME_CONFIG.PLAYER_SPEED;
            }
        } else {
            // 중력 적용
            this.vy += GAME_CONFIG.GRAVITY;
        }

        // 플랫폼 충돌 체크
        this.checkPlatformCollision();

        // 위치 업데이트
        this.x += this.vx;
        this.y += this.vy;

        // 화면 경계 체크
        this.x = Math.max(0, Math.min(this.x, GAME_CONFIG.CANVAS_WIDTH - this.width));

        // 애니메이션 업데이트
        if (this.vx !== 0 || this.vy !== 0) {
            this.animTimer++;
            if (this.animTimer >= 10) {
                this.animFrame = (this.animFrame + 1) % 4;
                this.animTimer = 0;
            }
        }
    }

    checkLadder() {
        this.onLadder = false;
        for (let ladder of ladders) {
            if (this.x + this.width/2 >= ladder.x && 
                this.x + this.width/2 <= ladder.x + ladder.width &&
                this.y + this.height >= ladder.y && 
                this.y <= ladder.y + ladder.height) {
                this.onLadder = true;
                break;
            }
        }
    }

    checkPlatformCollision() {
        this.onGround = false;
        for (let platform of platforms) {
            // 발 밑 플랫폼 체크
            if (this.x + this.width > platform.x && 
                this.x < platform.x + platform.width &&
                this.y + this.height >= platform.y && 
                this.y + this.height <= platform.y + platform.height + 5) {
                if (this.vy >= 0) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                }
            }
        }
    }

    shootPepper() {
        if (gameState.peppers > 0) {
            gameState.peppers--;
            pepperShots.push(new PepperShot(
                this.x + this.width/2, 
                this.y + this.height/2, 
                this.direction
            ));
            audioManager.play('pepper');
            updateUI();
        }
    }

    takeDamage() {
        if (!this.invulnerable) {
            gameState.lives--;
            this.invulnerable = true;
            this.invulnerableTimer = 120; // 2초간 무적
            
            // 사운드 효과
            audioManager.play('hit');
            
            // 파티클 효과
            for (let i = 0; i < 10; i++) {
                particles.push(new Particle(
                    this.x + this.width/2, 
                    this.y + this.height/2, 
                    'red'
                ));
            }
            
            updateUI();
            
            if (gameState.lives <= 0) {
                gameOver();
            }
        }
    }

    draw() {
        ctx.save();
        
        // 무적 상태일 때 깜빡임 효과
        if (this.invulnerable && Math.floor(this.invulnerableTimer / 5) % 2) {
            ctx.globalAlpha = 0.5;
        }

        // 플레이어 그리기 (요리사)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 요리사 모자
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(this.x + 2, this.y, this.width - 4, 6);
        
        // 얼굴
        ctx.fillStyle = '#FFDBAC';
        ctx.fillRect(this.x + 3, this.y + 6, this.width - 6, 8);
        
        // 눈
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.x + 5, this.y + 8, 2, 2);
        ctx.fillRect(this.x + 9, this.y + 8, 2, 2);
        
        // 몸체
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(this.x + 2, this.y + 14, this.width - 4, 6);
        
        ctx.restore();
    }
}

// 적 클래스
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 16;
        this.vx = (Math.random() > 0.5 ? 1 : -1) * GAME_CONFIG.ENEMY_SPEED;
        this.vy = 0;
        this.type = type; // 'sausage', 'egg', 'pickle'
        this.onGround = false;
        this.stunned = false;
        this.stunnedTimer = 0;
        this.direction = this.vx > 0 ? 1 : -1;
        this.animFrame = 0;
        this.animTimer = 0;
    }

    update() {
        if (this.stunned) {
            this.stunnedTimer--;
            if (this.stunnedTimer <= 0) {
                this.stunned = false;
            }
            return;
        }

        // AI 행동 (간단한 플레이어 추적)
        if (Math.random() < 0.02) { // 가끔 방향 전환
            this.vx = -this.vx;
            this.direction = this.vx > 0 ? 1 : -1;
        }

        // 플레이어를 향해 이동 (확률적으로)
        if (Math.random() < 0.01) {
            if (player.x > this.x) {
                this.vx = Math.abs(this.vx);
                this.direction = 1;
            } else {
                this.vx = -Math.abs(this.vx);
                this.direction = -1;
            }
        }

        // 중력 적용
        this.vy += GAME_CONFIG.GRAVITY;

        // 플랫폼 충돌 체크
        this.checkPlatformCollision();

        // 위치 업데이트
        this.x += this.vx;
        this.y += this.vy;

        // 화면 경계에서 방향 전환
        if (this.x <= 0 || this.x >= GAME_CONFIG.CANVAS_WIDTH - this.width) {
            this.vx = -this.vx;
            this.direction = -this.direction;
        }

        // 애니메이션
        this.animTimer++;
        if (this.animTimer >= 15) {
            this.animFrame = (this.animFrame + 1) % 2;
            this.animTimer = 0;
        }
    }

    checkPlatformCollision() {
        this.onGround = false;
        for (let platform of platforms) {
            if (this.x + this.width > platform.x && 
                this.x < platform.x + platform.width &&
                this.y + this.height >= platform.y && 
                this.y + this.height <= platform.y + platform.height + 5) {
                if (this.vy >= 0) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                }
            }
        }
    }

    stun() {
        this.stunned = true;
        this.stunnedTimer = 180; // 3초간 기절
        
        // 파티클 효과
        for (let i = 0; i < 5; i++) {
            particles.push(new Particle(this.x + this.width/2, this.y, 'yellow'));
        }
    }

    draw() {
        ctx.save();
        
        if (this.stunned) {
            ctx.globalAlpha = 0.7;
        }

        // 적 타입별 그리기
        switch(this.type) {
            case 'sausage':
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(this.x, this.y + 4, this.width, this.height - 8);
                ctx.fillStyle = '#A0522D';
                ctx.fillRect(this.x + 2, this.y + 6, this.width - 4, this.height - 12);
                break;
            case 'egg':
                ctx.fillStyle = '#FFFACD';
                ctx.beginPath();
                ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/2, 0, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.ellipse(this.x + this.width/2, this.y + this.height/2 + 2, this.width/3, this.height/3, 0, 0, 2 * Math.PI);
                ctx.fill();
                break;
            case 'pickle':
                ctx.fillStyle = '#228B22';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.fillStyle = '#32CD32';
                for (let i = 0; i < 3; i++) {
                    ctx.fillRect(this.x + 2, this.y + 2 + i * 4, this.width - 4, 2);
                }
                break;
        }

        // 기절 시 별 표시
        if (this.stunned) {
            ctx.fillStyle = '#FFFF00';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('★', this.x + this.width/2, this.y - 5);
        }

        ctx.restore();
    }
}

// 후추 클래스
class PepperShot {
    constructor(x, y, direction) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 4;
        this.vx = direction * GAME_CONFIG.PEPPER_SPEED;
        this.vy = 0;
        this.lifetime = 60; // 1초
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.lifetime--;

        // 적과의 충돌 체크
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            if (this.x < enemy.x + enemy.width &&
                this.x + this.width > enemy.x &&
                this.y < enemy.y + enemy.height &&
                this.y + this.height > enemy.y) {
                
                enemy.stun();
                gameState.score += 50;
                updateUI();
                
                // 후추 제거
                return false;
            }
        }

        return this.lifetime > 0 && this.x >= 0 && this.x <= GAME_CONFIG.CANVAS_WIDTH;
    }

    draw() {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2, 2, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// 버거 재료 클래스
class BurgerPart {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 12;
        this.type = type; // 'bun_top', 'lettuce', 'tomato', 'patty', 'bun_bottom'
        this.stepped = 0; // 밟힌 횟수
        this.maxSteps = 4; // 떨어지기 위해 필요한 밟힌 횟수
        this.falling = false;
        this.fallSpeed = 0;
        this.completed = false;
    }

    update() {
        if (this.falling) {
            this.fallSpeed += 0.3;
            this.y += this.fallSpeed;
            
            // 다른 버거 재료나 바닥과 충돌 체크
            for (let platform of platforms) {
                if (this.x + this.width > platform.x && 
                    this.x < platform.x + platform.width &&
                    this.y + this.height >= platform.y && 
                    this.y + this.height <= platform.y + platform.height + 5) {
                    this.y = platform.y - this.height;
                    this.falling = false;
                    this.fallSpeed = 0;
                    
                    // 점수 추가
                    gameState.score += 100;
                    updateUI();
                    
                    // 사운드 효과
                    audioManager.play('fall');
                    
                    // 파티클 효과
                    for (let i = 0; i < 8; i++) {
                        particles.push(new Particle(
                            this.x + this.width/2, 
                            this.y + this.height, 
                            'orange'
                        ));
                    }
                    break;
                }
            }
        }

        // 플레이어가 밟았는지 체크
        if (!this.falling && this.stepped < this.maxSteps) {
            if (player.x + player.width > this.x && 
                player.x < this.x + this.width &&
                player.y + player.height >= this.y - 5 && 
                player.y + player.height <= this.y + 5) {
                
                this.stepped++;
                gameState.score += 25;
                updateUI();
                
                if (this.stepped >= this.maxSteps) {
                    this.falling = true;
                }
            }
        }
    }

    draw() {
        let colors = {
            'bun_top': '#DEB887',
            'lettuce': '#90EE90',
            'tomato': '#FF6347',
            'patty': '#8B4513',
            'bun_bottom': '#DEB887'
        };

        ctx.fillStyle = colors[this.type] || '#FFFFFF';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 테두리
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // 밟힌 표시
        for (let i = 0; i < this.stepped; i++) {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(this.x + 5 + i * 15, this.y + 2, 8, 8);
        }
    }
}

// 파티클 클래스
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.color = color;
        this.life = 30;
        this.maxLife = 30;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // 중력
        this.life--;
        return this.life > 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - 1, this.y - 1, 2, 2);
        ctx.restore();
    }
}

// 레벨 생성 함수
function createLevel(levelNum) {
    platforms = [];
    ladders = [];
    burgerParts = [];
    enemies = [];

    // 기본 플랫폼들
    platforms.push(
        { x: 0, y: 550, width: 800, height: 20 },    // 바닥
        { x: 50, y: 450, width: 200, height: 20 },   // 1층 왼쪽
        { x: 350, y: 450, width: 200, height: 20 },  // 1층 오른쪽
        { x: 600, y: 450, width: 150, height: 20 },  // 1층 오른쪽 끝
        { x: 100, y: 350, width: 150, height: 20 },  // 2층 왼쪽
        { x: 400, y: 350, width: 200, height: 20 },  // 2층 중앙
        { x: 650, y: 350, width: 100, height: 20 },  // 2층 오른쪽
        { x: 150, y: 250, width: 200, height: 20 },  // 3층 왼쪽
        { x: 450, y: 250, width: 200, height: 20 },  // 3층 오른쪽
        { x: 300, y: 150, width: 200, height: 20 },  // 4층 중앙
        { x: 350, y: 50, width: 100, height: 20 }    // 최상층
    );

    // 사다리들
    ladders.push(
        { x: 200, y: 450, width: 20, height: 100 },  // 1-2층 연결
        { x: 500, y: 450, width: 20, height: 100 },  // 1-2층 연결
        { x: 300, y: 350, width: 20, height: 100 },  // 2-3층 연결
        { x: 600, y: 350, width: 20, height: 100 },  // 2-3층 연결
        { x: 400, y: 250, width: 20, height: 100 },  // 3-4층 연결
        { x: 380, y: 150, width: 20, height: 100 },  // 4-최상층 연결
    );

    // 버거 재료들 (각 층마다)
    burgerParts.push(
        new BurgerPart(75, 438, 'bun_bottom'),
        new BurgerPart(375, 438, 'patty'),
        new BurgerPart(625, 438, 'bun_bottom'),
        
        new BurgerPart(125, 338, 'lettuce'),
        new BurgerPart(425, 338, 'tomato'),
        new BurgerPart(675, 338, 'lettuce'),
        
        new BurgerPart(175, 238, 'patty'),
        new BurgerPart(475, 238, 'lettuce'),
        
        new BurgerPart(325, 138, 'tomato'),
        
        new BurgerPart(375, 38, 'bun_top')
    );

    // 적들 생성
    const enemyTypes = ['sausage', 'egg', 'pickle'];
    for (let i = 0; i < 3 + levelNum; i++) {
        let platform = platforms[Math.floor(Math.random() * (platforms.length - 1)) + 1];
        enemies.push(new Enemy(
            platform.x + Math.random() * (platform.width - 16),
            platform.y - 16,
            enemyTypes[Math.floor(Math.random() * enemyTypes.length)]
        ));
    }

    // 플레이어 시작 위치
    player = new Player(400, 530);
    gameState.peppers = 3;
}

// 게임 초기화
function initGame() {
    createLevel(gameState.level);
    gameState.gameStatus = 'playing';
    audioManager.play('background');
    updateUI();
}

// UI 업데이트
function updateUI() {
    document.getElementById('player-score').textContent = gameState.score;
    document.getElementById('top-score').textContent = gameState.topScore;
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('lives').textContent = gameState.lives;
    
    // 최고 점수 업데이트
    if (gameState.score > gameState.topScore) {
        gameState.topScore = gameState.score;
        localStorage.setItem('topScore', gameState.topScore);
    }
}

// 게임 오버
function gameOver() {
    gameState.gameStatus = 'gameOver';
    document.getElementById('status-message').textContent = '게임 오버! R키를 눌러 재시작하세요.';
    canvas.classList.add('game-over');
    audioManager.play('gameOver');
}

// 레벨 완료
function levelComplete() {
    gameState.level++;
    gameState.lives++;
    gameState.peppers = 3;
    gameState.gameStatus = 'levelComplete';
    document.getElementById('status-message').textContent = `레벨 ${gameState.level-1} 완료! 다음 레벨로...`;
    canvas.classList.add('level-complete');
    audioManager.play('levelComplete');
    
    setTimeout(() => {
        canvas.classList.remove('level-complete');
        createLevel(gameState.level);
        gameState.gameStatus = 'playing';
        audioManager.play('background');
        updateUI();
    }, 3000);
}

// 게임 재시작
function restartGame() {
    gameState.score = 0;
    gameState.level = 1;
    gameState.lives = 3;
    gameState.peppers = 3;
    canvas.classList.remove('game-over', 'level-complete');
    document.getElementById('status-message').textContent = '';
    particles = [];
    pepperShots = [];
    initGame();
}

// 충돌 감지
function checkCollisions() {
    // 플레이어와 적 충돌
    for (let enemy of enemies) {
        if (!enemy.stunned &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            player.takeDamage();
        }
    }
}

// 레벨 완료 체크
function checkLevelComplete() {
    let allFallen = burgerParts.every(part => !part.falling && part.stepped >= part.maxSteps);
    if (allFallen && burgerParts.length > 0) {
        levelComplete();
    }
}

// 게임 루프
function gameLoop() {
    // 화면 클리어
    ctx.fillStyle = '#000033';
    ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

    if (gameState.gameStatus === 'playing') {
        // 게임 객체 업데이트
        player.update();
        
        enemies.forEach(enemy => enemy.update());
        burgerParts.forEach(part => part.update());
        
        // 후추 업데이트
        pepperShots = pepperShots.filter(pepper => pepper.update());
        
        // 파티클 업데이트
        particles = particles.filter(particle => particle.update());
        
        // 충돌 체크
        checkCollisions();
        checkLevelComplete();
    }

    // 게임 요소 그리기
    // 플랫폼 그리기
    ctx.fillStyle = '#FFFFFF';
    platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });

    // 사다리 그리기
    ctx.fillStyle = '#8B4513';
    ladders.forEach(ladder => {
        ctx.fillRect(ladder.x, ladder.y, ladder.width, ladder.height);
        
        // 사다리 가로대
        ctx.fillStyle = '#A0522D';
        for (let y = ladder.y; y < ladder.y + ladder.height; y += 10) {
            ctx.fillRect(ladder.x, y, ladder.width, 2);
        }
        ctx.fillStyle = '#8B4513';
    });

    // 게임 객체 그리기
    burgerParts.forEach(part => part.draw());
    enemies.forEach(enemy => enemy.draw());
    pepperShots.forEach(pepper => pepper.draw());
    particles.forEach(particle => particle.draw());
    
    if (player) {
        player.draw();
    }

    // 후추 개수 표시
    ctx.fillStyle = '#FFFF00';
    ctx.font = '14px monospace';
    ctx.fillText(`후추: ${gameState.peppers}`, 10, 30);

    requestAnimationFrame(gameLoop);
}

// 이벤트 리스너
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === ' ') {
        e.preventDefault();
        audioManager.resumeContext(); // 오디오 컨텍스트 활성화
        if (gameState.gameStatus === 'menu') {
            initGame();
        } else if (gameState.gameStatus === 'playing') {
            player.shootPepper();
        }
    }
    
    if (e.key === 'p' || e.key === 'P') {
        if (gameState.gameStatus === 'playing') {
            gameState.gameStatus = 'paused';
            document.getElementById('status-message').textContent = '일시정지 - P키를 눌러 계속';
        } else if (gameState.gameStatus === 'paused') {
            gameState.gameStatus = 'playing';
            document.getElementById('status-message').textContent = '';
        }
    }
    
    if (e.key === 'r' || e.key === 'R') {
        restartGame();
    }
    
    if (e.key === 'm' || e.key === 'M') {
        const isMuted = audioManager.toggleMute();
        const muteBtn = document.getElementById('btn-mute');
        if (muteBtn) {
            muteBtn.textContent = isMuted ? '🔇' : '🔊';
            muteBtn.classList.toggle('muted', isMuted);
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// 모바일 컨트롤
document.getElementById('btn-left').addEventListener('touchstart', () => keys['ArrowLeft'] = true);
document.getElementById('btn-left').addEventListener('touchend', () => keys['ArrowLeft'] = false);
document.getElementById('btn-right').addEventListener('touchstart', () => keys['ArrowRight'] = true);
document.getElementById('btn-right').addEventListener('touchend', () => keys['ArrowRight'] = false);
document.getElementById('btn-up').addEventListener('touchstart', () => keys['ArrowUp'] = true);
document.getElementById('btn-up').addEventListener('touchend', () => keys['ArrowUp'] = false);
document.getElementById('btn-down').addEventListener('touchstart', () => keys['ArrowDown'] = true);
document.getElementById('btn-down').addEventListener('touchend', () => keys['ArrowDown'] = false);
document.getElementById('btn-pepper').addEventListener('touchstart', () => {
    audioManager.resumeContext();
    if (gameState.gameStatus === 'playing') player.shootPepper();
});

// 음소거 버튼
document.getElementById('btn-mute').addEventListener('click', () => {
    const isMuted = audioManager.toggleMute();
    const muteBtn = document.getElementById('btn-mute');
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', isMuted);
});

// 게임 시작
gameLoop();
updateUI(); 