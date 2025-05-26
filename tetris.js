// 게임 설정
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 30;

// 게임 상태
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let dropTime = 0;
let dropCounter = 0;
let gameRunning = false;
let gamePaused = false;
let soundEnabled = true;
let audioInitialized = false;
let highScore = 0;
let highScoreName = '';

// Canvas 요소들
let canvas, ctx, nextCanvas, nextCtx;

// 음향 시스템
let audioContext;
let bgmOscillators = [];
let bgmGainNode;
let bgmPlaying = false;
let bgmCurrentNote = 0;
let bgmTimeout;

// 테트리스 BGM 멜로디 (간단한 버전)
const BGM_MELODY = [
    { note: 659.25, duration: 400 }, // E5
    { note: 493.88, duration: 200 }, // B4
    { note: 523.25, duration: 200 }, // C5
    { note: 587.33, duration: 400 }, // D5
    { note: 523.25, duration: 200 }, // C5
    { note: 493.88, duration: 200 }, // B4
    { note: 440.00, duration: 400 }, // A4
    { note: 440.00, duration: 200 }, // A4
    { note: 523.25, duration: 200 }, // C5
    { note: 659.25, duration: 400 }, // E5
    { note: 587.33, duration: 200 }, // D5
    { note: 523.25, duration: 200 }, // C5
    { note: 493.88, duration: 600 }, // B4
    { note: 523.25, duration: 200 }, // C5
    { note: 587.33, duration: 400 }, // D5
    { note: 659.25, duration: 400 }, // E5
    { note: 523.25, duration: 400 }, // C5
    { note: 440.00, duration: 400 }, // A4
    { note: 440.00, duration: 400 }, // A4
    { note: 0, duration: 400 }, // 휴식
];

// 테트로미노 정의 (7가지 블록)
const PIECES = {
    'I': [
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0]
    ],
    'O': [
        [1,1],
        [1,1]
    ],
    'T': [
        [0,1,0],
        [1,1,1],
        [0,0,0]
    ],
    'S': [
        [0,1,1],
        [1,1,0],
        [0,0,0]
    ],
    'Z': [
        [1,1,0],
        [0,1,1],
        [0,0,0]
    ],
    'J': [
        [1,0,0],
        [1,1,1],
        [0,0,0]
    ],
    'L': [
        [0,0,1],
        [1,1,1],
        [0,0,0]
    ]
};

// 색상 정의
const COLORS = {
    'I': '#00f0f0',
    'O': '#f0f000',
    'T': '#a000f0',
    'S': '#00f000',
    'Z': '#f00000',
    'J': '#0000f0',
    'L': '#f0a000',
    'empty': '#000000',
    'ghost': '#444444'
};

// 음향 효과 시스템
function initAudio() {
    if (audioInitialized) return;
    
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioInitialized = true;
        console.log('오디오 시스템이 초기화되었습니다.');
        
        // 음향 버튼 업데이트
        updateSoundButton();
    } catch (e) {
        console.log('Web Audio API가 지원되지 않습니다:', e);
        soundEnabled = false;
        audioInitialized = false;
        updateSoundButton();
    }
}

function updateSoundButton() {
    const btn = document.getElementById('mute-btn');
    if (!audioInitialized) {
        btn.textContent = '🔇 음향 비활성';
        btn.disabled = true;
    } else {
        btn.textContent = soundEnabled ? '🔊 음향' : '🔇 음소거';
        btn.disabled = false;
    }
}

function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('오디오 컨텍스트가 재개되었습니다.');
        });
    }
}

