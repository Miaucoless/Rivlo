import type { CapacitorConfig } from '@capacitor/cli'

const appUrl = process.env.CAPACITOR_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://rivorafit.com'
const appHost = (() => {
  try {
    return new URL(appUrl).hostname
  } catch {
    return 'rivorafit.com'
  }
})()

const config: CapacitorConfig = {
  appId: 'com.rivorafit.app',
  appName: 'Rivora',
  webDir: 'public',
  bundledWebRuntime: false,
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith('http://'),
    allowNavigation: [appHost, `*.${appHost}`],
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#09090b',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#09090b',
      overlaysWebView: false,
    },
  },
}

export default config
