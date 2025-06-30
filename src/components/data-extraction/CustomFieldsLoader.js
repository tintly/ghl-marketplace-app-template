import { GHLApiService } from '../../services/GHLApiService'

export default class CustomFieldsLoader {
  async loadFields(config) {
    try {
      // Always use mock data for temporary/dev/test tokens
      if (this.isTemporaryToken(config.access_token)) {
        console.log('Using mock data for temporary tokens')
        return this.getMockCustomFields()
      }

      const ghlService = new GHLApiService(config.access_token)
      const fields = await ghlService.getCustomFields(config.ghl_account_id)
      return fields
    } catch (error) {
      console.error('Error loading custom fields:', error)
      console.log('Falling back to mock data due to API error')
      return this.getMockCustomFields()
    }
  }

  isTemporaryToken(token) {
    return token.startsWith('temp-') || 
           token.startsWith('dev-') || 
           token.startsWith('test-')
  }

  getMockCustomFields() {
    return [
      {
        id: "mock-text-field",
        name: "Customer Name",
        model: "contact",
        fieldKey: "contact.customer_name",
        placeholder: "Enter customer name",
        dataType: "TEXT",
        position: 50,
        standard: false
      },
      {
        id: "mock-phone-field",
        name: "Phone Number",
        model: "contact",
        fieldKey: "contact.phone_number",
        placeholder: "",
        dataType: "PHONE",
        position: 100,
        standard: false
      },
      {
        id: "mock-service-field",
        name: "Service Type",
        model: "contact",
        fieldKey: "contact.service_type",
        placeholder: "",
        dataType: "SINGLE_OPTIONS",
        position: 150,
        standard: false,
        picklistOptions: ["Consultation", "Installation", "Maintenance", "Repair"]
      },
      {
        id: "mock-date-field",
        name: "Appointment Date",
        model: "contact",
        fieldKey: "contact.appointment_date",
        placeholder: "",
        dataType: "DATE",
        position: 200,
        standard: false
      },
      {
        id: "mock-priority-field",
        name: "Priority Level",
        model: "contact",
        fieldKey: "contact.priority_level",
        placeholder: "",
        dataType: "SINGLE_OPTIONS",
        position: 250,
        standard: false,
        picklistOptions: ["Low", "Medium", "High", "Urgent"]
      }
    ]
  }
}