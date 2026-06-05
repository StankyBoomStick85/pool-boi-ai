export const config = { runtime: 'edge' }

const SYSTEM_PROMPT = `You are a pool chemistry expert analyzing a pool test strip photo.
The user has placed a used test strip next to its color comparison chart in the frame.
Compare each test pad's color on the strip against the corresponding row on the color chart.

Return ONLY valid JSON — no markdown, no code fences, just the JSON object:
{
  "fc": <free chlorine ppm as number, or null if unreadable>,
  "tc": <total chlorine ppm as number, or null if unreadable>,
  "ph": <pH value as number like 7.2, or null if unreadable>,
  "ta": <total alkalinity ppm as number, or null if unreadable>,
  "ch": <calcium hardness ppm as number, or null if unreadable>,
  "cya": <cyanuric acid / stabilizer ppm as number, or null if unreadable>,
  "hardness": <total hardness ppm as number, or null if unreadable>,
  "confidence": <"high", "medium", or "low">,
  "notes": <brief string — mention lighting issues, blurry pads, or anything unusual>
}

If the image doesn't show a pool test strip and color chart, set confidence to "low" and explain in notes.`

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { image, mediaType = 'image/jpeg' } = body
  if (!image) {
    return new Response(JSON.stringify({ error: 'No image provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let anthropicRes
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: image },
              },
              {
                type: 'text',
                text: 'Analyze this pool test strip and return the chemistry values as JSON.',
              },
            ],
          },
        ],
      }),
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to reach Anthropic API', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => '')
    return new Response(JSON.stringify({ error: 'Anthropic API error', status: anthropicRes.status, detail: errText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = await anthropicRes.json()
  const text = data.content?.[0]?.text ?? ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return new Response(JSON.stringify({ error: 'Could not parse AI response', raw: text.slice(0, 200) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: jsonMatch[0].slice(0, 200) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
