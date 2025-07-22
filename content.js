let timerActive = false;
let timerElement = null;
let timerData = null;
let currentTheme = 'bomb'; // デフォルトテーマ

// SVGファイルを読み込む関数
async function loadSvgFile(path) {
    try {
        const response = await fetch(chrome.runtime.getURL(path));
        const svgText = await response.text();
        return svgText;
    } catch (error) {
        console.log('Error loading SVG file:', path, error);
        return null;
    }
}

// アイコンテーマ定義
const iconThemes = {
    bomb: {
        name: '爆弾',
        moving: {type: 'file', path: 'icons/fire.svg'},
        target: {type: 'file', path: 'icons/bom.svg'},
        lineColor: '#8B4513',
        burnedColor: 'linear-gradient(to right, #2c2c2c, #444444)',
        completeIcon: {type: 'emoji', content: '💥'},
        completeMessage: '💥 時間です！'
    },
    dog: {
        name: '犬と家',
        moving: {type: 'file', path: 'icons/dog.svg'},
        target: {type: 'file', path: 'icons/house.svg'},
        lineColor: '#90EE90',
        burnedColor: 'linear-gradient(to right, #228B22, #32CD32)',
        completeIcon: {
            type: 'svg',
            content: `<svg viewBox="0 0 24 24" width="48" height="48" fill="#FF69B4">
                <path d="M12 2 C13.1 2 14 2.9 14 4 C14 5.1 13.1 6 12 6 C10.9 6 10 5.1 10 4 C10 2.9 10.9 2 12 2 Z M21 9 C22.1 9 23 9.9 23 11 C23 12.1 22.1 13 21 13 C19.9 13 19 12.1 19 11 C19 9.9 19.9 9 21 9 Z M3 9 C4.1 9 5 9.9 5 11 C5 12.1 4.1 13 3 13 C1.9 13 1 12.1 1 11 C1 9.9 1.9 9 3 9 Z M12 8 C16.4 8 20 11.6 20 16 C20 20.4 16.4 24 12 24 C7.6 24 4 20.4 4 16 C4 11.6 7.6 8 12 8 Z"/>
            </svg>`
        },
        completeMessage: '🏠 おかえり！'
    },
    ship: {
        name: '船と島',
        moving: {type: 'file', path: 'icons/ship.svg'},
        target: {type: 'file', path: 'icons/island.svg'},
        lineColor: '#4169E1',
        burnedColor: 'linear-gradient(to right, #1E90FF, #87CEEB)',
        completeIcon: {type: 'emoji', content: '⚓'},
        completeMessage: '🏝️ 到着しました！'
    }
};

function createIconElement(iconConfig, size = '20px') {
    const element = document.createElement('div');
    
    if (iconConfig.type === 'emoji') {
        element.textContent = iconConfig.content;
        element.style.fontSize = size;
    } else if (iconConfig.type === 'svg') {
        element.innerHTML = iconConfig.content;
        element.style.width = size;
        element.style.height = size;
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
    } else if (iconConfig.type === 'file') {
        // ファイルパスからSVGを読み込む場合は非同期ロードが必要
        loadSvgFile(iconConfig.path).then(svgContent => {
            if (svgContent) {
                element.innerHTML = svgContent;
                // SVGのwidth/heightをオーバーライド
                const svg = element.querySelector('svg');
                if (svg) {
                    svg.style.width = size;
                    svg.style.height = size;
                }
            }
        });
        element.style.width = size;
        element.style.height = size;
        element.style.display = 'flex';
        element.style.alignItems = 'center';
        element.style.justifyContent = 'center';
    }
    
    return element;
}

async function createTimerElement() {
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
    movingIcon.style.cssText = `
        position: absolute;
        bottom: 32px;
        left: 5px;
        transition: left 0.1s linear;
        filter: drop-shadow(0 0 5px orange);
    `;
    
    const movingIconContent = createIconElement(theme.moving, '20px');
    movingIcon.appendChild(movingIconContent);
    
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
    targetIcon.style.cssText = `
        position: absolute;
        bottom: 28px;
        right: 120px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    `;
    
    const targetIconContent = createIconElement(theme.target, '32px');
    targetIcon.appendChild(targetIconContent);
    
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

async function startTimer(data) {
    if (timerActive) {
        stopTimer();
    }
    
    timerData = data;
    timerActive = true;
    
    if (!timerElement) {
        timerElement = await createTimerElement();
        document.body.appendChild(timerElement);
    }
    
    timerElement.style.display = 'block';
    updateTimerDisplay();
}

function syncTimer(state) {
    console.log('Syncing timer with state:', state);
    
    if (state.isRunning) {
        // 必須フィールドをチェック
        if (!state.totalSeconds || !state.startTime) {
            console.log('Invalid timer state received, ignoring');
            return;
        }
        
        // remainingSecondsがない場合は計算
        if (state.remainingSeconds === null || state.remainingSeconds === undefined) {
            const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
            state.remainingSeconds = Math.max(0, state.totalSeconds - elapsed);
            console.log('Calculated remainingSeconds:', state.remainingSeconds);
        }
        
        timerData = state;
        if (state.theme) {
            currentTheme = state.theme;
        }
        
        if (!timerActive) {
            timerActive = true;
            if (!timerElement) {
                createTimerElement().then(element => {
                    timerElement = element;
                    document.body.appendChild(timerElement);
                    timerElement.style.display = 'block';
                    if (state.remainingSeconds <= 0) {
                        timerComplete();
                    } else {
                        updateTimerDisplay();
                    }
                });
                return;
            }
            timerElement.style.display = 'block';
        }
        
        // 完了状態の場合
        if (state.remainingSeconds <= 0) {
            timerComplete();
        } else {
            updateTimerDisplay();
        }
    } else {
        stopTimer();
    }
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
    
    if (timerElement) {
        timerElement.style.display = 'none';
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
            targetIcon.innerHTML = '';
            const completeIconContent = createIconElement(theme.completeIcon, '48px');
            targetIcon.appendChild(completeIconContent);
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

async function changeTheme(themeName) {
    currentTheme = themeName;
    if (timerActive && timerElement) {
        // 既存のタイマーを再作成
        const oldElement = timerElement;
        timerElement = await createTimerElement();
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
        startTimer(request.timerData).then(() => {
            sendResponse({success: true});
        });
        return true; // 非同期レスポンスを示す
    }
    
    if (request.action === 'stopTimer') {
        console.log('Stopping timer');
        stopTimer();
        sendResponse({success: true});
    }
    
    if (request.action === 'syncTimer') {
        console.log('Syncing timer with state:', request.timerState);
        syncTimer(request.timerState);
        sendResponse({success: true});
    }
    
    if (request.action === 'changeTheme') {
        console.log('Changing theme to:', request.theme);
        changeTheme(request.theme).then(() => {
            sendResponse({success: true});
        });
        return true; // 非同期レスポンスを示す
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
        
        if (result.timerState) {
            // syncTimerを使用してタイマー状態を同期
            syncTimer(result.timerState);
            console.log('Synchronized timer state on page load');
        }
    });
} catch (error) {
    if (error.message.includes('Extension context invalidated')) {
        console.log('Extension context invalidated during initialization');
    }
}

console.log('Fuse content script loaded and ready');