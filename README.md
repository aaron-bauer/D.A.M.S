# Disaster Aid Management System (D.A.M.S.)

## Infrastructure-Independent P2P Mesh Communication for Disaster Scenarios

**D.A.M.S.** is a specialized mobile application designed to facilitate real-time communication and location tracking in environments where traditional telecommunications infrastructure (cellular, internet) has failed. By leveraging contemporary peer-to-peer (P2P) networking protocols, the system enables survivors to broadcast their GPS coordinates and emergency messages directly to rescue teams over a local Wi-Fi mesh.

---

## Technical Overview

The system operates on an ad-hoc local area network (LAN) model, utilizing a **Star-Mesh Architecture**:

- **Rescue Hub**: A central node (Rescue Team device) that establishes a mobile hotspot, acting as the gateway for the local mesh.
- **Survivor Nodes**: Edge devices that connect to the hotspot and utilize **UDP Beaconing** and **TCP Socket Scanning** to automatically discover and authenticate with the Rescue Hub.
- **Protocol**: Data is encapsulated in JSON packets and transmitted over persistent TCP/IP sockets on port `8080`.

### Data Flow
1. **Discovery**: Survivors listen for an encrypted UDP beacon from the Rescue Hub or perform a subnet scan (`192.168.x.1-254`).
2. **Persistence**: Once a handshake is established, the Survivor node enters a low-energy broadcast cycle, transmitting GPS data every 15 seconds.
3. **Visualization**: The Rescue Hub parses incoming telemetry and dynamically renders markers on an offline-capable GIS interface.

---

## Key Features

- **📡 Zero-Infrastructure Networking**: Operates entirely without cellular towers or internet backhaul.
- **📍 Real-Time Telemetry**: Precision GPS tracking using `expo-location` with high-accuracy background polling.
- **💬 Direct Messaging**: Full-duplex emergency text communication between survivors and rescue coordinators.
- **🆘 SOS Priority**: One-tap emergency broadcast that elevates the survivor's status on the rescue map.
- **💾 Local Persistence**: All critical data is cached locally via `AsyncStorage` to prevent data loss during signal drops.

---

## Android Deployment (APK)

For field operations, D.A.M.S. must be deployed as a native Android Package (APK). This ensures access to low-level networking APIs (TCP/UDP) and high-precision location services.

### Building the APK

1. **Prebuild Native Modules**:
   Generate the `android` project directory from the Expo source:
   ```bash
   npx expo prebuild
   ```

2. **Compile Release APK**:
   Build the signed or unsigned APK using the Gradle wrapper:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   *Note: The generated APK will be located in `android/app/build/outputs/apk/release/app-release.apk`.*

3. **Installation**:
   Transfer the `.apk` file to target devices via USB or Bluetooth and allow "Install from Unknown Sources" in Android settings.

---

## Setup & Development

### Prerequisites

| Component | Requirement |
|-----------|-------------|
| **Node.js** | ≥ 18.0.0 |
| **OpenJDK** | 17 (Required for Android builds) |
| **Android SDK** | API Level 33+ |
| **Physical Devices** | Minimum 2 Android devices for P2P testing |

### Local Environment Setup

```bash
# Clone the repository
git clone https://github.com/aaron-bauer/D.A.M.S.git
cd "damc 2"

# Install dependencies
npm install

# Build and Run on Android Device (via ADB)
npx expo run:android
```

---

## Field Testing Protocol

1. **Initiate Hub**: On Device A, activate "Mobile Hotspot". Launch D.A.M.S. and select **Rescue Team**.
2. **Connect Nodes**: On Device B, connect to Device A's hotspot. Launch D.A.M.S. and select **Survivor**.
3. **Validation**: Observe the "Connected" status. Device B's location should appear as a marker on Device A's map within 10–15 seconds.

---

## Project Structure

```
damc 2/
├── android/                        # Native Android project (generated)
├── app.json                        # System permissions & configuration
└── src/
    ├── services/
    │   ├── NetworkService.js       # Core TCP/UDP P2P implementation
    │   ├── LocationService.js      # GPS telemetry management
    │   └── StorageService.js       # Offline data persistence
    ├── screens/
    │   ├── RoleScreen.js           # User role arbitration
    │   ├── MapScreen.js            # GIS visualization for Rescue
    │   └── MessagingScreen.js      # Multi-node text communication
    └── context/
        └── MeshContext.js          # Centralized reactive state
```

---

## Academic References

1. **Meshmerize (2023)** – *Emergency Network Deployment: Mesh Networks Lifesaving Power in Disaster Management.*
2. **goTenna (2022)** – *Mobile Mesh Networks: Ensuring Resilient Communication in Critical Infrastructure Failure.*
3. **IEEE P1920.1** – *Standard for Aerial Communications and Networking.*

---

© 2026 Disaster Aid Management System Project. Developed for academic submission.
