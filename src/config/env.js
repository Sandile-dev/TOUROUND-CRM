import { Platform } from 'react-native';

// Android Emulator: 10.0.2.2 maps to host localhost
// iOS Simulator: localhost works directly
// Physical device / production: use hosted URL
const LOCAL_API = Platform.select({
  android: 'http://10.0.2.2:8081/api',
  ios: 'http://localhost:8081/api',
  default: 'http://localhost:8081/api',
});

const PRODUCTION_API = 'https://touround-qa-fbee698b7067.herokuapp.com/api';

const ENV = {
  development: {
    apiBaseUrl: LOCAL_API,
  },
  production: {
    apiBaseUrl: PRODUCTION_API,
  },
};

function getEnv() {
  // Allow the API URL to be overridden at build time via an EAS build profile
  // env var (EXPO_PUBLIC_* vars are inlined into the bundle by Expo). This lets
  // preview/production builds target different backends without code changes.
  const override = process.env.EXPO_PUBLIC_API_BASE_URL;

  // In production builds, __DEV__ is false
  const base = (typeof __DEV__ !== 'undefined' && !__DEV__) ? ENV.production : ENV.development;

  return override ? { ...base, apiBaseUrl: override } : base;
}

export default getEnv();
