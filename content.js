class FigmaMod {
    constructor() {
        this.isEnabled = true;
        this.mode = 'idle';
        this.settings = {
            showColorHex: true,
            showDimensions: true,
            showDistances: true,
            highlightColor: '#0D99FF',
            gridSize: 20,
            showGrid: false,
            showRulers: false
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

        // Определяем платформу
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
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!this.isEnabled) return;
            if (e.target.matches('input, textarea, select, button, [contenteditable="true"]')) return;

            const key = e.key.toLowerCase();

            if (key === 'v' || key === '1') {
                if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.setMode('inspect');
                }
            }

            if (key === 't') {
                if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.setMode('text');
                }
            }

            if (key === 'escape') {
                e.preventDefault();
                e.stopPropagation();
                this.setMode('idle');
                this.clearMeasureElements();
            }

            if (key === 'alt') {
                if (!this.isAltPressed) {
                    this.isAltPressed = true;
                    if (this.mode !== 'quick') {
                        this.previousMode = this.mode;
                        this.setMode('quick');
                    }
                }
            }

            if (key === 'g' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.toggleGrid();
            }

            if (key === 'r' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.toggleRulers();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (!this.isEnabled) return;

            if (e.key.toLowerCase() === 'alt' && this.isAltPressed) {
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

            console.log('Click event:', {
                mode: this.mode,
                isMeasureKey: this.isMeasureKey(e),
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey
            });

            if (this.mode === 'inspect' && this.isMeasureKey(e)) {
                e.preventDefault();
                e.stopPropagation();

                const element = document.elementFromPoint(e.clientX, e.clientY);
                console.log('Element clicked:', element);

                if (element) {
                    if (this.measureElements.length === 0) {
                        this.measureElements.push(element);
                        this.showElementSelected(element);
                        this.showMeasureHint(`Выберите второй элемент (${this.getMeasureKeyText()}+клик)`);
                        console.log('First element selected');
                    } else if (this.measureElements.length === 1) {
                        const firstElement = this.measureElements[0];
                        const secondElement = element;

                        console.log('Both elements selected:', firstElement, secondElement);

                        const rect1 = firstElement.getBoundingClientRect();
                        const rect2 = secondElement.getBoundingClientRect();

                        console.log('Rect1:', rect1);
                        console.log('Rect2:', rect2);

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
        console.log('showElementsDistance called');

        this.clearInfoLabels();
        this.clearDistanceLabel();
        document.getElementById('figmamod-selected-element')?.remove();

        // Создаем контейнер для линий
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

        // Вычисляем расстояния
        const horizontalDistance = Math.abs(rect2.left - (rect1.left + rect1.width));
        const verticalDistance = Math.abs(rect2.top - (rect1.top + rect1.height));

        console.log('Distances calculated:', { horizontalDistance, verticalDistance });

        // Горизонтальная линия
        if (horizontalDistance > 0) {
            const hLine = document.createElement('div');
            hLine.className = 'figmamod-measure-line';

            const y = (rect1.top + rect1.height/2 + rect2.top + rect2.height/2) / 2;
            const x1 = rect1.left + rect1.width;
            const x2 = rect2.left;
            const left = Math.min(x1, x2);
            const width = Math.abs(x2 - x1);

            hLine.style.cssText = `
                left: ${left}px;
                top: ${y - 1}px;
                width: ${width}px;
                height: 2px;
                background: #ff4444;
            `;
            linesContainer.appendChild(hLine);

            // Подпись
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

        // Вертикальная линия
        if (verticalDistance > 0) {
            const vLine = document.createElement('div');
            vLine.className = 'figmamod-measure-line';

            const x = (rect1.left + rect1.width/2 + rect2.left + rect2.width/2) / 2;
            const y1 = rect1.top + rect1.height;
            const y2 = rect2.top;
            const top = Math.min(y1, y2);
            const height = Math.abs(y2 - y1);

            vLine.style.cssText = `
                left: ${x - 1}px;
                top: ${top}px;
                width: 2px;
                height: ${height}px;
                background: #ff4444;
            `;
            linesContainer.appendChild(vLine);

            // Подпись
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

        // Добавляем центральную линию
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

        // Общее инфо
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
        infoLabel.innerHTML = `
            <div style="display: flex; gap: 20px;">
                <div>↔️ ${Math.round(horizontalDistance)}px</div>
                <div>↕️ ${Math.round(verticalDistance)}px</div>
            </div>
        `;
        linesContainer.appendChild(infoLabel);

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

        // Получаем информацию о тексте
        const fontSize = styles.fontSize;
        const lineHeight = styles.lineHeight;
        const fontFamily = styles.fontFamily.split(',')[0].replace(/['"]/g, '');
        const fontWeight = styles.fontWeight;
        const fontStyle = styles.fontStyle;
        const textColor = this.rgbToHex(styles.color);
        const textContent = element.textContent.trim().substring(0, 50) + (element.textContent.trim().length > 50 ? '...' : '');

        // Определяем насыщенность текста
        let weight = '';
        if (fontWeight === '400' || fontWeight === 'normal') weight = 'Regular';
        else if (fontWeight === '500') weight = 'Medium';
        else if (fontWeight === '600' || fontWeight === '700') weight = 'Bold';
        else if (fontWeight === '300') weight = 'Light';
        else weight = fontWeight;

        // Создаем единую панель со всей информацией
        const textPanel = document.createElement('div');
        textPanel.className = 'figmamod-text-panel';

        // Позиционируем панель рядом с курсором, но не за границами экрана
        let left = mouseX + 20;
        let top = mouseY - 20;

        // Корректировка, чтобы панель не выходила за правый край
        if (left + 300 > window.innerWidth) {
            left = mouseX - 320;
        }

        // Корректировка, чтобы панель не выходила за нижний край
        if (top + 250 > window.innerHeight) {
            top = mouseY - 250;
        }

        textPanel.style.left = left + 'px';
        textPanel.style.top = top + 'px';

        // Формируем содержимое в виде столбика
        textPanel.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Заголовок -->
                <div style="display: flex; align-items: center; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid #555;">
                    <span style="font-size: 16px;">📝</span>
                    <span style="font-weight: 600; color: ${this.settings.highlightColor};">Текстовый элемент</span>
                </div>
                
                <!-- Содержимое текста (если есть) -->
                ${textContent ? `
                    <div style="background: #2a2a2a; padding: 10px; border-radius: 6px; border-left: 3px solid ${this.settings.highlightColor}; word-break: break-word;">
                        <div style="color: #aaa; font-size: 10px; margin-bottom: 4px;">Содержимое:</div>
                        <div style="color: white; font-size: 12px;">"${textContent}"</div>
                    </div>
                ` : ''}
                
                <!-- Информация о шрифте столбиком -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <!-- Гарнитура -->
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #aaa;">Шрифт</span>
                        <span style="font-weight: 500; color: ${this.settings.highlightColor};">${fontFamily}</span>
                    </div>
                    
                    <!-- Размер / Интерлиньяж -->
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #aaa;">Размер / Интерлиньяж</span>
                        <span>${fontSize} / ${lineHeight}</span>
                    </div>
                    
                    <!-- Насыщенность / Стиль -->
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #aaa;">Стиль</span>
                        <span>${weight} ${fontStyle === 'italic' ? 'Курсив' : ''}</span>
                    </div>
                    
                    <!-- Цвет текста -->
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #aaa;">Цвет</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-block; width: 16px; height: 16px; background: ${styles.color}; border: 1px solid #666; border-radius: 4px;"></span>
                            <span style="font-family: monospace;">${textColor}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Дополнительная информация -->
                <div style="display: flex; flex-wrap: wrap; gap: 12px; padding-top: 8px; border-top: 1px solid #555; font-size: 11px; color: #888;">
                    ${styles.letterSpacing !== 'normal' ? `<span>Межбуквенный: ${styles.letterSpacing}</span>` : ''}
                    ${styles.textAlign !== 'start' ? `<span>Выравнивание: ${styles.textAlign}</span>` : ''}
                </div>
            </div>
        `;

        this.overlay.appendChild(textPanel);
        this.dimensionLabels.push(textPanel);

        // Подсветка элемента
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

        label.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
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

        label.style.pointerEvents = 'auto';
        label.style.cursor = 'pointer';
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

        this.overlay.appendChild(label);
        this.colorLabels.push(label);
    }

    createQuickLabel(text, x, y) {
        const label = document.createElement('div');
        label.className = 'figmamod-quick-label';

        label.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
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
        `;

        label.textContent = text;
        this.overlay.appendChild(label);
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
        document.getElementById('figmamod-selected-element')?.remove();
        document.getElementById('figmamod-measure-hint')?.remove();
        console.log('FigmaMod: все очищено');
    }
}

let figmamod = null;

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