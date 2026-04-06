'use strict';

// ====================== VARIABLES GLOBALES ======================
let ws            = null;
let derivWs       = null;
let running       = false;
let isConnecting  = false;
let DERIV_API_TOKEN = '';
const DURATION    = 5;

let currentAsset  = 'R_10';
let lastPrice     = null;
let tickCount     = 0;
let digits        = [];
let ticksHistory  = [];
let ticksPerMinute = 0;
let ticksCounter  = 0;
let minuteTimer   = null;

// Detección de máximos/mínimos
let priceHistory       = [];
const PRICE_HISTORY_LENGTH = 20;
let currentPriceLevel  = 'mid';
let maxPrice           = 0;
let minPrice           = Infinity;
let greenDigitsCount   = 0;
let lastMaxDigit       = null;
let lastMinDigit       = null;

// Trading
let balance        = 0;
let totalProfit    = 0;
let wins           = 0;
let losses         = 0;
let totalTrades    = 0;
let tradingStake   = 1.00;
let currentContract = null;
let isTrading      = false;

// Stop Win / Stop Loss
let stopWinAmount  = 0;   // 0 = desactivado
let stopLossAmount = 0;   // 0 = desactivado
let stopTriggered  = false;

// Monitor de operación
let activeTrade       = null;
let monitorInterval   = null;
let tradeStartTime    = null;
let monitorCanvas     = null;
let monitorCtx        = null;
let priceHistoryData  = [];
let contractTicks     = [];

// Alertas
let soundAlertsEnabled = true;
let pushAlertsEnabled  = true;
let audioContext       = null;
let gainNode           = null;

// Historial de dígitos y niveles
let digitHistory  = [];
let levelHistory  = [];

// Resultados (máx 5 en memoria)
let lastResults   = [];

// ====================== CACHÉ DE ELEMENTOS DOM ======================
let priceEl, currentDigitEl, balanceEl, totalProfitEl;
let winsEl, lossesEl, totalTradesEl, winRateEl;
let lastTradeEl, tradeStatusEl, digitsContainer, digitCountEl;
let callStakeEl, putStakeEl, statusDot, statusText;
let priceLevelIndicator, levelHistoryEl, currentLevelDisplay;
let maxPriceDisplay, minPriceDisplay, greenDigitsCountEl;
let lastMaxDigitEl, lastMinDigitEl, greenDigitCountBadge;
let tradeMonitorEl, monitorStatusEl, monitorChartEl;
let ticksRemainingEl, chartPointsInfo, infoCurrentTickEl;
let infoEntryPriceEl, infoCurrentPriceEl, infoPriceDifferenceEl;
let infoPercentageChangeEl, infoElapsedTimeEl, infoTradeStateEl;
let soundAlertSwitch, soundIndicator, pushAlertSwitch, pushIndicator;

// Stop Win / Stop Loss elements
let stopWinInput, stopLossInput, stopStatusBar;
let stopWinFill, stopLossFill, stopWinVal, stopLossVal;

// CanvasJS
let digitsChart       = null;
let priceChart        = null;
let digitsDataPoints  = [];
let priceDataPoints   = [];
let currentPosition   = 1;
let priceChartPosition = 1;

// Selector cacheado
let cachedAssetSelector = null;

// ====================== TOKEN: MODAL Y GESTIÓN ======================
window.conectarConToken = function() {
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

    DERIV_API_TOKEN = token;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';

    const testWs = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    testWs.onopen = () => { testWs.send(JSON.stringify({ authorize: token })); };

    testWs.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        testWs.close();

        if (data.error) {
            DERIV_API_TOKEN = '';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plug"></i> Conectar';
            errorEl.textContent = '❌ Token inválido: ' + data.error.message;
            errorEl.style.display = 'block';
            return;
        }

        if (data.authorize) {
            try { localStorage.setItem('deriv_token', token); } catch(e) {}

            const badge = document.getElementById('token-badge');
            if (badge) {
                badge.classList.remove('hidden');
                document.getElementById('token-badge-text').textContent =
                    'Token: ' + token.substring(0, 4) + '...' + token.slice(-4);
            }

            document.getElementById('token-modal-overlay').style.display = 'none';
            conectarDerivAPI();

            showInternalNotification(
                '¡Conectado!',
                'Cuenta: ' + data.authorize.loginid + ' | Balance: $' + parseFloat(data.authorize.balance).toFixed(2),
                'success'
            );
        }
    };

    testWs.onerror = () => {
        testWs.close();
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-plug"></i> Conectar';
        errorEl.textContent = '❌ Error de conexión. Verifica tu internet.';
        errorEl.style.display = 'block';
    };
};

window.cambiarToken = function() {
    DERIV_API_TOKEN = '';
    if (derivWs) { try { derivWs.close(); } catch(e) {} derivWs = null; }
    document.getElementById('token-input').value = '';
    document.getElementById('token-error-msg').style.display = 'none';
    document.getElementById('btn-connect-token').disabled = false;
    document.getElementById('btn-connect-token').innerHTML = '<i class="fas fa-plug"></i> Conectar';
    document.getElementById('token-modal-overlay').style.display = 'flex';
    document.getElementById('token-badge').classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-token-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const inp  = document.getElementById('token-input');
            const icon = document.getElementById('toggle-token-icon');
            inp.type = inp.type === 'password' ? 'text' : 'password';
            icon.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    }
    const tokenInput = document.getElementById('token-input');
    if (tokenInput) {
        tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') conectarConToken(); });
    }
});

// ====================== INICIALIZACIÓN ======================
window.onload = function() {
    priceEl              = document.getElementById('price');
    currentDigitEl       = document.getElementById('current-digit');
    balanceEl            = document.getElementById('balance-amount');
    totalProfitEl        = document.getElementById('total-profit');
    winsEl               = document.getElementById('wins-count');
    lossesEl             = document.getElementById('losses-count');
    totalTradesEl        = document.getElementById('total-trades');
    winRateEl            = document.getElementById('win-rate');
    lastTradeEl          = document.getElementById('last-trade');
    tradeStatusEl        = document.getElementById('trade-status');
    digitsContainer      = document.getElementById('digits-container');
    digitCountEl         = document.getElementById('digit-count');
    callStakeEl          = document.getElementById('call-stake');
    putStakeEl           = document.getElementById('put-stake');
    statusDot            = document.getElementById('status-dot');
    statusText           = document.getElementById('status-text');
    priceLevelIndicator  = document.getElementById('price-level-indicator');
    levelHistoryEl       = document.getElementById('level-history');
    currentLevelDisplay  = document.getElementById('current-level-display');
    maxPriceDisplay      = document.getElementById('max-price-display');
    minPriceDisplay      = document.getElementById('min-price-display');
    greenDigitsCountEl   = document.getElementById('green-digits-count');
    lastMaxDigitEl       = document.getElementById('last-max-digit');
    lastMinDigitEl       = document.getElementById('last-min-digit');
    greenDigitCountBadge = document.getElementById('green-digit-count-badge');
    tradeMonitorEl       = document.getElementById('trade-monitor');
    monitorStatusEl      = document.getElementById('monitor-status');
    monitorChartEl       = document.getElementById('monitor-chart');
    ticksRemainingEl     = document.getElementById('ticks-remaining');
    chartPointsInfo      = document.getElementById('chart-points-info');
    infoCurrentTickEl    = document.getElementById('info-current-tick');
    infoEntryPriceEl     = document.getElementById('info-entry-price');
    infoCurrentPriceEl   = document.getElementById('info-current-price');
    infoPriceDifferenceEl = document.getElementById('info-price-difference');
    infoPercentageChangeEl = document.getElementById('info-percentage-change');
    infoElapsedTimeEl    = document.getElementById('info-elapsed-time');
    infoTradeStateEl     = document.getElementById('info-trade-state');
    soundAlertSwitch     = document.getElementById('sound-alert-switch');
    soundIndicator       = document.getElementById('sound-indicator');
    pushAlertSwitch      = document.getElementById('push-alert-switch');
    pushIndicator        = document.getElementById('push-indicator');
    cachedAssetSelector  = document.getElementById('asset-selector');

    // Stop Win / Stop Loss
    stopWinInput  = document.getElementById('stop-win-input');
    stopLossInput = document.getElementById('stop-loss-input');
    stopStatusBar = document.getElementById('stop-status-bar');
    stopWinFill   = document.getElementById('stop-win-fill');
    stopLossFill  = document.getElementById('stop-loss-fill');
    stopWinVal    = document.getElementById('stop-win-val');
    stopLossVal   = document.getElementById('stop-loss-val');

    if (stopWinInput) {
        stopWinInput.addEventListener('input', () => {
            stopWinAmount = parseFloat(stopWinInput.value) || 0;
            stopTriggered = false;
            updateStopStatusBar();
        });
    }
    if (stopLossInput) {
        stopLossInput.addEventListener('input', () => {
            stopLossAmount = parseFloat(stopLossInput.value) || 0;
            stopTriggered = false;
            updateStopStatusBar();
        });
    }

    initCanvasJSChart();
    initPriceChart();
    initMonitorCanvas();
    updateTradingDisplay();
    updateStakeDisplay();
    startTicksPerMinuteCounter();
    initializeLevelHistory();
    initializeAudioSystem();
    loadAlertSettings();
    requestNotificationPermission();
    initStrategyElements();

    try {
        const saved = localStorage.getItem('deriv_token');
        if (saved) document.getElementById('token-input').value = saved;
    } catch(e) {}

    document.getElementById('trading-stake').addEventListener('input', function() {
        tradingStake = parseFloat(this.value) || 1;
        updateStakeDisplay();
    });
};

// ====================== STOP WIN / STOP LOSS ======================
function checkStopConditions() {
    if (stopTriggered) return true;

    const sw = stopWinAmount  > 0 && totalProfit >= stopWinAmount;
    const sl = stopLossAmount > 0 && totalProfit <= -stopLossAmount;

    if (sw || sl) {
        stopTriggered = true;
        strategyPaused = true;

        const msg = sw
            ? `🏆 Stop Win alcanzado: +$${totalProfit.toFixed(2)}`
            : `🛑 Stop Loss alcanzado: $${totalProfit.toFixed(2)}`;

        if (stopStatusBar) {
            stopStatusBar.className = 'stop-status-bar triggered';
            stopStatusBar.innerHTML = `<i class="fas fa-${sw ? 'trophy' : 'stop-circle'}"></i> ${msg}`;
        }

        showInternalNotification(
            sw ? '🏆 Stop Win activado' : '🛑 Stop Loss activado',
            msg + ' — El sistema se ha detenido.',
            sw ? 'success' : 'error'
        );
        playAlertSound(sw ? 'win' : 'loss');

        return true;
    }

    updateStopStatusBar();
    return false;
}

function updateStopStatusBar() {
    if (!stopStatusBar) return;

    const hasWin  = stopWinAmount  > 0;
    const hasLoss = stopLossAmount > 0;

    if (stopTriggered) return; // No sobreescribir mensaje de triggered

    if (!hasWin && !hasLoss) {
        stopStatusBar.className = 'stop-status-bar';
        stopStatusBar.innerHTML = '<i class="fas fa-info-circle"></i> Sin límites configurados — el sistema opera sin restricciones';
        if (stopWinFill)  stopWinFill.style.width  = '0%';
        if (stopLossFill) stopLossFill.style.width = '0%';
        if (stopWinVal)   stopWinVal.textContent   = '$0.00';
        if (stopLossVal)  stopLossVal.textContent  = '$0.00';
        return;
    }

    // Actualizar barras de progreso
    if (hasWin && stopWinFill) {
        const pct = Math.min(100, Math.max(0, (totalProfit / stopWinAmount) * 100));
        stopWinFill.style.width = pct + '%';
    }
    if (stopWinVal) stopWinVal.textContent = (totalProfit > 0 ? '+' : '') + '$' + totalProfit.toFixed(2);

    if (hasLoss && stopLossFill) {
        const loss = -totalProfit;
        const pct  = Math.min(100, Math.max(0, (loss / stopLossAmount) * 100));
        stopLossFill.style.width = pct + '%';
    }
    if (stopLossVal) stopLossVal.textContent = '$' + totalProfit.toFixed(2);

    // Mensaje de estado
    let parts = [];
    if (hasWin)  parts.push(`SW: $${stopWinAmount.toFixed(2)}`);
    if (hasLoss) parts.push(`SL: $${stopLossAmount.toFixed(2)}`);

    const isGaining = totalProfit > 0;
    stopStatusBar.className = 'stop-status-bar ' + (isGaining ? 'active-win' : (totalProfit < 0 ? 'active-loss' : ''));
    stopStatusBar.innerHTML = `<i class="fas fa-shield-alt"></i> Activo — ${parts.join(' | ')} | P/L: ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`;
}

// ====================== CANVAS DE MONITOREO ======================
function initMonitorCanvas() {
    monitorCanvas = document.getElementById('monitor-canvas');
    if (!monitorCanvas) return;
    monitorCtx = monitorCanvas.getContext('2d');
    resizeMonitorCanvas();
    window.addEventListener('resize', resizeMonitorCanvas);
}

