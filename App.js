/**
 * App.js
 * ======
 * Root entry point for the Disaster Aid Management System.
 *
 * Responsibilities:
 *   1. Wraps the whole app in MeshProvider (global state)
 *   2. Renders the AppNavigator (all screens/tabs)
 *   3. Configures the status bar style
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { MeshProvider } from './src/context/MeshContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
    return (
        // GestureHandlerRootView is required by React Navigation
        <GestureHandlerRootView style={styles.flex}>
            {/* MeshProvider gives every screen access to shared P2P state */}
            <MeshProvider>
                <StatusBar style="light" backgroundColor="#0D1117" />
                <AppNavigator />
            </MeshProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
});
