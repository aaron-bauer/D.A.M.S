/**
 * RoleScreen.js
 * =============
 * First screen shown on launch.
 * The user picks their role — Survivor or Rescue Team —
 * and enters a display name. This is stored locally and
 * used to identify the device on the mesh network.
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, SafeAreaView, Animated, Alert,
} from 'react-native';
import {
    saveDeviceRole, saveDeviceName, saveDeviceId,
    getDeviceRole, getDeviceName, getDeviceId
} from '../services/StorageService';
import { useMesh, useDispatch } from '../context/MeshContext';

// Generate a simple unique device ID (timestamp + random)
const genId = () => `dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function RoleScreen({ navigation }) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch();

    // Pulse animation for the logo
    const pulse = React.useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    // If the user already chose a role, skip to MainTabs
    useEffect(() => {
        (async () => {
            const savedRole = await getDeviceRole();
            const savedName = await getDeviceName();
            if (savedRole && savedName) {
                const savedId = await getDeviceId();
                dispatch({ type: 'SET_ROLE', payload: savedRole });
                dispatch({ type: 'SET_DEVICE_INFO', payload: { id: savedId, name: savedName } });
                navigation.replace('MainTabs');
            } else {
                setLoading(false);
            }
        })();
    }, []);

    // Save role and navigate
    const selectRole = async (role) => {
        const trimmed = name.trim();
        if (!trimmed) { Alert.alert('Name Required', 'Please enter your name.'); return; }

        const id = genId();
        const displayName = `${trimmed} (${role === 'rescue' ? '🛡️ Rescue' : '🔴 Survivor'})`;

        await saveDeviceId(id);
        await saveDeviceName(displayName);
        await saveDeviceRole(role);

        dispatch({ type: 'SET_ROLE', payload: role });
        dispatch({ type: 'SET_DEVICE_INFO', payload: { id, name: displayName } });

        navigation.replace('MainTabs');
    };

    if (loading) return (
        <View style={styles.container}>
            <Text style={styles.muted}>Loading…</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Logo */}
            <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulse }] }]}>
                <Text style={styles.logoEmoji}>🆘</Text>
                <Text style={styles.logoTitle}>D.A.M.S.</Text>
                <Text style={styles.logoSub}>Disaster Aid Management System</Text>
            </Animated.View>

            {/* Name input */}
            <View style={styles.card}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. John Doe"
                    placeholderTextColor="#8B949E"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    maxLength={30}
                />

                <Text style={styles.label}>Select Your Role</Text>
                <Text style={styles.hint}>Choose once — reflects your purpose in this emergency.</Text>

                {/* Survivor button */}
                <TouchableOpacity style={[styles.roleBtn, styles.survivorBtn]} onPress={() => selectRole('survivor')}>
                    <Text style={styles.roleBtnIcon}>🔴</Text>
                    <View>
                        <Text style={styles.roleBtnTitle}>I am a Survivor</Text>
                        <Text style={styles.roleBtnDesc}>Broadcasts my GPS to the rescue team</Text>
                    </View>
                </TouchableOpacity>

                {/* Rescue Team button */}
                <TouchableOpacity style={[styles.roleBtn, styles.rescueBtn]} onPress={() => selectRole('rescue')}>
                    <Text style={styles.roleBtnIcon}>🛡️</Text>
                    <View>
                        <Text style={styles.roleBtnTitle}>I am Rescue Team</Text>
                        <Text style={styles.roleBtnDesc}>Receives and maps survivor locations</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <Text style={styles.footer}>Works without internet · GPS + Local WiFi only</Text>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0D1117', alignItems: 'center', justifyContent: 'center', padding: 24 },
    logoWrap: { alignItems: 'center', marginBottom: 32 },
    logoEmoji: { fontSize: 64, marginBottom: 8 },
    logoTitle: { fontSize: 36, fontWeight: '900', color: '#FF3B30', letterSpacing: 4 },
    logoSub: { fontSize: 13, color: '#8B949E', marginTop: 4, letterSpacing: 1 },
    card: {
        width: '100%', backgroundColor: '#161B22', borderRadius: 16, padding: 20,
        borderWidth: 1, borderColor: '#30363D'
    },
    label: { color: '#F0F6FC', fontWeight: '700', fontSize: 14, marginBottom: 8, marginTop: 16 },
    hint: { color: '#8B949E', fontSize: 12, marginBottom: 12 },
    input: {
        backgroundColor: '#0D1117', borderWidth: 1, borderColor: '#30363D', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12, color: '#F0F6FC', fontSize: 16
    },
    roleBtn: {
        flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12,
        marginTop: 12, gap: 14
    },
    survivorBtn: { backgroundColor: '#2D1315', borderWidth: 1, borderColor: '#FF3B30' },
    rescueBtn: { backgroundColor: '#0D1B2A', borderWidth: 1, borderColor: '#0A84FF' },
    roleBtnIcon: { fontSize: 32 },
    roleBtnTitle: { color: '#F0F6FC', fontWeight: '700', fontSize: 16 },
    roleBtnDesc: { color: '#8B949E', fontSize: 12, marginTop: 2 },
    muted: { color: '#8B949E' },
    footer: { color: '#8B949E', fontSize: 11, marginTop: 24, textAlign: 'center' },
});