function resizeMonitorCanvas() {
    if (!monitorCanvas || !monitorChartEl) return;
    monitorCanvas.width  = monitorChartEl.clientWidth;
    monitorCanvas.height = monitorChartEl.clientHeight;
    if (activeTrade && priceHistoryData.length > 0) drawMonitorChartWithRealData();
}

// ====================== GRÁFICO MONITOR ======================
function drawMonitorChartWithRealData() {
    if (!monitorCtx || !monitorCanvas || !priceHistoryData.length || !activeTrade) return;

    const width      = monitorCanvas.width;
    const height     = monitorCanvas.height;
    const padding    = 20;
    const chartWidth = width  - padding * 2;
    const chartHeight = height - padding * 2;

    monitorCtx.clearRect(0, 0, width, height);
    drawChartBackground(width, height, padding, chartHeight);

    const prices     = priceHistoryData.map(p => p.price);
    const entryPrice = activeTrade.entryPrice;
    const currPrice  = activeTrade.currentPrice;

    const minPriceVal = prices.reduce((m, v) => v < m ? v : m, Math.min(entryPrice, currPrice));
    const maxPriceVal = prices.reduce((m, v) => v > m ? v : m, Math.max(entryPrice, currPrice));
    const priceRange  = Math.max(0.0001, maxPriceVal - minPriceVal);

    drawProfitLossAreas(width, height, padding, chartHeight, minPriceVal, priceRange);
    drawReferenceLines(width, height, padding, chartHeight, minPriceVal, priceRange);
    drawPriceLineWithRealData(width, height, padding, chartWidth, chartHeight, minPriceVal, priceRange);
    drawEntryPoint(width, height, padding, chartWidth, chartHeight, entryPrice, minPriceVal, priceRange);
    drawCurrentPoint(width, height, padding, chartWidth, chartHeight, currPrice, minPriceVal, priceRange);
    drawChartLegend(width, height);

    if (chartPointsInfo) chartPointsInfo.textContent = `Ticks: ${priceHistoryData.length}/5`;
}

function drawChartBackground(width, height, padding, chartHeight) {
    monitorCtx.fillStyle = 'rgba(0,0,0,0.2)';
    monitorCtx.fillRect(padding, padding, width - padding * 2, height - padding * 2);
    monitorCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    monitorCtx.lineWidth = 1;
    monitorCtx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
    monitorCtx.strokeStyle = 'rgba(255,255,255,0.05)';
    monitorCtx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
        const y = padding + i * chartHeight / 5;
        monitorCtx.beginPath();
        monitorCtx.moveTo(padding, y);
        monitorCtx.lineTo(width - padding, y);
        monitorCtx.stroke();
    }
}

function drawProfitLossAreas(width, height, padding, chartHeight, minPv, priceRange) {
    if (!activeTrade) return;
    const entryY = padding + chartHeight - ((activeTrade.entryPrice - minPv) / priceRange * chartHeight);
    monitorCtx.fillStyle = 'rgba(46,204,113,0.05)';
    monitorCtx.fillRect(padding, padding, width - padding * 2, entryY - padding);
    monitorCtx.fillStyle = 'rgba(231,76,60,0.05)';
    monitorCtx.fillRect(padding, entryY, width - padding * 2, height - padding - entryY);
}

function drawReferenceLines(width, height, padding, chartHeight, minPv, priceRange) {
    const entryY = padding + chartHeight - ((activeTrade.entryPrice - minPv) / priceRange * chartHeight);
    monitorCtx.strokeStyle = 'rgba(52,152,219,0.5)';
    monitorCtx.lineWidth = 2;
    monitorCtx.setLineDash([5, 3]);
    monitorCtx.beginPath();
    monitorCtx.moveTo(padding, entryY);
    monitorCtx.lineTo(width - padding, entryY);
    monitorCtx.stroke();
    monitorCtx.setLineDash([]);
    monitorCtx.fillStyle = 'rgba(52,152,219,0.8)';
    monitorCtx.font = '10px Arial';
    monitorCtx.fillText('Entrada', width - padding - 50, entryY - 5);
}

function drawPriceLineWithRealData(width, height, padding, chartWidth, chartHeight, minPv, priceRange) {
    if (priceHistoryData.length < 2) return;
    const color = activeTrade.isWinning ? 'rgba(46,204,113,0.8)' : 'rgba(231,76,60,0.8)';
    monitorCtx.strokeStyle = color;
    monitorCtx.lineWidth = 2;
    monitorCtx.lineJoin = 'round';
    monitorCtx.lineCap  = 'round';
    monitorCtx.beginPath();
    priceHistoryData.forEach((pt, i) => {
        const x = padding + i * chartWidth / (priceHistoryData.length - 1);
        const y = padding + chartHeight - ((pt.price - minPv) / priceRange * chartHeight);
        i === 0 ? monitorCtx.moveTo(x, y) : monitorCtx.lineTo(x, y);
    });
    monitorCtx.stroke();
    priceHistoryData.forEach((pt, i) => {
        const x = padding + i * chartWidth / (priceHistoryData.length - 1);
        const y = padding + chartHeight - ((pt.price - minPv) / priceRange * chartHeight);
        monitorCtx.fillStyle   = color;
        monitorCtx.strokeStyle = 'rgba(255,255,255,0.8)';
        monitorCtx.lineWidth = 1;
        monitorCtx.beginPath();
        monitorCtx.arc(x, y, 3, 0, Math.PI * 2);
        monitorCtx.fill();
        monitorCtx.stroke();
    });
}

function drawEntryPoint(width, height, padding, chartWidth, chartHeight, entryPrice, minPv, priceRange) {
    const x = padding;
    const y = padding + chartHeight - ((entryPrice - minPv) / priceRange * chartHeight);
    monitorCtx.fillStyle   = 'rgba(52,152,219,1)';
    monitorCtx.strokeStyle = 'rgba(255,255,255,1)';
    monitorCtx.lineWidth = 2;
    monitorCtx.beginPath();
    monitorCtx.arc(x, y, 6, 0, Math.PI * 2);
    monitorCtx.fill();
    monitorCtx.stroke();
    monitorCtx.fillStyle = 'rgba(52,152,219,1)';
    monitorCtx.font = 'bold 12px Arial';
    monitorCtx.fillText('E', x - 3, y + 4);
}

function drawCurrentPoint(width, height, padding, chartWidth, chartHeight, currPrice, minPv, priceRange) {
    const x     = width - padding;
    const y     = padding + chartHeight - ((currPrice - minPv) / priceRange * chartHeight);
    const color = activeTrade.isWinning ? 'rgba(46,204,113,1)' : 'rgba(231,76,60,1)';
    monitorCtx.fillStyle   = color;
    monitorCtx.strokeStyle = 'rgba(255,255,255,1)';
    monitorCtx.lineWidth = 2;
    monitorCtx.beginPath();
    monitorCtx.arc(x, y, 8, 0, Math.PI * 2);
    monitorCtx.fill();
    monitorCtx.stroke();
    monitorCtx.fillStyle = 'rgba(255,255,255,1)';
    monitorCtx.font = 'bold 12px Arial';
    monitorCtx.fillText('A', x - 3, y + 4);
    monitorCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    monitorCtx.lineWidth = 1;
    monitorCtx.setLineDash([2, 2]);
    monitorCtx.beginPath();
    monitorCtx.moveTo(x, padding);
    monitorCtx.lineTo(x, height - padding);
    monitorCtx.stroke();
    monitorCtx.setLineDash([]);
    monitorCtx.fillStyle = color;
    monitorCtx.font = 'bold 11px Arial';
    const xd = obtenerDecimalesPorInstrumento(currentAsset);
    monitorCtx.fillText(currPrice.toFixed(xd), x + 5, y);
}

function drawChartLegend(width, height) {
    const pad = 10;
    monitorCtx.fillStyle = 'rgba(0,0,0,0.7)';
    monitorCtx.fillRect(pad, pad, 150, 60);
    monitorCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    monitorCtx.lineWidth = 1;
    monitorCtx.strokeRect(pad, pad, 150, 60);
    monitorCtx.fillStyle = 'rgba(255,255,255,0.9)';
    monitorCtx.font = 'bold 12px Arial';
    monitorCtx.fillText('LEYENDA', pad + 50, pad + 15);
    monitorCtx.fillStyle = 'rgba(52,152,219,1)';
    monitorCtx.beginPath();
    monitorCtx.arc(pad + 10, pad + 30, 4, 0, Math.PI * 2);
    monitorCtx.fill();
    monitorCtx.fillStyle = 'rgba(255,255,255,0.8)';
    monitorCtx.font = '10px Arial';
    monitorCtx.fillText('Entrada', pad + 20, pad + 34);
    monitorCtx.fillStyle = activeTrade.isWinning ? 'rgba(46,204,113,1)' : 'rgba(231,76,60,1)';
    monitorCtx.beginPath();
    monitorCtx.arc(pad + 10, pad + 45, 4, 0, Math.PI * 2);
    monitorCtx.fill();
    monitorCtx.fillStyle = 'rgba(255,255,255,0.8)';
    monitorCtx.fillText('Actual', pad + 20, pad + 49);
}

// ====================== AUDIO ======================
function initializeAudioSystem() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0.5;
    } catch(e) {
        soundAlertsEnabled = false;
        updateSoundSwitch();
    }
}

function playAlertSound(type) {
    if (!soundAlertsEnabled || !audioContext) return;
    try {
        const osc      = audioContext.createOscillator();
        const envelope = audioContext.createGain();
        osc.connect(envelope);
        envelope.connect(gainNode);
        osc.frequency.value = type === 'win' ? 880 : type === 'loss' ? 440 : 660;
        osc.type = 'sine';
        envelope.gain.setValueAtTime(0, audioContext.currentTime);
        envelope.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
        envelope.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.5);
    } catch(e) {}
}

window.testSound = function(type) {
    playAlertSound(type);
    showInternalNotification(
        type === 'win' ? 'Test Ganancia' : 'Test Pérdida',
        type === 'win' ? 'Sonido de alerta de ganancia' : 'Sonido de alerta de pérdida',
        type === 'win' ? 'success' : 'error'
    );
};

// ====================== NOTIFICACIONES ======================
function requestNotificationPermission() {
    if (!('Notification' in window)) { pushAlertsEnabled = false; updatePushSwitch(); return; }
    if (Notification.permission === 'granted') return;
    if (Notification.permission !== 'denied') {
        setTimeout(() => {
            Notification.requestPermission().then(p => {
                if (p !== 'granted') { pushAlertsEnabled = false; updatePushSwitch(); saveAlertSettings(); }
            });
        }, 3000);
    }
}

function showNotification(title, message, type = 'info') {
    if (pushAlertsEnabled && Notification.permission === 'granted') {
        const n = new Notification('Trading - ' + title, {
            body: (type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️') + ' ' + message,
            icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            tag: 'trading-alert'
        });
        n.onclick = function() { window.focus(); this.close(); };
        setTimeout(() => n.close(), 5000);
    }
    showInternalNotification(title, message, type);
}

function showInternalNotification(title, message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const id = 'notif-' + Date.now();
    const iconClass = type === 'success' ? 'fa-check-circle' :
                      type === 'error'   ? 'fa-times-circle' :
                      type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';

    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.id = id;
    el.innerHTML = `
        <div class="notification-icon"><i class="fas ${iconClass}"></i></div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="closeNotification('${id}')">
            <i class="fas fa-times"></i>
        </button>`;

    container.insertBefore(el, container.firstChild);
    el.offsetHeight;
    el.classList.add('show');
    setTimeout(() => closeNotification(id), 5000);

    const all = container.querySelectorAll('.notification');
    if (all.length > 5) all[all.length - 1].remove();
}

window.closeNotification = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
};

// ====================== ALERTAS CONFIG ======================
window.toggleSoundAlerts = function() {
    soundAlertsEnabled = !soundAlertsEnabled;
    updateSoundSwitch();
    saveAlertSettings();
    showInternalNotification('Configuración',
        soundAlertsEnabled ? 'Alertas sonoras activadas' : 'Alertas sonoras desactivadas',
        soundAlertsEnabled ? 'success' : 'warning');
};

window.togglePushAlerts = function() {
    if (!('Notification' in window)) {
        showInternalNotification('Error', 'Este navegador no soporta notificaciones push', 'error'); return;
    }
    if (Notification.permission === 'denied') {
        showInternalNotification('Error', 'Permiso denegado. Habilítalo en la configuración del navegador.', 'error'); return;
    }
    if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') { pushAlertsEnabled = true; updatePushSwitch(); saveAlertSettings();
                showInternalNotification('Configuración', 'Notificaciones push activadas', 'success'); }
        });
    } else {
        pushAlertsEnabled = !pushAlertsEnabled;
        updatePushSwitch();
        saveAlertSettings();
        showInternalNotification('Configuración',
            pushAlertsEnabled ? 'Notificaciones push activadas' : 'Notificaciones push desactivadas',
            pushAlertsEnabled ? 'success' : 'warning');
    }
};

