import authAPI from '../../data/auth-api';

class LoginPresenter {
  constructor(view) {
    this.view = view;
  }

  async login(email, password) {
    try {
      this.view.showLoading();
      const response = await authAPI.login(email, password);
      
      authAPI.setToken(response.loginResult.token);
      this.view.showSuccess('Login berhasil!');
      
      setTimeout(() => {
        window.location.hash = '#/';
      }, 1000);
    } catch (error) {
      this.view.showError(error.message);
    } finally {
      this.view.hideLoading();
    }
  }
}

export default class LoginPage {
  constructor() {
    this.presenter = new LoginPresenter(this);
  }

  async render() {
    return `
      <section class="auth-container">
        <div class="auth-card">
          <h1>Login</h1>
          <form id="login-form" class="auth-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                required 
                aria-required="true"
                placeholder="Masukkan email Anda"
              />
            </div>
            
            <div class="form-group">
              <label for="password">Password</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                required 
                aria-required="true"
                minlength="8"
                placeholder="Masukkan password Anda"
              />
            </div>
            
            <div id="error-message" class="error-message" role="alert" aria-live="polite"></div>
            <div id="success-message" class="success-message" role="alert" aria-live="polite"></div>
            
            <button type="submit" class="btn-primary">
              <span id="login-text">Login</span>
              <span id="loading-spinner" class="spinner" style="display: none;"></span>
            </button>
          </form>
          
          <p class="auth-link">
            Belum punya akun? <a href="#/register">Daftar di sini</a>
          </p>
        </div>
      </section>
    `;
  }

  async afterRender() {
    const form = document.getElementById('login-form');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      await this.presenter.login(email, password);
    });
  }

  showLoading() {
    document.getElementById('login-text').style.display = 'none';
    document.getElementById('loading-spinner').style.display = 'inline-block';
    document.querySelector('.btn-primary').disabled = true;
  }

  hideLoading() {
    document.getElementById('login-text').style.display = 'inline';
    document.getElementById('loading-spinner').style.display = 'none';
    document.querySelector('.btn-primary').disabled = false;
  }

  showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    document.getElementById('success-message').style.display = 'none';
  }

  showSuccess(message) {
    const successElement = document.getElementById('success-message');
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    document.getElementById('error-message').style.display = 'none';
  }
}
