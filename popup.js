document.addEventListener('DOMContentLoaded', function() {
    const themeSelect = document.getElementById('themeSelect');
    const timeInput = document.getElementById('timeInput');
    const startButton = document.getElementById('startTimer');
    const stopButton = document.getElementById('stopTimer');
    const status = document.getElementById('status');

    function isActiveTimer(state) {
        return Boolean(state && state.isRunning && state.totalSeconds > 0 && typeof state.startTime === 'number');
    }

    function showState(state) {
        if (!isActiveTimer(state)) {
            startButton.disabled = false;
            stopButton.disabled = true;
            return;
        }
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        const finished = elapsed >= state.totalSeconds;
        // 完了後も各タブに完了メッセージが残っているので、停止ボタンで消せるようにしておく
        startButton.disabled = !finished;
        stopButton.disabled = false;
        status.textContent = finished ? '時間になりました' : 'タイマー実行中...';
    }

    // 保存されたテーマとタイマーの状態を読み込み
    Promise.all([
        chrome.storage.sync.get('selectedTheme'),
        chrome.storage.local.get('timerState')
    ]).then(([sync, local]) => {
        if (sync.selectedTheme) {
            themeSelect.value = sync.selectedTheme;
        }
        showState(local.timerState);
    });

    // テーマ変更はストレージ経由ですべてのタブに反映される
    themeSelect.addEventListener('change', function() {
        chrome.storage.sync.set({selectedTheme: themeSelect.value});
    });

    startButton.addEventListener('click', function() {
        const timeValue = timeInput.value;
        if (!timeValue) {
            status.textContent = '時間を正しく設定してください';
            return;
        }

        const timeParts = timeValue.split(':');
        const hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        const seconds = parseInt(timeParts[2]) || 0; // step="1"がある場合のみ存在
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;

        if (totalSeconds <= 0) {
            status.textContent = '時間を正しく設定してください';
            return;
        }

        const timerState = {
            totalSeconds: totalSeconds,
            isRunning: true,
            startTime: Date.now()
        };

        let timeText = '';
        if (hours > 0) {
            timeText = `${hours}時間${minutes}分`;
            if (seconds > 0) timeText += `${seconds}秒`;
        } else if (minutes > 0) {
            timeText = `${minutes}分`;
            if (seconds > 0) timeText += `${seconds}秒`;
        } else {
            timeText = `${seconds}秒`;
        }

        // 各タブは storage.onChanged でタイマーの開始を受け取る
        chrome.storage.local.set({timerState: timerState}).then(() => {
            startButton.disabled = true;
            stopButton.disabled = false;
            status.textContent = `タイマー開始: ${timeText}`;
        });
    });

    stopButton.addEventListener('click', function() {
        chrome.storage.local.set({timerState: {isRunning: false}}).then(() => {
            startButton.disabled = false;
            stopButton.disabled = true;
            status.textContent = 'タイマーを停止しました';
        });
    });
});