function updateSoundSwitch() {
    if (!soundAlertSwitch || !soundIndicator) return;
    soundAlertSwitch.classList.toggle('active', soundAlertsEnabled);
    soundIndicator.classList.toggle('active', soundAlertsEnabled);
}

function updatePushSwitch() {
    const on = pushAlertsEnabled && Notification.permission === 'granted';
    if (!pushAlertSwitch || !pushIndicator) return;
    pushAlertSwitch.classList.toggle('active', on);
    pushIndicator.classList.toggle('active', on);
}

function saveAlertSettings() {
    try { localStorage.setItem('alertSettings', JSON.stringify({ soundAlerts: soundAlertsEnabled, pushAlerts: pushAlertsEnabled })); } catch(e) {}
}

function loadAlertSettings() {
    try {
        const saved = localStorage.getItem('alertSettings');
        if (saved) {
            const s = JSON.parse(saved);
            soundAlertsEnabled = s.soundAlerts !== undefined ? s.soundAlerts : true;
            pushAlertsEnabled  = s.pushAlerts  !== undefined ? s.pushAlerts  : true;
            updateSoundSwitch();
            updatePushSwitch();
        }
    } catch(e) {}
}

// ====================== DETECCIÓN DE NIVEL DE PRECIO ======================
function initializeLevelHistory() {
    levelHistory = Array(20).fill('mid');
    updateLevelHistoryDisplay();
}

function updatePriceLevel(currentPrice) {
    const num = parseFloat(currentPrice);
    priceHistory.push(num);
    if (priceHistory.length > PRICE_HISTORY_LENGTH) priceHistory.shift();
    if (priceHistory.length < 3) { currentPriceLevel = 'mid'; return 'mid'; }

    maxPrice = priceHistory.reduce((m, v) => v > m ? v : m, -Infinity);
    minPrice = priceHistory.reduce((m, v) => v < m ? v : m, Infinity);

    if (num === maxPrice && num !== minPrice) currentPriceLevel = 'max';
    else if (num === minPrice && num !== maxPrice) currentPriceLevel = 'min';
    else { currentPriceLevel = 'mid'; greenDigitsCount++; }

    levelHistory.push(currentPriceLevel);
    if (levelHistory.length > 20) levelHistory.shift();

    updateLevelDisplay();
    updateLevelHistoryDisplay();
    updateLevelInfoPanel();
    return currentPriceLevel;
}

function updateLevelDisplay() {
    if (!priceLevelIndicator) return;
    const labels  = { max: 'MÁXIMO', min: 'MÍNIMO', mid: 'MEDIO' };
    const classes = { max: 'level-max', min: 'level-min', mid: 'level-mid' };
    priceLevelIndicator.textContent = labels[currentPriceLevel];
    priceLevelIndicator.className   = 'price-level-indicator ' + classes[currentPriceLevel];
}

function updateLevelHistoryDisplay() {
    if (!levelHistoryEl) return;
    const frag = document.createDocumentFragment();
    levelHistory.forEach(lvl => {
        const span = document.createElement('span');
        span.className = 'level-history-badge history-' + lvl;
        span.textContent = lvl === 'max' ? 'M' : lvl === 'min' ? 'm' : '·';
        frag.appendChild(span);
    });
    levelHistoryEl.innerHTML = '';
    levelHistoryEl.appendChild(frag);
}

function updateLevelInfoPanel() {
    if (!currentLevelDisplay) return;
    const labels = { max: 'MÁXIMO', min: 'MÍNIMO', mid: 'MEDIO' };
    const colors = { max: '#3498db', min: '#e74c3c', mid: '#2ecc71' };
    currentLevelDisplay.textContent = labels[currentPriceLevel];
    currentLevelDisplay.style.color = colors[currentPriceLevel];

    if (priceHistory.length > 0) {
        const xd = obtenerDecimalesPorInstrumento(currentAsset);
        maxPriceDisplay.textContent = maxPrice.toFixed(xd);
        minPriceDisplay.textContent = minPrice.toFixed(xd);
    }

    greenDigitsCountEl.textContent = greenDigitsCount;
    if (lastMaxDigit !== null) { lastMaxDigitEl.textContent = lastMaxDigit; lastMaxDigitEl.style.color = '#3498db'; }
    if (lastMinDigit !== null) { lastMinDigitEl.textContent = lastMinDigit; lastMinDigitEl.style.color = '#e74c3c'; }
}

function updateDigitBadgesWithLevel(digit, level) {
    const firstBadge = digitsContainer ? digitsContainer.firstElementChild : null;
    if (!firstBadge) return;
    firstBadge.classList.remove('max-digit', 'min-digit', 'mid-digit');
    firstBadge.classList.add(level + '-digit');
    if (level === 'max') lastMaxDigit = digit;
    if (level === 'min') lastMinDigit = digit;
}

// ====================== INTERFAZ ======================
window.closeAllModals = function() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('result-panel').style.display = 'none';
};

window.closeResultPanel = function() {
    document.getElementById('result-panel').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
};

window.adjustStake = function(amount) {
    tradingStake = Math.min(10000, Math.max(0.1, tradingStake + amount));
    const inp = document.getElementById('trading-stake');
    if (inp) inp.value = tradingStake.toFixed(2);
    updateStakeDisplay();
};

function updateStakeDisplay() {
    if (callStakeEl) callStakeEl.textContent = `$${tradingStake.toFixed(2)}`;
    if (putStakeEl)  putStakeEl.textContent  = `$${tradingStake.toFixed(2)}`;
}

// ====================== CANVASJS ======================
function initCanvasJSChart() {
    digitsChart = new CanvasJS.Chart('chartContainer', {
        animationEnabled: false,
        theme: 'light2',
        title: { text: '' },
        toolTip: { enabled: true, animationEnabled: true, borderColor: '#ccc', fontColor: '#000', content: '{y}' },
        axisX: { includeZero: false, labelFontSize: 0, gridThickness: 0, tickLength: 0, lineThickness: 1 },
        axisY: {
            stripLines: [{ value: 0, thickness: 1, color: '#ccc' }],
            includeZero: false, labelFontSize: 0, gridThickness: 0, tickLength: 0, lineThickness: 1,
            minimum: -10, maximum: 10
        },
        data: [{ type: 'line', lineColor: '#ccc', lineThickness: 2, markerType: 'none', dataPoints: digitsDataPoints }]
    });
    digitsChart.render();
}

function initPriceChart() {
    priceChart = new CanvasJS.Chart('priceChartContainer', {
        animationEnabled: false,
        theme: 'light2',
        title: { text: '' },
        toolTip: { enabled: true, animationEnabled: true, borderColor: '#ccc', fontColor: '#000', content: '{y}' },
        axisX: { includeZero: false, labelFontSize: 0, gridThickness: 0, tickLength: 0, lineThickness: 1 },
        axisY: { includeZero: false, labelFontSize: 0, gridThickness: 0, tickLength: 0, lineThickness: 1 },
        data: [{ type: 'line', lineColor: '#ccc', lineThickness: 2, markerType: 'none', dataPoints: priceDataPoints }]
    });
    priceChart.render();
}

function updateCanvasJSChart(digit, wentUp, processedDigit) {
    if (!digitsChart) return;
    const yValue = wentUp ? parseFloat(processedDigit) : -parseFloat(processedDigit);

    const allY  = digitsDataPoints.map(p => p.y);
    const maxY  = allY.reduce((m, v) => v > m ? v : m, yValue);
    const minY  = allY.reduce((m, v) => v < m ? v : m, yValue);

    const markerColor = yValue === maxY ? '#29abe2' : yValue === minY ? '#c03' : 'black';
    const mSize       = (yValue === maxY || yValue === minY || digitsDataPoints.length === 0) ? 6 : 3;

    digitsDataPoints.push({
        x: currentPosition++,
        y: yValue,
        indexLabel: Math.abs(processedDigit).toString(),
        indexLabelFontWeight: 'bold',
        indexLabelFontSize: 16,
        indexLabelFontColor: wentUp ? '#29abe2' : '#c03',
        markerSize: mSize,
        markerType: 'circle',
        markerColor: markerColor,
        markerBorderColor: '#ccc'
    });

    if (digitsDataPoints.length > 20) {
        digitsDataPoints.shift();
        digitsDataPoints.forEach((pt, i) => { pt.x = i + 1; });
        currentPosition = digitsDataPoints.length + 1;
    }

    digitsChart.options.data[0].dataPoints = digitsDataPoints;
    digitsChart.render();
}

function updatePriceChart(price, digit, wentUp) {
    if (!priceChart) return;
    const xd  = obtenerDecimalesPorInstrumento(currentAsset);
    const num = parseFloat(parseFloat(price).toFixed(xd));

    priceDataPoints.push({
        x: priceChartPosition++,
        y: num,
        indexLabel: digit.toString(),
        indexLabelFontWeight: 'bold',
        indexLabelFontSize: 16,
        indexLabelFontColor: wentUp ? '#29abe2' : '#c03',
        markerSize: 3,
        markerType: 'circle',
        markerColor: 'black',
        markerBorderColor: '#ccc'
    });

    if (priceDataPoints.length > 20) {
        priceDataPoints.shift();
        priceDataPoints.forEach((pt, i) => { pt.x = i + 1; });
        priceChartPosition = priceDataPoints.length + 1;
    }

    if (priceDataPoints.length > 1) {
        const ys  = priceDataPoints.map(p => p.y);
        const mn  = ys.reduce((m, v) => v < m ? v : m, Infinity);
        const mx  = ys.reduce((m, v) => v > m ? v : m, -Infinity);
        const rng = mx - mn;
        priceChart.options.axisY.minimum = mn - rng * 0.1;
        priceChart.options.axisY.maximum = mx + rng * 0.1;
    }

    priceChart.options.data[0].dataPoints = priceDataPoints;
    priceChart.render();
}

window.clearChart = function() {
    digitsDataPoints = [];
    currentPosition  = 1;
    digits = [];
    digitHistory = [];
    if (digitsChart) { digitsChart.options.data[0].dataPoints = []; digitsChart.render(); }
    if (digitsContainer) digitsContainer.innerHTML = '';
    if (digitCountEl)    digitCountEl.textContent = '0';

    // FIX LIMPIAR PATRÓN: Limpiar también el buffer de estrategia y el panel
    // de "PATRÓN ACTUAL (5 DÍGITOS)" al pulsar el botón de limpiar gráfico de dígitos.
    strategyBuffer = [];
    if (patternDigitsRow) {
        patternDigitsRow.innerHTML = '<div class="pattern-placeholder">Esperando dígitos...</div>';
    }
    if (blueDigitsEl)  blueDigitsEl.textContent  = '-';
    if (redDigitsEl)   redDigitsEl.textContent   = '-';
    if (blueDirEl)     blueDirEl.textContent      = '—';
    if (redDirEl)      redDirEl.textContent       = '—';
    if (!strategyPaused && strategySignalBox) {
        setStrategyStatusBar('resumed', 'Buffer limpiado — Esperando nuevos dígitos...');
    }
};

window.clearPriceChart = function() {
    priceDataPoints    = [];
    priceChartPosition = 1;
    priceHistory       = [];
    greenDigitsCount   = 0;
    lastMaxDigit = lastMinDigit = null;
    levelHistory = [];
    initializeLevelHistory();
    updateLevelInfoPanel();
    if (priceChart) {
        priceChart.options.data[0].dataPoints = [];
        delete priceChart.options.axisY.minimum;
        delete priceChart.options.axisY.maximum;
        priceChart.render();
    }
};

// ====================== MONITOR DE OPERACIÓN ======================
function startTradeMonitorWithRealData(contractId, tradeType, entryPrice, entryPriceDisplayed, entryTime) {
    // FIX #3: Guardar startTime como timestamp numérico (ms) para evitar que
    // "Invalid Date" cause NaN:NaN en el timer de tiempo transcurrido.
    const startTimestamp = (entryTime instanceof Date && !isNaN(entryTime.getTime()))
        ? entryTime.getTime()
        : Date.now();

    activeTrade = {
        id: contractId, type: tradeType,
        entryPrice, entryPriceDisplayed,
        currentPrice: entryPrice,
        startTime: startTimestamp,
        ticksRemaining: 5, currentTickIndex: 1,
        isWinning: false, profitLoss: 0
    };

    contractTicks    = [{ price: entryPrice, timestamp: startTimestamp, tick_index: 1 }];
    priceHistoryData = contractTicks.map(t => ({ price: t.price, timestamp: t.timestamp }));

    tradeMonitorEl.classList.remove('hidden');
    updateTradeMonitorWithRealData();

    if (monitorInterval) clearInterval(monitorInterval);
    monitorInterval = setInterval(() => {
        if (activeTrade) updateElapsedTime();
    }, 1000);

    showNotification('Operación Iniciada',
        `${tradeType} @ $${entryPrice.toFixed(4)} (ID: ${contractId.substring(0,8)}...)`, 'info');

    resizeMonitorCanvas();
}

