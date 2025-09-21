/**
 * State Management
 */
const state = {
    events: [],
    bbs: 75,
    memorySeq: [],
    movementTip: '',
    movementTimer: null,
    cameraOn: false,
    videoStream: null,
    balanceStart: null,
    voiceRec: null
};

/**
 * Navigation Functions
 */
function initializeNavigation() {
    document.querySelectorAll('.menu button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const panel = btn.dataset.panel;
            document.querySelectorAll('main section').forEach(s => s.style.display = (s.id === panel ? '' : 'none'));
            if (panel === 'posturepal') updateCameraPreview();
        });
    });
}

function goto(panel) {
    document.querySelector(`.menu button[data-panel="${panel}"]`).click();
}

/**
 * Event Logging
 */
function logEvent(text) {
    const t = new Date().toLocaleString();
    state.events.unshift(`${t}: ${text}`);
    document.getElementById('summaryLog').textContent = state.events.slice(0, 20).join('\n');
    recomputeBBS();
}

/**
 * Brain & Body Score
 */
function recomputeBBS() {
    let score = 50;
    score += Math.min(20, state.events.filter(e => /NeuroGym|memory|breathing|movement/i.test(e)).length * 4);
    score += Math.max(-10, 10 - (parseInt(document.getElementById('tiltRange')?.value || 10)));
    
    if (state.lastBalance && state.lastBalance.duration < 2) score -= 15;
    state.bbs = Math.max(10, Math.min(99, Math.round(score)));
    document.getElementById('bbs').textContent = state.bbs;
}

/**
 * NeuroGym Module
 */
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'teal', 'pink'];

function startMemory() {
    const n = parseInt(document.getElementById('memDifficulty').value, 10);
    const seq = Array.from({length: n}, () => COLORS[Math.floor(Math.random() * COLORS.length)]);
    
    state.memorySeq = seq;
    document.getElementById('sequence').textContent = seq.join(' ');
    document.getElementById('gameLog').textContent = `Generated sequence of ${n} items. Try to recall and submit.`;
    logEvent(`NeuroGym: generated sequence (${n})`);
    
    const moves = ['30s squats', '30s shoulder rolls', '30s standing stretch', '30s gentle march'];
    state.movementTip = moves[Math.floor(Math.random() * moves.length)];
    document.getElementById('movementTip').textContent = state.movementTip;
}

function hintMemory() {
    if (!state.memorySeq.length) return alert('Generate sequence first.');
    const idx = Math.floor(Math.random() * state.memorySeq.length);
    alert(`Hint: item at position ${idx + 1} is ${state.memorySeq[idx]}`);
}

function submitRecall() {
    const input = document.getElementById('recallInput').value.trim().toLowerCase();
    if (!state.memorySeq.length) return alert('Generate sequence first.');
    if (!input) return alert('Type your recall (space separated).');
    
    const provided = input.split(/\s+/);
    const correct = provided.reduce((acc, val, idx) => 
        acc + (idx < state.memorySeq.length && val === state.memorySeq[idx] ? 1 : 0), 0);
    
    const accuracy = Math.round(100 * correct / state.memorySeq.length);
    document.getElementById('gameLog').textContent = `Recall accuracy: ${accuracy}% (${correct}/${state.memorySeq.length})`;
    logEvent(`NeuroGym result: ${accuracy}%`);
    recomputeBBS();
}

function startMovement() {
    if (state.movementTimer) {
        clearInterval(state.movementTimer);
        state.movementTimer = null;
        document.getElementById('movementTimer').textContent = 'Stopped';
        return;
    }

    let t = 30;
    const updateTimer = () => {
        document.getElementById('movementTimer').textContent = `Time left: ${t}s`;
        if (t <= 0) {
            clearInterval(state.movementTimer);
            state.movementTimer = null;
            document.getElementById('movementTimer').textContent = 'Done';
            logEvent('Completed mini movement: ' + state.movementTip);
            recomputeBBS();
        }
        t--;
    };

    updateTimer();
    state.movementTimer = setInterval(updateTimer, 1000);
}

/**
 * PosturePal Module
 */
function initializePosturePal() {
    const tiltSlider = document.getElementById('tiltRange');
    const tiltVal = document.getElementById('tiltVal');
    tiltSlider.addEventListener('input', () => {
        tiltVal.textContent = tiltSlider.value + '°';
    });
}

function checkPosture() {
    const val = parseInt(document.getElementById('tiltRange').value, 10);
    let rec = '';
    
    if (val <= 15) {
        rec = 'Good posture — keep up! Try 30-60s stretches every hour.';
    } else if (val <= 30) {
        rec = 'Mild slouch detected. Do 30s neck rotations + 30s shoulder rolls.';
    } else {
        rec = 'High forward tilt detected. Stand up, perform 60s posture reset: chin tucks + wall angels.';
    }
    
    document.getElementById('postureRec').textContent = rec;
    logEvent('Posture check: ' + val + '° → ' + rec);
    recomputeBBS();
}

/**
 * Camera Handling
 */
async function toggleCamera() {
    if (state.cameraOn) {
        stopCamera();
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        document.getElementById('cameraPreview').srcObject = stream;
        state.cameraOn = true;
        state.videoStream = stream;
        document.querySelector('button[onclick="toggleCamera()"]').textContent = 'Stop Camera';
        logEvent('Camera on for posture preview');
    } catch (e) {
        alert('Camera unavailable or permission denied.');
    }
}

