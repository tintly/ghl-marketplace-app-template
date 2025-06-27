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
  'TEXTBOX_LIST': 'TEXT'
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
  'TEXTBOX_LIST': '📋'
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
  'TEXTBOX_LIST': 'Text Box List'
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
  return ['SINGLE_OPTIONS', 'MULTIPLE_OPTIONS', 'CHECKBOX', 'RADIO'].includes(dataType)
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
    'TEXTBOX_LIST': 'AI will extract structured text data'
  }
  
  return hints[ghlDataType] || 'AI will extract relevant data'
}