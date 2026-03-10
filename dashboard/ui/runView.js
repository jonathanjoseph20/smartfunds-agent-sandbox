function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPreview(preview) {
  if (preview.previewKind === 'markdown') {
    return `<div class="preview">${preview.content.html}</div>`;
  }

  if (preview.previewKind === 'csv') {
    const headers = preview.content.csv.headers
      .map((header) => `<th>${escapeHtml(header)}</th>`)
      .join('');
    const rows = preview.content.csv.rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
      .join('');
    return `<div class="preview"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  if (preview.previewKind === 'json') {
    return `<div class="preview"><pre>${escapeHtml(preview.content.pretty)}</pre></div>`;
  }

  if (preview.previewKind === 'text') {
    return `<div class="preview"><pre>${escapeHtml(preview.content.text)}</pre></div>`;
  }

  return `<div class="preview">Preview unsupported: ${escapeHtml(preview.content.unsupportedReason)}</div>`;
}

export async function loadRunDetails(runId) {
  const detailsEl = document.getElementById('run-details');
  const previewEl = document.getElementById('artifact-preview');

  detailsEl.textContent = 'Loading run details…';
  previewEl.textContent = 'Select an artifact to preview.';

  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
    const payload = await response.json();

    if (!response.ok) {
      detailsEl.innerHTML = `<div class="error">${escapeHtml(payload.error ?? 'Failed to load run')}</div>`;
      return;
    }

    const metaRows = [
      ['runId', payload.runId],
      ['missionId', payload.missionId ?? 'N/A'],
      ['profile', payload.profile ?? 'N/A'],
      ['executionPath', payload.executionPath ?? 'N/A'],
      ['workflowId', payload.workflowId ?? 'N/A'],
      ['status', payload.status ?? 'N/A'],
      ['artifactCount', Number.isFinite(payload.artifactCount) ? String(payload.artifactCount) : 'N/A'],
      ['nodes', Array.isArray(payload.nodes) ? payload.nodes.join(', ') : 'N/A']
    ];

    const metadataHtml = metaRows
      .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong></div><div>${escapeHtml(value)}</div>`)
      .join('');

    const artifactsHtml = payload.artifacts.length === 0
      ? '<div class="empty">No artifacts found for this run.</div>'
      : `<ul class="artifact-list">${payload.artifacts
        .map((artifact) => `
          <li>
            <button class="artifact-item" data-run-id="${escapeHtml(payload.runId)}" data-file-name="${escapeHtml(artifact.fileName)}">
              ${escapeHtml(artifact.fileName)} (${escapeHtml(artifact.previewKind)})
            </button>
          </li>
        `)
        .join('')}</ul>`;

    detailsEl.innerHTML = `<div class="meta-grid">${metadataHtml}</div>${artifactsHtml}`;

    for (const element of detailsEl.querySelectorAll('.artifact-item')) {
      element.addEventListener('click', async () => {
        const fileName = element.getAttribute('data-file-name');
        const artifactRunId = element.getAttribute('data-run-id');

        if (!fileName || !artifactRunId) {
          return;
        }

        previewEl.textContent = 'Loading artifact preview…';

        try {
          const artifactResponse = await fetch(`/api/artifacts/${encodeURIComponent(artifactRunId)}/${encodeURIComponent(fileName)}`);
          const artifactPayload = await artifactResponse.json();
          if (!artifactResponse.ok) {
            previewEl.innerHTML = `<div class="error">${escapeHtml(artifactPayload.error ?? 'Failed to load artifact')}</div>`;
            return;
          }

          previewEl.innerHTML = renderPreview(artifactPayload);
        } catch {
          previewEl.innerHTML = '<div class="error">Failed to load artifact preview.</div>';
        }
      });
    }
  } catch {
    detailsEl.innerHTML = '<div class="error">Failed to load run details.</div>';
  }
}
