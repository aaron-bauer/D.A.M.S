/**
 * NetworkService.js (Refactored Orchestrator)
 * ==========================================
 * Manages the mesh networking lifecycle by coordinating modular services.
 */
import * as Diagnostics from './NetworkDiagnostics';
import * as Discovery from './DiscoveryService';
import * as Connection from './ConnectionManager';
import * as Hotspot from './HotspotHelper';
import * as Protocol from './ProtocolHandler';

let _isRunning = false;
let _currentRole = null;
let _deviceInfo = null;
let _reconnectTimer = null;
let _broadcastTimer = null;

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

const handleMessage = (msg, socket) => {
    if (msg.type === 'LOCATION') {
        emit('survivor_update', msg);
    } else if (msg.type === 'MESSAGE' || msg.type === 'SOS') {
        if (msg.type === 'SOS') emit('sos_received', msg);
        emit('message_received', msg);

        // Relay if we are rescue
        if (_currentRole === 'rescue' && socket) {
            Connection.broadcast(msg);
        }
    }
};

const handleStatus = (status) => {
    emit('status_change', status);
};

export const start = async (role, deviceInfo) => {
    if (_isRunning) stop();
    _isRunning = true;
    _currentRole = role;
    _deviceInfo = deviceInfo;

    handleStatus({ status: 'initializing' });

    // 1. Initial Diagnostics
    const diag = await Diagnostics.verifyNetworkState();

    if (role === 'rescue') {
        // Rescue Hub Mode
        const bindTest = await Diagnostics.testPortBinding();
        if (!bindTest.success) {
            handleStatus({ status: 'error', error: bindTest.message });
            return false;
        }

        Connection.startServer(handleStatus, handleMessage);
        Discovery.startBeacon(deviceInfo, Hotspot.getBroadcast(diag.ip));

    } else {
        // Survivor Mode
        Discovery.startListening(async (host) => {
            if (await Connection.connectToServer(host, deviceInfo, handleStatus, handleMessage)) {
                Discovery.stopDiscovery();
            }
        });

        // Also run parallel scan for gateways
        Discovery.scanGateways(async (host) => {
            if (await Connection.connectToServer(host, deviceInfo, handleStatus, handleMessage)) {
                Discovery.stopDiscovery();
            }
        });

        // Reconnect logic
        _reconnectTimer = setInterval(async () => {
            // Logic for background reconnection if lost
        }, 15000);

        // Location broadcast logic
        _broadcastTimer = setInterval(() => {
            if (_deviceInfo) {
                Connection.broadcast(Protocol.createLocation(_deviceInfo));
            }
        }, 15000);
    }

    return true;
};

export const stop = () => {
    _isRunning = false;
    if (_reconnectTimer) clearInterval(_reconnectTimer);
    if (_broadcastTimer) clearInterval(_broadcastTimer);
    _reconnectTimer = null;
    _broadcastTimer = null;
    Discovery.stopDiscovery();
    Connection.stopAll();
    handleStatus({ status: 'stopped' });
};

export const sendMessage = (text, isSOS = false) => {
    const msg = Protocol.createMessage(_deviceInfo.name, text, isSOS);
    Connection.broadcast(msg);
    // Local echo
    emit('message_received', { ...msg, isSelf: true });
};

export const sendSOS = () => sendMessage('🆘 SOS! NEED HELP!', true);

export const selfTest = async () => {
    const result = await Diagnostics.testPortBinding();
    handleStatus({
        status: result.success ? 'listening' : 'error',
        error: result.message,
        info: result.success ? '✅ Server Test Passed' : '❌ Server Test Failed'
    });
    return result.success;
};

// Expose internal modules for deep diagnostic UI
export { Diagnostics, Hotspot };
