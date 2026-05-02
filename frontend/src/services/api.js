// Dynamic BASE_URL: localhost for dev, relative path for production
const BASE_URL = import.meta.env.DEV ? 'http://localhost:8000' : '';
const API_URL = `${BASE_URL}/tasks/`;


// Helper function for headers
const getHeaders = () => {
  return {
    'Content-Type': 'application/json'
  };
};

// Helper function to handle 401 Unauthorized responses
const handleResponse = async (response) => {
  if (response.status === 401) {
    // Return null or throw a specific error that the UI can catch without reloading
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'API request failed');
  }
  return response.status !== 204 ? response.json() : true;
};

export const taskApi = {
  login: async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
      credentials: 'include' // Allow receiving the HttpOnly cookie
    });

    if (!response.ok) throw new Error('Invalid credentials');
    return response.json();
  },

  logout: async () => {
    const response = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    return handleResponse(response);
  },

  register: async (data) => {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        full_name: data.fullName,
        username: data.username,
        password: data.password,
        invitation_code: data.invitationCode
      }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  generateInvite: async () => {
    const response = await fetch(`${BASE_URL}/auth/invitations/generate`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  getAll: async () => {
    const response = await fetch(API_URL, { 
      headers: getHeaders(),
      credentials: 'include'
    });
    const data = await handleResponse(response);
    
    return data.map(task => ({
      ...task,
      columnId: task.column_id,
      targetDay: task.target_day,
      targetMonth: task.target_month,
      isCollapsed: task.is_collapsed,
      durationMinutes: task.duration_minutes,
      timerEndTime: task.timer_end_time,
      timerTriggered: task.timer_triggered,
      taskType: task.task_type,
      currentCount: task.current_count
    }));
  },

  create: async (taskData) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(taskData),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  update: async (taskId, taskData) => {
    const response = await fetch(`${API_URL}${taskId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        ...taskData,
        timer_end_time: taskData.timer_end_time,
        timer_triggered: taskData.timer_triggered
      }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  delete: async (taskId) => {
    const response = await fetch(`${API_URL}${taskId}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  toggleComplete: async (taskId, isRetroactive = false) => {
    const response = await fetch(`${API_URL}${taskId}/complete?is_retroactive=${isRetroactive}`, {
      method: 'PATCH',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  increment: async (taskId, isRetroactive = false) => {
    const response = await fetch(`${API_URL}${taskId}/increment?is_retroactive=${isRetroactive}`, {
      method: 'PATCH',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  decrement: async (taskId) => {
    const response = await fetch(`${API_URL}${taskId}/decrement`, {
      method: 'PATCH',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },


  reorderColumn: async (columnId, taskIds) => {
    const response = await fetch(`${BASE_URL}/tasks/reorder/column`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ column_id: columnId, task_ids: taskIds }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  resetDaily: async () => {
    const response = await fetch(`${BASE_URL}/tasks/reset-daily`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  resetMonthly: async () => {
    const response = await fetch(`${BASE_URL}/tasks/reset-monthly`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  resetAnnually: async () => {
    const response = await fetch(`${BASE_URL}/tasks/reset-annually`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // --- Reminders ---
  getReminders: async () => {
    const response = await fetch(`${BASE_URL}/reminders/`, { 
      headers: getHeaders(),
      credentials: 'include'
    });
    const data = await handleResponse(response);
    return data.map(r => ({
      ...r,
      intervalMinutes: r.interval_minutes,
      isActive: r.is_active
    }));
  },

  createReminder: async (reminderData) => {
    const response = await fetch(`${BASE_URL}/reminders/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title: reminderData.title,
        interval_minutes: reminderData.intervalMinutes,
        is_active: true
      }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  updateReminder: async (reminderId, reminderData) => {
    const response = await fetch(`${BASE_URL}/reminders/${reminderId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        title: reminderData.title,
        interval_minutes: reminderData.intervalMinutes,
        is_active: reminderData.isActive
      }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  deleteReminder: async (reminderId) => {
    const response = await fetch(`${BASE_URL}/reminders/${reminderId}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // --- User / Settings ---
  getMe: async () => {
    const response = await fetch(`${BASE_URL}/users/me`, { 
      headers: getHeaders(),
      credentials: 'include'
    });
    const data = await handleResponse(response);
    return {
      ...data,
      fullName: data.full_name,
      dayStartTime: data.day_start_time,
      dayEndTime: data.day_end_time
    };
  },

  updateSettings: async (settings) => {
    const response = await fetch(`${BASE_URL}/users/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        day_start_time: settings.dayStartTime,
        day_end_time: settings.dayEndTime,
        language: settings.language
      }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  confirmReset: async (dateStr) => {
    const response = await fetch(`${BASE_URL}/users/confirm-reset`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ date_str: dateStr }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  // --- Push Notifications ---
  getVapidPublicKey: async () => {
    const response = await fetch(`${BASE_URL}/push/vapid-public-key`, {
      credentials: 'include'
    });
    return handleResponse(response);
  },

  subscribePush: async (subscription) => {
    // subscription is the PushSubscription object from the browser
    const p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh'))));
    const auth = btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))));
    
    const response = await fetch(`${BASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: p256dh,
        auth: auth
      }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  unsubscribePush: async (subscription) => {
    const response = await fetch(`${BASE_URL}/push/unsubscribe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: '', // Not needed for delete
        auth: ''
      }),
      credentials: 'include'
    });
    return handleResponse(response);
  }
};
