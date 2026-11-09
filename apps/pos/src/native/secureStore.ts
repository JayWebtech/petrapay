import { NativeModules } from 'react-native';

interface SecureStoreModule {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
}

const native = NativeModules.PetraSecureStore as SecureStoreModule | undefined;

/**
 * Keystore-encrypted storage (PetraSecureStore Kotlin module) for this
 * terminal's token. Without the native module (e.g. an old build) nothing is persisted
 * and the app falls back to signing in each time.
 */
export const secureStore = {
  get: (name: string): Promise<string | null> => (native ? native.get(name).catch(() => null) : Promise.resolve(null)),
  set: (name: string, value: string): Promise<void> => (native ? native.set(name, value).catch(() => undefined) : Promise.resolve()),
  remove: (name: string): Promise<void> => (native ? native.remove(name).catch(() => undefined) : Promise.resolve()),
};
