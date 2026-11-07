import { BleManager, Device, Subscription, State } from "react-native-ble-plx";
import { Platform } from "react-native";
import { BleTransport, DiscoveredDevice } from "./types";
import { requestBlePermissions } from "./permissions";
export const SERVICE = "f023e430-7ac9-4f6d-a40a-5a43b9181a01";
export const TELEMETRY = "f023e430-7ac9-4f6d-a40a-5a43b9181a02";

export class NativeBleTransport implements BleTransport {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private subscriptions: Subscription[] = [];
  private get radio() {
    return (this.manager ??= new BleManager());
  }
  async scan(signal: AbortSignal): Promise<DiscoveredDevice[]> {
    await requestBlePermissions();
    const state = await this.radio.state();
    if (signal.aborted) return [];
    if (state !== State.PoweredOn)
      throw new Error(
        state === State.Unauthorized
          ? "Bluetooth permission denied. Open system Settings."
          : state === State.PoweredOff
            ? "Bluetooth is off. Turn it on, then retry."
            : "Bluetooth is unavailable or starting. Try again.",
      );
    return new Promise((resolve, reject) => {
      const found = new Map<string, DiscoveredDevice>();
      let settle: ReturnType<typeof setTimeout> | null = null;
      const stop = () => {
        this.radio.stopDeviceScan();
        clearTimeout(timeout);
        if (settle) clearTimeout(settle);
        signal.removeEventListener("abort", abort);
      };
      const finish = () => {
        stop();
        resolve([...found.values()]);
      };
      const abort = () => {
        stop();
        resolve([]);
      };
      const timeout = setTimeout(finish, 8000);
      signal.addEventListener("abort", abort, { once: true });
      this.radio.startDeviceScan(
        [SERVICE],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            stop();
            reject(new Error(error.message));
            return;
          }
          if (!device) return;
          found.set(device.id, {
            id: device.id,
            name: device.localName ?? device.name ?? "BRZEE",
            rssi: device.rssi,
          });
          if (!settle) settle = setTimeout(finish, 2000);
        },
      );
    });
  }
  async connect(
    id: string,
    onBytes: (bytes: Uint8Array) => void,
    onDisconnect: (error?: Error) => void,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;
    const cancel = () => {
      void this.radio.cancelDeviceConnection(id).catch(() => {});
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      let device = await this.radio.connectToDevice(id, { timeout: 10000 });
      if (signal.aborted) {
        await device.cancelConnection();
        return;
      }
      this.device = device;
      device = await device.discoverAllServicesAndCharacteristics();
      if (Platform.OS === "android") {
        try {
          device = await device.requestMTU(247);
        } catch {
          /* Fragmentation supports the negotiated MTU. */
        }
      }
      if (signal.aborted) return;
      const characteristics = await device.characteristicsForService(SERVICE);
      const characteristic = characteristics.find(
        (c) => c.uuid.toLowerCase() === TELEMETRY,
      );
      if (!characteristic?.isNotifiable)
        throw new Error("BRZEE telemetry notify characteristic is unavailable.");
      this.subscriptions.push(
        this.radio.onDeviceDisconnected(id, (error) => {
          signal.removeEventListener("abort", cancel);
          if (!signal.aborted)
            onDisconnect(error ? new Error(error.message) : undefined);
        }),
      );
      this.subscriptions.push(
        device.monitorCharacteristicForService(
          SERVICE,
          TELEMETRY,
          (error, value) => {
            if (signal.aborted) return;
            if (error) {
              onDisconnect(new Error(error.message));
              return;
            }
            if (value?.value) {
              const binary = atob(value.value);
              onBytes(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
            }
          },
        ),
      );
    } catch (error) {
      signal.removeEventListener("abort", cancel);
      if (!signal.aborted) {
        await this.disconnect();
        throw error;
      }
    }
  }
  async disconnect(): Promise<void> {
    this.manager?.stopDeviceScan();
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
    const device = this.device;
    this.device = null;
    if (device) {
      try {
        await device.cancelConnection();
      } catch {
        /* Already disconnected. */
      }
    }
  }
}
