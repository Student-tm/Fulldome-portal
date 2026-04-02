const CLIENT_ID = '673039541518-jurnkvne074u3ib66u52skjoru204rn5.apps.googleusercontent.com';
const SPREADSHEET_ID = '1FZ5Y4ukKpUs0LmrC8e02am2pN3rc9QuG6ePNKb51mfw';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar';

let tokenClient, accessToken = null;

function initGoogleAuth(onReady) {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = function() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: function(resp) {
        if (resp.error) { console.error(resp); return; }
        accessToken = resp.access_token;
        sessionStorage.setItem('gtoken', accessToken);
        if (onReady) onReady();
      }
    });
    const saved = sessionStorage.getItem('gtoken');
    if (saved) {
      accessToken = saved;
      if (onReady) onReady();
    } else {
      tokenClient.requestAccessToken();
    }
  };
  document.head.appendChild(script);
}

function requireAuth(onReady) {
  if (accessToken) { onReady(); return; }
  const saved = sessionStorage.getItem('gtoken');
  if (saved) { accessToken = saved; onReady(); return; }
  initGoogleAuth(onReady);
}

async function sheetsGet(range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  if (r.status === 401) { sessionStorage.removeItem('gtoken'); accessToken = null; location.reload(); }
  return r.json();
}

async function sheetsUpdate(range, values) {
  return fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    }
  );
}

async function sheetsAppend(range, values) {
  return fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    }
  );
}

async function sheetsClear(range) {
  return fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:clear`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken }
    }
  );
}

async function getProjects() {
  const data = await sheetsGet('Projects!A:F');
  const rows = data.values || [];
  return rows.slice(1).filter(r => r[0]).map(r => ({
    id: r[0] || '',
    name: r[1] || '',
    client: r[2] || '',
    date: r[3] || '',
    telegram: r[4] || '',
    created: r[5] ? parseInt(r[5]) : Date.now()
  }));
}

async function saveProject(p) {
  const data = await sheetsGet('Projects!A:A');
  const rows = data.values || [];
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === String(p.id)) { rowIdx = i + 1; break; }
  }
  const vals = [[p.id, p.name, p.client, p.date, p.telegram, p.created]];
  if (rowIdx > 0) {
    await sheetsUpdate(`Projects!A${rowIdx}:F${rowIdx}`, vals);
  } else {
    await sheetsAppend('Projects!A:F', vals);
  }
}

async function deleteProject(id) {
  const data = await sheetsGet('Projects!A:A');
  const rows = data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === String(id)) {
      const rowIdx = i + 1;
      await sheetsUpdate(`Projects!A${rowIdx}:F${rowIdx}`, [['','','','','','']]);
      return;
    }
  }
}

async function getDomes() {
  const data = await sheetsGet('DOMES!A:F');
  const rows = data.values || [];
  let id = 1;
  return rows.slice(1).filter(r => r[1]).map(r => ({
    id: id++,
    size: r[1] || '',
    serials: (r[2] || '').split('\n').map(s => s.trim()).filter(s => s),
    ductSize: r[3] || '',
    truss: r[4] || '',
    drawing: r[5] || ''
  }));
}

async function loadEquipment(projectId) {
  const sheet = 'EQ_' + String(projectId).substring(0, 10);
  try {
    const data = await sheetsGet(`${sheet}!A:B`);
    const rows = data.values || [];
    for (const r of rows) {
      if (r[0] === 'data') { try { return JSON.parse(r[1]); } catch(e) { return null; } }
    }
  } catch(e) {}
  return null;
}

async function saveEquipment(projectId, equipData) {
  const sheet = 'EQ_' + String(projectId).substring(0, 10);
  await sheetsClear(`${sheet}!A:B`);
  await sheetsAppend(`${sheet}!A:B`, [
    ['savedAt', new Date().toLocaleString()],
    ['data', JSON.stringify(equipData)]
  ]);
}
