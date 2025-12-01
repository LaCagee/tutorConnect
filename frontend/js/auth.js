// frontend/js/auth.js

const API_URL = 'http://localhost:3000/api';

// ========== FUNCIONES DE AUTENTICACIÓN ==========

// Registrar usuario
async function register(userData) {
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en el registro');
    }

    return data;
  } catch (error) {
    throw error;
  }
}

// Iniciar sesión
async function login(email, password) {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error en el login');
    }

    // Guardar token y datos del usuario
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
  } catch (error) {
    throw error;
  }
}

// Cerrar sesión
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// Obtener usuario actual
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Obtener token
function getToken() {
  return localStorage.getItem('token');
}

// Verificar si está autenticado
function isAuthenticated() {
  return !!getToken();
}

// Verificar autenticación y redirigir si es necesario
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// Redirigir según el rol del usuario
function redirectByRole() {
  const user = getCurrentUser();
  if (!user) return;

  if (user.rol === 'estudiante') {
    window.location.href = 'estudiante.html';
  } else if (user.rol === 'tutor') {
    window.location.href = 'tutor.html';
  }
}

// Headers con autenticación para fetch
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

// ========== UTILIDADES ==========

// Mostrar mensajes de error
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.className = 'alert alert-error';
    element.style.display = 'block';
  }
}

// Mostrar mensajes de éxito
function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.className = 'alert alert-success';
    element.style.display = 'block';
  }
}

// Limpiar mensajes
function clearMessages(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = 'none';
    element.textContent = '';
  }
}