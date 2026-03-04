module.exports = ({ config }) => {
  const isRouterIsolationMode =
    (process.env.EXPO_PUBLIC_BOOT_MODE || '').toLowerCase() === 'router';

  const routerPlugin = isRouterIsolationMode
    ? ['expo-router', { root: 'src/router-app' }]
    : 'expo-router';

  const plugins = (config.plugins || []).map((plugin) => {
    if (plugin === 'expo-router') {
      return routerPlugin;
    }

    if (Array.isArray(plugin) && plugin[0] === 'expo-router') {
      return routerPlugin;
    }

    return plugin;
  });

  return {
    ...config,
    plugins,
  };
};
