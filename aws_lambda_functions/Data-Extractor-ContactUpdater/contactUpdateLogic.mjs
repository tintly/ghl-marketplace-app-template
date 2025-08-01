// Path: contactUpdateLogic.mjs

/**
 * @typedef {Object} GHLContact
 * @property {string} id
 * @property {string} [name]
 * @property {string} locationId
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [companyName]
 * @property {string} [address1]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [country]
 * @property {string} [postalCode]
 * @property {string} [website]
 * @property {string} [timezone]
 * @property {string[]} [tags]
 * @property {string} [dateOfBirth]
 * @property {Array<{id: string, value: any}>} [customFields]
 * @property {any} [key: string]
 */

/**
 * @typedef {Object} ExtractionField
 * @property {string} id
 * @property {string} field_name
 * @property {string} target_ghl_key
 * @property {string} [field_key]
 * @property {string} field_type
 * @property {string} [overwrite_policy]
 * @property {Object} [original_ghl_field_data]
 */

/**
 * Checks if a field key corresponds to a standard GHL field.
 * This is based on the `target_ghl_key` containing a dot (e.g., 'contact.firstName').
 * @param {ExtractionField} field - The field configuration object.
 * @returns {boolean} True if it's a standard field, false otherwise.
 */
function isStandardField(field) {
    return field && field.target_ghl_key && field.target_ghl_key.includes('.');
  }
  
  /**
   * Helper function to convert snake_case field keys to GHL's camelCase format for standard fields.
   * @param {string} inputKey - The input field key (e.g., 'contact.first_name', 'first_name').
   * @returns {string} The GHL standard field name (e.g., 'firstName').
   */
  function getGHLStandardFieldName(inputKey) {
    // Remove 'contact.' prefix if present
    let key = inputKey.includes('.') ? inputKey.split('.')[1] : inputKey;
  
    // Map specific fields to their GHL API equivalents
    switch (key) {
      case 'date_of_birth':
        return 'dateOfBirth';
      case 'first_name':
        return 'firstName';
      case 'last_name':
        return 'lastName';
      case 'postal_code':
        return 'postalCode';
      case 'phone_raw': // Assuming this is an internal key that maps to GHL's 'phone'
        return 'phone';
      case 'full_address': // Assuming this maps to GHL's 'address1' or 'address'
        return 'address1'; // Or 'address' depending on GHL API version/usage
      case 'company_name':
        return 'companyName';
      // For fields that don't need conversion (already camelCase or direct match)
      case 'name':
      case 'email':
      case 'phone':
      case 'address1':
      case 'city':
      case 'state':
      case 'country':
      case 'website':
      case 'tags':
        return key;
      default:
        // For any other standard field, assume it's already in the correct GHL format
        // or that the original Deno code's logic for custom fields handles it.
        // This might need refinement based on exact GHL API field names.
        return key;
    }
  }
  
  /**
   * Prepares the payload for updating a GHL contact based on extracted data and overwrite policies.
   * @param {GHLContact} existingContact - The current GHL contact data.
   * @param {Object.<string, any>} extractedData - The data extracted by OpenAI.
   * @param {ExtractionField[]} extractionFields - The configuration for data extraction fields.
   * @returns {{updatePayload: Object, updatedFields: string[], skippedFields: string[]}} The prepared update payload and lists of updated/skipped fields.
   */
  export function prepareUpdatePayload(existingContact, extractedData, extractionFields) {
    const updatePayload = {};
    const updatedFields = [];
    const skippedFields = [];
  
    // Initialize customFields array if needed
    // This will be added to updatePayload only if custom fields are actually updated
    let customFieldsToUpdate = [];
  
    // Create extraction fields map for metadata
    const fieldsMap = new Map();
    extractionFields.forEach((f) => {
      // Map by target_ghl_key (e.g., "contact.firstName" or a custom field ID)
      fieldsMap.set(f.target_ghl_key, f);
  
      // Also map by field_key if available, for flexibility in extractedData keys
      if (f.field_key) {
        const simpleKey = f.field_key;
        const prefixedKey = `contact.${f.field_key}`;
        // Prioritize target_ghl_key if there's a conflict, but allow lookup by field_key
        if (!fieldsMap.has(simpleKey)) fieldsMap.set(simpleKey, f);
        if (!fieldsMap.has(prefixedKey)) fieldsMap.set(prefixedKey, f);
      }
      // Also map the fieldKey from original_ghl_field_data if available
      if (f.original_ghl_field_data?.fieldKey && f.original_ghl_field_data.fieldKey !== f.field_key) {
        const simpleOrigKey = f.original_ghl_field_data.fieldKey.replace(/^contact\./, '');
        const prefixedOrigKey = `contact.${simpleOrigKey}`;
        if (!fieldsMap.has(simpleOrigKey)) fieldsMap.set(simpleOrigKey, f);
        if (!fieldsMap.has(prefixedOrigKey)) fieldsMap.set(prefixedOrigKey, f);
      }
    });
  
    // Create custom fields map for quick lookup of existing values
    const existingCustomFieldsMap = new Map();
    if (existingContact.customFields) {
      existingContact.customFields.forEach((cf) => {
        existingCustomFieldsMap.set(cf.id, cf.value);
      });
    }
  
    // Process each extracted field
    for (const [extractedKey, newValue] of Object.entries(extractedData)) {
      // Skip empty values from extracted data
      if (newValue === null || newValue === undefined || newValue === '') {
        console.log(`Skipping empty value for field ${extractedKey}`);
        skippedFields.push(extractedKey);
        continue;
      }
  
      console.log(`Processing extracted field: ${extractedKey} with value: ${newValue}`);
  
      // Get field configuration using the extracted key
      const fieldConfig = fieldsMap.get(extractedKey);
  
      if (!fieldConfig) {
        console.log(`No field configuration found for extracted key "${extractedKey}", skipping.`);
        skippedFields.push(extractedKey);
        continue;
      }
  
      const isStandard = isStandardField(fieldConfig);
      const fieldName = fieldConfig.field_name || extractedKey;
      const policy = fieldConfig.overwrite_policy || 'always'; // Default policy
  
      let currentValue = null;
      let targetGHLKey = fieldConfig.target_ghl_key; // This is the key used for GHL API
  
      if (isStandard) {
        const ghlStandardKey = getGHLStandardFieldName(targetGHLKey);
        currentValue = existingContact[ghlStandardKey];
        console.log(`Standard field "${extractedKey}" (GHL: "${ghlStandardKey}"):`, { current: currentValue, new: newValue, policy });
      } else {
        // Custom field: targetGHLKey is the custom field ID
        currentValue = existingCustomFieldsMap.get(targetGHLKey);
        console.log(`Custom field "${extractedKey}" (ID: "${targetGHLKey}"):`, { current: currentValue, new: newValue, policy });
      }
  
      // Apply overwrite policy
      let shouldUpdate = false;
      switch (policy) {
        case 'always':
          shouldUpdate = true;
          break;
        case 'if_empty':
          // Consider empty if null, undefined, empty string, or empty array for tags
          shouldUpdate = (currentValue === null || currentValue === undefined || currentValue === '' || (Array.isArray(currentValue) && currentValue.length === 0));
          break;
        case 'never':
          shouldUpdate = false;
          break;
        default: // 'ask' or any other unknown policy defaults to 'always' for update purposes
          shouldUpdate = true;
          break;
      }
  
      if (!shouldUpdate) {
        console.log(`⏭️ Skipping "${fieldName}" (key: "${extractedKey}") due to overwrite policy: "${policy}"`);
        skippedFields.push(extractedKey);
        continue;
      }
  
      // If we reach here, the field should be updated
      if (isStandard) {
        const ghlStandardKey = getGHLStandardFieldName(targetGHLKey);
        // Special handling for specific standard field types
        if (ghlStandardKey === 'tags') {
          // Merge tags to avoid duplicates
          const existingTags = existingContact.tags || [];
          const newTags = Array.isArray(newValue) ? newValue : [newValue];
          updatePayload.tags = Array.from(new Set([...existingTags, ...newTags]));
        } else {
          // For other standard fields, just add them directly to the update payload
          updatePayload[ghlStandardKey] = newValue;
        }
        console.log(`✅ Will update standard field "${ghlStandardKey}": ${JSON.stringify(currentValue)} → ${JSON.stringify(newValue)}`);
        updatedFields.push(extractedKey);
      } else {
        // Custom field
        customFieldsToUpdate.push({
          id: targetGHLKey, // This is the custom field ID
          value: newValue
        });
        console.log(`✅ Will update custom field "${targetGHLKey}" ("${fieldName}"): ${JSON.stringify(currentValue)} → ${JSON.stringify(newValue)}`);
        updatedFields.push(extractedKey);
      }
    }
  
    // Add customFields array to the main updatePayload if there are any custom fields to update
    if (customFieldsToUpdate.length > 0) {
      updatePayload.customFields = customFieldsToUpdate;
    }
  
    // Log the final payload
    console.log('=== FINAL UPDATE PAYLOAD PREPARED ===');
    console.log('Standard fields:', Object.keys(updatePayload).filter((k) => k !== 'customFields'));
    console.log('Custom fields count:', updatePayload.customFields?.length || 0);
    console.log('Updated fields (from extracted data keys):', updatedFields);
    console.log('Skipped fields (from extracted data keys):', skippedFields);
    console.log('=== END FINAL UPDATE PAYLOAD PREPARED ===');
  
    return {
      updatePayload,
      updatedFields,
      skippedFields
    };
  }