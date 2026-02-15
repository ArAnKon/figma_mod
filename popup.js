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
        grid: document.getElementById('toggleGridBtn'),
        rulers: document.getElementById('toggleRulersBtn')
    };

    const actionButtons = {
        clear: document.getElementById('clearAllBtn'),
        disable: document.getElementById('disableBtn')
    };

    const fontInfoPanel = document.getElementById('fontInfoPanel');
    const fontNameDisplay = document.getElementById('fontNameDisplay');

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

                if (isExtensionEnabled) {
                    setTimeout(() => {
                        setMode('inspect', 'selection');
                    }, 100);
                } else {
                    setMode('idle');
                }

                updateUI();
            }
        });
    }

    Object.entries(modeButtons).forEach(([mode, button]) => {
        button.addEventListener('click', () => {
            if (!isExtensionEnabled) {
                toggleExtension();
                return;
            }

            if (mode === 'quick') {
                sendMessage({ action: 'setMode', mode: 'quick' });
                setMode('quick');
            } else if (mode === 'textTool') {
                sendMessage({ action: 'setMode', mode: 'text' });
                setMode('text');
            } else {
                sendMessage({ action: 'setMode', mode: 'inspect', tool: currentTool });
                setMode('inspect', currentTool);
            }
        });
    });

    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!isExtensionEnabled) {
                toggleExtension();
                return;
            }

            const tool = button.dataset.tool;

            if (tool === 'grid') {
                sendMessage({ action: 'toggleGrid' });
                button.classList.toggle('active');
            } else if (tool === 'rulers') {
                sendMessage({ action: 'toggleRulers' });
                button.classList.toggle('active');
            } else if (tool === 'distance') {
                showDistanceHint();
            } else {
                setTool(tool);
                sendMessage({ action: 'setMode', mode: 'inspect', tool: tool });
                setMode('inspect', tool);
            }
        });
    });

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
        hint.innerHTML = '📏 Зажмите Ctrl и кликните, чтобы начать измерение';
        document.body.appendChild(hint);

        setTimeout(() => {
            hint.remove();
        }, 3000);
    }

    Object.entries(displayCheckboxes).forEach(([key, checkbox]) => {
        checkbox.addEventListener('change', () => {
            if (!isExtensionEnabled) return;

            const settingsKey = key === 'color' ? 'showColorHex' :
                key === 'dimensions' ? 'showDimensions' :
                    key === 'distances' ? 'showDistances' : 'snapToElements';

            updateSettings({ [settingsKey]: checkbox.checked });
        });
    });

    helperButtons.grid.addEventListener('click', () => {
        if (!isExtensionEnabled) {
            toggleExtension();
            return;
        }

        sendMessage({ action: 'toggleGrid' });
        helperButtons.grid.classList.toggle('active');
    });

    helperButtons.rulers.addEventListener('click', () => {
        if (!isExtensionEnabled) {
            toggleExtension();
            return;
        }

        sendMessage({ action: 'toggleRulers' });
        helperButtons.rulers.classList.toggle('active');
    });

    actionButtons.clear.addEventListener('click', () => {
        if (!isExtensionEnabled) return;
        sendMessage({ action: 'clearAll' });
        setMode('idle');
    });

    actionButtons.disable.addEventListener('click', () => {
        toggleExtension();
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'modeChanged') {
            currentMode = message.mode;
            currentTool = message.tool || 'selection';
            updateUI();
        }

        if (message.action === 'fontInfo') {
            if (message.fontFamily) {
                fontNameDisplay.textContent = message.fontFamily.split(',')[0].replace(/['"]/g, '');
                fontInfoPanel.style.display = 'block';
            } else {
                fontInfoPanel.style.display = 'none';
            }
        }
    });

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

    function updateSettings(settings) {
        if (!isExtensionEnabled) return;

        sendMessage({ action: 'updateSettings', settings: settings });
        chrome.storage.local.set({ figmamodSettings: settings });
    }

    function loadSettings() {
        chrome.storage.local.get(['figmamodSettings'], (result) => {
            if (result.figmamodSettings) {
                const settings = result.figmamodSettings;

                if (settings.showColorHex !== undefined) displayCheckboxes.color.checked = settings.showColorHex;
                if (settings.showDimensions !== undefined) displayCheckboxes.dimensions.checked = settings.showDimensions;
                if (settings.showDistances !== undefined) displayCheckboxes.distances.checked = settings.showDistances;
                if (settings.snapToElements !== undefined) displayCheckboxes.snap.checked = settings.snapToElements;

                if (settings.showGrid) {
                    helperButtons.grid.classList.add('active');
                    document.querySelector('[data-tool="grid"]')?.classList.add('active');
                }
                if (settings.showRulers) {
                    helperButtons.rulers.classList.add('active');
                    document.querySelector('[data-tool="rulers"]')?.classList.add('active');
                }
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
            fontInfoPanel.style.display = 'none';
        } else {
            statusIndicator.textContent = currentMode === 'idle' ? '● Вкл (ожидание)' : `● ${currentMode}`;
            statusIndicator.className = currentMode === 'idle' ? 'status' : 'status active';
            actionButtons.disable.textContent = 'Отключить';
            actionButtons.disable.style.background = '#ff4444';
        }

        Object.entries(modeButtons).forEach(([mode, button]) => {
            button.classList.remove('active');
            if (isExtensionEnabled && mode === currentMode) {
                button.classList.add('active');
            }
        });

        if (isExtensionEnabled) {
            setTool(currentTool);
        } else {
            toolButtons.forEach(button => button.classList.remove('active'));
        }

        chrome.storage.local.get(['figmamodSettings'], (result) => {
            if (result.figmamodSettings && isExtensionEnabled) {
                helperButtons.grid.classList.toggle('active', result.figmamodSettings.showGrid);
                helperButtons.rulers.classList.toggle('active', result.figmamodSettings.showRulers);

                const gridToolBtn = document.querySelector('[data-tool="grid"]');
                const rulersToolBtn = document.querySelector('[data-tool="rulers"]');
                if (gridToolBtn) gridToolBtn.classList.toggle('active', result.figmamodSettings.showGrid);
                if (rulersToolBtn) rulersToolBtn.classList.toggle('active', result.figmamodSettings.showRulers);
            } else {
                helperButtons.grid.classList.remove('active');
                helperButtons.rulers.classList.remove('active');
                document.querySelector('[data-tool="grid"]')?.classList.remove('active');
                document.querySelector('[data-tool="rulers"]')?.classList.remove('active');
            }
        });

        const controls = [
            ...Object.values(modeButtons),
            ...toolButtons,
            ...Object.values(helperButtons),
            actionButtons.clear
        ];

        controls.forEach(control => {
            if (control) {
                control.disabled = !isExtensionEnabled;
                control.style.opacity = isExtensionEnabled ? '1' : '0.5';
                control.style.pointerEvents = isExtensionEnabled ? 'auto' : 'none';
            }
        });

        Object.values(displayCheckboxes).forEach(checkbox => {
            if (checkbox) {
                checkbox.disabled = !isExtensionEnabled;
                checkbox.style.opacity = isExtensionEnabled ? '1' : '0.5';
            }
        });
    }

    function sendMessage(message) {
        if (!isExtensionEnabled && message.action !== 'setMode' &&
            message.action !== 'toggleExtension' && message.action !== 'getExtensionState') {
            return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;

            chrome.tabs.sendMessage(tabs[0].id, message).catch(error => {
                console.log('Ошибка отправки сообщения:', error);

                if (message.action === 'toggleGrid' || message.action === 'toggleRulers') {
                    return;
                }

                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['content.js']
                }).then(() => {
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabs[0].id, message);
                    }, 500);
                }).catch(err => console.log('Не удалось загрузить content.js:', err));
            });
        });
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