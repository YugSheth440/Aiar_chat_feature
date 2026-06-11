// Configuration for the FastAPI backend connection.
// If testing on a physical device, change 'localhost' to your computer's local network IP address (e.g. '192.168.1.100')
export const BACKEND_HOST = '10.158.255.176';
export const BACKEND_PORT = '8000';

export const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
export const BACKEND_WS_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`;
