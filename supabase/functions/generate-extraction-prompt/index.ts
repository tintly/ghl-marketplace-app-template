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
    
    const { body } = await req.json()
    const locationId = body?.locationId
    
    if (!locationId) {
      return new Response(
        JSON.stringify({ error: "locationId is required in request body" }),
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
    const ghlConfig = await getGHLConfiguration(supabase, locationId)
    if (!ghlConfig) {
      return new Response(
        JSON.stringify({ 
          error: "No configuration found for this location",
          locationId 
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

    // Get all extraction fields for this configuration
    const extractionFields = await getExtractionFields(supabase, ghlConfig.id)
    
    // Get contextual rules
    const contextualRules = await getContextualRules(supabase, ghlConfig.id)
    
    // Get stop triggers
    const stopTriggers = await getStopTriggers(supabase, ghlConfig.id)

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
    console.log('Extraction fields:', extractionFields.length)
    console.log('Contextual rules:', contextualRules.length)
    console.log('Stop triggers:', stopTriggers.length)

    return new Response(
      JSON.stringify({
        success: true,
        locationId,
        prompt,
        metadata: {
          businessName: ghlConfig.business_name,
          extractionFieldsCount: extractionFields.length,
          contextualRulesCount: contextualRules.length,
          stopTriggersCount: stopTriggers.length,
          promptLength: prompt.length,
          generatedAt: new Date().toISOString()
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
    return null
  }

  console.log('Found configuration:', data.id, '-', data.business_name)
  return data
}

async function getExtractionFields(supabase: any, configId: string): Promise<ExtractionField[]> {
  console.log('Fetching extraction fields for config:', configId)
  
  const { data, error } = await supabase
    .from('data_extraction_fields')
    .select('*')
    .eq('config_id', configId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching extraction fields:', error)
    throw new Error(`Failed to fetch extraction fields: ${error.message}`)
  }

  console.log('Found extraction fields:', data?.length || 0)
  return data || []
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

  console.log('Found contextual rules:', data?.length || 0)
  return data || []
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

  console.log('Found stop triggers:', data?.length || 0)
  return data || []
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
      sections.push(`\n### Standard Contact Fields`)
      standardFields.forEach((field, index) => {
        sections.push(formatFieldInstruction(field, index + 1))
      })
    }
    
    if (customFields.length > 0) {
      sections.push(`\n### Custom Fields`)
      customFields.forEach((field, index) => {
        sections.push(formatFieldInstruction(field, standardFields.length + index + 1))
      })
    }
  } else {
    sections.push(`\n## No Extraction Fields Configured
No fields have been configured for data extraction. Please configure extraction fields in the system.`)
  }

  // Add contextual rules
  if (contextualRules.length > 0) {
    sections.push(`\n## Contextual Rules and Guidelines`)
    
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
    sections.push(`\n## Stop Triggers - When to Escalate to Human`)
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
{
  "contact.first_name": "John",
  "contact.email": "john@example.com",
  "custom_field_id_123": "Consultation",
  "extraction_confidence": "high",
  "notes": "Customer interested in premium service package"
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
- Always maintain data accuracy over completeness`)

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
        
        if (description) {
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