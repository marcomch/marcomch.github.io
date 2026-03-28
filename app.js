'use strict';

// ====================== ESTADO DE LA APLICACIÓN ======================
// Agrupado en namespaces para evitar 40+ variables globales sueltas

const feed = {
    ws: null,
    running: false,
    connecting: false,
    asset: 'R_10',
    lastPrice: null,
    tickCount: 0,
    ticksCounter: 0,
    ticksPerMinute: 0,
    minuteTimer: null,
};

const charts = {
    digits: null,
    price: null,
    digitsPoints: [],
    pricePoints: [],
    digitsPos: 1,
    pricePos: 1,
    renderDigitsPending: false,
    renderPricePending: false,
};

const priceLevel = {
    history: [],
    digitHistory: [],
    current: 'mid',
    maxPrice: 0,
    minPrice: Infinity,
    greenCount: 0,
    lastMax: null,
    lastMin: null,
    infoPending: false,
    historyPending: false,
};

const trading = {
    derivWs: null,
    token: '',
    balance: 0,
    totalProfit: 0,
    wins: 0,
    losses: 0,
    totalTrades: 0,
    stake: 1.00,
    currentContract: null,
    isTrading: false,
};

const monitor = {
    activeTrade: null,
    interval: null,
    canvas: null,
    ctx: null,
    priceData: [],
    contractTicks: [],
};

const alerts = {
    soundEnabled: true,
    pushEnabled: true,
    audioCtx: null,
    gainNode: null,
};

const strategy = {
    buffer: [],
    paused: false,
    signalCalls: 0,
    signalPuts: 0,
    signalNone: 0,
};

const results = { list: [] };

// ====================== STOP WIN / STOP LOSS ======================
const stopLimits = {
    stopWin:  null,   // profit acumulado máximo (+) para parar con ganancia
    stopLoss: null,   // pérdida acumulada máxima (-) para parar con pérdida
    active: false,    // true = los límites están habilitados
    triggered: false, // true = ya se disparó un límite (requiere reset manual)
    triggeredBy: null // 'stopWin' | 'stopLoss'
};

// ====================== CACHÉ DOM ======================
const el = {};

const DURATION = 5;
const PRICE_HISTORY_LENGTH = 20;

// ====================== INICIALIZACIÓN ======================

window.onload = function () {
    cacheDOM();
    initCanvasJSChart();
    initPriceChart();
    initMonitorCanvas();
    updateTradingDisplay();
    updateStakeDisplay();
    startTicksPerMinuteCounter();
    initLevelHistory();
    initAudio();
    loadAlertSettings();
    requestPushPermission();
    initStopLimits();

    // Cargar token guardado
    try {
        const saved = localStorage.getItem('deriv_token');
        if (saved) document.getElementById('token-input').value = saved;
    } catch (e) {}

    document.getElementById('trading-stake').addEventListener('input', function () {
        trading.stake = parseFloat(this.value) || 1;
        updateStakeDisplay();
    });

    // Toggle visibilidad token
    document.getElementById('toggle-token-btn').addEventListener('click', () => {
        const inp  = document.getElementById('token-input');
        const icon = document.getElementById('toggle-token-icon');
        const isPassword = inp.type === 'password';
        inp.type      = isPassword ? 'text' : 'password';
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    // Enter en el input de token
    document.getElementById('token-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') conectarConToken();
    });
};

function cacheDOM() {
    const ids = [
        'price', 'current-digit', 'balance-amount', 'total-profit',
        'wins-count', 'losses-count', 'total-trades', 'win-rate',
        'last-trade', 'trade-status', 'digits-container', 'digit-count',
        'call-stake', 'put-stake', 'status-dot', 'status-text',
        'price-level-indicator', 'level-history', 'current-level-display',
        'max-price-display', 'min-price-display', 'green-digits-count',
        'last-max-digit', 'last-min-digit', 'green-digit-count-badge',
        'trade-monitor', 'monitor-status', 'monitor-chart',
        'ticks-remaining', 'chart-points-info', 'info-current-tick',
        'info-entry-price', 'info-current-price', 'info-price-difference',
        'info-percentage-change', 'info-elapsed-time', 'info-trade-state',
        'sound-alert-switch', 'sound-indicator', 'push-alert-switch', 'push-indicator',
        'asset-selector',
        // Estrategia
        'pattern-digits-row', 'blue-direction', 'red-direction',
        'blue-digits-display', 'red-digits-display',
        'strategy-signal-box', 'signal-icon', 'signal-text', 'signal-detail',
        'signals-history', 'signal-calls', 'signal-puts', 'signal-none',
        'filters-section',
        'filter1-item', 'filter1-icon', 'filter1-desc',
        'filter2-item', 'filter2-icon', 'filter2-desc',
        'filter3-item', 'filter3-icon', 'filter3-desc',
        'filter4-item', 'filter4-icon', 'filter4-desc',
        'filter5-item', 'filter5-icon', 'filter5-desc',
        'filter6-item', 'filter6-icon', 'filter6-desc',
    ];
    ids.forEach(id => {
        // Convierte 'some-id' → el.someId
        const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        el[key] = document.getElementById(id);
    });
}

// ====================== TOKEN ======================

window.conectarConToken = function () {
    const input   = document.getElementById('token-input');
    const errorEl = document.getElementById('token-error-msg');
    const btn     = document.getElementById('btn-connect-token');
    const token   = input.value.trim();

    errorEl.style.display = 'none';
    if (!token || token.length < 10) {
        errorEl.textContent = '⚠️ Ingresa un token válido.';
        errorEl.style.display = 'block';
        return;
    }

    trading.token = token;
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';

    const testWs = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
    testWs.onopen = () => testWs.send(JSON.stringify({ authorize: token }));

    testWs.onmessage = msg => {
        const data = JSON.parse(msg.data);
        testWs.close();

        if (data.error) {
            trading.token   = '';
            btn.disabled    = false;
            btn.innerHTML   = '<i class="fas fa-plug"></i> Conectar';
            errorEl.textContent = '❌ Token inválido: ' + data.error.message;
            errorEl.style.display = 'block';
            return;
        }

        if (data.authorize) {
            try { localStorage.setItem('deriv_token', token); } catch (e) {}

            const badge = document.getElementById('token-badge');
            badge.classList.remove('hidden');
            document.getElementById('token-badge-text').textContent =
                'Token: ' + token.substring(0, 4) + '...' + token.slice(-4);

            document.getElementById('token-modal-overlay').style.display = 'none';
            conectarDerivAPI();
            notify('¡Conectado!',
                'Cuenta: ' + data.authorize.loginid + ' | Balance: $' + parseFloat(data.authorize.balance).toFixed(2),
                'success');
        }
    };

    testWs.onerror = () => {
        testWs.close();
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-plug"></i> Conectar';
        errorEl.textContent = '❌ Error de conexión. Verifica tu internet.';
        errorEl.style.display = 'block';
    };
};

window.cambiarToken = function () {
    trading.token = '';
    if (trading.derivWs) { try { trading.derivWs.close(); } catch (e) {} trading.derivWs = null; }
    document.getElementById('token-input').value    = '';
    document.getElementById('token-error-msg').style.display = 'none';
    const btn = document.getElementById('btn-connect-token');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-plug"></i> Conectar';
    document.getElementById('token-modal-overlay').style.display = 'flex';
    document.getElementById('token-badge').classList.add('hidden');
};

// ====================== MONITOR CANVAS ======================

function initMonitorCanvas() {
    monitor.canvas = document.getElementById('monitor-canvas');
    if (!monitor.canvas) return;
    monitor.ctx = monitor.canvas.getContext('2d');
    resizeMonitorCanvas();
    window.addEventListener('resize', resizeMonitorCanvas);
}

function resizeMonitorCanvas() {
    if (!monitor.canvas || !el.monitorChart) return;
    monitor.canvas.width  = el.monitorChart.clientWidth;
    monitor.canvas.height = el.monitorChart.clientHeight;
    if (monitor.activeTrade && monitor.priceData.length > 0) drawMonitorChart();
}

// ====================== DIBUJO DEL MONITOR ======================

function drawMonitorChart() {
    const { ctx, canvas } = monitor;
    if (!ctx || !canvas || !monitor.priceData.length || !monitor.activeTrade) return;

    const w = canvas.width, h = canvas.height, pad = 20;
    const cw = w - pad * 2, ch = h - pad * 2;

    ctx.clearRect(0, 0, w, h);
    drawBg(w, h, pad, ch);

    const prices  = monitor.priceData.map(p => p.price);
    const entry   = monitor.activeTrade.entryPrice;
    const current = monitor.activeTrade.currentPrice;
    const minP    = prices.reduce((m, v) => v < m ? v : m, Math.min(entry, current));
    const maxP    = prices.reduce((m, v) => v > m ? v : m, Math.max(entry, current));
    const range   = Math.max(0.0001, maxP - minP);

    drawPLAreas(w, h, pad, ch, minP, range);
    drawRefLines(w, pad, ch, minP, range);
    drawPriceLine(w, pad, cw, ch, minP, range);
    drawEntryDot(pad, ch, entry, minP, range);
    drawCurrentDot(w, pad, cw, ch, current, minP, range);
    drawLegend(pad);

    if (el.chartPointsInfo) el.chartPointsInfo.textContent = `Ticks: ${monitor.priceData.length}/5`;
}

function drawBg(w, h, pad, ch) {
    const { ctx } = monitor;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(pad, pad, w - pad * 2, ch);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, w - pad * 2, ch);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
        const y = pad + i * ch / 5;
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
    }
}

