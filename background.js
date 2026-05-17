let isExtensionEnabled = true;

chrome.runtime.onInstalled.addListener(() => {
    console.log('FigmaMod установлен');

    chrome.storage.local.set({
        figmamodSettings: {
            showColorHex: true,
            showDimensions: true,
            showDistances: true,
            snapToElements: false,
            highlightColor: '#0D99FF',
            gridSize: 20,
            showGrid: false,
            showRulers: false,
            isEnabled: true
        },
        isExtensionEnabled: true
    });
});

chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;

        chrome.storage.local.get(['isExtensionEnabled'], (result) => {
            const isEnabled = result.isExtensionEnabled !== false;

            if (!isEnabled && command !== 'toggle-extension') {
                return;
            }

            switch (command) {
                case 'toggle-extension':
                    toggleExtensionState();
                    break;
                case 'toggle-inspect':
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'setMode',
                        mode: 'inspect'
                    }).catch(() => {});
                    break;
                case 'quick-measure':
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'setMode',
                        mode: 'quick'
                    }).catch(() => {});
                    break;
                case 'toggle-screenshot':
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'captureScreenshot'
                    }).catch(() => {});
                    break;
            }
        });
    });
});

function toggleExtensionState() {
    chrome.storage.local.get(['isExtensionEnabled'], (result) => {
        const newState = !(result.isExtensionEnabled !== false);
        chrome.storage.local.set({ isExtensionEnabled: newState }, () => {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'setExtensionState',
                        isEnabled: newState
                    }).catch(() => {});
                });
            });
            console.log(`FigmaMod: ${newState ? 'включен' : 'выключен'}`);
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getExtensionState') {
        chrome.storage.local.get(['isExtensionEnabled'], (result) => {
            sendResponse({ isEnabled: result.isExtensionEnabled !== false });
        });
        return true;
    }

    if (message.action === 'toggleExtension') {
        chrome.storage.local.get(['isExtensionEnabled'], (result) => {
            const newState = !(result.isExtensionEnabled !== false);
            chrome.storage.local.set({ isExtensionEnabled: newState }, () => {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'setExtensionState',
                            isEnabled: newState
                        }).catch(() => {});
                    });
                });
                sendResponse({ isEnabled: newState });
            });
        });
        return true;
    }

    if (message.action === 'clearAll') {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'clearAll'
                }).catch(() => {});
            });
        });
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'captureScreenshot') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            sendResponse({ success: true, dataUrl: dataUrl });
        });
        return true;
    }
});