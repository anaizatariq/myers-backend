// ============================================
// EVENTS MODULE
// ============================================

const EVENTS_MODULE = (() => {
  const API_BASE_URL = 'http://127.0.0.1:8000/api';
  let allEvents = [];

  // ── LOAD ALL EVENTS (ADMIN) ──────────────────

  const loadEvents = async () => {
    try {
      const token = AUTH_MODULE.getToken();
      if (!token) {
        showError('Not authenticated. Please login again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/events/admin/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to load events');
      }

      allEvents = await response.json();
      renderEventsTable(allEvents);

    } catch (error) {
      showError(`Error loading events: ${error.message}`);
    }
  };

  // ── RENDER TABLE ─────────────────────────────

  const renderEventsTable = (events) => {
    const tableBody = document.getElementById('eventsTableBody');

    if (!events || events.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5">
            <i class="bi bi-inbox" style="font-size:32px;color:#ccc;"></i>
            <p class="mt-2 text-muted">No events found. Create one to get started.</p>
          </td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = events.map((event) => `
      <tr id="event-row-${event.id}">
        <td>#${event.id}</td>
        <td><strong>${escapeHtml(event.title)}</strong></td>
        <td>${formatDate(event.event_date)}</td>
        <td>${event.event_end_date ? formatDate(event.event_end_date) : '—'}</td>
        <td>
          <span class="status-badge ${event.is_active ? 'status-active' : 'status-inactive'}">
            ${event.is_active ? '✓ Active' : '✕ Inactive'}
          </span>
        </td>
        <td>${escapeHtml(event.created_by || '—')}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-edit" onclick="EVENTS_MODULE.editEvent(${event.id})">
              <i class="bi bi-pencil"></i> Edit
            </button>
            <button class="btn-delete" onclick="EVENTS_MODULE.openDeleteModal(${event.id})">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  };

  // ── CREATE ───────────────────────────────────

  const createEvent = async (eventData) => {
    try {
      const token = AUTH_MODULE.getToken();
      const response = await fetch(`${API_BASE_URL}/events/admin/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to create event');
      }

      const newEvent = await response.json();

      // Add to local array and re-render
      allEvents.push(newEvent);
      renderEventsTable(allEvents);
      closeModal();
      showSuccess('Event created successfully!');
      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ── UPDATE — update in-place, no new row ─────

  const updateEvent = async (eventId, eventData) => {
    try {
      const token = AUTH_MODULE.getToken();
      const response = await fetch(`${API_BASE_URL}/events/admin/${eventId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to update event');
      }

      const updatedEvent = await response.json();

      // Find and replace in-place — this is the fix
      const index = allEvents.findIndex((e) => e.id === eventId);
      if (index !== -1) {
        allEvents[index] = updatedEvent;
      }

      renderEventsTable(allEvents);
      closeModal();
      showSuccess('Event updated successfully!');
      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ── DELETE — hard delete, gone immediately ───

  const deleteEvent = async (eventId) => {
    try {
      const token = AUTH_MODULE.getToken();
      const response = await fetch(`${API_BASE_URL}/events/admin/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to delete event');
      }

      // Remove from local array immediately
      allEvents = allEvents.filter((e) => e.id !== eventId);
      renderEventsTable(allEvents);
      closeDeleteModal();
      showSuccess('Event deleted successfully!');

    } catch (error) {
      showError(`Error deleting event: ${error.message}`);
    }
  };

  // ── EDIT — populate modal with existing data ─

  const editEvent = (eventId) => {
    const event = allEvents.find((e) => e.id === eventId);
    if (!event) {
      showError('Event not found');
      return;
    }

    resetModalState();

    // Set the global editing ID
    currentEditingEventId = eventId;

    document.getElementById('modalTitle').textContent = 'Edit Event';
    document.getElementById('submitBtnText').textContent = 'Update Event';
    document.getElementById('eventTitle').value = event.title || '';
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventDate').value = event.event_date ? event.event_date.split('T')[0] : '';
    document.getElementById('eventEndDate').value = event.event_end_date ? event.event_end_date.split('T')[0] : '';

    if (event.image_url) {
      IMAGE_UPLOAD.setImageUrl(event.image_url);
    } else {
      IMAGE_UPLOAD.clearImage();
    }

    openModal();
  };

  const openDeleteModal = (eventId) => {
    deleteEventId = eventId;
    document.getElementById('deleteModal').classList.remove('d-none');
    document.getElementById('modalOverlay').classList.remove('d-none');
    document.body.style.overflow = 'hidden';
  };

  return {
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    editEvent,
    openDeleteModal,
  };
})();


// ============================================
// MODAL MANAGEMENT
// ============================================

const eventModal    = document.getElementById('eventModal');
const deleteModal   = document.getElementById('deleteModal');
const modalOverlay  = document.getElementById('modalOverlay');
const addEventBtn   = document.getElementById('addEventBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn     = document.getElementById('cancelBtn');
const eventForm     = document.getElementById('eventForm');
const eventFormError   = document.getElementById('eventFormError');
const formErrorMessage = document.getElementById('formErrorMessage');

// Single source of truth for editing state
let currentEditingEventId = null;
let deleteEventId = null;
let isSubmitting = false;


function resetModalState() {
  eventForm.reset();
  eventFormError.classList.add('d-none');
  formErrorMessage.textContent = '';
  currentEditingEventId = null;
  isSubmitting = false;
  IMAGE_UPLOAD.clearImage();

  const submitBtn = eventForm.querySelector('.btn-submit');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-check-lg"></i> <span id="submitBtnText">Create Event</span>';
  }
}

function openModal() {
  eventModal.classList.remove('d-none');
  modalOverlay.classList.remove('d-none');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  eventModal.classList.add('d-none');
  modalOverlay.classList.add('d-none');
  document.body.style.overflow = 'auto';
  resetModalState();
}

addEventBtn.addEventListener('click', () => {
  resetModalState();
  document.getElementById('modalTitle').textContent = 'Add New Event';
  document.getElementById('submitBtnText').textContent = 'Create Event';
  openModal();
});

closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});


