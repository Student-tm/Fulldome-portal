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
        localStorage.setItem('gtoken', accessToken);
        localStorage.setItem('gtoken_time', Date.now());
        if (onReady) onReady();
      }
    });
    const saved = localStorage.getItem('gtoken');
    const savedTime = localStorage.getItem('gtoken_time');
    const isExpired = !savedTime || (Date.now() - parseInt(savedTime)) > 3500000;
    if (saved && !isExpired) {
      accessToken = saved;
      if (onReady) onReady();
    } else {
      localStorage.removeItem('gtoken');
      localStorage.removeItem('gtoken_time');
      tokenClient.requestAccessToken();
    }
  };
  document.head.appendChild(script);
}

function requireAuth(onReady) {
  const saved = localStorage.getItem('gtoken');
  const savedTime = localStorage.getItem('gtoken_time');
  const isExpired = !savedTime || (Date.now() - parseInt(savedTime)) > 3500000;
  if (saved && !isExpired) {
    accessToken = saved;
    onReady();
    return;
  }
  initGoogleAuth(onReady);
}

async function sheetsGet(range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  if (r.status === 401) {
    localStorage.removeItem('gtoken');
    localStorage.removeItem('gtoken_time');
    accessToken = null;
    initGoogleAuth(function(){ location.reload(); });
    throw new Error('Token expired');
  }
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
  const data = await sheetsGet('Projects!A:J');
  const rows = data.values || [];
  return rows.slice(1).filter(r => r[0] && r[1]).map(r => ({
    id: r[0] || '',
    name: r[1] || '',
    address: r[2] || '',
    start: r[3] || '',
    end: r[4] || '',
    tg1: r[5] || '',
    tg2: r[6] || '',
    created: r[7] ? parseInt(r[7]) : Date.now(),
    status: r[8] || 'active'
  }));
}

async function saveProject(p) {
  const data = await sheetsGet('Projects!A:A');
  const rows = data.values || [];
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === String(p.id)) { rowIdx = i + 1; break; }
  }
  const vals = [[p.id, p.name, p.address||'', p.start||'', p.end||'', p.tg1||'', p.tg2||'', p.created, p.status||'active']];
  if (rowIdx > 0) {
    await sheetsUpdate(`Projects!A${rowIdx}:I${rowIdx}`, vals);
  } else {
    await sheetsAppend('Projects!A:I', vals);
  }
}

async function getSheetId(sheetName) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const data = await r.json();
  const sheet = data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : 0;
}

async function deleteProject(id) {
  const data = await sheetsGet('Projects!A:A');
  const rows = data.values || [];
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === String(id)) { rowIdx = i; break; }
  }
  if (rowIdx === -1) return;
  const sheetId = await getSheetId('Projects');
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIdx,
              endIndex: rowIdx + 1
            }
          }
        }]
      })
    }
  );
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
  } catch(e) { console.error('loadEquipment error', e); }
  return null;
}

async function ensureSheet(sheetName) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const data = await r.json();
  const exists = data.sheets && data.sheets.some(s => s.properties.title === sheetName);
  if (!exists) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] })
      }
    );
  }
}

async function saveEquipment(projectId, equipData) {
  const sheet = 'EQ_' + String(projectId).substring(0, 10);
  try {
    await ensureSheet(sheet);
    await sheetsClear(`${sheet}!A:B`);
    await sheetsAppend(`${sheet}!A:B`, [
      ['savedAt', new Date().toLocaleString()],
      ['data', JSON.stringify(equipData)]
    ]);
  } catch(e) { console.error('saveEquipment error', e); throw e; }
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
