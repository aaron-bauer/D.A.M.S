/**
 * NetworkService.js
 * =================
 * Peer-to-peer communication over a local WiFi LAN (no internet needed).
 *
 * HOW THE MESH WORKS:
 *  1. RESCUE TEAM device enables its phone hotspot.
 *  2. SURVIVORS connect to that hotspot — now all devices share a LAN.
 *  3. Rescue Mode → starts a TCP server on port 4747.
 *  4. Survivor Mode → scans the full LAN subnet (.1–.254) to find the rescue server.
 *  5. Once connected, survivors push GPS packets; rescue team plots them.
 *  6. Both sides can send text messages over the same connection.
 *
 * SIMULATION MODE (SIMULATION_MODE = true):
 *   Runs a demo with fake data — works in Expo Go without any build step.
 *   Change SIMULATION_MODE to false when you build with: expo run:android
 */

import * as Network from 'expo-network';

// ─── Toggle between demo and real TCP ────────────────────────────────────────
/**
 * Set to true  → demo simulation (works in Expo Go, no build needed).
 * Set to false → real TCP sockets (requires: npx expo run:android).
 */
export const SIMULATION_MODE = false;

const P2P_PORT = 8080;           // TCP port for all mesh traffic
const UDP_BEACON_PORT = 8888;    // UDP port for rescue-beacon broadcasts
const BROADCAST_INTERVAL = 15000; // Survivors re-send location every 15 s
const RECONNECT_INTERVAL = 30000; // Survivors retry connection every 30 s
const TCP_TIMEOUT_MS = 1500;      // Connection attempt timeout (ms)
const SCAN_END = 254;             // Scan .1–.254 of the subnet (full range)

// ─── Native Module Helper ─────────────────────────────────────────────────────
const getTcpSocket = () => {
    try {
        const mod = require('react-native-tcp-socket');
        return mod.default || mod;
    } catch (e) {
        return null;
    }
};

// ─── Tiny Event Emitter ───────────────────────────────────────────────────────
const listeners = {};

export const on = (event, fn) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
};

export const off = (event, fn) => {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
};

const emit = (event, data) => {
    (listeners[event] || []).forEach(fn => fn(data));
};

// ─── Internal State ───────────────────────────────────────────────────────────
let tcpServer = null;
let tcpClient = null;
let udpBeacon = null;   // Rescue: UDP socket for broadcasting
let udpListener = null; // Survivor: UDP socket for listening to beacons
let broadcastTimer = null;
let beaconTimer = null;
let reconnectTimer = null;
let isRunning = false;
let currentRole = null;
let currentDeviceInfo = null;

// Module-level clients map so sendMessage() can reach all survivors
const clients = new Map();

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

const startSimulation = (role) => {
    isRunning = true;
    currentRole = role;

    emit('status_change', { status: 'scanning', peerCount: 0 });

    setTimeout(() => {
        emit('status_change', { status: 'connected', peerCount: MOCK_SURVIVORS.length });
    }, 2500);

    if (role === 'rescue') {
        MOCK_SURVIVORS.forEach((s, i) =>
            setTimeout(() => emit('survivor_update', { ...s, timestamp: Date.now() }), 3000 + i * 4000)
        );
        MOCK_MESSAGES.forEach((m, i) =>
            setTimeout(() => emit('message_received', { ...m, timestamp: Date.now() - (3 - i) * 20000 }), 5000 + i * 3000)
        );
    } else {
        setTimeout(() => emit('broadcast_sent', {}), 3000);
        setTimeout(() => emit('message_received', {
            id: 'ack1', sender: 'Rescue HQ',
            text: '📍 Your location received. Stay calm — help is on the way!',
            timestamp: Date.now(),
        }), 8000);
    }
};

// ─── Real TCP Helpers ─────────────────────────────────────────────────────────
const parse = (buf) => {
    try { return JSON.parse(buf.toString('utf8')); }
    catch { return null; }
};

// Broadcast a raw JSON payload to all connected survivor clients (rescue server side)
const broadcastToClients = (payload) => {
    const str = JSON.stringify(payload);
    clients.forEach((socket, key) => {
        try { socket.write(str); }
        catch { clients.delete(key); }
    });
};

