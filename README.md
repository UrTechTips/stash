# Stash

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Android](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white)](#)

Stash is a privacy-first personal money manager for Android. It answers two practical questions: *how much can I safely spend today?* and *is this purchase safe right now?*

Your financial data is stored locally on your device in an SQLite database rather than in a hosted service. 

## ⚠️ Important Update Notice (Version 1.1.2 & Newer)

> **Note on App Signing & Data Safety:**
> Due to a security key rotation, all releases **starting from v1.1.2** are signed with a new cryptographic keystore. 
> 
> Direct in-place updates from **v1.1.1 or earlier** will fail with an `App Not Installed` or `Signature Mismatch` error. Because uninstalling an Android app erases its local data, **you must export a data backup before uninstalling**.

#### How to update to v1.1.2+:
1. **Export Backup:** Open your current app, go to **Settings**, and export your data as a `.json` file to your device.
2. **Uninstall:** Uninstall the old version of the app from your device.
3. **Install:** Download the latest APK (v1.1.2 or higher) from the [Releases page](../../releases) and install it manually.
4. **Restore Data:** Open the new app, go to **Settings**, and import your saved `.json` backup file to restore your data.

*Note: Future updates released after v1.1.2 will update smoothly without requiring a re-installation or manual backup.*

> **Note:** While Stash is built with React Native and Expo (supporting iOS and Web), **the current primary focus and testing is strictly for Android.**

<p align="center">
  <img src="docs/screenshots/Screenshot_1792389194.png" width="19%" alt="Homepage">
  <img src="docs/screenshots/Screenshot_1792389236.png" width="19%" alt="Add transaction">
  <img src="docs/screenshots/Screenshot_1792389309.png" width="19%" alt="Insights">
  <img src="docs/screenshots/Screenshot_1792389180.png" width="19%" alt="Add goal">
  <img src="docs/screenshots/Screenshot_1792389327.png" width="19%" alt="Goal insights">
</p>

## Download & Install

You can download the latest Android `.apk` directly from our [Releases page](../../releases). 
*Note: You may need to enable "Install unknown apps" in your Android settings to install the APK.*

## Why Stash
- **Safe-to-spend number:** Calculates today's available allowance after accounting for the monthly budget, spending, upcoming recurring bills, and the user's safety buffer.
- **Purchase verdicts:** Evaluates goals with explainable checks and labels such as *Buy now*, *Almost there*, *Keep saving*, and *Don't buy*.
- **Private by default:** Data lives in an app-private SQLite database. Optional biometric or device-PIN app locking is available.
- **Portable data:** Export a JSON backup or transaction CSV, import a JSON backup, and share backups through the platform share sheet. *(Treat exported files as sensitive financial data).*

## Getting Started (Development)

### Prerequisites
- Node.js LTS and npm
- Android Studio, an Android SDK, and an emulator or connected device for Android development

### Installation
Install dependencies from the repository root:
```bash
npm install
```

Start the Expo development server and run on Android:
```bash
npm run start
npm run android  # Build and run the native Android app
```

### Production Builds
The repository includes EAS build profiles. To generate an APK for internal distribution or GitHub releases:
```bash
npx eas build --platform android --profile preview
```
*(See `eas.json` for the complete profile configuration).*

### Contributing
Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.

### License
Stash is distributed under the MIT License.