const DB_NAME = 'StoryAppDB';
const DB_VERSION = 1;

class IndexedDBHelper {
  constructor() {
    this.db = null;
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('favorites')) {
          const favStore = db.createObjectStore('favorites', { keyPath: 'id' });
          favStore.createIndex('createdAt', 'createdAt', { unique: false });
          favStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('offline-stories')) {
          const offlineStore = db.createObjectStore('offline-stories', { keyPath: 'id', autoIncrement: true });
          offlineStore.createIndex('createdAt', 'createdAt', { unique: false });
          offlineStore.createIndex('synced', 'synced', { unique: false });
        }

        console.log('IndexedDB upgraded to version', DB_VERSION);
      };
    });
  }

  async getDB() {
    if (!this.db) {
      await this.openDB();
    }
    return this.db;
  }

  // FAVORITES METHODS
  async addFavorite(story) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['favorites'], 'readwrite');
      const store = transaction.objectStore('favorites');
      
      const favoriteData = {
        ...story,
        favoritedAt: new Date().toISOString(),
      };

      const request = store.add(favoriteData);

      request.onsuccess = () => {
        console.log('Story added to favorites');
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to add to favorites:', request.error);
        reject(request.error);
      };
    });
  }

  async removeFavorite(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['favorites'], 'readwrite');
      const store = transaction.objectStore('favorites');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Story removed from favorites');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to remove from favorites:', request.error);
        reject(request.error);
      };
    });
  }

  async getAllFavorites() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['favorites'], 'readonly');
      const store = transaction.objectStore('favorites');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getFavoriteById(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['favorites'], 'readonly');
      const store = transaction.objectStore('favorites');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async isFavorite(id) {
    const favorite = await this.getFavoriteById(id);
    return favorite !== undefined;
  }

  async searchFavorites(query) {
    const favorites = await this.getAllFavorites();
    const lowercaseQuery = query.toLowerCase();
    
    return favorites.filter(story => 
      story.name?.toLowerCase().includes(lowercaseQuery) ||
      story.description?.toLowerCase().includes(lowercaseQuery)
    );
  }

  async sortFavorites(sortBy = 'createdAt', order = 'desc') {
    const favorites = await this.getAllFavorites();
    
    return favorites.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'createdAt' || sortBy === 'favoritedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  // OFFLINE STORIES METHODS
  async addOfflineStory(storyData) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline-stories'], 'readwrite');
      const store = transaction.objectStore('offline-stories');
      
      const offlineData = {
        ...storyData,
        createdAt: new Date().toISOString(),
        synced: false,
      };

      const request = store.add(offlineData);

      request.onsuccess = () => {
        console.log('Story saved offline');
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to save story offline:', request.error);
        reject(request.error);
      };
    });
  }

  async getAllOfflineStories() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline-stories'], 'readonly');
      const store = transaction.objectStore('offline-stories');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async getUnsyncedStories() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline-stories'], 'readonly');
      const store = transaction.objectStore('offline-stories');
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async markStorySynced(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline-stories'], 'readwrite');
      const store = transaction.objectStore('offline-stories');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const story = getRequest.result;
        if (story) {
          story.synced = true;
          story.syncedAt = new Date().toISOString();
          const updateRequest = store.put(story);

          updateRequest.onsuccess = () => {
            resolve();
          };

          updateRequest.onerror = () => {
            reject(updateRequest.error);
          };
        } else {
          resolve();
        }
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  async deleteOfflineStory(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['offline-stories'], 'readwrite');
      const store = transaction.objectStore('offline-stories');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Offline story deleted');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async clearAllFavorites() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['favorites'], 'readwrite');
      const store = transaction.objectStore('favorites');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('All favorites cleared');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

export default new IndexedDBHelper();