const handle = (msg, senderSocket) => {
    if (!msg?.type) return;
    if (msg.type === 'LOCATION') {
        emit('survivor_update', { id: msg.id, name: msg.name, lat: msg.lat, lon: msg.lon, timestamp: msg.timestamp });
    } else if (msg.type === 'MESSAGE') {
        emit('message_received', { id: `${msg.id}_${msg.timestamp}`, sender: msg.sender, text: msg.text, timestamp: msg.timestamp });
        // Relay message from one survivor to all others (rescue server acts as relay)
        if (currentRole === 'rescue' && senderSocket) {
            broadcastToClients({ ...msg, type: 'MESSAGE' });
        }
    } else if (msg.type === 'SOS') {
        emit('sos_received', msg);
        emit('survivor_update', { id: msg.id, name: `${msg.name} ⚠️ SOS`, lat: msg.lat, lon: msg.lon, timestamp: msg.timestamp, isSOS: true });
        // Relay SOS to all connected survivors
        if (currentRole === 'rescue' && senderSocket) {
            broadcastToClients({ ...msg, type: 'SOS' });
        }
    } else if (msg.type === 'ACK') {
        // Acknowledgement from rescue server — do nothing (handled silently)
    }
};

// ─── Manual Connection Override ───────────────────────────────────────────────
export const connectToIp = async (host, deviceInfo) => {
    if (!isRunning) return false;
    emit('status_change', { status: 'scanning', error: `Manually connecting to ${host}...` });

    const connected = await new Promise((resolve) => {
        let settled = false;
        const settle = (val, err = null) => {
            if (settled) return;
            settled = true;
            resolve({ success: val, error: err });
        };

        const TcpSocket = getTcpSocket();
        if (!TcpSocket) return settle(false, 'Socket module missing');

        const s = TcpSocket.createConnection({ host, port: P2P_PORT, timeout: 4000 }, () => {
            tcpClient = s;
            const payload = JSON.stringify({ type: 'LOCATION', ...deviceInfo, timestamp: Date.now() }) + '\n';
            try { s.write(payload); } catch { }
            emit('status_change', { status: 'connected', serverIP: host, peerCount: 1 });
            settle(true);
        });

        s.on('error', (err) => {
            try { s.destroy(); } catch { }
            settle(false, err.message || 'Connection Refused');
        });

        setTimeout(() => {
            if (!settled) {
                try { s.destroy(); } catch { }
                settle(false, 'Connection Timeout (Check if WiFi is correct)');
            }
        }, 4500);
    });

    if (connected.success) return true;
    emit('status_change', { status: 'error', error: `Failed: ${connected.error}` });
    return false;
};

// ─── Rescue Self-Test ─────────────────────────────────────────────────────────
// Lets the Rescue UI verify the TCP server is actually accepting connections
export const selfTest = async () => {
    const TcpSocket = getTcpSocket();
    if (!TcpSocket) {
        emit('status_change', { status: 'error', error: 'Self-test: TCP module missing!' });
        return false;
    }
    return await new Promise((resolve) => {
        let settled = false;
        const settle = (val, msg) => {
            if (settled) return; settled = true;
            emit('status_change', {
                status: val ? 'listening' : 'error',
                error: msg,
                selfTest: val,
            });
            resolve(val);
        };
        const s = TcpSocket.createConnection({ host: '127.0.0.1', port: P2P_PORT, timeout: 2000 }, () => {
            try { s.destroy(); } catch { }
            settle(true, `✅ Server OK on port ${P2P_PORT}`);
        });
        s.on('error', (err) => {
            try { s.destroy(); } catch { }
            settle(false, `❌ Server NOT listening: ${err.message}`);
        });
        setTimeout(() => settle(false, `❌ Server self-test timed out on port ${P2P_PORT}`), 2500);
    });
};

