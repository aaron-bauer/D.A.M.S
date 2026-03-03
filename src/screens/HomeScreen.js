/**
 * HomeScreen.js
 * =============
 * Main dashboard screen showing:
 *   • Current role badge (Survivor / Rescue Team)
 *   • Animated connection status
 *   • Current GPS coordinates
 *   • Network peer count
 *   • Start / Stop network button
 *   • SOS button (survivors only)
 *   • Change Role button
 */
import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, Alert, ScrollView, StatusBar, Platform, Linking
} from 'react-native';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
import { useMesh, useDispatch } from '../context/MeshContext';
import * as NetworkService from '../services/NetworkService';
import {
    requestLocationPermission, startLocationTracking,
    stopLocationTracking, formatLocation
} from '../services/LocationService';
import { getLastLocation } from '../services/StorageService';
import ConnectionStatus from '../components/ConnectionStatus';

export default function HomeScreen({ navigation }) {
    const mesh = useMesh();
    const dispatch = useDispatch();
    const [active, setActive] = useState(false);
    const [lastLocation, setLastLocation] = useState(null);

    // Load last known location on mount
    useEffect(() => {
        (async () => {
            const loc = await getLastLocation();
            if (loc) setLastLocation(loc);
        })();
    }, []);

    // Keep UI in sync with GPS updates
    useEffect(() => {
        if (mesh.deviceInfo.lat) {
            setLastLocation({ lat: mesh.deviceInfo.lat, lon: mesh.deviceInfo.lon });
        }
    }, [mesh.deviceInfo.lat, mesh.deviceInfo.lon]);

    // ─── Start/Stop Network ────────────────────────────────────────────────────
    const handleToggleNetwork = async () => {
        if (active) {
            NetworkService.stop();
            stopLocationTracking();
            setActive(false);
            dispatch({ type: 'SET_NETWORK_STATUS', payload: { status: 'idle' } });
            return;
        }

        // Request GPS permission first
        const granted = await requestLocationPermission();
        if (!granted) {
            Alert.alert('Permission Needed', 'Location permission is required to use D.A.M.S.');
            return;
        }

        // Start GPS tracking and update global state on each fix
        await startLocationTracking((loc) => {
            dispatch({ type: 'UPDATE_LOCATION', payload: loc });
        });

        // Get an immediate fix
        const loc = await getLastLocation();
        const deviceInfo = {
            id: mesh.deviceInfo.id,
            name: mesh.deviceInfo.name,
            lat: loc?.lat || 14.5995,
            lon: loc?.lon || 120.9842,
        };

        // Start the P2P network module
        try {
            await NetworkService.start(mesh.role, deviceInfo);
            setActive(true);
        } catch (err) {
            Alert.alert('Network Error', 'Failed to start mesh network: ' + err.message);
        }
    };

    const handleOpenHotspot = () => {
        if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.WIRELESS_SETTINGS');
            // Alternatively: Linking.sendIntent('android.settings.TETHER_SETTINGS');
            // Most androids use TETHER_SETTINGS for Hotspot
            Linking.openSettings().catch(() => {
                Alert.alert('Error', 'Could not open settings automatically.');
            });
        } else {
            Linking.openSettings();
        }
    };

    // ─── SOS ──────────────────────────────────────────────────────────────────
    const handleSOS = () => {
        Alert.alert(
            '🆘 Send SOS Alert',
            'This will broadcast your current location as an emergency to the rescue team.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'SEND SOS', style: 'destructive',
                    onPress: () => {
                        NetworkService.sendSOS({
                            id: mesh.deviceInfo.id,
                            name: mesh.deviceInfo.name,
                            lat: mesh.deviceInfo.lat || 14.5995,
                            lon: mesh.deviceInfo.lon || 120.9842,
                        });
                    },
                },
            ]
        );
    };

    // ─── Change Role ───────────────────────────────────────────────────────────
    const handleChangeRole = () => {
        Alert.alert(
            'Change Role',
            'This will stop the network and return to role selection.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Change Role', style: 'destructive',
                    onPress: () => {
                        NetworkService.stop();
                        stopLocationTracking();
                        setActive(false);
                        dispatch({ type: 'RESET' });
                        navigation.replace('Role');
                    },
                },
            ]
        );
    };

    // ─── UI Helpers ────────────────────────────────────────────────────────────
    const isRescue = mesh.role === 'rescue';
    const isSurvivor = mesh.role === 'survivor';
    const statusLabel = {
        idle: 'Offline — Press Start',
        initializing: 'Initializing network components…',
        scanning: 'Scanning for rescue server…',
        listening: 'Listening for survivors…',
        connected: 'Connected to mesh network',
        not_found: 'No rescue server found',
        no_wifi: 'Not connected to WiFi',
        error: 'Network error',
        stopped: 'Stopped',
    }[mesh.networkStatus.status] || mesh.networkStatus.status;

    const simBadge = NetworkService.SIMULATION_MODE ? '  [DEMO MODE]' : '';

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
            <ScrollView contentContainerStyle={[styles.container, { paddingTop: STATUS_BAR_HEIGHT + 8 }]}>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.appTitle}>D.A.M.S.{simBadge}</Text>
                    <View style={[styles.roleBadge, isRescue ? styles.rescueBadge : styles.survivorBadge]}>
                        <Text style={styles.roleBadgeText}>
                            {isRescue ? '🛡️ Rescue Team' : '🔴 Survivor'}
                        </Text>
                    </View>
                </View>

                {/* Connection Status Widget */}
                <View style={styles.card}>
                    <ConnectionStatus status={mesh.networkStatus.status} />
                    <Text style={styles.statusLabel}>{statusLabel}</Text>
                    {mesh.networkStatus.peerCount > 0 && (
                        <Text style={styles.peerCount}>
                            {isRescue
                                ? `👥 ${mesh.networkStatus.peerCount} survivor(s) connected`
                                : `📡 Connected to rescue server`}
                        </Text>
                    )}
                </View>

                {/* GPS Info */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>📍 Your Location</Text>
                    <Text style={styles.coordText}>
                        {lastLocation ? formatLocation(lastLocation) : 'Acquiring GPS…'}
                    </Text>
                    {lastLocation && (
                        <Text style={styles.muted}>
                            Saved locally · will broadcast when connected
                        </Text>
                    )}
                </View>

                {/* Network Mode Info */}
                {isRescue && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>📶 Rescue Server Info</Text>
                        <Text style={styles.muted}>
                            Enable your phone's mobile hotspot, then press Start.{'\n'}
                            Survivors connect to your hotspot and are automatically found.
                        </Text>
                        <TouchableOpacity style={styles.linkBtn} onPress={handleOpenHotspot}>
                            <Text style={styles.linkBtnText}>⚙️ Open Hotspot Settings</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {isSurvivor && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>📶 Connection Info</Text>
                        <Text style={styles.muted}>
                            Connect to the rescue team's WiFi hotspot, then press Start.{'\n'}
                            Your GPS location will be sent automatically.
                        </Text>
                    </View>
                )}

                {/* Start / Stop Button */}
                <TouchableOpacity
                    style={[styles.mainBtn, active ? styles.stopBtn : styles.startBtn]}
                    onPress={handleToggleNetwork}
                >
                    <Text style={styles.mainBtnText}>
                        {active ? '⏹  Stop Network' : '▶  Start Network'}
                    </Text>
                </TouchableOpacity>

                {/* SOS — survivors only */}
                {isSurvivor && (
                    <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
                        <Text style={styles.sosBtnText}>🆘  SEND SOS</Text>
                    </TouchableOpacity>
                )}

                {/* Change Role button */}
                <TouchableOpacity style={styles.changeRoleBtn} onPress={handleChangeRole}>
                    <Text style={styles.changeRoleBtnText}>↩ Change Role</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0D1117' },
    container: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    appTitle: { fontSize: 22, fontWeight: '900', color: '#FF3B30', letterSpacing: 2 },
    roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    survivorBadge: { backgroundColor: '#2D1315', borderWidth: 1, borderColor: '#FF3B30' },
    rescueBadge: { backgroundColor: '#0D1B2A', borderWidth: 1, borderColor: '#0A84FF' },
    roleBadgeText: { color: '#F0F6FC', fontWeight: '600', fontSize: 13 },
    card: {
        backgroundColor: '#161B22', borderRadius: 14, padding: 16, marginBottom: 14,
        borderWidth: 1, borderColor: '#30363D', alignItems: 'center'
    },
    statusLabel: { color: '#F0F6FC', fontSize: 15, fontWeight: '600', marginTop: 10 },
    peerCount: { color: '#30D158', fontSize: 13, marginTop: 6 },
    sectionTitle: { color: '#F0F6FC', fontWeight: '700', fontSize: 14, marginBottom: 8, alignSelf: 'flex-start' },
    coordText: { color: '#30D158', fontSize: 14, fontFamily: 'monospace', textAlign: 'center' },
    muted: { color: '#8B949E', fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 },
    mainBtn: { paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
    startBtn: { backgroundColor: '#0A84FF' },
    stopBtn: { backgroundColor: '#30363D' },
    mainBtnText: { color: '#F0F6FC', fontSize: 17, fontWeight: '800', letterSpacing: 1 },
    sosBtn: { backgroundColor: '#FF3B30', paddingVertical: 20, borderRadius: 14, alignItems: 'center' },
    sosBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
    changeRoleBtn: {
        marginTop: 8, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
        borderWidth: 1, borderColor: '#30363D', backgroundColor: '#161B22',
    },
    changeRoleBtnText: { color: '#8B949E', fontSize: 14, fontWeight: '600' },
    linkBtn: { marginTop: 15, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#30363D' },
    linkBtnText: { color: '#0A84FF', fontSize: 14, fontWeight: '700' },
});
