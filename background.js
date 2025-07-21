let globalTimerInterval = null;

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    // インストール時にも既存のタイマーをチェック
    checkAndResumeTimer();
});

// タイマー状態をチェックして復元する関数
function checkAndResumeTimer() {
    chrome.storage.sync.get(['timerState'], (result) => {
        if (result.timerState && result.timerState.isRunning) {
            // 必須フィールドがすべて存在するかチェック
            if (!result.timerState.totalSeconds || !result.timerState.startTime) {
                console.log('Invalid timer state found, clearing...');
                chrome.storage.sync.set({timerState: {isRunning: false}});
                return;
            }
            
            // 残り時間を計算
            const elapsed = Math.floor((Date.now() - result.timerState.startTime) / 1000);
            const remaining = Math.max(0, result.timerState.totalSeconds - elapsed);
            
            if (remaining <= 0) {
                console.log('Timer already expired, clearing state');
                chrome.storage.sync.set({timerState: {isRunning: false}});
                return;
            }
            
            // 正しい残り時間で状態を更新
            const correctedState = {
                ...result.timerState,
                remainingSeconds: remaining
            };
            
            console.log('Resuming timer with corrected state:', correctedState);
            startGlobalTimer(correctedState);
        }
    });
}

chrome.action.onClicked.addListener((tab) => {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        chrome.tabs.sendMessage(tab.id, {
            action: 'toggle'
        }).catch(error => {
            console.log('メッセージ送信エラー:', error);
        });
    }
});

// 全タブにタイマー状態を同期する関数
function syncTimerToAllTabs(timerState) {
    console.log('Syncing timer to all tabs:', timerState);
    chrome.tabs.query({}, (tabs) => {
        console.log(`Found ${tabs.length} tabs to sync`);
        let synced = 0;
        tabs.forEach(tab => {
            if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'syncTimer',
                    timerState: timerState
                }).then(() => {
                    synced++;
                    console.log(`Synced to tab ${tab.id} (${synced}/${tabs.length})`);
                }).catch(error => {
                    console.log(`Failed to sync to tab ${tab.id}:`, error.message);
                });
            }
        });
    });
}

// グローバルタイマー管理
function startGlobalTimer(timerData) {
    console.log('Starting global timer with data:', timerData);
    
    if (globalTimerInterval) {
        console.log('Clearing existing timer interval');
        clearInterval(globalTimerInterval);
    }
    
    // 最初の同期を即座に実行
    syncTimerToAllTabs(timerData);
    
    globalTimerInterval = setInterval(() => {
        chrome.storage.sync.get(['timerState'], (result) => {
            if (result.timerState && result.timerState.isRunning) {
                const elapsed = Math.floor((Date.now() - result.timerState.startTime) / 1000);
                const remaining = Math.max(0, result.timerState.totalSeconds - elapsed);
                
                console.log(`Timer update: ${remaining}s remaining`);
                
                if (remaining <= 0) {
                    // タイマー完了
                    console.log('Timer completed');
                    const completedState = {
                        ...result.timerState,
                        isRunning: false,
                        remainingSeconds: 0
                    };
                    chrome.storage.sync.set({timerState: completedState});
                    syncTimerToAllTabs(completedState);
                    clearInterval(globalTimerInterval);
                    globalTimerInterval = null;
                } else {
                    // タイマー更新
                    const updatedState = {
                        ...result.timerState,
                        remainingSeconds: remaining
                    };
                    chrome.storage.sync.set({timerState: updatedState});
                    syncTimerToAllTabs(updatedState);
                }
            } else {
                console.log('Timer state not found or not running, stopping global timer');
                clearInterval(globalTimerInterval);
                globalTimerInterval = null;
            }
        });
    }, 1000);
}

function stopGlobalTimer() {
    if (globalTimerInterval) {
        clearInterval(globalTimerInterval);
        globalTimerInterval = null;
    }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Background script received message:', request.action);
    
    if (request.action === 'startGlobalTimer') {
        console.log('Received startGlobalTimer request');
        startGlobalTimer(request.timerData);
        sendResponse({success: true});
        return true;
    }
    
    if (request.action === 'stopGlobalTimer') {
        console.log('Received stopGlobalTimer request');
        stopGlobalTimer();
        sendResponse({success: true});
        return true;
    }
    
    if (request.action === 'saveData') {
        chrome.storage.sync.set({extensionData: request.data}, () => {
            sendResponse({success: true});
        });
        return true;
    }
    
    if (request.action === 'getData') {
        chrome.storage.sync.get(['extensionData'], (result) => {
            sendResponse({data: result.extensionData});
        });
        return true;
    }
});

// 拡張機能起動時にタイマー状態をチェック
chrome.runtime.onStartup.addListener(() => {
    console.log('Extension startup detected');
    checkAndResumeTimer();
});

// バックグラウンドスクリプト初期化時の処理
console.log('Background script loaded');
checkAndResumeTimer();