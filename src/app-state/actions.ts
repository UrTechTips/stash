import { useCallback } from 'react';
import { Alert } from 'react-native';
import { ValidationError } from '../db/Db';

/**
 * Runs a write and turns problems into a friendly alert instead of a crash.
 * Returns the result, or undefined if it failed. Validation messages are shown as they are.
 */
export function useAction() {
  return useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ValidationError) {
        Alert.alert('Check this', e.message);
      } else {
        Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
      }
      return undefined;
    }
  }, []);
}

/** Asks "are you sure?" and resolves to the answer. */
export function confirm(title: string, message: string, confirmLabel = 'Delete', destructive = true): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