function updateTradeMonitorWithRealData() {
    if (!activeTrade) return;
    const xd = obtenerDecimalesPorInstrumento(currentAsset);

    if (infoEntryPriceEl)   infoEntryPriceEl.textContent   = activeTrade.entryPrice.toFixed(xd);
    if (infoCurrentPriceEl) infoCurrentPriceEl.textContent = activeTrade.currentPrice.toFixed(xd);

    const diff = activeTrade.currentPrice - activeTrade.entryPrice;
    const pct  = (diff / activeTrade.entryPrice) * 100;
    const isWinning = activeTrade.type === 'CALL' ? diff > 0 : diff < 0;
    activeTrade.isWinning  = isWinning;
    activeTrade.profitLoss = diff;

    updateMonitorStatus(isWinning);
    updateMonitorInfoPanel(activeTrade.entryPrice, activeTrade.currentPrice, diff, pct, xd);

    if (ticksRemainingEl) {
        ticksRemainingEl.textContent = `${activeTrade.ticksRemaining} ticks`;
        ticksRemainingEl.style.color = activeTrade.ticksRemaining <= 2 ? 'var(--danger-color)' :
                                       activeTrade.ticksRemaining <= 3 ? 'var(--warning-color)' : '';
    }

    if (infoCurrentTickEl) infoCurrentTickEl.textContent = `${activeTrade.currentTickIndex || 0}/5`;
    drawMonitorChartWithRealData();
}

function updateMonitorInfoPanel(entryPrice, currentPrice, diff, pct, xd) {
    if (!infoEntryPriceEl) return;
    infoEntryPriceEl.textContent   = entryPrice.toFixed(xd);
    infoCurrentPriceEl.textContent = currentPrice.toFixed(xd);
    infoCurrentPriceEl.className = `monitor-info-value ${diff >= 0 ? 'positive' : 'negative'}`;
    infoPriceDifferenceEl.innerHTML = `${diff.toFixed(xd)}<span class="profit-indicator ${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? '+' : ''}${diff.toFixed(xd)}</span>`;
    infoPriceDifferenceEl.className = `monitor-info-value ${diff >= 0 ? 'positive' : 'negative'}`;
    infoPercentageChangeEl.textContent = `${pct >= 0 ? '+' : ''}${pct.toFixed(4)}%`;
    infoPercentageChangeEl.className   = `monitor-info-value ${pct >= 0 ? 'positive' : 'negative'}`;
    infoTradeStateEl.textContent = diff >= 0 ? 'GANANDO' : 'PERDIENDO';
    infoTradeStateEl.className   = `monitor-info-value ${diff >= 0 ? 'positive' : 'negative'}`;
}

function updateMonitorWithRealData(realTicks) {
    if (!activeTrade || !realTicks.length) return;
    const last = realTicks[realTicks.length - 1];
    activeTrade.currentPrice     = last.price;
    activeTrade.ticksRemaining   = 5 - last.tick_index;
    activeTrade.currentTickIndex = last.tick_index;

    const diff      = activeTrade.currentPrice - activeTrade.entryPrice;
    const pct       = (diff / activeTrade.entryPrice) * 100;
    const isWinning = activeTrade.type === 'CALL' ? diff > 0 : diff < 0;

    activeTrade.isWinning  = isWinning;
    activeTrade.profitLoss = diff;

    updateMonitorStatus(isWinning);
    const xd = obtenerDecimalesPorInstrumento(currentAsset);
    updateMonitorInfoPanel(activeTrade.entryPrice, activeTrade.currentPrice, diff, pct, xd);

    priceHistoryData = realTicks.map(t => ({ price: t.price, timestamp: t.timestamp }));
    if (infoCurrentTickEl) infoCurrentTickEl.textContent = `${last.tick_index}/5`;
    drawMonitorChartWithRealData();
}

