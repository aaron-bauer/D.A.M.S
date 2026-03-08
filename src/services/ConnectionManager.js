/**
 * ConnectionManager.js
 * ====================
 * Handles TCP socket lifecycles for both Rescue (Server) and Survivor (Client).
 */
import TcpSocket from 'react-native-tcp-socket';
import * as Protocol from './ProtocolHandler';

const P2P_PORT = 9999;

let server = null;
let activeClient = null; // Survivor's outbound connection
const peers = new Map(); // Rescue's inbound connections

export const startServer = (onStatusChange, onMessage) => {
    if (server) stopAll();

    try {
        server = TcpSocket.createServer((socket) => {
            const key = `${socket.remoteAddress}:${socket.remotePort}`;
            peers.set(key, socket);
            onStatusChange({ status: 'connected', peerCount: peers.size });

            let buffer = '';
            socket.on('data', (data) => {
                buffer += data.toString('utf8');
                const parts = buffer.split('\n');
                buffer = parts.pop();
                parts.forEach(part => {
                    const msg = Protocol.parse(part);
                    if (msg) onMessage(msg, socket);
                });
            });

            socket.on('close', () => {
                peers.delete(key);
                onStatusChange({
                    status: peers.size > 0 ? 'connected' : 'listening',
                    peerCount: peers.size
                });
            });

            socket.on('error', () => {
                peers.delete(key);
                socket.destroy();
            });
        });

        server.listen({ port: P2P_PORT, host: '0.0.0.0' });
        onStatusChange({ status: 'listening', peerCount: 0 });
        return true;
    } catch (e) {
        onStatusChange({ status: 'error', error: e.message });
        return false;
    }
};

export const connectToServer = (host, deviceInfo, onStatusChange, onMessage) => {
    if (activeClient) activeClient.destroy();

    return new Promise((resolve) => {
        let settled = false;
        const s = TcpSocket.createConnection({ host, port: P2P_PORT, timeout: 5000 }, () => {
            if (settled) return; settled = true;
            activeClient = s;

            onStatusChange({ status: 'connected', serverIP: host, peerCount: 1 });

            // Handshake
            s.write(Protocol.wrap(Protocol.createLocation(deviceInfo)));

            let buffer = '';
            s.on('data', (d) => {
                buffer += d.toString('utf8');
                const parts = buffer.split('\n');
                buffer = parts.pop();
                parts.forEach(part => {
                    const msg = Protocol.parse(part);
                    if (msg) onMessage(msg, null);
                });
            });

            s.on('close', () => {
                activeClient = null;
                onStatusChange({ status: 'idle' });
            });

            resolve(true);
        });

        s.on('error', (err) => {
            if (settled) return; settled = true;
            s.destroy();
            resolve(false);
        });

        setTimeout(() => {
            if (settled) return; settled = true;
            s.destroy();
            resolve(false);
        }, 6000);
    });
};

export const broadcast = (payload) => {
    const data = Protocol.wrap(payload);
    if (activeClient) {
        try { activeClient.write(data); } catch (e) { }
    }
    peers.forEach(socket => {
        try { socket.write(data); } catch (e) { }
    });
};

export const stopAll = () => {
    if (server) { try { server.close(); } catch (e) { } }
    if (activeClient) { try { activeClient.destroy(); } catch (e) { } }
    peers.forEach(s => { try { s.destroy(); } catch (e) { } });
    peers.clear();
    server = null;
    activeClient = null;
};
