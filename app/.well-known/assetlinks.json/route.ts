import { NextResponse } from 'next/server'

export const revalidate = 3600

function getShaFingerprints() {
  return (process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function GET() {
  const fingerprints = getShaFingerprints()
  const packageName = process.env.ANDROID_APP_LINK_PACKAGE_NAME || 'com.rivorafit.app'

  if (fingerprints.length === 0) {
    return NextResponse.json([], {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}
