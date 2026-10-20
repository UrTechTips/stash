const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('// name-convention')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /^android\s*\{/m,
        `$&
    // name-convention
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            def abi = output.getFilter(com.android.build.OutputFile.ABI)
            def abiName = abi ? abi : "universal"
            outputFileName = "stash-v\${variant.versionName}-\${abiName}.apk"
        }
    }`
      );
    }
    return cfg;
  });