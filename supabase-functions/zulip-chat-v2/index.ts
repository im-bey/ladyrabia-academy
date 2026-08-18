import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

const ZULIP_REALM = 'https://ladyrabiaacademy.zulipchat.com'
const ZULIP_BOT_EMAIL = 'lady-rabia-chat-bot@ladyrabiaacademy.zulipchat.com'
const ZULIP_API_KEY = Deno.env.get('ZULIP_API_KEY') || 'VH9pvtwhAvhDOuRtVy7otUwtqXVAc1y3'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://swapiobhcpgufihykoqx.supabase.co'
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

const ZULIP_AUTH = encodeBase64(`${ZULIP_BOT_EMAIL}:${ZULIP_API_KEY}`)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, apikey, Authorization',
  'Access-Control-Max-Age': '86400'
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

const ACCESS_STATUSES = ['active', 'trialing', 'past_due']

/* Verify the caller's Supabase JWT, resolve their member profile, and
   confirm they're allowed in the community chat: an admin, or a member
   with a subscription in one of ACCESS_STATUSES. The community-chat.html
   page redirects unsubscribed members away, but that's a client-side
   UX redirect only — this check is the actual security boundary, since
   this endpoint is reachable directly with any valid Supabase JWT. */
async function authorizeMember(req: Request): Promise<{ name: string } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return { error: 'Authentication required', status: 401 }

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    })
    if (!userRes.ok) return { error: 'Authentication required', status: 401 }
    const authUser = await userRes.json()
    if (!authUser || !authUser.id) return { error: 'Authentication required', status: 401 }

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?auth_id=eq.${authUser.id}&select=name,surname,role`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY
        }
      }
    )
    if (!profileRes.ok) return { error: 'Authentication required', status: 401 }
    const rows = await profileRes.json()
    const profile = Array.isArray(rows) ? rows[0] : null

    let name = 'Member'
    if (profile && profile.name) {
      name = `${profile.name}${profile.surname ? ' ' + profile.surname : ''}`.trim()
    } else if (authUser.user_metadata && authUser.user_metadata.full_name) {
      name = authUser.user_metadata.full_name
    }

    const isAdmin = !!(profile && profile.role === 'admin')
    if (!isAdmin) {
      // service-role key not available here (this function runs with the
      // anon key), so read via RLS using the caller's own token — the
      // "Users can view own subscription" policy already allows this.
      const subRes = await fetch(
        `${SUPABASE_URL}/rest/v1/subscriptions?select=status&order=created_at.desc&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_ANON_KEY
          }
        }
      )
      const subRows = subRes.ok ? await subRes.json() : []
      const status = Array.isArray(subRows) && subRows[0] ? subRows[0].status : null
      if (!status || ACCESS_STATUSES.indexOf(status) === -1) {
        return { error: 'An active membership is required to use community chat', status: 403 }
      }
    }

    return { name }
  } catch (err) {
    console.error('authorizeMember failed:', err)
    return { error: 'Authentication required', status: 401 }
  }
}

async function zulipRequest(path: string, options: RequestInit = {}) {
  const url = `${ZULIP_REALM}/api/v1${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Basic ${ZULIP_AUTH}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zulip API error ${res.status}: ${text}`)
  }

  return await res.json()
}

async function zulipFormRequest(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params).toString()
  const res = await fetch(`${ZULIP_REALM}/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${ZULIP_AUTH}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zulip API error ${res.status}: ${text}`)
  }

  return await res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    /* All endpoints require an authenticated, paying (or admin) member */
    const auth = await authorizeMember(req)
    if ('error' in auth) {
      return errorResponse(auth.error, auth.status)
    }
    const memberName = auth.name

    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/zulip-chat-v2/, '') || '/'

    if (req.method === 'GET' && path === '/messages') {
      const stream = url.searchParams.get('stream') || 'Suhbah'
      const limit = parseInt(url.searchParams.get('limit') || '50', 10)

      const narrow = encodeURIComponent(JSON.stringify([{ operator: 'stream', operand: stream }]))
      const params = `narrow=${narrow}&anchor=newest&num_before=${limit}&num_after=0&apply_markdown=true`
      const data = await zulipRequest(`/messages?${params}`)

      return jsonResponse(data)
    }

    if (req.method === 'POST' && path === '/messages') {
      const body = await req.json().catch(() => ({}))
      const { stream, topic, content } = body

      if (!content) {
        return errorResponse('content is required')
      }

      /* Prefix with the verified member name so Zulip shows who spoke
         even though the bot account posts the message. */
      const prefixedContent = `**${memberName}:**\n${content}`

      const data = await zulipFormRequest('/messages', {
        type: 'stream',
        to: stream || 'Suhbah',
        subject: topic || 'general',
        content: prefixedContent
      })

      return jsonResponse(data)
    }

    return errorResponse(`Not found: ${path}`, 404)
  } catch (err) {
    console.error('Edge function error:', err)
    return errorResponse(err.message || 'Internal error', 500)
  }
})
