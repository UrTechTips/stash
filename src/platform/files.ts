import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/** Writes text to a temporary file and opens the share sheet (save to Drive, send to yourself, etc.). */
export async function shareTextFile(fileName: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Sharing is not available', 'This device cannot open the share sheet.');
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}

/** Lets the user pick a file and returns its text, or null if they cancelled. */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  return new File(result.assets[0].uri).text();
}

/** Saves text into the app's private documents folder (used for the automatic backup before a migration). */
export function writePrivateFile(folder: string, fileName: string, content: string): void {
  const file = new File(Paths.document, folder, fileName);
  file.create({ intermediates: true, overwrite: true });
  file.write(content);
}
