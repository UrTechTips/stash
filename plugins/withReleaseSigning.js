// plugins/withReleaseSigning.js
//
// Wires your release keystore into the generated android project:
//   1. writes STASH_RELEASE_* entries into android/gradle.properties
//   2. adds a `release` signingConfig to app/build.gradle and makes the
//      release build type use it (Expo's template signs release with the
//      debug key by default)
//
// Secrets are read from environment variables at prebuild time, so nothing
// sensitive lives in app.json:
//   STASH_KEYSTORE_PATH       path to the .jks / .keystore (keep it outside android/)
//   STASH_KEYSTORE_PASSWORD
//   STASH_KEY_ALIAS
//   STASH_KEY_PASSWORD

const { withGradleProperties, withAppBuildGradle } = require('expo/config-plugins');

const PREFIX = 'STASH_RELEASE_';
const MARKER = '// release-signing';

// gradle.properties is a Java properties file, so backslashes need escaping
const esc = (value) => value.replace(/\\/g, '\\\\');

const SIGNING_BLOCK = `
        release {
            if (project.hasProperty('${PREFIX}STORE_FILE')) {
                storeFile file(${PREFIX}STORE_FILE)
                storePassword ${PREFIX}STORE_PASSWORD
                keyAlias ${PREFIX}KEY_ALIAS
                keyPassword ${PREFIX}KEY_PASSWORD
            }
        }`;

const withSigningProperties = (config) =>
  withGradleProperties(config, (cfg) => {
    const { STASH_KEYSTORE_PATH, STASH_KEYSTORE_PASSWORD, STASH_KEY_ALIAS, STASH_KEY_PASSWORD } = process.env;

    // Drop any entries from a previous prebuild so values never go stale
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key.startsWith(PREFIX))
    );

    if (!STASH_KEYSTORE_PATH || !STASH_KEYSTORE_PASSWORD || !STASH_KEY_ALIAS || !STASH_KEY_PASSWORD) {
      console.warn(
        '[withReleaseSigning] STASH_KEYSTORE_PATH / STASH_KEYSTORE_PASSWORD / STASH_KEY_ALIAS / STASH_KEY_PASSWORD not all set; release builds will not be signed.'
      );
      return cfg;
    }

    const entries = {
      STORE_FILE: STASH_KEYSTORE_PATH.replace(/\\/g, '/'), // forward slashes work on Windows too
      STORE_PASSWORD: esc(STASH_KEYSTORE_PASSWORD),
      KEY_ALIAS: esc(STASH_KEY_ALIAS),
      KEY_PASSWORD: esc(STASH_KEY_PASSWORD),
    };
    for (const [key, value] of Object.entries(entries)) {
      cfg.modResults.push({ type: 'property', key: PREFIX + key, value });
    }
    return cfg;
  });

const patchBuildGradle = (src) => {
  if (src.includes(MARKER)) return src; // already patched

  // 1. Point the release build type at the release signingConfig
  const switched = src.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );
  if (switched === src) {
    throw new Error('[withReleaseSigning] Could not find the release signingConfig line in build.gradle');
  }

  // 2. Declare the release signingConfig
  if (!/signingConfigs\s*\{/.test(switched)) {
    throw new Error('[withReleaseSigning] Could not find the signingConfigs block in build.gradle');
  }
  return switched.replace(/signingConfigs\s*\{/, (m) => `${m} ${MARKER}${SIGNING_BLOCK}`);
};

module.exports = (config) =>
  withAppBuildGradle(withSigningProperties(config), (cfg) => {
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    return cfg;
  });