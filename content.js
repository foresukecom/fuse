let timerActive = false;
let timerElement = null;
let timerInterval = null;
let timerData = null;
let currentTheme = 'bomb'; // デフォルトテーマ

// アイコンテーマ定義
const iconThemes = {
    bomb: {
        name: '爆弾',
        moving: '🔥',
        target: '💣',
        lineColor: '#8B4513',
        burnedColor: 'linear-gradient(to right, #2c2c2c, #444444)',
        completeIcon: '💥',
        completeMessage: '💥 時間です！'
    },
    dog: {
        name: '犬と家',
        moving: '🐕',
        target: '🏠',
        lineColor: '#90EE90',
        burnedColor: 'linear-gradient(to right, #228B22, #32CD32)',
        completeIcon: '❤️',
        completeMessage: '🏠 おかえり！'
    },
    ship: {
        name: '船と島',
        moving: '⛵',
        target: '🏝️',
        lineColor: '#4169E1',
        burnedColor: 'linear-gradient(to right, #1E90FF, #87CEEB)',
        completeIcon: '⚓',
        completeMessage: '🏝️ 到着しました！'
    }
};

function createTimerElement() {
    const theme = iconThemes[currentTheme];
    const container = document.createElement('div');
    container.id = 'fuse-timer-container';
    container.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 80px;
        z-index: 10000;
        pointer-events: none;
    `;
    
    // 導火線ライン（燃えていない部分）
    const fuseLine = document.createElement('div');
    fuseLine.id = 'fuse-line';
    fuseLine.style.cssText = `
        position: absolute;
        bottom: 40px;
        left: 20px;
        right: 160px;
        height: 4px;
        background: ${theme.lineColor};
        border-radius: 2px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;
    
    // 導火線ライン（燃えた部分）
    const burnedLine = document.createElement('div');
    burnedLine.id = 'burned-line';
    burnedLine.style.cssText = `
        position: absolute;
        bottom: 40px;
        left: 20px;
        width: 0px;
        height: 4px;
        background: ${theme.burnedColor};
        border-radius: 2px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: width 0.1s linear;
    `;
    
    // 移動アイコン
    const movingIcon = document.createElement('div');
    movingIcon.id = 'moving-icon';
    movingIcon.textContent = theme.moving;
    movingIcon.style.cssText = `
        position: absolute;
        bottom: 32px;
        left: 5px;
        font-size: 20px;
        transition: left 0.1s linear;
        filter: drop-shadow(0 0 5px orange);
    `;
    
    // タイマー表示（右端）
    const timerDisplay = document.createElement('div');
    timerDisplay.id = 'timer-display';
    timerDisplay.style.cssText = `
        position: absolute;
        bottom: 28px;
        right: 20px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        font-weight: bold;
        pointer-events: auto;
    `;
    
    // ターゲットアイコン（タイマーの左側）
    const targetIcon = document.createElement('div');
    targetIcon.id = 'target-icon';
    targetIcon.textContent = theme.target;
    targetIcon.style.cssText = `
        position: absolute;
        bottom: 28px;
        right: 120px;
        font-size: 32px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    `;
    
    // 閉じるボタン
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 2px;
        right: 2px;
        background: none;
        border: none;
        color: white;
        font-size: 14px;
        cursor: pointer;
        padding: 0;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        pointer-events: auto;
    `;
    
    closeButton.addEventListener('click', stopTimer);
    timerDisplay.appendChild(closeButton);
    
    container.appendChild(fuseLine);
    container.appendChild(burnedLine);
    container.appendChild(movingIcon);
    container.appendChild(targetIcon);
    container.appendChild(timerDisplay);
    
    return container;
}

function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function startTimer(data) {
    if (timerActive) {
        stopTimer();
    }
    
    timerData = data;
    timerActive = true;
    
    if (!timerElement) {
        timerElement = createTimerElement();
        document.body.appendChild(timerElement);
    }
    
    timerElement.style.display = 'block';
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerData.startTime) / 1000);
        const remaining = Math.max(0, timerData.totalSeconds - elapsed);
        
        if (remaining <= 0) {
            timerComplete();
            return;
        }
        
        timerData.remainingSeconds = remaining;
        updateTimerDisplay();
        
        // タイマー状態をストレージに定期保存（ページ遷移対応）
        try {
            chrome.storage.sync.set({timerState: {
                totalSeconds: timerData.totalSeconds,
                remainingSeconds: remaining,
                isRunning: true,
                startTime: timerData.startTime
            }});
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.log('Extension context invalidated, stopping timer');
                stopTimer();
                return;
            }
        }
        
        if (remaining <= 10) {
            timerElement.style.background = 'linear-gradient(45deg, #ff4757, #ff3838)';
            timerElement.style.animation = 'pulse 1s infinite';
        }
    }, 1000);
}

function updateTimerDisplay() {
    if (timerElement && timerData) {
        const timeText = formatTime(timerData.remainingSeconds);
        const timerDisplay = timerElement.querySelector('#timer-display');
        const movingIcon = timerElement.querySelector('#moving-icon');
        const targetIcon = timerElement.querySelector('#target-icon');
        
        if (timerDisplay) {
            timerDisplay.innerHTML = `
                <button style="position: absolute; top: 2px; right: 2px; background: none; border: none; color: white; font-size: 14px; cursor: pointer; padding: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; opacity: 0.7; pointer-events: auto;">×</button>
                ${timeText}
            `;
            
            const closeButton = timerDisplay.querySelector('button');
            closeButton.addEventListener('click', stopTimer);
        }
        
        // 移動アイコンの位置を更新（左から右へ移動）
        if (movingIcon && timerData.totalSeconds > 0) {
            const progress = 1 - (timerData.remainingSeconds / timerData.totalSeconds);
            const containerWidth = window.innerWidth;
            const startPos = 5;
            const endPos = containerWidth - 180;
            const currentPos = startPos + (progress * (endPos - startPos));
            
            movingIcon.style.left = currentPos + 'px';
            
            // 燃えた部分の導火線を更新
            const burnedLine = timerElement.querySelector('#burned-line');
            if (burnedLine) {
                const burnedWidth = currentPos - 15;
                burnedLine.style.width = Math.max(0, burnedWidth) + 'px';
            }
            
            // 残り時間が少なくなったらアニメーションを追加
            if (timerData.remainingSeconds <= 10) {
                movingIcon.style.animation = 'icon-flicker 0.2s infinite alternate';
            }
        }
        
        // ターゲットアイコンのアニメーション（残り時間が少なくなったら）
        if (targetIcon && timerData.remainingSeconds <= 10) {
            targetIcon.style.animation = 'target-shake 0.5s infinite';
        }
    }
}

function stopTimer() {
    timerActive = false;
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    if (timerElement) {
        timerElement.style.display = 'none';
    }
    
    try {
        chrome.storage.sync.set({timerState: {isRunning: false}});
    } catch (error) {
        if (error.message.includes('Extension context invalidated')) {
            console.log('Extension context invalidated during timer stop');
        }
    }
}

function timerComplete() {
    if (timerElement) {
        const theme = iconThemes[currentTheme];
        const targetIcon = timerElement.querySelector('#target-icon');
        const movingIcon = timerElement.querySelector('#moving-icon');
        const timerDisplay = timerElement.querySelector('#timer-display');
        
        // 完了アニメーション
        if (targetIcon) {
            targetIcon.textContent = theme.completeIcon;
            targetIcon.style.fontSize = '48px';
            targetIcon.style.animation = 'completion 1s ease-out';
        }
        
        // 移動アイコンを非表示
        if (movingIcon) {
            movingIcon.style.display = 'none';
        }
        
        // タイマー表示を更新
        if (timerDisplay) {
            timerDisplay.innerHTML = `
                <button style="position: absolute; top: 2px; right: 2px; background: none; border: none; color: white; font-size: 14px; cursor: pointer; padding: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; opacity: 0.7; pointer-events: auto;">×</button>
                ${theme.completeMessage}
            `;
            timerDisplay.style.background = 'rgba(255, 100, 0, 0.9)';
            
            const closeButton = timerDisplay.querySelector('button');
            closeButton.addEventListener('click', stopTimer);
        }
        
        setTimeout(() => {
            stopTimer();
        }, 5000);
    }
    
    stopTimer();
}

const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }
    @keyframes icon-flicker {
        0% { 
            transform: scale(1) rotate(-2deg);
            filter: drop-shadow(0 0 5px orange);
        }
        100% { 
            transform: scale(1.1) rotate(2deg);
            filter: drop-shadow(0 0 8px red);
        }
    }
    @keyframes target-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
    }
    @keyframes completion {
        0% { 
            transform: scale(1);
            opacity: 1;
        }
        50% { 
            transform: scale(1.5);
            opacity: 0.8;
        }
        100% { 
            transform: scale(2);
            opacity: 0.4;
        }
    }
`;
document.head.appendChild(style);

function changeTheme(themeName) {
    currentTheme = themeName;
    if (timerActive && timerElement) {
        // 既存のタイマーを再作成
        const oldElement = timerElement;
        timerElement = createTimerElement();
        oldElement.parentNode.replaceChild(timerElement, oldElement);
        updateTimerDisplay();
    }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'startTimer') {
        console.log('Starting timer with data:', request.timerData);
        if (request.timerData.theme) {
            currentTheme = request.timerData.theme;
        }
        startTimer(request.timerData);
        sendResponse({success: true});
    }
    
    if (request.action === 'stopTimer') {
        console.log('Stopping timer');
        stopTimer();
        sendResponse({success: true});
    }
    
    if (request.action === 'changeTheme') {
        console.log('Changing theme to:', request.theme);
        changeTheme(request.theme);
        sendResponse({success: true});
    }
});