function drawPLAreas(w, h, pad, ch, minP, range) {
    if (!monitor.activeTrade) return;
    const { ctx } = monitor;
    const entryY = pad + ch - ((monitor.activeTrade.entryPrice - minP) / range * ch);
    ctx.fillStyle = 'rgba(46,204,113,0.05)';
    ctx.fillRect(pad, pad, w - pad * 2, entryY - pad);
    ctx.fillStyle = 'rgba(231,76,60,0.05)';
    ctx.fillRect(pad, entryY, w - pad * 2, h - pad - entryY);
}

function drawRefLines(w, pad, ch, minP, range) {
    const { ctx } = monitor;
    const entryY = pad + ch - ((monitor.activeTrade.entryPrice - minP) / range * ch);
    ctx.strokeStyle = 'rgba(52,152,219,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(pad, entryY); ctx.lineTo(w - pad, entryY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(52,152,219,0.8)';
    ctx.font = '10px Arial';
    ctx.fillText('Entrada', w - pad - 50, entryY - 5);
}

function drawPriceLine(w, pad, cw, ch, minP, range) {
    const { ctx } = monitor;
    const n = monitor.priceData.length;
    if (n < 2) return;
    const color = monitor.activeTrade.isWinning ? 'rgba(46,204,113,0.8)' : 'rgba(231,76,60,0.8)';
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = pad + i * cw / (n - 1);
        const y = pad + ch - ((monitor.priceData[i].price - minP) / range * ch);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
        const x = pad + i * cw / (n - 1);
        const y = pad + ch - ((monitor.priceData[i].price - minP) / range * ch);
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.stroke();
    }
}

function drawEntryDot(pad, ch, entryPrice, minP, range) {
    const { ctx } = monitor;
    const x = pad, y = pad + ch - ((entryPrice - minP) / range * ch);
    ctx.fillStyle = 'rgba(52,152,219,1)'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(52,152,219,1)'; ctx.font = 'bold 12px Arial';
    ctx.fillText('E', x - 3, y + 4);
}

function drawCurrentDot(w, pad, cw, ch, currPrice, minP, range) {
    const { ctx } = monitor;
    const x     = w - pad;
    const y     = pad + ch - ((currPrice - minP) / range * ch);
    const color = monitor.activeTrade.isWinning ? 'rgba(46,204,113,1)' : 'rgba(231,76,60,1)';
    ctx.fillStyle = color; ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.fillText('A', x - 3, y + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + ch); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.font = 'bold 11px Arial';
    const xd = decimals(feed.asset);
    ctx.fillText(currPrice.toFixed(xd), x + 5, y);
}

function drawLegend(pad) {
    const { ctx } = monitor;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(pad, pad, 150, 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(pad, pad, 150, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 12px Arial';
    ctx.fillText('LEYENDA', pad + 50, pad + 15);
    ctx.fillStyle = 'rgba(52,152,219,1)';
    ctx.beginPath(); ctx.arc(pad + 10, pad + 30, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '10px Arial';
    ctx.fillText('Entrada', pad + 20, pad + 34);
    ctx.fillStyle = monitor.activeTrade.isWinning ? 'rgba(46,204,113,1)' : 'rgba(231,76,60,1)';
    ctx.beginPath(); ctx.arc(pad + 10, pad + 45, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Actual', pad + 20, pad + 49);
}

// ====================== AUDIO ======================

function initAudio() {
    try {
        alerts.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        alerts.gainNode = alerts.audioCtx.createGain();
        alerts.gainNode.connect(alerts.audioCtx.destination);
        alerts.gainNode.gain.value = 0.5;
    } catch (e) {
        alerts.soundEnabled = false;
        updateSoundSwitch();
    }
}

function playSound(type) {
    if (!alerts.soundEnabled || !alerts.audioCtx) return;
    try {
        const osc      = alerts.audioCtx.createOscillator();
        const envelope = alerts.audioCtx.createGain();
        osc.connect(envelope);
        envelope.connect(alerts.gainNode);
        osc.frequency.value = type === 'win' ? 880 : type === 'loss' ? 440 : 660;
        osc.type = 'sine';
        const t = alerts.audioCtx.currentTime;
        envelope.gain.setValueAtTime(0, t);
        envelope.gain.linearRampToValueAtTime(0.3, t + 0.1);
        envelope.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
    } catch (e) {}
}

window.testSound = function (type) {
    playSound(type);
    notify(type === 'win' ? 'Test Ganancia' : 'Test Pérdida',
           type === 'win' ? 'Sonido de alerta de ganancia' : 'Sonido de alerta de pérdida',
           type === 'win' ? 'success' : 'error');
};

// ====================== NOTIFICACIONES ======================

function requestPushPermission() {
    if (!('Notification' in window)) { alerts.pushEnabled = false; updatePushSwitch(); return; }
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        setTimeout(() => {
            Notification.requestPermission().then(p => {
                if (p !== 'granted') { alerts.pushEnabled = false; updatePushSwitch(); saveAlertSettings(); }
            });
        }, 3000);
    }
}

function notify(title, message, type = 'info') {
    if (alerts.pushEnabled && Notification.permission === 'granted') {
        const n = new Notification('Trading Manual - ' + title, {
            body: (type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️') + ' ' + message,
            icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            tag: 'trading-alert',
        });
        n.onclick = function () { window.focus(); this.close(); };
        setTimeout(() => n.close(), 5000);
    }
    notifyInternal(title, message, type);
}

function notifyInternal(title, message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const id = 'notif-' + Date.now();
    const iconClass = type === 'success' ? 'fa-check-circle' :
                      type === 'error'   ? 'fa-times-circle' :
                      type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';

    const div = document.createElement('div');
    div.className = `notification ${type}`;
    div.id = id;
    div.innerHTML = `
        <div class="notification-icon"><i class="fas ${iconClass}"></i></div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="closeNotif('${id}')">
            <i class="fas fa-times"></i>
        </button>`;
    container.insertBefore(div, container.firstChild);
    div.offsetHeight; // force reflow for CSS transition
    div.classList.add('show');
    setTimeout(() => closeNotif(id), 5000);

    const all = container.querySelectorAll('.notification');
    if (all.length > 5) all[all.length - 1].remove();
}

window.closeNotif = function (id) {
    const div = document.getElementById(id);
    if (!div) return;
    div.classList.remove('show');
    div.classList.add('hide');
    setTimeout(() => div.remove(), 300);
};

// ====================== CONFIGURACIÓN DE ALERTAS ======================

window.toggleSoundAlerts = function () {
    alerts.soundEnabled = !alerts.soundEnabled;
    updateSoundSwitch();
    saveAlertSettings();
    notifyInternal('Configuración',
        alerts.soundEnabled ? 'Alertas sonoras activadas' : 'Alertas sonoras desactivadas',
        alerts.soundEnabled ? 'success' : 'warning');
};

window.togglePushAlerts = function () {
    if (!('Notification' in window)) {
        notifyInternal('Error', 'Este navegador no soporta notificaciones push', 'error'); return;
    }
    if (Notification.permission === 'denied') {
        notifyInternal('Error', 'Permiso denegado. Habilítalo en configuración del navegador.', 'error'); return;
    }
    if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') {
                alerts.pushEnabled = true; updatePushSwitch(); saveAlertSettings();
                notifyInternal('Configuración', 'Notificaciones push activadas', 'success');
            }
        });
    } else {
        alerts.pushEnabled = !alerts.pushEnabled;
        updatePushSwitch();
        saveAlertSettings();
        notifyInternal('Configuración',
            alerts.pushEnabled ? 'Notificaciones push activadas' : 'Notificaciones push desactivadas',
            alerts.pushEnabled ? 'success' : 'warning');
    }
};

function updateSoundSwitch() {
    if (!el.soundAlertSwitch || !el.soundIndicator) return;
    el.soundAlertSwitch.classList.toggle('active', alerts.soundEnabled);
    el.soundIndicator.classList.toggle('active', alerts.soundEnabled);
}

function updatePushSwitch() {
    const on = alerts.pushEnabled && Notification.permission === 'granted';
    if (!el.pushAlertSwitch || !el.pushIndicator) return;
    el.pushAlertSwitch.classList.toggle('active', on);
    el.pushIndicator.classList.toggle('active', on);
}

function saveAlertSettings() {
    try {
        localStorage.setItem('alertSettings',
            JSON.stringify({ soundAlerts: alerts.soundEnabled, pushAlerts: alerts.pushEnabled }));
    } catch (e) {}
}

function loadAlertSettings() {
    try {
        const saved = localStorage.getItem('alertSettings');
        if (!saved) return;
        const s = JSON.parse(saved);
        alerts.soundEnabled = s.soundAlerts !== undefined ? s.soundAlerts : true;
        alerts.pushEnabled  = s.pushAlerts  !== undefined ? s.pushAlerts  : true;
        updateSoundSwitch();
        updatePushSwitch();
    } catch (e) {}
}

// ====================== DETECCIÓN DE NIVEL DE PRECIO ======================

function initLevelHistory() {
    priceLevel.history = Array(20).fill('mid');
    updateLevelHistoryDisplay();
}

function updatePriceLevel(price) {
    const num = parseFloat(price);
    priceLevel.history.push(num);
    if (priceLevel.history.length > PRICE_HISTORY_LENGTH) priceLevel.history.shift();
    if (priceLevel.history.length < 3) { priceLevel.current = 'mid'; return 'mid'; }

    priceLevel.maxPrice = priceLevel.history.reduce((m, v) => v > m ? v : m, -Infinity);
    priceLevel.minPrice = priceLevel.history.reduce((m, v) => v < m ? v : m, Infinity);

    if (num === priceLevel.maxPrice && num !== priceLevel.minPrice)      priceLevel.current = 'max';
    else if (num === priceLevel.minPrice && num !== priceLevel.maxPrice) priceLevel.current = 'min';
    else { priceLevel.current = 'mid'; priceLevel.greenCount++; }

    priceLevel.digitHistory.push(priceLevel.current);
    if (priceLevel.digitHistory.length > 20) priceLevel.digitHistory.shift();

    updateLevelDisplay();
    updateLevelHistoryDisplay();

    if (!priceLevel.infoPending) {
        priceLevel.infoPending = true;
        setTimeout(() => { updateLevelInfoPanel(); priceLevel.infoPending = false; }, 500);
    }

    return priceLevel.current;
}