function playSound(frequency, duration, type = 'sine') {
    if (!soundEnabled || !audioContext || !audioInitialized) return;
    
    try {
        // 오디오 컨텍스트가 suspended 상태면 재개
        if (audioContext.state === 'suspended') {
            resumeAudioContext();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        // 볼륨 설정 (더 부드럽게)
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
        console.log('사운드 재생 오류:', e);
    }
}

// 다양한 음향 효과
function playMoveSound() {
    playSound(200, 0.1);
}

function playRotateSound() {
    playSound(300, 0.15);
}

function playDropSound() {
    playSound(150, 0.2);
}

function playLineClearSound() {
    // 라인 클리어 멜로디
    setTimeout(() => playSound(500, 0.1), 0);
    setTimeout(() => playSound(600, 0.1), 100);
    setTimeout(() => playSound(700, 0.1), 200);
    setTimeout(() => playSound(800, 0.2), 300);
}

function playTetrisSound() {
    // 테트리스 (4줄) 특별 사운드
    setTimeout(() => playSound(400, 0.1), 0);
    setTimeout(() => playSound(500, 0.1), 100);
    setTimeout(() => playSound(600, 0.1), 200);
    setTimeout(() => playSound(700, 0.1), 300);
    setTimeout(() => playSound(800, 0.3), 400);
}

function playGameOverSound() {
    // 게임 오버 사운드
    setTimeout(() => playSound(200, 0.3), 0);
    setTimeout(() => playSound(150, 0.3), 300);
    setTimeout(() => playSound(100, 0.5), 600);
}

function playLevelUpSound() {
    // 레벨업 사운드
    setTimeout(() => playSound(400, 0.1), 0);
    setTimeout(() => playSound(500, 0.1), 100);
    setTimeout(() => playSound(600, 0.1), 200);
    setTimeout(() => playSound(800, 0.3), 300);
}

function playStartSound() {
    // 게임 시작 사운드
    setTimeout(() => playSound(300, 0.15), 0);
    setTimeout(() => playSound(400, 0.15), 150);
    setTimeout(() => playSound(500, 0.2), 300);
}

// 최고점수 관련 함수
function loadHighScore() {
    const saved = localStorage.getItem('tetris_highscore');
    const savedName = localStorage.getItem('tetris_highscore_name');
    
    if (saved) {
        highScore = parseInt(saved);
        highScoreName = savedName || 'Anonymous';
    }
    updateHighScoreDisplay();
}

function saveHighScoreToStorage(name) {
    localStorage.setItem('tetris_highscore', highScore.toString());
    localStorage.setItem('tetris_highscore_name', name);
    updateHighScoreDisplay();
}

function updateHighScoreDisplay() {
    document.getElementById('highscore').textContent = highScore;
    document.getElementById('highscore-name').textContent = highScoreName;
}

function checkNewHighScore() {
    if (score > highScore) {
        highScore = score;
        document.getElementById('new-highscore').textContent = score;
        document.getElementById('highscore-modal').classList.remove('hidden');
        document.getElementById('player-name').focus();
        
        // 최고점수 달성 사운드
        setTimeout(() => {
            playSound(600, 0.2);
            setTimeout(() => playSound(800, 0.2), 200);
            setTimeout(() => playSound(1000, 0.3), 400);
        }, 500);
    }
}

function saveHighScore() {
    const name = document.getElementById('player-name').value.trim() || 'Anonymous';
    highScoreName = name;
    saveHighScoreToStorage(name);
    document.getElementById('highscore-modal').classList.add('hidden');
    playSound(400, 0.3);
}

function skipHighScore() {
    highScoreName = 'Anonymous';
    saveHighScoreToStorage(highScoreName);
    document.getElementById('highscore-modal').classList.add('hidden');
}

// 음향 토글
function toggleSound() {
    if (!audioInitialized) {
        initAudio();
        return;
    }
    
    soundEnabled = !soundEnabled;
    updateSoundButton();
    
    // 음향이 꺼지면 BGM도 정지
    if (!soundEnabled) {
        stopBGM();
    } else {
        // 음향이 켜지고 게임이 실행 중이면 BGM 재시작
        if (gameRunning && !gamePaused) {
            startBGM();
        }
        // 토글 시 간단한 피드백 사운드
        setTimeout(() => playSound(400, 0.1), 50);
    }
}

// 게임 초기화
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    nextCanvas = document.getElementById('next-canvas');
    nextCtx = nextCanvas.getContext('2d');
    
    // 최고점수 불러오기
    loadHighScore();
    
    // 이벤트 리스너 등록
    document.addEventListener('keydown', handleKeyPress);
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    document.getElementById('reset-btn').addEventListener('click', resetGame);
    document.getElementById('mute-btn').addEventListener('click', toggleSound);
    
    // 사용자 상호작용 감지를 위한 이벤트
    document.addEventListener('click', function() {
        if (!audioInitialized) {
            initAudio();
        }
    });
    
    // Enter 키로 최고점수 저장
    document.getElementById('player-name').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveHighScore();
        }
    });
    
    // 보드 초기화
    initBoard();
    
    // 초기 음향 버튼 상태 설정
    updateSoundButton();
    
    // 게임 루프 시작
    requestAnimationFrame(gameLoop);
}

