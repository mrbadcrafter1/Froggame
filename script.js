document.addEventListener('DOMContentLoaded', function() {
    const config = {
        lilyWidth: 60,
        lilyHeight: 60,
        frogWidth: 40,
        frogHeight: 40,
        baseSpeed: 3,
        spawnY: 330,
        jumpHeight: 120,
        gameWidth: 330,
        gameHeight: 535,
        speedIncrement: 0.05,
        badLilyTransformChance: 0.2,
        goldLilyTransformChance: 0.15,
        goldLilySpeedMultiplier: 1.5,
        goldLilyScore: 5
    };

    // Встроенные рекорды
    const defaultScores = [
        { nickname: "BADcrafter", highscore: 88 },
        { nickname: "Tailone", highscore: 82 }
    ];

    const gameContainer = document.getElementById('game');
    const registerForm = document.getElementById('register-form');
    const nicknameInput = document.getElementById('nickname');
    const registerBtn = document.getElementById('register-btn');
    const currentPlayerSpan = document.getElementById('current-player');
    const leaderboardTable = document.getElementById('leaderboard');
    const scoreDisplay = document.getElementById('score');
    const gameOverDisplay = document.getElementById('game-over');
    const finalScoreDisplay = document.getElementById('final-score');

    let playerNickname = localStorage.getItem('frogGameNickname') || '';
    let score = 0;
    let isGameRunning = false;
    let frog = null;
    let activeLilypad = null;
    let currentSpeed = config.baseSpeed;
    let gameLoopId = null;
    let playersData = JSON.parse(localStorage.getItem('frogGamePlayers')) || [];

    function init() {
        loadDefaultScores();
        updateLeaderboard();
        gameContainer.style.width = `${config.gameWidth}px`;
        
        if (playerNickname) {
            currentPlayerSpan.textContent = playerNickname;
            registerForm.style.display = 'none';
            
            if (!playersData.some(p => p.nickname === playerNickname)) {
                playersData.push({
                    nickname: playerNickname,
                    highscore: 0,
                    created_at: new Date().toISOString()
                });
                savePlayersData();
            }
        } else {
            registerForm.style.display = 'block';
        }

        registerBtn.addEventListener('click', registerPlayer);
        document.addEventListener('keydown', handleKeyPress);
        gameContainer.addEventListener('touchstart', handleJump);
        gameContainer.addEventListener('mousedown', handleJump);
    }

    function loadDefaultScores() {
        defaultScores.forEach(player => {
            const existingIndex = playersData.findIndex(p => p.nickname === player.nickname);
            
            if (existingIndex >= 0) {
                if (player.highscore > playersData[existingIndex].highscore) {
                    playersData[existingIndex].highscore = player.highscore;
                }
            } else {
                playersData.push({
                    nickname: player.nickname,
                    highscore: player.highscore,
                    created_at: new Date().toISOString(),
                    external: true
                });
            }
        });
        savePlayersData();
    }

    function handleJump(e) {
        e.preventDefault();
        if (!isGameRunning) {
            if (playerNickname) startGame();
        } else {
            jump();
        }
    }

    function registerPlayer() {
        const nickname = nicknameInput.value.trim();
        if (nickname) {
            playerNickname = nickname;
            localStorage.setItem('frogGameNickname', nickname);
            currentPlayerSpan.textContent = nickname;
            registerForm.style.display = 'none';
            
            if (!playersData.some(p => p.nickname === nickname)) {
                playersData.push({
                    nickname: nickname,
                    highscore: 0,
                    created_at: new Date().toISOString()
                });
                savePlayersData();
                updateLeaderboard();
            }
            startGame();
        }
    }

    function handleKeyPress(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            handleJump(e);
        }
    }

    function savePlayersData() {
        localStorage.setItem('frogGamePlayers', JSON.stringify(playersData));
    }

    function updateLeaderboard() {
        const sortedPlayers = [...playersData].sort((a, b) => b.highscore - a.highscore);
        const topPlayers = sortedPlayers.slice(0, 10);
        
        while (leaderboardTable.rows.length > 1) {
            leaderboardTable.deleteRow(1);
        }
        
        topPlayers.forEach((player, index) => {
            const row = leaderboardTable.insertRow();
            row.insertCell(0).textContent = index + 1;
            
            const nameCell = row.insertCell(1);
            nameCell.textContent = player.nickname;
            if (player.external) {
                nameCell.style.color = '#ff9800';
                nameCell.style.fontWeight = 'bold';
            }
            
            row.insertCell(2).textContent = player.highscore;
        });
    }

    function createFrog() {
        frog = document.createElement('div');
        frog.className = 'frog';
        frog.style.left = `${(config.gameWidth - config.frogWidth) / 2}px`;
        frog.style.bottom = '50px';
        gameContainer.appendChild(frog);
    }

    function spawnLilypad() {
        if (activeLilypad) return;
        
        const lilypad = document.createElement('div');
        const lilyType = Math.random();
        
        if (lilyType < config.goldLilyTransformChance) {
            lilypad.className = 'goldlily';
        } else {
            lilypad.className = 'lilypad';
        }
        
        const startFromLeft = Math.random() > 0.5;
        const startX = startFromLeft ? -config.lilyWidth : config.gameWidth;
        
        lilypad.style.left = `${startX}px`;
        lilypad.style.top = `${config.spawnY}px`;
        gameContainer.appendChild(lilypad);
        
        const isGold = lilypad.className === 'goldlily';
        activeLilypad = {
            element: lilypad,
            x: startX,
            y: config.spawnY,
            direction: startFromLeft ? 1 : -1,
            speed: isGold ? currentSpeed * config.goldLilySpeedMultiplier : currentSpeed,
            isBad: false,
            isGold: isGold
        };
    }

    function jump() {
        if (!frog || !isGameRunning) return;
        
        frog.style.transform = `translateY(-${config.jumpHeight}px) scale(1.1)`;
        frog.style.transition = 'transform 0.3s ease';
        
        setTimeout(() => {
            frog.style.transform = 'translateY(0) scale(1)';
            checkLanding();
        }, 300);
    }

    function checkLanding() {
        if (!activeLilypad) return;
        
        const frogRect = frog.getBoundingClientRect();
        const lilyRect = activeLilypad.element.getBoundingClientRect();
        
        if (frogRect.right > lilyRect.left + 5 && 
            frogRect.left < lilyRect.right - 5) {
            if (activeLilypad.isBad) {
                endGame();
            } else if (activeLilypad.isGold) {
                score += config.goldLilyScore;
                scoreDisplay.textContent = `Очки: ${score}`;
                currentSpeed += config.speedIncrement;
                gameContainer.removeChild(activeLilypad.element);
                activeLilypad = null;
                spawnLilypad();
            } else {
                score++;
                scoreDisplay.textContent = `Очки: ${score}`;
                currentSpeed += config.speedIncrement;
                activeLilypad.speed = currentSpeed;
            }
        } else {
            endGame();
        }
    }

    function gameLoop() {
        if (!isGameRunning) return;
        
        if (activeLilypad) {
            activeLilypad.x += activeLilypad.direction * activeLilypad.speed;
            activeLilypad.element.style.left = `${activeLilypad.x}px`;
            
            if (activeLilypad.x <= 0 || activeLilypad.x >= config.gameWidth - config.lilyWidth) {
                if (activeLilypad.isBad || activeLilypad.isGold) {
                    gameContainer.removeChild(activeLilypad.element);
                    activeLilypad = null;
                    spawnLilypad();
                } else if (Math.random() < config.badLilyTransformChance) {
                    activeLilypad.element.className = 'blacklily';
                    activeLilypad.isBad = true;
                }
                
                if (activeLilypad) {
                    if (activeLilypad.x <= 0) {
                        activeLilypad.direction = 1;
                        activeLilypad.x = 0;
                    } else {
                        activeLilypad.direction = -1;
                        activeLilypad.x = config.gameWidth - config.lilyWidth;
                    }
                }
            }
        }
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        resetGame();
        createFrog();
        spawnLilypad();
        isGameRunning = true;
        gameLoop();
    }

    function endGame() {
        isGameRunning = false;
        cancelAnimationFrame(gameLoopId);
        finalScoreDisplay.textContent = score;
        gameOverDisplay.style.display = 'block';
        
        if (playerNickname) {
            const playerIndex = playersData.findIndex(p => p.nickname === playerNickname);
            if (playerIndex !== -1 && score > playersData[playerIndex].highscore) {
                playersData[playerIndex].highscore = score;
                savePlayersData();
                updateLeaderboard();
            }
        }
    }

    function resetGame() {
        gameContainer.innerHTML = '';
        activeLilypad = null;
        score = 0;
        scoreDisplay.textContent = 'Очки: 0';
        gameOverDisplay.style.display = 'none';
        currentSpeed = config.baseSpeed;
    }

    init();
});
