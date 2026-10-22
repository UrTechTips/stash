    import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

    type HapticFeedbackType = 
    | 'selection'
    | 'light'
    | 'medium'
    | 'heavy'
    | 'rigid'
    | 'soft'
    | 'success'
    | 'warning'
    | 'error';

    export const useHaptics = () => {
    return useCallback(
        <T extends (...args: any[]) => any>(callback: T, type: HapticFeedbackType = 'light') => {
        return (...args: Parameters<T>) => {
            switch (type) {
            case 'selection':
                Haptics.selectionAsync();
                break;
            case 'light':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
            case 'medium':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
            case 'heavy':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                break;
            case 'rigid':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
                break;
            case 'soft':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                break;
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
            case 'warning':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                break;
            case 'error':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                break;
            }

            return callback(...args);
        };
        },
        []
    );
    };