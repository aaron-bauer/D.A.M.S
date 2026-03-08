/**
 * HotspotHelper.js
 * ================
 * Subnet and IP range utilities for local mesh discovery.
 */

export const COMMON_HOTSPOT_GATEWAYS = [
    '192.168.43.1', // Android Default
    '192.168.49.1', // WiFi Direct / Samsung
    '192.168.1.1',  // Common Router
    '192.168.0.1',  // Common Router
    '10.42.0.1',    // Linux/Ubuntu Hotspot
    '172.20.10.1',  // iOS Personal Hotspot
    '192.168.44.1', // Custom Android
    '192.168.45.1', // Custom Android
];

export const getSubnet = (ip) => {
    if (!ip || ip === '0.0.0.0') return null;
    return ip.split('.').slice(0, 3).join('.');
};

export const getGateway = (ip) => {
    const subnet = getSubnet(ip);
    return subnet ? `${subnet}.1` : null;
};

export const getBroadcast = (ip) => {
    const subnet = getSubnet(ip);
    return subnet ? `${subnet}.255` : '255.255.255.255';
};

/**
 * Checks if the IP belongs to a known hotspot range.
 */
export const isHotspotIp = (ip) => {
    if (!ip) return false;
    return ip.startsWith('192.168.43') || ip.startsWith('192.168.49');
};
