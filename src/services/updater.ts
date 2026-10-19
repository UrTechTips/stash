import * as Application from 'expo-application';

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
  apkAssetName: string;
  sha256: string;
  releaseUrl: string;
  releaseNotes: string;
};

export type AppUpdate = UpdateManifest & {
  apkUrl: string;
};

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

    if (manifest.schemaVersion !== 1 || !Number.isSafeInteger(manifest.versionCode) || typeof manifest.apkAssetName !== "string" || typeof manifest.sha256 !== "string") {
        throw new Error('Invalid update manifest format.');
    }

    if (manifest.packageName !== Application.applicationId) {
        throw new Error(`Update manifest package name (${manifest.packageName}) does not match the current application package name (${Application.applicationId}).`);
    }

    const apkAsset = release.assets.find(asset => asset.name === manifest.apkAssetName);
    if (!apkAsset) {
        throw new Error(`APK asset (${manifest.apkAssetName}) not found in the latest release assets.`);
    }

    const installedCode = Number(Application.nativeApplicationVersion ?? 0);
    if (installedCode >= manifest.versionCode) {
        return null;
    }

    return {
        ...manifest,
        apkUrl: apkAsset.browser_download_url,
    };
}