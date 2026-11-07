export interface DiscoveredDevice {
  id: string;
  name: string;
  rssi: number | null;
}
export interface BleTransport {
  scan(signal: AbortSignal): Promise<DiscoveredDevice[]>;
  connect(
    id: string,
    onBytes: (bytes: Uint8Array) => void,
    onDisconnect: (error?: Error) => void,
    signal: AbortSignal,
  ): Promise<void>;
  disconnect(): Promise<void>;
}
