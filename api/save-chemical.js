export const config = { runtime: 'edge' }

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!SUPA_URL || !SUPA_KEY) {
    return new Response(JSON.stringify({ error: 'Supabase environment variables not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
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

  const {
    brand,
    product_name,
    primary_chemical,
    function_tag,
    unit_type,
    concentration,
    total_volume_capacity,
    current_volume_level,
  } = body

  try {
    // 1. Check if product exists in catalog
    const brandEnc = encodeURIComponent(brand)
    const nameEnc = encodeURIComponent(product_name)
    const lookupUrl = `${SUPA_URL}/rest/v1/pool_boi_chemical_catalog?brand=eq.${brandEnc}&product_name=eq.${nameEnc}&select=id`

    const lookupRes = await fetch(lookupUrl, { headers })
    if (!lookupRes.ok) {
      const errText = await lookupRes.text()
      throw new Error(`Catalog lookup failed: ${lookupRes.status} ${errText}`)
    }

    const catRows = await lookupRes.json()
    let catalogId

    if (catRows && catRows.length > 0) {
      catalogId = catRows[0].id
    } else {
      // 2. Insert into catalog if not found
      const insertCatUrl = `${SUPA_URL}/rest/v1/pool_boi_chemical_catalog`
      const catBody = {
        brand,
        product_name,
        primary_chemical,
        function_tag,
        unit_type,
      }

      const catInsRes = await fetch(insertCatUrl, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(catBody),
      })

      if (!catInsRes.ok) {
        const errText = await catInsRes.text()
        throw new Error(`Catalog insert failed: ${catInsRes.status} ${errText}`)
      }

      const newCatRows = await catInsRes.json()
      catalogId = newCatRows[0].id
    }

    // 3. Insert into inventory
    const insertInvUrl = `${SUPA_URL}/rest/v1/pool_boi_inventory`
    const invBody = {
      catalog_id: catalogId,
      total_volume_capacity: Number(total_volume_capacity),
      current_volume_level: Number(current_volume_level),
    }

    const invInsRes = await fetch(insertInvUrl, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(invBody),
    })

    if (!invInsRes.ok) {
      const errText = await invInsRes.text()
      throw new Error(`Inventory insert failed: ${invInsRes.status} ${errText}`)
    }

    const newInvRows = await invInsRes.json()

    return new Response(JSON.stringify({ success: true, data: newInvRows[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
