/**
 * MessageBubble.js
 * ================
 * Chat-bubble component for the emergency messaging screen.
 * Self messages appear on the right (blue), others on the left (dark).
 * SOS messages get a full-width red alert style.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MessageBubble = React.memo(({ message, isSelf }) => {
    // SOS messages get a special full-width alert treatment
    if (message.isSOS) {
        return (
            <View style={styles.sosAlert}>
                <Text style={styles.sosAlertText}>🆘 SOS — {message.sender}</Text>
                <Text style={styles.sosAlertBody}>{message.text}</Text>
                <Text style={styles.time}>{new Date(message.timestamp).toLocaleTimeString()}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}>
            <View style={[styles.bubble, isSelf ? styles.selfBubble : styles.otherBubble]}>
                {!isSelf && <Text style={styles.sender}>{message.sender}</Text>}
                <Text style={styles.bodyText}>{message.text}</Text>
                <Text style={[styles.time, isSelf ? styles.timeSelf : styles.timeOther]}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                </Text>
            </View>
        </View>
    );
});

export default MessageBubble;

const styles = StyleSheet.create({
    row: { marginVertical: 4, paddingHorizontal: 12 },
    rowSelf: { alignItems: 'flex-end' },
    rowOther: { alignItems: 'flex-start' },
    bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
    selfBubble: { backgroundColor: '#0A84FF', borderBottomRightRadius: 4 },
    otherBubble: { backgroundColor: '#21262D', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#30363D' },
    sender: { color: '#8B949E', fontSize: 11, fontWeight: '600', marginBottom: 4 },
    bodyText: { color: '#F0F6FC', fontSize: 15, lineHeight: 21 },
    time: { fontSize: 10, marginTop: 4 },
    timeSelf: { color: 'rgba(255,255,255,0.55)', textAlign: 'right' },
    timeOther: { color: '#8B949E' },
    sosAlert: {
        margin: 10, backgroundColor: '#2D1315', borderRadius: 12, padding: 14,
        borderWidth: 1.5, borderColor: '#FF3B30'
    },
    sosAlertText: { color: '#FF3B30', fontWeight: '900', fontSize: 15, marginBottom: 4 },
    sosAlertBody: { color: '#F0F6FC', fontSize: 14, lineHeight: 20 },
});
