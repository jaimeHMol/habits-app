// For local execution
// const BASE_URL = 'http://localhost:8000';
// const API_URL = `${BASE_URL}/tasks/`;

const BASE_URL = ''; 
const API_URL = `/tasks/`;

// Helper function to dynamically attach the JWT token if it exists
const getHeaders = () => {
  const token = localStorage.getItem('habit_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Helper function to handle 401 Unauthorized responses
const handleResponse = async (response) => {
  if (response.status === 401) {
    localStorage.removeItem('habit_token');
    window.location.reload(); // Force reload to clear state and show login
    throw new Error('Session expired');
  }
  if (!response.ok) throw new Error('API request failed');
  return response.status !== 204 ? response.json() : true;
};

export const taskApi = {
  login: async (username, password) => {
    // FastAPI OAuth2 strictly expects form-urlencoded data, not a JSON payload
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (!response.ok) throw new Error('Invalid credentials');
    return response.json();
  },

  getAll: async () => {
    const response = await fetch(API_URL, { headers: getHeaders() });
    const data = await handleResponse(response);
    
    // Map backend snake_case to frontend camelCase
    return data.map(task => ({
      ...task,
      columnId: task.column_id,
      targetDay: task.target_day,
      targetMonth: task.target_month,
      isCollapsed: task.is_collapsed
    }));
  },

  create: async (taskData) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(taskData),
    });
    return handleResponse(response);
  },

  update: async (taskId, taskData) => {
    const response = await fetch(`${API_URL}${taskId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(taskData),
    });
    return handleResponse(response);
  },

  delete: async (taskId) => {
    const response = await fetch(`${API_URL}${taskId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  toggleComplete: async (taskId) => {
    const response = await fetch(`${API_URL}${taskId}/complete`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  reorderColumn: async (columnId, taskIds) => {
    const response = await fetch(`${BASE_URL}/tasks/reorder/column`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ column_id: columnId, task_ids: taskIds }),
    });
    return handleResponse(response);
  }
};