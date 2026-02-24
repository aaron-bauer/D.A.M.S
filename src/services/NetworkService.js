/**
 * NetworkService.js
 * =================
 * Peer-to-peer communication over a local WiFi LAN (no internet needed).
 *
 * HOW THE MESH WORKS:
 *  1. RESCUE TEAM device enables its phone hotspot.
 *  2. SURVIVORS connect to that hotspot — now all devices share a LAN.
 *  3. Rescue Mode → starts a TCP server on port 4747.
 *  4. Survivor Mode → scans the LAN subnet to find the rescue server.
 *  5. Once connected, survivors push GPS packets; rescue team plots them.
 *
 * SIMULATION MODE (SIMULATION_MODE = true):
 *   Runs a demo with fake data — works in Expo Go without any build step.
 *   Change SIMULATION_MODE to false when you build with: expo run:android
 *
 * REAL DEPLOYMENT NOTE:
 *   react-native-tcp-socket uses native code and requires:
 *     npx expo prebuild   (generates ios/ and android/ folders)
 *     npx expo run:android
 */

import * as Network from 'expo-network';

// ─── Toggle between demo and real TCP ────────────────────────────────────────
/**
 * Set to true  → demo simulation (works in Expo Go, no build needed).
 * Set to false → real TCP sockets (requires: npx expo run:android).
 */
export const SIMULATION_MODE = true;

const P2P_PORT = 4747;      // TCP port for all mesh traffic
const BROADCAST_INTERVAL = 15000;    // Survivors re-send location every 15 s
const SCAN_END = 30;       // Scan .1 – .30 of the subnet

// ─── Tiny Event Emitter ───────────────────────────────────────────────────────
// Allows screens to subscribe to network events without tight coupling.
const listeners = {};

/** Subscribe to a network event. */
export const on = (event, fn) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
};

/** Unsubscribe from a network event. */
export const off = (event, fn) => {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
};

/** Internal: fire an event to all subscribers. */
const emit = (event, data) => {
    (listeners[event] || []).forEach(fn => fn(data));
};

// ─── Internal State ───────────────────────────────────────────────────────────
let tcpServer = null;
let tcpClient = null;
let broadcastTimer = null;
let isRunning = false;
let currentRole = null;

// ─── Mock data for Simulation Mode ───────────────────────────────────────────
const MOCK_SURVIVORS = [
    { id: 's001', name: 'Sarah Chen', lat: 14.5995, lon: 120.9842 },
    { id: 's002', name: 'Marcus Rivera', lat: 14.6020, lon: 120.9810 },
    { id: 's003', name: 'Amara Johnson', lat: 14.5970, lon: 120.9880 },
];
const MOCK_MESSAGES = [
    { id: 'm1', sender: 'Sarah Chen', text: 'Trapped on Main St. Need water!' },
    { id: 'm2', sender: 'Rescue HQ', text: 'Team dispatched. ETA 10 minutes.' },
    { id: 'm3', sender: 'Marcus Rivera', text: '🆘 Injured, 3rd floor blue building!' },
];

/** Launch the fully simulated P2P demo. */
const startSimulation = (role) => {
    isRunning = true;
    currentRole = role;

    // Brief "scanning" phase, then report connected
    emit('status_change', { status: 'scanning', peerCount: 0 });

    setTimeout(() => {
        emit('status_change', { status: 'connected', peerCount: MOCK_SURVIVORS.length });
    }, 2500);

    if (role === 'rescue') {
        // Drip-feed mock survivors and messages onto the map/chat
        MOCK_SURVIVORS.forEach((s, i) =>
            setTimeout(() => emit('survivor_update', { ...s, timestamp: Date.now() }), 3000 + i * 4000)
        );
        MOCK_MESSAGES.forEach((m, i) =>
            setTimeout(() => emit('message_received', { ...m, timestamp: Date.now() - (3 - i) * 20000 }), 5000 + i * 3000)
        );
    } else {
        // Survivor — simulate "location sent" confirmation then an ACK from rescue
        setTimeout(() => emit('broadcast_sent', {}), 3000);
        setTimeout(() => emit('message_received', {
            id: 'ack1', sender: 'Rescue HQ',
            text: '📍 Your location received. Stay calm — help is on the way!',
            timestamp: Date.now(),
        }), 8000);
    }
};

// ─── Real TCP Helpers ─────────────────────────────────────────────────────────
/** Parse raw Buffer from TCP into a JS object. */
const parse = (buf) => {
    try { return JSON.parse(buf.toString('utf8')); }
    catch { return null; }
};

/** Route an incoming mesh packet to the correct event. */
const handle = (msg) => {
    if (!msg?.type) return;
    if (msg.type === 'LOCATION') {
        emit('survivor_update', { id: msg.id, name: msg.name, lat: msg.lat, lon: msg.lon, timestamp: msg.timestamp });
    } else if (msg.type === 'MESSAGE') {
        emit('message_received', { id: `${msg.id}_${msg.timestamp}`, sender: msg.sender, text: msg.text, timestamp: msg.timestamp });
    } else if (msg.type === 'SOS') {
        emit('sos_received', msg);
        emit('survivor_update', { id: msg.id, name: `${msg.name} ⚠️ SOS`, lat: msg.lat, lon: msg.lon, timestamp: msg.timestamp, isSOS: true });
    }
};

