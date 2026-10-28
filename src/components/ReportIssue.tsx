import { useHaptics } from '@/hooks/useHaptics';
import { radius, spacing } from '@/theme/layout';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ISODate } from '../engine/dates';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, typography } from '../theme/typography';

export type ReportIssueResult = {
    title: string;
    description: string;
    author: string;
    meta: Record<string, string>;
}

export function ReportIssueSheet({
  visible,
  today,
  onClose,
  onSave,
}: {
  visible: boolean;
  today: ISODate;
  onClose: () => void;
  onSave: (result: ReportIssueResult) => void;
}) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
        >
        <KeyboardAvoidingView behavior="padding" style={styles.fill}>
            <Pressable
            style={[styles.scrim, { backgroundColor: colors.isDark ? '#000000AA' : '#10261F66' }]}
            onPress={onClose}
            accessibilityLabel="Close"
            />
            <View
            style={[
                styles.sheet,
                { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 12) + 4 },
            ]}
            >
            <View style={[styles.handle, { backgroundColor: colors.outline }]} />
            <ReportIssueForm
                today={today}
                onSave={onSave}
            />
            </View>
        </KeyboardAvoidingView>
        </Modal>
    );
}

function ReportIssueForm({ today, onSave }: { today: ISODate; onSave: (result: ReportIssueResult) => void}) {
    const { colors } = useTheme();
    const haptics = useHaptics();
    const [title, setTitle] = useState('[BUG] ');
    const [description, setDescription] = useState('');
    const canSave = title.trim().length > 0 && description.trim().length > 0;    

    const handleSave = () => {
        const deviceInfo = Device.manufacturer + " " + Device.modelName;
        const appVersion = "v" + Application.nativeApplicationVersion + " (" + Application.nativeBuildVersion + ")";
        const osVersion = Device.osName + " " + Device.osVersion;

        const meta = {
            device: deviceInfo,
            appVersion: appVersion,
            osVersion: osVersion,
        }
        onSave({
            title: title,
            description: description,
            author: "User",
            meta: meta
        });
    }
    return (
        <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
        >
            <FieldLabel text="Title" />
            <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Add a note"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                style={[
                    styles.title,
                    { color: colors.textPrimary, borderColor: colors.outline, fontFamily: fonts.body },
                ]}
            />
            <FieldLabel text="Description" />
            <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add a description"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
                multiline
                style={[
                    styles.title,
                    { color: colors.textPrimary, borderColor: colors.outline, fontFamily: fonts.body, height: 100 },
                ]}
            />
            <Pressable
                onPress={handleSave}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                style={[
                    styles.saveButton,
                    { backgroundColor: canSave ? colors.primary : colors.surfaceRaised },
                ]}
                >
                <Text
                    style={[typography.label, { color: canSave ? colors.onPrimary : colors.textDisabled }]}
                >
                    Report Issue
                </Text>
            </Pressable>
        </ScrollView>
    );
}

function FieldLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[typography.label, { color: colors.textSecondary }]}>{text}</Text>;
}

const styles = StyleSheet.create({
    fill: { flex: 1, justifyContent: 'flex-end' },
    handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
    scrim: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const) },
    sheet: {
        maxHeight: '92%',
        borderTopLeftRadius: radius.sheet,
        borderTopRightRadius: radius.sheet,
        paddingTop: 8,
    },
    form: { paddingHorizontal: spacing.screen, paddingBottom: 8, gap: 12 },
    title: {
        height: 52,
        borderWidth: 1,
        borderRadius: radius.key,
        paddingHorizontal: 16,
        fontSize: 14,
    },
    saveButton: {
        marginTop: 16,
        height: 56,
        borderRadius: radius.key,
        alignItems: 'center',
        justifyContent: 'center',
    },
})