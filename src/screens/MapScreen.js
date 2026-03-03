/**
 * MapScreen.js
 * ============
 * Location tracking screen — shows all survivor GPS coordinates as cards.
 *
 * NOTE: react-native-maps crashes on Android without a valid Google Maps API key.
 * This screen replaces the MapView with a crash-safe coordinate list that shows
 * the same location data in a readable format. If you later obtain a Google Maps
 * API key, set it in app.json and swap back to MapView.
 */
import React from 'react';
import {
    View, Text, StyleSheet, SafeAreaView,
    FlatList, StatusBar, Platform,
} from 'react-native';
import { useMesh } from '../context/MeshContext';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

// Time-since helper
const timeSince = (ts) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
};

function SurvivorCard({ survivor }) {
    const bgColor = survivor.isSOS ? '#2D1315' : '#161B22';
    const borderColor = survivor.isSOS ? '#FF3B30' : '#30363D';
    const icon = survivor.isSOS ? '🆘' : '🔴';

    return (
        <View style={[styles.card, { backgroundColor: bgColor, borderColor }]}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>{icon}</Text>
                <View style={styles.cardHeaderText}>
                    <Text style={styles.cardName}>{survivor.name}</Text>
                    {survivor.isSOS && <Text style={styles.sosLabel}>SOS ALERT</Text>}
                </View>
                <Text style={styles.cardTime}>{timeSince(survivor.timestamp)}</Text>
            </View>
            <View style={styles.cardCoords}>
                <View style={styles.coordRow}>
                    <Text style={styles.coordLabel}>LAT</Text>
                    <Text style={styles.coordValue}>{survivor.lat.toFixed(6)}</Text>
                </View>
                <View style={styles.coordRow}>
                    <Text style={styles.coordLabel}>LON</Text>
                    <Text style={styles.coordValue}>{survivor.lon.toFixed(6)}</Text>
                </View>
            </View>
            <View style={styles.cardFooter}>
                <Text style={styles.coordsFull}>
                    📍 {survivor.lat.toFixed(4)}, {survivor.lon.toFixed(4)}
                </Text>
            </View>
        </View>
    );
}

export default function MapScreen() {
    const mesh = useMesh();
    const isRescue = mesh.role === 'rescue';
    const ownLat = mesh.deviceInfo.lat;
    const ownLon = mesh.deviceInfo.lon;

    return (
        <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="light-content" backgroundColor="#0D1117" />
            <View style={[styles.header, { paddingTop: STATUS_BAR_HEIGHT + 12 }]}>
                <Text style={styles.headerTitle}>🗺️ Live Locations</Text>
                {isRescue ? (
                    <Text style={styles.headerSub}>{mesh.survivors.length} survivor(s) tracked</Text>
                ) : (
                    <Text style={styles.headerSub}>Your GPS position</Text>
                )}
            </View>

            {isRescue ? (
                // ── Rescue view: list of all survivor locations ──────────────
                mesh.survivors.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyIcon}>📡</Text>
                        <Text style={styles.emptyTitle}>No survivors yet</Text>
                        <Text style={styles.emptyHint}>
                            Start the network on the Home tab.{'\n'}
                            Survivor locations will appear here once they connect.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={mesh.survivors}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <SurvivorCard survivor={item} />}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                    />
                )
            ) : (
                // ── Survivor view: own location card ─────────────────────────
                <View style={styles.centeredContent}>
                    {ownLat ? (
                        <View style={[styles.card, styles.ownCard]}>
                            <Text style={styles.cardIcon}>📍</Text>
                            <Text style={styles.ownTitle}>Your Current Location</Text>
                            <View style={styles.cardCoords}>
                                <View style={styles.coordRow}>
                                    <Text style={styles.coordLabel}>LAT</Text>
                                    <Text style={styles.coordValue}>{ownLat.toFixed(6)}</Text>
                                </View>
                                <View style={styles.coordRow}>
                                    <Text style={styles.coordLabel}>LON</Text>
                                    <Text style={styles.coordValue}>{ownLon.toFixed(6)}</Text>
                                </View>
                            </View>
                            <Text style={styles.ownHint}>
                                This location is saved locally and sent to the rescue team when connected.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>📍</Text>
                            <Text style={styles.emptyTitle}>Waiting for GPS…</Text>
                            <Text style={styles.emptyHint}>
                                Start the network on the Home tab to begin GPS tracking.
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0D1117' },
    header: {
        paddingHorizontal: 20, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: '#30363D',
    },
    headerTitle: { color: '#F0F6FC', fontWeight: '900', fontSize: 20, letterSpacing: 1 },
    headerSub: { color: '#8B949E', fontSize: 12, marginTop: 2 },

    list: { padding: 16, paddingBottom: 32 },

    card: {
        backgroundColor: '#161B22', borderRadius: 14, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: '#30363D',
    },
    ownCard: {
        margin: 16, borderColor: '#0A84FF', backgroundColor: '#0D1B2A', alignItems: 'center',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cardIcon: { fontSize: 28, marginRight: 10 },
    cardHeaderText: { flex: 1 },
    cardName: { color: '#F0F6FC', fontWeight: '700', fontSize: 15 },
    sosLabel: {
        color: '#FF3B30', fontSize: 10, fontWeight: '900',
        letterSpacing: 1.5, marginTop: 2,
    },
    cardTime: { color: '#8B949E', fontSize: 11 },

    cardCoords: {
        backgroundColor: '#0D1117', borderRadius: 10, padding: 12,
        gap: 6, marginBottom: 10,
    },
    coordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    coordLabel: {
        color: '#8B949E', fontSize: 11, fontWeight: '700',
        letterSpacing: 1.5, width: 36,
    },
    coordValue: { color: '#30D158', fontSize: 13, fontFamily: 'monospace', flex: 1, textAlign: 'right' },

    cardFooter: { alignItems: 'center' },
    coordsFull: { color: '#8B949E', fontSize: 11 },

    ownTitle: { color: '#F0F6FC', fontWeight: '700', fontSize: 16, marginTop: 8, marginBottom: 12 },
    ownHint: { color: '#8B949E', fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 18 },

    centeredContent: { flex: 1, justifyContent: 'flex-start' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyIcon: { fontSize: 52, marginBottom: 16 },
    emptyTitle: { color: '#F0F6FC', fontWeight: '700', fontSize: 17, marginBottom: 10 },
    emptyHint: { color: '#8B949E', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
