export const config = { runtime: 'edge' }

const SYSTEM_PROMPT = `You are a pool chemical expert. Analyze this bottle label image and extract:
- brand (manufacturer name)
- product_name (exact name on label)
- primary_chemical (active ingredient)
- concentration (percentage as a number)
- function_tag - must be one of: pH_Decrease, pH_Increase, Sanitizer, Alkalinity_Increase, Calcium_Increase, Stabilizer_Increase
- unit_type - must be: Ounces or Pounds
- total_volume_capacity (container size as number)

Respond in JSON only. No preamble. Format:
{
  "brand": string,
  "product_name": string,
  "primary_chemical": string,
  "concentration": number,
  "function_tag": string,
  "unit_type": string,
  "total_volume_capacity": number,
  "confidence": "high" | "medium" | "low"
}`

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

  const { image, mediaType } = body
  if (!image || !mediaType) {
    return new Response(JSON.stringify({ error: 'Missing image or mediaType' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: image,
                },
              },
              {
                type: 'text',
                text: 'Identify this pool chemical.',
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || `Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.content[0].text
    
    // Attempt to parse JSON from the response
    try {
      const parsed = JSON.parse(content)
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (e) {
      console.error('Failed to parse Claude response:', content)
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: content }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
