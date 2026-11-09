import { NativeModules } from 'react-native';

interface DeviceConstants {
  manufacturer: string;
  model: string;
  /** The PetraPay server this build pairs with by default. */
  apiBaseUrl: string;
  isDebug: boolean;
}

const native = NativeModules.PetraDevice as Partial<DeviceConstants> | undefined;

/** Facts about this terminal, provided by the PetraDevice Kotlin module. */
export const device: DeviceConstants = {
  manufacturer: native?.manufacturer ?? 'Android',
  model: native?.model ?? 'POS',
  apiBaseUrl: native?.apiBaseUrl ?? 'https://petra-pay-zcash.vercel.app/api',
  isDebug: native?.isDebug ?? __DEV__,
};

export const deviceName = `${device.manufacturer} ${device.model}`.trim();
