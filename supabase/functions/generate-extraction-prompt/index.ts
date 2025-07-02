import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface ExtractionField {
  id: string
  field_name: string
  description: string
  target_ghl_key: string
  field_type: string
  picklist_options: any[]
  placeholder: string
  is_required: boolean
  sort_order: number
  overwrite_policy: string // NEW: Include overwrite policy
  original_ghl_field_data: any
}

interface GHLConfiguration {
  id: string
  ghl_account_id: string
  business_name: string
  business_description: string
  business_context: string
  target_audience: string
  services_offered: string
}

interface ContextualRule {
  rule_name: string
  rule_description: string
  rule_type: string
  rule_value: string
  is_active: boolean
}

interface StopTrigger {
  trigger_name: string
  scenario_description: string
  escalation_message: string
  is_active: boolean
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== "POST") {
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

  try {
    console.log('=== AI PROMPT GENERATION REQUEST ===')
    
    const requestBody = await req.json()
    console.log('Request body received:', requestBody)
    
    const locationId = requestBody.locationId || requestBody.body?.locationId
    
    if (!locationId) {
      console.error('No locationId found in request:', requestBody)
      return new Response(
        JSON.stringify({ 
          error: "locationId is required",
          receivedBody: requestBody
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

    console.log('Generating extraction prompt for location:', locationId)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Step 1: Fetching GHL configuration...')
    const ghlConfig = await getGHLConfiguration(supabase, locationId)
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ 
          error: "No configuration found for this location",
          locationId,
          message: "Please ensure the app is properly installed and configured for this location"
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      )
    }

    console.log('Step 2: Fetching extraction fields...')
    const extractionFields = await getExtractionFields(supabase, ghlConfig.id)
    console.log(`Found ${extractionFields.length} extraction fields`)
    
    console.log('Step 3: Fetching contextual rules...')
    const contextualRules = await getContextualRules(supabase, ghlConfig.id)
    console.log(`Found ${contextualRules.length} contextual rules`)
    
    console.log('Step 4: Fetching stop triggers...')
    const stopTriggers = await getStopTriggers(supabase, ghlConfig.id)
    console.log(`Found ${stopTriggers.length} stop triggers`)

    console.log('Step 5: Generating prompt with separated field types...')
    const prompt = generatePromptWithSeparatedFields({
      ghlConfig,
      extractionFields,
      contextualRules,
      stopTriggers,
      locationId
    })

    console.log('✅ AI prompt generated successfully')
    console.log('Prompt length:', prompt.length, 'characters')
    console.log('Summary:')
    console.log('- Business:', ghlConfig.business_name)
    console.log('- Extraction fields:', extractionFields.length)
    console.log('- Contextual rules:', contextualRules.length)
    console.log('- Stop triggers:', stopTriggers.length)

    // Separate fields for logging
    const { standardFields, customFields } = separateFieldTypes(extractionFields)
    console.log(`- Standard fields: ${standardFields.length}`)
    console.log(`- Custom fields: ${customFields.length}`)

    if (extractionFields.length > 0) {
      console.log('Extraction fields details:')
      extractionFields.forEach((field, index) => {
        const fieldKey = getProperFieldKey(field)
        const fieldType = isStandardField(field) ? 'STANDARD' : 'CUSTOM'
        console.log(`  ${index + 1}. [${fieldType}] ${field.field_name} (${field.field_type}) -> ${fieldKey} [GHL ID: ${field.target_ghl_key}] [Policy: ${field.overwrite_policy || 'ask'}]`)
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        locationId,
        prompt,
        metadata: {
          businessName: ghlConfig.business_name,
          configId: ghlConfig.id,
          extractionFieldsCount: extractionFields.length,
          standardFieldsCount: standardFields.length,
          customFieldsCount: customFields.length,
          contextualRulesCount: contextualRules.length,
          stopTriggersCount: stopTriggers.length,
          promptLength: prompt.length,
          generatedAt: new Date().toISOString(),
          fields: extractionFields.map(f => ({
            id: f.id,
            name: f.field_name,
            type: f.field_type,
            ghlKey: f.target_ghl_key,
            fieldKey: getProperFieldKey(f),
            required: f.is_required,
            isStandard: isStandardField(f),
            overwritePolicy: f.overwrite_policy || 'ask' // NEW: Include overwrite policy in metadata
          }))
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    )

  } catch (error) {
    console.error("=== PROMPT GENERATION ERROR ===")
    console.error("Error message:", error.message)
    console.error("Stack trace:", error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: `Prompt generation failed: ${error.message}`,
        details: error.toString(),
        stack: error.stack
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

// Function to determine if a field is a standard field
function isStandardField(field: ExtractionField): boolean {
  // Standard fields have field keys that contain dots (e.g., "contact.first_name")
  return field.target_ghl_key.includes('.')
}

// Function to separate fields into standard and custom arrays
function separateFieldTypes(extractionFields: ExtractionField[]): {
  standardFields: ExtractionField[]
  customFields: ExtractionField[]
} {
  const standardFields: ExtractionField[] = []
  const customFields: ExtractionField[] = []
  
  extractionFields.forEach(field => {
    if (isStandardField(field)) {
      standardFields.push(field)
    } else {
      customFields.push(field)
    }
  })
  
  return { standardFields, customFields }
}

// Function to get the proper field key for prompt generation
function getProperFieldKey(field: ExtractionField): string {
  // For standard fields, target_ghl_key IS the field key (e.g., "contact.first_name")
  if (field.target_ghl_key.includes('.')) {
    console.log(`Standard field detected: ${field.target_ghl_key}`)
    return field.target_ghl_key
  }
  
  // For custom fields, we need to get the fieldKey from original_ghl_field_data
  if (field.original_ghl_field_data && field.original_ghl_field_data.fieldKey) {
    console.log(`Custom field detected: ${field.target_ghl_key} -> ${field.original_ghl_field_data.fieldKey}`)
    return field.original_ghl_field_data.fieldKey
  }
  
  // Fallback: if no fieldKey in stored data, construct one from the field name
  const sanitizedName = field.field_name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
  
  const fallbackKey = `contact.${sanitizedName}`
  console.log(`⚠️ Fallback field key generated: ${field.target_ghl_key} -> ${fallbackKey}`)
  return fallbackKey
}

async function getGHLConfiguration(supabase: any, locationId: string): Promise<GHLConfiguration | null> {
  console.log('Fetching GHL configuration for location:', locationId)
  
  const { data, error } = await supabase
    .from('ghl_configurations')
    .select(`
      id,
      ghl_account_id,
      business_name,
      business_description,
      business_context,
      target_audience,
      services_offered
    `)
    .eq('ghl_account_id', locationId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error fetching GHL configuration:', error)
    throw new Error(`Failed to fetch configuration: ${error.message}`)
  }

  if (!data) {
    console.log('No configuration found for location:', locationId)
    
    const { data: allConfigs, error: allError } = await supabase
      .from('ghl_configurations')
      .select('id, ghl_account_id, business_name, is_active')
      .limit(5)
    
    if (!allError && allConfigs) {
      console.log('Available configurations in database:')
      allConfigs.forEach(config => {
        console.log(`  - ${config.ghl_account_id} (${config.business_name}) - Active: ${config.is_active}`)
      })
    }
    
    return null
  }

  console.log('✅ Found configuration:', {
    id: data.id,
    name: data.business_name,
    locationId: data.ghl_account_id
  })
  return data
}

async function getExtractionFields(supabase: any, configId: string): Promise<ExtractionField[]> {
  console.log('Fetching extraction fields for config:', configId)
  
  const { data, error } = await supabase
    .from('data_extraction_fields')
    .select(`
      id,
      field_name,
      description,
      target_ghl_key,
      field_type,
      picklist_options,
      placeholder,
      is_required,
      sort_order,
      overwrite_policy,
      original_ghl_field_data
    `)
    .eq('config_id', configId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching extraction fields:', error)
    throw new Error(`Failed to fetch extraction fields: ${error.message}`)
  }

  const fields = data || []
  console.log(`✅ Found ${fields.length} extraction fields`)
  
  if (fields.length === 0) {
    const { data: allFields, error: allError } = await supabase
      .from('data_extraction_fields')
      .select('id, config_id, field_name, target_ghl_key')
      .limit(10)
    
    if (!allError && allFields) {
      console.log('Available extraction fields in database:')
      allFields.forEach(field => {
        console.log(`  - ${field.field_name} (${field.target_ghl_key}) - Config: ${field.config_id}`)
      })
      console.log(`Looking for config_id: ${configId}`)
    }
  } else {
    console.log('Extraction fields found:')
    fields.forEach((field, index) => {
      const fieldKey = getProperFieldKey(field)
      const fieldType = isStandardField(field) ? 'STANDARD' : 'CUSTOM'
      console.log(`  ${index + 1}. [${fieldType}] ${field.field_name} (${field.field_type}) -> ${fieldKey} [GHL ID: ${field.target_ghl_key}] [Policy: ${field.overwrite_policy || 'ask'}]`)
      if (field.is_required) {
        console.log(`     ⚠️ REQUIRED`)
      }
    })
  }
  
  return fields
}

async function getContextualRules(supabase: any, configId: string): Promise<ContextualRule[]> {
  console.log('Fetching contextual rules for config:', configId)
  
  const { data, error } = await supabase
    .from('contextual_rules')
    .select('rule_name, rule_description, rule_type, rule_value, is_active')
    .eq('config_id', configId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching contextual rules:', error)
    throw new Error(`Failed to fetch contextual rules: ${error.message}`)
  }

  const rules = data || []
  console.log(`✅ Found ${rules.length} contextual rules`)
  return rules
}

async function getStopTriggers(supabase: any, configId: string): Promise<StopTrigger[]> {
  console.log('Fetching stop triggers for config:', configId)
  
  const { data, error } = await supabase
    .from('stop_triggers')
    .select('trigger_name, scenario_description, escalation_message, is_active')
    .eq('config_id', configId)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching stop triggers:', error)
    throw new Error(`Failed to fetch stop triggers: ${error.message}`)
  }

  const triggers = data || []
  console.log(`✅ Found ${triggers.length} stop triggers`)
  return triggers
}

function generatePromptWithSeparatedFields({
  ghlConfig,
  extractionFields,
  contextualRules,
  stopTriggers,
  locationId
}: {
  ghlConfig: GHLConfiguration
  extractionFields: ExtractionField[]
  contextualRules: ContextualRule[]
  stopTriggers: StopTrigger[]
  locationId: string
}): string {
  
  // CRITICAL FIX: Use the actual business name from the configuration
  const businessDisplayName = ghlConfig.business_name || `Location ${locationId}`
  
  console.log('🏢 BUSINESS NAME DEBUG:')
  console.log('- Raw business_name from DB:', ghlConfig.business_name)
  console.log('- Final display name:', businessDisplayName)
  console.log('- Location ID:', locationId)
  
  let prompt = `You are analyzing a conversation between a customer and ${businessDisplayName}. `
  prompt += `Your goal is to extract structured data from the entire conversation history, ensuring all necessary fields are populated. `
  prompt += `Infer missing details based on context. If a customer provides information across multiple messages, combine them correctly. `
  prompt += `Ensure extracted data is accurate and complete.\\n\\n`
  
  // Add business context if available
  if (ghlConfig.business_description || ghlConfig.business_context || ghlConfig.services_offered) {
    prompt += `Business Context:\\n`
    if (ghlConfig.business_description) {
      prompt += `- Business: ${ghlConfig.business_description}\\n`
    }
    if (ghlConfig.services_offered) {
      prompt += `- Services: ${ghlConfig.services_offered}\\n`
    }
    if (ghlConfig.business_context) {
      prompt += `- Context: ${ghlConfig.business_context}\\n`
    }
    prompt += `\\n`
  }
  
  // Add contextual rules as business context
  if (contextualRules.length > 0) {
    const employeeRules = contextualRules.filter(r => r.rule_type === 'EMPLOYEE_NAMES')
    const businessRules = contextualRules.filter(r => r.rule_type === 'BUSINESS_CONTEXT')
    const promptRules = contextualRules.filter(r => r.rule_type === 'PROMPT_RULES')
    
    if (employeeRules.length > 0 || businessRules.length > 0) {
      prompt += `Additional Context:\\n`
      
      employeeRules.forEach(rule => {
        prompt += `- ${rule.rule_description}`
        if (rule.rule_value) {
          prompt += ` (${rule.rule_value})`
        }
        prompt += `\\n`
      })
      
      businessRules.forEach(rule => {
        prompt += `- ${rule.rule_description}`
        if (rule.rule_value) {
          prompt += ` (${rule.rule_value})`
        }
        prompt += `\\n`
      })
      
      prompt += `\\n`
    }
    
    // Add prompt rules as special instructions
    if (promptRules.length > 0) {
      prompt += `Special Instructions:\\n`
      promptRules.forEach(rule => {
        prompt += `- ${rule.rule_description}`
        if (rule.rule_value) {
          prompt += ` ${rule.rule_value}`
        }
        prompt += `\\n`
      })
      prompt += `\\n`
    }
  }
  
  // CRITICAL NEW FEATURE: Separate fields into standard and custom arrays
  const { standardFields, customFields } = separateFieldTypes(extractionFields)
  
  prompt += `Extract and return the following structured data:\\n\\n`
  
  // Standard Contact Fields Section
  if (standardFields.length > 0) {
    prompt += `**STANDARD CONTACT FIELDS** (Built-in GoHighLevel fields):\\n`
    standardFields.forEach(field => {
      const fieldKey = getProperFieldKey(field)
      console.log(`Adding standard field to prompt: ${field.field_name} -> ${fieldKey}`)
      
      prompt += `- **${fieldKey}** (ID: ${field.target_ghl_key}): ${field.description}`
      
      // Add field-specific formatting instructions for standard fields
      switch (field.field_type) {
        case 'DATE':
          prompt += ` Format as YYYY-MM-DD.`
          break
        case 'EMAIL':
          prompt += ` Must be a valid email address.`
          break
        case 'PHONE':
          prompt += ` Include area code and formatting as provided.`
          break
        case 'NUMERICAL':
          prompt += ` Extract numbers only.`
          break
      }
      
      if (field.is_required) {
        prompt += ` **REQUIRED FIELD**.`
      }
      
      prompt += `\\n`
    })
    prompt += `\\n`
  }
  
  // Custom Fields Section
  if (customFields.length > 0) {
    prompt += `**CUSTOM FIELDS** (Business-specific fields):\\n`
    customFields.forEach(field => {
      const fieldKey = getProperFieldKey(field)
      console.log(`Adding custom field to prompt: ${field.field_name} -> ${fieldKey} (GHL ID: ${field.target_ghl_key})`)
      
      prompt += `- **${fieldKey}** (ID: ${field.target_ghl_key}): ${field.description}`
      
      // Add choice options if applicable
      if (['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS'].includes(field.field_type) && field.picklist_options?.length > 0) {
        const options = field.picklist_options.map(opt => {
          if (typeof opt === 'string') {
            return `'${opt}'`
          } else if (opt && typeof opt === 'object') {
            const value = opt.value || opt.label || opt.key || opt
            const description = opt.description
            if (description && description.trim()) {
              return `'${value}' (${description})`
            }
            return `'${value}'`
          }
          return `'${opt}'`
        }).join(', ')
        
        if (field.field_type === 'SINGLE_OPTIONS') {
          prompt += ` Choose from: ${options}.`
        } else {
          prompt += ` Select one or more from: ${options}. Use comma separation for multiple selections.`
        }
      }
      
      // Add field-specific formatting instructions for custom fields
      switch (field.field_type) {
        case 'DATE':
          prompt += ` Format as YYYY-MM-DD.`
          break
        case 'EMAIL':
          prompt += ` Must be a valid email address.`
          break
        case 'PHONE':
          prompt += ` Include area code and formatting as provided.`
          break
        case 'NUMERICAL':
          prompt += ` Extract numbers only.`
          break
      }
      
      if (field.is_required) {
        prompt += ` **REQUIRED FIELD**.`
      }
      
      prompt += `\\n`
    })
    prompt += `\\n`
  }
  
  // If no fields are configured
  if (extractionFields.length === 0) {
    prompt += `- No extraction fields have been configured yet. Please configure fields in the system.\\n\\n`
  }
  
  // Add stop trigger instructions
  if (stopTriggers.length > 0) {
    prompt += `**STOP TRIGGERS** - Escalate to human if:\\n`
    stopTriggers.forEach(trigger => {
      prompt += `- ${trigger.scenario_description}\\n`
    })
    prompt += `\\n`
  }
  
  // Add final instructions
  prompt += `**IMPORTANT INSTRUCTIONS:**\\n`
  prompt += `- Scan the entire conversation history to extract missing fields.\\n`
  prompt += `- If details are spread across multiple messages, combine them appropriately.\\n`
  prompt += `- Use context to determine if names mentioned are actually the customer's name vs. referrals or business owners.\\n`
  prompt += `- Only extract information that is clearly stated or strongly implied.\\n`
  prompt += `- For each field, use the exact field key shown above in your JSON response.\\n`
  prompt += `- Standard fields update built-in contact properties, custom fields update business-specific data.\\n`
  prompt += `- Ensure the response is VALID JSON ONLY, with no explanations or markdown.`
  
  return prompt
}