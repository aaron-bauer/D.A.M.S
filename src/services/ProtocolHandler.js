/**
 * ProtocolHandler.js
 * ==================
 * Handles serialization and parsing of mesh network messages.
 */

export const wrap = (payload) => {
    try {
        return JSON.stringify({
            ...payload,
            protocol: 'DAMS/1.0',
            timestamp: Date.now()
        }) + '\n';
    } catch (e) {
        console.error('[Protocol] Wrap error:', e);
        return null;
    }
};

export const parse = (data) => {
    try {
        const str = data.toString('utf8').trim();
        if (!str) return null;
        const msg = JSON.parse(str);
        if (!msg.type) return null;
        return msg;
    } catch (e) {
        // Suppress parse errors for raw/garbage data on the wire
        return null;
    }
};

export const createMessage = (sender, text, isSOS = false) => ({
    type: isSOS ? 'SOS' : 'MESSAGE',
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    sender,
    text,
    isSOS
});

export const createLocation = (deviceInfo) => ({
    type: 'LOCATION',
    ...deviceInfo
});
