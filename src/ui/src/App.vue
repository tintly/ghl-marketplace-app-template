<template>
  <div id="app">
    <AuthForm 
      v-if="!isAuthenticated" 
      @auth-success="handleAuthSuccess"
    />
    <Dashboard 
      v-else 
      :user="currentUser"
      @sign-out="handleSignOut"
    />
  </div>
</template>

<script>
import AuthForm from './components/AuthForm.vue'
import Dashboard from './components/Dashboard.vue'

export default {
  name: 'App',
  components: {
    AuthForm,
    Dashboard
  },
  data() {
    return {
      isAuthenticated: false,
      currentUser: null
    }
  },
  async mounted() {
    // Check if user is already authenticated
    const token = localStorage.getItem('supabase_token');
    if (token) {
      await this.verifyToken(token);
    }
    
    // Get GHL user data if available
    try {
      const data = await window.ghl.getUserData();
      console.log("GHL user-details", data);
    } catch (error) {
      console.log("GHL data not available:", error);
    }
  },
  methods: {
    async verifyToken(token) {
      try {
        const response = await fetch('/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          this.currentUser = data.user;
          this.isAuthenticated = true;
        } else {
          localStorage.removeItem('supabase_token');
        }
      } catch (error) {
        console.error('Token verification error:', error);
        localStorage.removeItem('supabase_token');
      }
    },
    
    handleAuthSuccess(data) {
      this.currentUser = data.user;
      this.isAuthenticated = true;
    },
    
    handleSignOut() {
      this.isAuthenticated = false;
      this.currentUser = null;
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  background: #f8fafc;
}
</style>