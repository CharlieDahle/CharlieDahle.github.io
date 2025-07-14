// Hot State - Updates frequently (60fps during playback)
export { useTransportStore } from "./useTransportStore";

// Warm State - Updates on user actions, handles coordination
export { useDrumDataStore } from "./useDrumDataStore";

// Cold State - Updates rarely (user preferences, UI state)
export { useUIStore } from "./useUIStore";

// Audio System - Manages scheduler and audio concerns
export { useSchedulerStore } from "./useSchedulerStore";