// 보드 초기화
function initBoard() {
    board = [];
    for (let row = 0; row < BOARD_HEIGHT; row++) {
        board[row] = new Array(BOARD_WIDTH).fill(0);
    }
}

// 새로운 조각 생성
function createPiece(type) {
    const pieces = Object.keys(PIECES);
    const randomType = type || pieces[Math.floor(Math.random() * pieces.length)];
    
    return {
        type: randomType,
        shape: PIECES[randomType],
        x: Math.floor(BOARD_WIDTH / 2) - Math.floor(PIECES[randomType][0].length / 2),
        y: 0
    };
}

// 조각 회전
function rotatePiece(piece) {
    const rotated = [];
    const N = piece.shape.length;
    
    for (let i = 0; i < N; i++) {
        rotated[i] = [];
        for (let j = 0; j < N; j++) {
            rotated[i][j] = piece.shape[N - 1 - j][i];
        }
    }
    
    return {
        ...piece,
        shape: rotated
    };
}

// 충돌 검사
function isValidPosition(piece, deltaX = 0, deltaY = 0) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                const newX = piece.x + col + deltaX;
                const newY = piece.y + row + deltaY;
                
                // 경계 검사
                if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
                    return false;
                }
                
                // 기존 블록과의 충돌 검사
                if (newY >= 0 && board[newY][newX]) {
                    return false;
                }
            }
        }
    }
    return true;
}

// 조각을 보드에 고정
function placePiece(piece) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                const boardY = piece.y + row;
                const boardX = piece.x + col;
                if (boardY >= 0) {
                    board[boardY][boardX] = piece.type;
                }
            }
        }
    }
}

// 완성된 라인 찾기 및 제거
function clearLines() {
    let linesCleared = 0;
    
    for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
        if (board[row].every(cell => cell !== 0)) {
            // 라인 제거
            board.splice(row, 1);
            board.unshift(new Array(BOARD_WIDTH).fill(0));
            linesCleared++;
            row++; // 같은 줄을 다시 확인
        }
    }
    
    if (linesCleared > 0) {
        // 점수 계산
        const lineScore = [0, 40, 100, 300, 1200];
        score += lineScore[linesCleared] * level;
        lines += linesCleared;
        
        // 음향 효과
        if (linesCleared === 4) {
            playTetrisSound(); // 테트리스!
        } else {
            playLineClearSound();
        }
        
        // 레벨 업 체크
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            playLevelUpSound();
        }
        
        updateDisplay();
    }
}

// 고스트 조각 위치 계산
function getGhostPosition(piece) {
    let ghostY = piece.y;
    while (isValidPosition(piece, 0, ghostY - piece.y + 1)) {
        ghostY++;
    }
    return ghostY;
}

// 배경음악 관련 함수
function initBGM() {
    if (!audioContext || !audioInitialized) return;
    
    try {
        // BGM용 게인 노드 생성
        bgmGainNode = audioContext.createGain();
        bgmGainNode.connect(audioContext.destination);
        bgmGainNode.gain.setValueAtTime(0.02, audioContext.currentTime); // 낮은 볼륨
    } catch (e) {
        console.log('BGM 초기화 오류:', e);
    }
}

function playBGMNote(frequency, duration) {
    if (!soundEnabled || !audioContext || !audioInitialized || !bgmGainNode) return;
    
    try {
        if (frequency === 0) {
            // 휴식
            return;
        }
        
        const oscillator = audioContext.createOscillator();
        const noteGain = audioContext.createGain();
        
        oscillator.connect(noteGain);
        noteGain.connect(bgmGainNode);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'square'; // 8비트 게임 느낌
        
        // 부드러운 어택과 릴리즈
        noteGain.gain.setValueAtTime(0, audioContext.currentTime);
        noteGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);
        noteGain.gain.linearRampToValueAtTime(0.7, audioContext.currentTime + duration/1000 * 0.8);
        noteGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration/1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration/1000);
        
        // 정리를 위해 oscillators 배열에 추가
        bgmOscillators.push(oscillator);
        
        // 정리
        oscillator.onended = () => {
            const index = bgmOscillators.indexOf(oscillator);
            if (index > -1) {
                bgmOscillators.splice(index, 1);
            }
        };
        
    } catch (e) {
        console.log('BGM 노트 재생 오류:', e);
    }
}

