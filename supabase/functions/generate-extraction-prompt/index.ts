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
    
    // Handle both direct locationId and nested body.locationId
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

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the GHL configuration for this location
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
    // Get all extraction fields for this configuration
    const extractionFields = await getExtractionFields(supabase, ghlConfig.id)
    console.log(`Found ${extractionFields.length} extraction fields`)
    
    console.log('Step 3: Fetching contextual rules...')
    // Get contextual rules
    const contextualRules = await getContextualRules(supabase, ghlConfig.id)
    console.log(`Found ${contextualRules.length} contextual rules`)
    
    console.log('Step 4: Fetching stop triggers...')
    // Get stop triggers
    const stopTriggers = await getStopTriggers(supabase, ghlConfig.id)
    console.log(`Found ${stopTriggers.length} stop triggers`)

    console.log('Step 5: Generating comprehensive AI prompt...')
    // Generate the comprehensive AI prompt
    const prompt = generateExtractionPrompt({
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

    // Log field details for debugging
    if (extractionFields.length > 0) {
      console.log('Extraction fields details:')
      extractionFields.forEach((field, index) => {
        console.log(`  ${index + 1}. ${field.field_name} (${field.field_type}) -> ${field.target_ghl_key}`)
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
          contextualRulesCount: contextualRules.length,
          stopTriggersCount: stopTriggers.length,
          promptLength: prompt.length,
          generatedAt: new Date().toISOString(),
          fields: extractionFields.map(f => ({
            name: f.field_name,
            type: f.field_type,
            key: f.target_ghl_key,
            required: f.is_required
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
    
    // Try to find any configuration for debugging
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
    // Debug: Check if there are any extraction fields at all
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
      console.log(`  ${index + 1}. ${field.field_name} (${field.field_type}) -> ${field.target_ghl_key}`)
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

function generateExtractionPrompt({
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
  
  const sections = []

  // Header and role definition
  sections.push(`# Data Extraction AI Assistant for ${ghlConfig.business_name}

You are an AI assistant specialized in extracting structured data from conversations for ${ghlConfig.business_name}. Your role is to analyze conversation messages and extract relevant information into specific fields.

## Business Context
**Business Name:** ${ghlConfig.business_name}
**Location ID:** ${locationId}`)

  // Add business details if available
  if (ghlConfig.business_description) {
    sections.push(`**Business Description:** ${ghlConfig.business_description}`)
  }
  
  if (ghlConfig.business_context) {
    sections.push(`**Business Context:** ${ghlConfig.business_context}`)
  }
  
  if (ghlConfig.target_audience) {
    sections.push(`**Target Audience:** ${ghlConfig.target_audience}`)
  }
  
  if (ghlConfig.services_offered) {
    sections.push(`**Services Offered:** ${ghlConfig.services_offered}`)
  }

  // Extraction instructions
  sections.push(`
## Your Task
Analyze the provided conversation and extract data for the following fields. Only extract information that is explicitly mentioned or clearly implied in the conversation. Do not make assumptions or generate fictional data.

## Extraction Rules
1. **Accuracy First:** Only extract information that is clearly stated in the conversation
2. **No Assumptions:** Do not infer information that isn't explicitly mentioned
3. **Respect Field Types:** Follow the data type requirements for each field
4. **Handle Options Carefully:** For choice fields, only select from the provided options
5. **Required Fields:** Pay special attention to required fields
6. **Context Matters:** Consider the business context when interpreting information`)

  // Add extraction fields
  if (extractionFields.length > 0) {
    sections.push(`\n## Fields to Extract (${extractionFields.length} total)`)
    
    // Group fields by type for better organization
    const standardFields = extractionFields.filter(f => f.target_ghl_key.startsWith('contact.'))
    const customFields = extractionFields.filter(f => !f.target_ghl_key.startsWith('contact.'))
    
    if (standardFields.length > 0) {
      sections.push(`\n### Standard Contact Fields (${standardFields.length} fields)`)
      standardFields.forEach((field, index) => {
        sections.push(formatFieldInstruction(field, index + 1))
      })
    }
    
    if (customFields.length > 0) {
      sections.push(`\n### Custom Fields (${customFields.length} fields)`)
      customFields.forEach((field, index) => {
        sections.push(formatFieldInstruction(field, standardFields.length + index + 1))
      })
    }
  } else {
    sections.push(`\n## ⚠️ No Extraction Fields Configured
No fields have been configured for data extraction. Please configure extraction fields in the system before using this AI assistant.`)
  }

  // Add contextual rules
  if (contextualRules.length > 0) {
    sections.push(`\n## Contextual Rules and Guidelines (${contextualRules.length} rules)`)
    
    const employeeRules = contextualRules.filter(r => r.rule_type === 'EMPLOYEE_NAMES')
    const promptRules = contextualRules.filter(r => r.rule_type === 'PROMPT_RULES')
    const businessRules = contextualRules.filter(r => r.rule_type === 'BUSINESS_CONTEXT')
    
    if (employeeRules.length > 0) {
      sections.push(`\n### Employee Information`)
      employeeRules.forEach(rule => {
        sections.push(`- **${rule.rule_name}:** ${rule.rule_description}`)
        if (rule.rule_value) {
          sections.push(`  Value: ${rule.rule_value}`)
        }
      })
    }
    
    if (businessRules.length > 0) {
      sections.push(`\n### Business Context Rules`)
      businessRules.forEach(rule => {
        sections.push(`- **${rule.rule_name}:** ${rule.rule_description}`)
        if (rule.rule_value) {
          sections.push(`  Details: ${rule.rule_value}`)
        }
      })
    }
    
    if (promptRules.length > 0) {
      sections.push(`\n### Special Instructions`)
      promptRules.forEach(rule => {
        sections.push(`- **${rule.rule_name}:** ${rule.rule_description}`)
        if (rule.rule_value) {
          sections.push(`  Instructions: ${rule.rule_value}`)
        }
      })
    }
  }

  // Add stop triggers
  if (stopTriggers.length > 0) {
    sections.push(`\n## Stop Triggers - When to Escalate to Human (${stopTriggers.length} triggers)`)
    sections.push(`If you encounter any of the following scenarios, do not attempt data extraction and instead recommend human intervention:`)
    
    stopTriggers.forEach((trigger, index) => {
      sections.push(`\n${index + 1}. **${trigger.trigger_name}**`)
      sections.push(`   Scenario: ${trigger.scenario_description}`)
      sections.push(`   Response: "${trigger.escalation_message}"`)
    })
  }

  // Output format instructions
  sections.push(`\n## Output Format
Respond with a JSON object containing the extracted data. Use the exact field keys provided above. For fields where no data is found, use null.

Example format:
\`\`\`json
{`)

  // Add example fields based on actual configured fields
  if (extractionFields.length > 0) {
    const exampleFields = extractionFields.slice(0, 3) // Show first 3 fields as examples
    exampleFields.forEach((field, index) => {
      const exampleValue = getExampleValue(field)
      const comma = index < exampleFields.length - 1 ? ',' : ''
      sections.push(`  "${field.target_ghl_key}": ${exampleValue}${comma}`)
    })
    
    if (extractionFields.length > 3) {
      sections.push(`  // ... other configured fields`)
    }
  } else {
    sections.push(`  "example_field": "example_value"`)
  }

  sections.push(`  "extraction_confidence": "high",
  "notes": "Any relevant observations or context"
}
\`\`\`

Include an "extraction_confidence" field with values: "high", "medium", or "low" based on how certain you are about the extracted data.

Add a "notes" field with any relevant observations or context that might be useful.`)

  // Final instructions
  sections.push(`\n## Important Reminders
- Only extract information that is clearly present in the conversation
- Respect the business context and industry-specific terminology
- For choice fields, only select from the provided options
- If you're unsure about any information, mark confidence as "low"
- If stop triggers are encountered, prioritize human escalation over data extraction
- Always maintain data accuracy over completeness
- Use the exact field keys provided in the "Fields to Extract" section`)

  return sections.join('\n')
}

function formatFieldInstruction(field: ExtractionField, index: number): string {
  const sections = []
  
  sections.push(`\n${index}. **${field.field_name}** (${field.field_type})`)
  sections.push(`   Key: \`${field.target_ghl_key}\``)
  sections.push(`   Instructions: ${field.description}`)
  
  if (field.is_required) {
    sections.push(`   ⚠️ **REQUIRED FIELD**`)
  }
  
  if (field.placeholder) {
    sections.push(`   Placeholder: ${field.placeholder}`)
  }
  
  // Handle choice fields with options
  if (['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS'].includes(field.field_type) && field.picklist_options?.length > 0) {
    sections.push(`   Available Options:`)
    
    field.picklist_options.forEach((option: any) => {
      if (typeof option === 'string') {
        sections.push(`   - "${option}"`)
      } else if (option && typeof option === 'object') {
        const value = option.value || option.label || option.key || option
        const description = option.description
        
        if (description && description.trim()) {
          sections.push(`   - "${value}" - ${description}`)
        } else {
          sections.push(`   - "${value}"`)
        }
      }
    })
    
    if (field.field_type === 'SINGLE_OPTIONS') {
      sections.push(`   (Select exactly ONE option)`)
    } else {
      sections.push(`   (Select one or more options as applicable)`)
    }
  }
  
  // Add field-specific guidance based on type
  switch (field.field_type) {
    case 'DATE':
      sections.push(`   Format: Use ISO date format (YYYY-MM-DD) when possible`)
      break
    case 'NUMERICAL':
      sections.push(`   Format: Extract numbers only, no currency symbols or units`)
      break
    case 'EMAIL':
      sections.push(`   Format: Must be a valid email address`)
      break
    case 'PHONE':
      sections.push(`   Format: Include area code and country code if mentioned`)
      break
  }
  
  return sections.join('\n')
}

function getExampleValue(field: ExtractionField): string {
  switch (field.field_type) {
    case 'TEXT':
      return '"John Doe"'
    case 'EMAIL':
      return '"john@example.com"'
    case 'PHONE':
      return '"+1-555-123-4567"'
    case 'DATE':
      return '"2024-01-15"'
    case 'NUMERICAL':
      return '25'
    case 'SINGLE_OPTIONS':
      if (field.picklist_options && field.picklist_options.length > 0) {
        const firstOption = field.picklist_options[0]
        const value = typeof firstOption === 'string' ? firstOption : (firstOption.value || firstOption.label || 'Option 1')
        return `"${value}"`
      }
      return '"Option 1"'
    case 'MULTIPLE_OPTIONS':
      if (field.picklist_options && field.picklist_options.length > 0) {
        const firstOption = field.picklist_options[0]
        const value = typeof firstOption === 'string' ? firstOption : (firstOption.value || firstOption.label || 'Option 1')
        return `["${value}"]`
      }
      return '["Option 1"]'
    default:
      return '"extracted_value"'
  }
}