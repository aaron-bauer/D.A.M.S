# Disaster Aid Management System (D.A.M.S.)

A cross-platform mobile app that enables survivors and rescue teams to communicate location data **without any internet connection**, using a local peer-to-peer WiFi mesh network.

---

## How It Works

```
Rescue Team phone (hotspot) ←—TCP/LAN—→ Survivor phones
     ↳ TCP server on port 4747       ↳ Scan subnet, connect, push GPS
     ↳ Plots all survivor locations on map
```

1. **Rescue Team** enables a mobile hotspot on their phone, opens the app → selects **Rescue Team** → taps **Start Network**.
2. **Survivors** connect to that hotspot (no internet!), open the app → select **Survivor** → tap **Start Network**.
3. The survivor's app automatically finds the rescue server and starts broadcasting GPS every 15 seconds.
4. Rescue team's map populates with survivor pins in real-time.
5. Both sides can send emergency text messages over the same connection.

> **Demo/Simulation Mode** (default): enabled with `SIMULATION_MODE = true` in `NetworkService.js`. Runs with fake survivors and messages — no second device or build step needed. Perfect for school demos.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | included with Node |
| Expo CLI | latest | `npm i -g expo-cli` |
| Expo Go app | latest | App Store / Google Play |

---

## Setup & Installation

```bash
# 1. Open terminal in the project folder
cd "damc 2"

# 2. Install all dependencies
npm install

# 3. Start the Expo development server
npx expo start
```

A QR code appears in the terminal. Scan it with the **Expo Go** app on your phone.

---

## Running in Demo Mode (Expo Go — no build needed)

`SIMULATION_MODE` is `true` by default in `src/services/NetworkService.js`.

1. Open app → enter name → choose role → tap **Start Network**
2. **Rescue Team**: After ~3 s, 3 mock survivors appear on the map. Mock emergency messages arrive.
3. **Survivor**: After ~3 s, status changes to "Connected". An ACK message arrives.

This works immediately in Expo Go — **no build step, no second device needed**.

---

## Running on Real Devices (Two-phone P2P test)

> Requires a native build. TCP sockets are native code.

```bash
# Generate native Android/iOS project folders
npx expo prebuild

# Build and run on connected Android device
npx expo run:android

# Build and run on connected iOS device (Mac only)
npx expo run:ios
```

Then change line in `NetworkService.js`:
```js
export const SIMULATION_MODE = false;   // ← change from true to false
```

**Test steps:**
1. Device A (Rescue Team): Enable mobile hotspot → open app → select Rescue → Start Network
2. Device B (Survivor): Connect WiFi to Device A's hotspot → open app → select Survivor → Start Network
3. After ~10 s, Device B's location appears as a marker on Device A's map ✅

---

## Project Structure

```
damc 2/
├── App.js                          # Root entry point
├── app.json                        # Expo config (permissions, name)
├── package.json                    # Dependencies
├── babel.config.js                 # Babel config
└── src/
    ├── context/
    │   └── MeshContext.js          # Global state (role, survivors, messages)
    ├── services/
    │   ├── StorageService.js       # AsyncStorage (save GPS, messages locally)
    │   ├── LocationService.js      # GPS tracking via expo-location
    │   └── NetworkService.js       # P2P TCP server/client + simulation
    ├── navigation/
    │   └── AppNavigator.js         # React Navigation (tabs + stack)
    ├── screens/
    │   ├── RoleScreen.js           # Role picker (Survivor / Rescue)
    │   ├── HomeScreen.js           # Status dashboard + SOS
    │   ├── MapScreen.js            # Live map with survivor markers
    │   └── MessagingScreen.js      # Emergency text messaging
    └── components/
        ├── ConnectionStatus.js     # Animated pulsing status indicator
        └── MessageBubble.js        # Chat bubble component
```

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-location` | GPS coordinates (works without internet) |
| `@react-native-async-storage/async-storage` | Offline-persistent local storage |
| `react-native-maps` | Map display with survivor markers |
| `react-native-tcp-socket` | TCP server/client for P2P LAN comms |
| `expo-network` | Get device IP for LAN scanning |
| `@react-navigation/native` | Screen navigation |

---

## Mesh Networking Explained (For Report)

Traditional apps rely on the internet (cell towers → cloud servers → other devices). In a disaster, cell towers fail.

This app uses a **local area network (LAN) mesh**:
- No packets leave the local WiFi network
- One device acts as a **relay server** (rescue team's hotspot)
- All other devices connect directly to it over TCP/IP
- GPS packets are JSON strings: `{ type, id, name, lat, lon, timestamp }`

This mimics principles described by **Meshmerize (2023)** and **goTenna** where devices form decentralised peer networks without infrastructure.

---

## Sources

1. Meshmerize (2023) – *Emergency Network Deployment: Mesh Networks Lifesaving Power in Disaster Management* https://meshmerize.net/emergency-network-deployment-mesh-in-disaster-management/
2. goTenna Newsroom – *Mobile Mesh Networks Can Ensure Communication in Disaster* https://gotenna.com/blogs/newsroom/mobile-mesh-networks-can-ensure-communication-in-disaster