// ── FORM SUBMIT ──────────────────────────────

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isSubmitting) return;

  const title       = document.getElementById('eventTitle').value.trim();
  const description = document.getElementById('eventDescription').value.trim();
  const eventDate   = document.getElementById('eventDate').value;
  const eventEndDate = document.getElementById('eventEndDate').value;
  const imageUrl    = IMAGE_UPLOAD.getImageUrl();

  if (!title) { showFormError('Event title is required'); return; }
  if (!eventDate) { showFormError('Event date is required'); return; }

  const eventData = {
    title,
    description: description || null,
    event_date: eventDate,
    event_end_date: eventEndDate || null,
    image_url: imageUrl || null,
    is_active: true
  };

  isSubmitting = true;
  const submitBtn = eventForm.querySelector('.btn-submit');
  const originalHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

  let result;
  if (currentEditingEventId) {
    result = await EVENTS_MODULE.updateEvent(currentEditingEventId, eventData);
  } else {
    result = await EVENTS_MODULE.createEvent(eventData);
  }

  isSubmitting = false;
  submitBtn.disabled = false;
  submitBtn.innerHTML = originalHTML;

  if (!result.success) {
    showFormError(result.error);
  }
});

function showFormError(message) {
  formErrorMessage.textContent = message;
  eventFormError.classList.remove('d-none');
}


// ── IMAGE UPLOAD BUTTON ──────────────────────

const uploadImageBtn = document.getElementById('uploadImageBtn');
const eventImage     = document.getElementById('eventImage');

