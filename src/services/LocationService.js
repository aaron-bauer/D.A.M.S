/**
 * LocationService.js
 * ==================
 * Uses the device GPS chip (via expo-location) to track position.
 *
 * GPS works WITHOUT internet — it talks directly to satellites.
 * Coordinates are saved locally so they can be broadcast even offline.
 */
import * as Location from 'expo-location';
import { saveLastLocation } from './StorageService';

let locationSubscription = null; // Active watcher reference

// ─── Permissions ──────────────────────────────────────────────────────────────
/**
 * Ask the user for foreground location permission.
 * Must be called before any GPS functions.
 * @returns {boolean} true if granted
 */
export const requestLocationPermission = async () => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('[Location] Permission denied');
            return false;
        }
        return true;
    } catch (e) {
        console.error('[Location] requestPermission:', e);
        return false;
    }
};

// ─── One-shot Read ────────────────────────────────────────────────────────────
/**
 * Get the current GPS position once.
 * Saves it to storage for offline use.
 * @returns {{ lat, lon, accuracy, timestamp } | null}
 */
export const getCurrentLocation = async () => {
    try {
        const result = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            maximumAge: 10000,
            timeout: 15000,
        });
        const location = {
            lat: result.coords.latitude,
            lon: result.coords.longitude,
            accuracy: result.coords.accuracy,
            altitude: result.coords.altitude,
            timestamp: result.timestamp,
        };
        await saveLastLocation(location);
        return location;
    } catch (e) {
        console.error('[Location] getCurrentLocation:', e);
        return null;
    }
};

// ─── Continuous Tracking ──────────────────────────────────────────────────────
/**
 * Watch GPS position continuously.
 * Calls onUpdate(location) on every new fix and saves to storage.
 * @param {Function} onUpdate - callback(location)
 */
export const startLocationTracking = async (onUpdate) => {
    if (locationSubscription) return; // Already tracking
    try {
        locationSubscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 10000, // Every 10 s at minimum
                distanceInterval: 5,     // Or after moving 5 m
            },
            async (result) => {
                const location = {
                    lat: result.coords.latitude,
                    lon: result.coords.longitude,
                    accuracy: result.coords.accuracy,
                    altitude: result.coords.altitude,
                    timestamp: result.timestamp,
                };
                await saveLastLocation(location);
                if (onUpdate) onUpdate(location);
            },
        );
        console.log('[Location] Tracking started');
    } catch (e) {
        console.error('[Location] startTracking:', e);
    }
};

/** Stop GPS tracking to save battery. */
export const stopLocationTracking = () => {
    if (locationSubscription) {
        locationSubscription.remove();
        locationSubscription = null;
        console.log('[Location] Tracking stopped');
    }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Format a location object to a human-readable string.
 * e.g. "14.5995°N, 120.9842°E (±8m)"
 */
export const formatLocation = (location) => {
    if (!location) return 'Unknown';
    const { lat, lon, accuracy } = location;
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    const acc = accuracy ? ` (±${Math.round(accuracy)}m)` : '';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}${acc}`;
};
