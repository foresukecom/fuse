chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

chrome.action.onClicked.addListener((tab) => {
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        chrome.tabs.sendMessage(tab.id, {
            action: 'toggle'
        }).catch(error => {
            console.log('メッセージ送信エラー:', error);
        });
    }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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