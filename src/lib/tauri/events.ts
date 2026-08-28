import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface ExternalChangeEvent {
  relative_path: string;
  is_file: boolean;
}

export async function onExternalFileChanged(
  handler: (event: ExternalChangeEvent) => void
): Promise<UnlistenFn> {
  return await listen<ExternalChangeEvent>("external_file_changed", (e) => {
    handler(e.payload);
  });
}
