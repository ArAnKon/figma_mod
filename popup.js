document.addEventListener('DOMContentLoaded', () => {
    const statusIndicator = document.getElementById('statusIndicator');
    const modeButtons = {
        inspect: document.getElementById('inspectBtn'),
        textTool: document.getElementById('textToolBtn'),
        quick: document.getElementById('quickBtn')
    };

    const toolButtons = document.querySelectorAll('.tool-btn');
    const displayCheckboxes = {
        color: document.getElementById('showColorHex'),
        dimensions: document.getElementById('showDimensions'),
        distances: document.getElementById('showDistances'),
        snap: document.getElementById('snapToElements')
    };

    const helperButtons = {
        grid: document.getElementById('gridToolBtn'),
        rulers: document.getElementById('rulersToolBtn')
    };

    const actionButtons = {
        clear: document.getElementById('clearAllBtn'),
        disable: document.getElementById('disableBtn')
    };



    let currentMode = 'idle';
    let currentTool = 'selection';
    let isExtensionEnabled = true;


    loadExtensionState();
    loadSettings();
    updateUI();

    function loadExtensionState() {
        chrome.runtime.sendMessage({ action: 'getExtensionState' }, (response) => {
            if (response) {
                isExtensionEnabled = response.isEnabled;
                updateUI();
            }
        });
    }

    function toggleExtension() {
        chrome.runtime.sendMessage({ action: 'toggleExtension' }, (response) => {
            if (response) {
                isExtensionEnabled = response.isEnabled;


                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'setExtensionState',
                            isEnabled: isExtensionEnabled
                        }).catch(() => {});
                    });
                });

                updateUI();
            }
        });
    }


    Object.entries(modeButtons).forEach(([mode, button]) => {
        if (button) { // Добавлена проверка
            button.addEventListener('click', () => {
                if (!isExtensionEnabled) {
                    toggleExtension();
                    return;
                }

                let targetMode = mode;
                if (mode === 'textTool') targetMode = 'text';
                if (mode === 'quick') targetMode = 'quick';
                if (mode === 'inspect') targetMode = 'inspect';

                sendMessageToActiveTab({
                    action: 'setMode',
                    mode: targetMode
                });
                setMode(targetMode, currentTool);
            });
        }
    });


    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!isExtensionEnabled) {
                toggleExtension();
                return;
            }

            const tool = button.dataset.tool;

            if (tool === 'grid') {
                sendMessageToActiveTab({ action: 'toggleGrid' });
                button.classList.toggle('active');

            } else if (tool === 'rulers') {
                sendMessageToActiveTab({ action: 'toggleRulers' });
                button.classList.toggle('active');

            } else if (tool === 'distance') {
                showDistanceHint();
            } else {
                setTool(tool);
                sendMessageToActiveTab({
                    action: 'setMode',
                    mode: 'inspect',
                    tool: tool
                });
                setMode('inspect', tool);
            }
        });
    });


    Object.entries(displayCheckboxes).forEach(([key, checkbox]) => {
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                if (!isExtensionEnabled) return;

                const settingsKey = key === 'color' ? 'showColorHex' :
                    key === 'dimensions' ? 'showDimensions' :
                        key === 'distances' ? 'showDistances' : 'snapToElements';

                const settings = { [settingsKey]: checkbox.checked };


                chrome.storage.local.get(['figmamodSettings'], (result) => {
                    const currentSettings = result.figmamodSettings || {};
                    const newSettings = { ...currentSettings, ...settings };
                    chrome.storage.local.set({ figmamodSettings: newSettings });
                });


                sendMessageToActiveTab({
                    action: 'updateSettings',
                    settings: settings
                });
            });
        }
    });


    if (actionButtons.clear) {
        actionButtons.clear.addEventListener('click', () => {
            if (!isExtensionEnabled) return;

            console.log('Clear all clicked');


            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'clearAll' }).catch(() => {});
                    chrome.tabs.sendMessage(tab.id, { action: 'setMode', mode: 'idle' }).catch(() => {});
                });
            });

            setMode('idle');


            chrome.storage.local.get(['figmamodSettings'], (result) => {
                if (result.figmamodSettings) {
                    const settings = result.figmamodSettings;
                    settings.showGrid = false;
                    settings.showRulers = false;
                    chrome.storage.local.set({ figmamodSettings: settings });
                }
            });


            toolButtons.forEach(button => {
                if (button.dataset.tool === 'grid' || button.dataset.tool === 'rulers') {
                    button.classList.remove('active');
                }
            });
        });
    }


    if (actionButtons.disable) {
        actionButtons.disable.addEventListener('click', () => {
            toggleExtension();
        });
    }

    function setMode(mode, tool = null) {
        if (!isExtensionEnabled && mode !== 'idle') return;

        currentMode = mode;
        if (tool) currentTool = tool;
        updateUI();
    }

    function setTool(tool) {
        currentTool = tool;

        toolButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.tool === tool) {
                button.classList.add('active');
            }
        });
    }

    function loadSettings() {
        chrome.storage.local.get(['figmamodSettings'], (result) => {
            if (result.figmamodSettings) {
                const settings = result.figmamodSettings;

                if (settings.showColorHex !== undefined && displayCheckboxes.color)
                    displayCheckboxes.color.checked = settings.showColorHex;
                if (settings.showDimensions !== undefined && displayCheckboxes.dimensions)
                    displayCheckboxes.dimensions.checked = settings.showDimensions;
                if (settings.showDistances !== undefined && displayCheckboxes.distances)
                    displayCheckboxes.distances.checked = settings.showDistances;
                if (settings.snapToElements !== undefined && displayCheckboxes.snap)
                    displayCheckboxes.snap.checked = settings.snapToElements;


                toolButtons.forEach(button => {
                    if (button.dataset.tool === 'grid' && settings.showGrid) {
                        button.classList.add('active');
                    }
                    if (button.dataset.tool === 'rulers' && settings.showRulers) {
                        button.classList.add('active');
                    }
                });
            }
        });
    }

    function updateUI() {
        if (!isExtensionEnabled) {
            statusIndicator.textContent = '● Выкл';
            statusIndicator.className = 'status';
            actionButtons.disable.textContent = 'Включить';
            actionButtons.disable.style.background = '#0D99FF';
            currentMode = 'idle';


            const controls = [
                ...Object.values(modeButtons).filter(Boolean),
                ...Array.from(toolButtons).filter(Boolean),
                actionButtons.clear
            ];

            controls.forEach(control => {
                if (control) {
                    control.disabled = true;
                    control.style.opacity = '0.5';
                    control.style.pointerEvents = 'none';
                }
            });

            Object.values(displayCheckboxes).filter(Boolean).forEach(checkbox => {
                if (checkbox) {
                    checkbox.disabled = true;
                    checkbox.style.opacity = '0.5';
                }
            });

        } else {
            statusIndicator.textContent = currentMode === 'idle' ? '● Вкл (ожидание)' : `● ${currentMode}`;
            statusIndicator.className = currentMode === 'idle' ? 'status' : 'status active';
            actionButtons.disable.textContent = 'Отключить';
            actionButtons.disable.style.background = '#ff4444';


            const controls = [
                ...Object.values(modeButtons).filter(Boolean),
                ...Array.from(toolButtons).filter(Boolean),
                actionButtons.clear
            ];

            controls.forEach(control => {
                if (control) {
                    control.disabled = false;
                    control.style.opacity = '1';
                    control.style.pointerEvents = 'auto';
                }
            });

            Object.values(displayCheckboxes).filter(Boolean).forEach(checkbox => {
                if (checkbox) {
                    checkbox.disabled = false;
                    checkbox.style.opacity = '1';
                }
            });
        }


        Object.entries(modeButtons).forEach(([mode, button]) => {
            if (button) {
                button.classList.remove('active');
                let targetMode = mode;
                if (mode === 'textTool') targetMode = 'text';

                if (isExtensionEnabled && targetMode === currentMode) {
                    button.classList.add('active');
                }
            }
        });

        if (isExtensionEnabled) {
            setTool(currentTool);
        } else {
            toolButtons.forEach(button => button.classList.remove('active'));
        }
        chrome.storage.local.get(['figmamodSettings'], (result) => {
            if (result.figmamodSettings && isExtensionEnabled) {
                toolButtons.forEach(button => {
                    if (button.dataset.tool === 'grid') {
                        button.classList.toggle('active', result.figmamodSettings.showGrid);
                    }
                    if (button.dataset.tool === 'rulers') {
                        button.classList.toggle('active', result.figmamodSettings.showRulers);
                    }
                });
            }
        });
    }

    function sendMessageToActiveTab(message) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) {
                console.log('Нет активной вкладки');
                return;
            }

            chrome.tabs.sendMessage(tabs[0].id, message).catch(error => {
                console.log('Ошибка отправки сообщения:', error);

                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['content.js']
                }).then(() => {
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabs[0].id, message).catch(e =>
                            console.log('Повторная отправка не удалась:', e)
                        );
                    }, 500);
                }).catch(err => console.log('Не удалось загрузить content.js:', err));
            });
        });
    }

    function showDistanceHint() {
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(13, 153, 255, 0.9);
            color: white;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: fadeOut 3s forwards;
        `;
        hint.innerHTML = '📏 Зажмите Ctrl (Win) / Cmd (Mac) и кликните, чтобы начать измерение';
        document.body.appendChild(hint);

        setTimeout(() => {
            hint.remove();
        }, 3000);
    }

    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeOut {
            0% { opacity: 1; }
            70% { opacity: 1; }
            100% { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});