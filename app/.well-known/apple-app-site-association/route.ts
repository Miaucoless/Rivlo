import { NextResponse } from 'next/server'

export const revalidate = 3600

function getAppIds() {
  return (process.env.APPLE_APP_SITE_ASSOCIATION_APP_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function GET() {
  const appIds = getAppIds()

  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: appIds.map((appID) => ({
          appID,
          paths: ['/', '/dashboard/*', '/share/*', '/login', '/signup', '/privacy', '/terms'],
        })),
      },
      webcredentials: {
        apps: appIds,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}