/** Start a TCP server (Rescue Team mode). */
const startTcpServer = () => {
    const TcpSocket = require('react-native-tcp-socket').default;
    const clients = new Map();

    tcpServer = TcpSocket.createServer((socket) => {
        const key = `${socket.remoteAddress}:${socket.remotePort}`;
        clients.set(key, socket);
        emit('status_change', { status: 'connected', peerCount: clients.size });

        socket.on('data', (data) => {
            const msg = parse(data);
            if (msg) handle(msg);
            try { socket.write(JSON.stringify({ type: 'ACK' })); } catch { }
        });

        socket.on('close', () => {
            clients.delete(key);
            emit('status_change', { status: 'connected', peerCount: clients.size });
        });
        socket.on('error', () => clients.delete(key));
    });

    tcpServer.listen({ port: P2P_PORT, host: '0.0.0.0' }, () => {
        emit('status_change', { status: 'listening', peerCount: 0 });
    });
};

/** Scan the LAN subnet to find the rescue server (Survivor mode). */
const scanAndConnect = async (deviceInfo) => {
    const TcpSocket = require('react-native-tcp-socket').default;
    const ip = await Network.getIpAddressAsync();
    if (!ip || ip === '0.0.0.0') { emit('status_change', { status: 'no_wifi' }); return; }

    const subnet = ip.split('.').slice(0, 3).join('.');
    emit('status_change', { status: 'scanning' });

    for (let i = 1; i <= SCAN_END; i++) {
        const host = `${subnet}.${i}`;
        if (ip.endsWith(`.${i}`)) continue; // Skip own IP

        const found = await new Promise((resolve) => {
            const s = TcpSocket.createConnection({ host, port: P2P_PORT, timeout: 500 }, () => {
                tcpClient = s;
                // Send location immediately on connect
                s.write(JSON.stringify({ type: 'LOCATION', ...deviceInfo, timestamp: Date.now() }));
                emit('status_change', { status: 'connected', serverIP: host });
                s.on('data', (d) => { const m = parse(d); if (m) handle(m); });
                s.on('close', () => { tcpClient = null; emit('status_change', { status: 'disconnected' }); });
                resolve(true);
            });
            s.on('error', () => { s.destroy(); resolve(false); });
            setTimeout(() => { s.destroy(); resolve(false); }, 600);
        });

        if (found) break;
    }

    if (!tcpClient) emit('status_change', { status: 'not_found' });
};

// ─── Public API ───────────────────────────────────────────────────────────────
/**
 * Start the network service.
 * @param {'rescue'|'survivor'} role
 * @param {{ id, name, lat, lon }} deviceInfo
 */
export const start = async (role, deviceInfo) => {
    if (isRunning) return;
    currentRole = role;
    isRunning = true;

    if (SIMULATION_MODE) { startSimulation(role); return; }

    if (role === 'rescue') {
        startTcpServer();
    } else {
        await scanAndConnect(deviceInfo);
        // Re-broadcast location every 15 s while connected
        if (tcpClient) {
            broadcastTimer = setInterval(() => {
                if (tcpClient) {
                    try {
                        tcpClient.write(JSON.stringify({ type: 'LOCATION', ...deviceInfo, timestamp: Date.now() }));
                        emit('broadcast_sent', {});
                    } catch { clearInterval(broadcastTimer); }
                }
            }, BROADCAST_INTERVAL);
        }
    }
};

/** Stop all network activity and free resources. */
export const stop = () => {
    isRunning = false;
    if (broadcastTimer) { clearInterval(broadcastTimer); broadcastTimer = null; }
    if (tcpClient) { tcpClient.destroy(); tcpClient = null; }
    if (tcpServer) { tcpServer.close(); tcpServer = null; }
    emit('status_change', { status: 'stopped' });
};

/**
 * Send a broadcast text message to all peers.
 * @param {{ id, sender, text }} messageData
 */
export const sendMessage = (messageData) => {
    const payload = { type: 'MESSAGE', ...messageData, timestamp: Date.now() };

    if (SIMULATION_MODE) {
        // Echo back to own chat after short delay
        setTimeout(() => emit('message_received', { ...payload, id: `${payload.id}_echo`, isSelf: true }), 300);
        return;
    }
    if (currentRole === 'survivor' && tcpClient) {
        try { tcpClient.write(JSON.stringify(payload)); } catch { }
    }
};

/**
 * Broadcast an SOS emergency signal with current GPS.
 * @param {{ id, name, lat, lon }} deviceInfo
 */
export const sendSOS = (deviceInfo) => {
    const payload = { type: 'SOS', ...deviceInfo, timestamp: Date.now() };

    if (SIMULATION_MODE) {
        setTimeout(() => emit('message_received', {
            id: 'sos_confirm', sender: 'System',
            text: '🆘 SOS Alert sent! Rescue team has been notified of your location.',
            timestamp: Date.now(),
        }), 500);
        return;
    }
    if (tcpClient) {
        try { tcpClient.write(JSON.stringify(payload)); } catch { }
    }
};

export const isActive = () => isRunning;
