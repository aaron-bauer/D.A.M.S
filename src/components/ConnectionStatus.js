/**
 * ConnectionStatus.js
 * ====================
 * Animated pulsing circle that visually shows network connection state.
 *
 * Status colours:
 *   connected → green  🟢
 *   listening → green  🟢
 *   scanning  → amber  🟡
 *   not_found → red    🔴
 *   error     → red    🔴
 *   idle/other→ grey   ⚫
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const STATUS_COLOR = {
    connected: '#30D158',
    listening: '#30D158',
    scanning: '#FF9F0A',
    no_wifi: '#FF9F0A',
    not_found: '#FF3B30',
    error: '#FF3B30',
};

const ConnectionStatus = React.memo(({ status }) => {
    const pulse = useRef(new Animated.Value(1)).current;
    const fade = useRef(new Animated.Value(0.6)).current;

    const isActive = ['connected', 'listening', 'scanning'].includes(status);
    const color = STATUS_COLOR[status] || '#30363D';

    useEffect(() => {
        if (isActive) {
            // Pulsing animation while actively connecting/connected
            Animated.loop(
                Animated.parallel([
                    Animated.sequence([
                        Animated.timing(pulse, { toValue: 1.35, duration: 800, useNativeDriver: true }),
                        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
                    ]),
                    Animated.sequence([
                        Animated.timing(fade, { toValue: 0.15, duration: 800, useNativeDriver: true }),
                        Animated.timing(fade, { toValue: 0.6, duration: 800, useNativeDriver: true }),
                    ]),
                ])
            ).start();
        } else {
            pulse.stopAnimation();
            pulse.setValue(1);
        }
    }, [status]);

    return (
        <View style={styles.wrapper}>
            {/* Outer pulsing ring */}
            <Animated.View style={[
                styles.ring,
                { borderColor: color, opacity: fade, transform: [{ scale: pulse }] },
            ]} />
            {/* Inner solid dot */}
            <View style={[styles.dot, { backgroundColor: color }]} />
        </View>
    );
});

export default ConnectionStatus;

const styles = StyleSheet.create({
    wrapper: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 2 },
    dot: { width: 44, height: 44, borderRadius: 22 },
});