uploadImageBtn.addEventListener('click', async () => {
  if (!eventImage.files || eventImage.files.length === 0) {
    showFormError('Please select an image file first');
    return;
  }

  uploadImageBtn.disabled = true;
  uploadImageBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';

  const result = await IMAGE_UPLOAD.uploadImage(eventImage.files[0]);

  uploadImageBtn.disabled = false;
  uploadImageBtn.innerHTML = '<i class="bi bi-upload"></i> Upload';

  if (!result.success) {
    showFormError('Image upload failed. Please try again.');
  }
});


// ── DELETE MODAL ─────────────────────────────

const cancelDeleteBtn  = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

function closeDeleteModal() {
  deleteModal.classList.add('d-none');
  modalOverlay.classList.add('d-none');
  document.body.style.overflow = 'auto';
  deleteEventId = null;
}

cancelDeleteBtn.addEventListener('click', closeDeleteModal);

confirmDeleteBtn.addEventListener('click', () => {
  if (deleteEventId) {
    EVENTS_MODULE.deleteEvent(deleteEventId);
  }
});


// ============================================
// IMAGE UPLOAD MODULE
// ============================================

const IMAGE_UPLOAD = (() => {
  const API_BASE_URL = '/api';
  let uploadedImageUrl = null;

  const uploadImage = async (file) => {
    try {
      const token = AUTH_MODULE.getToken();
      if (!token) {
        showError('Not authenticated');
        return { success: false };
      }

      if (file.size > 5 * 1024 * 1024) {
        showFormError('File size must be less than 5MB');
        return { success: false };
      }

      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        showFormError('Only JPG, JPEG, PNG, WEBP allowed');
        return { success: false };
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/events/admin/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AUTH_MODULE.getToken()}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Upload failed');
      }

      const data = await response.json();
      uploadedImageUrl = data.url;
      showImagePreview(data.url);
      showSuccess('Image uploaded successfully!');
      return { success: true, url: data.url };

    } catch (error) {
      showError(`Upload failed: ${error.message}`);
      return { success: false };
    }
  };

  const showImagePreview = (url) => {
    document.getElementById('imagePreview').innerHTML = `
      <div style="position:relative;width:100%;max-width:300px;">
        <img src="${url}" alt="Preview"
             style="width:100%;height:auto;border-radius:8px;border:2px solid #e5e7eb;" />
        <button type="button" onclick="IMAGE_UPLOAD.clearImage()"
                style="position:absolute;top:8px;right:8px;background:rgba(220,53,69,0.9);
                       color:#fff;border:none;border-radius:50%;width:28px;height:28px;
                       cursor:pointer;font-weight:bold;line-height:1;">✕</button>
      </div>`;
  };

  const clearImage = () => {
    uploadedImageUrl = null;
    const input = document.getElementById('eventImage');
    if (input) input.value = '';
    document.getElementById('imagePreview').innerHTML = '';
  };

  const getImageUrl = () => uploadedImageUrl;

  const setImageUrl = (url) => {
    uploadedImageUrl = url;
    if (url) showImagePreview(url);
  };

  return { uploadImage, clearImage, getImageUrl, setImageUrl };
})();


// ============================================
// NOTIFICATIONS
// ============================================

function showSuccess(message) {
  _showToast(message, '#d4edda', '#155724', '#c3e6cb');
}

function showError(message) {
  _showToast(message, '#f8d7da', '#721c24', '#f5c6cb', 5000);
}

function _showToast(message, bg, color, border, duration = 3000) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:9999;min-width:300px;
    padding:12px 16px;background:${bg};color:${color};
    border:1px solid ${border};border-radius:8px;font-weight:600;
    animation:slideIn 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.15);`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, duration);
}


// ============================================
// UTILITIES
// ============================================

function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// Animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn { from { transform:translateX(400px);opacity:0; } to { transform:translateX(0);opacity:1; } }
  @keyframes slideOut { from { transform:translateX(0);opacity:1; } to { transform:translateX(400px);opacity:0; } }
`;
document.head.appendChild(style);

window.EVENTS_MODULE = EVENTS_MODULE;
window.IMAGE_UPLOAD  = IMAGE_UPLOAD;
