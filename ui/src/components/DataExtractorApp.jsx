import { useState } from 'react'

function DataExtractorApp({ user, authService }) {
  const getLocationDisplay = () => {
    if (user.activeLocation) {
      return `Location: ${user.activeLocation}`
    }
    return `Company: ${user.companyId}`
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Data Extractor</h1>
        <div className="user-info">
          <span className="user-name">{user.userName}</span>
          <span className="location-badge">{getLocationDisplay()}</span>
        </div>
      </header>
      
      <main className="app-content">
        <div className="welcome-section">
          <h2>Welcome to Your Conversation Data Extractor</h2>
          <p>Extract valuable insights from your GoHighLevel conversations automatically.</p>
          
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Location ID</h3>
              <p className="stat-value">{user.locationId}</p>
            </div>
            
            <div className="stat-card">
              <h3>User Role</h3>
              <p className="stat-value">{user.role}</p>
            </div>
            
            <div className="stat-card">
              <h3>Context Type</h3>
              <p className="stat-value">{user.type}</p>
            </div>
          </div>
        </div>
        
        <div className="features-section">
          <h3>Available Features</h3>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h4>Data Extraction</h4>
              <p>Set up custom fields to extract from conversations</p>
              <button className="feature-button">Configure</button>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚙️</div>
              <h4>Rules & Triggers</h4>
              <p>Define when and how data should be extracted</p>
              <button className="feature-button">Manage</button>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h4>Analytics</h4>
              <p>View extraction performance and insights</p>
              <button className="feature-button">View Reports</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default DataExtractorApp