function playNextBGMNote() {
    if (!bgmPlaying || !gameRunning || gamePaused) return;
    
    const currentNoteData = BGM_MELODY[bgmCurrentNote];
    playBGMNote(currentNoteData.note, currentNoteData.duration);
    
    bgmTimeout = setTimeout(() => {
        bgmCurrentNote = (bgmCurrentNote + 1) % BGM_MELODY.length;
        playNextBGMNote();
    }, currentNoteData.duration);
}

function startBGM() {
    if (!soundEnabled || !audioContext || !audioInitialized) return;
    
    if (bgmPlaying) {
        stopBGM();
    }
    
    initBGM();
    bgmPlaying = true;
    bgmCurrentNote = 0;
    playNextBGMNote();
    console.log('배경음악이 시작되었습니다.');
}

function stopBGM() {
    bgmPlaying = false;
    
    // 타이머 정리
    if (bgmTimeout) {
        clearTimeout(bgmTimeout);
        bgmTimeout = null;
    }
    
    // 현재 재생 중인 오실레이터들 정리
    bgmOscillators.forEach(oscillator => {
        try {
            oscillator.stop();
        } catch (e) {
            // 이미 정지된 오실레이터 무시
        }
    });
    bgmOscillators = [];
    
    console.log('배경음악이 정지되었습니다.');
}

function pauseBGM() {
    if (bgmTimeout) {
        clearTimeout(bgmTimeout);
        bgmTimeout = null;
    }
}

function resumeBGM() {
    if (bgmPlaying && gameRunning && !gamePaused) {
        playNextBGMNote();
    }
}

// 게임 시작
function startGame() {
    // 사용자 상호작용이 있었으므로 오디오 초기화
    if (!audioInitialized) {
        initAudio();
    }
    
    gameRunning = true;
    gamePaused = false;
    score = 0;
    level = 1;
    lines = 0;
    dropTime = 1000;
    
    initBoard();
    currentPiece = createPiece();
    nextPiece = createPiece();
    
    updateDisplay();
    document.getElementById('game-over').classList.add('hidden');
    
    // 게임 시작 사운드
    setTimeout(() => {
        playStartSound();
        // 배경음악 시작 (시작 사운드 후)
        setTimeout(() => {
            startBGM();
        }, 500);
    }, 100);
}

// 게임 일시정지/재개
function togglePause() {
    if (gameRunning) {
        gamePaused = !gamePaused;
        document.getElementById('pause-btn').textContent = gamePaused ? '재개' : '일시정지';
        
        if (gamePaused) {
            pauseBGM();
        } else {
            resumeBGM();
        }
    }
}

// 게임 리셋
function resetGame() {
    gameRunning = false;
    gamePaused = false;
    document.getElementById('pause-btn').textContent = '일시정지';
    document.getElementById('game-over').classList.add('hidden');
    
    // BGM 정지
    stopBGM();
    
    initBoard();
    currentPiece = null;
    nextPiece = null;
    
    draw();
}

// 게임 오버
function gameOver() {
    gameRunning = false;
    gamePaused = false;
    
    // BGM 정지
    stopBGM();
    
    playGameOverSound();
    
    // 최고점수 체크
    setTimeout(() => {
        checkNewHighScore();
        document.getElementById('final-score').textContent = score;
        if (score <= highScore) {
            document.getElementById('game-over').classList.remove('hidden');
        }
    }, 1000);
}

// 키보드 입력 처리
function handleKeyPress(event) {
    if (!gameRunning || gamePaused || !currentPiece) {
        // 게임이 실행 중이 아닐 때도 음향 토글 허용
        if (event.code === 'KeyM') {
            toggleSound();
        }
        return;
    }
    
    switch(event.code) {
        case 'ArrowLeft':
            if (isValidPosition(currentPiece, -1, 0)) {
                currentPiece.x--;
                playMoveSound();
            }
            break;
        case 'ArrowRight':
            if (isValidPosition(currentPiece, 1, 0)) {
                currentPiece.x++;
                playMoveSound();
            }
            break;
        case 'ArrowDown':
            if (isValidPosition(currentPiece, 0, 1)) {
                currentPiece.y++;
                score += 1;
                updateDisplay();
                playMoveSound();
            }
            break;
        case 'ArrowUp':
            const rotated = rotatePiece(currentPiece);
            if (isValidPosition(rotated)) {
                currentPiece = rotated;
                playRotateSound();
            }
            break;
        case 'Space':
            event.preventDefault();
            // 하드 드롭
            let dropDistance = 0;
            while (isValidPosition(currentPiece, 0, 1)) {
                currentPiece.y++;
                score += 2;
                dropDistance++;
            }
            if (dropDistance > 0) {
                playDropSound();
            }
            updateDisplay();
            break;
        case 'KeyP':
            togglePause();
            break;
        case 'KeyM':
            toggleSound();
            break;
    }
}

