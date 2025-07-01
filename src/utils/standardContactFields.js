// Standard contact fields that can be extracted to
export const STANDARD_CONTACT_FIELDS = [
  {
    key: 'contact.first_name',
    name: 'First Name',
    dataType: 'TEXT',
    description: 'Extract the contact\'s first name from conversations',
    category: 'Personal Information'
  },
  {
    key: 'contact.last_name',
    name: 'Last Name',
    dataType: 'TEXT',
    description: 'Extract the contact\'s last name from conversations',
    category: 'Personal Information'
  },
  {
    key: 'contact.name',
    name: 'Full Name',
    dataType: 'TEXT',
    description: 'Extract the contact\'s full name (combined first and last name)',
    category: 'Personal Information'
  },
  {
    key: 'contact.email',
    name: 'Email Address',
    dataType: 'EMAIL',
    description: 'Extract email addresses from conversations',
    category: 'Contact Information'
  },
  {
    key: 'contact.phone_raw',
    name: 'Phone Number',
    dataType: 'PHONE',
    description: 'Extract phone numbers from conversations',
    category: 'Contact Information'
  },
  {
    key: 'contact.company_name',
    name: 'Company Name',
    dataType: 'TEXT',
    description: 'Extract the company name the contact belongs to',
    category: 'Business Information'
  },
  {
    key: 'contact.full_address',
    name: 'Full Address',
    dataType: 'TEXT',
    description: 'Extract complete address information',
    category: 'Address Information'
  },
  {
    key: 'contact.address1',
    name: 'Street Address',
    dataType: 'TEXT',
    description: 'Extract street address (address line 1)',
    category: 'Address Information'
  },
  {
    key: 'contact.city',
    name: 'City',
    dataType: 'TEXT',
    description: 'Extract city name from conversations',
    category: 'Address Information'
  },
  {
    key: 'contact.state',
    name: 'State/Province',
    dataType: 'TEXT',
    description: 'Extract state or province information',
    category: 'Address Information'
  },
  {
    key: 'contact.country',
    name: 'Country',
    dataType: 'TEXT',
    description: 'Extract country information',
    category: 'Address Information'
  },
  {
    key: 'contact.postal_code',
    name: 'Postal Code',
    dataType: 'TEXT',
    description: 'Extract postal code or ZIP code',
    category: 'Address Information'
  },
  {
    key: 'contact.date_of_birth',
    name: 'Date of Birth',
    dataType: 'DATE',
    description: 'Extract date of birth from conversations',
    category: 'Personal Information'
  },
  {
    key: 'contact.website',
    name: 'Website',
    dataType: 'TEXT',
    description: 'Extract website URL of the contact or their business',
    category: 'Business Information'
  }
]

// Group fields by category for better organization
export const STANDARD_FIELDS_BY_CATEGORY = STANDARD_CONTACT_FIELDS.reduce((acc, field) => {
  if (!acc[field.category]) {
    acc[field.category] = []
  }
  acc[field.category].push(field)
  return acc
}, {})

// Helper function to get a standard field by key
export function getStandardFieldByKey(key) {
  return STANDARD_CONTACT_FIELDS.find(field => field.key === key)
}

// Helper function to check if a field key is a standard field
export function isStandardField(fieldKey) {
  return STANDARD_CONTACT_FIELDS.some(field => field.key === fieldKey)
}

// Helper function to get field icon based on data type
export function getStandardFieldIcon(dataType) {
  const icons = {
    'TEXT': '📝',
    'EMAIL': '📧',
    'PHONE': '📞',
    'DATE': '📅'
  }
  return icons[dataType] || '📝'
}