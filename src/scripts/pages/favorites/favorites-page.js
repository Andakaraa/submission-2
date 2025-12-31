import indexedDBHelper from '../../utils/indexeddb-helper';
import authAPI from '../../data/auth-api';

class FavoritesPresenter {
  constructor(view) {
    this.view = view;
    this.currentFilter = '';
    this.currentSort = 'favoritedAt';
    this.currentOrder = 'desc';
  }

  async loadFavorites() {
    try {
      this.view.showLoading();
      let favorites = await indexedDBHelper.getAllFavorites();
      
      if (this.currentFilter) {
        favorites = await indexedDBHelper.searchFavorites(this.currentFilter);
      } else {
        favorites = await indexedDBHelper.sortFavorites(this.currentSort, this.currentOrder);
      }

      this.view.displayFavorites(favorites);
    } catch (error) {
      this.view.showError(error.message);
    } finally {
      this.view.hideLoading();
    }
  }

  async removeFavorite(id) {
    try {
      await indexedDBHelper.removeFavorite(id);
      await this.loadFavorites();
      this.view.showSuccess('Cerita dihapus dari favorit');
    } catch (error) {
      this.view.showError('Gagal menghapus dari favorit');
    }
  }

  async searchFavorites(query) {
    this.currentFilter = query;
    await this.loadFavorites();
  }

  async sortFavorites(sortBy, order) {
    this.currentSort = sortBy;
    this.currentOrder = order;
    this.currentFilter = '';
    await this.loadFavorites();
  }

  async clearAllFavorites() {
    if (confirm('Apakah Anda yakin ingin menghapus semua favorit?')) {
      try {
        await indexedDBHelper.clearAllFavorites();
        await this.loadFavorites();
        this.view.showSuccess('Semua favorit berhasil dihapus');
      } catch (error) {
        this.view.showError('Gagal menghapus favorit');
      }
    }
  }
}

export default class FavoritesPage {
  constructor() {
    this.presenter = new FavoritesPresenter(this);
  }

  async render() {
    if (!authAPI.isAuthenticated()) {
      window.location.hash = '#/login';
      return '';
    }

    return `
      <section class="favorites-container">
        <div class="favorites-header">
          <h1>⭐ Cerita Favorit Saya</h1>
          <p class="subtitle">Kumpulan cerita yang Anda simpan untuk dibaca kembali</p>
        </div>

        <div id="loading" class="loading-container" style="display: none;">
          <div class="spinner"></div>
          <p>Memuat favorit...</p>
        </div>

        <div id="error-container" class="error-container" role="alert" aria-live="polite" style="display: none;"></div>
        <div id="success-container" class="success-container" role="alert" aria-live="polite" style="display: none;"></div>

        <div class="favorites-controls">
          <div class="search-box">
            <label for="search-favorites">🔍 Cari favorit:</label>
            <input 
              type="text" 
              id="search-favorites" 
              placeholder="Cari berdasarkan judul atau deskripsi..."
              aria-label="Cari cerita favorit"
            />
          </div>

          <div class="sort-controls">
            <label for="sort-select">Urutkan berdasarkan:</label>
            <select id="sort-select" aria-label="Pilih urutan">
              <option value="favoritedAt-desc">Terbaru ditambahkan</option>
              <option value="favoritedAt-asc">Terlama ditambahkan</option>
              <option value="name-asc">Nama (A-Z)</option>
              <option value="name-desc">Nama (Z-A)</option>
              <option value="createdAt-desc">Cerita terbaru</option>
              <option value="createdAt-asc">Cerita terlama</option>
            </select>
          </div>

          <button id="clear-all-btn" class="btn-danger-outline">
            🗑️ Hapus Semua
          </button>
        </div>

        <div id="favorites-list" class="favorites-list"></div>

        <div id="empty-state" class="empty-state" style="display: none;">
          <div class="empty-icon">⭐</div>
          <h2>Belum ada favorit</h2>
          <p>Anda belum menyimpan cerita apapun sebagai favorit.</p>
          <p>Mulai jelajahi cerita dan tambahkan ke favorit!</p>
          <a href="#/" class="btn-primary">Jelajahi Cerita</a>
        </div>
      </section>
    `;
  }

  async afterRender() {
    this.initializeEventListeners();
    await this.presenter.loadFavorites();
  }

  initializeEventListeners() {
    const searchInput = document.getElementById('search-favorites');
    let searchTimeout;
    
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.presenter.searchFavorites(e.target.value);
      }, 300);
    });

    const sortSelect = document.getElementById('sort-select');
    sortSelect?.addEventListener('change', (e) => {
      const [sortBy, order] = e.target.value.split('-');
      this.presenter.sortFavorites(sortBy, order);
    });

    const clearAllBtn = document.getElementById('clear-all-btn');
    clearAllBtn?.addEventListener('click', () => {
      this.presenter.clearAllFavorites();
    });
  }

  displayFavorites(favorites) {
    const container = document.getElementById('favorites-list');
    const emptyState = document.getElementById('empty-state');

    if (favorites.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    container.style.display = 'grid';
    emptyState.style.display = 'none';

    container.innerHTML = favorites.map(story => `
      <article class="favorite-card" data-id="${story.id}">
        <div class="favorite-image">
          ${story.photoUrl ? `
            <img 
              src="${story.photoUrl}" 
              alt="Foto cerita ${story.name || 'Tanpa Judul'}"
              loading="lazy"
            />
          ` : `
            <div class="no-image">📷 Tanpa Foto</div>
          `}
        </div>
        
        <div class="favorite-content">
          <h3 class="favorite-title">${story.name || 'Tanpa Judul'}</h3>
          <p class="favorite-description">${story.description || 'Tidak ada deskripsi'}</p>
          
          <div class="favorite-meta">
            <span class="favorite-date">
              📅 ${new Date(story.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
            <span class="favorite-location">
              📍 ${story.lat && story.lon ? `${story.lat.toFixed(4)}, ${story.lon.toFixed(4)}` : 'Tanpa Lokasi'}
            </span>
          </div>

          <div class="favorite-actions">
            <button 
              class="btn-remove-favorite" 
              data-id="${story.id}"
              aria-label="Hapus ${story.name} dari favorit"
            >
              ❌ Hapus dari Favorit
            </button>
          </div>
        </div>
      </article>
    `).join('');

    container.querySelectorAll('.btn-remove-favorite').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.presenter.removeFavorite(id);
      });
    });
  }

  showLoading() {
    document.getElementById('loading').style.display = 'block';
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
  }

  showError(message) {
    const errorContainer = document.getElementById('error-container');
    errorContainer.textContent = `❌ ${message}`;
    errorContainer.style.display = 'block';
    
    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 5000);
  }

  showSuccess(message) {
    const successContainer = document.getElementById('success-container');
    successContainer.textContent = `✅ ${message}`;
    successContainer.style.display = 'block';
    
    setTimeout(() => {
      successContainer.style.display = 'none';
    }, 3000);
  }
}
