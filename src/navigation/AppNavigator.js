/**
 * AppNavigator.js
 * ===============
 * Defines all app screens and navigation flow:
 *
 *   RoleScreen          ← first launch: choose Survivor or Rescue Team
 *       ↓
 *   MainTabs
 *     ├── HomeTab       ← status, SOS, network controls
 *     ├── MapTab        ← live map with survivor markers
 *     └── MessagesTab   ← emergency text messaging
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import RoleScreen from '../screens/RoleScreen';
import HomeScreen from '../screens/HomeScreen';

// Lazy load heavy screens to improve app startup time
const MapScreen = React.lazy(() => import('../screens/MapScreen'));
const MessagingScreen = React.lazy(() => import('../screens/MessagingScreen'));

const SuspenseScreen = (Component) => (props) => (
    <React.Suspense fallback={<Text style={{ color: '#8B949E', textAlign: 'center', marginTop: 50 }}>Loading Screen...</Text>}>
        <Component {...props} />
    </React.Suspense>
);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Tab icons (using emoji to avoid icon library dependency) ─────────────────
const tabIcon = (emoji) => ({ focused }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
);

// ─── Bottom Tabs ──────────────────────────────────────────────────────────────
const MainTabs = () => (
    <Tab.Navigator
        screenOptions={{
            headerShown: false,
            tabBarStyle: { backgroundColor: '#161B22', borderTopColor: '#30363D', paddingBottom: 4 },
            tabBarActiveTintColor: '#FF3B30',
            tabBarInactiveTintColor: '#8B949E',
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
    >
        <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{ tabBarIcon: tabIcon('📡'), tabBarLabel: 'Status' }}
        />
        <Tab.Screen
            name="Map"
            component={SuspenseScreen(MapScreen)}
            options={{ tabBarIcon: tabIcon('🗺️'), tabBarLabel: 'Live Map' }}
        />
        <Tab.Screen
            name="Messages"
            component={SuspenseScreen(MessagingScreen)}
            options={{ tabBarIcon: tabIcon('💬'), tabBarLabel: 'Messages' }}
        />
    </Tab.Navigator>
);

// ─── Root Stack ───────────────────────────────────────────────────────────────
const AppNavigator = () => (
    <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Role" component={RoleScreen} />
            <Stack.Screen name="MainTabs" component={MainTabs} />
        </Stack.Navigator>
    </NavigationContainer>
);

export default AppNavigator;
