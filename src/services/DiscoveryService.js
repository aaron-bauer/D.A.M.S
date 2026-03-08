/**
 * DiscoveryService.js
 * ===================
 * Handles UDP discovery (Multicast/Broadcast) and active TCP scanning.
 */
import TcpSocket from 'react-native-tcp-socket';
import * as HotspotHelper from './HotspotHelper';

const P2P_PORT = 9999;
const UDP_PORT = 9998;
const MULTICAST_ADDR = '239.1.1.1';

let udpSocket = null;
let beaconTimer = null;

export const startBeacon = (deviceInfo, broadcastAddr = '255.255.255.255') => {
    if (udpSocket) stopDiscovery();

    try {
        udpSocket = TcpSocket.createSocket({ type: 'udp4', reusePort: true });

        // Bind to any port, but broadcast to UDP_PORT
        udpSocket.bind(0, '0.0.0.0', () => {
            try { udpSocket.setBroadcast(true); } catch (e) { }
        });

        const beacon = () => {
            if (!udpSocket) return;
            const msg = JSON.stringify({ type: 'DAMS_BEACON', ...deviceInfo });
            const buf = Buffer.from ? Buffer.from(msg) : msg;

            // Send to both global broadcast and multicast
            try {
                udpSocket.send(buf, 0, buf.length, UDP_PORT, '255.255.255.255');
                udpSocket.send(buf, 0, buf.length, UDP_PORT, broadcastAddr);
                udpSocket.send(buf, 0, buf.length, UDP_PORT, MULTICAST_ADDR);
            } catch (e) { }
        };

        beacon();
        beaconTimer = setInterval(beacon, 2000);
    } catch (e) {
        console.error('[Discovery] Failed to start beacon:', e);
    }
};

export const startListening = (onFound) => {
    if (udpSocket) stopDiscovery();

    try {
        udpSocket = TcpSocket.createSocket({ type: 'udp4', reusePort: true });
        udpSocket.bind(UDP_PORT, '0.0.0.0', () => {
            try {
                udpSocket.addMembership(MULTICAST_ADDR);
            } catch (e) { }
        });

        udpSocket.on('message', (data, rinfo) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'DAMS_BEACON') {
                    onFound(rinfo.address, msg);
                }
            } catch (e) { }
        });
    } catch (e) {
        console.error('[Discovery] Failed to start listener:', e);
    }
};

export const stopDiscovery = () => {
    if (beaconTimer) clearInterval(beaconTimer);
    if (udpSocket) {
        try { udpSocket.close(); } catch (e) { }
    }
    udpSocket = null;
    beaconTimer = null;
};

/**
 * Performs a parallel scan of the common gateways.
 */
export const scanGateways = async (onFound) => {
    console.log('[Discovery] Scanning common gateways...');
    const tasks = HotspotHelper.COMMON_HOTSPOT_GATEWAYS.map(host => {
        return new Promise((resolve) => {
            const s = TcpSocket.createConnection({ host, port: P2P_PORT, timeout: 1500 }, () => {
                s.destroy();
                onFound(host);
                resolve(true);
            });
            s.on('error', () => { s.destroy(); resolve(false); });
            setTimeout(() => { s.destroy(); resolve(false); }, 2000);
        });
    });

    const results = await Promise.all(tasks);
    return results.some(r => r === true);
};
