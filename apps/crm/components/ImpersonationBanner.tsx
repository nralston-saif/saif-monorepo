import { cookies } from 'next/headers'
import StopImpersonatingButton from './StopImpersonatingButton'

const IMPERSONATE_COOKIE = 'saif_impersonate'

export default async function ImpersonationBanner() {
  const cookieStore = await cookies()
  const impersonateCookie = cookieStore.get(IMPERSONATE_COOKIE)

  if (!impersonateCookie) {
    return null
  }

  let targetName = 'User'
  try {
    const data = JSON.parse(impersonateCookie.value)
    targetName = data.targetName || 'User'
  } catch (e) {
    return null
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium sticky top-0 z-50">
      <span>
        Viewing as <strong>{targetName}</strong>
      </span>
      <StopImpersonatingButton />
    </div>
  )
}