function updateElapsedTime() {
    if (!activeTrade || !infoElapsedTimeEl) return;
    const s = Math.floor((Date.now() - activeTrade.startTime) / 1000);
    infoElapsedTimeEl.textContent =
        String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function updateMonitorStatus(isWinning) {
    if (!monitorStatusEl) return;
    monitorStatusEl.className = 'monitor-status ' + (isWinning ? 'winning' : 'losing');
    monitorStatusEl.innerHTML = `<i class="fas fa-circle"></i><span>${isWinning ? 'GANANDO' : 'PERDIENDO'}</span>`;
    if (monitorChartEl) {
        monitorChartEl.style.backgroundColor = isWinning ? 'rgba(46,204,113,0.05)' : 'rgba(231,76,60,0.05)';
        monitorChartEl.style.borderColor      = isWinning ? 'rgba(46,204,113,0.2)'  : 'rgba(231,76,60,0.2)';
    }
}

function stopTradeMonitor() {
    if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
    setTimeout(() => { if (tradeMonitorEl) tradeMonitorEl.classList.add('hidden'); }, 3000);
    activeTrade    = null;
    contractTicks  = [];
}

// ====================== TRADING ======================
window.executeTrade = function(type) {
    // FIX #5: Cuando executeTrade falla por validación (balance insuficiente, etc.),
    // strategyPaused quedaba en true bloqueando el análisis indefinidamente.
    // Ahora se limpia strategyPaused en todos los casos de fallo, excepto stopTriggered.
    if (!running) {
        alert('⚠️ Primero debes conectar el feed de precios');
        strategyPaused = false;
        isTrading = false;
        return;
    }
    if (isTrading) {
        alert('⏳ Ya hay una operación en curso. Espera a que termine.');
        strategyPaused = false;
        return;
    }
    if (tradingStake <= 0) {
        alert('❌ El monto a operar debe ser mayor a 0');
        strategyPaused = false;
        isTrading = false;
        return;
    }
    if (tradingStake > balance) {
        alert('❌ Saldo insuficiente');
        strategyPaused = false;
        isTrading = false;
        return;
    }
    if (stopTriggered) {
        alert('🛑 El sistema está detenido por Stop Win/Loss. Ajusta los límites para continuar.');
        return; // stopTriggered sí debe mantener strategyPaused = true
    }

    isTrading = true;
    tradeStatusEl.textContent  = 'OPERANDO...';
    tradeStatusEl.style.color  = '#f39c12';
    window.operarAutomatico(type === 'CALL' ? 'UP' : 'DOWN', tradingStake);
};

function procesarResultadoTrading(ganancia, tradeType) {
    isTrading = false;
    stopTradeMonitor();

    // FIX SALDO: No modificar 'balance' manualmente aquí.
    // Al comprar se descuenta el stake (balance -= stake) y al terminar
    // el contrato Deriv envía un evento data.balance con el saldo real,
    // que es la fuente de verdad. Sumar ganancia aquí causaba doble cómputo
    // y un saldo incorrecto al terminar cada operación.
    // Solo actualizamos totalProfit para el P&L interno de sesión.
    totalProfit  += ganancia;
    totalTrades++;
    ganancia > 0 ? wins++ : losses++;

    // Actualizar resultado en el historial de señales
    updateLastSignalResult(ganancia);

    // FIX #6: El tipo de operación se mostraba hardcodeado ('CALL'/'PUT').
    // Ahora se usa el tipo real recibido como parámetro.
    if (lastTradeEl) {
        const label = tradeType || (ganancia > 0 ? 'CALL' : 'PUT');
        lastTradeEl.innerHTML = ganancia > 0
            ? `<span style="color:#27ae60">${label} +$${ganancia.toFixed(2)}</span>`
            : `<span style="color:#e74c3c">${label} -$${Math.abs(ganancia).toFixed(2)}</span>`;
    }

    updateTradingDisplay();
    if (winRateEl) winRateEl.textContent = `${totalTrades > 0 ? Math.round(wins / totalTrades * 100) : 0}%`;

    tradeStatusEl.textContent = 'LISTO';
    tradeStatusEl.style.color = '#27ae60';

    if (ganancia > 0) {
        showNotification('¡Operación Ganadora!', `+$${ganancia.toFixed(2)} | Balance: $${balance.toFixed(2)}`, 'success');
        if (soundAlertsEnabled) playAlertSound('win');
    } else {
        showNotification('Operación Perdedora', `-$${Math.abs(ganancia).toFixed(2)} | Balance: $${balance.toFixed(2)}`, 'error');
        if (soundAlertsEnabled) playAlertSound('loss');
    }

    // Verificar Stop Win / Stop Loss ANTES de reanudar estrategia
    const stopped = checkStopConditions();

    if (!stopped) {
        strategyPaused = false;
        strategyBuffer = [];
        setStrategyStatusBar('resumed', 'Resultado recibido — Buscando nuevo patrón');
        showInternalNotification('🔍 Análisis reanudado', 'Buscando nuevo patrón de 5 dígitos...', 'success');
    }
}

function updateTradingDisplay() {
    if (balanceEl)     balanceEl.textContent = `$${balance.toFixed(2)}`;
    if (totalProfitEl) {
        totalProfitEl.textContent = `$${totalProfit > 0 ? '+' : ''}${totalProfit.toFixed(2)}`;
        totalProfitEl.style.color = totalProfit >= 0 ? '#27ae60' : '#e74c3c';
    }
    if (winsEl)        winsEl.textContent        = wins;
    if (lossesEl)      lossesEl.textContent       = losses;
    if (totalTradesEl) totalTradesEl.textContent   = totalTrades;

    const inp = document.getElementById('trading-stake');
    if (inp) inp.style.borderColor = parseFloat(inp.value) > balance ? '#e74c3c' : '';
}

// ====================== RESULTADO MODAL ======================
function mostrarResultadoOperacion(profit, status, contract_id) {
    const resultContent = document.getElementById('result-content');
    if (!resultContent) return;

    lastResults.unshift({ profit, status, contract_id, time: new Date().toLocaleTimeString(), balance });
    if (lastResults.length > 5) lastResults.pop();

    const frag = document.createDocumentFragment();
    lastResults.forEach(r => {
        const div = document.createElement('div');
        div.className = 'result-section';
        div.style.cssText = `border:2px solid ${r.profit > 0 ? '#27ae60' : '#e74c3c'};border-radius:8px;padding:15px;margin-top:8px;background:rgba(255,255,255,0.04)`;
        div.innerHTML = `
            <div class="result-section-title" style="color:${r.profit > 0 ? '#27ae60' : '#e74c3c'};font-size:1.1rem;margin-bottom:10px;">
                <i class="fas fa-${r.profit > 0 ? 'trophy' : 'times-circle'}"></i>
                ${r.profit > 0 ? 'OPERACIÓN GANADORA ✅' : 'OPERACIÓN PERDEDORA ❌'}
            </div>
            <div class="info-line"><span style="color:#95a5a6;">Contract ID:</span><span style="font-family:monospace;">${r.contract_id}</span></div>
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
    });

    resultContent.innerHTML = '';
    resultContent.appendChild(frag);
    document.getElementById('result-panel').style.display = 'block';
    document.getElementById('overlay').style.display      = 'block';
}

// ====================== SISTEMA DE TICKS ======================
function startTicksPerMinuteCounter() {
    if (minuteTimer) clearInterval(minuteTimer);
    minuteTimer = setInterval(() => { ticksPerMinute = ticksCounter; ticksCounter = 0; }, 60000);
}

function addTickToHistory(price, digit, direction) {
    ticksHistory.unshift({ price, digit, direction, time: new Date().toLocaleTimeString() });
    if (ticksHistory.length > 10) ticksHistory.pop();
}

function updateDigitsContainer(digit, wentUp, level) {
    digits.push({ value: digit, up: wentUp, level });
    if (digits.length > 10) digits.shift();

    if (digitCountEl)        digitCountEl.textContent        = digits.length;
    if (greenDigitCountBadge) greenDigitCountBadge.textContent = greenDigitsCount;

    if (!digitsContainer) return;

    const span = document.createElement('span');
    let cls = wentUp ? 'digit-badge digit-blue' : 'digit-badge digit-red';
    if (level === 'max') cls += ' max-digit';
    else if (level === 'min') cls += ' min-digit';
    else cls += ' mid-digit';
    span.className   = cls;
    span.textContent = digit;
    digitsContainer.insertBefore(span, digitsContainer.firstChild);

    while (digitsContainer.children.length > 10) {
        digitsContainer.removeChild(digitsContainer.lastChild);
    }
}

// ====================== PROCESAMIENTO DE PRECIOS ======================
function obtenerDecimalesPorInstrumento(assetValue) {
    const map = { R_100: 2, R_10: 3, R_25: 3, R_50: 4, R_75: 4, RDBEAR: 4, RDBULL: 4, frxEURUSD: 5, frxEURJPY: 3 };
    return map[assetValue] || 2;
}

function esInstrumentoForex(assetValue) {
    return assetValue === 'frxEURUSD' || assetValue === 'frxEURJPY';
}

function extractDigitAfterDecimal(price) {
    const xd  = obtenerDecimalesPorInstrumento(currentAsset);
    const fmt = parseFloat(price).toFixed(xd);
    if (esInstrumentoForex(currentAsset)) {
        const parts = fmt.split('.');
        return parseInt(parts[1] ? parts[1].slice(-1) : '0');
    }
    return parseInt(fmt.slice(-1));
}

function procesarDigitoConLogica010(digitActual, digitAnterior, wentUp) {
    if (digitActual !== 0) return wentUp ? parseFloat(digitActual) : -parseFloat(digitActual);
    if (digitAnterior > 5) return wentUp ? 10 : -10;
    return 0;
}

function determineTrend(currentPrice, lp) {
    if (lp === null) return true;
    const xd = obtenerDecimalesPorInstrumento(currentAsset);
    return parseFloat(parseFloat(currentPrice).toFixed(xd)) >= parseFloat(parseFloat(lp).toFixed(xd));
}

function updateDigit(price, wentUp) {
    const xd             = obtenerDecimalesPorInstrumento(currentAsset);
    const formattedPrice = parseFloat(price).toFixed(xd);
    const digit          = extractDigitAfterDecimal(price);
    const level          = updatePriceLevel(formattedPrice);
    const digitAnterior  = digitHistory.length > 0 ? digitHistory[digitHistory.length - 1] : null;
    const processedVal   = procesarDigitoConLogica010(digit, digitAnterior, wentUp);

    digitHistory.push(digit);
    if (digitHistory.length > 20) digitHistory.shift();

    updateCanvasJSChart(digit, wentUp, Math.abs(processedVal));
    updatePriceChart(price, digit, wentUp);
    updateDigitsContainer(digit, wentUp, level);
    updateDigitBadgesWithLevel(digit, level);

    tickCount++;
    ticksCounter++;
    addTickToHistory(formattedPrice, digit, wentUp ? 'UP' : 'DOWN');
    lastPrice = price;

    feedStrategyDigit(Math.abs(processedVal), wentUp);

    requestAnimationFrame(() => {
        if (currentDigitEl) {
            currentDigitEl.textContent = digit;
            currentDigitEl.className   = 'current-digit ' + (wentUp ? 'up' : 'down');
            if (level === 'mid') currentDigitEl.classList.add('digit-green');
        }
        if (priceEl) priceEl.textContent = formattedPrice;
    });
}

// ====================== WEBSOCKET: FEED DE PRECIOS ======================
window.startFeed = function() {
    if (running || isConnecting) return;
    currentAsset = cachedAssetSelector ? cachedAssetSelector.value : 'R_10';
    updateConnectionStatus('Conectando...', '#f39c12');
    isConnecting = true;

    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        isConnecting = false;
        ws.send(JSON.stringify({ ticks: currentAsset, subscribe: 1 }));
        running = true;
        updateConnectionStatus('Conectado', '#27ae60');
    };

    ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.tick) {
            const price  = parseFloat(data.tick.quote).toFixed(6);
            const wentUp = determineTrend(price, lastPrice);
            updateDigit(price, wentUp);
        }
    };

    ws.onclose = () => {
        running      = false;
        isConnecting = false;
        updateConnectionStatus('Desconectado', '#e74c3c');
        setTimeout(() => { if (!running && !isConnecting) window.startFeed(); }, 5000);
    };

    ws.onerror = () => {
        isConnecting = false;
        updateConnectionStatus('Error de conexión', '#e74c3c');
    };
};

window.stopFeed = function() {
    if (ws) { ws.onclose = null; ws.close(); }
    running      = false;
    isConnecting = false;
    updateConnectionStatus('Desconectado', '#e74c3c');
};

// ====================== ESTRATEGIA CARTESIANA (PATRÓN 5 DÍGITOS) ======================
let strategyBuffer  = [];
let signalCalls     = 0;
let signalPuts      = 0;
let signalNone      = 0;
let strategyPaused  = false;

// Array para exportar historial de señales a CSV
let signalsExportData = [];
// Referencia al último item del historial pendiente de resultado
let lastSignalHistoryItem = null;
let lastSignalExportIndex = -1;

// Cache de elementos de estrategia
let patternDigitsRow, blueDirEl, redDirEl, blueDigitsEl, redDigitsEl;
let strategySignalBox, signalIconEl, signalTextEl, signalDetailEl;
let signalsHistoryEl, signalCallsEl, signalPutsEl, signalNoneEl;

function initStrategyElements() {
    patternDigitsRow  = document.getElementById('pattern-digits-row');
    blueDirEl         = document.getElementById('blue-direction');
    redDirEl          = document.getElementById('red-direction');
    blueDigitsEl      = document.getElementById('blue-digits-display');
    redDigitsEl       = document.getElementById('red-digits-display');
    strategySignalBox = document.getElementById('strategy-signal-box');
    signalIconEl      = document.getElementById('signal-icon');
    signalTextEl      = document.getElementById('signal-text');
    signalDetailEl    = document.getElementById('signal-detail');
    signalsHistoryEl  = document.getElementById('signals-history');
    signalCallsEl     = document.getElementById('signal-calls');
    signalPutsEl      = document.getElementById('signal-puts');
    signalNoneEl      = document.getElementById('signal-none');
}

function updateStrategyStats() {
    if (signalCallsEl) signalCallsEl.textContent = signalCalls;
    if (signalPutsEl)  signalPutsEl.textContent  = signalPuts;
    if (signalNoneEl)  signalNoneEl.textContent  = signalNone;
}

function highlightTradeButton(signal) {
    const callBtn = document.querySelector('.btn-call');
    const putBtn  = document.querySelector('.btn-put');
    if (!callBtn || !putBtn) return;

    if (signal === 'CALL') {
        callBtn.classList.add('btn-signal-highlight');
        putBtn.classList.remove('btn-signal-highlight');
        setTimeout(() => callBtn.classList.remove('btn-signal-highlight'), 4000);
    } else {
        putBtn.classList.add('btn-signal-highlight');
        callBtn.classList.remove('btn-signal-highlight');
        setTimeout(() => putBtn.classList.remove('btn-signal-highlight'), 4000);
    }
}

function feedStrategyDigit(digitValue, isBlue) {
    strategyBuffer.push({ value: digitValue, blue: isBlue });
    if (strategyBuffer.length > 5) strategyBuffer.shift();
    if (strategyPaused) return;
    runStrategyAnalysis();
}

function setStrategyStatusBar(state, message) {
    if (!strategySignalBox) return;
    if (state === 'paused') {
        strategySignalBox.className = 'strategy-signal-box signal-paused';
        if (signalIconEl)   signalIconEl.innerHTML    = '<i class="fas fa-pause-circle"></i>';
        if (signalTextEl)   signalTextEl.textContent  = 'ANÁLISIS PAUSADO';
        if (signalDetailEl) signalDetailEl.textContent = message || 'Esperando resultado de operación...';
    } else if (state === 'resumed') {
        strategySignalBox.className = 'strategy-signal-box signal-none';
        if (signalIconEl)   signalIconEl.innerHTML    = '<i class="fas fa-search"></i>';
        if (signalTextEl)   signalTextEl.textContent  = 'ANALIZANDO...';
        if (signalDetailEl) signalDetailEl.textContent = message || 'Buscando nuevo patrón de 5 dígitos';
        if (patternDigitsRow) patternDigitsRow.innerHTML = '<div class="pattern-placeholder">Esperando dígitos...</div>';
        if (blueDigitsEl)  blueDigitsEl.textContent  = '-';
        if (redDigitsEl)   redDigitsEl.textContent   = '-';
        if (blueDirEl)     blueDirEl.textContent     = '—';
        if (redDirEl)      redDirEl.textContent      = '—';
    }
}

function updateConnectionStatus(text, color) {
    if (statusText) { statusText.textContent = text; statusText.style.color = color; }
    if (statusDot)  statusDot.style.backgroundColor = color;
}

function analyzeSequence(values) {
    if (values.length < 2) return null;
    const unique = new Set(values);
    if (unique.size !== values.length) return null;

    let isStrictlyUp   = true;
    let isStrictlyDown = true;

    for (let i = 1; i < values.length; i++) {
        if (values[i] <= values[i - 1]) isStrictlyUp   = false;
        if (values[i] >= values[i - 1]) isStrictlyDown = false;
    }

    if (isStrictlyUp)   return 'up';
    if (isStrictlyDown) return 'down';
    return null;
}

function toMarketDirection(numericDir, isBlue) {
    if (numericDir === null) return null;
    if (isBlue) return numericDir === 'up' ? 'alcista' : 'bajista';
    else        return numericDir === 'down' ? 'alcista' : 'bajista';
}

function runStrategyAnalysis() {
    if (!patternDigitsRow) return;

    const buf = strategyBuffer.slice(-5);

    if (patternDigitsRow) {
        patternDigitsRow.innerHTML = '';
        if (buf.length < 5) {
            patternDigitsRow.innerHTML = `<div class="pattern-placeholder">Esperando ${5 - buf.length} dígito(s) más...</div>`;
        } else {
            buf.forEach(d => {
                const span = document.createElement('span');
                span.className = d.blue ? 'pattern-digit-badge blue' : 'pattern-digit-badge red';
                span.textContent = d.value;
                patternDigitsRow.appendChild(span);
            });
        }
    }

    if (buf.length < 5) {
        setSignalUI('none', 'ESPERANDO', `Necesito ${5 - buf.length} dígito(s) más`, false);
        if (blueDigitsEl) blueDigitsEl.textContent = '-';
        if (redDigitsEl)  redDigitsEl.textContent  = '-';
        if (blueDirEl)    blueDirEl.textContent     = '—';
        if (redDirEl)     redDirEl.textContent      = '—';
        return;
    }

    const blues = buf.filter(d =>  d.blue);
    const reds  = buf.filter(d => !d.blue);

    const primerEsRojo = !buf[0].blue;
    const primerEsAzul =  buf[0].blue;

    const esPatronCALL = (reds.length === 3 && blues.length === 2 && primerEsRojo);
    const esPatronPUT  = (blues.length === 3 && reds.length === 2 && primerEsAzul);

    if (blueDigitsEl) blueDigitsEl.textContent = blues.length
        ? `${blues.map(d => d.value).join(' → ')}  (${blues.length})`
        : 'Ninguno (0)';
    if (redDigitsEl) redDigitsEl.textContent = reds.length
        ? `${reds.map(d => d.value).join(' → ')}  (${reds.length})`
        : 'Ninguno (0)';

    if (!esPatronCALL && !esPatronPUT) {
        const blueNumDir = blues.length >= 2 ? analyzeSequence(blues.map(d => d.value)) : null;
        const redNumDir  = reds.length  >= 2 ? analyzeSequence(reds.map(d  => d.value)) : null;
        updateDirEl(blueDirEl, blueNumDir === null ? null : toMarketDirection(blueNumDir, true),  blues.length);
        updateDirEl(redDirEl,  redNumDir  === null ? null : toMarketDirection(redNumDir,  false), reds.length);
        const propOkCall = reds.length === 3 && blues.length === 2;
        const propOkPut  = blues.length === 3 && reds.length === 2;
        let motivo = `R:${reds.length} A:${blues.length}`;
        if (propOkCall && !primerEsRojo) motivo += ' — CALL requiere iniciar con R';
        else if (propOkPut && !primerEsAzul) motivo += ' — PUT requiere iniciar con A';
        else motivo += ' — Se requiere 3R+2A iniciando R (CALL) o 3A+2R iniciando A (PUT)';
        setSignalUI('none', 'PATRÓN INVÁLIDO', motivo, true);
        return;
    }

    const blueNumDir = blues.length >= 2 ? analyzeSequence(blues.map(d => d.value)) : (blues.length === 1 ? 'one' : null);
    const redNumDir  = reds.length  >= 2 ? analyzeSequence(reds.map(d  => d.value)) : (reds.length  === 1 ? 'one' : null);

    const blueMarket = blueNumDir === 'one' ? null : toMarketDirection(blueNumDir, true);
    const redMarket  = redNumDir  === 'one' ? null : toMarketDirection(redNumDir, false);

    updateDirEl(blueDirEl, blueMarket, blues.length);
    updateDirEl(redDirEl,  redMarket,  reds.length);

    if (blueMarket === null && redMarket === null) {
        setSignalUI('none', 'SIN SEÑAL', 'No hay dirección clara en ningún grupo', true);
    } else if (blueMarket === null) {
        setSignalUI('none', 'SIN SEÑAL', 'Dígitos azules sin dirección clara (retroceso o repetición)', true);
    } else if (redMarket === null) {
        setSignalUI('none', 'SIN SEÑAL', 'Dígitos rojos sin dirección clara (retroceso o repetición)', true);
    } else if (blueMarket === redMarket) {
        const isCall = blueMarket === 'alcista';
        const proporcionOk = isCall ? esPatronCALL : esPatronPUT;
        if (proporcionOk) {
            setSignalUI(isCall ? 'call' : 'put',
                isCall ? '🟢 CALL — ALCISTA' : '🔴 PUT — BAJISTA',
                `Proporción ${isCall ? '3R+2A' : '3A+2R'} ✓ | Azules: ${blueMarket} | Rojos: ${redMarket}`,
                true, isCall ? 'CALL' : 'PUT');
        } else {
            setSignalUI('none', 'PROPORCIÓN CONFLICTO',
                `Dirección ${blueMarket} pero proporción no coincide (R:${reds.length} A:${blues.length})`, true);
        }
    } else {
        setSignalUI('none', 'CONFLICTO', `Azules: ${blueMarket} vs Rojos: ${redMarket}`, true);
    }
}

function updateDirEl(el, marketDir, count) {
    if (!el) return;
    if (count < 2) {
        el.textContent = count === 0 ? '—' : 'Solo 1 dígito';
        el.className   = 'analysis-direction neutral';
        return;
    }
    if (marketDir === 'alcista') {
        el.textContent = '▲ ALCISTA';
        el.className   = 'analysis-direction bullish';
    } else if (marketDir === 'bajista') {
        el.textContent = '▼ BAJISTA';
        el.className   = 'analysis-direction bearish';
    } else {
        el.textContent = '⚠ SIN DIRECCIÓN';
        el.className   = 'analysis-direction neutral';
    }
}

function setSignalUI(type, text, detail, addToHistory, tradeSignal) {
    if (!strategySignalBox) return;

    strategySignalBox.className = 'strategy-signal-box signal-' + type;
    if (signalTextEl)   signalTextEl.textContent   = text;
    if (signalDetailEl) signalDetailEl.textContent = detail;

    if (type === 'call') {
        if (signalIconEl) signalIconEl.innerHTML = '<i class="fas fa-arrow-up"></i>';
    } else if (type === 'put') {
        if (signalIconEl) signalIconEl.innerHTML = '<i class="fas fa-arrow-down"></i>';
    } else {
        if (signalIconEl) signalIconEl.innerHTML = '<i class="fas fa-minus-circle"></i>';
    }

    if (addToHistory && tradeSignal) {
        if (tradeSignal === 'CALL') signalCalls++;
        else if (tradeSignal === 'PUT') signalPuts++;

        // Capturar el patrón actual del buffer (los últimos 5 dígitos)
        const patternSnapshot = strategyBuffer.slice(-5);
        const patternStr = patternSnapshot.map(d => {
            const val = d.value === 10 ? '10' : String(d.value);
            return val + (d.blue ? 'A' : 'R');
        }).join('-');
        addSignalToHistory(type, text, detail, patternStr);
        updateStrategyStats();
        highlightTradeButton(tradeSignal);
        playAlertSound('signal');
        showInternalNotification(
            '📊 Señal detectada — Operando automáticamente',
            `${text} — ${detail}`,
            type === 'call' ? 'success' : 'error'
        );

        // Ejecutar operación solo si no hay stop activado
        if (!isTrading && running && !stopTriggered) {
            strategyPaused = true;
            strategyBuffer = [];
            setStrategyStatusBar('paused', `⏳ OPERACIÓN ${tradeSignal} EN CURSO — Análisis pausado`);
            window.executeTrade(tradeSignal);
        } else if (stopTriggered) {
            showInternalNotification(
                '🛑 Sistema detenido',
                'Stop Win/Loss activo — señal ignorada.',
                'warning'
            );
        }
    } else if (addToHistory && type === 'none') {
        signalNone++;
        updateStrategyStats();
    }
}

function addSignalToHistory(type, text, detail, patternStr) {
    if (!signalsHistoryEl) return;
    const item = document.createElement('div');
    item.className = 'signal-history-item signal-hist-' + type;
    const time = new Date().toLocaleTimeString();
    const patternHtml = patternStr
        ? `<span class="sig-pattern"><i class="fas fa-th-list"></i> ${patternStr}</span>`
        : '';
    item.innerHTML = `<span class="sig-time">${time}</span><span class="sig-label">${text}</span><span class="sig-detail">${detail}</span>${patternHtml}<span class="sig-result sig-result-pending"><i class="fas fa-clock"></i> Esperando resultado...</span>`;
    signalsHistoryEl.insertBefore(item, signalsHistoryEl.firstChild);
    while (signalsHistoryEl.children.length > 10) {
        signalsHistoryEl.removeChild(signalsHistoryEl.lastChild);
    }

    // Guardar referencia para actualizar con el resultado
    lastSignalHistoryItem = item;

    // Guardar en array de exportación
    const now = new Date();
    signalsExportData.push({
        fecha: now.toLocaleDateString(),
        hora: now.toLocaleTimeString(),
        tipo: type === 'call' ? 'CALL' : 'PUT',
        señal: text.replace(/[🟢🔴]/g, '').trim(),
        detalle: detail,
        patron: patternStr || '',
        resultado: 'Pendiente',
        ganancia: ''
    });
    lastSignalExportIndex = signalsExportData.length - 1;
}

// Actualiza el último item del historial con el resultado de la operación
function updateLastSignalResult(profit) {
    if (lastSignalHistoryItem) {
        const resEl = lastSignalHistoryItem.querySelector('.sig-result');
        if (resEl) {
            const ganó = profit > 0;
            resEl.className = 'sig-result ' + (ganó ? 'sig-result-win' : 'sig-result-loss');
            resEl.innerHTML = ganó
                ? `<i class="fas fa-check-circle"></i> GANÓ +$${profit.toFixed(2)}`
                : `<i class="fas fa-times-circle"></i> PERDIÓ -$${Math.abs(profit).toFixed(2)}`;
        }
        lastSignalHistoryItem = null;
    }
    if (lastSignalExportIndex >= 0 && signalsExportData[lastSignalExportIndex]) {
        signalsExportData[lastSignalExportIndex].resultado = profit > 0 ? 'GANÓ' : 'PERDIÓ';
        signalsExportData[lastSignalExportIndex].ganancia  = (profit > 0 ? '+' : '') + profit.toFixed(2);
        lastSignalExportIndex = -1;
    }
}

// ====================== EXPORTAR CSV ======================
window.exportSignalsCSV = function() {
    if (!signalsExportData.length) {
        showInternalNotification('⚠️ Sin datos', 'No hay señales en el historial para exportar.', 'warning');
        return;
    }

    const headers = ['Fecha', 'Hora', 'Tipo', 'Señal', 'Detalle', 'Patrón', 'Resultado', 'Ganancia'];
    const rows = signalsExportData.map(r => [
        r.fecha,
        r.hora,
        r.tipo,
        '"' + r.señal.replace(/"/g, '""') + '"',
        '"' + r.detalle.replace(/"/g, '""') + '"',
        '"' + r.patron.replace(/"/g, '""') + '"',
        r.resultado || 'Pendiente',
        r.ganancia  || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    a.href     = url;
    a.download = `señales_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showInternalNotification('✅ Exportado', `${signalsExportData.length} señales exportadas a CSV.`, 'success');
};

// ====================== DERIV API ======================
window.operarAutomatico = function(signal, stake, retries = 0) {
    if (!derivWs || derivWs.readyState !== WebSocket.OPEN) {
        // FIX #2: Limitar reintentos a 3 para evitar acumulación de llamadas
        // que generaban operaciones duplicadas cuando el WS finalmente abría.
        if (retries >= 3) {
            isTrading = false;
            strategyPaused = false;
            if (tradeStatusEl) {
                tradeStatusEl.textContent = 'LISTO';
                tradeStatusEl.style.color = '#27ae60';
            }
            showInternalNotification(
                '⚠️ Sin conexión Deriv',
                'No se pudo conectar a Deriv API tras 3 intentos. Intenta de nuevo.',
                'error'
            );
            return;
        }
        conectarDerivAPI();
        setTimeout(() => window.operarAutomatico(signal, stake, retries + 1), 3000);
        return;
    }

    const symbol = cachedAssetSelector ? cachedAssetSelector.value : 'R_10';
    derivWs.send(JSON.stringify({
        buy: 1,
        price: stake,
        parameters: {
            amount: stake,
            basis: 'stake',
            contract_type: signal === 'UP' ? 'CALL' : 'PUT',
            currency: 'USD',
            duration: DURATION,
            duration_unit: 't',
            symbol
        }
    }));
};

function conectarDerivAPI() {
    if (!DERIV_API_TOKEN) return;

    derivWs = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
    window.derivWs = derivWs;

    derivWs.onopen = () => {
        derivWs.send(JSON.stringify({ authorize: DERIV_API_TOKEN }));
    };

    derivWs.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.authorize) {
            derivWs.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        }

        if (data.buy && data.buy.contract_id) {
            const contract_id = data.buy.contract_id;
            const stake       = parseFloat(data.buy.buy_price);
            currentContract   = { contract_id, stake, timestamp: Date.now(), status: 'open' };
            balance -= stake;
            updateTradingDisplay();
            derivWs.send(JSON.stringify({ proposal_open_contract: 1, contract_id, subscribe: 1 }));
        }

        if (data.proposal_open_contract) {
            const contract = data.proposal_open_contract;

            // FIX #1: La condición anterior (!activeTrade) bloqueaba el monitor si quedaba
            // un activeTrade residual de una operación previa. Ahora solo verifica que no sea
            // el mismo contrato ya siendo monitoreado, y que entry_tick_time sea válido.
            if (contract.contract_id === currentContract?.contract_id &&
                (!activeTrade || activeTrade.id !== contract.contract_id) &&
                contract.entry_tick) {
                const entryTime = contract.entry_tick_time
                    ? new Date(contract.entry_tick_time * 1000)
                    : new Date();
                startTradeMonitorWithRealData(
                    contract.contract_id,
                    contract.contract_type,
                    parseFloat(contract.entry_tick),
                    parseFloat(contract.entry_tick_displayed || contract.entry_tick),
                    entryTime
                );
            }

            if (contract.tick_stream && contract.tick_stream.length > 0 && activeTrade && activeTrade.id === contract.contract_id) {
                contractTicks = contract.tick_stream.map(t => ({
                    price: parseFloat(t.tick), timestamp: t.tick_time * 1000, tick_index: t.tick_count || t.tick_index || 1
                }));
                if (contractTicks.length > 0) updateMonitorWithRealData(contractTicks);
            }

            if (contract.is_sold) {
                const profit      = parseFloat(contract.profit);
                const exitTick    = parseFloat(contract.exit_tick);
                const contract_id = contract.contract_id;
                const contractType = contract.contract_type || (activeTrade ? activeTrade.type : '');

                if (activeTrade && activeTrade.id === contract_id) {
                    activeTrade.currentPrice = exitTick;
                    activeTrade.profitLoss   = profit;
                    activeTrade.isWinning    = profit > 0;
                    contractTicks.push({ price: exitTick, timestamp: Date.now(), tick_index: 5 });
                    updateMonitorWithRealData(contractTicks);
                }

                procesarResultadoTrading(profit, contractType);
                mostrarResultadoOperacion(profit, contract.status, contract_id);
                derivWs.send(JSON.stringify({ proposal_open_contract: 0, contract_id, subscribe: 0 }));
                currentContract = null;
            }
        }

        if (data.balance) {
            balance = parseFloat(data.balance.balance);
            updateTradingDisplay();
        }

        if (data.error) {
            if (data.error.code === 'ContractBuyValidation' || data.error.code === 'InvalidContract') {
                if (currentContract) balance += currentContract.stake;
                isTrading = false;
                tradeStatusEl.textContent = 'ERROR';
                tradeStatusEl.style.color = '#e74c3c';
                stopTradeMonitor();
                setTimeout(() => { tradeStatusEl.textContent = 'LISTO'; tradeStatusEl.style.color = '#27ae60'; }, 3000);
                currentContract = null;
                updateTradingDisplay();
            }
        }
    };

    // FIX #4: El onerror anterior estaba vacío. Si ocurría un error durante
    // una operación, isTrading quedaba true bloqueando todas las operaciones futuras.
    derivWs.onerror = () => {
        if (isTrading) {
            isTrading = false;
            if (tradeStatusEl) {
                tradeStatusEl.textContent = 'ERROR';
                tradeStatusEl.style.color = '#e74c3c';
                setTimeout(() => {
                    tradeStatusEl.textContent = 'LISTO';
                    tradeStatusEl.style.color = '#27ae60';
                }, 3000);
            }
            stopTradeMonitor();
            currentContract = null;
            strategyPaused = false;
            updateTradingDisplay();
            showInternalNotification(
                '⚠️ Error de conexión',
                'Se perdió la conexión durante la operación. El sistema se ha restablecido.',
                'error'
            );
        }
    };

    derivWs.onclose = () => {
        currentContract = null;
        if (DERIV_API_TOKEN) setTimeout(conectarDerivAPI, 5000);
    };
}

// ====================== BACKTEST ======================
let backtestData = [];

// ---- Utilidades UI ----
window.openBacktest = function() {
    document.getElementById('backtest-panel').classList.add('open');
    document.getElementById('backtest-overlay').classList.add('open');
    btRenderHistory();
};

window.closeBacktest = function() {
    document.getElementById('backtest-panel').classList.remove('open');
    document.getElementById('backtest-overlay').classList.remove('open');
};

window.btSwitchTab = function(tab) {
    ['config','compare','history'].forEach(t => {
        document.getElementById('bt-tab-' + t).classList.toggle('active', t === tab);
        document.getElementById('bt-content-' + t).classList.toggle('hidden', t !== tab);
    });
    if (tab === 'history') btRenderHistory();
};

window.btToggleTimeFilter = function() {}; // legacy no-op

function btSetProgress(pct, label, prefix) {
    const id = prefix || '';
    const wrap = document.getElementById('bt' + id + '-progress-wrap');
    const fill = document.getElementById('bt' + id + '-progress-fill');
    const lbl  = document.getElementById('bt' + id + '-progress-label');
    if (wrap) wrap.classList.remove('hidden');
    if (fill) fill.style.width = pct + '%';
    if (lbl)  lbl.textContent  = label;
}

function btHideProgress(prefix) {
    const id = prefix || '';
    const wrap = document.getElementById('bt' + id + '-progress-wrap');
    if (wrap) wrap.classList.add('hidden');
}

// ---- Lógica de estrategia (replica exacta del motor principal) ----
function btExtractDigit(price, asset) {
    const map = { R_100: 2, R_10: 3, R_25: 3, R_50: 4, R_75: 4 };
    const xd  = map[asset] || 2;
    const fmt = parseFloat(price).toFixed(xd);
    return parseInt(fmt.slice(-1));
}

function btProcessDigit(digitActual, digitAnterior, wentUp) {
    if (digitActual !== 0) return wentUp ? digitActual : -digitActual;
    if (digitAnterior !== null && digitAnterior > 5) return wentUp ? 10 : -10;
    return 0;
}

function btAnalyzeSeq(values) {
    if (values.length < 2) return null;
    if (new Set(values).size !== values.length) return null;
    let up = true, down = true;
    for (let i = 1; i < values.length; i++) {
        if (values[i] <= values[i-1]) up   = false;
        if (values[i] >= values[i-1]) down = false;
    }
    if (up)   return 'up';
    if (down) return 'down';
    return null;
}

function btToMarket(dir, isBlue) {
    if (dir === null) return null;
    if (isBlue) return dir === 'up' ? 'alcista' : 'bajista';
    return dir === 'down' ? 'alcista' : 'bajista';
}

function btEvalBuffer(buf) {
    if (buf.length < 5) return null;
    const blues = buf.filter(d =>  d.blue);
    const reds  = buf.filter(d => !d.blue);
    const primerEsRojo = !buf[0].blue;
    const primerEsAzul =  buf[0].blue;
    const esCALL = reds.length  === 3 && blues.length === 2 && primerEsRojo;
    const esPUT  = blues.length === 3 && reds.length  === 2 && primerEsAzul;
    if (!esCALL && !esPUT) return null;
    const blueDir = blues.length >= 2 ? btAnalyzeSeq(blues.map(d => d.value)) : (blues.length === 1 ? 'one' : null);
    const redDir  = reds.length  >= 2 ? btAnalyzeSeq(reds.map(d  => d.value)) : (reds.length  === 1 ? 'one' : null);
    const blueM = blueDir === 'one' ? null : btToMarket(blueDir, true);
    const redM  = redDir  === 'one' ? null : btToMarket(redDir,  false);
    if (!blueM || !redM || blueM !== redM) return null;
    const isCall = blueM === 'alcista';
    if (isCall && !esCALL) return null;
    if (!isCall && !esPUT)  return null;
    return isCall ? 'CALL' : 'PUT';
}

function btGetResult(ticks, signalIdx, signal) {
    const entryTick = signalIdx + 1;
    const exitTick  = entryTick + 5;
    if (exitTick >= ticks.length) return null;
    const entry = ticks[entryTick].price;
    const exit  = ticks[exitTick].price;
    if (signal === 'CALL') return exit > entry ? 'WIN' : 'LOSS';
    return exit < entry ? 'WIN' : 'LOSS';
}

// Descarga ticks históricos de Deriv y devuelve Promise<ticks[]>
function btFetchTicks(asset, period) {
    return new Promise((resolve, reject) => {
        const endTime   = Math.floor(Date.now() / 1000);
        const startTime = endTime - period;
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        ws.onopen = () => {
            ws.send(JSON.stringify({ ticks_history: asset, start: startTime, end: endTime, style: 'ticks', count: 5000 }));
        };
        ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            ws.close();
            if (data.error) { reject(data.error.message); return; }
            if (!data.history || !data.history.prices) { reject('Sin datos'); return; }
            const ticks = data.history.prices.map((p, i) => ({
                price: parseFloat(p),
                time:  data.history.times[i]
            }));
            resolve(ticks);
        };
        ws.onerror = () => { ws.close(); reject('Error de conexión'); };
    });
}

