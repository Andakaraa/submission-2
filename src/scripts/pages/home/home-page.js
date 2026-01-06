import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
import storyAPI from '../../data/story-api';
import authAPI from '../../data/auth-api';
import indexedDBHelper from '../../utils/indexeddb-helper';
import notificationHelper from '../../utils/notification-helper';

class HomePresenter {
  constructor(view) {
    this.view = view;
  }

  async loadStories() {
    try {
      this.view.showLoading();
      const stories = await storyAPI.getStories();
      this.view.displayStories(stories);
      this.view.displayMap(stories);
    } catch (error) {
      this.view.showError(error.message);
    } finally {
      this.view.hideLoading();
    }
  }

  async toggleFavorite(story) {
    try {
      const isFav = await indexedDBHelper.isFavorite(story.id);
      
      if (isFav) {
        await indexedDBHelper.removeFavorite(story.id);
        this.view.showSuccess('Dihapus dari favorit');
      } else {
        await indexedDBHelper.addFavorite(story);
        this.view.showSuccess('Ditambahkan ke favorit');
      }
      
      return !isFav;
    } catch (error) {
      this.view.showError('Gagal mengubah favorit');
      return null;
    }
  }

  async toggleNotification() {
    try {
      const isSubscribed = await notificationHelper.isSubscribed();
      
      if (isSubscribed) {
        await notificationHelper.unsubscribePushNotification();
        this.view.showSuccess('Notifikasi dinonaktifkan');
        return false;
      } else {
        const granted = await notificationHelper.requestPermission();
        if (granted) {
          await notificationHelper.subscribePushNotification();
          this.view.showSuccess('Notifikasi diaktifkan');
          return true;
        } else {
          this.view.showError('Izin notifikasi ditolak');
          return false;
        }
      }
    } catch (error) {
      this.view.showError('Gagal mengubah notifikasi');
      return null;
    }
  }

  logout() {
    authAPI.removeToken();
    window.location.hash = '#/login';
  }
}

export default class HomePage {
  constructor() {
    this.presenter = new HomePresenter(this);
    this.map = null;
    this.markers = [];
    this.currentTileLayer = 'street';
    this.tileLayers = {};
  }

