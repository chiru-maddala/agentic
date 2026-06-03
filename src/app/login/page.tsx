'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#D4622A]">IntelliRadar</h1>
          <p className="text-[#9CA3AF] text-sm mt-1">Intellina AI Daily Intelligence</p>
        </div>

        <div className="bg-white rounded-xl border border-[#E3E0D8] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-6">Sign in</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-[#6B6B6B] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-[#6B6B6B] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#FAF9F6] border border-[#E3E0D8] rounded-lg px-3 py-2 text-[#1A1A1A] text-sm focus:outline-none focus:ring-2 focus:ring-[#D4622A]/30 focus:border-[#D4622A] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-[#9CA3AF] mt-4">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[#D4622A] hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
