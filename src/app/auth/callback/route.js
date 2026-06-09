import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClientWithCookies } from '@/lib/supabase-server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClientWithCookies({
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      },
    })
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Derive a public, non-PII username. Prefer the GitHub handle;
      // never fall back to the email address (it would be exposed on
      // the public profile URL). Use a short random suffix instead.
      const handle = data.user.user_metadata?.user_name
      const username =
        handle || `furry_${data.user.id.replace(/-/g, '').slice(0, 8)}`

      // Create the profile if it doesn't exist yet
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username,
        display_name: data.user.user_metadata?.full_name,
        avatar_url: data.user.user_metadata?.avatar_url,
      }, { onConflict: 'id', ignoreDuplicates: true })

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