// ページ読み込み時のタイマー復元とテーマ読み込み
try {
    chrome.storage.sync.get(['timerState', 'selectedTheme'], function(result) {
        if (chrome.runtime.lastError) {
            console.log('Chrome runtime error:', chrome.runtime.lastError.message);
            return;
        }
        
        // テーマ設定を読み込み
        if (result.selectedTheme) {
            currentTheme = result.selectedTheme;
        }
        
        if (result.timerState && result.timerState.isRunning) {
            const elapsed = Math.floor((Date.now() - result.timerState.startTime) / 1000);
            const remaining = Math.max(0, result.timerState.totalSeconds - elapsed);
            
            // タイマーにテーマ情報があれば使用
            if (result.timerState.theme) {
                currentTheme = result.timerState.theme;
            }
            
            if (remaining > 0) {
                result.timerState.remainingSeconds = remaining;
                startTimer(result.timerState);
                console.log('Resumed existing timer with', remaining, 'seconds remaining');
            } else {
                try {
                    chrome.storage.sync.set({timerState: {isRunning: false}});
                    console.log('Existing timer had expired, cleared state');
                } catch (error) {
                    console.log('Error clearing expired timer state:', error.message);
                }
            }
        }
    });
} catch (error) {
    if (error.message.includes('Extension context invalidated')) {
        console.log('Extension context invalidated during initialization');
    }
}

console.log('Fuse content script loaded and ready');