function stopCamera() {
    if (state.videoStream) {
        state.videoStream.getTracks().forEach(t => t.stop());
        state.videoStream = null;
    }
    document.getElementById('cameraPreview').srcObject = null;
    state.cameraOn = false;
    document.querySelector('button[onclick="toggleCamera()"]').textContent = 'Use Camera (optional)';
}

/**
 * FallShield Module
 */
function startBalance() {
    state.balanceStart = performance.now();
    document.getElementById('balanceResult').textContent = 'Balancing...';
    window.addEventListener('keydown', spaceHold);
    window.addEventListener('keyup', spaceRelease);
}

function endBalance() {
    if (!state.balanceStart) return;
    
    const dur = (performance.now() - state.balanceStart) / 1000;
    state.lastBalance = { duration: dur };
    document.getElementById('balanceResult').textContent = `Held for ${dur.toFixed(2)}s`;
    state.balanceStart = null;
    
    window.removeEventListener('keydown', spaceHold);
    window.removeEventListener('keyup', spaceRelease);
    logEvent('FallShield test: ' + dur.toFixed(2) + 's');
    updateRiskMeter();
    recomputeBBS();
}

let spaceDown = false;

function spaceHold(e) {
    if (e.code === 'Space' && !spaceDown) {
        spaceDown = true;
        if (!state.balanceStart) startBalance();
    }
}

function spaceRelease(e) {
    if (e.code === 'Space' && spaceDown) {
        spaceDown = false;
        endBalance();
    }
}

/**
 * MoodSync Module
 */
function analyzeMood() {
    const txt = document.getElementById('moodText').value.trim();
    if (!txt) return alert('Type your mood description or try voice input.');
    
    const mood = simpleSentiment(txt);
    document.getElementById('moodOut').textContent = `Detected: ${mood.tag} (score ${mood.score}) — ${mood.note}`;
    adaptSuggestion(mood);
    logEvent('MoodSync: ' + mood.tag);
    recomputeBBS();
}

function simpleSentiment(text) {
    const pos = ['happy', 'good', 'great', 'calm', 'relaxed', 'fine', 'ok', 'energetic', 'excited', 'confident'];
    const neg = ['sad', 'stressed', 'anxious', 'angry', 'tired', 'burnout', 'depressed', 'lonely', 'scared'];
    const t = text.toLowerCase();
    
    let score = 0;
    pos.forEach(w => { if (t.includes(w)) score += 2; });
    neg.forEach(w => { if (t.includes(w)) score -= 2; });
    if (t.match(/sleep|insomnia/)) score -= 1;
    
    const tag = score > 1 ? 'positive' : score < -1 ? 'negative' : 'neutral';
    const note = tag === 'positive' ? 'Keep doing what you do!' : 
                tag === 'negative' ? 'Try a short breathing break.' : 
                'Consider a 2-min reset.';
    
    return { score, tag, note };
}

function adaptSuggestion(mood) {
    const suggestions = {
        positive: 'Energy boost: 1-min focus game or short walk.',
        negative: 'Try 2-min guided breathing and a light NeuroGym memory round.',
        neutral: 'Micro-session: 90s stretch + 60s memory game.'
    };
    document.getElementById('moodSuggestion').textContent = suggestions[mood.tag];
}

/**
 * Voice Recognition
 */
function startVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Voice recognition not supported in this browser. Use text input.');
        return;
    }
    
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Rec();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    
    r.onresult = (ev) => {
        const spoken = ev.results[0][0].transcript;
        document.getElementById('moodText').value = spoken;
        analyzeMood();
    };
    
    r.onerror = (e) => {
        alert('Voice error: ' + e.error);
    };
    
    r.start();
    logEvent('Voice input started (MoodSync)');
}

/**
 * Utility Functions
 */
function startBreathing() {
    logEvent('Started 2-min breathing session');
    alert('Start 2-minute breathing: 4s inhale, 6s exhale. (Simulated in prototype)');
}

function startLightYoga() {
    logEvent('Started 1-min stretch');
    alert('Perform gentle neck and shoulder stretches for 60s.');
}

function updateCameraPreview() {
    if (state.cameraOn && state.videoStream) return;
}

function simulateFallRisk() {
    state.lastBalance = { duration: 0.5 };
    updateRiskMeter();
    logEvent('Simulated high fall risk');
    recomputeBBS();
}

function updateRiskMeter() {
    const el = document.getElementById('riskMeter');
    const dur = state.lastBalance ? state.lastBalance.duration : 999;
    
    if (dur >= 10) {
        el.textContent = 'Low risk';
        el.style.background = 'linear-gradient(90deg, rgba(34,197,94,0.12), transparent)';
    } else if (dur >= 3) {
        el.textContent = 'Moderate risk';
        el.style.background = 'linear-gradient(90deg, rgba(250,204,21,0.08), transparent)';
    } else {
        el.textContent = 'High risk';
        el.style.background = 'linear-gradient(90deg, rgba(239,68,68,0.06), transparent)';
    }
}

/**
 * Initialization
 */
function init() {
    initializeNavigation();
    initializePosturePal();
    recomputeBBS();
    logEvent('Prototype opened');
    
    // Event Listeners
    document.getElementById('refreshBBS').addEventListener('click', recomputeBBS);
}

// Start the application
document.addEventListener('DOMContentLoaded', init);