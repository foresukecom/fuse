document.addEventListener('DOMContentLoaded', function() {
    const themeSelect = document.getElementById('themeSelect');
    const timeInput = document.getElementById('timeInput');
    const startButton = document.getElementById('startTimer');
    const stopButton = document.getElementById('stopTimer');
    const status = document.getElementById('status');

    // 保存されたテーマを読み込み
    chrome.storage.sync.get(['selectedTheme', 'timerState'], function(result) {
        if (result.selectedTheme) {
            themeSelect.value = result.selectedTheme;
        }
        
        if (result.timerState && result.timerState.isRunning) {
            startButton.disabled = true;
            stopButton.disabled = false;
            status.textContent = 'タイマー実行中...';
        } else {
            chrome.storage.sync.set({timerState: {isRunning: false}});
        }
    });

    // テーマ変更時の処理
    themeSelect.addEventListener('change', function() {
        const selectedTheme = themeSelect.value;
        chrome.storage.sync.set({selectedTheme: selectedTheme}, function() {
            // アクティブなタブにテーマ変更を通知
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'changeTheme',
                        theme: selectedTheme
                    }).catch(error => {
                        console.log('テーマ変更メッセージ送信エラー:', error);
                    });
                }
            });
        });
    });

    startButton.addEventListener('click', function() {
        const timeValue = timeInput.value;
        if (!timeValue) {
            status.textContent = '時間を正しく設定してください';
            return;
        }

        console.log('Time input value:', timeValue);
        const timeParts = timeValue.split(':');
        const hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        const seconds = parseInt(timeParts[2]) || 0; // step="1"がある場合のみ存在
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        
        console.log('Parsed time:', {hours, minutes, seconds, totalSeconds});
        
        if (totalSeconds <= 0) {
            status.textContent = '時間を正しく設定してください';
            return;
        }

        const timerData = {
            totalSeconds: totalSeconds,
            remainingSeconds: totalSeconds,
            isRunning: true,
            startTime: Date.now(),
            theme: themeSelect.value
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

        chrome.storage.sync.set({timerState: timerData}, function() {
            startButton.disabled = true;
            stopButton.disabled = false;
            status.textContent = `タイマー開始: ${timeText}`;
            
            console.log('Starting global timer with data:', timerData);
            
            // バックグラウンドスクリプトでグローバルタイマーを開始
            chrome.runtime.sendMessage({
                action: 'startGlobalTimer',
                timerData: timerData
            }).then(response => {
                console.log('Global timer started successfully:', response);
            }).catch(error => {
                console.log('グローバルタイマー開始エラー:', error);
            });
        });
    });

    stopButton.addEventListener('click', function() {
        chrome.storage.sync.set({timerState: {isRunning: false}}, function() {
            startButton.disabled = false;
            stopButton.disabled = true;
            status.textContent = 'タイマーを停止しました';
            
            // バックグラウンドスクリプトでグローバルタイマーを停止
            chrome.runtime.sendMessage({
                action: 'stopGlobalTimer'
            }).then(response => {
                console.log('Global timer stopped successfully:', response);
            }).catch(error => {
                console.log('グローバルタイマー停止エラー:', error);
            });
        });
    });
});