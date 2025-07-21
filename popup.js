document.addEventListener('DOMContentLoaded', function() {
    const timeInput = document.getElementById('timeInput');
    const startButton = document.getElementById('startTimer');
    const stopButton = document.getElementById('stopTimer');
    const status = document.getElementById('status');

    chrome.storage.sync.get(['timerState'], function(result) {
        if (result.timerState && result.timerState.isRunning) {
            startButton.disabled = true;
            stopButton.disabled = false;
            status.textContent = 'タイマー実行中...';
        } else {
            chrome.storage.sync.set({timerState: {isRunning: false}});
        }
    });

    startButton.addEventListener('click', function() {
        const timeValue = timeInput.value;
        if (!timeValue) {
            status.textContent = '時間を正しく設定してください';
            return;
        }

        const [hours, minutes, seconds] = timeValue.split(':').map(num => parseInt(num) || 0);
        const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
        
        if (totalSeconds <= 0) {
            status.textContent = '時間を正しく設定してください';
            return;
        }

        const timerData = {
            totalSeconds: totalSeconds,
            remainingSeconds: totalSeconds,
            isRunning: true,
            startTime: Date.now()
        };

        const timeText = hours > 0 ? 
            `${hours}時間${minutes}分${seconds}秒` : 
            minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;

        chrome.storage.sync.set({timerState: timerData}, function() {
            startButton.disabled = true;
            stopButton.disabled = false;
            status.textContent = `タイマー開始: ${timeText}`;
            
            console.log('Sending timer start message with data:', timerData);
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    console.log('Sending message to tab:', tabs[0].id);
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'startTimer',
                        timerData: timerData
                    }).then(response => {
                        console.log('Timer start message sent successfully:', response);
                    }).catch(error => {
                        console.log('タイマー開始メッセージの送信に失敗:', error);
                        status.textContent = 'タイマー開始（ページを更新してください）';
                    });
                } else {
                    console.log('No active tab found');
                }
            });
        });
    });

    stopButton.addEventListener('click', function() {
        chrome.storage.sync.set({timerState: {isRunning: false}}, function() {
            startButton.disabled = false;
            stopButton.disabled = true;
            status.textContent = 'タイマーを停止しました';
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'stopTimer'
                    }).catch(error => {
                        console.log('タイマー停止メッセージの送信に失敗:', error);
                    });
                }
            });
        });
    });
});