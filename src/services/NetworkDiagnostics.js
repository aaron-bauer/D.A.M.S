/**
 * NetworkDiagnostics.js
 * =====================
 * Performs step-by-step connectivity testing to identify why P2P fails.
 */
import * as Network from 'expo-network';
import TcpSocket from 'react-native-tcp-socket';

const P2P_PORT = 9999;

export const verifyNetworkState = async () => {
    const state = await Network.getNetworkStateAsync();
    const ip = await Network.getIpAddressAsync();

    const report = {
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        ip: ip,
        timestamp: new Date().toISOString()
    };

    console.log('[DIAG] Network State:', report);
    return report;
};

/**
 * Attempts a short TCP connection to the gateway to check for AP Isolation.
 * If this fails, the local network likely blocks client-to-client traffic.
 */
export const testGatewayReachability = async (gatewayIp) => {
    console.log(`[DIAG] Testing gateway reachability: ${gatewayIp}`);
    return new Promise((resolve) => {
        let settled = false;
        const s = TcpSocket.createConnection({
            host: gatewayIp,
            port: 80, // Try common port or P2P_PORT if server is there
            timeout: 2000
        }, () => {
            if (settled) return; settled = true;
            s.destroy();
            resolve({ success: true, message: 'Gateway reached' });
        });

        s.on('error', (err) => {
            if (settled) return; settled = true;
            s.destroy();
            // "Connection refused" is actually a GOOD sign (gateway exists)
            // "Timeout" or "Host unreachable" is bad.
            const isAlive = err.message.toLowerCase().includes('refused');
            resolve({
                success: isAlive,
                message: isAlive ? 'Gateway exists (refused)' : `Gateway unreachable: ${err.message}`
            });
        });

        setTimeout(() => {
            if (settled) return; settled = true;
            s.destroy();
            resolve({ success: false, message: 'Gateway reachability timeout' });
        }, 2500);
    });
};

/**
 * Verifies if the device can bind the P2P port.
 */
export const testPortBinding = async () => {
    console.log(`[DIAG] Testing port binding on ${P2P_PORT}`);
    return new Promise((resolve) => {
        try {
            const server = TcpSocket.createServer(() => { });
            server.on('error', (err) => {
                resolve({ success: false, message: `Binding failed: ${err.message}` });
            });
            server.listen({ port: P2P_PORT, host: '0.0.0.0' }, () => {
                server.close();
                resolve({ success: true, message: 'Port binding successful' });
            });
        } catch (e) {
            resolve({ success: false, message: `Exception during bind: ${e.message}` });
        }
    });
};

/**
 * Step-by-step TCP handshake test.
 */
export const testTcpHandshake = async (host) => {
    console.log(`[DIAG] Detailed Handshake Test with ${host}`);
    const logs = [];
    const log = (m) => { console.log(`[DIAG-HANDSHAKE] ${m}`); logs.push(m); };

    return new Promise((resolve) => {
        let settled = false;
        log(`Initiating connection to ${host}:${P2P_PORT}`);

        const s = TcpSocket.createConnection({ host, port: P2P_PORT, timeout: 5000 }, () => {
            if (settled) return; settled = true;
            log('✅ Connection ESTABLISHED');
            s.destroy();
            resolve({ success: true, logs });
        });

        s.on('connect', () => log('Stage: Connected (TCP ACK received)'));
        s.on('lookup', (err, address) => log(`Stage: DNS/IP lookup complete -> ${address}`));

        s.on('error', (err) => {
            if (settled) return; settled = true;
            log(`❌ Connection ERROR: ${err.message}`);
            s.destroy();
            resolve({ success: false, logs });
        });

        setTimeout(() => {
            if (settled) return; settled = true;
            log('❌ Connection TIMEOUT (5s)');
            s.destroy();
            resolve({ success: false, logs });
        }, 6000);
    });
};
