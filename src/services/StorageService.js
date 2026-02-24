/**
 * StorageService.js
 * =================
 * Handles all persistent local storage using AsyncStorage.
 * Data is saved ON the device — no internet or server needed.
 * GPS coordinates survive app restarts so they can be broadcast offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ───────────────────────────────────────────────────────────
const KEYS = {
    LAST_LOCATION: '@dams:last_location',
    DEVICE_ROLE: '@dams:device_role',
    DEVICE_NAME: '@dams:device_name',
    DEVICE_ID: '@dams:device_id',
    MESSAGES: '@dams:messages',
};

// ─── Location ───────────────────────────────────────────────────────────────
/** Save the latest GPS coordinates so they are available when offline. */
export const saveLastLocation = async (location) => {
    try {
        await AsyncStorage.setItem(KEYS.LAST_LOCATION, JSON.stringify(location));
    } catch (e) { console.error('[Storage] saveLastLocation:', e); }
};

/** Returns { lat, lon, accuracy, timestamp } or null. */
export const getLastLocation = async () => {
    try {
        const raw = await AsyncStorage.getItem(KEYS.LAST_LOCATION);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
};

// ─── Device Identity ─────────────────────────────────────────────────────────
export const saveDeviceRole = async (role) => {
    try { await AsyncStorage.setItem(KEYS.DEVICE_ROLE, role); }
    catch (e) { console.error('[Storage] saveDeviceRole:', e); }
};
export const getDeviceRole = async () => {
    try { return await AsyncStorage.getItem(KEYS.DEVICE_ROLE); }
    catch (e) { return null; }
};

export const saveDeviceName = async (name) => {
    try { await AsyncStorage.setItem(KEYS.DEVICE_NAME, name); }
    catch (e) { console.error('[Storage] saveDeviceName:', e); }
};
export const getDeviceName = async () => {
    try { return await AsyncStorage.getItem(KEYS.DEVICE_NAME); }
    catch (e) { return null; }
};

export const saveDeviceId = async (id) => {
    try { await AsyncStorage.setItem(KEYS.DEVICE_ID, id); }
    catch (e) { console.error('[Storage] saveDeviceId:', e); }
};
export const getDeviceId = async () => {
    try { return await AsyncStorage.getItem(KEYS.DEVICE_ID); }
    catch (e) { return null; }
};

// ─── Messages ─────────────────────────────────────────────────────────────────
/** Appends a message object to the local history (max 200 kept). */
export const saveMessage = async (message) => {
    try {
        const existing = await getMessages();
        const updated = [...existing, message].slice(-200);
        await AsyncStorage.setItem(KEYS.MESSAGES, JSON.stringify(updated));
    } catch (e) { console.error('[Storage] saveMessage:', e); }
};

/** Returns the full stored message list. */
export const getMessages = async () => {
    try {
        const raw = await AsyncStorage.getItem(KEYS.MESSAGES);
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
};

/** Wipes all app data (for reset / debug). */
export const clearAll = async () => {
    try { await AsyncStorage.multiRemove(Object.values(KEYS)); }
    catch (e) { console.error('[Storage] clearAll:', e); }
};
