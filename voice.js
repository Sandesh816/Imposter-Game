// Voice Chat Module for Secret Word Imposter (multiplayer rooms).
// Peer-to-peer WebRTC mesh audio; Firebase RTDB is only used for signaling:
//   rooms/{code}/voiceUsers/{playerId}   — presence + mute state
//   rooms/{code}/voiceSignals/{playerId} — per-player signal inbox (offer/answer/ICE)

import {
    ref,
    set,
    get,
    push,
    onValue,
    onChildAdded,
    onDisconnect,
    remove,
    update
} from "firebase/database";
import { database as db, auth } from './firebase-client.js';

// STUN is enough for most home/mobile networks. If players behind strict NATs
// can't hear each other, add a TURN server entry here.
const RTC_CONFIG = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
    ]
};

const SPEAKING_THRESHOLD = 0.025;
const SPEAKING_POLL_MS = 180;

const state = {
    joined: false,
    roomCode: null,
    myId: null,
    myJoinedAt: 0,
    muted: false,
    localStream: null,
    peers: new Map(),      // pid -> { pc, audioEl, pendingCandidates, analyser, speaking }
    unsubs: [],
    audioCtx: null,
    localAnalyser: null,
    monitorTimer: null,
    onRoster: null,
    onSpeaking: null,
    audioSink: null
};

function signalsRef(pid) {
    return ref(db, `rooms/${state.roomCode}/voiceSignals/${pid}`);
}

function sendSignal(toPid, payload) {
    return push(signalsRef(toPid), { from: state.myId, ...payload });
}

// ===============================================
// Peer connections (mesh)
// ===============================================
function createPeer(pid, isInitiator) {
    if (state.peers.has(pid)) return state.peers.get(pid);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer = { pc, audioEl: null, pendingCandidates: [], analyser: null, speaking: false };
    state.peers.set(pid, peer);

    state.localStream.getTracks().forEach(t => pc.addTrack(t, state.localStream));

    pc.onicecandidate = (e) => {
        if (e.candidate) {
            sendSignal(pid, { type: 'candidate', data: JSON.stringify(e.candidate) });
        }
    };

    pc.ontrack = (e) => {
        attachRemoteStream(pid, e.streams[0]);
    };

    // Retry once if the connection drops (e.g. network change)
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
            closePeer(pid);
        }
    };

    if (isInitiator) {
        pc.onnegotiationneeded = async () => {
            try {
                await pc.setLocalDescription(await pc.createOffer());
                sendSignal(pid, { type: 'offer', data: JSON.stringify(pc.localDescription) });
            } catch (err) {
                console.warn('Voice: offer failed', err);
            }
        };
    }

    return peer;
}

function attachRemoteStream(pid, stream) {
    const peer = state.peers.get(pid);
    if (!peer) return;

    if (!peer.audioEl) {
        const el = document.createElement('audio');
        el.autoplay = true;
        el.playsInline = true;
        el.dataset.peer = pid;
        state.audioSink?.appendChild(el);
        peer.audioEl = el;
    }
    peer.audioEl.srcObject = stream;
    peer.audioEl.play().catch(() => { /* will start once autoplay unblocks */ });
    watchSpeaking(pid, stream);
}

function closePeer(pid) {
    const peer = state.peers.get(pid);
    if (!peer) return;
    try { peer.pc.close(); } catch (e) { /* already closed */ }
    peer.audioEl?.remove();
    state.peers.delete(pid);
    state.onSpeaking?.(pid, false);
}

async function handleSignal(msg) {
    if (!msg || !msg.from || msg.from === state.myId) return;
    const pid = msg.from;

    try {
        if (msg.type === 'offer') {
            // The other side initiates; we only answer
            const peer = createPeer(pid, false);
            await peer.pc.setRemoteDescription(JSON.parse(msg.data));
            await flushCandidates(peer);
            await peer.pc.setLocalDescription(await peer.pc.createAnswer());
            sendSignal(pid, { type: 'answer', data: JSON.stringify(peer.pc.localDescription) });
        } else if (msg.type === 'answer') {
            const peer = state.peers.get(pid);
            if (peer) {
                await peer.pc.setRemoteDescription(JSON.parse(msg.data));
                await flushCandidates(peer);
            }
        } else if (msg.type === 'candidate') {
            const peer = state.peers.get(pid);
            if (!peer) return;
            const candidate = JSON.parse(msg.data);
            if (peer.pc.remoteDescription) {
                await peer.pc.addIceCandidate(candidate);
            } else {
                peer.pendingCandidates.push(candidate);
            }
        }
    } catch (err) {
        console.warn('Voice: signal handling failed', err);
    }
}

async function flushCandidates(peer) {
    while (peer.pendingCandidates.length) {
        try { await peer.pc.addIceCandidate(peer.pendingCandidates.shift()); }
        catch (e) { /* stale candidate */ }
    }
}

// ===============================================
// Speaking detection (WebAudio volume meter)
// ===============================================
function getAudioCtx() {
    if (!state.audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        state.audioCtx = new AC();
    }
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    return state.audioCtx;
}

function makeAnalyser(stream) {
    const ctx = getAudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    return analyser;
}

function watchSpeaking(pid, stream) {
    const peer = state.peers.get(pid);
    if (!peer) return;
    try { peer.analyser = makeAnalyser(stream); }
    catch (e) { /* meter is optional */ }
}

