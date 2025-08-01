// promptGenerator.mjs

// Helper function to determine if a field is a standard field (for internal logic/metadata)
export function isStandardField(field) {
  return field.target_ghl_key.includes('.');
}

// Helper function to separate fields into standard and custom arrays (for metadata/logging)
export function separateFieldTypes(extractionFields) {
  const standardFields = [];
  const customFields = [];
  extractionFields.forEach((field)=>{
    if (isStandardField(field)) {
      standardFields.push(field);
    } else {
      customFields.push(field);
    }
  });
  return {
    standardFields,
    customFields
  };
}

// CORRECTED: Function to get the human-readable field key for the PROMPT
export function getProperFieldKey(field) {
  // 1. Prioritize original_ghl_field_data.fieldKey for custom fields if it's set
  // This is where you'd store a human-readable key like 'vehicle_year'
  if (!isStandardField(field) && field.original_ghl_field_data && field.original_ghl_field_data.fieldKey) {
    return field.original_ghl_field_data.fieldKey;
  }

  // 2. For standard fields (e.g., "contact.firstName"), convert to snake_case for prompt readability
  if (isStandardField(field)) {
    const parts = field.target_ghl_key.split('.');
    const camelCaseName = parts[parts.length - 1]; // e.g., "firstName"
    // Convert camelCase to snake_case for the prompt
    return camelCaseName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).toLowerCase();
  }

  // 3. Fallback for custom fields if original_ghl_field_data.fieldKey is not set: sanitize field_name
  const sanitizedName = field.field_name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_')       // Replace spaces with underscores
    .replace(/_+/g, '_')       // Replace multiple underscores with single
    .replace(/^_|_$/g, '');     // Remove leading/trailing underscores
  return sanitizedName;
}


export function generatePromptWithSeparatedFields({ ghlConfig, extractionFields, contextualRules, stopTriggers, locationId }) {
  const businessDisplayName = ghlConfig.business_name || `Location ${locationId}`;

  let prompt = `You are analyzing a conversation between a customer and a business. `;
  prompt += `Your goal is to extract structured data from the entire conversation history, ensuring all necessary fields are populated. `;
  prompt += `Infer missing details based on context. If a customer provides vehicle details or any other information across multiple messages, combine them correctly. `;
  prompt += `Ensure extracted data is accurate and complete.\\n\\n`;

  // Consolidate business context and relevant contextual rules
  let contextSection = '';
  if (ghlConfig.business_description || ghlConfig.business_context || ghlConfig.services_offered) {
    contextSection += `Business Context:\\n`;
    if (ghlConfig.business_description) {
      contextSection += `- Business: ${ghlConfig.business_description}\\n`;
    }
    if (ghlConfig.services_offered) {
      contextSection += `- Services: ${ghlConfig.services_offered}\\n`;
    }
    if (ghlConfig.business_context) {
      contextSection += `- Context: ${ghlConfig.business_context}\\n`;
    }
  }

  const employeeRules = contextualRules.filter((r)=>r.rule_type === 'EMPLOYEE_NAMES');
  const businessRules = contextualRules.filter((r)=>r.rule_type === 'BUSINESS_CONTEXT');
  const promptRules = contextualRules.filter((r)=>r.rule_type === 'PROMPT_RULES');

  if (employeeRules.length > 0 || businessRules.length > 0) {
    if (!contextSection) contextSection += `Additional Context:\\n`; // Only add heading if not already present
    employeeRules.forEach((rule)=>{
      contextSection += `- ${rule.rule_description}`;
      if (rule.rule_value) {
        contextSection += ` (${rule.rule_value})`;
      }
      contextSection += `\\n`;
    });
    businessRules.forEach((rule)=>{
      contextSection += `- ${rule.rule_description}`;
      if (rule.rule_value) {
        contextSection += ` (${rule.rule_value})`;
      }
      contextSection += `\\n`;
    });
  }

  if (contextSection) {
    prompt += contextSection + `\\n`;
  }

  // Add prompt rules as special instructions, if any
  if (promptRules.length > 0) {
    prompt += `Special Instructions:\\n`;
    promptRules.forEach((rule)=>{
      prompt += `- ${rule.rule_description}`;
      if (rule.rule_value) {
        prompt += ` ${rule.rule_value}`;
      }
      prompt += `\\n`;
    });
    prompt += `\\n`;
  }


  prompt += `Extract and return the following structured data:\\n`;

  // Unified Field List
  if (extractionFields.length > 0) {
    extractionFields.forEach((field)=>{
      const promptFieldKey = getProperFieldKey(field); // Use the corrected function
      prompt += `- **${promptFieldKey}**: ${field.description}`; // Include field_name for human readability

      // Add field-specific formatting instructions if not already in description
      // (This is a fallback/addition, ideally description covers it)
      switch(field.field_type){
        case 'DATE':
          if (!field.description?.includes('YYYY-MM-DD')) prompt += ` Format as YYYY-MM-DD.`;
          break;
        case 'EMAIL':
          if (!field.description?.includes('valid email address')) prompt += ` Must be a valid email address.`;
          break;
        case 'PHONE':
          if (!field.description?.includes('Include area code')) prompt += ` Include area code and formatting as provided.`;
          break;
        case 'NUMERICAL':
          if (!field.description?.includes('Extract numbers only')) prompt += ` Extract numbers only.`;
          break;
        case 'SINGLE_OPTIONS':
        case 'MULTIPLE_OPTIONS':
          if (field.picklist_options?.length > 0 && !field.description?.includes('Choose from:')) {
            const options = field.picklist_options.map((opt)=>{
              if (typeof opt === 'string') {
                return `'${opt}'`;
              } else if (opt && typeof opt === 'object') {
                const value = opt.value || opt.label || opt.key || opt;
                const description = opt.description;
                if (description && description.trim()) {
                  return `'${value}' (${description})`;
                }
                return `'${value}'`;
              }
              return `'${opt}'`;
            }).join(', ');
            if (field.field_type === 'SINGLE_OPTIONS') {
              prompt += ` Choose from: ${options}.`;
            } else {
              prompt += ` Select one or more from: ${options}. Use comma separation for multiple selections.`;
            }
          }
          break;
      }
      if (field.is_required && !field.description?.includes('REQUIRED FIELD')) {
        prompt += ` **REQUIRED FIELD**.`;
      }
      prompt += `\\n`;
    });
    prompt += `\\n`;
  } else {
    prompt += `- No extraction fields have been configured yet. Please configure fields in the system.\\n\\n`;
  }

  // Add stop trigger instructions
  if (stopTriggers.length > 0) {
    prompt += `**STOP TRIGGERS** - Escalate to human if:\\n`;
    stopTriggers.forEach((trigger)=>{
      prompt += `- ${trigger.scenario_description}\\n`;
    });
    prompt += `\\n`;
  }

  // Final instructions (mimicking Python prompt's strong ending)
  prompt += `**IMPORTANT INSTRUCTIONS:**\\n`;
  prompt += `- Scan the entire conversation history to extract missing fields.\\n`;
  prompt += `- If details are spread across multiple messages, combine them appropriately.\\n`;
  prompt += `- Use context to determine if names mentioned are actually the customer's name vs. referrals or business owners.\\n`;
  prompt += `- Only extract information that is clearly stated or strongly implied.\\n`;
  prompt += `- For each field, use the exact field key shown above in your JSON response.\\n`;
  prompt += `- Ensure the response is VALID JSON ONLY, with no explanations or markdown.`;

  return prompt;
}