// Simula la estrategia sobre un array de ticks y devuelve señales[]
function btSimulate(ticks, asset, stake, timeFrom, timeTo) {
    const PAYOUT_MULT = 0.95;
    const signals  = [];
    const btBuffer = [];
    let prevDigit  = null;

    for (let i = 1; i < ticks.length; i++) {
        const prev    = ticks[i - 1].price;
        const curr    = ticks[i].price;
        const wentUp  = curr >= prev;
        const digit   = btExtractDigit(curr, asset);
        const procVal = Math.abs(btProcessDigit(digit, prevDigit, wentUp));
        prevDigit = digit;

        btBuffer.push({ value: procVal, blue: wentUp });
        if (btBuffer.length > 5) btBuffer.shift();
        if (btBuffer.length < 5) continue;

        const signal = btEvalBuffer(btBuffer.slice());
        if (!signal) continue;

        // ---- Filtro horario ----
        if (timeFrom !== null && timeTo !== null) {
            const d        = new Date(ticks[i].time * 1000);
            const hhmm     = d.getHours() * 60 + d.getMinutes();
            const fromMins = timeFrom;
            const toMins   = timeTo;
            if (hhmm < fromMins || hhmm > toMins) {
                btBuffer.length = 0; prevDigit = null;
                continue;
            }
        }

        const result = btGetResult(ticks, i, signal);
        if (result === null) continue;

        const won  = result === 'WIN';
        const pnl  = won ? stake * PAYOUT_MULT : -stake;
        const patternArr = btBuffer.map(d2 => {
            const v = d2.value === 10 ? '10' : String(d2.value);
            return v + (d2.blue ? 'A' : 'R');
        });

        signals.push({
            idx:    i,
            hora:   new Date(ticks[i].time * 1000).toLocaleTimeString(),
            tipo:   signal,
            patron: patternArr.join('-'),
            result, won, pnl,
            entry:  ticks[i + 1] ? ticks[i + 1].price : curr,
            exit:   ticks[i + 6] ? ticks[i + 6].price : curr
        });

        i += 5;
        btBuffer.length = 0;
        prevDigit = null;
    }
    return signals;
}

