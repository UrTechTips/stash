import * as LocalAuthentication from 'expo-local-authentication';

/** True when the phone has a fingerprint, face, PIN, pattern or password set up. */
export async function lockAvailable(): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

/** Shows the system unlock prompt. The phone's own PIN/pattern is accepted as a fallback. */
export async function unlock(promptMessage = 'Unlock Stash'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage });
    return result.success;
  } catch {
    return false;
  }
}
