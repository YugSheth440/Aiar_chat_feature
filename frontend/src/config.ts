import { NativeModules } from 'react-native';
import Constants from 'expo-constants';

// Dynamically extract the host IP address from multiple sources in development
const getDevHost = (): string => {
  // 1. Try NativeModules.SourceCode.scriptURL
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^[a-z]+:\/\/([^\/:]+)/i);
    if (match && match[1]) {
      const host = match[1];
      if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('172.')) {
        return host;
      }
    }
  } catch (e) {
    console.warn('[Config] Failed to parse scriptURL dynamically:', e);
  }

  // 2. Try Constants.expoConfig.hostUri
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch (e) {
    console.warn('[Config] Failed to parse hostUri dynamically:', e);
  }

  // 3. Try Constants.linkingUri
  try {
    const linkingUri = Constants.linkingUri || '';
    const match = linkingUri.match(/^[a-z]+:\/\/([^\/:]+)/i);
    if (match && match[1]) {
      const host = match[1];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  } catch (e) {
    console.warn('[Config] Failed to parse linkingUri dynamically:', e);
  }

  return '';
};

const devHost = getDevHost();

// Dynamic resolution: prefer dynamic Metro host if found, then env variable, then default fallback.
export const BACKEND_HOST = devHost || process.env.EXPO_PUBLIC_BACKEND_IP || '10.180.201.129';
export const BACKEND_PORT = process.env.EXPO_PUBLIC_BACKEND_PORT || '8000';

export const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
export const BACKEND_WS_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`;

console.log('[Config] Dynamic Metro Host:', devHost || 'None detected');
console.log('[Config] Env Backend IP:', process.env.EXPO_PUBLIC_BACKEND_IP || 'Not configured');
console.log('[Config] Final BACKEND_HOST resolved to:', BACKEND_HOST);
console.log('[Config] BACKEND_URL:', BACKEND_URL);
console.log('[Config] BACKEND_WS_URL:', BACKEND_WS_URL);
