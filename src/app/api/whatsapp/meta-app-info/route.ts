import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      metaAppId: process.env.META_APP_ID || null,
      metaConfigId: process.env.META_CONFIG_ID || null,
    })
  } catch (error) {
    console.error('Error fetching Meta App Info:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
