<template>
  <div class="auth-container">
    <div class="auth-card">
      <h2 class="auth-title">{{ isSignUp ? 'Create Account' : 'Sign In' }}</h2>
      
      <form @submit.prevent="handleSubmit" class="auth-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="Enter your email"
            class="form-input"
          />
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            placeholder="Enter your password"
            class="form-input"
            minlength="6"
          />
        </div>
        
        <button 
          type="submit" 
          :disabled="loading"
          class="submit-button"
        >
          {{ loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In') }}
        </button>
      </form>
      
      <div class="auth-switch">
        <p>
          {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
          <button 
            @click="toggleMode" 
            class="switch-button"
            type="button"
          >
            {{ isSignUp ? 'Sign In' : 'Sign Up' }}
          </button>
        </p>
      </div>
      
      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AuthForm',
  data() {
    return {
      email: '',
      password: '',
      isSignUp: false,
      loading: false,
      message: '',
      messageType: 'success'
    }
  },
  methods: {
    async handleSubmit() {
      this.loading = true;
      this.message = '';
      
      try {
        const endpoint = this.isSignUp ? '/auth/signup' : '/auth/signin';
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: this.email,
            password: this.password
          })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          this.messageType = 'success';
          this.message = data.message;
          
          if (data.session) {
            // Store session token for future requests
            localStorage.setItem('supabase_token', data.session.access_token);
            this.$emit('auth-success', data);
          }
          
          // Clear form
          this.email = '';
          this.password = '';
        } else {
          this.messageType = 'error';
          this.message = data.error || 'An error occurred';
        }
      } catch (error) {
        this.messageType = 'error';
        this.message = 'Network error. Please try again.';
        console.error('Auth error:', error);
      } finally {
        this.loading = false;
      }
    },
    
    toggleMode() {
      this.isSignUp = !this.isSignUp;
      this.message = '';
      this.email = '';
      this.password = '';
    }
  }
}
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.auth-title {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #555;
  font-size: 0.9rem;
}

.form-input {
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
}

.submit-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
  margin-top: 0.5rem;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.auth-switch {
  text-align: center;
  margin-top: 1.5rem;
}

.auth-switch p {
  color: #666;
  margin: 0;
}

.switch-button {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-weight: 600;
  text-decoration: underline;
  margin-left: 0.5rem;
}

.switch-button:hover {
  color: #764ba2;
}

.message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 6px;
  text-align: center;
  font-weight: 500;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>