function updateLevelDisplay() {
    if (!el.priceLevelIndicator) return;
    const labels  = { max: 'MÁXIMO', min: 'MÍNIMO', mid: 'MEDIO' };
    const classes = { max: 'level-max', min: 'level-min', mid: 'level-mid' };
    el.priceLevelIndicator.textContent = labels[priceLevel.current];
    el.priceLevelIndicator.className   = 'price-level-indicator ' + classes[priceLevel.current];
}

function updateLevelHistoryDisplay() {
    if (!el.levelHistory || priceLevel.historyPending) return;
    priceLevel.historyPending = true;
    setTimeout(() => {
        const frag = document.createDocumentFragment();
        for (const lvl of priceLevel.digitHistory) {
            const span = document.createElement('span');
            span.className   = 'level-history-badge history-' + lvl;
            span.textContent = lvl === 'max' ? 'M' : lvl === 'min' ? 'm' : '·';
            frag.appendChild(span);
        }
        el.levelHistory.innerHTML = '';
        el.levelHistory.appendChild(frag);
        priceLevel.historyPending = false;
    }, 300);
}

function updateLevelInfoPanel() {
    if (!el.currentLevelDisplay) return;
    const labels = { max: 'MÁXIMO', min: 'MÍNIMO', mid: 'MEDIO' };
    const colors = { max: '#3498db', min: '#e74c3c', mid: '#2ecc71' };
    el.currentLevelDisplay.textContent = labels[priceLevel.current];
    el.currentLevelDisplay.style.color = colors[priceLevel.current];

    if (priceLevel.history.length > 0) {
        const xd = decimals(feed.asset);
        if (el.maxPriceDisplay) el.maxPriceDisplay.textContent = priceLevel.maxPrice.toFixed(xd);
        if (el.minPriceDisplay) el.minPriceDisplay.textContent = priceLevel.minPrice.toFixed(xd);
    }
    if (el.greenDigitsCount)  el.greenDigitsCount.textContent  = priceLevel.greenCount;
    if (priceLevel.lastMax !== null && el.lastMaxDigit) {
        el.lastMaxDigit.textContent = priceLevel.lastMax;
        el.lastMaxDigit.style.color = '#3498db';
    }
    if (priceLevel.lastMin !== null && el.lastMinDigit) {
        el.lastMinDigit.textContent = priceLevel.lastMin;
        el.lastMinDigit.style.color = '#e74c3c';
    }
}

function updateDigitBadgesWithLevel(digit, level) {
    const first = el.digitsContainer ? el.digitsContainer.firstElementChild : null;
    if (!first) return;
    first.classList.remove('max-digit', 'min-digit', 'mid-digit');
    first.classList.add(level + '-digit');
    if (level === 'max') priceLevel.lastMax = digit;
    if (level === 'min') priceLevel.lastMin = digit;
}

// ====================== UI ======================

window.closeAllModals = function () {
    document.getElementById('overlay').style.display       = 'none';
    document.getElementById('result-panel').style.display  = 'none';
};

window.closeResultPanel = function () {
    document.getElementById('result-panel').style.display  = 'none';
    document.getElementById('overlay').style.display       = 'none';
};

window.adjustStake = function (amount) {
    trading.stake = Math.min(10000, Math.max(0.1, trading.stake + amount));
    const inp = document.getElementById('trading-stake');
    if (inp) inp.value = trading.stake.toFixed(2);
    updateStakeDisplay();
};

function updateStakeDisplay() {
    if (el.callStake) el.callStake.textContent = `$${trading.stake.toFixed(2)}`;
    if (el.putStake)  el.putStake.textContent  = `$${trading.stake.toFixed(2)}`;
}

function updateConnectionStatus(text, color) {
    if (el.statusText) { el.statusText.textContent = text; el.statusText.style.color = color; }
    if (el.statusDot)  el.statusDot.style.backgroundColor = color;
}

// ====================== CANVASJS ======================

function initCanvasJSChart() {
    charts.digits = new CanvasJS.Chart('chartContainer', {
        animationEnabled: false,
        theme: 'light2',
        title: { text: '' },
        toolTip: { enabled: true, animationEnabled: true, borderColor: '#ccc', fontColor: '#000', content: '{y}' },
        axisX: { includeZero: false, labelFontSize: 0, gridThickness: 0, tickLength: 0, lineThickness: 1 },
        axisY: {
            stripLines: [{ value: 0, thickness: 1, color: '#ccc' }],
            includeZero: false, labelFontSize: 0, gridThickness: 0, tickLength: 0, lineThickness: 1,
            minimum: -10, maximum: 10,
        },
        data: [{ type: 'line', lineColor: '#ccc', lineThickness: 2, markerType: 'none', dataPoints: charts.digitsPoints }],
    });
    charts.digits.render();
}

function initPriceChart() {
    charts.price = new CanvasJS.Chart('priceChartContainer', {
        animationEnabled: false,
        theme: 'light2',
        title: { text: '' },
        toolTip: { enabled: true, animationEnabled: true, borderColor: '#ccc', fontColor: '#000', content: '{y}' },
        axisX: { includeZero: false, labelFontSize: 0, gridThickness: 0, tickLength: 0, lineThickness: 1 },
        axisY: { includeZero: false, labelFontSize: 0, gridThickness: 0, tickLength: 0, lineThickness: 1 },
        data: [{ type: 'line', lineColor: '#ccc', lineThickness: 2, markerType: 'none', dataPoints: charts.pricePoints }],
    });
    charts.price.render();
}

function updateDigitsChart(digit, wentUp, processedDigit) {
    if (!charts.digits) return;
    const y = wentUp ? parseFloat(processedDigit) : -parseFloat(processedDigit);

    let maxY = y, minY = y;
    for (const p of charts.digitsPoints) {
        if (p.y > maxY) maxY = p.y;
        if (p.y < minY) minY = p.y;
    }
    const isExtreme   = y === maxY || y === minY || charts.digitsPoints.length === 0;
    const markerColor = y === maxY ? '#29abe2' : y === minY ? '#c03' : 'black';

    charts.digitsPoints.push({
        x: charts.digitsPos++, y,
        indexLabel: Math.abs(processedDigit).toString(),
        indexLabelFontWeight: 'bold', indexLabelFontSize: 13,
        indexLabelFontColor: wentUp ? '#29abe2' : '#c03',
        markerSize: isExtreme ? 6 : 3, markerType: 'circle',
        markerColor, markerBorderColor: '#ccc',
    });

    if (charts.digitsPoints.length > 20) {
        charts.digitsPoints.shift();
        const base = charts.digitsPos - 20;
        charts.digitsPoints.forEach((p, i) => p.x = base + i);
    }

    if (!charts.renderDigitsPending) {
        charts.renderDigitsPending = true;
        setTimeout(() => {
            charts.digits.options.data[0].dataPoints = charts.digitsPoints;
            charts.digits.render();
            charts.renderDigitsPending = false;
        }, 200);
    }
}

function updatePriceChart(price, digit, wentUp) {
    if (!charts.price) return;
    const xd  = decimals(feed.asset);
    const num = parseFloat(parseFloat(price).toFixed(xd));

    charts.pricePoints.push({
        x: charts.pricePos++, y: num,
        indexLabel: digit.toString(),
        indexLabelFontWeight: 'bold', indexLabelFontSize: 13,
        indexLabelFontColor: wentUp ? '#29abe2' : '#c03',
        markerSize: 3, markerType: 'circle',
        markerColor: 'black', markerBorderColor: '#ccc',
    });

    if (charts.pricePoints.length > 20) {
        charts.pricePoints.shift();
        const base = charts.pricePos - 20;
        charts.pricePoints.forEach((p, i) => p.x = base + i);
    }

    if (charts.pricePoints.length > 1) {
        let mn = Infinity, mx = -Infinity;
        for (const p of charts.pricePoints) {
            if (p.y < mn) mn = p.y;
            if (p.y > mx) mx = p.y;
        }
        const rng = mx - mn;
        charts.price.options.axisY.minimum = mn - rng * 0.1;
        charts.price.options.axisY.maximum = mx + rng * 0.1;
    }

    if (!charts.renderPricePending) {
        charts.renderPricePending = true;
        setTimeout(() => {
            charts.price.options.data[0].dataPoints = charts.pricePoints;
            charts.price.render();
            charts.renderPricePending = false;
        }, 200);
    }
}

window.clearChart = function () {
    charts.digitsPoints = [];
    charts.digitsPos    = 1;
    priceLevel.digitHistory = [];
    const container = el.digitsContainer;
    if (container) container.innerHTML = '';
    if (el.digitCount) el.digitCount.textContent = '0';
    if (charts.digits) { charts.digits.options.data[0].dataPoints = []; charts.digits.render(); }
};

window.clearPriceChart = function () {
    charts.pricePoints   = [];
    charts.pricePos      = 1;
    priceLevel.history   = [];
    priceLevel.greenCount = 0;
    priceLevel.lastMax   = priceLevel.lastMin = null;
    priceLevel.digitHistory = [];
    initLevelHistory();
    updateLevelInfoPanel();
    if (charts.price) {
        charts.price.options.data[0].dataPoints = [];
        delete charts.price.options.axisY.minimum;
        delete charts.price.options.axisY.maximum;
        charts.price.render();
    }
};

