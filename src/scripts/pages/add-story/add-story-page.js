import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import storyAPI from '../../data/story-api';
import authAPI from '../../data/auth-api';
import indexedDBHelper from '../../utils/indexeddb-helper';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

class AddStoryPresenter {
  constructor(view) {
    this.view = view;
  }

  async addStory(formData) {
    try {
      this.view.showLoading();
      
      try {
        await storyAPI.addStory(formData);
        this.view.showSuccess('Cerita berhasil ditambahkan!');
        
        setTimeout(() => {
          window.location.hash = '#/';
        }, 2000);
      } catch (onlineError) {
        console.log('Offline mode detected, saving for background sync');
        await this.saveOfflineStory(formData);
        this.view.showSuccess('Cerita disimpan offline. Akan dikirim otomatis saat online.');
        
        if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('sync-stories');
          console.log('Background sync registered');
        }
        
        setTimeout(() => {
          window.location.hash = '#/';
        }, 2000);
      }
    } catch (error) {
      this.view.showError(error.message);
    } finally {
      this.view.hideLoading();
    }
  }

  async saveOfflineStory(formData) {
    const description = formData.get('description');
    const lat = parseFloat(formData.get('lat'));
    const lon = parseFloat(formData.get('lon'));
    const photo = formData.get('photo');
    
    let photoBase64 = null;
    if (photo && photo instanceof File) {
      photoBase64 = await this.fileToBase64(photo);
    }

    const offlineStory = {
      description,
      lat,
      lon,
      photo: photoBase64,
      token: authAPI.getToken(),
    };

    await indexedDBHelper.addOfflineStory(offlineStory);
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
}

export default class AddStoryPage {
  constructor() {
    this.presenter = new AddStoryPresenter(this);
    this.map = null;
    this.selectedLat = null;
    this.selectedLon = null;
    this.selectedMarker = null;
    this.mediaStream = null;
    this.isUsingCamera = false;
  }

  async render() {
    if (!authAPI.isAuthenticated()) {
      window.location.hash = '#/login';
      return '';
    }

    return `
      <section class="add-story-container">
        <div class="add-story-card">
          <h1>Tambah Cerita Baru</h1>
          
          <form id="add-story-form" class="story-form">
            <div class="form-group">
              <label for="story-name">Judul Cerita <span class="required">*</span></label>
              <input 
                type="text" 
                id="story-name" 
                name="description" 
                required 
                aria-required="true"
                placeholder="Masukkan judul cerita"
                minlength="3"
              />
              <small>Minimal 3 karakter</small>
            </div>

            <div class="form-group">
              <label for="story-description">Deskripsi <span class="required">*</span></label>
              <textarea 
                id="story-description" 
                name="description" 
                required 
                aria-required="true"
                rows="5"
                placeholder="Ceritakan pengalaman Anda..."
                minlength="10"
              ></textarea>
              <small>Minimal 10 karakter</small>
            </div>

            <div class="form-group">
              <label for="photo">Pilih Gambar <span class="required">*</span></label>
              <div class="image-options">
                <button type="button" id="btn-file-upload" class="btn-image-option active">
                  📁 Upload File
                </button>
                <button type="button" id="btn-camera" class="btn-image-option">
                  📷 Gunakan Kamera
                </button>
              </div>
            </div>

            <div id="file-upload-container" class="form-group">
              <input 
                type="file" 
                id="photo" 
                name="photo" 
                accept="image/*"
                aria-label="Pilih gambar untuk cerita"
              />
              <small>Format: JPG, PNG, atau GIF. Maksimal 1MB</small>
            </div>

            <div id="camera-container" class="camera-container" style="display: none;">
              <video id="camera-video" autoplay playsinline></video>
              <div class="camera-controls">
                <button type="button" id="btn-capture" class="btn-secondary">Ambil Foto</button>
                <button type="button" id="btn-close-camera" class="btn-danger">Tutup Kamera</button>
              </div>
              <canvas id="camera-canvas" style="display: none;"></canvas>
            </div>

            <div id="preview-container" class="preview-container" style="display: none;">
              <label>Preview Gambar:</label>
              <img id="image-preview" alt="Preview gambar yang akan diunggah" />
              <button type="button" id="btn-remove-image" class="btn-danger-small">Hapus Gambar</button>
            </div>

            <div class="form-group">
              <label>Pilih Lokasi di Peta <span class="required">*</span></label>
              <p class="help-text">Klik pada peta untuk memilih lokasi cerita Anda</p>
              <div id="add-story-map" role="application" aria-label="Peta untuk memilih lokasi cerita"></div>
              <div id="location-info" class="location-info" style="display: none;">
                <p>Lokasi dipilih: <strong id="location-display"></strong></p>
              </div>
            </div>

            <div id="error-message" class="error-message" role="alert" aria-live="polite"></div>
            <div id="success-message" class="success-message" role="alert" aria-live="polite"></div>

            <div class="form-actions">
              <button type="submit" class="btn-primary">
                <span id="submit-text">Tambahkan Cerita</span>
                <span id="loading-spinner" class="spinner" style="display: none;"></span>
              </button>
              <a href="#/" class="btn-secondary">Batal</a>
            </div>
          </form>
        </div>
      </section>
    `;
  }

