/**
 * MessagingScreen.js
 * ==================
 * Emergency broadcast messaging over the mesh network.
 * Messages are sent to all connected devices (Rescue ↔ Survivor).
 * Message history is stored locally.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    FlatList, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useMesh } from '../context/MeshContext';
import * as NetworkService from '../services/NetworkService';
import MessageBubble from '../components/MessageBubble';

export default function MessagingScreen() {
    const mesh = useMesh();
    const [text, setText] = useState('');
    const flatListRef = useRef(null);

    // Auto-scroll to latest message
    useEffect(() => {
        if (mesh.messages.length > 0 && flatListRef.current) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [mesh.messages.length]);

    const handleSend = () => {
        const trimmed = text.trim();
        if (!trimmed) return;

        NetworkService.sendMessage({
            id: `msg_${Date.now()}`,
            sender: mesh.deviceInfo.name,
            text: trimmed,
        });
        setText('');
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={80}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>💬 Emergency Messages</Text>
                    <Text style={styles.headerSub}>{mesh.messages.length} message(s)</Text>
                </View>

                {/* Message list */}
                {mesh.messages.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyText}>No messages yet.</Text>
                        <Text style={styles.emptyHint}>
                            Start the network on the Home tab, then send a message.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={mesh.messages}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <MessageBubble
                                message={item}
                                isSelf={item.sender === mesh.deviceInfo.name || item.isSelf}
                            />
                        )}
                        contentContainerStyle={styles.list}
                    />
                )}

                {/* Input bar */}
                <View style={styles.inputBar}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type an emergency message…"
                        placeholderTextColor="#8B949E"
                        value={text}
                        onChangeText={setText}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                        multiline
                        maxLength={300}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                        onPress={handleSend}
                        disabled={!text.trim()}
                    >
                        <Text style={styles.sendBtnText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0D1117' },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, borderBottomWidth: 1, borderBottomColor: '#30363D'
    },
    headerTitle: { color: '#F0F6FC', fontWeight: '800', fontSize: 17 },
    headerSub: { color: '#8B949E', fontSize: 12 },
    list: { padding: 12, paddingBottom: 4 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { color: '#F0F6FC', fontWeight: '700', fontSize: 16, marginBottom: 8 },
    emptyHint: { color: '#8B949E', fontSize: 13, textAlign: 'center', lineHeight: 20 },
    inputBar: {
        flexDirection: 'row', padding: 12, borderTopWidth: 1,
        borderTopColor: '#30363D', gap: 10, alignItems: 'flex-end'
    },
    input: {
        flex: 1, backgroundColor: '#161B22', borderRadius: 12, paddingHorizontal: 14,
        paddingVertical: 10, color: '#F0F6FC', fontSize: 15, borderWidth: 1,
        borderColor: '#30363D', maxHeight: 100
    },
    sendBtn: {
        backgroundColor: '#0A84FF', borderRadius: 12, paddingHorizontal: 18,
        paddingVertical: 12
    },
    sendBtnDisabled: { backgroundColor: '#21262D' },
    sendBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
