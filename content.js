class FigmaMod {
    constructor() {
        this.isEnabled = true;
        this.mode = 'idle';
        this.settings = {
            showColorHex: true,
            showDimensions: true,
            showDistances: true,
            showBoxModel: false,
            showSpacingLabels: false,
            highlightColor: '#0D99FF',
            gridSize: 20,
            showGrid: false,
            showRulers: false,
            simulateState: null
        };

        this.currentElement = null;
        this.highlightElement = null;
        this.overlay = null;
        this.colorLabels = [];
        this.dimensionLabels = [];
        this.isAltPressed = false;
        this.isMeasuring = false;
        this.startMeasurePoint = null;
        this.distanceLabel = null;
        this.distanceLine = null;
        this.gridCanvas = null;
        this.rulersElement = null;
        this.measureElements = [];
        this.selectedElements = [];
        this.boxModelOverlay = null;
        this.spacingLabels = [];
        this.stateSimulationStyle = null;
        this.colorPalette = [];
        this.mobileViewport = null;

        this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        console.log('Платформа:', this.isMac ? 'macOS' : 'Windows');

        this.init();
    }

    init() {
        this.isEnabled = true;
        this.mode = 'idle';

        this.checkExtensionState();
        this.loadSettings();
        this.createOverlay();
        this.setupEventListeners();
        this.addStyles();
        console.log('FigmaMod инициализирован');
    }

    isMeasureKey(e) {
        if (this.isMac) {
            return e.metaKey; // Cmd на Mac
        } else {
            return e.ctrlKey; // Ctrl на Windows
        }
    }

    getMeasureKeyText() {
        return this.isMac ? '⌘ Cmd' : 'Ctrl';
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes figmamod-pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            .figmamod-measure-line {
                position: fixed;
                background: #ff4444;
                box-shadow: 0 0 5px rgba(255, 68, 68, 0.5);
                z-index: 2147483646;
                pointer-events: none;
            }
            
            .figmamod-measure-dot {
                position: fixed;
                width: 8px;
                height: 8px;
                background: #ff4444;
                border: 2px solid white;
                border-radius: 50%;
                z-index: 2147483646;
                pointer-events: none;
                box-shadow: 0 0 5px rgba(0,0,0,0.3);
            }
            
            .figmamod-measure-label {
                position: fixed;
                background: #ff4444;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font: bold 11px/1 'Segoe UI', Arial, sans-serif;
                z-index: 2147483647;
                pointer-events: none;
                white-space: nowrap;
                border: 1px solid rgba(255,255,255,0.3);
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }
            
            .figmamod-text-panel {
                position: fixed;
                background: rgba(44, 44, 44, 0.98);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font: 12px/1.5 'Segoe UI', Arial, sans-serif;
                pointer-events: none;
                z-index: 2147483647;
                border: 1px solid #444;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                min-width: 220px;
                max-width: 320px;
                backdrop-filter: blur(4px);
            }
        `;
        document.head.appendChild(style);
    }

    checkExtensionState() {
        chrome.storage.local.get(['isExtensionEnabled'], (result) => {
            const isEnabled = result.isExtensionEnabled !== false;
            if (isEnabled) {
                this.enableExtension();
            } else {
                this.disableExtension();
            }
        });
    }

    enableExtension() {
        this.isEnabled = true;
        this.mode = 'idle';

        if (this.overlay) {
            this.overlay.style.display = 'block';
        }

        document.body.classList.remove('figmamod-active', 'figmamod-inspect', 'figmamod-quick', 'figmamod-text');
    }

    disableExtension() {
        this.isEnabled = false;
        this.setMode('idle');
        this.clearAll();

        if (this.overlay) {
            this.overlay.style.display = 'none';
        }

        if (this.gridCanvas) {
            this.gridCanvas.remove();
            this.gridCanvas = null;
        }

        if (this.rulersElement) {
            this.rulersElement.remove();
            this.rulersElement = null;
        }

        document.body.classList.remove('figmamod-active', 'figmamod-inspect', 'figmamod-quick', 'figmamod-text');
    }

    loadSettings() {
        chrome.storage.local.get(['figmamodSettings'], (result) => {
            if (result.figmamodSettings) {
                this.settings = { ...this.settings, ...result.figmamodSettings };

                if (this.settings.showGrid) {
                    this.createGrid();
                }
                if (this.settings.showRulers) {
                    this.createRulers();
                }
            }
        });
    }

    saveSettings() {
        chrome.storage.local.set({ figmamodSettings: this.settings });
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'figmamod-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 2147483647;
        `;
        document.body.appendChild(this.overlay);
    }

    setupEventListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'setMode':
                    if (this.isEnabled) {
                        this.setMode(request.mode);
                    }
                    break;
                case 'updateSettings':
                    if (this.isEnabled) {
                        this.updateSettings(request.settings);
                    }
                    break;
                case 'clearAll':
                    if (this.isEnabled) {
                        this.clearAll();
                    }
                    break;
                case 'setExtensionState':
                    if (request.isEnabled) {
                        this.enableExtension();
                    } else {
                        this.disableExtension();
                    }
                    break;
                case 'toggleGrid':
                    if (this.isEnabled) {
                        this.toggleGrid();
                    }
                    break;
                case 'toggleRulers':
                    if (this.isEnabled) {
                        this.toggleRulers();
                    }
                    break;
                case 'extractPalette':
                    if (this.isEnabled) {
                        this.showColorPalettePanel();
                    }
                    break;
                case 'captureScreenshot':
                    if (this.isEnabled) {
                        this.captureScreenshot();
                    }
                    break;
                case 'toggleStateSimulation':
                    if (this.isEnabled) {
                        this.toggleElementState(request.state);
                    }
                    break;
                case 'runAccessibilityAudit':
                    if (this.isEnabled) {
                        this.runAccessibilityAudit();
                    }
                    break;
                case 'toggleBoxModel':
                    if (this.isEnabled) {
                        this.settings.showBoxModel = !this.settings.showBoxModel;
                        this.saveSettings();
                        if (!this.settings.showBoxModel) this.clearBoxModel();
                        sendResponse({ enabled: this.settings.showBoxModel });
                    }
                    break;
                case 'toggleSpacingLabels':
                    if (this.isEnabled) {
                        this.settings.showSpacingLabels = !this.settings.showSpacingLabels;
                        this.saveSettings();
                        if (!this.settings.showSpacingLabels) this.clearSpacingLabels();
                        sendResponse({ enabled: this.settings.showSpacingLabels });
                    }
                    break;
                case 'toggleMobileView':
                    if (this.isEnabled) {
                        this.toggleMobileView();
                    }
                    break;
                case 'clearMultiSelection':
                    this.clearMultiSelection();
                    break;
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!this.isEnabled) return;
            if (e.target.matches('input, textarea, select, button, [contenteditable="true"]')) return;

            const code = e.code;

            if (code === 'KeyV' || code === 'Digit1') {
                if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.setMode('inspect');
                }
            }

            if (code === 'KeyT') {
                if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.setMode('text');
                }
            }

            if (code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.setMode('idle');
                this.clearMeasureElements();
            }

            if (code.startsWith('Alt')) {
                if (!this.isAltPressed) {
                    this.isAltPressed = true;
                    if (this.mode !== 'quick') {
                        this.previousMode = this.mode;
                        this.setMode('quick');
                    }
                }
            }

            if (code === 'KeyG' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.toggleGrid();
            }

            if (code === 'KeyR' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.toggleRulers();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!this.isEnabled) return;

            if (e.code.startsWith('Alt') && this.isAltPressed) {
                this.isAltPressed = false;
                if (this.mode === 'quick' && this.previousMode) {
                    this.setMode(this.previousMode);
                }
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isEnabled) return;

            if (this.mode === 'inspect') {
                this.handleInspectMouseMove(e);
            } else if (this.mode === 'quick') {
                this.handleQuickMeasure(e);
            } else if (this.mode === 'text') {
                this.handleTextInspect(e);
            }

            if (this.isMeasuring && this.startMeasurePoint) {
                this.showDistanceMeasurement(this.startMeasurePoint, { x: e.clientX, y: e.clientY });
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (!this.isEnabled || this.mode !== 'inspect') return;

            if (this.isMeasureKey(e)) {
                e.preventDefault();
                e.stopPropagation();
                this.startMeasurePoint = { x: e.clientX, y: e.clientY };
                this.isMeasuring = true;
                document.body.classList.add('figmamod-measuring');
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isMeasuring) {
                this.isMeasuring = false;
                this.startMeasurePoint = null;
                this.clearDistanceLabel();
                document.body.classList.remove('figmamod-measuring');
            }
        });

        document.addEventListener('contextmenu', (e) => {
            if (this.isEnabled && this.mode === 'inspect' && this.isMeasureKey(e)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.isEnabled) return;

            if (this.mode === 'inspect' && this.isMeasureKey(e) && e.shiftKey) {
                //Мультивыбор Shift+Cmd/Ctrl
                e.preventDefault();
                e.stopPropagation();
                this.handleMultiSelectClick(e);
            } else if (this.mode === 'inspect' && this.isMeasureKey(e)) {
                e.preventDefault();
                e.stopPropagation();

                const element = document.elementFromPoint(e.clientX, e.clientY);

                if (element) {
                    if (this.measureElements.length === 0) {
                        this.measureElements.push(element);
                        this.showElementSelected(element);
                        this.showMeasureHint(`Выберите второй элемент (${this.getMeasureKeyText()}+клик)`);
                    } else if (this.measureElements.length === 1) {
                        const firstElement = this.measureElements[0];
                        const secondElement = element;

                        const rect1 = firstElement.getBoundingClientRect();
                        const rect2 = secondElement.getBoundingClientRect();

                        this.showElementsDistance(rect1, rect2);

                        this.measureElements = [];
                        this.showMeasureHint('Расстояние показано');
                    }
                }
            } else if (this.mode === 'inspect' && !this.isMeasureKey(e)) {
                this.handleClick(e);
            } else if (this.mode === 'text') {
                this.handleTextClick(e);
            }
        });
    }

    clearMeasureElements() {
        this.measureElements = [];
        document.getElementById('figmamod-selected-element')?.remove();
        document.getElementById('figmamod-measure-hint')?.remove();
    }

    showMeasureHint(text) {
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 30px;
            font: 13px/1 'Segoe UI', Arial, sans-serif;
            z-index: 2147483647;
            border: 1px solid #ff4444;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            pointer-events: none;
            animation: figmamod-pulse 1s infinite;
        `;
        hint.textContent = `📏 ${text}`;
        hint.id = 'figmamod-measure-hint';

        const oldHint = document.getElementById('figmamod-measure-hint');
        if (oldHint) oldHint.remove();

        this.overlay.appendChild(hint);

        setTimeout(() => {
            if (hint.parentNode) {
                hint.remove();
            }
        }, 3000);
    }

    showElementSelected(element) {
        const rect = element.getBoundingClientRect();

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: 3px solid #ff4444;
            background: rgba(255, 68, 68, 0.1);
            pointer-events: none;
            z-index: 2147483646;
            box-sizing: border-box;
            animation: figmamod-pulse 1s infinite;
            box-shadow: 0 0 0 2px rgba(255,255,255,0.3);
        `;
        overlay.id = 'figmamod-selected-element';

        const old = document.getElementById('figmamod-selected-element');
        if (old) old.remove();

        this.overlay.appendChild(overlay);
    }

    showElementsDistance(rect1, rect2) {
        this.clearInfoLabels();
        this.clearDistanceLabel();
        document.getElementById('figmamod-selected-element')?.remove();

        //контейнер для линий
        const linesContainer = document.createElement('div');
        linesContainer.id = 'figmamod-distance-lines';
        linesContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483646;
    `;
         //Определяем какой элемент левее
        const isFirstLeft = rect1.left < rect2.left;

        //горизонтальное расстояние между элементами
        let horizontalDistance;
        if (isFirstLeft) {
            //Первый элемент слева второй справа
            horizontalDistance = Math.max(0, rect2.left - (rect1.left + rect1.width));
        } else {
            //Второй элемент слева первый справа
            horizontalDistance = Math.max(0, rect1.left - (rect2.left + rect2.width));
        }

        //Вертикальное расстояние
        const isFirstTop = rect1.top < rect2.top;
        let verticalDistance;
        if (isFirstTop) {
            //Первый элемент сверху второй снизу
            verticalDistance = Math.max(0, rect2.top - (rect1.top + rect1.height));
        } else {
            //Второй элемент сверху первый снизу
            verticalDistance = Math.max(0, rect1.top - (rect2.top + rect2.height));
        }

        console.log('Distances calculated:', { horizontalDistance, verticalDistance });

        // Горизонтальная линия
        if (horizontalDistance > 0) {
            const hLine = document.createElement('div');
            hLine.className = 'figmamod-measure-line';

            //Определяем позицию линии
            let left, width;
            if (isFirstLeft) {
                // Первый слева второй справа
                left = rect1.left + rect1.width;
                width = horizontalDistance;
            } else {
                // Второй слева первый справа
                left = rect2.left + rect2.width;
                width = horizontalDistance;
            }

            // Y
            const yTop = Math.min(rect1.top, rect2.top);
            const yBottom = Math.max(rect1.bottom, rect2.bottom);
            const y = (rect1.top + rect1.height/2 + rect2.top + rect2.height/2) / 2;

            hLine.style.cssText = `
            left: ${left}px;
            top: ${y - 1}px;
            width: ${width}px;
            height: 2px;
            background: #ff4444;
        `;
            linesContainer.appendChild(hLine);

            //Подпись
            const hLabel = document.createElement('div');
            hLabel.className = 'figmamod-measure-label';
            hLabel.style.cssText += `
            left: ${left + width/2}px;
            top: ${y - 20}px;
            transform: translateX(-50%);
            background: #ff4444;
        `;
            hLabel.textContent = `${Math.round(horizontalDistance)}px`;
            linesContainer.appendChild(hLabel);
        }

        //Вертикальная линия
        if (verticalDistance > 0) {
            const vLine = document.createElement('div');
            vLine.className = 'figmamod-measure-line';

            //Определяем позицию линии
            let top, height;
            if (isFirstTop) {
                //Первый сверху второй снизу
                top = rect1.top + rect1.height;
                height = verticalDistance;
            } else {
                //Второй сверху первый снизу
                top = rect2.top + rect2.height;
                height = verticalDistance;
            }

            //X
            const x = (rect1.left + rect1.width/2 + rect2.left + rect2.width/2) / 2;

            vLine.style.cssText = `
            left: ${x - 1}px;
            top: ${top}px;
            width: 2px;
            height: ${height}px;
            background: #ff4444;
        `;
            linesContainer.appendChild(vLine);

            //Подпись
            const vLabel = document.createElement('div');
            vLabel.className = 'figmamod-measure-label';
            vLabel.style.cssText += `
            left: ${x + 15}px;
            top: ${top + height/2 - 8}px;
            background: #ff4444;
        `;
            vLabel.textContent = `${Math.round(verticalDistance)}px`;
            linesContainer.appendChild(vLabel);
        }

        const centerLine = document.createElement('div');
        centerLine.style.cssText = `
        position: fixed;
        left: ${rect1.left + rect1.width/2}px;
        top: ${rect1.top + rect1.height/2}px;
        width: ${Math.sqrt(Math.pow(rect2.left + rect2.width/2 - (rect1.left + rect1.width/2), 2) +
            Math.pow(rect2.top + rect2.height/2 - (rect1.top + rect1.height/2), 2))}px;
        height: 1px;
        background: rgba(255, 68, 68, 0.3);
        transform-origin: 0 0;
        transform: rotate(${Math.atan2(rect2.top + rect2.height/2 - (rect1.top + rect1.height/2),
            rect2.left + rect2.width/2 - (rect1.left + rect1.width/2))}rad);
        pointer-events: none;
        z-index: 2147483645;
    `;
        linesContainer.appendChild(centerLine);

        //Общее инфо
        if (horizontalDistance > 0 || verticalDistance > 0) {
            const infoLabel = document.createElement('div');
            infoLabel.style.cssText = `
            position: fixed;
            left: ${(rect1.left + rect2.left + rect1.width/2 + rect2.width/2) / 2}px;
            top: ${Math.min(rect1.top, rect2.top) - 50}px;
            background: #ff4444;
            color: white;
            padding: 10px 16px;
            border-radius: 8px;
            font: 13px/1.4 'Segoe UI', Arial, sans-serif;
            pointer-events: none;
            z-index: 2147483647;
            white-space: nowrap;
            border: 1px solid rgba(255,255,255,0.3);
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            transform: translate(-50%, 0);
            font-weight: bold;
        `;

            let infoHtml = '<div style="display: flex; gap: 20px;">';
            if (horizontalDistance > 0) {
                infoHtml += `<div>↔️ ${Math.round(horizontalDistance)}px</div>`;
            }
            if (verticalDistance > 0) {
                infoHtml += `<div>↕️ ${Math.round(verticalDistance)}px</div>`;
            }
            infoHtml += '</div>';

            infoLabel.innerHTML = infoHtml;
            linesContainer.appendChild(infoLabel);
        }

        this.overlay.appendChild(linesContainer);
        this.distanceLine = linesContainer;

        console.log('Distance lines added to overlay');
    }

    clearDistanceLabel() {
        if (this.distanceLabel) {
            this.distanceLabel.remove();
            this.distanceLabel = null;
        }
        if (this.distanceLine) {
            this.distanceLine.remove();
            this.distanceLine = null;
        }
        document.getElementById('figmamod-selected-element')?.remove();
        document.getElementById('figmamod-measure-hint')?.remove();
    }

    setMode(mode) {
        if (!this.isEnabled && mode !== 'idle') {
            return;
        }

        this.mode = mode;
        this.clearOverlay();

        document.body.classList.remove('figmamod-active', 'figmamod-inspect', 'figmamod-quick', 'figmamod-text');

        if (mode !== 'idle') {
            document.body.classList.add('figmamod-active');
            document.body.classList.add(`figmamod-${mode}`);
        }

        console.log(`FigmaMod: режим ${mode}`);

        chrome.runtime.sendMessage({
            action: 'modeChanged',
            mode: mode
        }).catch(() => {});
    }

    handleInspectMouseMove(e) {
        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (!element || element === this.currentElement) return;

        this.currentElement = element;
        this.updateElementHighlight(element);
        this.showElementInfo(element, e.clientX, e.clientY);

        if (this.settings.showBoxModel) {
            this.showBoxModel(element);
        }

        if (this.settings.showSpacingLabels) {
            this.showSpacingLabels(element);
        }
    }

    handleQuickMeasure(e) {
        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (!element) return;

        const rect = element.getBoundingClientRect();
        this.showQuickMeasureInfo(rect, element, e.clientX, e.clientY);
    }

    handleTextInspect(e) {
        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (!element || element === this.currentElement) return;

        this.currentElement = element;
        this.updateElementHighlight(element);
        this.showTextInfo(element, e.clientX, e.clientY);
    }

    handleClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (element) {
            this.showElementDetails(element);
        }
    }

    handleTextClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (element) {
            this.showTextDetails(element);
        }
    }

    updateElementHighlight(element) {
        if (this.highlightElement) {
            this.highlightElement.remove();
        }

        const rect = element.getBoundingClientRect();

        this.highlightElement = document.createElement('div');
        this.highlightElement.className = 'figmamod-highlight';
        this.highlightElement.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: 2px solid ${this.settings.highlightColor};
            background: ${this.settings.highlightColor}20;
            pointer-events: none;
            z-index: 2147483646;
            box-sizing: border-box;
        `;

        this.overlay.appendChild(this.highlightElement);
    }

    showElementInfo(element, mouseX, mouseY) {
        this.clearInfoLabels();

        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        if (this.settings.showDimensions) {
            this.createDimensionLabel(
                `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
                rect.left,
                rect.top - 25,
                'top-left'
            );
        }

        this.createDimensionLabel(
            `X:${Math.round(rect.left)} Y:${Math.round(rect.top)}`,
            rect.right,
            rect.top - 25,
            'top-right'
        );

        if (this.settings.showColorHex) {
            const bgColor = styles.backgroundColor;
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                this.createColorLabel('BG:', bgColor, rect.left, rect.bottom + 5, 'bottom-left');
            }

            const textColor = styles.color;
            if (textColor && element.textContent.trim().length > 0) {
                this.createColorLabel('TEXT:', textColor, rect.left, rect.bottom + 30, 'bottom-left');
            }

            const borderColor = styles.borderTopColor;
            if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
                this.createColorLabel('BORDER:', borderColor, rect.left, rect.bottom + 55, 'bottom-left');
            }
        }

        if (element.parentElement && this.settings.showDistances) {
            const parentRect = element.parentElement.getBoundingClientRect();
            const offsetLeft = rect.left - parentRect.left;
            const offsetTop = rect.top - parentRect.top;

            this.createDimensionLabel(
                `←${Math.round(offsetLeft)} ↑${Math.round(offsetTop)}`,
                rect.left,
                rect.top,
                'offset'
            );
        }
    }


    showTextInfo(element, mouseX, mouseY) {
        this.clearInfoLabels();

        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        const fontSize = styles.fontSize;
        const lineHeight = styles.lineHeight;
        const fontFamily = styles.fontFamily.split(',')[0].replace(/['"]/g, '');
        const fontWeight = styles.fontWeight;
        const fontStyle = styles.fontStyle;
        const textColor = this.rgbToHex(styles.color);
        const textContent = element.textContent.trim().substring(0, 50) + (element.textContent.trim().length > 50 ? '...' : '');

        let weight = '';
        if (fontWeight === '400' || fontWeight === 'normal') weight = 'Regular';
        else if (fontWeight === '500') weight = 'Medium';
        else if (fontWeight === '600' || fontWeight === '700') weight = 'Bold';
        else if (fontWeight === '300') weight = 'Light';
        else weight = fontWeight;

        const textPanel = document.createElement('div');
        textPanel.className = 'figmamod-text-panel';

        let left = mouseX + 20;
        let top = mouseY - 20;

        if (left + 300 > window.innerWidth) {
            left = mouseX - 320;
        }

        if (top + 250 > window.innerHeight) {
            top = mouseY - 250;
        }

        textPanel.style.left = left + 'px';
        textPanel.style.top = top + 'px';

        textPanel.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid #555;">
                    <span style="font-size: 16px;">📝</span>
                    <span style="font-weight: 600; color: ${this.settings.highlightColor};">Текстовый элемент</span>
                </div>

                ${textContent ? `
                    <div style="background: #2a2a2a; padding: 10px; border-radius: 6px; border-left: 3px solid ${this.settings.highlightColor}; word-break: break-word;">
                        <div style="color: #aaa; font-size: 10px; margin-bottom: 4px;">Содержимое:</div>
                        <div style="color: white; font-size: 12px;">"${textContent}"</div>
                    </div>
                ` : ''}

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Гарнитура -->
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #aaa;">Шрифт</span>
                        <span style="font-weight: 500; color: ${this.settings.highlightColor};">${fontFamily}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #aaa;">Размер / Интерлиньяж</span>
                        <span>${fontSize} / ${lineHeight}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #aaa;">Стиль</span>
                        <span>${weight} ${fontStyle === 'italic' ? 'Курсив' : ''}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #aaa;">Цвет</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-block; width: 16px; height: 16px; background: ${styles.color}; border: 1px solid #666; border-radius: 4px;"></span>
                            <span style="font-family: monospace;">${textColor}</span>
                        </div>
                    </div>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 12px; padding-top: 8px; border-top: 1px solid #555; font-size: 11px; color: #888;">
                    ${styles.letterSpacing !== 'normal' ? `<span>Межбуквенный: ${styles.letterSpacing}</span>` : ''}
                    ${styles.textAlign !== 'start' ? `<span>Выравнивание: ${styles.textAlign}</span>` : ''}
                </div>
            </div>
        `;

        this.overlay.appendChild(textPanel);
        this.dimensionLabels.push(textPanel);

        this.updateElementHighlight(element);
    }

    showQuickMeasureInfo(rect, element, mouseX, mouseY) {
        this.clearInfoLabels();

        this.createQuickLabel(
            `📏 ${Math.round(rect.width)} × ${Math.round(rect.height)}`,
            mouseX + 20,
            mouseY - 40
        );

        this.createQuickLabel(
            `📍 X:${Math.round(rect.left)} Y:${Math.round(rect.top)}`,
            mouseX + 20,
            mouseY - 20
        );

        const styles = window.getComputedStyle(element);

        const bgColor = styles.backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            const hex = this.rgbToHex(bgColor);
            this.createQuickLabel(
                `⬛ BG: ${hex}`,
                mouseX + 20,
                mouseY + 20
            );
        }

        const textColor = styles.color;
        if (textColor && element.textContent.trim().length > 0) {
            const hex = this.rgbToHex(textColor);
            this.createQuickLabel(
                `🅰️ TEXT: ${hex}`,
                mouseX + 20,
                mouseY + 40
            );
        }

        if (!this.highlightElement) {
            this.highlightElement = document.createElement('div');
            this.highlightElement.className = 'figmamod-quick-highlight';
            this.overlay.appendChild(this.highlightElement);
        }

        this.highlightElement.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: 1px dashed ${this.settings.highlightColor};
            pointer-events: none;
            z-index: 2147483646;
            box-sizing: border-box;
        `;
    }

    showDistanceMeasurement(startPoint, endPoint) {
        this.clearDistanceLabel();

        const distance = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) +
            Math.pow(endPoint.y - startPoint.y, 2)
        );

        const dx = Math.abs(endPoint.x - startPoint.x);
        const dy = Math.abs(endPoint.y - startPoint.y);

        const label = document.createElement('div');
        label.className = 'figmamod-distance-label';
        label.style.cssText = `
            position: fixed;
            left: ${(startPoint.x + endPoint.x) / 2}px;
            top: ${(startPoint.y + endPoint.y) / 2 - 30}px;
            background: rgba(13, 153, 255, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font: 12px/1 'Segoe UI', Arial, sans-serif;
            pointer-events: none;
            z-index: 2147483647;
            white-space: nowrap;
            border: 1px solid rgba(255,255,255,0.3);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transform: translate(-50%, 0);
        `;

        label.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">📏 Расстояние</div>
            <div>${Math.round(distance)}px</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.8); margin-top: 2px;">
                По X: ${dx}px • По Y: ${dy}px
            </div>
        `;

        this.overlay.appendChild(label);
        this.distanceLabel = label;

        this.drawDistanceLine(startPoint, endPoint);
    }

    drawDistanceLine(start, end) {
        if (this.distanceLine) {
            this.distanceLine.remove();
        }

        this.distanceLine = document.createElement('div');

        const left = Math.min(start.x, end.x);
        const top = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        this.distanceLine.style.cssText = `
            position: fixed;
            left: ${left}px;
            top: ${top}px;
            width: ${width}px;
            height: ${height}px;
            border: 2px dashed ${this.settings.highlightColor};
            border-right: ${end.x > start.x ? '2px dashed ' + this.settings.highlightColor : 'none'};
            border-bottom: ${end.y > start.y ? '2px dashed ' + this.settings.highlightColor : 'none'};
            border-left: ${end.x < start.x ? '2px dashed ' + this.settings.highlightColor : 'none'};
            border-top: ${end.y < start.y ? '2px dashed ' + this.settings.highlightColor : 'none'};
            pointer-events: none;
            z-index: 2147483646;
            box-sizing: border-box;
        `;

        this.overlay.appendChild(this.distanceLine);
    }

    showElementDetails(element) {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        const details = {
            tag: element.tagName.toLowerCase(),
            id: element.id || '(нет id)',
            classes: element.className || '(нет классов)',
            width: `${Math.round(rect.width)}px`,
            height: `${Math.round(rect.height)}px`,
            position: `${Math.round(rect.left)}px, ${Math.round(rect.top)}px`,
            backgroundColor: this.rgbToHex(styles.backgroundColor),
            color: this.rgbToHex(styles.color),
            fontSize: styles.fontSize,
            fontFamily: styles.fontFamily,
            margin: `${styles.marginTop} ${styles.marginRight} ${styles.marginBottom} ${styles.marginLeft}`,
            padding: `${styles.paddingTop} ${styles.paddingRight} ${styles.paddingBottom} ${styles.paddingLeft}`,
            border: `${styles.borderTopWidth} ${styles.borderTopStyle} ${styles.borderTopColor}`
        };

        console.log('FigmaMod - Детали элемента:', details);
        this.showDetailPanel(details, rect);

        chrome.runtime.sendMessage({
            action: 'fontInfo',
            fontFamily: details.fontFamily
        }).catch(() => {});
    }

    showTextDetails(element) {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        const details = {
            tag: element.tagName.toLowerCase(),
            text: element.textContent.trim().substring(0, 100) + (element.textContent.trim().length > 100 ? '...' : ''),
            fontFamily: styles.fontFamily,
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight,
            fontStyle: styles.fontStyle,
            lineHeight: styles.lineHeight,
            letterSpacing: styles.letterSpacing,
            textAlign: styles.textAlign,
            color: this.rgbToHex(styles.color),
            backgroundColor: this.rgbToHex(styles.backgroundColor)
        };

        this.showTextPanel(details, rect);

        chrome.runtime.sendMessage({
            action: 'fontInfo',
            fontFamily: details.fontFamily
        }).catch(() => {});
    }

    showDetailPanel(details, rect) {
        const oldPanel = document.getElementById('figmamod-detail-panel');
        if (oldPanel) oldPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'figmamod-detail-panel';
        panel.style.cssText = `
            position: fixed;
            right: 20px;
            top: 20px;
            width: 300px;
            background: #2C2C2C;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 15px;
            color: white;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            z-index: 2147483647;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            pointer-events: auto;
        `;

        let html = `
            <div style="margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 10px;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${details.tag}</div>
                <div style="color: #888; font-size: 11px;">${details.id} ${details.classes}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="color: #888;">Размер:</div>
                <div style="text-align: right;">${details.width} × ${details.height}</div>
                
                <div style="color: #888;">Позиция:</div>
                <div style="text-align: right;">${details.position}</div>
                
                <div style="color: #888;">Фон:</div>
                <div style="text-align: right;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: ${details.backgroundColor}; border: 1px solid #444; vertical-align: middle; margin-right: 5px;"></span>
                    ${details.backgroundColor}
                </div>
                
                <div style="color: #888;">Текст:</div>
                <div style="text-align: right;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: ${details.color}; border: 1px solid #444; vertical-align: middle; margin-right: 5px;"></span>
                    ${details.color}
                </div>
                
                <div style="color: #888;">Шрифт:</div>
                <div style="text-align: right;">${details.fontSize}</div>
                
                <div style="color: #888;">Margin:</div>
                <div style="text-align: right;">${details.margin}</div>
                
                <div style="color: #888;">Padding:</div>
                <div style="text-align: right;">${details.padding}</div>
                
                <div style="color: #888;">Border:</div>
                <div style="text-align: right;">${details.border}</div>
            </div>
            
            <button id="figmamod-close-panel" style="
                margin-top: 15px;
                width: 100%;
                padding: 8px;
                background: #444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">Закрыть</button>
        `;

        panel.innerHTML = html;
        document.body.appendChild(panel);

        panel.querySelector('#figmamod-close-panel').addEventListener('click', () => {
            panel.remove();
        });
    }

    showTextPanel(details, rect) {
        const oldPanel = document.getElementById('figmamod-text-panel');
        if (oldPanel) oldPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'figmamod-text-panel';
        panel.style.cssText = `
            position: fixed;
            right: 20px;
            top: 20px;
            width: 300px;
            background: #2C2C2C;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 15px;
            color: white;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            z-index: 2147483647;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            pointer-events: auto;
        `;

        let html = `
            <div style="margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 10px;">
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">📝 Текстовый элемент</div>
                <div style="color: #888; font-size: 11px;">${details.tag}</div>
            </div>
            
            <div style="margin-bottom: 15px; padding: 10px; background: #1e1e1e; border-radius: 4px; border-left: 3px solid ${this.settings.highlightColor};">
                <div style="color: #aaa; font-size: 11px; margin-bottom: 5px;">Содержимое:</div>
                <div style="color: white; font-size: 13px; word-break: break-word;">${details.text || '(пусто)'}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="color: #888;">Гарнитура:</div>
                <div style="text-align: right; font-weight: 500; color: ${this.settings.highlightColor};">${details.fontFamily.split(',')[0].replace(/['"]/g, '')}</div>
                
                <div style="color: #888;">Размер:</div>
                <div style="text-align: right;">${details.fontSize}</div>
                
                <div style="color: #888;">Насыщенность:</div>
                <div style="text-align: right;">${details.fontWeight}</div>
                
                <div style="color: #888;">Стиль:</div>
                <div style="text-align: right;">${details.fontStyle === 'italic' ? 'Курсив' : 'Обычный'}</div>
                
                <div style="color: #888;">Межстрочный:</div>
                <div style="text-align: right;">${details.lineHeight}</div>
                
                <div style="color: #888;">Межбуквенный:</div>
                <div style="text-align: right;">${details.letterSpacing}</div>
                
                <div style="color: #888;">Выравнивание:</div>
                <div style="text-align: right;">${details.textAlign}</div>
                
                <div style="color: #888;">Цвет:</div>
                <div style="text-align: right;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: ${details.color}; border: 1px solid #444; vertical-align: middle; margin-right: 5px;"></span>
                    ${details.color}
                </div>
            </div>
            
            <button id="figmamod-close-text-panel" style="
                margin-top: 15px;
                width: 100%;
                padding: 8px;
                background: #444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">Закрыть</button>
        `;

        panel.innerHTML = html;
        document.body.appendChild(panel);

        panel.querySelector('#figmamod-close-text-panel').addEventListener('click', () => {
            panel.remove();
        });
    }

    createDimensionLabel(text, x, y, type) {
        const label = document.createElement('div');
        label.className = `figmamod-label figmamod-${type}`;

        let style = `
            position: fixed;
            background: rgba(44, 44, 44, 0.95);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font: 11px/1 'Segoe UI', Arial, sans-serif;
            pointer-events: none;
            z-index: 2147483647;
            white-space: nowrap;
            border: 1px solid #444;
        `;

        switch (type) {
            case 'top-left':
                style += `left: ${x}px; top: ${y}px;`;
                break;
            case 'top-right':
                style += `right: ${window.innerWidth - x}px; top: ${y}px;`;
                break;
            case 'bottom-left':
                style += `left: ${x}px; top: ${y}px;`;
                break;
            case 'offset':
                style += `left: ${x}px; top: ${y}px; transform: translate(-100%, -100%);`;
                break;
        }

        label.style.cssText = style;
        label.textContent = text;

        this.overlay.appendChild(label);
        this.dimensionLabels.push(label);
    }

    createColorLabel(title, color, x, y, type) {
        const hex = this.rgbToHex(color);
        const label = document.createElement('div');
        label.className = 'figmamod-color-label';

        const baseStyle = `
            position: fixed;
            background: rgba(44, 44, 44, 0.95);
            color: white;
            padding: 6px 10px;
            border-radius: 4px;
            font: 11px/1 'Segoe UI', Arial, sans-serif;
            pointer-events: none;
            z-index: 2147483647;
            white-space: nowrap;
            border: 1px solid #444;
            display: flex;
            align-items: center;
            gap: 6px;
        `;

        label.innerHTML = `
            <span style="
                display: inline-block;
                width: 12px;
                height: 12px;
                background: ${color};
                border: 1px solid rgba(255,255,255,0.3);
                border-radius: 2px;
            "></span>
            <span>${title} ${hex}</span>
        `;

        label.style.cssText = baseStyle + `left: ${x}px; top: ${y}px; visibility: hidden;`;
        label.style.pointerEvents = 'auto';
        label.style.cursor = 'pointer';

        this.overlay.appendChild(label);
        const labelRect = label.getBoundingClientRect();
        const adjustedPos = this.getNonOverlappingPosition(x, y, labelRect.width, labelRect.height);
        label.style.cssText = baseStyle + `left: ${adjustedPos.x}px; top: ${adjustedPos.y}px; visibility: visible;`;

        label.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(hex).then(() => {
                const original = label.innerHTML;
                label.innerHTML = `
                    <span style="color: #0D99FF">✓ Скопировано!</span>
                `;
                setTimeout(() => {
                    label.innerHTML = original;
                }, 1000);
            });
        });

        this.colorLabels.push(label);
    }

    createQuickLabel(text, x, y) {
        const label = document.createElement('div');
        label.className = 'figmamod-quick-label';

        const baseStyle = `
            position: fixed;
            background: rgba(44, 44, 44, 0.95);
            color: white;
            padding: 6px 10px;
            border-radius: 4px;
            font: 12px/1 'Segoe UI', Arial, sans-serif;
            pointer-events: none;
            z-index: 2147483647;
            white-space: nowrap;
            border: 1px solid #444;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            visibility: hidden;
        `;

        label.style.cssText = baseStyle + `left: ${x}px; top: ${y}px;`;
        label.textContent = text;
        this.overlay.appendChild(label);

        const labelRect = label.getBoundingClientRect();
        const adjustedPos = this.getNonOverlappingPosition(x, y, labelRect.width, labelRect.height);
        label.style.cssText = baseStyle + `left: ${adjustedPos.x}px; top: ${adjustedPos.y}px; visibility: visible;`;

        this.dimensionLabels.push(label);
    }

    clearInfoLabels() {
        this.dimensionLabels.forEach(label => {
            if (label && label.parentNode) {
                label.remove();
            }
        });
        this.dimensionLabels = [];

        this.colorLabels.forEach(label => {
            if (label && label.parentNode) {
                label.remove();
            }
        });
        this.colorLabels = [];
    }

    getNonOverlappingPosition(x, y, width, height) {
        const padding = 5;
        let adjustedX = x;
        let adjustedY = y;

        const existingRects = [
            ...this.dimensionLabels,
            ...this.colorLabels,
            ...this.spacingLabels
        ].map(label => {
            if (!label || !label.parentNode) return null;
            const rect = label.getBoundingClientRect();
            return {
                left: rect.left - padding,
                right: rect.right + padding,
                top: rect.top - padding,
                bottom: rect.bottom + padding
            };
        }).filter(rect => rect !== null);

        const newRect = {
            left: adjustedX,
            right: adjustedX + width,
            top: adjustedY,
            bottom: adjustedY + height
        };

        let attempts = 0;
        const maxAttempts = 20;

        while (this._checkOverlap(newRect, existingRects) && attempts < maxAttempts) {

            if (attempts === 0) {
                adjustedY = y - height - padding;
                newRect.top = adjustedY;
                newRect.bottom = adjustedY + height;
            } else if (attempts === 1) {
                adjustedY = y + height + padding;
                newRect.top = adjustedY;
                newRect.bottom = adjustedY + height;
            } else if (attempts === 2) {
                adjustedX = x - width - padding;
                newRect.left = adjustedX;
                newRect.right = adjustedX + width;
            } else if (attempts === 3) {
                adjustedX = x + width + padding;
                newRect.left = adjustedX;
                newRect.right = adjustedX + width;
            } else {
                adjustedX = x + (attempts % 2 === 0 ? width : -width);
                adjustedY = y + (attempts % 2 === 0 ? height : -height);
                newRect.left = adjustedX;
                newRect.right = adjustedX + width;
                newRect.top = adjustedY;
                newRect.bottom = adjustedY + height;
            }
            attempts++;
        }

        adjustedX = Math.max(0, Math.min(adjustedX, window.innerWidth - width));
        adjustedY = Math.max(0, Math.min(adjustedY, window.innerHeight - height));

        return { x: adjustedX, y: adjustedY };
    }

    _checkOverlap(rect1, rects) {
        for (const rect2 of rects) {
            if (rect1.left < rect2.right &&
                rect1.right > rect2.left &&
                rect1.top < rect2.bottom &&
                rect1.bottom > rect2.top) {
                return true;
            }
        }
        return false;
    }

    clearOverlay() {
        if (this.overlay) {
            this.overlay.innerHTML = '';
        }

        this.clearInfoLabels();
        this.clearDistanceLabel();

        if (this.highlightElement) {
            this.highlightElement.remove();
            this.highlightElement = null;
        }

        this.currentElement = null;
        this.measureElements = [];
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();

        if (this.settings.showGrid) {
            this.createGrid();
        } else if (this.gridCanvas) {
            this.gridCanvas.remove();
            this.gridCanvas = null;
        }

        if (this.settings.showRulers) {
            this.createRulers();
        } else if (this.rulersElement) {
            this.rulersElement.remove();
            this.rulersElement = null;
        }
    }

    toggleGrid() {
        if (!this.gridCanvas) {
            this.createGrid();
            this.settings.showGrid = true;
        } else {
            this.gridCanvas.remove();
            this.gridCanvas = null;
            this.settings.showGrid = false;
        }
        this.saveSettings();
    }

    toggleRulers() {
        if (!this.rulersElement) {
            this.createRulers();
            this.settings.showRulers = true;
        } else {
            this.rulersElement.remove();
            this.rulersElement = null;
            this.settings.showRulers = false;
        }
        this.saveSettings();
    }

    createGrid() {
        if (this.gridCanvas) {
            this.gridCanvas.remove();
        }

        this.gridCanvas = document.createElement('canvas');
        this.gridCanvas.id = 'figmamod-grid';
        this.gridCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 2147483645;
        `;

        document.body.appendChild(this.gridCanvas);
        this.drawGrid();

        window.addEventListener('resize', () => this.drawGrid());
        window.addEventListener('scroll', () => this.drawGrid());
    }

    drawGrid() {
        if (!this.gridCanvas) return;

        const ctx = this.gridCanvas.getContext('2d');
        const canvas = this.gridCanvas;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const size = this.settings.gridSize || 20;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(13, 153, 255, 0.2)';
        ctx.lineWidth = 0.5;

        for (let x = 0; x <= canvas.width; x += size) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }

        for (let y = 0; y <= canvas.height; y += size) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }

        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(13, 153, 255, 0.3)';
        ctx.lineWidth = 1;

        for (let x = 0; x <= canvas.width; x += size * 5) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
        }

        for (let y = 0; y <= canvas.height; y += size * 5) {
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
        }

        ctx.stroke();
    }

    createRulers() {
        if (this.rulersElement) {
            this.rulersElement.remove();
        }

        this.rulersElement = document.createElement('div');
        this.rulersElement.id = 'figmamod-rulers';
        this.rulersElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 2147483645;
        `;

        const horizontalRuler = document.createElement('div');
        horizontalRuler.style.cssText = `
            position: fixed;
            top: 0;
            left: 20px;
            right: 0;
            height: 20px;
            background: rgba(44, 44, 44, 0.9);
            border-bottom: 1px solid #444;
            display: flex;
            align-items: center;
            padding-left: 20px;
            font-size: 10px;
            color: #ccc;
            overflow: hidden;
        `;

        const verticalRuler = document.createElement('div');
        verticalRuler.style.cssText = `
            position: fixed;
            top: 20px;
            left: 0;
            bottom: 0;
            width: 20px;
            background: rgba(44, 44, 44, 0.9);
            border-right: 1px solid #444;
            font-size: 10px;
            color: #ccc;
            writing-mode: vertical-lr;
            display: flex;
            align-items: center;
            padding-top: 20px;
        `;

        this.rulersElement.appendChild(horizontalRuler);
        this.rulersElement.appendChild(verticalRuler);

        document.body.appendChild(this.rulersElement);
        this.updateRulers();

        window.addEventListener('scroll', () => this.updateRulers());
        window.addEventListener('resize', () => this.updateRulers());
    }

    updateRulers() {
        if (!this.rulersElement) return;

        const horizontal = this.rulersElement.children[0];
        const vertical = this.rulersElement.children[1];

        let hContent = '';
        for (let x = 0; x < window.innerWidth; x += 50) {
            hContent += `<span style="position: absolute; left: ${x}px;">${x}</span>`;
        }
        horizontal.innerHTML = hContent;

        let vContent = '';
        for (let y = 20; y < window.innerHeight; y += 50) {
            vContent += `<span style="position: absolute; top: ${y}px;">${y}</span>`;
        }
        vertical.innerHTML = vContent;
    }

    // ==================== Цветовая палитра ====================

    extractColorPalette() {
        const colors = new Map();
        const elements = document.querySelectorAll('*');

        elements.forEach(el => {
            const styles = window.getComputedStyle(el);
            const colorProps = [
                styles.backgroundColor,
                styles.color,
                styles.borderTopColor,
                styles.borderRightColor,
                styles.borderBottomColor,
                styles.borderLeftColor
            ];

            colorProps.forEach(color => {
                if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent' && color !== 'inherit') {
                    const hex = this.rgbToHex(color);
                    if (hex && hex !== '#000000' && hex !== '#ffffff' && hex !== '#fff') {
                        colors.set(hex, (colors.get(hex) || 0) + 1);
                    }
                }
            });
        });

        this.colorPalette = Array.from(colors.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([color, count]) => ({ color, count }));

        return this.colorPalette;
    }

    showColorPalettePanel() {
        const oldPanel = document.getElementById('figmamod-palette-panel');
        if (oldPanel) oldPanel.remove();

        this.extractColorPalette();

        const panel = document.createElement('div');
        panel.id = 'figmamod-palette-panel';
        panel.style.cssText = `
            position: fixed;
            right: 20px;
            top: 20px;
            width: 320px;
            max-height: 80vh;
            background: #2C2C2C;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 15px;
            color: white;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            z-index: 2147483647;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            pointer-events: auto;
            overflow-y: auto;
        `;

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 10px;">
                <div style="font-weight: bold; font-size: 14px;">🎨 Палитра цветов</div>
                <div style="display: flex; gap: 8px;">
                    <button id="figmamod-export-palette" style="padding: 4px 8px; background: #0D99FF; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Экспорт</button>
                    <button id="figmamod-close-palette" style="padding: 4px 8px; background: #444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">✕</button>
                </div>
            </div>
            <div style="color: #888; font-size: 11px; margin-bottom: 10px;">Найдено цветов: ${this.colorPalette.length}</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        `;

        this.colorPalette.forEach(({ color, count }) => {
            html += `
                <div class="figmamod-palette-item" style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; padding: 6px; border-radius: 4px; border: 1px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='#0D99FF'" onmouseout="this.style.borderColor='transparent'">
                    <div style="width: 40px; height: 40px; background: ${color}; border: 1px solid #555; border-radius: 4px;"></div>
                    <div style="font-size: 10px; font-family: monospace; color: #ccc;">${color}</div>
                    <div style="font-size: 9px; color: #888;">${count}x</div>
                </div>
            `;
        });

        html += `</div>`;
        panel.innerHTML = html;
        document.body.appendChild(panel);

        panel.querySelector('#figmamod-close-palette').addEventListener('click', () => panel.remove());
        panel.querySelector('#figmamod-export-palette').addEventListener('click', () => this.exportColorPalette());

        panel.querySelectorAll('.figmamod-palette-item').forEach(item => {
            item.addEventListener('click', () => {
                const color = item.querySelector('div[style*="background"]').style.background;
                const hex = this.rgbToHex(color);
                navigator.clipboard.writeText(hex).then(() => {
                    const original = item.innerHTML;
                    item.innerHTML = `<div style="font-size: 10px; color: #0D99FF;">✓ Скопировано!</div>`;
                    setTimeout(() => { item.innerHTML = original; }, 1000);
                });
            });
        });
    }

    exportColorPalette() {
        const cssVars = this.colorPalette.map(({ color }, i) => `  --color-${i + 1}: ${color};`).join('\n');
        const json = JSON.stringify(this.colorPalette.map(({ color, count }) => ({ color, count })), null, 2);

        const exportPanel = document.createElement('div');
        exportPanel.style.cssText = `
            position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%);
            background: #2C2C2C; border: 1px solid #444; border-radius: 8px;
            padding: 20px; color: white; font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px; z-index: 2147483648; min-width: 400px; max-width: 600px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5); pointer-events: auto;
        `;

        exportPanel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 15px;">Экспорт палитры</div>
            <div style="display: flex; gap: 8px; margin-bottom: 15px;">
                <button class="figmamod-export-btn" data-format="css" style="padding: 6px 12px; background: #0D99FF; color: white; border: none; border-radius: 4px; cursor: pointer;">CSS</button>
                <button class="figmamod-export-btn" data-format="json" style="padding: 6px 12px; background: #444; color: white; border: none; border-radius: 4px; cursor: pointer;">JSON</button>
                <button class="figmamod-export-btn" data-format="tailwind" style="padding: 6px 12px; background: #444; color: white; border: none; border-radius: 4px; cursor: pointer;">Tailwind</button>
            </div>
            <textarea id="figmamod-export-output" style="width: 100%; height: 200px; background: #1e1e1e; color: #0D99FF; border: 1px solid #444; border-radius: 4px; padding: 10px; font-family: monospace; font-size: 11px; resize: vertical;"></textarea>
            <div style="display: flex; gap: 8px; margin-top: 15px;">
                <button id="figmamod-copy-export" style="padding: 6px 16px; background: #0D99FF; color: white; border: none; border-radius: 4px; cursor: pointer;">Копировать</button>
                <button id="figmamod-close-export" style="padding: 6px 16px; background: #444; color: white; border: none; border-radius: 4px; cursor: pointer;">Закрыть</button>
            </div>
        `;

        document.body.appendChild(exportPanel);

        const textarea = exportPanel.querySelector('#figmamod-export-output');

        exportPanel.querySelectorAll('.figmamod-export-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                let output = '';

                if (format === 'css') {
                    output = ':root {\n' + cssVars + '\n}';
                } else if (format === 'json') {
                    output = json;
                } else if (format === 'tailwind') {
                    output = 'colors: {\n' + this.colorPalette.map(({ color }, i) => `  'color-${i + 1}': '${color}',`).join('\n') + '\n}';
                }

                textarea.value = output;
                exportPanel.querySelectorAll('.figmamod-export-btn').forEach(b => b.style.background = '#444');
                btn.style.background = '#0D99FF';
            });
        });

        exportPanel.querySelector('#figmamod-copy-export').addEventListener('click', () => {
            navigator.clipboard.writeText(textarea.value);
        });

        exportPanel.querySelector('#figmamod-close-export').addEventListener('click', () => exportPanel.remove());

        // Trigger CSS by default
        exportPanel.querySelector('[data-format="css"]').click();
    }

    // ==================== Скрины ====================

    captureScreenshot() {
        this.showMeasureHint('Делаем скриншот...');

        chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
            if (response && response.success) {
                this.saveScreenshotFromDataUrl(response.dataUrl);
            } else {
                this.showMeasureHint('Ошибка скриншота: ' + (response?.error || 'неизвестно'));
            }
        });
    }

    saveScreenshotFromDataUrl(dataUrl) {
        const link = document.createElement('a');
        link.download = `figmamod-screenshot-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();

        this.showMeasureHint('Скриншот сохранен!');
    }

    // ==================== HOVER симуляция ====================

    toggleElementState(state) {
        if (this.settings.simulateState === state) {
            this.clearStateSimulation();
            return;
        }

        this.settings.simulateState = state;

        if (this.stateSimulationStyle) {
            this.stateSimulationStyle.remove();
        }

        this.stateSimulationStyle = document.createElement('style');
        this.stateSimulationStyle.id = 'figmamod-state-simulation';

        if (state === 'hover') {
            this.stateSimulationStyle.textContent = `
                *:hover { outline: 2px solid #ff4444 !important; }
                *:hover::before { content: '🖱️ hover'; position: absolute; background: #ff4444; color: white; padding: 2px 6px; font-size: 10px; z-index: 99999; }
            `;
        } else if (state === 'focus') {
            this.stateSimulationStyle.textContent = `
                *:focus { outline: 2px solid #0D99FF !important; box-shadow: 0 0 5px #0D99FF !important; }
                *:focus::after { content: '🎯 focus'; position: fixed; background: #0D99FF; color: white; padding: 2px 6px; font-size: 10px; z-index: 99999; }
            `;
        } else if (state === 'active') {
            this.stateSimulationStyle.textContent = `
                *:active { outline: 2px solid #FF9500 !important; }
                *:active::after { content: '⚡ active'; position: fixed; background: #FF9500; color: white; padding: 2px 6px; font-size: 10px; z-index: 99999; }
            `;
        }

        document.head.appendChild(this.stateSimulationStyle);
        this.showMeasureHint(`Симуляция состояния: ${state}`);
    }

    clearStateSimulation() {
        this.settings.simulateState = null;
        if (this.stateSimulationStyle) {
            this.stateSimulationStyle.remove();
            this.stateSimulationStyle = null;
        }
    }

    // ==================== Доступность ====================

    runAccessibilityAudit() {
        const issues = [];

        //Изобрадения без текста
        document.querySelectorAll('img').forEach((img, i) => {
            if (!img.alt && !img.getAttribute('aria-hidden')) {
                issues.push({
                    type: 'error',
                    category: 'Accessibility',
                    message: `Изображение без alt (${img.src ? img.src.substring(0, 50) : 'no-src'})`,
                    element: img
                });
            }
        });

        //WCAG контрасты
        document.querySelectorAll('*').forEach(el => {
            const styles = window.getComputedStyle(el);
            const bg = styles.backgroundColor;
            const fg = styles.color;

            if (bg && fg && bg !== 'rgba(0, 0, 0, 0)' && fg !== 'rgba(0, 0, 0, 0)') {
                const contrast = this.calculateContrastRatio(fg, bg);
                if (contrast < 4.5 && el.textContent.trim().length > 0) {
                    issues.push({
                        type: 'warning',
                        category: 'Contrast',
                        message: `Низкий контраст: ${contrast.toFixed(2)}:1 (нужно 4.5:1)`,
                        element: el,
                        contrast: contrast
                    });
                }
            }
        });

        //Поля без лейблов
        document.querySelectorAll('input, textarea, select').forEach(el => {
            const id = el.id;
            const hasLabel = id && document.querySelector(`label[for="${id}"]`);
            const hasAriaLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');

            if (!hasLabel && !hasAriaLabel && el.type !== 'hidden') {
                issues.push({
                    type: 'error',
                    category: 'Forms',
                    message: `Поле без label: ${el.type || 'input'}`,
                    element: el
                });
            }
        });

        //Ссылки без текста
        document.querySelectorAll('a').forEach(el => {
            if (!el.textContent.trim() && !el.getAttribute('aria-label')) {
                issues.push({
                    type: 'warning',
                    category: 'Links',
                    message: 'Ссылка без текста',
                    element: el
                });
            }
        });

        this.showAccessibilityReport(issues.slice(0, 100));
    }

    calculateContrastRatio(color1, color2) {
        const lum1 = this.getLuminance(color1);
        const lum2 = this.getLuminance(color2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
    }

    getLuminance(color) {
        const hex = this.rgbToHex(color);
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const [rs, gs, bs] = [r, g, b].map(c =>
            c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        );

        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    showAccessibilityReport(issues) {
        const oldPanel = document.getElementById('figmamod-a11y-panel');
        if (oldPanel) oldPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'figmamod-a11y-panel';
        panel.style.cssText = `
            position: fixed; right: 20px; top: 20px; width: 400px; max-height: 80vh;
            background: #2C2C2C; border: 1px solid #444; border-radius: 8px;
            padding: 15px; color: white; font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px; z-index: 2147483647; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            pointer-events: auto; overflow-y: auto;
        `;

        const errors = issues.filter(i => i.type === 'error').length;
        const warnings = issues.filter(i => i.type === 'warning').length;

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 10px;">
                <div style="font-weight: bold; font-size: 14px;">♿ Accessibility Audit</div>
                <button id="figmamod-close-a11y" style="padding: 4px 8px; background: #444; color: white; border: none; border-radius: 4px; cursor: pointer;">✕</button>
            </div>
            <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                <div style="color: #ff4444;">⛔ Ошибки: ${errors}</div>
                <div style="color: #FF9500;">⚠️ Предупреждения: ${warnings}</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
        `;

        issues.forEach((issue, i) => {
            html += `
                <div style="padding: 10px; background: ${issue.type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(255,149,0,0.1)'}; border-left: 3px solid ${issue.type === 'error' ? '#ff4444' : '#FF9500'}; border-radius: 4px; cursor: pointer;" data-index="${i}">
                    <div style="font-weight: 500; margin-bottom: 4px;">${issue.message}</div>
                    <div style="font-size: 10px; color: #888;">${issue.category}</div>
                </div>
            `;
        });

        html += `</div>`;
        panel.innerHTML = html;
        document.body.appendChild(panel);

        panel.querySelector('#figmamod-close-a11y').addEventListener('click', () => panel.remove());

        panel.querySelectorAll('[data-index]').forEach(item => {
            item.addEventListener('click', () => {
                const issue = issues[item.dataset.index];
                if (issue && issue.element) {
                    issue.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    issue.element.style.outline = '3px solid #FF9500';
                    setTimeout(() => { issue.element.style.outline = ''; }, 2000);
                }
            });
        });
    }

    // ==================== Мультиэлементы ====================

    handleMultiSelectClick(e) {
        if (!this.isMeasureKey(e)) return;

        e.preventDefault();
        e.stopPropagation();

        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (!element) return;

        const index = this.selectedElements.indexOf(element);

        if (index > -1) {
            this.selectedElements.splice(index, 1);
            element.style.outline = '';
        } else {
            this.selectedElements.push(element);
            element.style.outline = '3px solid #0D99FF';
        }

        this.showMultiSelectGuides();
    }

    showMultiSelectGuides() {
        document.querySelectorAll('.figmamod-multi-guide').forEach(el => el.remove());

        if (this.selectedElements.length < 2) return;

        const rects = this.selectedElements.map(el => el.getBoundingClientRect());

        //Расстояние между элементами
        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                this.drawAlignmentGuide(rects[i], rects[j]);
            }
        }

        if (this.selectedElements.length >= 2) {
            const last = rects[rects.length - 2];
            const current = rects[rects.length - 1];
            this.showElementsDistance(last, current);
        }
    }

    drawAlignmentGuide(rect1, rect2) {
        const container = this.overlay;

        //вертикальное
        if (Math.abs((rect1.left + rect1.width/2) - (rect2.left + rect2.width/2)) < 5) {
            const x = (rect1.left + rect1.width/2 + rect2.left + rect2.width/2) / 2;
            const guide = document.createElement('div');
            guide.className = 'figmamod-multi-guide';
            guide.style.cssText = `
                position: fixed; left: ${x}px; top: ${Math.min(rect1.top, rect2.top)}px;
                width: 1px; height: ${Math.max(rect1.bottom, rect2.bottom) - Math.min(rect1.top, rect2.top)}px;
                background: #0D99FF; border-left: 1px dashed #0D99FF; pointer-events: none; z-index: 2147483646;
            `;
            container.appendChild(guide);
        }

        //горизонт
        if (Math.abs((rect1.top + rect1.height/2) - (rect2.top + rect2.height/2)) < 5) {
            const y = (rect1.top + rect1.height/2 + rect2.top + rect2.height/2) / 2;
            const guide = document.createElement('div');
            guide.className = 'figmamod-multi-guide';
            guide.style.cssText = `
                position: fixed; left: ${Math.min(rect1.left, rect2.left)}px; top: ${y}px;
                height: 1px; width: ${Math.max(rect1.right, rect2.right) - Math.min(rect1.left, rect2.left)}px;
                background: #0D99FF; border-top: 1px dashed #0D99FF; pointer-events: none; z-index: 2147483646;
            `;
            container.appendChild(guide);
        }
    }

    clearMultiSelection() {
        this.selectedElements.forEach(el => { el.style.outline = ''; });
        this.selectedElements = [];
        document.querySelectorAll('.figmamod-multi-guide').forEach(el => el.remove());
    }

    // ==================== CSS BOX MODEL====================

    showBoxModel(element) {
        this.clearBoxModel();

        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        const margin = {
            top: parseFloat(styles.marginTop),
            right: parseFloat(styles.marginRight),
            bottom: parseFloat(styles.marginBottom),
            left: parseFloat(styles.marginLeft)
        };

        const border = {
            top: parseFloat(styles.borderTopWidth),
            right: parseFloat(styles.borderRightWidth),
            bottom: parseFloat(styles.borderBottomWidth),
            left: parseFloat(styles.borderLeftWidth)
        };

        const padding = {
            top: parseFloat(styles.paddingTop),
            right: parseFloat(styles.paddingRight),
            bottom: parseFloat(styles.paddingBottom),
            left: parseFloat(styles.paddingLeft)
        };

        this.boxModelOverlay = document.createElement('div');
        this.boxModelOverlay.id = 'figmamod-box-model';

        const marginDiv = document.createElement('div');
        marginDiv.style.cssText = `
            position: fixed;
            left: ${rect.left - margin.left}px;
            top: ${rect.top - margin.top}px;
            width: ${rect.width + margin.left + margin.right}px;
            height: ${rect.height + margin.top + margin.bottom}px;
            border: 2px dashed #FF9500;
            background: rgba(255, 149, 0, 0.1);
            pointer-events: none;
            z-index: 2147483645;
            box-sizing: border-box;
        `;

        const borderDiv = document.createElement('div');
        borderDiv.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: ${border.top}px solid rgba(13, 153, 255, 0.5);
            background: rgba(13, 153, 255, 0.05);
            pointer-events: none;
            z-index: 2147483645;
            box-sizing: border-box;
        `;

        const paddingDiv = document.createElement('div');
        paddingDiv.style.cssText = `
            position: fixed;
            left: ${rect.left + border.left}px;
            top: ${rect.top + border.top}px;
            width: ${rect.width - border.left - border.right}px;
            height: ${rect.height - border.top - border.bottom}px;
            border: 2px dashed #34C759;
            background: rgba(52, 199, 89, 0.1);
            pointer-events: none;
            z-index: 2147483645;
            box-sizing: border-box;
        `;

        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = `
            position: fixed;
            left: ${rect.left + border.left + padding.left}px;
            top: ${rect.top + border.top + padding.top}px;
            width: ${rect.width - border.left - border.right - padding.left - padding.right}px;
            height: ${rect.height - border.top - border.bottom - padding.top - padding.bottom}px;
            border: 1px solid #FF3B30;
            background: rgba(255, 59, 48, 0.1);
            pointer-events: none;
            z-index: 2147483645;
            box-sizing: border-box;
        `;

        this.boxModelOverlay.appendChild(marginDiv);
        this.boxModelOverlay.appendChild(borderDiv);
        this.boxModelOverlay.appendChild(paddingDiv);
        this.boxModelOverlay.appendChild(contentDiv);

        this.createBoxModelLabel('margin', '#FF9500', rect.left - margin.left, rect.top - margin.top - 20);
        this.createBoxModelLabel('border', '#0D99FF', rect.left, rect.top - 20);
        this.createBoxModelLabel('padding', '#34C759', rect.left + border.left, rect.top - 20);
        this.createBoxModelLabel('content', '#FF3B30', rect.left + border.left + padding.left, rect.top - 20);

        document.body.appendChild(this.boxModelOverlay);
    }

    createBoxModelLabel(text, color, x, y) {
        const label = document.createElement('div');

        const baseStyle = `
            position: fixed; background: ${color}; color: white; padding: 2px 6px;
            border-radius: 3px; font: 10px/1 'Segoe UI', Arial, sans-serif;
            pointer-events: none; z-index: 2147483646; white-space: nowrap;
            visibility: hidden;
        `;

        label.style.cssText = baseStyle + `left: ${x}px; top: ${y}px;`;
        label.textContent = text;
        this.boxModelOverlay.appendChild(label);

        const labelRect = label.getBoundingClientRect();
        const adjustedPos = this.getNonOverlappingPosition(x, y, labelRect.width, labelRect.height);
        label.style.cssText = baseStyle + `left: ${adjustedPos.x}px; top: ${adjustedPos.y}px; visibility: visible;`;
    }

    clearBoxModel() {
        if (this.boxModelOverlay) {
            this.boxModelOverlay.remove();
            this.boxModelOverlay = null;
        }
    }


    showSpacingLabels(element) {
        if (!this.settings.showSpacingLabels) return;

        this.clearSpacingLabels();

        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);

        const margin = {
            top: parseFloat(styles.marginTop),
            right: parseFloat(styles.marginRight),
            bottom: parseFloat(styles.marginBottom),
            left: parseFloat(styles.marginLeft)
        };

        const padding = {
            top: parseFloat(styles.paddingTop),
            right: parseFloat(styles.paddingRight),
            bottom: parseFloat(styles.paddingBottom),
            left: parseFloat(styles.paddingLeft)
        };

        if (margin.top > 0) this.createSpacingLabel(`${margin.top}px`, rect.left + rect.width/2, rect.top - margin.top/2, 'margin');
        if (margin.right > 0) this.createSpacingLabel(`${margin.right}px`, rect.right + margin.right/2, rect.top + rect.height/2, 'margin');
        if (margin.bottom > 0) this.createSpacingLabel(`${margin.bottom}px`, rect.left + rect.width/2, rect.bottom + margin.bottom/2, 'margin');
        if (margin.left > 0) this.createSpacingLabel(`${margin.left}px`, rect.left - margin.left/2, rect.top + rect.height/2, 'margin');

        // Padding labels
        if (padding.top > 0) this.createSpacingLabel(`${padding.top}px`, rect.left + rect.width/2, rect.top + padding.top/2, 'padding');
        if (padding.right > 0) this.createSpacingLabel(`${padding.right}px`, rect.right - padding.right/2, rect.top + rect.height/2, 'padding');
        if (padding.bottom > 0) this.createSpacingLabel(`${padding.bottom}px`, rect.left + rect.width/2, rect.bottom - padding.bottom/2, 'padding');
        if (padding.left > 0) this.createSpacingLabel(`${padding.left}px`, rect.left + padding.left/2, rect.top + rect.height/2, 'padding');
    }

    createSpacingLabel(text, x, y, type) {
        const label = document.createElement('div');
        label.className = 'figmamod-spacing-label';

        const baseStyle = `
            position: fixed;
            transform: translate(-50%, -50%);
            background: ${type === 'margin' ? 'rgba(255, 149, 0, 0.9)' : 'rgba(52, 199, 89, 0.9)'};
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font: 10px/1 'Segoe UI', Arial, sans-serif;
            pointer-events: none;
            z-index: 2147483646;
            white-space: nowrap;
            visibility: hidden;
        `;

        label.style.cssText = baseStyle + `left: ${x}px; top: ${y}px;`;
        label.textContent = text;
        this.overlay.appendChild(label);

        const labelRect = label.getBoundingClientRect();
        const adjustedPos = this.getNonOverlappingPosition(x, y, labelRect.width, labelRect.height);
        label.style.cssText = baseStyle + `left: ${adjustedPos.x}px; top: ${adjustedPos.y}px; visibility: visible;`;

        this.spacingLabels.push(label);
    }

    clearSpacingLabels() {
        this.spacingLabels.forEach(label => {
            if (label && label.parentNode) label.remove();
        });
        this.spacingLabels = [];
    }

    // ==================== MOBILE VIEW  ====================

    toggleMobileView() {
        if (this.mobileViewport) {
            this.disableMobileView();
            return;
        }

        this.mobileViewport = document.createElement('div');
        this.mobileViewport.id = 'figmamod-mobile-view';
        this.mobileViewport.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 375px; height: 812px; background: white; border: 10px solid #333;
            border-radius: 30px; overflow: hidden; z-index: 2147483640;
            box-shadow: 0 0 50px rgba(0,0,0,0.5); pointer-events: auto;
        `;

        const iframe = document.createElement('iframe');
        iframe.src = window.location.href;
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute; top: -40px; right: -10px; width: 30px; height: 30px;
            background: #ff4444; color: white; border: none; border-radius: 50%;
            cursor: pointer; font-size: 14px; z-index: 2147483647;
        `;
        closeBtn.onclick = () => this.disableMobileView();

        const sizeLabel = document.createElement('div');
        sizeLabel.style.cssText = `
            position: absolute; bottom: -30px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.7); color: white; padding: 4px 12px;
            border-radius: 12px; font-size: 11px; font-family: 'Segoe UI', Arial, sans-serif;
        `;
        sizeLabel.textContent = '375 × 812 (iPhone X)';

        this.mobileViewport.appendChild(iframe);
        this.mobileViewport.appendChild(closeBtn);
        this.mobileViewport.appendChild(sizeLabel);
        document.body.appendChild(this.mobileViewport);

        document.body.style.overflow = 'hidden';

        this.showMeasureHint('Мобильный вид активирован (iPhone X: 375×812)');
    }

    disableMobileView() {
        if (this.mobileViewport) {
            this.mobileViewport.remove();
            this.mobileViewport = null;
        }
        document.body.style.overflow = '';
    }


    handleInspectMouseMove(e) {
        const element = document.elementFromPoint(e.clientX, e.clientY);
        if (!element || element === this.currentElement) return;

        this.currentElement = element;
        this.updateElementHighlight(element);
        this.showElementInfo(element, e.clientX, e.clientY);

        if (this.settings.showBoxModel) {
            this.showBoxModel(element);
        }

        if (this.settings.showSpacingLabels) {
            this.showSpacingLabels(element);
        }
    }

    rgbToHex(rgb) {
        if (!rgb) return '#000000';
        if (rgb.startsWith('#')) return rgb;

        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        }

        return rgb;
    }

    clearAll() {
        this.setMode('idle');
        this.measureElements = [];
        this.selectedElements = [];
        document.getElementById('figmamod-selected-element')?.remove();
        document.getElementById('figmamod-measure-hint')?.remove();
        document.getElementById('figmamod-palette-panel')?.remove();
        document.getElementById('figmamod-a11y-panel')?.remove();
        document.querySelectorAll('.figmamod-multi-guide').forEach(el => el.remove());
        this.clearBoxModel();
        this.clearSpacingLabels();
        this.clearMultiSelection();
        this.clearStateSimulation();
        this.disableMobileView();
        console.log('FigmaMod: все очищено');
    }
}
function initFigmaMod() {
    if (window.figmamodInstance) {
        return window.figmamodInstance;
    }

    try {
        window.figmamodInstance = new FigmaMod();
        console.log('FigmaMod успешно создан');
        return window.figmamodInstance;
    } catch (error) {
        console.error('Ошибка создания FigmaMod:', error);
        return null;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFigmaMod);
} else {
    setTimeout(initFigmaMod, 100);
}