function rms(analyser) {
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
}

function startSpeakingMonitor() {
    stopSpeakingMonitor();
    state.monitorTimer = setInterval(() => {
        if (state.localAnalyser) {
            const speaking = !state.muted && rms(state.localAnalyser) > SPEAKING_THRESHOLD;
            state.onSpeaking?.(state.myId, speaking);
        }
        state.peers.forEach((peer, pid) => {
            if (!peer.analyser) return;
            const speaking = rms(peer.analyser) > SPEAKING_THRESHOLD;
            if (speaking !== peer.speaking) {
                peer.speaking = speaking;
                state.onSpeaking?.(pid, speaking);
            } else if (speaking) {
                state.onSpeaking?.(pid, true);
            }
        });
    }, SPEAKING_POLL_MS);
}

function stopSpeakingMonitor() {
    if (state.monitorTimer) {
        clearInterval(state.monitorTimer);
        state.monitorTimer = null;
    }
}

// ===============================================
// Public API
// ===============================================

/**
 * Join the room's voice channel.
 * @param {string} roomCode
 * @param {string} myId - this client's player id in the room
 * @param {{ onRoster?: (users: object) => void, onSpeaking?: (pid: string, speaking: boolean) => void }} callbacks
 */
export async function joinVoice(roomCode, myId, { onRoster, onSpeaking } = {}) {
    if (state.joined) return;

    // Mic first — if this throws (permission denied), nothing else is touched
    const localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });

    state.joined = true;
    state.roomCode = roomCode;
    state.myId = myId;
    state.myJoinedAt = Date.now();
    state.muted = false;
    state.localStream = localStream;
    state.onRoster = onRoster || null;
    state.onSpeaking = onSpeaking || null;

    state.audioSink = document.getElementById('voice-audio-sink') || document.body;
    try { state.localAnalyser = makeAnalyser(localStream); } catch (e) { /* optional */ }

    // Clear any stale inbox from a previous session, then listen for signals
    await remove(signalsRef(myId)).catch(() => { });
    const inboxUnsub = onChildAdded(signalsRef(myId), (snap) => {
        const msg = snap.val();
        remove(snap.ref).catch(() => { });
        handleSignal(msg);
    });
    state.unsubs.push(inboxUnsub);

    // Announce presence (auto-removed if we disconnect)
    const myVoiceRef = ref(db, `rooms/${roomCode}/voiceUsers/${myId}`);
    await set(myVoiceRef, { muted: false, joinedAt: state.myJoinedAt });
    onDisconnect(myVoiceRef).remove();

    // Roster drives the mesh: the LATER joiner initiates the connection,
    // so two clients never call each other simultaneously (no glare).
    const rosterUnsub = onValue(ref(db, `rooms/${roomCode}/voiceUsers`), (snap) => {
        const users = snap.exists() ? snap.val() : {};

        // Disconnect peers who left voice
        [...state.peers.keys()].forEach(pid => {
            if (!users[pid]) closePeer(pid);
        });

        // Call members who were here before us
        Object.entries(users).forEach(([pid, info]) => {
            if (pid === state.myId || state.peers.has(pid)) return;
            const theyJoinedFirst = (info.joinedAt || 0) < state.myJoinedAt ||
                ((info.joinedAt || 0) === state.myJoinedAt && pid < state.myId);
            if (theyJoinedFirst) createPeer(pid, true);
        });

        state.onRoster?.(users);
    });
    state.unsubs.push(rosterUnsub);

    startSpeakingMonitor();
}

export async function leaveVoice() {
    if (!state.joined) return;

    const { roomCode, myId } = state;

    stopSpeakingMonitor();
    state.unsubs.forEach(u => { try { u(); } catch (e) { /* already unsubscribed */ } });
    state.unsubs = [];

    [...state.peers.keys()].forEach(closePeer);

    state.localStream?.getTracks().forEach(t => t.stop());
    state.localStream = null;
    state.localAnalyser = null;

    state.joined = false;
    state.onRoster = null;
    state.onSpeaking = null;

    // Best-effort cleanup in RTDB (room may already be deleted)
    try {
        await remove(ref(db, `rooms/${roomCode}/voiceUsers/${myId}`));
        await remove(signalsRef(myId));
    } catch (e) { /* room gone */ }

    state.roomCode = null;
    state.myId = null;
}

/** Toggle the local microphone. Returns the new muted state. */
export function toggleMute() {
    if (!state.joined) return false;
    state.muted = !state.muted;
    state.localStream?.getAudioTracks().forEach(t => { t.enabled = !state.muted; });
    update(ref(db, `rooms/${state.roomCode}/voiceUsers/${state.myId}`), { muted: state.muted })
        .catch(() => { });
    if (state.muted) state.onSpeaking?.(state.myId, false);
    return state.muted;
}

export function isInVoice() {
    return state.joined;
}

export function isMicMuted() {
    return state.muted;
}

/** Diagnostics (used by automated tests). */
export function getDebugInfo() {
    return {
        joined: state.joined,
        roomCode: state.roomCode,
        muted: state.muted,
        peers: [...state.peers.entries()].map(([pid, p]) => ({
            pid,
            connectionState: p.pc.connectionState,
            iceState: p.pc.iceConnectionState,
            hasAudioEl: !!p.audioEl
        }))
    };
}
