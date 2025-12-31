import authAPI from './auth-api';

const BASE_URL = 'https://story-api.dicoding.dev/v1';

class StoryAPI {
  async getStories() {
    const response = await fetch(`${BASE_URL}/stories`, {
      headers: {
        'Authorization': `Bearer ${authAPI.getToken()}`,
      },
    });

    const responseJson = await response.json();
    
    if (!response.ok) {
      throw new Error(responseJson.message);
    }

    return responseJson.listStory;
  }

  async addStory(formData) {
    const response = await fetch(`${BASE_URL}/stories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authAPI.getToken()}`,
      },
      body: formData,
    });

    const responseJson = await response.json();
    
    if (!response.ok) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }
}

export default new StoryAPI();
