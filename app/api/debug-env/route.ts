export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return Response.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    supabase: {
      url_defined: !!url,
      url_length: url?.length || 0,
      url_starts_with_https: url?.startsWith('https://') || false,
      url_contains_supabase: url?.includes('supabase.co') || false,
      key_defined: !!key,
      key_length: key?.length || 0,
      key_starts_with_sb: key?.startsWith('sb_') || false,
    },
    debug_info: {
      url_value: url || 'UNDEFINED',
      key_value: key ? `${key.substring(0, 20)}...` : 'UNDEFINED',
    },
  })
}
