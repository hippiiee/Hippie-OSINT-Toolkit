import manifest from "./socket-events.json";

export const SOCKET_EVENTS = manifest;
export const NAMESPACES = manifest.namespaces;
export const SERVER_EVENTS = manifest.serverEvents;

export type NamespaceKey = keyof typeof manifest.namespaces;
