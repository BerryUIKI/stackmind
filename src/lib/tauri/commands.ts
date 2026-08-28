import { invoke } from "@tauri-apps/api/core";

export interface PingResponse {
  message: string;
  timestamp: number;
}

export async function pingBackend(): Promise<PingResponse> {
  return await invoke<PingResponse>("ping");
}
