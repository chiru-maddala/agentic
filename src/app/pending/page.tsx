'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function PendingPage() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">&#8987;</div>
        <h2 className="text-xl font-semibold text-white mb-2">Pending approval</h2>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          Your registration is under review. You&apos;ll be able to access reports once an admin approves your account.
        </p>
        <button
          onClick={handleLogout}
          className="mt-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
