/**
 * Aura Hotel - Frontend Unificado de Microservicios
 * Orquestación integral: Habitaciones (:8001), Huéspedes (:8082), Alquileres (:3003)
 */

const API = {
  habitaciones: 'http://localhost:8001',
  huespedes: 'http://localhost:8082',
  alquileres: 'http://localhost:3003'
};

// Global State Cache
let state = {
  habitaciones: [],
  huespedes: [],
  alquileres: [],
  filtroHabitaciones: 'todas',
  filtroAlquileres: 'todos',
  soloHuespedesActivos: true,
  busquedaHuesped: ''
};

// ==========================================
// Initializer & Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFormCalculations();
  initForms();
  initFilters();
  
  // Initial Data Load & Health Check
  refreshAll();
  
  // Periodic background health check (every 15s)
  setInterval(() => checkAllServicesHealth(false), 15000);
});

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      switchTab(tab);
    });
  });

  document.getElementById('btn-refresh-all').addEventListener('click', () => {
    const btn = document.getElementById('btn-refresh-all');
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform 0.5s ease';
    refreshAll().then(() => {
      setTimeout(() => { btn.style.transform = 'none'; btn.style.transition = 'none'; }, 500);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.content-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${tabId}`);
  });

  const titles = {
    dashboard: { title: 'Dashboard General', subtitle: 'Monitoreo y orquestación integral de la plataforma hotelera' },
    alquileres: { title: 'Gestión de Alquileres', subtitle: 'Orquestador central de contratos (RN01, RN02, RN03, RN05)' },
    habitaciones: { title: 'Catálogo de Habitaciones', subtitle: 'Microservicio de Habitaciones (FastAPI + MySQL :8001)' },
    huespedes: { title: 'Directorio de Huéspedes', subtitle: 'Microservicio de Huéspedes (Spring Boot + SQL Server :8082)' },
    monitor: { title: 'Monitor de Microservicios', subtitle: 'Estado de salud, latencia y arquitectura distribuida en vivo' }
  };

  if (titles[tabId]) {
    document.getElementById('view-title').textContent = titles[tabId].title;
    document.getElementById('view-subtitle').textContent = titles[tabId].subtitle;
  }
}

// ==========================================
// Toast System
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span style="font-weight:bold">${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================
// Health Monitoring
// ==========================================
async function checkServiceHealth(name, url, pillId, statusId, pingId) {
  const start = performance.now();
  const pill = document.getElementById(pillId);
  const statusElem = document.getElementById(statusId);
  const pingElem = pingId ? document.getElementById(pingId) : null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const latency = Math.round(performance.now() - start);
    
    if (res.ok || res.status < 500) {
      if (pill) { pill.className = 'status-pill online'; }
      if (statusElem) {
        statusElem.className = 'badge badge-disponible';
        statusElem.textContent = 'ONLINE';
      }
      if (pingElem) { pingElem.textContent = `${latency} ms`; }
      return true;
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    if (pill) { pill.className = 'status-pill offline'; }
    if (statusElem) {
      statusElem.className = 'badge badge-ocupada';
      statusElem.textContent = 'OFFLINE';
    }
    if (pingElem) { pingElem.textContent = 'Timeout'; }
    return false;
  }
}

async function checkAllServicesHealth(notify = false) {
  const [h1, h2, h3] = await Promise.all([
    checkServiceHealth('habitaciones', `${API.habitaciones}/health`, 'pill-habitaciones', 'status-text-hab', 'ping-hab'),
    checkServiceHealth('huespedes', `${API.huespedes}/api/huespedes?soloActivos=true`, 'pill-huespedes', 'status-text-hue', 'ping-hue'),
    checkServiceHealth('alquileres', `${API.alquileres}/health`, 'pill-alquileres', 'status-text-alq', 'ping-alq')
  ]);

  const monHab = document.getElementById('mon-status-hab');
  const monHue = document.getElementById('mon-status-hue');
  const monAlq = document.getElementById('mon-status-alq');
  if (monHab) { monHab.className = h1 ? 'badge badge-disponible' : 'badge badge-ocupada'; monHab.textContent = h1 ? 'ONLINE' : 'OFFLINE'; }
  if (monHue) { monHue.className = h2 ? 'badge badge-disponible' : 'badge badge-ocupada'; monHue.textContent = h2 ? 'ONLINE' : 'OFFLINE'; }
  if (monAlq) { monAlq.className = h3 ? 'badge badge-disponible' : 'badge badge-ocupada'; monAlq.textContent = h3 ? 'ONLINE' : 'OFFLINE'; }

  if (notify) {
    if (h1 && h2 && h3) {
      showToast('Los 3 microservicios están conectados y respondiendo.', 'success');
    } else {
      showToast('Atención: Algunos microservicios no responden. Revisa los puertos.', 'error');
    }
  }
}

// ==========================================
// Data Fetching & Sync
// ==========================================
async function refreshAll() {
  await Promise.allSettled([
    loadHabitaciones(),
    loadHuespedes(),
    loadAlquileres(),
    checkAllServicesHealth()
  ]);
  updateDashboardKPIs();
}

// 1. Habitaciones (:8001)
async function loadHabitaciones() {
  try {
    const res = await fetch(`${API.habitaciones}/api/habitaciones`);
    if (!res.ok) throw new Error('Error al consultar habitaciones');
    state.habitaciones = await res.json();
    renderHabitaciones();
  } catch (err) {
    console.error(err);
  }
}

// 2. Huéspedes (:8082)
async function loadHuespedes() {
  try {
    const url = `${API.huespedes}/api/huespedes?soloActivos=${state.soloHuespedesActivos}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al consultar huéspedes');
    const responseJson = await res.json();
    
    // Desempaquetar ApiResponse<T> de Spring Boot
    state.huespedes = responseJson.data || responseJson;
    renderHuespedes();
  } catch (err) {
    console.error(err);
  }
}

// 3. Alquileres (:3003)
async function loadAlquileres() {
  try {
    const res = await fetch(`${API.alquileres}/api/alquileres`);
    if (!res.ok) throw new Error('Error al consultar alquileres');
    state.alquileres = await res.json();
    renderAlquileres();
    renderDashboardRecentAlquileres();
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// Dashboard View
// ==========================================
function updateDashboardKPIs() {
  const vigentes = state.alquileres.filter(a => a.estado === 'vigente').length;
  const disponibles = state.habitaciones.filter(h => h.estado === 'Disponible').length;
  const ocupadas = state.habitaciones.filter(h => h.estado === 'Ocupada').length;
  const totalHab = state.habitaciones.length;
  const huespedesActivos = state.huespedes.filter(h => h.estadoLogico === true).length;

  document.getElementById('kpi-alquileres-vigentes').textContent = vigentes;
  document.getElementById('kpi-hab-disponibles').textContent = disponibles;
  document.getElementById('kpi-hab-total-desc').textContent = `De un total de ${totalHab} registradas`;
  document.getElementById('kpi-hab-ocupadas').textContent = ocupadas;
  document.getElementById('kpi-huespedes-activos').textContent = huespedesActivos;
}

function renderDashboardRecentAlquileres() {
  const tbody = document.querySelector('#tabla-dashboard-alquileres tbody');
  const recent = state.alquileres.slice(-5).reverse();

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay alquileres registrados aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(alq => {
    const habDesc = alq.habitacion_detalle ? `Hab. ${alq.habitacion_detalle.numero}` : `Hab. ID ${alq.habitacion_id}`;
    const hueDesc = alq.huesped_detalle ? `${alq.huesped_detalle.nombres} ${alq.huesped_detalle.apellidos}` : `Huésped ID ${alq.huesped_id}`;
    const badgeClass = alq.estado === 'vigente' ? 'badge-vigente' : alq.estado === 'finalizado' ? 'badge-finalizado' : 'badge-cancelado';

    return `
      <tr>
        <td><strong>#${alq.id}</strong></td>
        <td>${hueDesc}</td>
        <td>${habDesc}</td>
        <td>${alq.fecha_inicio} &rarr; ${alq.fecha_fin || 'Vigente'}</td>
        <td><strong>S/. ${Number(alq.monto).toFixed(2)}</strong></td>
        <td><span class="badge ${badgeClass}">${alq.estado.toUpperCase()}</span></td>
        <td>
          ${alq.estado === 'vigente' ? `
            <button class="btn-action btn-finish" onclick="finalizarAlquiler(${alq.id})" title="RN03: Libera habitación a Disponible">
              Finalizar
            </button>
          ` : '<span class="text-muted">-</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================
// Habitaciones Rendering & Actions
// ==========================================
function renderHabitaciones() {
  const container = document.getElementById('grid-habitaciones');
  let list = state.habitaciones;

  if (state.filtroHabitaciones !== 'todas') {
    list = list.filter(h => h.estado.toLowerCase() === state.filtroHabitaciones.toLowerCase());
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="glass-panel" style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">
      No se encontraron habitaciones con el filtro actual.
    </div>`;
    return;
  }

  container.innerHTML = list.map(hab => {
    const badgeClass = hab.estado === 'Disponible' ? 'badge-disponible' : hab.estado === 'Ocupada' ? 'badge-ocupada' : 'badge-mantenimiento';
    const isOccupied = hab.estado === 'Ocupada';

    return `
      <div class="room-card">
        <div class="room-header">
          <div>
            <span class="room-number">Hab. ${hab.numero}</span>
            <span class="room-piso">Piso ${hab.piso}</span>
          </div>
          <span class="badge ${badgeClass}">${hab.estado}</span>
        </div>

        <p class="room-desc">${hab.descripcion || 'Sin descripción adicional.'}</p>

        <div class="room-footer">
          <div class="room-price">
            S/. ${Number(hab.precio).toFixed(2)} <small>/ noche</small>
          </div>
          
          <div class="room-actions">
            ${!isOccupied ? `
              <button class="btn-action" onclick="toggleMantenimientoHabitacion(${hab.id}, '${hab.estado}')" title="Alternar mantenimiento">
                ${hab.estado === 'Disponible' ? '🔧 Mant.' : '✓ Lib.'}
              </button>
              <button class="btn-action btn-cancel" onclick="eliminarHabitacion(${hab.id})" title="Eliminar habitación">
                🗑
              </button>
            ` : `
              <span class="badge badge-ocupada" style="font-size:0.68rem;" title="Controlado por Alquileres">En Alquiler</span>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleMantenimientoHabitacion(id, estadoActual) {
  const nuevoEstado = estadoActual === 'En Mantenimiento' ? 'Disponible' : 'En Mantenimiento';
  try {
    const res = await fetch(`${API.habitaciones}/api/habitaciones/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al cambiar estado');
    }
    showToast(`Habitación ${id} actualizada a: ${nuevoEstado}`, 'success');
    await loadHabitaciones();
    updateDashboardKPIs();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function eliminarHabitacion(id) {
  if (!confirm(`¿Estás seguro de eliminar la habitación ID ${id}?`)) return;
  try {
    const res = await fetch(`${API.habitaciones}/api/habitaciones/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'No se pudo eliminar');
    }
    showToast('Habitación eliminada correctamente', 'success');
    await loadHabitaciones();
    updateDashboardKPIs();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==========================================
// Huéspedes Rendering & Actions
// ==========================================
function renderHuespedes() {
  const tbody = document.querySelector('#tabla-huespedes tbody');
  let list = state.huespedes;

  if (state.busquedaHuesped.trim() !== '') {
    const query = state.busquedaHuesped.toLowerCase();
    list = list.filter(h => 
      h.dni?.toLowerCase().includes(query) ||
      h.nombres?.toLowerCase().includes(query) ||
      h.apellidos?.toLowerCase().includes(query) ||
      h.email?.toLowerCase().includes(query)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No se encontraron huéspedes registrados.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(hue => {
    const isActivo = hue.estadoLogico === true;
    const badgeClass = isActivo ? 'badge-activo' : 'badge-inactivo';

    return `
      <tr>
        <td><strong>#${hue.id}</strong></td>
        <td>
          <strong>${hue.nombres} ${hue.apellidos}</strong>
          <br><small class="text-dim">${hue.nacionalidad || 'Peruana'}</small>
        </td>
        <td><code>${hue.dni}</code></td>
        <td>
          ${hue.tel ? `📞 ${hue.tel}<br>` : ''}
          <small class="text-muted">✉ ${hue.email || 'Sin correo'}</small>
        </td>
        <td>
          <small>${hue.fechaIngreso || 'N/A'} &rarr; ${hue.fechaSalida || 'N/A'}</small>
        </td>
        <td><span class="badge ${badgeClass}">${isActivo ? 'ACTIVO' : 'INACTIVO'}</span></td>
        <td>
          ${isActivo ? `
            <button class="btn-action btn-cancel" onclick="darDeBajaHuesped(${hue.id})" title="Aplica baja lógica (Verifica RN04 con Alquileres)">
              Baja Lógica
            </button>
          ` : '<span class="text-muted">Dado de baja</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

async function darDeBajaHuesped(id) {
  if (!confirm(`¿Dar de baja lógica al huésped ID ${id}?\n\n(Se consultará a alquileres-service para validar la regla RN04)`)) return;

  try {
    const res = await fetch(`${API.huespedes}/api/huespedes/${id}`, { method: 'DELETE' });
    const json = await res.json();

    if (res.status === 409) {
      // Regla de Negocio RN04 Activada!
      showToast(`Regla RN04: ${json.message || 'El huésped mantiene un alquiler activo y no puede ser dado de baja.'}`, 'error');
      return;
    }

    if (!res.ok) {
      throw new Error(json.message || 'Error al procesar la baja');
    }

    showToast('Huésped dado de baja lógica exitosamente', 'success');
    await loadHuespedes();
    updateDashboardKPIs();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==========================================
// Alquileres Rendering & Actions (Orquestador)
// ==========================================
function renderAlquileres() {
  const tbody = document.querySelector('#tabla-alquileres tbody');
  let list = state.alquileres;

  if (state.filtroAlquileres !== 'todos') {
    list = list.filter(a => a.estado.toLowerCase() === state.filtroAlquileres.toLowerCase());
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay contratos de alquiler que coincidan con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(alq => {
    const habDesc = alq.habitacion_detalle ? 
      `Habitación ${alq.habitacion_detalle.numero} (Piso ${alq.habitacion_detalle.piso})` : 
      `Habitación #${alq.habitacion_id}`;

    const hueDesc = alq.huesped_detalle ? 
      `${alq.huesped_detalle.nombres} ${alq.huesped_detalle.apellidos} (DNI: ${alq.huesped_detalle.dni})` : 
      `Huésped #${alq.huesped_id}`;

    const badgeClass = alq.estado === 'vigente' ? 'badge-vigente' : alq.estado === 'finalizado' ? 'badge-finalizado' : 'badge-cancelado';
    const isVigente = alq.estado === 'vigente';

    return `
      <tr>
        <td><strong>#${alq.id}</strong></td>
        <td><strong>${hueDesc}</strong></td>
        <td>${habDesc}</td>
        <td>${alq.fecha_inicio} &rarr; ${alq.fecha_fin || 'Vigente'}</td>
        <td><strong>S/. ${Number(alq.monto).toFixed(2)}</strong></td>
        <td><span class="badge ${badgeClass}">${alq.estado.toUpperCase()}</span></td>
        <td>
          ${isVigente ? `
            <div style="display:flex; gap:6px;">
              <button class="btn-action btn-finish" onclick="finalizarAlquiler(${alq.id})" title="RN03: Libera automáticamente la habitación a 'Disponible'">
                Finalizar (RN03)
              </button>
              <button class="btn-action btn-cancel" onclick="cancelarAlquiler(${alq.id})" title="Cancela y libera la habitación">
                Cancelar
              </button>
            </div>
          ` : `
            <small class="text-muted">Proceso cerrado</small>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

async function finalizarAlquiler(id) {
  if (!confirm(`¿Finalizar el alquiler #${id}?\n\nLa habitación será liberada automáticamente a 'Disponible' (RN03).`)) return;

  try {
    const res = await fetch(`${API.alquileres}/api/alquileres/${id}/finalizar`, {
      method: 'PATCH'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al finalizar alquiler');
    }
    showToast(`Alquiler #${id} finalizado. La habitación ha sido liberada a 'Disponible'.`, 'success');
    await refreshAll();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function cancelarAlquiler(id) {
  if (!confirm(`¿Cancelar el alquiler #${id}?`)) return;

  try {
    const res = await fetch(`${API.alquileres}/api/alquileres/${id}/cancelar`, {
      method: 'PATCH'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al cancelar alquiler');
    }
    showToast(`Alquiler #${id} cancelado correctamente.`, 'info');
    await refreshAll();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ==========================================
// Modals and Forms
// ==========================================
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Modal Nuevo Alquiler
async function openModalNuevoAlquiler() {
  const selectHue = document.getElementById('select-alquiler-huesped');
  const selectHab = document.getElementById('select-alquiler-habitacion');
  const inputIni = document.getElementById('alq-fecha-inicio');
  const inputFin = document.getElementById('alq-fecha-fin');
  const inputMonto = document.getElementById('alq-monto');

  selectHue.innerHTML = '<option value="">Cargando huéspedes activos...</option>';
  selectHab.innerHTML = '<option value="">Cargando habitaciones disponibles...</option>';
  
  // Set default dates (today to in 3 days)
  const today = new Date().toISOString().split('T')[0];
  const next3Days = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  inputIni.value = today;
  inputFin.value = next3Days;

  openModal('modal-nuevo-alquiler');

  // Load latest active guests & available rooms live from microservices
  await Promise.all([loadHuespedes(), loadHabitaciones()]);

  // Filter only active guests
  const huespedesActivos = state.huespedes.filter(h => h.estadoLogico === true);
  if (huespedesActivos.length === 0) {
    selectHue.innerHTML = '<option value="">No hay huéspedes activos disponibles. Registre uno primero.</option>';
  } else {
    selectHue.innerHTML = '<option value="">-- Seleccione un huésped --</option>' + 
      huespedesActivos.map(h => `<option value="${h.id}">${h.nombres} ${h.apellidos} (DNI: ${h.dni})</option>`).join('');
  }

  // Filter only available rooms (RN01)
  const habitacionesDisponibles = state.habitaciones.filter(h => h.estado === 'Disponible');
  if (habitacionesDisponibles.length === 0) {
    selectHab.innerHTML = '<option value="">No hay habitaciones disponibles en este momento.</option>';
  } else {
    selectHab.innerHTML = '<option value="">-- Seleccione una habitación disponible --</option>' + 
      habitacionesDisponibles.map(h => `<option value="${h.id}" data-precio="${h.precio}">Hab. ${h.numero} (Piso ${h.piso}) - S/. ${Number(h.precio).toFixed(2)}/noche</option>`).join('');
  }

  recalculateEstimatedMonto();
}

function openModalNuevaHabitacion() {
  document.getElementById('form-nueva-habitacion').reset();
  openModal('modal-nueva-habitacion');
}

function openModalNuevoHuesped() {
  document.getElementById('form-nuevo-huesped').reset();
  openModal('modal-nuevo-huesped');
}

// Date and Price calculation helper
function initFormCalculations() {
  const inputIni = document.getElementById('alq-fecha-inicio');
  const inputFin = document.getElementById('alq-fecha-fin');
  const selectHab = document.getElementById('select-alquiler-habitacion');

  inputIni.addEventListener('change', recalculateEstimatedMonto);
  inputFin.addEventListener('change', recalculateEstimatedMonto);
  selectHab.addEventListener('change', recalculateEstimatedMonto);
}

function recalculateEstimatedMonto() {
  const selectHab = document.getElementById('select-alquiler-habitacion');
  const inputIni = document.getElementById('alq-fecha-inicio');
  const inputFin = document.getElementById('alq-fecha-fin');
  const inputMonto = document.getElementById('alq-monto');
  const hint = document.getElementById('hint-calculo-monto');

  const selectedOpt = selectHab.selectedOptions[0];
  const precio = selectedOpt ? parseFloat(selectedOpt.dataset.precio || 0) : 0;

  if (!inputIni.value || !inputFin.value || !precio) {
    return;
  }

  const d1 = new Date(inputIni.value);
  const d2 = new Date(inputFin.value);
  const diffTime = d2 - d1;
  const noches = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

  if (d2 < d1) {
    hint.textContent = 'Advertencia RN05: La fecha de fin no puede ser anterior a la de inicio.';
    hint.style.color = 'var(--rose)';
    return;
  }

  const total = noches * precio;
  inputMonto.value = total.toFixed(2);
  hint.textContent = `Calculado: ${noches} noche(s) × S/. ${precio.toFixed(2)} = S/. ${total.toFixed(2)}`;
  hint.style.color = 'var(--text-dim)';
}

// Form Submit Handlers
function initForms() {
  // 1. Submit Nuevo Alquiler (Orchestrator Call)
  document.getElementById('form-nuevo-alquiler').addEventListener('submit', async (e) => {
    e.preventDefault();
    const huespedId = parseInt(document.getElementById('select-alquiler-huesped').value);
    const habitacionId = parseInt(document.getElementById('select-alquiler-habitacion').value);
    const fechaInicio = document.getElementById('alq-fecha-inicio').value;
    const fechaFin = document.getElementById('alq-fecha-fin').value;
    const monto = parseFloat(document.getElementById('alq-monto').value);

    if (!huespedId || !habitacionId) {
      showToast('Por favor selecciona tanto el huésped como la habitación', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-alquiler');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Orquestando transacción...';

    try {
      const res = await fetch(`${API.alquileres}/api/alquileres`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          huesped_id: huespedId,
          habitacion_id: habitacionId,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          monto: monto
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Fallo en la creación del alquiler');
      }

      showToast(`¡Alquiler #${data.id} creado con éxito! La habitación pasó automáticamente a 'Ocupada'.`, 'success');
      closeModal('modal-nuevo-alquiler');
      await refreshAll();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmar Alquiler';
    }
  });

  // 2. Submit Nueva Habitación
  document.getElementById('form-nueva-habitacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const numero = document.getElementById('hab-numero').value.trim();
    const piso = parseInt(document.getElementById('hab-piso').value);
    const descripcion = document.getElementById('hab-descripcion').value.trim();
    const precio = parseFloat(document.getElementById('hab-precio').value);
    const estado = document.getElementById('hab-estado').value;

    try {
      const res = await fetch(`${API.habitaciones}/api/habitaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero,
          piso,
          descripcion,
          precio,
          estado,
          fecha_creacion: new Date().toISOString().split('T')[0]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al guardar habitación');

      showToast(`Habitación ${data.numero} registrada exitosamente`, 'success');
      closeModal('modal-nueva-habitacion');
      await loadHabitaciones();
      updateDashboardKPIs();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });

  // 3. Submit Nuevo Huésped
  document.getElementById('form-nuevo-huesped').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombres = document.getElementById('hue-nombres').value.trim();
    const apellidos = document.getElementById('hue-apellidos').value.trim();
    const dni = document.getElementById('hue-dni').value.trim();
    const tel = document.getElementById('hue-tel').value.trim() || null;
    const email = document.getElementById('hue-email').value.trim();
    const direccion = document.getElementById('hue-direccion').value.trim() || null;
    const nacionalidad = document.getElementById('hue-nacionalidad').value.trim() || 'Peruana';
    const fechaNacimiento = document.getElementById('hue-nacimiento').value || null;

    try {
      const res = await fetch(`${API.huespedes}/api/huespedes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombres,
          apellidos,
          dni,
          tel,
          email,
          direccion,
          nacionalidad,
          fechaNacimiento
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Error al registrar huésped');
      }

      showToast(`Huésped ${nombres} registrado correctamente con DNI ${dni}`, 'success');
      closeModal('modal-nuevo-huesped');
      await loadHuespedes();
      updateDashboardKPIs();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

// Filter button events
function initFilters() {
  // Habitaciones filter
  document.querySelectorAll('[data-filter-hab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-hab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filtroHabitaciones = btn.dataset.filterHab;
      renderHabitaciones();
    });
  });

  // Alquileres filter
  document.querySelectorAll('[data-filter-alquiler]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-alquiler]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filtroAlquileres = btn.dataset.filterAlquiler;
      renderAlquileres();
    });
  });

  // Huéspedes search & active toggle
  const searchInput = document.getElementById('input-buscar-huesped');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.busquedaHuesped = e.target.value;
      renderHuespedes();
    });
  }

  const toggleActivosBtn = document.getElementById('btn-toggle-huespedes-activos');
  if (toggleActivosBtn) {
    toggleActivosBtn.addEventListener('click', () => {
      state.soloHuespedesActivos = !state.soloHuespedesActivos;
      toggleActivosBtn.classList.toggle('active', state.soloHuespedesActivos);
      toggleActivosBtn.textContent = state.soloHuespedesActivos ? 'Solo Activos' : 'Todos los Huéspedes';
      loadHuespedes();
    });
  }
}