// ---- Cálculo de resumen ----
function btCalcSummary(signals, stake, totalTicks) {
    const total  = signals.length;
    const wins   = signals.filter(s => s.won).length;
    const losses = total - wins;
    const calls  = signals.filter(s => s.tipo === 'CALL').length;
    const puts   = signals.filter(s => s.tipo === 'PUT').length;
    const pnl    = signals.reduce((sum, s) => sum + s.pnl, 0);
    const rate   = total > 0 ? Math.round(wins / total * 100) : 0;
    return { total, wins, losses, calls, puts, pnl, rate, totalTicks };
}

// ---- TAB CONFIGURACIÓN: runBacktest ----
window.runBacktest = function() {
    const asset  = document.getElementById('bt-asset').value;
    const period = parseInt(document.getElementById('bt-period').value);
    const stake  = parseFloat(document.getElementById('bt-stake').value) || 1;

    const btn = document.getElementById('btn-run-backtest');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ejecutando...';
    document.getElementById('backtest-results').classList.add('hidden');
    btSetProgress(5, 'Conectando con Deriv API...');

    btFetchTicks(asset, period)
        .then(ticks => {
            btSetProgress(60, `Analizando ${ticks.length} ticks...`);
            const signals = btSimulate(ticks, asset, stake, null, null);
            btSetProgress(90, 'Calculando resultados...');
            const summary = btCalcSummary(signals, stake, ticks.length);
            const periodLabels = { 900:'15 min',1800:'30 min',3600:'1 hora',7200:'2 horas',14400:'4 horas',28800:'8 horas',86400:'24 horas' };
            const assetNames  = { R_10:'V10', R_25:'V25', R_50:'V50', R_75:'V75', R_100:'V100' };
            btRenderResults(signals, summary, periodLabels[period] || period+'s', asset);
            btRenderHourly(signals, periodLabels[period] || period+'s');
            btSaveRun({
                fecha:   new Date().toLocaleString(),
                activo:  assetNames[asset] || asset,
                periodo: periodLabels[period] || period+'s',
                filtro:  '—',
                stake:   stake,
                ...summary
            });
            btSetProgress(100, 'Listo');
            setTimeout(() => btHideProgress(), 600);
        })
        .catch(err => {
            btHideProgress();
            showInternalNotification('❌ Error Backtest', err, 'error');
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-play"></i> Ejecutar Backtest';
        });
};

// ---- Análisis automático de efectividad por franja horaria ----
function btRenderHourly(signals, periodLabel) {
    const secEl      = document.getElementById('bt-hourly-section');
    const barsEl     = document.getElementById('bt-hourly-bars');
    const bestEl     = document.getElementById('bt-hourly-best');
    const subtitleEl = document.getElementById('bt-hourly-subtitle');
    if (!secEl || !barsEl) return;

    // Agrupar señales por hora local (0-23)
    const byHour = {};
    signals.forEach(s => {
        // s.hora es toLocaleTimeString → extraer hora del timestamp original
        const h = parseInt(s.hora.split(':')[0]);
        const hKey = isNaN(h) ? 0 : h;
        if (!byHour[hKey]) byHour[hKey] = { wins: 0, total: 0 };
        byHour[hKey].total++;
        if (s.won) byHour[hKey].wins++;
    });

    const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b);

    if (!hours.length) {
        secEl.classList.add('hidden');
        return;
    }
    secEl.classList.remove('hidden');

    // Calcular efectividad por hora
    const hoursData = hours.map(h => ({
        h,
        label: `${String(h).padStart(2,'0')}:00`,
        wins:  byHour[h].wins,
        total: byHour[h].total,
        rate:  Math.round(byHour[h].wins / byHour[h].total * 100)
    }));

    // Máximo rate para escalar barras
    const maxRate = Math.max(...hoursData.map(d => d.rate), 1);

    // Clasificar franjas
    const good    = hoursData.filter(d => d.rate >= 60 && d.total >= 2).sort((a,b) => b.rate - a.rate);
    const neutral = hoursData.filter(d => d.rate >= 45 && d.rate < 60 && d.total >= 2);
    const bad     = hoursData.filter(d => d.rate < 45 && d.total >= 2).sort((a,b) => a.rate - b.rate);

    // Resumen top
    subtitleEl.textContent = periodLabel ? `— ${periodLabel} analizadas` : '';
    bestEl.innerHTML = '';

    if (good.length) {
        const pill = document.createElement('div');
        pill.className = 'bt-hourly-pill bt-hourly-pill-good';
        pill.innerHTML = `<i class="fas fa-thumbs-up"></i> Mejores horas: ${good.slice(0,3).map(d => d.label + ' (' + d.rate + '%)').join(' · ')}`;
        bestEl.appendChild(pill);
    }
    if (bad.length) {
        const pill = document.createElement('div');
        pill.className = 'bt-hourly-pill bt-hourly-pill-bad';
        pill.innerHTML = `<i class="fas fa-thumbs-down"></i> Evitar: ${bad.slice(0,3).map(d => d.label + ' (' + d.rate + '%)').join(' · ')}`;
        bestEl.appendChild(pill);
    }
    if (!good.length && !bad.length) {
        const pill = document.createElement('div');
        pill.className = 'bt-hourly-pill bt-hourly-pill-neutral';
        pill.innerHTML = `<i class="fas fa-info-circle"></i> Sin suficientes señales por hora para sacar conclusiones (mínimo 2 por franja)`;
        bestEl.appendChild(pill);
    }

    // Heatmap de barras horizontales (ordenado por hora)
    barsEl.innerHTML = '';
    hoursData.forEach(d => {
        const color = d.rate >= 60 ? '#27ae60' : d.rate >= 45 ? '#f39c12' : '#e74c3c';
        const opacity = d.total < 2 ? '0.4' : '1';
        const barPct  = Math.round((d.rate / maxRate) * 100);

        const row = document.createElement('div');
        row.className = 'bt-hourly-row';
        row.style.opacity = opacity;
        row.title = `${d.label} — ${d.wins}W / ${d.total - d.wins}L de ${d.total} señales`;
        row.innerHTML = `
            <span class="bt-hourly-label">${d.label}</span>
            <div class="bt-hourly-bar-wrap">
                <div class="bt-hourly-bar" style="width:${barPct}%;background:${color}"></div>
            </div>
            <span class="bt-hourly-pct" style="color:${color}">${d.rate}%</span>
            <span class="bt-hourly-count">${d.total} señal${d.total !== 1 ? 'es' : ''}</span>`;
        barsEl.appendChild(row);
    });
}

