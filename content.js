// 画面下部に導火線タイマーを表示する content script。
// タイマーの状態は chrome.storage.local の timerState に保存されており、
// 各タブは開始時刻から残り時間を自分で計算する。状態の変化は storage.onChanged で受け取る。

// アイコンテーマ定義
const iconThemes = {
    bomb: {
        moving: {type: 'file', path: 'icons/fire.svg'},
        target: {type: 'file', path: 'icons/bom.svg'},
        lineColor: '#8B4513',
        burnedColor: 'linear-gradient(to right, #2c2c2c, #444444)',
        completeIcon: {type: 'emoji', content: '💥'},
        completeMessage: '💥 時間です！'
    },
    dog: {
        moving: {type: 'file', path: 'icons/dog.svg'},
        target: {type: 'file', path: 'icons/house.svg'},
        lineColor: '#90EE90',
        burnedColor: 'linear-gradient(to right, #228B22, #32CD32)',
        completeIcon: {type: 'emoji', content: '🐾'},
        completeMessage: '🏠 おかえり！'
    },
    ship: {
        moving: {type: 'file', path: 'icons/ship.svg'},
        target: {type: 'file', path: 'icons/island.svg'},
        lineColor: '#4169E1',
        burnedColor: 'linear-gradient(to right, #1E90FF, #87CEEB)',
        completeIcon: {type: 'emoji', content: '⚓'},
        completeMessage: '🏝️ 到着しました！'
    }
};
const DEFAULT_THEME = 'bomb';

// ページのCSSと互いに影響しないよう、表示はすべて Shadow DOM の中に置く
const SHADOW_STYLE = `
    .container {
        position: absolute;
        inset: 0;
        font-family: sans-serif;
    }
    .line {
        position: absolute;
        bottom: 40px;
        left: 20px;
        height: 4px;
        border-radius: 2px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .fuse-line { right: 160px; transition: right 0.1s linear; }
    .burned-line { width: 0; transition: width 0.1s linear; }
    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .icon svg { width: 100%; height: 100%; }
    .moving-icon {
        position: absolute;
        bottom: 32px;
        left: 5px;
        transition: left 0.1s linear;
        filter: drop-shadow(0 0 5px orange);
    }
    .moving-icon.hurry { animation: icon-flicker 0.2s infinite alternate; }
    /* 目的地アイコンとタイマー表示は右下に横並びにする。完了メッセージで表示が広がっても重ならない */
    .end {
        position: absolute;
        bottom: 28px;
        right: 20px;
        display: flex;
        align-items: flex-end;
        gap: 8px;
    }
    .target-icon {
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    .target-icon.hurry { animation: target-shake 0.5s infinite; }
    .target-icon.complete { animation: completion 1s ease-out; }
    .display {
        position: relative;
        white-space: nowrap;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        font-weight: bold;
        pointer-events: auto;
    }
    .container.complete .display { background: rgba(255, 100, 0, 0.9); }
    .close {
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
    }
    @keyframes icon-flicker {
        0% { transform: scale(1) rotate(-2deg); filter: drop-shadow(0 0 5px orange); }
        100% { transform: scale(1.1) rotate(2deg); filter: drop-shadow(0 0 8px red); }
    }
    @keyframes target-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-2px); }
        75% { transform: translateX(2px); }
    }
    @keyframes completion {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.8; }
        100% { transform: scale(2); opacity: 0.4; }
    }
`;

let timerState = null;
let themeName = DEFAULT_THEME;
let ui = null;
let tickInterval = null;

const svgCache = new Map();

function loadSvgFile(path) {
    if (!svgCache.has(path)) {
        svgCache.set(path, fetch(chrome.runtime.getURL(path))
            .then(response => response.text())
            .catch(() => null));
    }
    return svgCache.get(path);
}

function createIconElement(iconConfig, size) {
    const element = document.createElement('div');
    element.className = 'icon';
    element.style.width = size;
    element.style.height = size;

    if (iconConfig.type === 'emoji') {
        element.textContent = iconConfig.content;
        element.style.fontSize = size;
    } else if (iconConfig.type === 'file') {
        loadSvgFile(iconConfig.path).then(svgContent => {
            if (svgContent) {
                element.innerHTML = svgContent;
            }
        });
    }

    return element;
}