// ─── Rescue Team: TCP Server ──────────────────────────────────────────────────
const startTcpServer = async (options = {}) => {
    const TcpSocket = getTcpSocket();

    if (!TcpSocket || !TcpSocket.createServer) {
        emit('status_change', { status: 'error', error: 'TCP Socket module not found or failed to load' });
        return false;
    }

    try {
        emit('status_change', { status: 'initializing', peerCount: 0 });

        let ip = null;
        let networkState = {};

        // Skip IP polling if force flag is set
        if (!options.force) {
            // Poll for IP address (up to 5 attempts, once per second)
            for (let attempt = 1; attempt <= 5; attempt++) {
                ip = await Network.getIpAddressAsync();
                networkState = await Network.getNetworkStateAsync();

                if (ip && ip !== '0.0.0.0' && ip !== '127.0.0.1') {
                    break;
                }

                if (attempt < 5) {
                    emit('status_change', {
                        status: 'initializing',
                        error: `Checking hotspot status... (${attempt}/5)`
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // If still no IP, we DON'T block. We start anyway but notify.
            if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1') {
                emit('status_change', {
                    status: 'initializing',
                    error: `Hotspot IP unknown (normal for some phones). Starting server...`
                });
            }
        }

        tcpServer = TcpSocket.createServer((socket) => {
            const key = `${socket.remoteAddress}:${socket.remotePort}`;
            clients.set(key, socket);
            emit('status_change', { status: 'connected', peerCount: clients.size });

            // Send a welcome ACK so the survivor knows they connected
            try {
                socket.write(JSON.stringify({
                    type: 'MESSAGE',
                    id: `rescue_ack_${Date.now()}`,
                    sender: 'Rescue HQ',
                    text: '✅ Connected to rescue server. Your location is being tracked.',
                    timestamp: Date.now(),
                }));
            } catch { }

            let buffer = '';
            socket.on('data', (data) => {
                buffer += data.toString('utf8');
                // Handle multiple JSON objects in one chunk (newline-delimited)
                const parts = buffer.split('\n');
                buffer = parts.pop(); // keep the incomplete tail
                parts.forEach(part => {
                    if (!part.trim()) return;
                    const msg = parse(part);
                    if (msg) handle(msg, socket);
                });
            });

            socket.on('close', () => {
                clients.delete(key);
                emit('status_change', {
                    status: clients.size > 0 ? 'connected' : 'listening',
                    peerCount: clients.size
                });
            });
            socket.on('error', () => { clients.delete(key); });
        });

        tcpServer.on('error', (err) => {
            emit('status_change', { status: 'error', error: err.message });
        });

        tcpServer.listen({ port: P2P_PORT, host: '0.0.0.0' }, () => {
            // If ip is 0.0.0.0, it's often 192.168.43.1 or 192.168.49.1 for hotspots
            const displayIP = (ip && ip !== '0.0.0.0') ? ip : 'Hotspot Default (Often 192.168.43.1)';
            emit('status_change', {
                status: 'listening',
                peerCount: 0,
                serverIP: displayIP,
                info: `Server running on port ${P2P_PORT}`
            });
        });
        return true;
    } catch (err) {
        emit('status_change', { status: 'error', error: 'Server error: ' + err.message });
        return false;
    }
};

const tryScanSubnet = async (subnet, ownIP, deviceInfo) => {
    if (!isRunning) return false;
    emit('status_change', { status: 'scanning', error: `Scanning subnet ${subnet}.x...` });

    const CONCURRENCY = 15; // Scan 15 IPs at a time
    for (let i = 1; i <= SCAN_END && isRunning; i += CONCURRENCY) {
        const tasks = [];
        for (let j = 0; j < CONCURRENCY && (i + j) <= SCAN_END; j++) {
            const host = `${subnet}.${i + j}`;
            if (ownIP === host) continue;

            tasks.push((async () => {
                return new Promise((resolve) => {
                    let settled = false;
                    const settle = (val) => { if (settled) return; settled = true; resolve(val); };

                    const TcpSocket = getTcpSocket();
                    if (!TcpSocket) return settle(false);

                    const s = TcpSocket.createConnection({ host, port: P2P_PORT, timeout: TCP_TIMEOUT_MS }, () => {
                        tcpClient = s;
                        const payload = JSON.stringify({ type: 'LOCATION', ...deviceInfo, timestamp: Date.now() }) + '\n';
                        try { s.write(payload); } catch { }
                        emit('status_change', { status: 'connected', serverIP: host, peerCount: 1 });

                        let buffer = '';
                        s.on('data', (d) => {
                            buffer += d.toString('utf8');
                            const parts = buffer.split('\n');
                            buffer = parts.pop();
                            parts.forEach(part => {
                                if (!part.trim()) return;
                                const m = parse(part);
                                if (m) handle(m, null);
                            });
                        });
                        s.on('close', () => {
                            tcpClient = null;
                            if (isRunning) {
                                emit('status_change', { status: 'not_found' });
                                scheduleReconnect(deviceInfo);
                            }
                        });
                        settle(true);
                    });

                    s.on('error', () => { try { s.destroy(); } catch { } settle(false); });
                    setTimeout(() => { if (!settled) { try { s.destroy(); } catch { } settle(false); } }, TCP_TIMEOUT_MS + 100);
                });
            })());
        }

        const results = await Promise.all(tasks);
        if (results.some(r => r === true)) return true;

        // Brief pause to let the UI update and not overwhelm the network stack
        await new Promise(r => setTimeout(r, 100));
    }
    return false;
};

// Helper to prioritize the .1 address of a subnet (most likely hotspot host)
const tryGatewayOnly = async (subnet, ownIP, deviceInfo) => {
    if (!isRunning) return false;
    const host = `${subnet}.1`;
    if (ownIP === host) return false;

    return await new Promise((resolve) => {
        let settled = false;
        const settle = (val) => { if (settled) return; settled = true; resolve(val); };
        const TcpSocket = getTcpSocket();
        if (!TcpSocket) return settle(false);

        const s = TcpSocket.createConnection({ host, port: P2P_PORT, timeout: 2000 }, () => {
            tcpClient = s;
            const payload = JSON.stringify({ type: 'LOCATION', ...deviceInfo, timestamp: Date.now() }) + '\n';
            try { s.write(payload); } catch { }
            emit('status_change', { status: 'connected', serverIP: host, peerCount: 1 });
            settle(true);
        });
        s.on('error', () => { try { s.destroy(); } catch { } settle(false); });
        setTimeout(() => { if (!settled) { try { s.destroy(); } catch { } settle(false); } }, 2200);
    });
};

const scanAndConnect = async (deviceInfo) => {
    if (!isRunning) return false;
    const TcpSocket = getTcpSocket();

    if (!TcpSocket || !TcpSocket.createConnection) {
        emit('status_change', { status: 'error', error: 'TCP Socket module not found or failed to load' });
        return false;
    }

    const ip = await Network.getIpAddressAsync();

    // Always report own IP to the UI for diagnostics
    emit('status_change', { status: 'scanning', error: `Local Device IP: ${ip || 'Unknown'}` });

    // If no WiFi/IP, try fallback subnets known for Android hotspots
    if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1') {
        const fallbacks = [
            '192.168.43', '192.168.49', '192.168.44',
            '192.168.45', '192.168.46', '192.168.47',
            '192.168.1', '192.168.0', '10.42.0'
        ];
        // Priority 1: Check all .1 addresses first
        for (const sub of fallbacks) {
            if (await tryGatewayOnly(sub, '0.0.0.0', deviceInfo)) return true;
        }
        // Priority 2: Full scan
        for (const sub of fallbacks) {
            if (await tryScanSubnet(sub, '0.0.0.0', deviceInfo)) return true;
        }

        emit('status_change', { status: 'no_wifi', error: `Fail-safe search ended. My IP: ${ip}` });
        scheduleReconnect(deviceInfo);
        return false;
    }

    const subnet = ip.split('.').slice(0, 3).join('.');

    // Check gateway of own subnet first
    if (await tryGatewayOnly(subnet, ip, deviceInfo)) return true;

    // Then full scan of own subnet
    if (await tryScanSubnet(subnet, ip, deviceInfo)) return true;

    // If own subnet failed, priority check .1 on others
    const standardHotspots = [
        '192.168.43', '192.168.49', '192.168.44',
        '192.168.45', '192.168.46', '192.168.47'
    ].filter(s => s !== subnet);

    for (const sub of standardHotspots) {
        if (await tryGatewayOnly(sub, ip, deviceInfo)) return true;
    }

    if (isRunning) {
        emit('status_change', { status: 'not_found' });
        scheduleReconnect(deviceInfo);
    }
    return false;
};

// ─── UDP Beacon: Rescue broadcasts, Survivor discovers ────────────────────────────────────
const startUdpBeacon = () => {
    const TcpSocket = getTcpSocket();
    if (!TcpSocket || !TcpSocket.createSocket) return;
    try {
        udpBeacon = TcpSocket.createSocket({ type: 'udp4', reusePort: true });
        udpBeacon.bind(0, '0.0.0.0', async () => {
            try { udpBeacon.setBroadcast(true); } catch { }
            const sendBeacon = () => {
                if (!isRunning || !udpBeacon) return;
                try {
                    const msg = JSON.stringify({ type: 'DAMS_BEACON', port: P2P_PORT });
                    const buf = Buffer.from ? Buffer.from(msg) : msg;
                    udpBeacon.send(buf, 0, msg.length, UDP_BEACON_PORT, '255.255.255.255');
                    emit('status_change', { status: 'listening', peerCount: clients.size });
                } catch { }
            };
            sendBeacon();
            beaconTimer = setInterval(sendBeacon, 2000);
        });
        udpBeacon.on('error', () => { /* ignore beacon errors */ });
    } catch { }
};

const listenForBeacon = (deviceInfo) => {
    if (!isRunning) return;
    const TcpSocket = getTcpSocket();
    if (!TcpSocket || !TcpSocket.createSocket) {
        // Fall back to scan if UDP not supported
        scanAndConnect(deviceInfo);
        return;
    }
    emit('status_change', { status: 'scanning', error: 'Listening for rescue beacon...' });
    try {
        udpListener = TcpSocket.createSocket({ type: 'udp4', reusePort: true });
        udpListener.bind(UDP_BEACON_PORT, '0.0.0.0', () => {
            try { udpListener.setBroadcast(true); } catch { }
        });
        udpListener.on('message', async (data, rinfo) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type !== 'DAMS_BEACON') return;
                // Beacon received! The sender's address IS the rescue IP
                const rescueIP = rinfo.address;
                emit('status_change', { status: 'scanning', error: `📡 Beacon from ${rescueIP}! Connecting...` });
                // Close listener — we found it
                try { udpListener.close(); udpListener = null; } catch { }
                // Connect via TCP
                const TcpSock = getTcpSocket();
                if (!TcpSock) return;
                const s = TcpSock.createConnection({ host: rescueIP, port: P2P_PORT, timeout: 5000 }, () => {
                    tcpClient = s;
                    const payload = JSON.stringify({ type: 'LOCATION', ...deviceInfo, timestamp: Date.now() }) + '\n';
                    try { s.write(payload); } catch { }
                    emit('status_change', { status: 'connected', serverIP: rescueIP, peerCount: 1 });
                    s.on('data', (d) => {
                        let buf = '';
                        buf += d.toString('utf8');
                        buf.split('\n').filter(Boolean).forEach(part => {
                            const m = parse(part);
                            if (m) handle(m, null);
                        });
                    });
                    s.on('close', () => {
                        tcpClient = null;
                        if (isRunning) {
                            emit('status_change', { status: 'not_found' });
                            listenForBeacon(deviceInfo);
                        }
                    });
                });
                s.on('error', () => {
                    try { s.destroy(); } catch { }
                    emit('status_change', { status: 'error', error: `Beacon found ${rescueIP} but TCP failed. Retrying...` });
                    if (isRunning) setTimeout(() => listenForBeacon(deviceInfo), 3000);
                });
            } catch { }
        });
        udpListener.on('error', () => {
            // UDP failed, fall back to scan
            emit('status_change', { status: 'scanning', error: 'UDP failed, falling back to scan...' });
            scanAndConnect(deviceInfo);
        });
        // Also run a scan in parallel as fallback (in 5 seconds)
        setTimeout(() => {
            if (isRunning && !tcpClient && udpListener) {
                emit('status_change', { status: 'scanning', error: 'No beacon yet, starting scan fallback...' });
                scanAndConnect(deviceInfo);
            }
        }, 5000);
    } catch {
        scanAndConnect(deviceInfo);
    }
};

