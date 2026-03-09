import { loadRunDetails } from './runView.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadRuns() {
  const statusEl = document.getElementById('runs-status');
  const listEl = document.getElementById('runs-list');

  statusEl.textContent = 'Loading runs…';

  try {
    const response = await fetch('/api/runs');
    const payload = await response.json();

    if (!response.ok) {
      statusEl.innerHTML = `<span class="error">${escapeHtml(payload.error ?? 'Failed to load runs')}</span>`;
      return;
    }

    if (!Array.isArray(payload) || payload.length === 0) {
      statusEl.textContent = 'No runs found.';
      listEl.innerHTML = '';
      return;
    }

    statusEl.textContent = `${payload.length} run(s)`;
    listEl.innerHTML = payload.map((run) => {
      const mission = run.missionId ? ` mission=${run.missionId}` : '';
      const status = run.status ? ` status=${run.status}` : '';
      return `
        <li>
          <button class="run-item" data-run-id="${escapeHtml(run.runId)}">
            <strong>${escapeHtml(run.runId)}</strong><br />
            <small>${escapeHtml(`${mission}${status}`.trim() || 'metadata unavailable')}</small>
          </button>
        </li>
      `;
    }).join('');

    for (const button of listEl.querySelectorAll('.run-item')) {
      button.addEventListener('click', () => {
        const runId = button.getAttribute('data-run-id');
        if (!runId) {
          return;
        }
        loadRunDetails(runId);
      });
    }
  } catch {
    statusEl.innerHTML = '<span class="error">Failed to load runs.</span>';
  }
}

loadRuns();