  async afterRender() {
    this.initializeMap();
    this.setupForm();
    this.setupImageUpload();
    this.setupCamera();
  }

  initializeMap() {
    this.map = L.map('add-story-map').setView([-2.5, 118], 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.map.on('click', (e) => {
      this.selectLocation(e.latlng.lat, e.latlng.lng);
    });
  }

  selectLocation(lat, lon) {
    this.selectedLat = lat;
    this.selectedLon = lon;

    if (this.selectedMarker) {
      this.map.removeLayer(this.selectedMarker);
    }

    this.selectedMarker = L.marker([lat, lon]).addTo(this.map);
    
    document.getElementById('location-info').style.display = 'block';
    document.getElementById('location-display').textContent = 
      `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }

  setupImageUpload() {
    const fileInput = document.getElementById('photo');
    const btnFileUpload = document.getElementById('btn-file-upload');
    const btnCamera = document.getElementById('btn-camera');
    const fileUploadContainer = document.getElementById('file-upload-container');
    const cameraContainer = document.getElementById('camera-container');

    btnFileUpload.addEventListener('click', () => {
      this.isUsingCamera = false;
      fileUploadContainer.style.display = 'block';
      cameraContainer.style.display = 'none';
      btnFileUpload.classList.add('active');
      btnCamera.classList.remove('active');
      this.closeCamera();
    });

    btnCamera.addEventListener('click', () => {
      this.isUsingCamera = true;
      fileUploadContainer.style.display = 'none';
      cameraContainer.style.display = 'block';
      btnFileUpload.classList.remove('active');
      btnCamera.classList.add('active');
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.validateAndPreviewImage(file);
      }
    });

    document.getElementById('btn-remove-image')?.addEventListener('click', () => {
      this.clearImagePreview();
    });
  }

  setupCamera() {
    const btnCapture = document.getElementById('btn-capture');
    const btnCloseCamera = document.getElementById('btn-close-camera');
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');

    btnCapture.addEventListener('click', async () => {
      if (this.mediaStream) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          this.validateAndPreviewImage(file);
          this.closeCamera();
        }, 'image/jpeg');
      }
    });

    btnCloseCamera.addEventListener('click', () => {
      this.closeCamera();
    });
  }

  async openCamera() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      const video = document.getElementById('camera-video');
      video.srcObject = this.mediaStream;
    } catch (error) {
      this.showError('Tidak dapat mengakses kamera: ' + error.message);
    }
  }

  closeCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
      const video = document.getElementById('camera-video');
      video.srcObject = null;
    }
  }

  validateAndPreviewImage(file) {
    if (file.size > 1024 * 1024) {
      this.showError('Ukuran file terlalu besar. Maksimal 1MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.showError('File harus berupa gambar');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('image-preview');
      preview.src = e.target.result;
      document.getElementById('preview-container').style.display = 'block';
    };
    reader.readAsDataURL(file);

    this.selectedFile = file;
  }

  clearImagePreview() {
    document.getElementById('preview-container').style.display = 'none';
    document.getElementById('photo').value = '';
    this.selectedFile = null;
  }

  setupForm() {
    const form = document.getElementById('add-story-form');
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const cameraContainer = document.getElementById('camera-container');
          if (cameraContainer.style.display !== 'none' && !this.mediaStream) {
            this.openCamera();
          }
        }
      });
    });

    observer.observe(document.getElementById('camera-container'), { attributes: true });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!this.selectedLat || !this.selectedLon) {
        this.showError('Silakan pilih lokasi di peta');
        return;
      }

      const photoFile = this.selectedFile || document.getElementById('photo').files[0];
      if (!photoFile) {
        this.showError('Silakan pilih gambar');
        return;
      }

      const description = document.getElementById('story-name').value;
      const storyDescription = document.getElementById('story-description').value;

      const formData = new FormData();
      formData.append('description', description + ' - ' + storyDescription);
      formData.append('photo', photoFile);
      formData.append('lat', this.selectedLat);
      formData.append('lon', this.selectedLon);

      await this.presenter.addStory(formData);
    });
  }

  showLoading() {
    document.getElementById('submit-text').style.display = 'none';
    document.getElementById('loading-spinner').style.display = 'inline-block';
    document.querySelector('.btn-primary').disabled = true;
  }

  hideLoading() {
    document.getElementById('submit-text').style.display = 'inline';
    document.getElementById('loading-spinner').style.display = 'none';
    document.querySelector('.btn-primary').disabled = false;
  }

  showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    document.getElementById('success-message').style.display = 'none';
    
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }

  showSuccess(message) {
    const successElement = document.getElementById('success-message');
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    document.getElementById('error-message').style.display = 'none';
  }
}