const scheduleReconnect = (deviceInfo) => {
    if (!isRunning || reconnectTimer) return;
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        if (isRunning && !tcpClient) {
            listenForBeacon(deviceInfo);
        }
    }, RECONNECT_INTERVAL);
};

// ─── Public API ───────────────────────────────────────────────────────────────
export const start = async (role, deviceInfo, options = {}) => {
    if (isRunning && !options.force) return;

    // If forcing while already running, stop first
    if (isRunning && options.force) {
        stop();
    }

    currentRole = role;
    currentDeviceInfo = deviceInfo;
    isRunning = true;

    if (SIMULATION_MODE) { startSimulation(role); return; }

    emit('status_change', { status: 'initializing', peerCount: 0 });

    if (role === 'rescue') {
        const success = await startTcpServer(options);
        if (!success) {
            isRunning = false;
            return false;
        }
        // Start UDP beacon so survivors can discover us
        startUdpBeacon();
    } else {
        // Survivor: listen for UDP beacon first, fall back to scan
        listenForBeacon(deviceInfo);
        // Start periodic location broadcast if connected
        broadcastTimer = setInterval(() => {
            if (tcpClient && currentDeviceInfo) {
                try {
                    const payload = JSON.stringify({
                        type: 'LOCATION',
                        ...currentDeviceInfo,
                        timestamp: Date.now(),
                    }) + '\n';
                    tcpClient.write(payload);
                    emit('broadcast_sent', {});
                } catch { clearInterval(broadcastTimer); }
            }
        }, BROADCAST_INTERVAL);
    }
    return true;
};

