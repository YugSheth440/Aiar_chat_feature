import { NativeModules } from 'react-native';

// Dynamically extract the host IP address from the Metro bundler script URL in development
const getDevHost = (): string => {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL || '';
    // Match any protocol (http, https, exp, etc.) followed by :// and capture the host IP/domain
    const match = scriptURL.match(/^[a-z]+:\/\/([^\/:]+)/i);
    if (match && match[1]) {
      const host = match[1];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch (e) {
    console.warn('[Config] Failed to parse scriptURL dynamically:', e);
  }
  return '';
};

const devHost = getDevHost();

export const BACKEND_HOST = '10.64.215.129'; // devHost || process.env.EXPO_PUBLIC_BACKEND_IP || '10.64.215.129';
export const BACKEND_PORT = process.env.EXPO_PUBLIC_BACKEND_PORT || '8000';

export const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
export const BACKEND_WS_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`;