// ====================== MONITOR DE OPERACIÓN ======================

function startTradeMonitor(contractId, tradeType, entryPrice, entryPriceDisplayed, entryTime) {
    monitor.activeTrade = {
        id: contractId, type: tradeType,
        entryPrice, entryPriceDisplayed,
        currentPrice: entryPrice,
        startTime: entryTime,
        ticksRemaining: 5, currentTickIndex: 1,
        isWinning: false, profitLoss: 0,
    };

    monitor.contractTicks = [{ price: entryPrice, timestamp: entryTime.getTime(), tick_index: 1 }];
    monitor.priceData     = [{ price: entryPrice, timestamp: entryTime.getTime() }];

    el.tradeMonitor.classList.remove('hidden');
    refreshMonitorUI();
    if (monitor.interval) { clearInterval(monitor.interval); monitor.interval = null; }

    notify('Operación Iniciada',
        `${tradeType} @ $${entryPrice.toFixed(4)} (ID: ${contractId.substring(0, 8)}...)`, 'info');
    resizeMonitorCanvas();
}

function refreshMonitorUI() {
    if (!monitor.activeTrade) return;
    const xd   = decimals(feed.asset);
    const diff = monitor.activeTrade.currentPrice - monitor.activeTrade.entryPrice;
    const pct  = (diff / monitor.activeTrade.entryPrice) * 100;
    const win  = monitor.activeTrade.type === 'CALL' ? diff > 0 : diff < 0;

    monitor.activeTrade.isWinning  = win;
    monitor.activeTrade.profitLoss = diff;

    updateMonitorStatus(win);
    updateMonitorInfoPanel(monitor.activeTrade.entryPrice, monitor.activeTrade.currentPrice, diff, pct, xd);

    if (el.ticksRemaining) {
        el.ticksRemaining.textContent = `${monitor.activeTrade.ticksRemaining} ticks`;
        el.ticksRemaining.style.color = monitor.activeTrade.ticksRemaining <= 2 ? 'var(--danger-color)' :
                                        monitor.activeTrade.ticksRemaining <= 3 ? 'var(--warning-color)' : '';
    }
    if (el.infoCurrentTick) el.infoCurrentTick.textContent = `${monitor.activeTrade.currentTickIndex || 0}/5`;

    drawMonitorChart();
}

