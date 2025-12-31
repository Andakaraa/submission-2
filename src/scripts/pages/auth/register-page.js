import authAPI from '../../data/auth-api';

class RegisterPresenter {
  constructor(view) {
    this.view = view;
  }

  async register(name, email, password) {
    try {
      this.view.showLoading();
      await authAPI.register(name, email, password);
      
      this.view.showSuccess('Registrasi berhasil! Mengalihkan ke halaman login...');
      
      setTimeout(() => {
        window.location.hash = '#/login';
      }, 2000);
    } catch (error) {
      this.view.showError(error.message);
    } finally {
      this.view.hideLoading();
    }
  }
}

export default class RegisterPage {
  constructor() {
    this.presenter = new RegisterPresenter(this);
  }

  async render() {
    return `
      <section class="auth-container">
        <div class="auth-card">
          <h1>Daftar Akun</h1>
          <form id="register-form" class="auth-form">
            <div class="form-group">
              <label for="name">Nama Lengkap</label>
              <input 
                type="text" 
                id="name" 
                name="name" 
                required 
                aria-required="true"
                placeholder="Masukkan nama lengkap Anda"
              />
            </div>
            
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
                placeholder="Minimal 8 karakter"
              />
              <small>Password minimal 8 karakter</small>
            </div>
            
            <div id="error-message" class="error-message" role="alert" aria-live="polite"></div>
            <div id="success-message" class="success-message" role="alert" aria-live="polite"></div>
            
            <button type="submit" class="btn-primary">
              <span id="register-text">Daftar</span>
              <span id="loading-spinner" class="spinner" style="display: none;"></span>
            </button>
          </form>
          
          <p class="auth-link">
            Sudah punya akun? <a href="#/login">Login di sini</a>
          </p>
        </div>
      </section>
    `;
  }

  async afterRender() {
    const form = document.getElementById('register-form');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      await this.presenter.register(name, email, password);
    });
  }

  showLoading() {
    document.getElementById('register-text').style.display = 'none';
    document.getElementById('loading-spinner').style.display = 'inline-block';
    document.querySelector('.btn-primary').disabled = true;
  }

  hideLoading() {
    document.getElementById('register-text').style.display = 'inline';
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
