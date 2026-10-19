import * as LocalAuthentication from 'expo-local-authentication';

export async function lockAvailable(): Promise<boolean> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level !== LocalAuthentication.SecurityLevel.NONE;
}

export async function unlock(promptMessage = 'Unlock Stash'): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage });
    return result.success;
  } catch {
    return false;
  }
}