function updateMonitorInfoPanel(entryPrice, currentPrice, diff, pct, xd) {
    if (!el.infoEntryPrice) return;
    el.infoEntryPrice.textContent    = entryPrice.toFixed(xd);
    el.infoCurrentPrice.textContent  = currentPrice.toFixed(xd);
    el.infoCurrentPrice.className    = `monitor-info-value ${diff >= 0 ? 'positive' : 'negative'}`;
    el.infoPriceDifference.innerHTML = `${diff.toFixed(xd)}<span class="profit-indicator ${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? '+' : ''}${diff.toFixed(xd)}</span>`;
    el.infoPriceDifference.className = `monitor-info-value ${diff >= 0 ? 'positive' : 'negative'}`;
    el.infoPercentageChange.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(4)}%`;
    el.infoPercentageChange.className   = `monitor-info-value ${pct >= 0 ? 'positive' : 'negative'}`;
    el.infoTradeState.textContent = diff >= 0 ? 'GANANDO' : 'PERDIENDO';
    el.infoTradeState.className   = `monitor-info-value ${diff >= 0 ? 'positive' : 'negative'}`;
}

function updateMonitorWithTicks(realTicks) {
    if (!monitor.activeTrade || !realTicks.length) return;
    const last = realTicks[realTicks.length - 1];
    monitor.activeTrade.currentPrice     = last.price;
    monitor.activeTrade.ticksRemaining   = 5 - last.tick_index;
    monitor.activeTrade.currentTickIndex = last.tick_index;

    monitor.priceData = realTicks.map(t => ({ price: t.price, timestamp: t.timestamp }));

    if (el.infoCurrentTick) el.infoCurrentTick.textContent = `${last.tick_index}/5`;

    const diff = monitor.activeTrade.currentPrice - monitor.activeTrade.entryPrice;
    const pct  = (diff / monitor.activeTrade.entryPrice) * 100;
    const win  = monitor.activeTrade.type === 'CALL' ? diff > 0 : diff < 0;
    monitor.activeTrade.isWinning  = win;
    monitor.activeTrade.profitLoss = diff;

    updateMonitorStatus(win);
    updateMonitorInfoPanel(monitor.activeTrade.entryPrice, monitor.activeTrade.currentPrice, diff, pct, decimals(feed.asset));
    updateElapsedTime();
    drawMonitorChart();
}

function updateElapsedTime() {
    if (!monitor.activeTrade || !el.infoElapsedTime) return;
    const s = Math.floor((Date.now() - monitor.activeTrade.startTime) / 1000);
    el.infoElapsedTime.textContent =
        String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function updateMonitorStatus(isWinning) {
    if (!el.monitorStatus) return;
    el.monitorStatus.className = 'monitor-status ' + (isWinning ? 'winning' : 'losing');
    el.monitorStatus.innerHTML = `<i class="fas fa-circle"></i><span>${isWinning ? 'GANANDO' : 'PERDIENDO'}</span>`;
    if (el.monitorChart) {
        el.monitorChart.style.backgroundColor = isWinning ? 'rgba(46,204,113,0.05)' : 'rgba(231,76,60,0.05)';
        el.monitorChart.style.borderColor      = isWinning ? 'rgba(46,204,113,0.2)'  : 'rgba(231,76,60,0.2)';
    }
}

function stopTradeMonitor() {
    if (monitor.interval) { clearInterval(monitor.interval); monitor.interval = null; }
    setTimeout(() => { if (el.tradeMonitor) el.tradeMonitor.classList.add('hidden'); }, 3000);
    monitor.activeTrade   = null;
    monitor.contractTicks = [];
}

// ====================== TRADING ======================

window.executeTrade = function (type) {
    if (!feed.running)     { alert('⚠️ Primero debes conectar el feed de precios'); return; }
    if (trading.isTrading) { alert('⏳ Ya hay una operación en curso. Espera a que termine.'); return; }
    if (trading.stake <= 0) { alert('❌ El monto a operar debe ser mayor a 0'); return; }
    if (trading.stake > trading.balance) { alert('❌ Saldo insuficiente'); return; }

    trading.isTrading = true;
    el.tradeStatus.textContent = 'OPERANDO...';
    el.tradeStatus.style.color = '#f39c12';
    operarAutomatico(type === 'CALL' ? 'UP' : 'DOWN', trading.stake);
};

function procesarResultado(ganancia) {
    trading.isTrading = false;
    stopTradeMonitor();

    // El balance real es actualizado por el evento data.balance de la API de Deriv.
    // NO se ajusta manualmente aquí para evitar doble conteo.
    trading.totalProfit += ganancia;
    trading.totalTrades++;
    ganancia > 0 ? trading.wins++ : trading.losses++;

    // Verificar límites de Stop Win / Stop Loss
    checkStopLimits();

    // Si un límite fue disparado, NO continuar con el flujo normal
    if (stopLimits.triggered) {
        updateTradingDisplay();
        if (el.winRate) el.winRate.textContent =
            `${trading.totalTrades > 0 ? Math.round(trading.wins / trading.totalTrades * 100) : 0}%`;
        if (ganancia > 0) {
            notify('¡Operación Ganadora!', `+$${ganancia.toFixed(2)} | Balance: $${trading.balance.toFixed(2)}`, 'success');
            playSound('win');
        } else {
            notify('Operación Perdedora', `-$${Math.abs(ganancia).toFixed(2)} | Balance: $${trading.balance.toFixed(2)}`, 'error');
            playSound('loss');
        }
        el.tradeStatus.textContent = 'DETENIDO';
        el.tradeStatus.style.color = '#e74c3c';
        return;
    }

    if (el.lastTrade) {
        el.lastTrade.innerHTML = ganancia > 0
            ? `<span style="color:#27ae60">CALL +$${ganancia.toFixed(2)}</span>`
            : `<span style="color:#e74c3c">PUT -$${Math.abs(ganancia).toFixed(2)}</span>`;
    }

    updateTradingDisplay();
    if (el.winRate) el.winRate.textContent =
        `${trading.totalTrades > 0 ? Math.round(trading.wins / trading.totalTrades * 100) : 0}%`;

    el.tradeStatus.textContent = 'LISTO';
    el.tradeStatus.style.color = '#27ae60';

    if (ganancia > 0) {
        notify('¡Operación Ganadora!', `+$${ganancia.toFixed(2)} | Balance: $${trading.balance.toFixed(2)}`, 'success');
        playSound('win');
    } else {
        notify('Operación Perdedora', `-$${Math.abs(ganancia).toFixed(2)} | Balance: $${trading.balance.toFixed(2)}`, 'error');
        playSound('loss');
    }

    // Reanudar estrategia
    strategy.paused = false;
    strategy.buffer = [];
    setStrategyStatusBar('resumed', 'Resultado recibido — Buscando nuevo patrón');
    notifyInternal('🔍 Análisis reanudado', 'Buscando nuevo patrón de 5 dígitos...', 'success');
}

function updateTradingDisplay() {
    if (el.balanceAmount) el.balanceAmount.textContent = `$${trading.balance.toFixed(2)}`;
    if (el.totalProfit) {
        el.totalProfit.textContent = `$${trading.totalProfit > 0 ? '+' : ''}${trading.totalProfit.toFixed(2)}`;
        el.totalProfit.style.color = trading.totalProfit >= 0 ? '#27ae60' : '#e74c3c';
    }
    if (el.winsCount)     el.winsCount.textContent     = trading.wins;
    if (el.lossesCount)   el.lossesCount.textContent   = trading.losses;
    if (el.totalTrades)   el.totalTrades.textContent   = trading.totalTrades;

    const inp = document.getElementById('trading-stake');
    if (inp) inp.style.borderColor = parseFloat(inp.value) > trading.balance ? '#e74c3c' : '';

    // Sincronizar profit en el panel de stop limits
    updateStopLimitsUI();
}

function mostrarResultadoOperacion(profit, status, contractId) {
    const content = document.getElementById('result-content');
    if (!content) return;

    results.list.unshift({ profit, status, contractId, time: new Date().toLocaleTimeString(), balance: trading.balance });
    if (results.list.length > 5) results.list.pop();

    const frag = document.createDocumentFragment();
    for (const r of results.list) {
        const div = document.createElement('div');
        div.className = 'result-section';
        div.style.cssText = `border:2px solid ${r.profit > 0 ? '#27ae60' : '#e74c3c'};border-radius:8px;padding:15px;margin-top:8px;background:rgba(255,255,255,0.04)`;
        div.innerHTML = `
            <div class="result-section-title" style="color:${r.profit > 0 ? '#27ae60' : '#e74c3c'};font-size:1.1rem;margin-bottom:10px;">
                <i class="fas fa-${r.profit > 0 ? 'trophy' : 'times-circle'}"></i>
                ${r.profit > 0 ? 'OPERACIÓN GANADORA ✅' : 'OPERACIÓN PERDEDORA ❌'}
            </div>
            <div class="info-line"><span style="color:#95a5a6;">Contract ID:</span><span style="font-family:monospace;">${r.contractId}</span></div>
            <div class="info-line"><span style="color:#95a5a6;">Estado:</span><span>${r.status}</span></div>
            <div class="info-line"><span style="color:#95a5a6;">Resultado:</span>
                <strong style="color:${r.profit > 0 ? '#27ae60' : '#e74c3c'};font-size:1.2rem;">
                    $${r.profit > 0 ? '+' : ''}${r.profit.toFixed(2)}
                </strong>
            </div>
            <div class="info-line"><span style="color:#95a5a6;">Hora:</span><span>${r.time}</span></div>
            <div class="info-line"><span style="color:#95a5a6;">Nuevo Balance:</span>
                <strong style="color:#3498db;font-size:1.1rem;">$${r.balance.toFixed(2)}</strong>
            </div>`;
        frag.appendChild(div);
    }
    content.innerHTML = '';
    content.appendChild(frag);

    document.getElementById('result-panel').style.display = 'block';
    document.getElementById('overlay').style.display      = 'block';
}

// ====================== SISTEMA DE TICKS ======================

function startTicksPerMinuteCounter() {
    if (feed.minuteTimer) clearInterval(feed.minuteTimer);
    feed.minuteTimer = setInterval(() => {
        feed.ticksPerMinute = feed.ticksCounter;
        feed.ticksCounter   = 0;
    }, 60000);
}

function updateDigitsContainer(digit, wentUp, level) {
    if (el.digitCount)         el.digitCount.textContent         = ++feed.tickCount;
    if (el.greenDigitCountBadge) el.greenDigitCountBadge.textContent = priceLevel.greenCount;

    if (!el.digitsContainer) return;
    const span = document.createElement('span');
    let cls = wentUp ? 'digit-badge digit-blue' : 'digit-badge digit-red';
    cls += level === 'max' ? ' max-digit' : level === 'min' ? ' min-digit' : ' mid-digit';
    span.className   = cls;
    span.textContent = digit;
    el.digitsContainer.insertBefore(span, el.digitsContainer.firstChild);
    while (el.digitsContainer.children.length > 10) {
        el.digitsContainer.removeChild(el.digitsContainer.lastChild);
    }
}

// ====================== PROCESAMIENTO DE PRECIOS ======================

function decimals(asset) {
    return { R_100: 2, R_10: 3, R_25: 3, R_50: 4, R_75: 4, RDBEAR: 4, RDBULL: 4, frxEURUSD: 5, frxEURJPY: 3 }[asset] || 2;
}

function isForex(asset) {
    return asset === 'frxEURUSD' || asset === 'frxEURJPY';
}

function extractDigit(price) {
    const xd  = decimals(feed.asset);
    const fmt = parseFloat(price).toFixed(xd);
    if (isForex(feed.asset)) {
        const parts = fmt.split('.');
        return parseInt(parts[1] ? parts[1].slice(-1) : '0');
    }
    return parseInt(fmt.slice(-1));
}

function procesarDigito010(digitActual, digitAnterior, wentUp) {
    if (digitActual !== 0) return wentUp ? parseFloat(digitActual) : -parseFloat(digitActual);
    if (digitAnterior > 5) return wentUp ? 10 : -10;
    return 0;
}

function determineTrend(currentPrice, lastPrice) {
    if (lastPrice === null) return true;
    const xd = decimals(feed.asset);
    return parseFloat(parseFloat(currentPrice).toFixed(xd)) >= parseFloat(parseFloat(lastPrice).toFixed(xd));
}

function updateDigit(price, wentUp) {
    const xd             = decimals(feed.asset);
    const formattedPrice = parseFloat(price).toFixed(xd);
    const digit          = extractDigit(price);
    const level          = updatePriceLevel(formattedPrice);

    const prevDigit      = priceLevel.digitHistory.length > 0
        ? priceLevel.digitHistory[priceLevel.digitHistory.length - 1] : null;
    const processedVal   = procesarDigito010(digit, prevDigit, wentUp);

    updateDigitsChart(digit, wentUp, Math.abs(processedVal));
    updatePriceChart(price, digit, wentUp);
    updateDigitsContainer(digit, wentUp, level);
    updateDigitBadgesWithLevel(digit, level);

    feed.ticksCounter++;
    feed.lastPrice = price;

    feedStrategyDigit(Math.abs(processedVal), wentUp);

    requestAnimationFrame(() => {
        if (el.currentDigit) {
            el.currentDigit.textContent = digit;
            el.currentDigit.className   = 'current-digit ' + (wentUp ? 'up' : 'down');
            if (level === 'mid') el.currentDigit.classList.add('digit-green');
        }
        if (el.price) el.price.textContent = formattedPrice;
    });
}

// ====================== WEBSOCKET: FEED DE PRECIOS ======================

window.startFeed = function () {
    if (feed.running || feed.connecting) return;
    feed.asset = el.assetSelector ? el.assetSelector.value : 'R_10';
    updateConnectionStatus('Conectando...', '#f39c12');
    feed.connecting = true;

    feed.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    feed.ws.binaryType = 'arraybuffer';

    feed.ws.onopen = () => {
        feed.connecting = false;
        feed.ws.send(JSON.stringify({ ticks: feed.asset, subscribe: 1 }));
        feed.running = true;
        updateConnectionStatus('Conectado', '#27ae60');
    };

    feed.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.tick) {
            const price  = parseFloat(data.tick.quote).toFixed(6);
            const wentUp = determineTrend(price, feed.lastPrice);
            updateDigit(price, wentUp);
        }
    };

    feed.ws.onclose = () => {
        feed.running    = false;
        feed.connecting = false;
        updateConnectionStatus('Desconectado', '#e74c3c');
        if (!feed.manualStop) {
            setTimeout(() => { if (!feed.running && !feed.connecting) window.startFeed(); }, 5000);
        }
    };

    feed.ws.onerror = () => {
        feed.connecting = false;
        updateConnectionStatus('Error de conexión', '#e74c3c');
    };
};

window.stopFeed = function () {
    feed.manualStop = true;
    if (feed.ws) { feed.ws.onclose = null; feed.ws.close(); }
    feed.running    = false;
    feed.connecting = false;
    updateConnectionStatus('Desconectado', '#e74c3c');
    setTimeout(() => { feed.manualStop = false; }, 100);
};

// ====================== DERIV API ======================

function operarAutomatico(signal, stake) {
    if (!trading.derivWs || trading.derivWs.readyState !== WebSocket.OPEN) {
        conectarDerivAPI();
        setTimeout(() => operarAutomatico(signal, stake), 3000);
        return;
    }

    const symbol = el.assetSelector ? el.assetSelector.value : 'R_10';
    trading.derivWs.send(JSON.stringify({
        buy: 1,
        price: stake,
        parameters: {
            amount: stake,
            basis: 'stake',
            contract_type: signal === 'UP' ? 'CALL' : 'PUT',
            currency: 'USD',
            duration: DURATION,
            duration_unit: 't',
            symbol,
        },
    }));
}

function conectarDerivAPI() {
    if (!trading.token) return;

    trading.derivWs = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    trading.derivWs.onopen = () => {
        trading.derivWs.send(JSON.stringify({ authorize: trading.token }));
    };

    trading.derivWs.onmessage = msg => {
        const data = JSON.parse(msg.data);

        if (data.authorize) {
            trading.derivWs.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        }

        if (data.buy && data.buy.contract_id) {
            const contractId = data.buy.contract_id;
            const stake      = parseFloat(data.buy.buy_price);
            trading.currentContract = { contractId, stake, timestamp: Date.now(), status: 'open' };
            // El balance es actualizado por el evento data.balance de la API; no se ajusta manualmente.
            updateTradingDisplay();
            trading.derivWs.send(JSON.stringify({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 }));
        }

        if (data.proposal_open_contract) {
            const contract = data.proposal_open_contract;

            if (contract.contract_id === trading.currentContract?.contractId && !monitor.activeTrade && contract.entry_tick) {
                startTradeMonitor(
                    contract.contract_id,
                    contract.contract_type,
                    parseFloat(contract.entry_tick),
                    parseFloat(contract.entry_tick_displayed),
                    new Date(contract.entry_tick_time * 1000)
                );
            }

            if (contract.tick_stream && contract.tick_stream.length > 0 && monitor.activeTrade && monitor.activeTrade.id === contract.contract_id) {
                const ticks = contract.tick_stream.map(t => ({
                    price: parseFloat(t.tick),
                    timestamp: t.tick_time * 1000,
                    tick_index: t.tick_count || t.tick_index || 1,
                }));
                if (ticks.length > 0) updateMonitorWithTicks(ticks);
            }

            if (contract.is_sold) {
                const profit     = parseFloat(contract.profit);
                const exitTick   = parseFloat(contract.exit_tick);
                const contractId = contract.contract_id;

                if (monitor.activeTrade && monitor.activeTrade.id === contractId) {
                    monitor.activeTrade.currentPrice = exitTick;
                    monitor.activeTrade.profitLoss   = profit;
                    monitor.activeTrade.isWinning    = profit > 0;
                    monitor.contractTicks.push({ price: exitTick, timestamp: Date.now(), tick_index: 5 });
                    updateMonitorWithTicks(monitor.contractTicks);
                }

                const savedStatus = contract.status;
                setTimeout(() => {
                    procesarResultado(profit);
                    mostrarResultadoOperacion(profit, savedStatus, contractId);
                }, 0);

                trading.derivWs.send(JSON.stringify({ proposal_open_contract: 0, contract_id: contractId, subscribe: 0 }));
                trading.currentContract = null;
            }
        }

        if (data.balance) {
            trading.balance = parseFloat(data.balance.balance);
            updateTradingDisplay();
        }

        if (data.error) {
            if (data.error.code === 'ContractBuyValidation' || data.error.code === 'InvalidContract') {
                // El balance es manejado por la API; no se ajusta manualmente.
                trading.isTrading = false;
                el.tradeStatus.textContent = 'ERROR';
                el.tradeStatus.style.color = '#e74c3c';
                stopTradeMonitor();
                setTimeout(() => { el.tradeStatus.textContent = 'LISTO'; el.tradeStatus.style.color = '#27ae60'; }, 3000);
                trading.currentContract = null;
                updateTradingDisplay();
            }
        }
    };

    trading.derivWs.onerror = () => {};

    trading.derivWs.onclose = () => {
        trading.currentContract = null;
        if (trading.token) setTimeout(conectarDerivAPI, 5000);
    };
}

// ====================== ESTRATEGIA CARTESIANA ======================

function feedStrategyDigit(digitValue, isBlue) {
    strategy.buffer.push({ value: digitValue, blue: isBlue });
    if (strategy.buffer.length > 5) strategy.buffer.shift();
    if (strategy.paused) return;
    runStrategyAnalysis();
}

function runStrategyAnalysis() {
    const patternEl = el.patternDigitsRow;
    if (!patternEl) return;

    const buf = strategy.buffer.slice(-5);

    // Renderizar patrón actual
    patternEl.innerHTML = '';
    if (buf.length < 5) {
        patternEl.innerHTML = `<div class="pattern-placeholder">Esperando ${5 - buf.length} dígito(s) más...</div>`;
    } else {
        for (const d of buf) {
            const span = document.createElement('span');
            span.className   = d.blue ? 'pattern-digit-badge blue' : 'pattern-digit-badge red';
            span.textContent = d.value;
            patternEl.appendChild(span);
        }
    }

    if (buf.length < 5) {
        resetFilters();
        setSignalUI('none', 'ESPERANDO', `Necesito ${5 - buf.length} dígito(s) más`, false);
        if (el.blueDigitsDisplay) el.blueDigitsDisplay.textContent = '-';
        if (el.redDigitsDisplay)  el.redDigitsDisplay.textContent  = '-';
        if (el.blueDirection)     el.blueDirection.textContent      = '—';
        if (el.redDirection)      el.redDirection.textContent       = '—';
        return;
    }

    const blues = buf.filter(d =>  d.blue);
    const reds  = buf.filter(d => !d.blue);

    // Proporción 3:2
    const esCALL = reds.length === 3 && blues.length === 2;
    const esPUT  = blues.length === 3 && reds.length === 2;

    if (el.blueDigitsDisplay) el.blueDigitsDisplay.textContent =
        blues.length ? `${blues.map(d => d.value).join(' → ')}  (${blues.length})` : 'Ninguno (0)';
    if (el.redDigitsDisplay) el.redDigitsDisplay.textContent =
        reds.length  ? `${reds.map(d => d.value).join(' → ')}  (${reds.length})`   : 'Ninguno (0)';

    if (!esCALL && !esPUT) {
        resetFilters();
        const blueNumDir = blues.length >= 2 ? analyzeSequence(blues.map(d => d.value)) : null;
        const redNumDir  = reds.length  >= 2 ? analyzeSequence(reds.map(d  => d.value)) : null;
        updateDirEl(el.blueDirection, blueNumDir === null ? null : toMarketDir(blueNumDir, true),  blues.length);
        updateDirEl(el.redDirection,  redNumDir  === null ? null : toMarketDir(redNumDir,  false), reds.length);
        setSignalUI('none', 'PROPORCIÓN INVÁLIDA',
            `Rojos: ${reds.length} | Azules: ${blues.length} — Se requiere 3R+2A (CALL) o 3A+2R (PUT)`, true);
        return;
    }

    const blueNumDir = blues.length >= 2 ? analyzeSequence(blues.map(d => d.value)) : (blues.length === 1 ? 'one' : null);
    const redNumDir  = reds.length  >= 2 ? analyzeSequence(reds.map(d  => d.value)) : (reds.length  === 1 ? 'one' : null);

    const blueMarket = blueNumDir === 'one' ? null : toMarketDir(blueNumDir, true);
    const redMarket  = redNumDir  === 'one' ? null : toMarketDir(redNumDir,  false);

    updateDirEl(el.blueDirection, blueMarket, blues.length);
    updateDirEl(el.redDirection,  redMarket,  reds.length);

    if (blueMarket === null && redMarket === null) {
        resetFilters(); setSignalUI('none', 'SIN SEÑAL', 'No hay dirección clara en ningún grupo', true); return;
    }
    if (blueMarket === null) {
        resetFilters(); setSignalUI('none', 'SIN SEÑAL', 'Dígitos azules sin dirección clara (retroceso o repetición)', true); return;
    }
    if (redMarket === null) {
        resetFilters(); setSignalUI('none', 'SIN SEÑAL', 'Dígitos rojos sin dirección clara (retroceso o repetición)', true); return;
    }
    if (blueMarket !== redMarket) {
        resetFilters(); setSignalUI('none', 'CONFLICTO', `Azules: ${blueMarket} vs Rojos: ${redMarket}`, true); return;
    }

    const isCall       = blueMarket === 'alcista';
    const proporcionOk = isCall ? esCALL : esPUT;

    if (!proporcionOk) {
        resetFilters();
        setSignalUI('none', 'PROPORCIÓN CONFLICTO',
            `Dirección ${blueMarket} pero proporción no coincide (R:${reds.length} A:${blues.length})`, true);
        return;
    }

    // Filtros de confirmación
    if (el.filtersSection) el.filtersSection.style.display = 'block';

    const dominantGroup = isCall ? reds  : blues;
    const minorityGroup = isCall ? blues : reds;

    // Rojos/Azules en orden de aparición en el buffer (para Filtro 5)
    const redsInOrder  = buf.filter(d => !d.blue);
    const bluesInOrder = buf.filter(d =>  d.blue);

    const f1 = applyFilter1(isCall, dominantGroup);
    const f2 = applyFilter2(isCall, minorityGroup);
    const f3 = applyFilter3(isCall, dominantGroup);
    const f4 = applyFilter4(buf);
    const f5 = isCall ? applyFilter5(redsInOrder, true) : applyFilter5(bluesInOrder, false);
    const f6 = applyFilter6(isCall, blues, reds);

    if (f1 && f2 && f3 && f4 && f5 && f6) {
        setSignalUI(isCall ? 'call' : 'put',
            isCall ? '🟢 CALL — ALCISTA' : '🔴 PUT — BAJISTA',
            `Proporción ${isCall ? '3R+2A' : '3A+2R'} ✓ | Dirección ✓ | Filtros F1+F2+F3+F4+F5+F6 ✓`,
            true, isCall ? 'CALL' : 'PUT');
    } else {
        const failed = [!f1 && 'F1', !f2 && 'F2', !f3 && 'F3', !f4 && 'F4', !f5 && 'F5', !f6 && 'F6'].filter(Boolean).join(', ');
        setSignalUI('none', 'FILTROS NO SUPERADOS',
            `Dirección ${blueMarket} ✓ | Proporción ✓ | Bloqueado por: ${failed}`, true);
    }
}

/**
 * Analiza si la secuencia de valores es estrictamente monotónica.
 * Retorna: 'up' | 'down' | null
 */
function analyzeSequence(values) {
    if (values.length < 2) return null;
    if (new Set(values).size !== values.length) return null; // sin repeticiones

    let up = true, down = true;
    for (let i = 1; i < values.length; i++) {
        if (values[i] <= values[i - 1]) up   = false;
        if (values[i] >= values[i - 1]) down = false;
    }
    return up ? 'up' : down ? 'down' : null;
}

/**
 * Convierte dirección numérica en dirección de mercado según tipo de dígito.
 * Azules: subida = alcista. Rojos: subida = bajista (invertido).
 */
function toMarketDir(numericDir, isBlue) {
    if (numericDir === null) return null;
    return isBlue
        ? (numericDir === 'up' ? 'alcista' : 'bajista')
        : (numericDir === 'down' ? 'alcista' : 'bajista');
}

// ====================== FILTROS DE CONFIRMACIÓN ======================

/**
 * Filtro 1 — Valor del último dígito del grupo dominante.
 * CALL (dominante=rojos): último rojo ≤ 5 → agotamiento bajista.
 * PUT  (dominante=azules): último azul ≤ 5 → agotamiento alcista.
 */
function applyFilter1(isCall, dominantGroup) {
    const lastVal = dominantGroup[dominantGroup.length - 1].value;
    const pass    = lastVal <= 5;
    const tipo    = isCall ? 'rojo' : 'azul';
    const msg     = pass
        ? `Último ${tipo} = ${lastVal} ≤ 5 ✓ Agotamiento confirmado`
        : `Último ${tipo} = ${lastVal} ≥ 6 ✗ Grupo dominante aún fuerte`;
    setFilterUI('filter1', pass, msg);
    return pass;
}

/**
 * Filtro 2 — Amplitud del grupo minoritario (2 dígitos).
 * Diferencia entre mayor y menor del grupo ≤ 6.
 */
function applyFilter2(isCall, minorityGroup) {
    const vals = minorityGroup.map(d => d.value);
    const diff = Math.max(...vals) - Math.min(...vals);
    const pass = diff <= 6;
    const tipo = isCall ? 'azules' : 'rojos';
    const msg  = pass
        ? `Amplitud ${tipo} = ${diff} ≤ 6 ✓ Movimiento controlado`
        : `Amplitud ${tipo} = ${diff} > 6 ✗ Sobreextensión detectada`;
    setFilterUI('filter2', pass, msg);
    return pass;
}

/**
 * Filtro 3 — Convergencia del grupo dominante (3 dígitos).
 * CALL: último rojo < primero (descenso progresivo).
 * PUT:  último azul > primero (ascenso progresivo).
 */
function applyFilter3(isCall, dominantGroup) {
    const firstVal = dominantGroup[0].value;
    const lastVal  = dominantGroup[dominantGroup.length - 1].value;
    const pass = isCall ? lastVal < firstVal : lastVal > firstVal;
    const msg  = isCall
        ? (pass
            ? `Rojos: ${firstVal}→…→${lastVal} ✓ Descenso progresivo confirmado`
            : `Rojos: ${firstVal}→…→${lastVal} ✗ Sin convergencia descendente`)
        : (pass
            ? `Azules: ${firstVal}→…→${lastVal} ✓ Ascenso progresivo confirmado`
            : `Azules: ${firstVal}→…→${lastVal} ✗ Sin convergencia ascendente`);
    setFilterUI('filter3', pass, msg);
    return pass;
}

/**
 * Filtro 4 — Sin dígito 0 en el patrón.
 * Ninguno de los 5 dígitos (rojos o azules) puede ser 0.
 * Un dígito 0 distorsiona la escala y anula la señal.
 */
function applyFilter4(buf) {
    const hasZero = buf.some(d => d.value === 0);
    const pass    = !hasZero;
    const msg     = pass
        ? 'Ningún dígito es 0 ✓ Patrón limpio'
        : `Dígito 0 detectado en el patrón ✗ Señal anulada`;
    setFilterUI('filter4', pass, msg);
    return pass;
}

/**
 * Filtro 5 — Agotamiento por pasos en el grupo dominante.
 * CALL: se analizan los 3 dígitos rojos en orden de aparición.
 *   Paso 1 = rojo[0] - rojo[1]
 *   Paso 2 = rojo[1] - rojo[2]
 *   Condición: Paso 2 < Paso 1  →  agotamiento bajista confirmado.
 * PUT: misma lógica pero sobre los 3 dígitos azules en orden de aparición.
 *   Paso 1 = azul[0] - azul[1]
 *   Paso 2 = azul[1] - azul[2]
 *   Condición: Paso 2 < Paso 1  →  agotamiento alcista confirmado.
 */
function applyFilter5(dominantGroup, isCall) {
    const colorName = isCall ? 'Rojos' : 'Azules';
    if (dominantGroup.length !== 3) {
        setFilterUI('filter5', null, `F5 no aplica (se necesitan exactamente 3 ${colorName.toLowerCase()})`);
        return true;
    }
    const d0 = dominantGroup[0].value;
    const d1 = dominantGroup[1].value;
    const d2 = dominantGroup[2].value;
    const paso1 = d0 - d1;
    const paso2 = d1 - d2;
    const pass  = paso2 < paso1;
    const msg   = pass
        ? `${colorName}: ${d0}→${d1}→${d2} | Paso1=${paso1} Paso2=${paso2} → ${paso2}<${paso1} ✓ Agotamiento confirmado`
        : `${colorName}: ${d0}→${d1}→${d2} | Paso1=${paso1} Paso2=${paso2} → ${paso2}≥${paso1} ✗ Sin agotamiento`;
    setFilterUI('filter5', pass, msg);
    return pass;
}

/**
 * Filtro 6 — Sin dígito 9 en el grupo minoritario de la señal.
 * CALL (azules = minoría): si algún dígito azul es 9 → no se opera.
 * PUT  (rojos  = minoría): si algún dígito rojo  es 9 → no se opera.
 */
function applyFilter6(isCall, blues, reds) {
    const group     = isCall ? blues : reds;
    const colorName = isCall ? 'azul' : 'rojo';
    const hasNine   = group.some(d => d.value === 9);
    const pass      = !hasNine;
    const msg       = pass
        ? `Ningún dígito ${colorName} es 9 ✓ Patrón válido`
        : `Dígito 9 detectado en dígitos ${colorName}s ✗ Señal anulada`;
    setFilterUI('filter6', pass, msg);
    return pass;
}

function setFilterUI(filterKey, pass, msg) {
    const itemEl = el[filterKey + 'Item'];
    const iconEl = el[filterKey + 'Icon'];
    const descEl = el[filterKey + 'Desc'];
    if (!itemEl) return;
    itemEl.className = 'filter-item ' + (pass === true ? 'filter-pass' : pass === false ? 'filter-fail' : 'filter-pending');
    if (iconEl) iconEl.innerHTML = pass === true
        ? '<i class="fas fa-check-circle"></i>'
        : pass === false
            ? '<i class="fas fa-times-circle"></i>'
            : '<i class="fas fa-circle"></i>';
    if (descEl) descEl.textContent = msg || '—';
}

function resetFilters() {
    if (el.filtersSection) el.filtersSection.style.display = 'none';
    setFilterUI('filter1', null, '—');
    setFilterUI('filter2', null, '—');
    setFilterUI('filter3', null, '—');
    setFilterUI('filter4', null, '—');
    setFilterUI('filter5', null, '—');
    setFilterUI('filter6', null, '—');
}

// ====================== UI DE SEÑAL ======================

function updateDirEl(elRef, marketDir, count) {
    if (!elRef) return;
    if (count < 2) {
        elRef.textContent = count === 0 ? '—' : 'Solo 1 dígito';
        elRef.className   = 'analysis-direction neutral';
        return;
    }
    if (marketDir === 'alcista')      { elRef.textContent = '▲ ALCISTA'; elRef.className = 'analysis-direction bullish'; }
    else if (marketDir === 'bajista') { elRef.textContent = '▼ BAJISTA'; elRef.className = 'analysis-direction bearish'; }
    else                              { elRef.textContent = '⚠ SIN DIRECCIÓN'; elRef.className = 'analysis-direction neutral'; }
}

function setSignalUI(type, text, detail, addToHistory, tradeSignal) {
    const box = el.strategySignalBox;
    if (!box) return;

    box.className = 'strategy-signal-box signal-' + type;

    if (tradeSignal === 'PUT') {
        if (el.signalText)   el.signalText.textContent   = text;
        if (el.signalDetail) el.signalDetail.textContent = detail;
    } else {
        if (el.signalText)   el.signalText.textContent   = text;
        if (el.signalDetail) el.signalDetail.textContent = detail;
    }

    if (el.signalIcon) {
        el.signalIcon.innerHTML =
            type === 'call' ? '<i class="fas fa-arrow-up"></i>'   :
            type === 'put'  ? '<i class="fas fa-arrow-down"></i>' :
                              '<i class="fas fa-minus-circle"></i>';
    }

    if (addToHistory && tradeSignal) {
        if (tradeSignal === 'CALL') strategy.signalCalls++;
        else if (tradeSignal === 'PUT') strategy.signalPuts++;

        addSignalToHistory(type, text, detail);
        updateStrategyStats();
        playSound('signal');

        if (tradeSignal === 'CALL') {
            notifyInternal('📊 Señal CALL — Ejecutando operación', `${text} — ${detail}`, 'success');
        } else {
            notifyInternal('📊 Señal PUT — Ejecutando operación', `${text} — ${detail}`, 'error');
        }

        if (!trading.isTrading && feed.running && !stopLimits.triggered) {
            if (tradeSignal === 'CALL') {
                strategy.paused = true;
                strategy.buffer = [];
                setStrategyStatusBar('paused', '⏳ OPERACIÓN CALL EN CURSO — Análisis pausado');
                window.executeTrade('CALL');
            } else if (tradeSignal === 'PUT') {
                strategy.paused = true;
                strategy.buffer = [];
                setStrategyStatusBar('paused', '⏳ OPERACIÓN PUT EN CURSO — Análisis pausado');
                window.executeTrade('PUT');
            }
        }
    } else if (addToHistory && type === 'none') {
        strategy.signalNone++;
        updateStrategyStats();
    }
}

function addSignalToHistory(type, text, detail) {
    const histEl = el.signalsHistory;
    if (!histEl) return;
    const item = document.createElement('div');
    item.className = 'signal-history-item signal-hist-' + type;
    const time = new Date().toLocaleTimeString();
    item.innerHTML = `<span class="sig-time">${time}</span><span class="sig-label">${text}</span><span class="sig-detail">${detail}</span>`;
    histEl.insertBefore(item, histEl.firstChild);
    while (histEl.children.length > 10) histEl.removeChild(histEl.lastChild);
}

function updateStrategyStats() {
    if (el.signalCalls) el.signalCalls.textContent = strategy.signalCalls;
    if (el.signalPuts)  el.signalPuts.textContent  = strategy.signalPuts;
    if (el.signalNone)  el.signalNone.textContent   = strategy.signalNone;
}

function setStrategyStatusBar(state, message) {
    const box = el.strategySignalBox;
    if (!box) return;
    if (state === 'paused') {
        box.className = 'strategy-signal-box signal-paused';
        if (el.signalIcon)   el.signalIcon.innerHTML    = '<i class="fas fa-pause-circle"></i>';
        if (el.signalText)   el.signalText.textContent  = 'ANÁLISIS PAUSADO';
        if (el.signalDetail) el.signalDetail.textContent = message || 'Esperando resultado de operación...';
    } else if (state === 'resumed') {
        box.className = 'strategy-signal-box signal-none';
        if (el.signalIcon)   el.signalIcon.innerHTML    = '<i class="fas fa-search"></i>';
        if (el.signalText)   el.signalText.textContent  = 'ANALIZANDO...';
        if (el.signalDetail) el.signalDetail.textContent = message || 'Buscando nuevo patrón de 5 dígitos';
        if (el.patternDigitsRow) el.patternDigitsRow.innerHTML = '<div class="pattern-placeholder">Esperando dígitos...</div>';
        if (el.blueDigitsDisplay) el.blueDigitsDisplay.textContent = '-';
        if (el.redDigitsDisplay)  el.redDigitsDisplay.textContent  = '-';
        if (el.blueDirection)     el.blueDirection.textContent     = '—';
        if (el.redDirection)      el.redDirection.textContent      = '—';
        resetFilters();
    }
}

// ====================== STOP WIN / STOP LOSS ======================

/**
 * Actualiza la barra de progreso de un límite.
 * @param {string} barId   - id del elemento .sl-bar-fill
 * @param {number} current - valor actual (profit para SW, -profit para SL)
 * @param {number|null} limit - límite configurado (null = desactivado)
 * @param {boolean} isWin  - true = stop win (verde), false = stop loss (rojo)
 */
function updateProgressBar(barId, current, limit, isWin) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    if (limit === null || limit <= 0) {
        bar.style.width = '0%';
        bar.className   = 'sl-bar-fill';
        return;
    }
    const pct = Math.min(100, Math.max(0, (current / limit) * 100));
    bar.style.width = pct + '%';
    bar.className   = 'sl-bar-fill ' + (isWin ? 'sl-bar-win' : 'sl-bar-loss') + (pct >= 100 ? ' sl-bar-full' : '');
}

function initStopLimits() {
    const swInput  = document.getElementById('stop-win-input');
    const slInput  = document.getElementById('stop-loss-input');
    const swToggle = document.getElementById('stop-win-toggle');
    const slToggle = document.getElementById('stop-loss-toggle');

    if (!swInput || !slInput) return;

    // Activar/desactivar límites al cambiar el checkbox
    swToggle.addEventListener('change', () => updateStopLimitsState());
    slToggle.addEventListener('change', () => updateStopLimitsState());

    // Actualizar al cambiar el valor
    swInput.addEventListener('input', () => updateStopLimitsState());
    slInput.addEventListener('input', () => updateStopLimitsState());

    // Botón de reset manual
    const resetBtn = document.getElementById('stop-limits-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetStopLimits);

    updateStopLimitsUI();
}

function updateStopLimitsState() {
    const swToggle = document.getElementById('stop-win-toggle');
    const slToggle = document.getElementById('stop-loss-toggle');
    const swInput  = document.getElementById('stop-win-input');
    const slInput  = document.getElementById('stop-loss-input');

    const swVal = parseFloat(swInput.value);
    const slVal = parseFloat(slInput.value);

    stopLimits.stopWin  = (swToggle.checked && !isNaN(swVal) && swVal > 0) ? swVal  : null;
    stopLimits.stopLoss = (slToggle.checked && !isNaN(slVal) && slVal > 0) ? slVal  : null;
    stopLimits.active   = stopLimits.stopWin !== null || stopLimits.stopLoss !== null;

    updateStopLimitsUI();
}

/**
 * Se llama después de cada operación completada.
 * Compara el profit acumulado contra los límites configurados.
 */
function checkStopLimits() {
    if (!stopLimits.active || stopLimits.triggered) return;

    const profit = trading.totalProfit;

    // Stop Win: profit acumulado >= límite configurado
    if (stopLimits.stopWin !== null && profit >= stopLimits.stopWin) {
        triggerStopLimit('stopWin', profit);
        return;
    }

    // Stop Loss: pérdida acumulada <= -límite configurado
    if (stopLimits.stopLoss !== null && profit <= -stopLimits.stopLoss) {
        triggerStopLimit('stopLoss', profit);
        return;
    }
}

function triggerStopLimit(type, currentProfit) {
    stopLimits.triggered   = true;
    stopLimits.triggeredBy = type;

    // Único efecto: detener la estrategia
    strategy.paused = true;
    strategy.buffer = [];

    const isWin     = type === 'stopWin';
    const limit     = isWin ? stopLimits.stopWin : stopLimits.stopLoss;
    const profitStr = (currentProfit >= 0 ? '+' : '') + currentProfit.toFixed(2);
    const title     = isWin ? '🏆 STOP WIN ALCANZADO' : '🛑 STOP LOSS ALCANZADO';
    const detail    = isWin
        ? `Ganancia $${profitStr} alcanzó el límite de +$${limit.toFixed(2)}`
        : `Pérdida $${profitStr} alcanzó el límite de -$${limit.toFixed(2)}`;

    // Reflejar en la caja de señal de la estrategia
    const box = el.strategySignalBox;
    if (box) {
        box.className = `strategy-signal-box signal-stop-${isWin ? 'win' : 'loss'}`;
        if (el.signalIcon)   el.signalIcon.innerHTML     = `<i class="fas fa-${isWin ? 'trophy' : 'hand-paper'}"></i>`;
        if (el.signalText)   el.signalText.textContent   = title;
        if (el.signalDetail) el.signalDetail.textContent = detail;
    }

    // Actualizar panel (muestra el estado alcanzado y el botón de reset)
    updateStopLimitsUI();
}

/**
 * El usuario reactiva manualmente la estrategia tras alcanzar un límite.
 */
function resetStopLimits() {
    stopLimits.triggered   = false;
    stopLimits.triggeredBy = null;

    if (feed.running) {
        strategy.paused = false;
        strategy.buffer = [];
        setStrategyStatusBar('resumed', 'Límite reseteado — Buscando nuevo patrón');
    }

    updateStopLimitsUI();
}

function updateStopLimitsUI() {
    const panel    = document.getElementById('stop-limits-panel');
    const resetBtn = document.getElementById('stop-limits-reset-btn');
    const swToggle = document.getElementById('stop-win-toggle');
    const slToggle = document.getElementById('stop-loss-toggle');
    const swInput  = document.getElementById('stop-win-input');
    const slInput  = document.getElementById('stop-loss-input');
    const swStatus = document.getElementById('stop-win-status');
    const slStatus = document.getElementById('stop-loss-status');
    const profitEl = document.getElementById('stop-limits-profit');

    if (!panel) return;

    const profit = trading.totalProfit;

    // Profit de sesión en el header del panel
    if (profitEl) {
        profitEl.textContent = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`;
        profitEl.className   = 'sl-profit-value ' + (profit >= 0 ? 'positive' : 'negative');
    }

    // Inputs: habilitados solo si su toggle está activo
    if (swInput) swInput.disabled = !(swToggle && swToggle.checked);
    if (slInput) slInput.disabled = !(slToggle && slToggle.checked);

    // Barras de progreso
    updateProgressBar('stop-win-bar',  profit,  stopLimits.stopWin,  true);
    updateProgressBar('stop-loss-bar', -profit, stopLimits.stopLoss, false);

    // Estado textual — Stop Win
    if (swStatus) {
        if (stopLimits.stopWin !== null) {
            const rem = stopLimits.stopWin - profit;
            swStatus.textContent = rem > 0 ? `Faltan $${rem.toFixed(2)}` : '✅ Alcanzado';
            swStatus.className   = 'sl-status ' + (rem <= 0 ? 'sl-reached' : 'sl-active');
        } else {
            swStatus.textContent = 'Desactivado';
            swStatus.className   = 'sl-status sl-inactive';
        }
    }

    // Estado textual — Stop Loss
    if (slStatus) {
        if (stopLimits.stopLoss !== null) {
            const rem = stopLimits.stopLoss + profit; // stopLoss - |pérdida|
            slStatus.textContent = rem > 0 ? `Faltan $${rem.toFixed(2)}` : '🛑 Alcanzado';
            slStatus.className   = 'sl-status ' + (rem <= 0 ? 'sl-reached' : 'sl-active');
        } else {
            slStatus.textContent = 'Desactivado';
            slStatus.className   = 'sl-status sl-inactive';
        }
    }

    // Botón de reactivar: visible solo cuando un límite fue alcanzado
    if (resetBtn) resetBtn.style.display = stopLimits.triggered ? 'flex' : 'none';
}
