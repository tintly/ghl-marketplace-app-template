// Utility functions for handling custom field types and data

export const GHL_FIELD_TYPE_MAPPING = {
  'TEXT': 'TEXT',
  'LARGE_TEXT': 'TEXT',
  'NUMERICAL': 'NUMERICAL',
  'SINGLE_OPTIONS': 'SINGLE_OPTIONS',
  'MULTIPLE_OPTIONS': 'MULTIPLE_OPTIONS',
  'CHECKBOX': 'MULTIPLE_OPTIONS',
  'RADIO': 'SINGLE_OPTIONS',
  'DATE': 'DATE',
  'PHONE': 'TEXT',
  'MONETORY': 'NUMERICAL',
  'TEXTBOX_LIST': 'TEXT',
  'FILE_UPLOAD': 'TEXT',
  'EMAIL': 'TEXT'
}

export const FIELD_TYPE_ICONS = {
  'TEXT': '📝',
  'LARGE_TEXT': '📄',
  'NUMERICAL': '🔢',
  'SINGLE_OPTIONS': '🔘',
  'MULTIPLE_OPTIONS': '☑️',
  'CHECKBOX': '✅',
  'RADIO': '🔘',
  'DATE': '📅',
  'PHONE': '📞',
  'MONETORY': '💰',
  'TEXTBOX_LIST': '📋',
  'FILE_UPLOAD': '📎',
  'EMAIL': '📧'
}

export const FIELD_TYPE_LABELS = {
  'TEXT': 'Text',
  'LARGE_TEXT': 'Large Text',
  'NUMERICAL': 'Number',
  'SINGLE_OPTIONS': 'Single Choice',
  'MULTIPLE_OPTIONS': 'Multiple Choice',
  'CHECKBOX': 'Checkbox',
  'RADIO': 'Radio Button',
  'DATE': 'Date',
  'PHONE': 'Phone Number',
  'MONETORY': 'Monetary',
  'TEXTBOX_LIST': 'Text Box List',
  'FILE_UPLOAD': 'File Upload',
  'EMAIL': 'Email'
}

export function getFieldTypeIcon(dataType) {
  return FIELD_TYPE_ICONS[dataType] || '📝'
}

export function getFieldTypeLabel(dataType) {
  return FIELD_TYPE_LABELS[dataType] || dataType
}

export function mapGHLFieldType(ghlDataType) {
  return GHL_FIELD_TYPE_MAPPING[ghlDataType] || 'TEXT'
}

export function formatFieldType(dataType) {
  return getFieldTypeLabel(dataType)
}

export function isPicklistField(dataType) {
  return ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'CHECKBOX', 'RADIO', 'TEXTBOX_LIST'].includes(dataType)
}

export function canExtractToField(ghlDataType) {
  // All field types can be extracted to, but some may need special handling
  return true
}

export function getExtractionHint(ghlDataType) {
  const hints = {
    'TEXT': 'AI will extract text content',
    'LARGE_TEXT': 'AI will extract longer text content',
    'NUMERICAL': 'AI will extract numeric values',
    'SINGLE_OPTIONS': 'AI will select one option from the list',
    'MULTIPLE_OPTIONS': 'AI will select multiple options from the list',
    'CHECKBOX': 'AI will select applicable checkboxes',
    'RADIO': 'AI will select one radio option',
    'DATE': 'AI will extract and format dates',
    'PHONE': 'AI will extract phone numbers',
    'MONETORY': 'AI will extract monetary values',
    'TEXTBOX_LIST': 'AI will extract structured text data',
    'FILE_UPLOAD': 'AI will handle file references',
    'EMAIL': 'AI will extract email addresses'
  }
  
  return hints[ghlDataType] || 'AI will extract relevant data'
}

export function validateFieldKey(fieldKey) {
  if (!fieldKey || typeof fieldKey !== 'string') return false
  
  // Should contain at least one dot
  if (!fieldKey.includes('.')) return false
  
  // Should not start or end with dot
  if (fieldKey.startsWith('.') || fieldKey.endsWith('.')) return false
  
  return true
}

export function extractObjectKey(fieldKey) {
  if (!fieldKey) return 'contact'
  
  // For custom objects: "custom_object.pet.name" -> "custom_object.pet"
  if (fieldKey.startsWith('custom_object.')) {
    const parts = fieldKey.split('.')
    if (parts.length >= 3) {
      return `${parts[0]}.${parts[1]}`
    }
  }
  
  // For standard objects: "contact.field_name" -> "contact"
  const parts = fieldKey.split('.')
  return parts[0] || 'contact'
}

export function normalizePicklistOptions(options) {
  if (!Array.isArray(options)) return []

  return options.map((option, index) => {
    if (typeof option === 'string') {
      return {
        key: option.toLowerCase().replace(/\s+/g, '_'),
        label: option
      }
    } else if (option && typeof option === 'object') {
      return {
        key: option.key || option.value || `option_${index}`,
        label: option.label || option.value || option.key || `Option ${index + 1}`
      }
    } else {
      return {
        key: `option_${index}`,
        label: `Option ${index + 1}`
      }
    }
  })
}