function createTimerUi(theme) {
    const host = document.createElement('fuse-timer');
    host.style.cssText = `
        all: initial !important;
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 80px !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
    `;
    const shadow = host.attachShadow({mode: 'open'});

    const style = document.createElement('style');
    style.textContent = SHADOW_STYLE;

    const container = document.createElement('div');
    container.className = 'container';

    // 導火線ライン（燃えていない部分）
    const fuseLine = document.createElement('div');
    fuseLine.className = 'line fuse-line';
    fuseLine.style.background = theme.lineColor;

    // 導火線ライン（燃えた部分）
    const burnedLine = document.createElement('div');
    burnedLine.className = 'line burned-line';
    burnedLine.style.background = theme.burnedColor;

    // 移動アイコン
    const movingIcon = document.createElement('div');
    movingIcon.className = 'moving-icon';
    movingIcon.appendChild(createIconElement(theme.moving, '20px'));

    // ターゲットアイコン（タイマーの左側）
    const targetIcon = document.createElement('div');
    targetIcon.className = 'target-icon';
    targetIcon.appendChild(createIconElement(theme.target, '32px'));

    // タイマー表示（右端）
    const display = document.createElement('div');
    display.className = 'display';
    const displayText = document.createElement('span');
    const closeButton = document.createElement('button');
    closeButton.className = 'close';
    closeButton.textContent = '×';
    closeButton.title = 'タイマーを停止';
    // 停止はすべてのタブに反映させるため、ストレージの状態を変える
    closeButton.addEventListener('click', () => {
        chrome.storage.local.set({timerState: {isRunning: false}});
    });
    display.append(closeButton, displayText);

    const end = document.createElement('div');
    end.className = 'end';
    end.append(targetIcon, display);

    container.append(fuseLine, burnedLine, movingIcon, end);
    shadow.append(style, container);
    (document.body || document.documentElement).appendChild(host);

    return {host, container, fuseLine, burnedLine, movingIcon, end, targetIcon, displayText, theme, completed: false};
}

function removeTimerUi() {
    if (ui) {
        ui.host.remove();
        ui = null;
    }
}

function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => n.toString().padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
}

function isActiveTimer(state) {
    return Boolean(state && state.isRunning && state.totalSeconds > 0 && typeof state.startTime === 'number');
}

function getRemainingSeconds(state) {
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    return Math.max(0, state.totalSeconds - elapsed);
}

// 導火線の右端を目的地アイコンの手前に合わせ、その位置（ページ左端からのpx）を返す
function layoutFuseLine() {
    const lineEnd = ui.end.getBoundingClientRect().left - 8;
    ui.fuseLine.style.right = Math.max(0, window.innerWidth - lineEnd) + 'px';
    return lineEnd;
}

function showProgress(remaining) {
    ui.displayText.textContent = formatTime(remaining);

    // 移動アイコンの位置を更新（左から右へ移動）
    const progress = 1 - (remaining / timerState.totalSeconds);
    const startPos = 5;
    const endPos = layoutFuseLine() - 20;
    const currentPos = startPos + (progress * (endPos - startPos));
    ui.movingIcon.style.left = currentPos + 'px';

    // 燃えた部分の導火線を更新
    ui.burnedLine.style.width = Math.max(0, currentPos - 15) + 'px';

    // 残り時間が少なくなったらアニメーションを追加
    const hurry = remaining <= 10;
    ui.movingIcon.classList.toggle('hurry', hurry);
    ui.targetIcon.classList.toggle('hurry', hurry);
}

function showComplete() {
    if (ui.completed) {
        return;
    }
    ui.completed = true;

    // 完了メッセージは時間経過では消さず、停止されるまで表示し続ける
    ui.container.classList.add('complete');
    ui.movingIcon.style.display = 'none';
    ui.targetIcon.classList.remove('hurry');
    ui.targetIcon.replaceChildren(createIconElement(ui.theme.completeIcon, '48px'));
    ui.targetIcon.classList.add('complete');
    ui.displayText.textContent = ui.theme.completeMessage;
    layoutFuseLine();
}

function stopTicking() {
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
}

function render() {
    if (!isActiveTimer(timerState)) {
        stopTicking();
        removeTimerUi();
        return;
    }

    const theme = iconThemes[themeName] || iconThemes[DEFAULT_THEME];
    if (!ui || ui.theme !== theme) {
        removeTimerUi();
        ui = createTimerUi(theme);
    }

    const remaining = getRemainingSeconds(timerState);
    if (remaining <= 0) {
        stopTicking();
        showComplete();
        return;
    }

    showProgress(remaining);
    if (!tickInterval) {
        tickInterval = setInterval(render, 1000);
    }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.timerState) {
        timerState = changes.timerState.newValue || null;
        // 新しいタイマーが始まったら、前回の完了表示から作り直す
        removeTimerUi();
        render();
    }
    if (areaName === 'sync' && changes.selectedTheme) {
        themeName = changes.selectedTheme.newValue || DEFAULT_THEME;
        render();
    }
});

// ページ読み込み時のタイマー復元とテーマ読み込み
Promise.all([
    chrome.storage.local.get('timerState'),
    chrome.storage.sync.get('selectedTheme')
]).then(([local, sync]) => {
    timerState = local.timerState || null;
    themeName = sync.selectedTheme || DEFAULT_THEME;
    render();
});