  async render() {
    if (!authAPI.isAuthenticated()) {
      window.location.hash = '#/login';
      return '';
    }

    return `
      <section class="home-container">
        <div class="home-header">
          <h1>Cerita dari Seluruh Dunia</h1>
          <div class="header-actions">
            <button id="notification-toggle" class="btn-notification" aria-label="Toggle notifikasi">
              <span id="notification-icon">🔔</span>
              <span id="notification-text">Notifikasi</span>
            </button>
            <a href="#/add-story" class="btn-primary">Tambah Cerita</a>
            <button id="logout-btn" class="btn-secondary">Logout</button>
          </div>
        </div>

        <div id="loading" class="loading-container" style="display: none;">
          <div class="spinner"></div>
          <p>Memuat cerita...</p>
        </div>

        <div id="error-container" class="error-container" role="alert" aria-live="polite" style="display: none;"></div>
        <div id="success-container" class="success-container" role="alert" aria-live="polite" style="display: none;"></div>

        <div class="content-grid">
          <div class="map-container">
            <div class="map-controls">
              <label for="tile-layer-select">Pilih Tampilan Peta:</label>
              <select id="tile-layer-select" class="tile-selector">
                <option value="street">Street Map</option>
                <option value="satellite">Satellite</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>
            <div id="map" role="application" aria-label="Peta interaktif menampilkan lokasi cerita"></div>
          </div>

          <div class="stories-list">
            <h2>Daftar Cerita</h2>
            <div id="filter-container" class="filter-container">
              <label for="search-input">Cari cerita:</label>
              <input 
                type="text" 
                id="search-input" 
                placeholder="Ketik untuk mencari..."
                aria-label="Cari cerita berdasarkan nama atau deskripsi"
              />
            </div>
            <div id="stories-container" class="stories-grid"></div>
          </div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.presenter.logout();
    });

    const notificationToggle = document.getElementById('notification-toggle');
    const updateNotificationUI = async () => {
      const isSubscribed = await notificationHelper.isSubscribed();
      const icon = document.getElementById('notification-icon');
      const text = document.getElementById('notification-text');
      
      if (isSubscribed) {
        icon.textContent = '🔔';
        text.textContent = 'Aktif';
        notificationToggle.classList.add('active');
      } else {
        icon.textContent = '🔕';
        text.textContent = 'Nonaktif';
        notificationToggle.classList.remove('active');
      }
    };

    await updateNotificationUI();

    notificationToggle?.addEventListener('click', async () => {
      await this.presenter.toggleNotification();
      await updateNotificationUI();
    });

    await this.presenter.loadStories();
  }

  showLoading() {
    document.getElementById('loading').style.display = 'flex';
  }

  hideLoading() {
    document.getElementById('loading').style.display = 'none';
  }

  showError(message) {
    const errorContainer = document.getElementById('error-container');
    errorContainer.textContent = `Error: ${message}`;
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

  displayMap(stories) {
    if (!this.map) {
      this.map = L.map('map').setView([-2.5, 118], 5);

      this.tileLayers.street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      });

      this.tileLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
      });

      this.tileLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
      });

      this.tileLayers.street.addTo(this.map);

      const selector = document.getElementById('tile-layer-select');
      selector.addEventListener('change', (e) => {
        this.switchTileLayer(e.target.value);
      });
    }

    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    stories.forEach((story, index) => {
      if (story.lat && story.lon) {
        const marker = L.marker([story.lat, story.lon])
          .bindPopup(`
            <div class="popup-content">
              <img src="${story.photoUrl}" alt="${story.name}" class="popup-image" />
              <h3>${story.name}</h3>
              <p>${story.description}</p>
              <small>Oleh: ${story.name}</small>
            </div>
          `);

        marker.addTo(this.map);
        this.markers.push(marker);

        marker.on('click', () => {
          this.highlightStory(index);
        });
      }
    });
  }

  switchTileLayer(layerName) {
    if (this.tileLayers[this.currentTileLayer]) {
      this.map.removeLayer(this.tileLayers[this.currentTileLayer]);
    }
    
    if (this.tileLayers[layerName]) {
      this.tileLayers[layerName].addTo(this.map);
      this.currentTileLayer = layerName;
    }
  }

  async displayStories(stories) {
    const container = document.getElementById('stories-container');
    
    if (stories.length === 0) {
      container.innerHTML = '<p class="no-stories">Belum ada cerita. Tambahkan cerita pertama Anda!</p>';
      return;
    }

    this.allStories = stories;

    const favoriteChecks = await Promise.all(
      stories.map(story => indexedDBHelper.isFavorite(story.id))
    );

    container.innerHTML = stories.map((story, index) => `
      <article class="story-card" data-index="${index}" data-lat="${story.lat}" data-lon="${story.lon}" data-story='${JSON.stringify(story).replace(/'/g, "&apos;")}'>
        <img src="${story.photoUrl}" alt="Foto cerita: ${story.name}" class="story-image" />
        <div class="story-content">
          <h3>${story.name}</h3>
          <p>${story.description}</p>
          <small class="story-date">${new Date(story.createdAt).toLocaleDateString('id-ID')}</small>
          <button 
            class="btn-favorite ${favoriteChecks[index] ? 'active' : ''}" 
            data-story-id="${story.id}"
            aria-label="${favoriteChecks[index] ? 'Hapus dari favorit' : 'Tambah ke favorit'}"
          >
            ${favoriteChecks[index] ? '⭐ Favorit' : '☆ Favorit'}
          </button>
        </div>
      </article>
    `).join('');

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      this.filterStories(e.target.value, stories);
    });

    const storyCards = container.querySelectorAll('.story-card');
    storyCards.forEach((card, index) => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-favorite')) {
          return;
        }

        const lat = parseFloat(card.dataset.lat);
        const lon = parseFloat(card.dataset.lon);
        
        if (lat && lon) {
          this.map.setView([lat, lon], 13);
          this.markers[index].openPopup();
          this.highlightStory(index);
        }
      });
    });

    const favoriteButtons = container.querySelectorAll('.btn-favorite');
    favoriteButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const card = e.target.closest('.story-card');
        const storyData = JSON.parse(card.dataset.story);
        
        const isFavorited = await this.presenter.toggleFavorite(storyData);
        
        if (isFavorited !== null) {
          if (isFavorited) {
            btn.classList.add('active');
            btn.textContent = '⭐ Favorit';
            btn.setAttribute('aria-label', 'Hapus dari favorit');
          } else {
            btn.classList.remove('active');
            btn.textContent = '☆ Favorit';
            btn.setAttribute('aria-label', 'Tambah ke favorit');
          }
        }
      });
    });
  }

  filterStories(searchTerm, stories) {
    const container = document.getElementById('stories-container');
    const filteredStories = stories.filter(story => 
      story.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    container.innerHTML = filteredStories.map((story, index) => `
      <article class="story-card" data-index="${index}" data-lat="${story.lat}" data-lon="${story.lon}">
        <img src="${story.photoUrl}" alt="Foto cerita: ${story.name}" class="story-image" />
        <div class="story-content">
          <h3>${story.name}</h3>
          <p>${story.description}</p>
          <small class="story-date">${new Date(story.createdAt).toLocaleDateString('id-ID')}</small>
        </div>
      </article>
    `).join('');

    const storyCards = container.querySelectorAll('.story-card');
    storyCards.forEach((card, index) => {
      card.addEventListener('click', () => {
        const lat = parseFloat(card.dataset.lat);
        const lon = parseFloat(card.dataset.lon);
        
        if (lat && lon) {
          this.map.setView([lat, lon], 13);
          this.markers[index].openPopup();
          this.highlightStory(index);
        }
      });
    });
  }

  highlightStory(index) {
    document.querySelectorAll('.story-card').forEach(card => {
      card.classList.remove('highlighted');
    });

    const selectedCard = document.querySelector(`.story-card[data-index="${index}"]`);
    if (selectedCard) {
      selectedCard.classList.add('highlighted');
      selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
