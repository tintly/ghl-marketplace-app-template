// Standard contact fields that can be extracted to
export const STANDARD_CONTACT_FIELDS = [
  {
    key: 'contact.first_name',
    name: 'First Name',
    dataType: 'TEXT',
    description: 'Extract the person\'s given name or first name from the conversation. Look for introductions like "Hi, I\'m John" or "My name is Sarah" or when someone refers to themselves by their first name. Ignore titles, last names, business names, or email addresses. Do NOT extract parts of email addresses as names.',
    category: 'Personal Information'
  },
  {
    key: 'contact.last_name',
    name: 'Last Name',
    dataType: 'TEXT',
    description: 'Extract the person\'s family name or surname from the conversation. Look for full name introductions like "I\'m John Smith" or formal signatures. Extract only the surname portion, excluding first names, middle names, titles, or email addresses. Do NOT extract parts of email addresses as last names.',
    category: 'Personal Information'
  },
  {
    key: 'contact.name',
    name: 'Full Name',
    dataType: 'TEXT',
    description: 'Extract the person\'s complete name (first and last name combined) from the conversation. Look for full introductions, email signatures, or when someone provides their complete name. Format as "First Last" without titles or honorifics. Do NOT extract email addresses or parts of email addresses as names. For example, if someone says "my email is markphilwsceo@gmail.com", do NOT extract "Markphilwsceo" as their name.',
    category: 'Personal Information'
  },
  {
    key: 'contact.email',
    name: 'Email Address',
    dataType: 'EMAIL',
    description: 'Extract valid email addresses mentioned in the conversation. Look for patterns like "contact me at john@company.com" or "send it to my email: sarah.smith@gmail.com". Only extract properly formatted email addresses with @ symbols and valid domains. Do NOT extract the username portion of the email as the person\'s name.',
    category: 'Contact Information'
  },
  {
    key: 'contact.phone_raw',
    name: 'Phone Number',
    dataType: 'PHONE',
    description: 'Extract phone numbers mentioned in the conversation in any format. Look for phrases like "call me at", "my number is", or "reach me on". Include area codes, country codes, and any formatting (dashes, spaces, parentheses). Extract the complete number as provided. Do NOT extract phone numbers as names.',
    category: 'Contact Information'
  },
  {
    key: 'contact.company_name',
    name: 'Company Name',
    dataType: 'TEXT',
    description: 'Extract the name of the company or business the person works for or owns. Look for phrases like "I work at", "I\'m from", "our company", or business names mentioned in context. Extract the official business name, not job titles or departments.',
    category: 'Business Information'
  },
  {
    key: 'contact.full_address',
    name: 'Full Address',
    dataType: 'TEXT',
    description: 'Extract complete physical addresses mentioned in the conversation. Look for street addresses, apartment numbers, city, state, and zip codes mentioned together. Combine all address components into one complete address string.',
    category: 'Address Information'
  },
  {
    key: 'contact.address1',
    name: 'Street Address',
    dataType: 'TEXT',
    description: 'Extract only the street address portion (house number and street name) from address mentions. Look for patterns like "123 Main Street" or "456 Oak Avenue Apt 2B". Exclude city, state, and zip code information.',
    category: 'Address Information'
  },
  {
    key: 'contact.city',
    name: 'City',
    dataType: 'TEXT',
    description: 'Extract city names mentioned in the conversation when discussing location or address. Look for phrases like "I live in", "located in", "from the city of", or city names mentioned in complete addresses. Extract only the city name.',
    category: 'Address Information'
  },
  {
    key: 'contact.state',
    name: 'State/Province',
    dataType: 'TEXT',
    description: 'Extract state, province, or region names from location discussions. Look for state abbreviations (CA, NY, TX) or full state names (California, New York, Texas) mentioned in addresses or location context. Include provinces for international addresses.',
    category: 'Address Information'
  },
  {
    key: 'contact.country',
    name: 'Country',
    dataType: 'TEXT',
    description: 'Extract country names mentioned when discussing location, shipping, or international context. Look for phrases like "I\'m calling from", "shipping to", or country names in addresses. Extract the full country name or standard abbreviation.',
    category: 'Address Information'
  },
  {
    key: 'contact.postal_code',
    name: 'Postal Code',
    dataType: 'TEXT',
    description: 'Extract postal codes, ZIP codes, or postal identifiers from address mentions. Look for 5-digit US ZIP codes, international postal codes, or ZIP+4 formats. Extract exactly as provided, including any formatting like dashes or spaces.',
    category: 'Address Information'
  },
  {
    key: 'contact.date_of_birth',
    name: 'Date of Birth',
    dataType: 'DATE',
    description: 'Extract birth dates mentioned in the conversation. Look for phrases like "I was born on", "my birthday is", "born in [year]", or age-related information that can determine birth year. Format as a proper date (YYYY-MM-DD) when possible.',
    category: 'Personal Information'
  },
  {
    key: 'contact.website',
    name: 'Website',
    dataType: 'TEXT',
    description: 'Extract website URLs or domain names mentioned for the person or their business. Look for phrases like "visit our website", "check out", "our site is", or any URLs starting with http/https or www. Include the complete URL as provided.',
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