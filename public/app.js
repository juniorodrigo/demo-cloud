// Frontend vanilla: carga la lista y publica mensajes contra la API.
const form = document.getElementById('message-form');
const nameInput = document.getElementById('name');
const bodyInput = document.getElementById('body');
const countEl = document.getElementById('count');
const errorEl = document.getElementById('error');
const submitBtn = document.getElementById('submit');
const messagesEl = document.getElementById('messages');

// Contador de caracteres del mensaje.
bodyInput.addEventListener('input', () => {
  countEl.textContent = String(bodyInput.value.length);
});

// Escapa texto del usuario antes de inyectarlo en el DOM.
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Formatea la fecha en algo legible y relativo-amigable.
function formatTime(iso) {
  const date = new Date(iso);
  return date.toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderMessages(messages) {
  if (!messages.length) {
    messagesEl.innerHTML = '<p class="empty">Aún no hay mensajes. ¡Sé el primero!</p>';
    return;
  }
  messagesEl.innerHTML = messages
    .map(
      (m) => `
      <article class="message">
        <div class="message-head">
          <span class="message-name">${escapeHtml(m.name)}</span>
          <time class="message-time">${formatTime(m.createdAt)}</time>
        </div>
        <p class="message-body">${escapeHtml(m.body)}</p>
      </article>`
    )
    .join('');
}

async function loadMessages() {
  try {
    const res = await fetch('/api/messages');
    if (!res.ok) throw new Error('No se pudieron cargar los mensajes.');
    renderMessages(await res.json());
  } catch (err) {
    messagesEl.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const name = nameInput.value.trim();
  const body = bodyInput.value.trim();
  if (!name || !body) {
    showError('Completa nombre y mensaje.');
    return;
  }

  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo publicar el mensaje.');
    }
    bodyInput.value = '';
    countEl.textContent = '0';
    await loadMessages();
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
  }
});

loadMessages();
