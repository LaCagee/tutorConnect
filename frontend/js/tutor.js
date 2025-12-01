// frontend/js/tutor.js
//const API_URL = 'http://localhost:3000/api';

let currentUser = null;

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación
  if (!requireAuth()) return;

  currentUser = getCurrentUser();
  
  // Verificar que sea tutor
  if (currentUser.rol !== 'tutor') {
    window.location.href = 'estudiante.html';
    return;
  }

  // Mostrar nombre del usuario
  document.getElementById('userName').textContent = currentUser.nombre;

  // Cargar datos
  cargarMisSesiones();
  cargarEstadisticas();

  // Event listeners
  document.getElementById('logoutBtn').addEventListener('click', logout);
});

// ========== CARGAR SESIONES DEL TUTOR ==========

async function cargarMisSesiones() {
  try {
    const response = await fetch(`${API_URL}/sessions?tutorId=${currentUser.id}`, {
      headers: getAuthHeaders()
    });
    const sesiones = await response.json();

    const tbody = document.getElementById('sesionesTableBody');
    tbody.innerHTML = '';

    if (sesiones.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No tienes sesiones aún.</td></tr>';
      return;
    }

    sesiones.forEach(sesion => {
      const tr = crearSesionRow(sesion);
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error cargando sesiones:', error);
  }
}

function crearSesionRow(sesion) {
  const tr = document.createElement('tr');

  const estadoBadge = {
    'pendiente': '<span class="badge badge-pending">Pendiente</span>',
    'confirmada': '<span class="badge badge-confirmed">Confirmada</span>',
    'completada': '<span class="badge badge-completed">Completada</span>',
    'cancelada': '<span class="badge badge-cancelled">Cancelada</span>'
  };

  let acciones = '';
  
  if (sesion.estado === 'pendiente') {
    acciones = `
      <button class="btn btn-secondary btn-small" onclick="confirmarSesion(${sesion.id})">Confirmar</button>
      <button class="btn btn-danger btn-small" onclick="cancelarSesion(${sesion.id})">Cancelar</button>
    `;
  } else if (sesion.estado === 'confirmada') {
    acciones = `
      <button class="btn btn-primary btn-small" onclick="completarSesion(${sesion.id})">Completar</button>
      <button class="btn btn-danger btn-small" onclick="cancelarSesion(${sesion.id})">Cancelar</button>
    `;
  } else {
    acciones = '-';
  }

  tr.innerHTML = `
    <td>Estudiante #${sesion.estudianteId}</td>
    <td>${sesion.asignatura}</td>
    <td>${sesion.fecha}</td>
    <td>${sesion.hora}</td>
    <td>${estadoBadge[sesion.estado]}</td>
    <td class="flex gap-10">${acciones}</td>
  `;

  return tr;
}

// ========== ACCIONES DE SESIONES ==========

async function confirmarSesion(sessionId) {
  if (!confirm('¿Confirmar esta sesión?')) return;

  try {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/confirm`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Error confirmando sesión');
    }

    alert('✅ Sesión confirmada exitosamente');
    cargarMisSesiones();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

async function completarSesion(sessionId) {
  if (!confirm('¿Marcar esta sesión como completada? Se enviará una notificación al estudiante.')) return;

  try {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/complete`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Error completando sesión');
    }

    alert('✅ Sesión completada. El estudiante podrá dejarte una valoración.');
    cargarMisSesiones();
    
    // Recargar estadísticas después de un momento
    setTimeout(() => {
      cargarEstadisticas();
    }, 1000);
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

async function cancelarSesion(sessionId) {
  if (!confirm('¿Estás seguro de cancelar esta sesión?')) return;

  try {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/cancel`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Error cancelando sesión');
    }

    alert('✅ Sesión cancelada');
    cargarMisSesiones();
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// ========== CARGAR ESTADÍSTICAS ==========

async function cargarEstadisticas() {
  try {
    const userResponse = await fetch(`${API_URL}/users/${currentUser.id}`);
    const userData = await userResponse.json();

    // Convertir rating a número seguro
    const ratingNum = Number(userData.rating);
    const ratingFormateado = !isNaN(ratingNum) ? ratingNum.toFixed(2) : "N/A";

    // Actualizar estadísticas
    document.getElementById('statRating').textContent = ratingFormateado;
    document.getElementById('statTotal').textContent = userData.totalReviews ?? 0;

    // Obtener reviews
    const reviewsResponse = await fetch(`${API_URL}/reviews?tutorId=${currentUser.id}`);
    const reviews = await reviewsResponse.json();

    // Obtener sesiones completadas
    const sessionsResponse = await fetch(`${API_URL}/sessions?tutorId=${currentUser.id}`, {
      headers: getAuthHeaders()
    });
    const sessions = await sessionsResponse.json();

    const completadas = sessions.filter(s => s.estado === 'completada').length;
    document.getElementById('statSesiones').textContent = completadas;

    // Mostrar últimas 3 reviews
    mostrarUltimasReviews(reviews.slice(0, 3));

  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}


function mostrarUltimasReviews(reviews) {
  const container = document.getElementById('reviewsContainer');
  container.innerHTML = '';

  if (reviews.length === 0) {
    container.innerHTML = '<p class="text-center">Aún no tienes valoraciones.</p>';
    return;
  }

  reviews.forEach(review => {
    const div = document.createElement('div');
    div.className = 'review-item';

    const estrellas = '⭐'.repeat(review.rating);
    const fecha = new Date(review.createdAt).toLocaleDateString('es-CL');

    div.innerHTML = `
      <div class="review-rating">${estrellas} (${review.rating}/5)</div>
      ${review.comentario ? `<div class="review-comment">"${review.comentario}"</div>` : '<div class="review-comment">Sin comentario</div>'}
      <div class="review-date">${fecha}</div>
    `;

    container.appendChild(div);
  });
}