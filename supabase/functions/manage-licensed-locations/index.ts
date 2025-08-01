import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    console.log('=== MANAGE LICENSED LOCATIONS REQUEST ===')
    
    const url = new URL(req.url)
    const method = req.method
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (method === "GET") {
      return await handleGetLicensedLocations(supabase, req)
    } else if (method === "POST") {
      return await handleAddLicensedLocation(supabase, req)
    } else if (method === "PUT") {
      return await handleUpdateLicensedLocation(supabase, req)
    } else if (method === "DELETE") {
      return await handleDeleteLicensedLocation(supabase, req)
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

  } catch (error) {
    console.error("=== MANAGE LICENSED LOCATIONS ERROR ===")
    console.error("Error message:", error.message)
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to manage licensed locations: ${error.message}`,
        details: error.toString()
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }
})

async function handleGetLicensedLocations(supabase: any, req: Request) {
  const requestBody = await req.json()
  const agencyGhlId = requestBody.agency_ghl_id
  
  if (!agencyGhlId) {
    return new Response(
      JSON.stringify({ error: "agency_ghl_id is required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  console.log('Getting licensed locations for agency:', agencyGhlId)

  // Get agency permissions to check tier limits
  const { data: agencyPerms, error: agencyError } = await supabase
    .from('agency_permissions')
    .select('agency_tier, max_locations')
    .eq('agency_ghl_id', agencyGhlId)
    .maybeSingle()

  if (agencyError) {
    throw new Error(`Failed to fetch agency permissions: ${agencyError.message}`)
  }

  // Get licensed locations with business details
  const { data: licensedLocations, error: locationsError } = await supabase
    .from('agency_licensed_locations')
    .select(`
      id,
      location_ghl_id,
      is_active,
      licensed_at,
      ghl_configurations!inner (
        business_name,
        business_email,
        is_active
      )
    `)
    .eq('agency_ghl_id', agencyGhlId)
    .order('licensed_at', { ascending: false })

  if (locationsError) {
    throw new Error(`Failed to fetch licensed locations: ${locationsError.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      agency_permissions: agencyPerms,
      licensed_locations: licensedLocations || [],
      current_count: licensedLocations?.length || 0,
      max_locations: agencyPerms?.max_locations || 0,
      agency_tier: agencyPerms?.agency_tier || 'Tier 1'
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    }
  )
}

async function handleAddLicensedLocation(supabase: any, req: Request) {
  const requestBody = await req.json()
  const { agency_ghl_id, location_ghl_id } = requestBody
  
  if (!agency_ghl_id || !location_ghl_id) {
    return new Response(
      JSON.stringify({ error: "agency_ghl_id and location_ghl_id are required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  console.log('Adding licensed location:', { agency_ghl_id, location_ghl_id })

  // Check agency tier limits
  const { data: agencyPerms, error: agencyError } = await supabase
    .from('agency_permissions')
    .select('agency_tier, max_locations')
    .eq('agency_ghl_id', agency_ghl_id)
    .maybeSingle()

  if (agencyError || !agencyPerms) {
    return new Response(
      JSON.stringify({ error: "Agency permissions not found" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  // Check current licensed location count
  const { count: currentCount, error: countError } = await supabase
    .from('agency_licensed_locations')
    .select('*', { count: 'exact', head: true })
    .eq('agency_ghl_id', agency_ghl_id)
    .eq('is_active', true)

  if (countError) {
    throw new Error(`Failed to count licensed locations: ${countError.message}`)
  }

  // Enforce tier limits (except for Tier 3 which has unlimited with per-location pricing)
  if (agencyPerms.agency_tier === 'Tier 1' && (currentCount || 0) >= 3) {
    return new Response(
      JSON.stringify({ 
        error: "Tier 1 agencies are limited to 3 licensed locations",
        current_count: currentCount,
        max_locations: 3
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  if (agencyPerms.agency_tier === 'Tier 2' && (currentCount || 0) >= 10) {
    return new Response(
      JSON.stringify({ 
        error: "Tier 2 agencies are limited to 10 licensed locations",
        current_count: currentCount,
        max_locations: 10
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  // Verify the location exists
  const { data: locationExists, error: locationError } = await supabase
    .from('ghl_configurations')
    .select('id, business_name')
    .eq('ghl_account_id', location_ghl_id)
    .maybeSingle()

  if (locationError || !locationExists) {
    return new Response(
      JSON.stringify({ error: "Location not found in configurations" }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  // Add the licensed location
  const { data: newLicense, error: insertError } = await supabase
    .from('agency_licensed_locations')
    .insert({
      agency_ghl_id,
      location_ghl_id,
      is_active: true,
      licensed_at: new Date().toISOString()
    })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') { // Unique constraint violation
      return new Response(
        JSON.stringify({ error: "Location is already licensed" }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }
    throw new Error(`Failed to add licensed location: ${insertError.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      licensed_location: newLicense,
      business_name: locationExists.business_name
    }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    }
  )
}

async function handleUpdateLicensedLocation(supabase: any, req: Request) {
  const requestBody = await req.json()
  const { id, agency_ghl_id, is_active } = requestBody
  
  if (!id || !agency_ghl_id || is_active === undefined) {
    return new Response(
      JSON.stringify({ error: "id, agency_ghl_id, and is_active are required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  console.log('Updating licensed location:', { id, agency_ghl_id, is_active })

  const { data: updatedLicense, error: updateError } = await supabase
    .from('agency_licensed_locations')
    .update({ is_active })
    .eq('id', id)
    .eq('agency_ghl_id', agency_ghl_id)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to update licensed location: ${updateError.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      licensed_location: updatedLicense
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    }
  )
}

async function handleDeleteLicensedLocation(supabase: any, req: Request) {
  const requestBody = await req.json()
  const { id, agency_ghl_id } = requestBody
  
  if (!id || !agency_ghl_id) {
    return new Response(
      JSON.stringify({ error: "id and agency_ghl_id are required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )
  }

  console.log('Deleting licensed location:', { id, agency_ghl_id })

  const { error: deleteError } = await supabase
    .from('agency_licensed_locations')
    .delete()
    .eq('id', id)
    .eq('agency_ghl_id', agency_ghl_id)

  if (deleteError) {
    throw new Error(`Failed to delete licensed location: ${deleteError.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Licensed location deleted successfully"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    }
  )
}