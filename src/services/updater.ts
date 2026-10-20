import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from 'react-native';

const OWNER = 'urtechtips';
const REPO = 'stash';

type GitHubAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  assets: GitHubAsset[];
};

type UpdateManifest = {
  schemaVersion: number;
  version: string;
  versionCode: number;
  packageName: string;
  releaseTag: string;
  apkAssets?: Record<string, string>;
  sha256s?: Record<string, string>;
  apkAssetName: string;
  sha256: string;
  releaseUrl: string;
  releaseNotes: string;
};

export type AppUpdate = {
  version: string;
  versionCode: number;
  apkUrl: string;
  sha256: string;
};

const resolveApkTarget = (manifest: UpdateManifest): { assetName: string; sha256: string } => {
    if (manifest.apkAssets && manifest.sha256s) {
        const supportedAbis = Device.supportedCpuArchitectures || [];

        for (const abi of supportedAbis) {
            if (manifest.apkAssets[abi] && manifest.sha256s[abi]) {
                return {
                    assetName: manifest.apkAssets[abi],
                    sha256: manifest.sha256s[abi],
                }
            }
        }

        if (manifest.apkAssets['universal'] && manifest.sha256s['universal']) {
            return {
                assetName: manifest.apkAssets['universal'],
                sha256: manifest.sha256s['universal'],
            }
        }
    }

    if (manifest.apkAssetName && manifest.sha256) {
        return {
            assetName: manifest.apkAssetName,
            sha256: manifest.sha256,
        };
    }
    throw new Error('No suitable APK asset found for the current device architecture.');
}

export const checkForUpdate = async (): Promise<AppUpdate | null> => {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch latest release: ${response.status} ${response.statusText}`);
    }

    const release: GitHubRelease = await response.json();
    const manifestAsset = release.assets.find(asset => asset.name === 'update.json');

    if (!manifestAsset) {
        throw new Error('Update manifest not found in the latest release assets.');
    }

    const manifestRes = await fetch(manifestAsset.browser_download_url);
    if (!manifestRes.ok) {
        throw new Error(`Failed to fetch update manifest: ${manifestRes.status} ${manifestRes.statusText}`);
    }

    const manifest: UpdateManifest = await manifestRes.json();

    if (manifest.schemaVersion !== 1 || !Number.isSafeInteger(manifest.versionCode)) {
        throw new Error('Invalid update manifest format.');
    }

    if (manifest.packageName !== Application.applicationId) {
        throw new Error(`Update manifest package name (${manifest.packageName}) does not match the current application package name (${Application.applicationId}).`);
    }

    const installedCode = Number(Application.nativeBuildVersion);

    if (!Number.isSafeInteger(installedCode) || installedCode < 1) {
        throw new Error(
            `Invalid installed build version: ${Application.nativeBuildVersion}`
        );
    }
    if (installedCode >= manifest.versionCode) {
        return null;
    }

    const target = resolveApkTarget(manifest);
    const apkAsset = release.assets.find(asset => asset.name === target.assetName);

    if (!apkAsset) {
        throw new Error(`Target apk asset (${target.assetName}) not found in the latest release assets.`);
    }

    return {
        version: manifest.version,
        versionCode: manifest.versionCode,
        apkUrl: apkAsset.browser_download_url,
        sha256: target.sha256,
    };
}

const sha256Hex = async (file: FileSystem.File): Promise<string> => {
    const bytes = await file.bytes();
    const hashBuffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
    return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
};

export const downloadAndInstallUpdate = async (update: AppUpdate): Promise<void> => {
    if (Platform.OS !== 'android') {
        throw new Error('Update installation is only supported on Android.');
    }

    const destination = new FileSystem.File(FileSystem.Paths.cache, `stash-update-${update.versionCode}.apk`);
    if (destination.exists) {
        destination.delete();
    }

    let downloadedFile: FileSystem.File;
    try {
        const downloadResult = await LegacyFileSystem.downloadAsync(
            update.apkUrl, 
            destination.uri
        );
        console.log(`Download result: ${JSON.stringify(downloadResult)}`);

        if (downloadResult.status !== 200) {
            console.log(`Download failed with HTTP status ${downloadResult.status}`);
            throw new Error(`Download failed with HTTP status ${downloadResult.status}`);
        }

        downloadedFile = destination;
        const actualHash = await sha256Hex(downloadedFile);
        
        if (actualHash !== update.sha256) {
            console.log(`Hash mismatch: expected ${update.sha256}, got ${actualHash}`);
            downloadedFile.delete();
            throw new Error('Downloaded APK hash does not match the expected hash.');
        }
    } catch (error) {
        console.error(`Error during download or hash verification: ${error}`);
        if (destination.exists) {
            destination.delete();
        }
        throw error;
    }
    console.log(`Downloaded APK verified successfully: ${downloadedFile.uri}`);
    const contentUri = await LegacyFileSystem.getContentUriAsync(destination.uri);
    console.log('Installing from', contentUri);

    try {
        const result = await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            type: 'application/vnd.android.package-archive',
            flags: 1 | 268435456, // GRANT_READ_URI_PERMISSION | NEW_TASK
        });
        console.log('Installer result', result);
    } catch (e) {
        console.error('Installer launch failed', e);
        throw e;
    }
}