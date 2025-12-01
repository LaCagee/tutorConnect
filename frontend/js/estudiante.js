// frontend/js/estudiante.js
//const API_URL = 'http://localhost:3000/api';

let currentUser = null;
let selectedTutorForBooking = null;
let selectedSessionForReview = null;

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticación
    if (!requireAuth()) return;

    currentUser = getCurrentUser();

    // Verificar que sea estudiante
    if (currentUser.rol !== 'estudiante') {
        window.location.href = 'tutor.html';
        return;
    }

    // Mostrar nombre del usuario
    document.getElementById('userName').textContent = currentUser.nombre;

    // Cargar datos
    cargarTutores();
    cargarMisSesiones();

    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('bookingForm').addEventListener('submit', crearSesion);
    document.getElementById('reviewForm').addEventListener('submit', crearReview);
});

// ========== CARGAR TUTORES ==========

async function cargarTutores() {
    try {
        const response = await fetch(`${API_URL}/tutors`);
        const tutores = await response.json();

        const container = document.getElementById('tutoresContainer');
        container.innerHTML = '';

        if (tutores.length === 0) {
            container.innerHTML = '<p class="text-center">No hay tutores disponibles aún.</p>';
            return;
        }

        tutores.forEach(tutor => {
            const card = crearTutorCard(tutor);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error cargando tutores:', error);
    }
}

function crearTutorCard(tutor) {
    const card = document.createElement('div');
    card.className = 'tutor-card';

    const avatar = 'img/avatar-male.png';

    // Convertir rating a número
    const ratingNum = Number(tutor.rating);

    // Mostrar estrellas o "Sin valoraciones"
    const rating =
        !isNaN(ratingNum) && ratingNum > 0
            ? '⭐'.repeat(Math.round(ratingNum))
            : 'Sin valoraciones';

    // Formato de rating (1 decimal) o evitar error
    const ratingFormato =
        !isNaN(ratingNum) ? ratingNum.toFixed(1) : 'N/A';

    const asignaturas = tutor.asignaturas?.join(', ') || 'N/A';

    card.innerHTML = `
    <img src="${avatar}" alt="${tutor.nombre}" class="tutor-avatar">
    <div class="tutor-name">${tutor.nombre}</div>
    <div class="tutor-rating">${rating} (${ratingFormato})</div>
    <div class="tutor-subjects">${asignaturas}</div>
    <div class="tutor-price">$${parseInt(tutor.precioPorHora).toLocaleString('es-CL')}/hora</div>
    ${tutor.bio ? `<p style="font-size: 12px; color: #64748b; margin: 10px 0;">${tutor.bio.substring(0, 60)}...</p>` : ''}
    <button class="btn btn-primary btn-small" onclick="abrirModalAgendar(${tutor.id}, '${tutor.nombre}', ${tutor.precioPorHora})">
      Agendar Tutoría
    </button>
  `;

    return card;
}


// ========== CARGAR MIS SESIONES ==========

async function cargarMisSesiones() {
    try {
        const response = await fetch(`${API_URL}/sessions?estudianteId=${currentUser.id}`, {
            headers: getAuthHeaders()
        });
        const sesiones = await response.json();

        const tbody = document.getElementById('sesionesTableBody');
        tbody.innerHTML = '';

        if (sesiones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No tienes sesiones agendadas.</td></tr>';
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

    tr.innerHTML = `
    <td>Tutor #${sesion.tutorId}</td>
    <td>${sesion.asignatura}</td>
    <td>${sesion.fecha}</td>
    <td>${sesion.hora}</td>
    <td>${estadoBadge[sesion.estado]}</td>
    <td>
      ${sesion.estado === 'completada'
            ? `<button class="btn btn-secondary btn-small" onclick="abrirModalReview(${sesion.id}, ${sesion.tutorId})">Valorar</button>`
            : '-'}
    </td>
  `;

    return tr;
}

// ========== MODAL AGENDAR SESIÓN ==========

function abrirModalAgendar(tutorId, tutorNombre, precio) {
    selectedTutorForBooking = { id: tutorId, nombre: tutorNombre, precio: precio };

    document.getElementById('tutorSeleccionado').textContent = tutorNombre;
    document.getElementById('precioSeleccionado').textContent = `$${parseInt(precio).toLocaleString('es-CL')}/hora`;
    document.getElementById('bookingModal').classList.add('active');
}

function cerrarModalAgendar() {
    document.getElementById('bookingModal').classList.remove('active');
    document.getElementById('bookingForm').reset();
    selectedTutorForBooking = null;
}

async function crearSesion(e) {
    e.preventDefault();

    const asignatura = document.getElementById('asignatura').value;
    const fecha = document.getElementById('fecha').value;
    const hora = document.getElementById('hora').value;
    const modalidad = document.getElementById('modalidad').value;
    const notas = document.getElementById('notas').value;

    const sessionData = {
        tutorId: selectedTutorForBooking.id,
        estudianteId: currentUser.id,
        asignatura,
        fecha,
        hora,
        precio: selectedTutorForBooking.precio,
        modalidad,
        notas
    };

    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(sessionData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error creando sesión');
        }

        alert('✅ Sesión agendada exitosamente. El tutor recibirá una notificación por email.');
        cerrarModalAgendar();
        cargarMisSesiones();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ========== MODAL VALORAR SESIÓN ==========

let currentRating = 0;

function abrirModalReview(sessionId, tutorId) {
    selectedSessionForReview = { sessionId, tutorId };
    currentRating = 0;
    actualizarEstrellas(0);
    document.getElementById('reviewModal').classList.add('active');
}

function cerrarModalReview() {
    document.getElementById('reviewModal').classList.remove('active');
    document.getElementById('reviewForm').reset();
    selectedSessionForReview = null;
    currentRating = 0;
}

function setRating(rating) {
    currentRating = rating;
    actualizarEstrellas(rating);
}

function actualizarEstrellas(rating) {
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star${i}`);
        if (i <= rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    }
}

async function crearReview(e) {
    e.preventDefault();

    if (currentRating === 0) {
        alert('Por favor selecciona una calificación de 1 a 5 estrellas');
        return;
    }

    const comentario = document.getElementById('comentario').value;

    const reviewData = {
        sessionId: selectedSessionForReview.sessionId,
        tutorId: selectedSessionForReview.tutorId,
        estudianteId: currentUser.id,
        rating: currentRating,
        comentario
    };

    try {
        const response = await fetch(`${API_URL}/reviews`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(reviewData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error creando review');
        }

        alert('✅ Valoración enviada exitosamente. ¡Gracias por tu feedback!');
        cerrarModalReview();
        cargarMisSesiones();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}