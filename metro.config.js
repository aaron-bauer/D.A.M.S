const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
    transform: {
        experimentalImportSupport: false,
        inlineRequires: true, // Optimizes bundle by only loading modules when needed
    },
});

// Drop console logs in production for performance and security
if (process.env.NODE_ENV === 'production') {
    config.transformer.minifierConfig.compress.drop_console = true;
}

module.exports = config;