// 디스플레이 업데이트
function updateDisplay() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
    
    // 낙하 속도 조정
    dropTime = Math.max(50, 1000 - (level - 1) * 100);
}

// 다음 블록 그리기
function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (!nextPiece) return;
    
    const blockSize = 25;
    const offsetX = (nextCanvas.width - nextPiece.shape[0].length * blockSize) / 2;
    const offsetY = (nextCanvas.height - nextPiece.shape.length * blockSize) / 2;
    
    for (let row = 0; row < nextPiece.shape.length; row++) {
        for (let col = 0; col < nextPiece.shape[row].length; col++) {
            if (nextPiece.shape[row][col]) {
                nextCtx.fillStyle = COLORS[nextPiece.type];
                nextCtx.fillRect(
                    offsetX + col * blockSize,
                    offsetY + row * blockSize,
                    blockSize - 1,
                    blockSize - 1
                );
            }
        }
    }
}

// 게임 화면 그리기
function draw() {
    // 화면 지우기
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 보드 그리기
    for (let row = 0; row < BOARD_HEIGHT; row++) {
        for (let col = 0; col < BOARD_WIDTH; col++) {
            if (board[row][col]) {
                ctx.fillStyle = COLORS[board[row][col]];
                ctx.fillRect(
                    col * BLOCK_SIZE,
                    row * BLOCK_SIZE,
                    BLOCK_SIZE - 1,
                    BLOCK_SIZE - 1
                );
            }
        }
    }
    
    // 현재 조각 그리기
    if (currentPiece) {
        // 고스트 조각 그리기
        const ghostY = getGhostPosition(currentPiece);
        ctx.fillStyle = COLORS.ghost;
        for (let row = 0; row < currentPiece.shape.length; row++) {
            for (let col = 0; col < currentPiece.shape[row].length; col++) {
                if (currentPiece.shape[row][col]) {
                    ctx.fillRect(
                        (currentPiece.x + col) * BLOCK_SIZE,
                        (ghostY + row) * BLOCK_SIZE,
                        BLOCK_SIZE - 1,
                        BLOCK_SIZE - 1
                    );
                }
            }
        }
        
        // 현재 조각 그리기
        ctx.fillStyle = COLORS[currentPiece.type];
        for (let row = 0; row < currentPiece.shape.length; row++) {
            for (let col = 0; col < currentPiece.shape[row].length; col++) {
                if (currentPiece.shape[row][col]) {
                    ctx.fillRect(
                        (currentPiece.x + col) * BLOCK_SIZE,
                        (currentPiece.y + row) * BLOCK_SIZE,
                        BLOCK_SIZE - 1,
                        BLOCK_SIZE - 1
                    );
                }
            }
        }
    }
    
    // 격자 그리기
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    
    // 세로선
    for (let col = 0; col <= BOARD_WIDTH; col++) {
        ctx.beginPath();
        ctx.moveTo(col * BLOCK_SIZE, 0);
        ctx.lineTo(col * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    
    // 가로선
    for (let row = 0; row <= BOARD_HEIGHT; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * BLOCK_SIZE);
        ctx.lineTo(canvas.width, row * BLOCK_SIZE);
        ctx.stroke();
    }
    
    drawNextPiece();
}

// 게임 루프
function gameLoop(time) {
    if (gameRunning && !gamePaused && currentPiece) {
        if (time - dropCounter > dropTime) {
            if (isValidPosition(currentPiece, 0, 1)) {
                currentPiece.y++;
            } else {
                // 조각 고정
                placePiece(currentPiece);
                clearLines();
                
                // 새 조각 생성
                currentPiece = nextPiece;
                nextPiece = createPiece();
                
                // 게임 오버 체크
                if (!isValidPosition(currentPiece)) {
                    gameOver();
                }
            }
            dropCounter = time;
        }
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init); 