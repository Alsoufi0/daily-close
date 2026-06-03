import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

// Remember the Android folder the user picked so we don't re-prompt on every
// download within a session. Cleared if a write fails (permission revoked).
let androidDir: string | null = null;

export type SaveResult = "saved" | "shared" | "cancelled";

/**
 * Persist an already-downloaded file (sitting at `localUri` in the app cache)
 * to the device as a real download — not just a share sheet.
 *
 * - Android: writes the file into a user-chosen folder (Downloads, etc.) via the
 *   Storage Access Framework. The folder is remembered for the session.
 * - iOS: there is no user-accessible Downloads folder, so the share sheet (which
 *   includes "Save to Files") is the platform-sanctioned way to save. Falls back
 *   to the share sheet on Android too if SAF is unavailable or cancelled.
 */
export async function saveDownloadedFile(
  localUri: string,
  fileName: string,
  mimeType: string
): Promise<SaveResult> {
  if (Platform.OS === "android") {
    try {
      if (!androidDir) {
        const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!perm.granted) return shareFallback(localUri, mimeType);
        androidDir = perm.directoryUri;
      }
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64
      });
      const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
        androidDir,
        fileName,
        mimeType
      );
      await FileSystem.writeAsStringAsync(destUri, base64, {
        encoding: FileSystem.EncodingType.Base64
      });
      return "saved";
    } catch {
      // The remembered folder may have been revoked — reset and fall back so the
      // user still gets their file.
      androidDir = null;
      return shareFallback(localUri, mimeType);
    }
  }

  return shareFallback(localUri, mimeType);
}

async function shareFallback(localUri: string, mimeType: string): Promise<SaveResult> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(localUri, { mimeType });
    return "shared";
  }
  return "cancelled";
}
