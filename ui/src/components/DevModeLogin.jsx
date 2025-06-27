import { useState } from 'react'

function DevModeLogin({ onLogin }) {
  const [formData, setFormData] = useState({
    userId: 'dev-user-123',
    email: 'developer@example.com',
    userName: 'John Developer',
    role: 'admin',
    type: 'location',
    companyId: 'comp_123456789',
    locationId: 'loc_987654321',
    activeLocation: 'loc_987654321'
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Development login with data:', formData)
    onLogin(formData)
  }

  const loadSampleData = (sampleType) => {
    const samples = {
      agency: {
        userId: 'agency-user-456',
        email: 'agency@example.com',
        userName: 'Jane Agency',
        role: 'admin',
        type: 'agency',
        companyId: 'comp_agency123',
        locationId: 'comp_agency123',
        activeLocation: null
      },
      location: {
        userId: 'loc-user-789',
        email: 'location@example.com',
        userName: 'Bob Location',
        role: 'user',
        type: 'location',
        companyId: 'comp_456789',
        locationId: 'loc_123456789',
        activeLocation: 'loc_123456789'
      },
      admin: {
        userId: 'admin-user-999',
        email: 'admin@example.com',
        userName: 'Alice Admin',
        role: 'admin',
        type: 'location',
        companyId: 'comp_admin999',
        locationId: 'loc_admin999',
        activeLocation: 'loc_admin999'
      }
    }
    
    setFormData(samples[sampleType])
  }

  return (
    <div className="dev-mode-container">
      <div className="dev-mode-header">
        <h2>🚀 Development Mode</h2>
        <p>Enter sample user data to test the application</p>
      </div>

      <div className="sample-buttons">
        <button 
          type="button" 
          onClick={() => loadSampleData('agency')}
          className="sample-button agency"
        >
          Load Agency User
        </button>
        <button 
          type="button" 
          onClick={() => loadSampleData('location')}
          className="sample-button location"
        >
          Load Location User
        </button>
        <button 
          type="button" 
          onClick={() => loadSampleData('admin')}
          className="sample-button admin"
        >
          Load Admin User
        </button>
      </div>

      <form onSubmit={handleSubmit} className="dev-form">
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="userId">User ID</label>
            <input
              type="text"
              id="userId"
              name="userId"
              value={formData.userId}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="userName">User Name</label>
            <input
              type="text"
              id="userName"
              name="userName"
              value={formData.userName}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="type">User Type</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              required
            >
              <option value="location">Location</option>
              <option value="agency">Agency</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="companyId">Company ID</label>
            <input
              type="text"
              id="companyId"
              name="companyId"
              value={formData.companyId}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="locationId">Location ID</label>
            <input
              type="text"
              id="locationId"
              name="locationId"
              value={formData.locationId}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="activeLocation">Active Location</label>
            <input
              type="text"
              id="activeLocation"
              name="activeLocation"
              value={formData.activeLocation || ''}
              onChange={handleInputChange}
              placeholder="Leave empty for agency users"
            />
          </div>
        </div>

        <button type="submit" className="login-button">
          Login with Sample Data
        </button>
      </form>

      <div className="dev-mode-note">
        <p><strong>Note:</strong> This development mode bypasses GoHighLevel SSO authentication. 
        In production, users will be authenticated through GHL's iframe SSO system.</p>
      </div>
    </div>
  )
}

export default DevModeLogin