const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('// abi-splits')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /^android\s*\{/m,
        `$&
    // abi-splits
    splits {
        abi {
            reset()
            enable true
            universalApk true
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }`
      );
    }
    return cfg;
  });