// ---- Render de resultados generales ----
function btRenderResults(signals, summary, periodLabel, asset) {
    backtestData = signals;
    const assetNames = { R_10:'Volatility 10', R_25:'Volatility 25', R_50:'Volatility 50', R_75:'Volatility 75', R_100:'Volatility 100' };
    const { total, wins, losses, calls, puts, pnl, rate, totalTicks } = summary;

    document.getElementById('bt-total').textContent  = total;
    document.getElementById('bt-wins').textContent   = wins;
    document.getElementById('bt-losses').textContent = losses;
    document.getElementById('bt-calls').textContent  = calls;
    document.getElementById('bt-puts').textContent   = puts;
    document.getElementById('bt-ticks').textContent  = totalTicks;
    document.getElementById('bt-rate').textContent   = rate + '%';
    document.getElementById('bt-rate').style.color   = rate >= 55 ? '#27ae60' : rate >= 45 ? '#f39c12' : '#e74c3c';

    const profitEl = document.getElementById('bt-profit');
    profitEl.textContent = (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2);
    profitEl.style.color = pnl >= 0 ? '#27ae60' : '#e74c3c';

    document.getElementById('bt-rate-label-pct').textContent    = rate + '% efectividad — ' + (assetNames[asset] || asset);
    document.getElementById('bt-rate-label-period').textContent = 'Período: ' + periodLabel;

    const barFill = document.getElementById('bt-rate-bar-fill');
    barFill.style.width      = rate + '%';
    barFill.style.background = rate >= 55 ? '#27ae60' : rate >= 45 ? '#f39c12' : '#e74c3c';

    const tbody = document.getElementById('bt-table-body');
    tbody.innerHTML = '';
    signals.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.className = s.won ? 'bt-row-win' : 'bt-row-loss';
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${s.hora}</td>
            <td class="${s.tipo === 'CALL' ? 'bt-call' : 'bt-put'}">
                <i class="fas fa-arrow-${s.tipo === 'CALL' ? 'up' : 'down'}"></i> ${s.tipo}
            </td>
            <td class="bt-pattern">${s.patron}</td>
            <td class="${s.won ? 'bt-win-cell' : 'bt-loss-cell'}">${s.won ? '✅ GANÓ' : '❌ PERDIÓ'}</td>
            <td class="${s.pnl >= 0 ? 'bt-win-cell' : 'bt-loss-cell'}">${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(2)}</td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('backtest-results').classList.remove('hidden');
}

// ---- TAB COMPARAR ACTIVOS ----
window.runCompare = function() {
    const period    = parseInt(document.getElementById('bt-cmp-period').value);
    const stake     = parseFloat(document.getElementById('bt-cmp-stake').value) || 1;
    const checkboxes = document.querySelectorAll('.bt-cmp-checkboxes input:checked');
    const assets    = Array.from(checkboxes).map(c => c.value);

    if (assets.length < 2) {
        showInternalNotification('⚠️ Selección', 'Selecciona al menos 2 activos para comparar.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-run-compare');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Comparando...';
    document.getElementById('bt-cmp-results').classList.add('hidden');
    btSetProgress(5, `Descargando ${assets.length} activos...`, '-cmp');

    const assetNames = { R_10:'Volatility 10', R_25:'Volatility 25', R_50:'Volatility 50', R_75:'Volatility 75', R_100:'Volatility 100' };
    const promises   = assets.map(a => btFetchTicks(a, period).then(ticks => ({ asset: a, ticks })));
    let done = 0;

    Promise.all(promises.map(p => p.then(r => {
        done++;
        btSetProgress(Math.round(10 + (done / assets.length) * 70), `Descargado ${assetNames[r.asset] || r.asset}...`, '-cmp');
        return r;
    }))).then(results => {
        btSetProgress(85, 'Procesando resultados...', '-cmp');

        const rows = results.map(({ asset, ticks }) => {
            const signals = btSimulate(ticks, asset, stake, null, null);
            const s = btCalcSummary(signals, stake, ticks.length);
            return { asset, ...s };
        }).sort((a, b) => b.rate - a.rate);

        const tbody = document.getElementById('bt-cmp-body');
        tbody.innerHTML = '';
        rows.forEach((r, i) => {
            const tr = document.createElement('tr');
            tr.className = i === 0 ? 'bt-cmp-best' : '';
            const rateColor = r.rate >= 55 ? '#27ae60' : r.rate >= 45 ? '#f39c12' : '#e74c3c';
            const pnlColor  = r.pnl >= 0 ? '#27ae60' : '#e74c3c';
            tr.innerHTML = `
                <td style="font-weight:700">${i === 0 ? '🥇 ' : ''}${assetNames[r.asset] || r.asset}</td>
                <td>${r.total}</td>
                <td class="bt-win-cell">${r.wins}</td>
                <td class="bt-loss-cell">${r.losses}</td>
                <td style="font-weight:700;color:${rateColor}">${r.rate}%</td>
                <td class="bt-call">${r.calls}</td>
                <td class="bt-put">${r.puts}</td>
                <td style="font-weight:700;color:${pnlColor}">${r.pnl >= 0 ? '+' : ''}$${r.pnl.toFixed(2)}</td>`;
            tbody.appendChild(tr);
        });

        // Barras visuales de efectividad
        const barsEl = document.getElementById('bt-cmp-bars');
        barsEl.innerHTML = '<div class="bt-cmp-bars-title">Efectividad por activo</div>';
        rows.forEach(r => {
            const color = r.rate >= 55 ? '#27ae60' : r.rate >= 45 ? '#f39c12' : '#e74c3c';
            const div = document.createElement('div');
            div.className = 'bt-cmp-bar-row';
            div.innerHTML = `
                <span class="bt-cmp-bar-label">${assetNames[r.asset] || r.asset}</span>
                <div class="bt-cmp-bar-track">
                    <div class="bt-cmp-bar-fill" style="width:${r.rate}%;background:${color}"></div>
                </div>
                <span class="bt-cmp-bar-pct" style="color:${color}">${r.rate}%</span>`;
            barsEl.appendChild(div);
        });

        document.getElementById('bt-cmp-results').classList.remove('hidden');
        btSetProgress(100, 'Listo', '-cmp');
        setTimeout(() => btHideProgress('-cmp'), 600);
    }).catch(err => {
        btHideProgress('-cmp');
        showInternalNotification('❌ Error comparación', err, 'error');
    }).finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-exchange-alt"></i> Comparar activos';
    });
};

// ---- TAB HISTORIAL DE RUNS ----
const BT_HISTORY_KEY = 'bt_runs_history';

function btSaveRun(run) {
    try {
        const raw  = localStorage.getItem(BT_HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        list.unshift(run);
        if (list.length > 50) list.pop();
        localStorage.setItem(BT_HISTORY_KEY, JSON.stringify(list));
    } catch(e) {}
}

function btLoadHistory() {
    try {
        const raw = localStorage.getItem(BT_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
}

function btRenderHistory() {
    const list    = btLoadHistory();
    const listEl  = document.getElementById('bt-history-list');
    const emptyEl = document.getElementById('bt-history-empty');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (!list.length) {
        emptyEl.classList.remove('hidden');
        return;
    }
    emptyEl.classList.add('hidden');

    list.forEach((r, idx) => {
        const rateColor = r.rate >= 55 ? '#27ae60' : r.rate >= 45 ? '#f39c12' : '#e74c3c';
        const pnlColor  = r.pnl >= 0 ? '#27ae60' : '#e74c3c';
        const card = document.createElement('div');
        card.className = 'bt-history-card';
        card.innerHTML = `
            <div class="bt-history-card-header">
                <span class="bt-history-date">${r.fecha}</span>
                <span class="bt-history-badge" style="color:${rateColor};border-color:${rateColor}">${r.rate}% efectividad</span>
            </div>
            <div class="bt-history-card-body">
                <div class="bt-history-meta">
                    <span><i class="fas fa-chart-bar"></i> ${r.activo}</span>
                    <span><i class="fas fa-clock"></i> ${r.periodo}</span>
                    <span><i class="fas fa-filter"></i> ${r.filtro}</span>
                    <span><i class="fas fa-dollar-sign"></i> stake $${r.stake}</span>
                </div>
                <div class="bt-history-stats">
                    <div class="bt-history-stat"><span class="bt-history-stat-val">${r.total}</span><span class="bt-history-stat-lbl">Señales</span></div>
                    <div class="bt-history-stat"><span class="bt-history-stat-val" style="color:#27ae60">${r.wins}</span><span class="bt-history-stat-lbl">Ganadas</span></div>
                    <div class="bt-history-stat"><span class="bt-history-stat-val" style="color:#e74c3c">${r.losses}</span><span class="bt-history-stat-lbl">Perdidas</span></div>
                    <div class="bt-history-stat"><span class="bt-history-stat-val" style="color:${pnlColor}">${r.pnl >= 0 ? '+' : ''}$${parseFloat(r.pnl).toFixed(2)}</span><span class="bt-history-stat-lbl">P&L</span></div>
                </div>
                <div class="bt-history-bar-track">
                    <div class="bt-history-bar-fill" style="width:${r.rate}%;background:${rateColor}"></div>
                </div>
            </div>`;
        listEl.appendChild(card);
    });
}

window.btClearHistory = function() {
    if (!confirm('¿Eliminar todo el historial de backtests guardados?')) return;
    try { localStorage.removeItem(BT_HISTORY_KEY); } catch(e) {}
    btRenderHistory();
    showInternalNotification('🗑️ Historial eliminado', 'Se borraron todos los runs guardados.', 'warning');
};

// ---- Exportar CSV ----
window.exportBacktestCSV = function() {
    if (!backtestData.length) return;
    const headers = ['#', 'Hora', 'Tipo', 'Patrón', 'Resultado', 'P&L'];
    const rows = backtestData.map((s, i) => [
        i + 1, s.hora, s.tipo,
        '"' + s.patron + '"',
        s.won ? 'GANÓ' : 'PERDIÓ',
        (s.pnl >= 0 ? '+' : '') + s.pnl.toFixed(2)
    ]);
    const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `backtest_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ====================== RESPONSIVE MÓVIL ======================

// Sincronizar selector de activo móvil con el desktop
window.syncMobileAsset = function(val) {
    const desktop = document.getElementById('asset-selector');
    if (desktop) { desktop.value = val; desktop.dispatchEvent(new Event('change')); }
};

// Sincronizar los valores del header móvil con los del desktop
function syncMobileHeader() {
    const priceEl   = document.getElementById('price');
    const balanceEl = document.getElementById('balance-amount');
    const profitEl  = document.getElementById('total-profit');
    const digitEl   = document.getElementById('current-digit');
    const dotMobile = document.getElementById('status-dot-mobile');
    const dotMain   = document.getElementById('status-dot');

    const pm = document.getElementById('price-mobile');
    const bm = document.getElementById('balance-mobile');
    const plm= document.getElementById('pnl-mobile');
    const dm = document.getElementById('digit-mobile');

    if (pm && priceEl)   pm.textContent  = priceEl.textContent;
    if (bm && balanceEl) bm.textContent  = balanceEl.textContent;
    if (plm && profitEl) {
        plm.textContent = profitEl.textContent;
        plm.style.color = profitEl.style.color || '';
    }
    if (dm && digitEl) {
        dm.textContent  = digitEl.textContent;
        dm.className    = 'mobile-digit-circle ' + digitEl.className.replace('current-digit','').trim();
    }
    if (dotMobile && dotMain) dotMobile.className = dotMain.className;

    // Sincronizar badge token móvil
    const badgeDesktop = document.getElementById('token-badge');
    const badgeMobile  = document.getElementById('token-badge-mobile');
    if (badgeMobile && badgeDesktop) {
        badgeMobile.classList.toggle('hidden', badgeDesktop.classList.contains('hidden'));
    }
}

// Iniciar sincronización cada 300ms
setInterval(syncMobileHeader, 300);

// Tabs de navegación móvil
window.mobileShowTab = function(tab) {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // Botones nav
    document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById('mobnav-' + tab);
    if (activeBtn) activeBtn.classList.add('active');

    // Secciones: ocultar todas salvo la activa
    const tradingEl = document.getElementById('mob-section-trading');
    const signalEl  = document.getElementById('mob-section-signal');
    const chartsEl  = document.getElementById('mob-section-charts');
    const chartsSub = document.querySelector('.mobile-section-charts-sub');

    [tradingEl, signalEl, chartsEl, chartsSub].forEach(el => {
        if (el) el.classList.add('mob-hidden');
    });

    if (tab === 'trading' && tradingEl)  tradingEl.classList.remove('mob-hidden');
    if (tab === 'signal'  && signalEl)   signalEl.classList.remove('mob-hidden');
    if (tab === 'charts') {
        if (chartsEl)  chartsEl.classList.remove('mob-hidden');
        if (chartsSub) chartsSub.classList.remove('mob-hidden');
    }
};

// Inicializar tabs en móvil al cargar
window.addEventListener('load', () => {
    if (window.innerWidth <= 768) mobileShowTab('trading');
});
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        // Restaurar todas las secciones en desktop
        document.querySelectorAll('.mobile-section, .mobile-section-charts-sub')
            .forEach(el => el.classList.remove('mob-hidden'));
    } else {
        mobileShowTab(getCurrentMobileTab());
    }
});

function getCurrentMobileTab() {
    const active = document.querySelector('.mob-nav-btn.active');
    if (!active) return 'trading';
    const id = active.id.replace('mobnav-','');
    return id;
}
