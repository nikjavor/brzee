import { createContext, useContext, PropsWithChildren } from "react";
import { DriveRuntime } from "./DriveRuntime";
const RuntimeContext = createContext<DriveRuntime | null>(null);
export function RuntimeProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: DriveRuntime }>) {
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}
export function useDriveRuntime(): DriveRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("BRZEE runtime provider missing");
  return runtime;
}
