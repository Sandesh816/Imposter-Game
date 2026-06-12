// FX — sound effects, haptics and confetti for Secret Word Imposter.
// All sounds are synthesized with WebAudio so no audio assets are needed.

const MUTE_KEY = 'imposter-sfx-muted';

let audioCtx = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

function getCtx() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// iOS / autoplay policies: unlock the context on the first user gesture
document.addEventListener('pointerdown', () => { if (!muted) getCtx(); }, { once: true });

export function isMuted() {
    return muted;
}

export function setMuted(value) {
    muted = value;
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
}

export function toggleMuted() {
    setMuted(!muted);
    return muted;
}

function tone({ freq = 440, type = 'sine', duration = 0.15, delay = 0, volume = 0.18, freqEnd = null }) {
    const ctx = getCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
}

const SOUNDS = {
    tap: () => tone({ freq: 700, type: 'triangle', duration: 0.06, volume: 0.12 }),
    flip: () => tone({ freq: 280, freqEnd: 620, type: 'triangle', duration: 0.18, volume: 0.14 }),
    chime: () => {
        tone({ freq: 660, type: 'sine', duration: 0.25, volume: 0.14 });
        tone({ freq: 990, type: 'sine', duration: 0.3, delay: 0.07, volume: 0.1 });
    },
    sting: () => {
        tone({ freq: 116, type: 'sawtooth', duration: 0.7, volume: 0.16 });
        tone({ freq: 110, type: 'sawtooth', duration: 0.7, volume: 0.16 });
        tone({ freq: 233, freqEnd: 117, type: 'square', duration: 0.5, delay: 0.05, volume: 0.06 });
    },
    fanfare: () => {
        [523, 659, 784, 1047].forEach((f, i) => {
            tone({ freq: f, type: 'triangle', duration: 0.28, delay: i * 0.09, volume: 0.16 });
        });
        tone({ freq: 1568, type: 'sine', duration: 0.5, delay: 0.4, volume: 0.08 });
    },
    lose: () => {
        tone({ freq: 392, freqEnd: 196, type: 'sine', duration: 0.5, volume: 0.16 });
        tone({ freq: 196, freqEnd: 98, type: 'sine', duration: 0.5, delay: 0.18, volume: 0.12 });
    },
    tick: () => tone({ freq: 1100, type: 'sine', duration: 0.04, volume: 0.1 }),
    timeUp: () => {
        [0, 0.22, 0.44].forEach(d => tone({ freq: 220, type: 'square', duration: 0.16, delay: d, volume: 0.14 }));
    },
    whoosh: () => tone({ freq: 900, freqEnd: 200, type: 'triangle', duration: 0.22, volume: 0.1 })
};

export function play(name) {
    if (muted) return;
    const fn = SOUNDS[name];
    if (fn) {
        try { fn(); } catch (e) { /* audio is best-effort */ }
    }
}

export function vibrate(pattern = 30) {
    try {
        if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) { /* unsupported */ }
}

// ===============================================
// Confetti — lightweight canvas particle burst
// ===============================================
const DEFAULT_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#22c55e', '#f59e0b', '#ec4899', '#ffffff'];

let confettiCanvas = null;
let confettiCtx2d = null;
let confettiParticles = [];
let confettiRaf = null;

function ensureCanvas() {
    if (confettiCanvas) return;
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(confettiCanvas);
    confettiCtx2d = confettiCanvas.getContext('2d');
}

function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confettiCanvas.width = window.innerWidth * dpr;
    confettiCanvas.height = window.innerHeight * dpr;
    confettiCtx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function confettiLoop() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    confettiCtx2d.clearRect(0, 0, w, h);

    confettiParticles = confettiParticles.filter(p => p.y < h + 30 && p.life > 0);
    if (confettiParticles.length === 0) {
        confettiRaf = null;
        confettiCanvas.remove();
        confettiCanvas = null;
        confettiCtx2d = null;
        return;
    }

    confettiParticles.forEach(p => {
        p.vy += 0.12;                 // gravity
        p.vx *= 0.992;                // drag
        p.x += p.vx + Math.sin(p.phase + p.y * 0.02) * p.sway;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;

        confettiCtx2d.save();
        confettiCtx2d.translate(p.x, p.y);
        confettiCtx2d.rotate(p.rot);
        confettiCtx2d.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
        confettiCtx2d.fillStyle = p.color;
        confettiCtx2d.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        confettiCtx2d.restore();
    });

    confettiRaf = requestAnimationFrame(confettiLoop);
}

/** Fire a celebratory confetti burst. */
export function confetti({ count = 140, colors = DEFAULT_COLORS } = {}) {
    ensureCanvas();
    resizeCanvas();

    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < count; i++) {
        const fromLeft = i % 2 === 0;
        confettiParticles.push({
            x: fromLeft ? -10 : w + 10,
            y: h * (0.25 + Math.random() * 0.35),
            vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 7),
            vy: -(4 + Math.random() * 7),
            vr: (Math.random() - 0.5) * 0.3,
            rot: Math.random() * Math.PI * 2,
            size: 6 + Math.random() * 7,
            sway: Math.random() * 1.2,
            phase: Math.random() * Math.PI * 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 160 + Math.random() * 80
        });
    }

    if (!confettiRaf) confettiRaf = requestAnimationFrame(confettiLoop);
}

/** Darker, menacing burst for when the imposter wins. */
export function imposterConfetti() {
    confetti({ count: 100, colors: ['#ef4444', '#991b1b', '#7c3aed', '#4c1d95', '#1f2937'] });
}
