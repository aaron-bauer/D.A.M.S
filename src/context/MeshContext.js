/**
 * MeshContext.js
 * ==============
 * Global state for the app using React Context + useReducer.
 * All screens share: role, device info, network status, survivor list, messages.
 */
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as NetworkService from '../services/NetworkService';

// ─── Initial State ────────────────────────────────────────────────────────────
const initialState = {
    role: null,          // 'survivor' | 'rescue' | null
    deviceInfo: { id: null, name: 'Unknown', lat: null, lon: null },
    networkStatus: { status: 'idle', peerCount: 0, serverIP: null },
    survivors: [],            // [{ id, name, lat, lon, timestamp, isSOS }]
    messages: [],            // [{ id, sender, text, timestamp, isSelf }]
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
const reducer = (state, action) => {
    switch (action.type) {
        case 'SET_ROLE':
            return { ...state, role: action.payload };
        case 'SET_DEVICE_INFO':
            return { ...state, deviceInfo: { ...state.deviceInfo, ...action.payload } };
        case 'UPDATE_LOCATION':
            return { ...state, deviceInfo: { ...state.deviceInfo, lat: action.payload.lat, lon: action.payload.lon } };
        case 'SET_NETWORK_STATUS':
            return { ...state, networkStatus: { ...state.networkStatus, ...action.payload } };
        case 'UPSERT_SURVIVOR': {
            const idx = state.survivors.findIndex(s => s.id === action.payload.id);
            if (idx !== -1) {
                const list = [...state.survivors];
                list[idx] = { ...list[idx], ...action.payload };
                return { ...state, survivors: list };
            }
            return { ...state, survivors: [...state.survivors, action.payload] };
        }
        case 'ADD_MESSAGE':
            // Prevent duplicate IDs (common in P2P broadcast cycles)
            if (state.messages.some(m => m.id === action.payload.id)) {
                return state;
            }
            const newMessages = [...state.messages, action.payload];
            return {
                ...state,
                messages: newMessages.slice(-100) // Keep last 100 messages
            };
        case 'RESET':
            return { ...initialState };
        default:
            return state;
    }
};

// ─── Contexts ─────────────────────────────────────────────────────────────────
const MeshContext = createContext(null);
const DispatchCtx = createContext(null);

/** Wrap the app in this to provide mesh state to all screens. */
export const MeshProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        // Wire up NetworkService events → global state updates
        const onStatus = (d) => dispatch({ type: 'SET_NETWORK_STATUS', payload: d });
        const onSurvivor = (d) => dispatch({ type: 'UPSERT_SURVIVOR', payload: d });
        const onMessage = (d) => dispatch({ type: 'ADD_MESSAGE', payload: d });
        const onSOS = (d) => dispatch({
            type: 'ADD_MESSAGE', payload: {
                id: `sos_${d.id}`, sender: d.name,
                text: '🆘 SOS ALERT! Please send help immediately!',
                timestamp: d.timestamp, isSOS: true,
            }
        });

        NetworkService.on('status_change', onStatus);
        NetworkService.on('survivor_update', onSurvivor);
        NetworkService.on('message_received', onMessage);
        NetworkService.on('sos_received', onSOS);

        return () => {
            NetworkService.off('status_change', onStatus);
            NetworkService.off('survivor_update', onSurvivor);
            NetworkService.off('message_received', onMessage);
            NetworkService.off('sos_received', onSOS);
        };
    }, []);

    return (
        <DispatchCtx.Provider value={dispatch}>
            <MeshContext.Provider value={state}>
                {children}
            </MeshContext.Provider>
        </DispatchCtx.Provider>
    );
};

/** Hook: read global mesh state. */
export const useMesh = () => useContext(MeshContext);
/** Hook: dispatch actions to update global state. */
export const useDispatch = () => useContext(DispatchCtx);