export const stop = () => {
    isRunning = false;
    if (beaconTimer) { clearInterval(beaconTimer); beaconTimer = null; }
    if (broadcastTimer) { clearInterval(broadcastTimer); broadcastTimer = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (udpBeacon) { try { udpBeacon.close(); } catch { } udpBeacon = null; }
    if (udpListener) { try { udpListener.close(); } catch { } udpListener = null; }
    if (tcpClient) { try { tcpClient.destroy(); } catch { } tcpClient = null; }
    if (tcpServer) { try { tcpServer.close(); } catch { } tcpServer = null; }
    clients.clear();
    currentDeviceInfo = null;
    emit('status_change', { status: 'stopped' });
};

export const sendMessage = (messageData) => {
    const payload = { type: 'MESSAGE', ...messageData, timestamp: Date.now() };
    const str = JSON.stringify(payload) + '\n';

    if (SIMULATION_MODE) {
        setTimeout(() => emit('message_received', {
            ...payload, id: `${payload.id}_self`, isSelf: true
        }), 300);
        return;
    }

    if (currentRole === 'survivor' && tcpClient) {
        try { tcpClient.write(str); } catch { }
        // Also echo to own chat (since rescue relays do NOT echo back to sender)
        emit('message_received', { ...payload, id: `${payload.id}_self`, isSelf: true });
    } else if (currentRole === 'rescue') {
        // Rescue sends message to all connected survivors
        broadcastToClients(payload);
        // Echo to own chat
        emit('message_received', { ...payload, id: `${payload.id}_self`, isSelf: true });
    }
};

export const sendSOS = (deviceInfo) => {
    const payload = { type: 'SOS', ...deviceInfo, timestamp: Date.now() };
    const str = JSON.stringify(payload) + '\n';

    if (SIMULATION_MODE) {
        setTimeout(() => emit('message_received', {
            id: 'sos_confirm', sender: 'System',
            text: '🆘 SOS Alert sent! Rescue team has been notified.',
            timestamp: Date.now(),
        }), 500);
        return;
    }
    if (tcpClient) {
        try { tcpClient.write(str); } catch { }
    }
};

export const isActive = () => isRunning;
