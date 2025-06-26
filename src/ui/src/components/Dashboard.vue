<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>Data Extractor Dashboard</h1>
      <div class="user-info">
        <span v-if="user">Welcome, {{ user.email }}</span>
        <button @click="handleSignOut" class="sign-out-button">
          Sign Out
        </button>
      </div>
    </header>
    
    <main class="dashboard-content">
      <div class="welcome-card">
        <h2>Welcome to Your Data Extractor</h2>
        <p>Build powerful conversation data extractors for your GoHighLevel workflows.</p>
        
        <div class="feature-grid">
          <div class="feature-card">
            <h3>🔍 Extract Data</h3>
            <p>Automatically extract key information from conversations</p>
          </div>
          
          <div class="feature-card">
            <h3>⚙️ Configure Rules</h3>
            <p>Set up custom extraction rules and triggers</p>
          </div>
          
          <div class="feature-card">
            <h3>📊 View Analytics</h3>
            <p>Monitor extraction performance and insights</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  name: 'Dashboard',
  props: {
    user: {
      type: Object,
      default: null
    }
  },
  methods: {
    async handleSignOut() {
      try {
        const response = await fetch('/auth/signout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          localStorage.removeItem('supabase_token');
          this.$emit('sign-out');
        }
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }
  }
}
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f8fafc;
}

.dashboard-header {
  background: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header h1 {
  margin: 0;
  color: #1a202c;
  font-size: 1.5rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info span {
  color: #4a5568;
}

.sign-out-button {
  background: #e53e3e;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.sign-out-button:hover {
  background: #c53030;
}

.dashboard-content {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.welcome-card h2 {
  margin: 0 0 1rem 0;
  color: #1a202c;
  font-size: 2rem;
}

.welcome-card p {
  color: #4a5568;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.feature-card {
  background: #f7fafc;
  padding: 1.5rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.feature-card h3 {
  margin: 0 0 0.5rem 0;
  color: #2d3748;
  font-size: 1.2rem;
}

.feature-card p {
  margin: 0;
  color: #4a5568;
  font-size: 0.9rem;
}
</style>