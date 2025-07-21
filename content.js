let timerActive = false;
let timerElement = null;
let timerInterval = null;
let timerData = null;

function createTimerElement() {
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
        background: #8B4513;
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
        background: linear-gradient(to right, #2c2c2c, #444444);
        border-radius: 2px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: width 0.1s linear;
    `;
    
    // 火のアイコン
    const fireIcon = document.createElement('div');
    fireIcon.id = 'fire-icon';
    fireIcon.textContent = '🔥';
    fireIcon.style.cssText = `
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
    
    // 爆弾アイコン（タイマーの左側）
    const bombIcon = document.createElement('div');
    bombIcon.id = 'bomb-icon';
    bombIcon.textContent = '💣';
    bombIcon.style.cssText = `
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
    container.appendChild(fireIcon);
    container.appendChild(bombIcon);
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
        const fireIcon = timerElement.querySelector('#fire-icon');
        const bombIcon = timerElement.querySelector('#bomb-icon');
        
        if (timerDisplay) {
            timerDisplay.innerHTML = `
                <button style="position: absolute; top: 2px; right: 2px; background: none; border: none; color: white; font-size: 14px; cursor: pointer; padding: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; opacity: 0.7; pointer-events: auto;">×</button>
                ${timeText}
            `;
            
            const closeButton = timerDisplay.querySelector('button');
            closeButton.addEventListener('click', stopTimer);
        }
        
        // 火のアイコンの位置を更新（左から右へ移動）
        if (fireIcon && timerData.totalSeconds > 0) {
            const progress = 1 - (timerData.remainingSeconds / timerData.totalSeconds);
            const containerWidth = window.innerWidth;
            const fireStartPos = 5;
            const fireEndPos = containerWidth - 180; // 爆弾の位置より少し左
            const currentPos = fireStartPos + (progress * (fireEndPos - fireStartPos));
            
            fireIcon.style.left = currentPos + 'px';
            
            // 燃えた部分の導火線を更新
            const burnedLine = timerElement.querySelector('#burned-line');
            if (burnedLine) {
                const burnedWidth = currentPos - 15; // 火の位置まで
                burnedLine.style.width = Math.max(0, burnedWidth) + 'px';
            }
            
            // 残り時間が少なくなったら火のアニメーションを追加
            if (timerData.remainingSeconds <= 10) {
                fireIcon.style.animation = 'fire-flicker 0.2s infinite alternate';
            }
        }
        
        // 爆弾のアニメーション（残り時間が少なくなったら）
        if (bombIcon && timerData.remainingSeconds <= 10) {
            bombIcon.style.animation = 'bomb-shake 0.5s infinite';
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
        const bombIcon = timerElement.querySelector('#bomb-icon');
        const fireIcon = timerElement.querySelector('#fire-icon');
        const timerDisplay = timerElement.querySelector('#timer-display');
        
        // 爆発アニメーション
        if (bombIcon) {
            bombIcon.textContent = '💥';
            bombIcon.style.fontSize = '48px';
            bombIcon.style.animation = 'explosion 1s ease-out';
        }
        
        // 火を非表示
        if (fireIcon) {
            fireIcon.style.display = 'none';
        }
        
        // タイマー表示を更新
        if (timerDisplay) {
            timerDisplay.innerHTML = `
                <button style="position: absolute; top: 2px; right: 2px; background: none; border: none; color: white; font-size: 14px; cursor: pointer; padding: 0; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; opacity: 0.7; pointer-events: auto;">×</button>
                💥 時間です！
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
    @keyframes fire-flicker {
        0% { 
            transform: scale(1) rotate(-2deg);
            filter: drop-shadow(0 0 5px orange);
        }
        100% { 
            transform: scale(1.1) rotate(2deg);
            filter: drop-shadow(0 0 8px red);
        }
    }
    @keyframes bomb-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
    }
    @keyframes explosion {
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

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    if (request.action === 'startTimer') {
        console.log('Starting timer with data:', request.timerData);
        startTimer(request.timerData);
        sendResponse({success: true});
    }
    
    if (request.action === 'stopTimer') {
        console.log('Stopping timer');
        stopTimer();
        sendResponse({success: true});
    }
});

// ページ読み込み時のタイマー復元
try {
    chrome.storage.sync.get(['timerState'], function(result) {
        if (chrome.runtime.lastError) {
            console.log('Chrome runtime error:', chrome.runtime.lastError.message);
            return;
        }
        
        if (result.timerState && result.timerState.isRunning) {
            const elapsed = Math.floor((Date.now() - result.timerState.startTime) / 1000);
            const remaining = Math.max(0, result.timerState.totalSeconds - elapsed);
            
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