/**
 * MapScreen.js
 * ============
 * Live map showing all survivor locations as markers.
 * Rescue team sees all connected survivors.
 * Survivors see their own pin on the map.
 *
 * Uses react-native-maps (Google Maps on Android, Apple Maps on iOS).
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import { useMesh } from '../context/MeshContext';

export default function MapScreen() {
    const mesh = useMesh();
    const mapRef = useRef(null);
    const isRescue = mesh.role === 'rescue';

    // Own location (may be null before GPS fix)
    const ownLat = mesh.deviceInfo.lat;
    const ownLon = mesh.deviceInfo.lon;

    // Default region centred on own location, or Manila as fallback
    const region = {
        latitude: ownLat || 14.5995,
        longitude: ownLon || 120.9842,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
    };

    // Fly to the first survivor when the survivor list populates
    useEffect(() => {
        if (isRescue && mesh.survivors.length > 0 && mapRef.current) {
            const first = mesh.survivors[0];
            mapRef.current.animateToRegion({
                latitude: first.lat,
                longitude: first.lon,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
            }, 800);
        }
    }, [mesh.survivors.length]);

    // Centre map on own location
    const goToSelf = () => {
        if (mapRef.current && ownLat) {
            mapRef.current.animateToRegion({
                latitude: ownLat, longitude: ownLon,
                latitudeDelta: 0.01, longitudeDelta: 0.01
            }, 500);
        }
    };

    // Time-since helper
    const timeSince = (ts) => {
        const secs = Math.floor((Date.now() - ts) / 1000);
        if (secs < 60) return `${secs}s ago`;
        if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
        return `${Math.floor(secs / 3600)}h ago`;
    };

    return (
        <SafeAreaView style={styles.safe}>
            {/* Full-screen Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={region}
                showsUserLocation
                showsMyLocationButton={false}
                mapType="standard"
                userInterfaceStyle="dark"
            >
                {/* Survivor markers (rescue team view) */}
                {isRescue && mesh.survivors.map(s => (
                    <React.Fragment key={s.id}>
                        {/* Accuracy circle */}
                        <Circle
                            center={{ latitude: s.lat, longitude: s.lon }}
                            radius={50}
                            fillColor={s.isSOS ? 'rgba(255,59,48,0.15)' : 'rgba(255,159,10,0.15)'}
                            strokeColor={s.isSOS ? '#FF3B30' : '#FF9F0A'}
                            strokeWidth={1}
                        />
                        <Marker
                            coordinate={{ latitude: s.lat, longitude: s.lon }}
                            pinColor={s.isSOS ? '#FF3B30' : '#FF9F0A'}
                            title={s.name}
                        >
                            <Callout tooltip>
                                <View style={styles.callout}>
                                    <Text style={styles.calloutName}>{s.isSOS ? '🆘 ' : '🔴 '}{s.name}</Text>
                                    <Text style={styles.calloutCoord}>
                                        {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                                    </Text>
                                    <Text style={styles.calloutTime}>Last seen: {timeSince(s.timestamp)}</Text>
                                </View>
                            </Callout>
                        </Marker>
                    </React.Fragment>
                ))}

                {/* Own location pin (survivor view) */}
                {!isRescue && ownLat && (
                    <Marker
                        coordinate={{ latitude: ownLat, longitude: ownLon }}
                        pinColor="#0A84FF"
                        title="Your Location"
                        description={`${ownLat.toFixed(5)}, ${ownLon.toFixed(5)}`}
                    />
                )}
            </MapView>

            {/* Info panel overlay */}
            <View style={styles.panel}>
                {isRescue ? (
                    <Text style={styles.panelText}>
                        👥 {mesh.survivors.length} survivor(s) tracked
                    </Text>
                ) : (
                    <Text style={styles.panelText}>
                        {ownLat ? `📍 Your pin: ${ownLat.toFixed(4)}, ${ownLon.toFixed(4)}` : '📍 Waiting for GPS…'}
                    </Text>
                )}
            </View>

            {/* Re-centre button */}
            <TouchableOpacity style={styles.centreBtn} onPress={goToSelf}>
                <Text style={styles.centreBtnText}>◎</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0D1117' },
    map: { flex: 1 },
    panel: {
        position: 'absolute', bottom: 20, left: 16, right: 16,
        backgroundColor: 'rgba(22,27,34,0.92)', borderRadius: 12,
        padding: 14, borderWidth: 1, borderColor: '#30363D'
    },
    panelText: { color: '#F0F6FC', fontWeight: '700', fontSize: 14, textAlign: 'center' },
    callout: {
        backgroundColor: '#161B22', borderRadius: 10, padding: 12, minWidth: 180,
        borderWidth: 1, borderColor: '#30363D'
    },
    calloutName: { color: '#F0F6FC', fontWeight: '700', fontSize: 14, marginBottom: 4 },
    calloutCoord: { color: '#8B949E', fontSize: 12, fontFamily: 'monospace' },
    calloutTime: { color: '#FF9F0A', fontSize: 11, marginTop: 4 },
    centreBtn: {
        position: 'absolute', top: 16, right: 16, backgroundColor: '#161B22',
        width: 44, height: 44, borderRadius: 22, alignItems: 'center',
        justifyContent: 'center', borderWidth: 1, borderColor: '#30363D'
    },
    centreBtnText: { color: '#F0F6FC', fontSize: 22 },
});
