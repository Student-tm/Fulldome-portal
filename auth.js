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
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?_=${Date.now()}`,
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
  const data = await sheetsGet('RentalProjects!A:I');
  const rows = data.values || [];
  return rows.slice(1).filter(r => r[0] && r[1]).map(r => ({
    id: r[0] || '',
    name: r[1] || '',
    address: r[2] || '',
    start: r[3] || '',
    tg1: r[4] || '',
    tg2: r[5] || '',
    created: r[6] ? parseInt(r[6]) : Date.now(),
    status: r[7] || 'active'
  }));
}

async function saveProject(p) {
  const data = await sheetsGet('RentalProjects!A:A');
  const rows = data.values || [];
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === String(p.id)) { rowIdx = i + 1; break; }
  }
  const vals = [[p.id, p.name, p.address||'', p.start||'', p.tg1||'', p.tg2||'', p.created, p.status||'active']];
  if (rowIdx > 0) {
    await sheetsUpdate(`RentalProjects!A${rowIdx}:H${rowIdx}`, vals);
  } else {
    await sheetsAppend('RentalProjects!A:H', vals);
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
  const data = await sheetsGet('RentalProjects!A:A');
  const rows = data.values || [];
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === String(id)) { rowIdx = i; break; }
  }
  if (rowIdx === -1) return;
  const sheetId = await getSheetId('RentalProjects');
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


async function getBrief(projectId) {
  try {
    const data = await sheetsGet('Briefs!A:D');
    const rows = data.values || [];
    return rows.filter(r => r[0] === String(projectId)).map(r => ({
      field: r[1] || '',
      value: r[2] || '',
      comments: r[3] || ''
    }));
  } catch(e) { console.error('getBrief error', e); return []; }
}

async function saveBrief(projectId, rows) {
  await ensureSheet('Briefs');
  // Clear existing rows for this project
  const data = await sheetsGet('Briefs!A:A');
  const allRows = data.values || [];
  const toDelete = [];
  for (let i = allRows.length - 1; i >= 0; i--) {
    if (allRows[i][0] === String(projectId)) toDelete.push(i);
  }
  if (toDelete.length > 0) {
    const sheetId = await getSheetId('Briefs');
    const requests = toDelete.map(idx => ({
      deleteDimension: {
        range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 }
      }
    }));
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      }
    );
  }
  // Append new rows
  const vals = rows.map(r => [projectId, r.field, r.value || '', r.comment || '']);
  await sheetsAppend('Briefs!A:D', vals);
}

// ═══ SERVER CONFIG DATABASE ═══════════════════════════════
const CONFIG_SPREADSHEET_ID = '1ArIPwqEmma1GqwZZXgaMiq4b1ZqfBx4ocB-9Bra4o8Q';

async function configsGet(range) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG_SPREADSHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  return r.json();
}

async function configsAppend(range, values) {
  return fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG_SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    }
  );
}

async function configsUpdate(range, values) {
  return fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG_SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    }
  );
}

async function ensureConfigSheet(sheetName) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG_SPREADSHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const data = await r.json();
  const exists = data.sheets && data.sheets.some(s => s.properties.title === sheetName);
  if (!exists) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG_SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] })
      }
    );
    // Add headers
    await configsAppend('Configs!A:I', [['ID','Type','ProjectID','ProjectName','Component','Value','Price','Link','Status']]);
  }
}

async function saveConfig(configId, type, projectId, projectName, components) {
  if (!components || !components.length) return;
  await ensureConfigSheet('Configs');
  const vals = components.map(c => [configId, type, projectId, projectName, c.component||'', c.value||'', c.price||'', c.link||'', c.status||'Not ordered']);
  await configsAppend('Configs!A:I', vals);
}

async function getConfigs(type) {
  await ensureConfigSheet('Configs');
  const data = await configsGet('Configs!A:I');
  const rows = data.values || [];
  // Group by configId
  const configs = {};
  rows.slice(1).forEach(r => {
    if (!r[0] || (type && r[1] !== type)) return;
    if (!configs[r[0]]) configs[r[0]] = { id: r[0], type: r[1], projectId: r[2], projectName: r[3], components: [] };
    configs[r[0]].components.push({ component: r[4]||'', value: r[5]||'', price: r[6]||'', link: r[7]||'', status: r[8]||'' });
  });
  return Object.values(configs);
}

async function getProjectConfigs(projectId) {
  await ensureConfigSheet('Configs');
  const data = await configsGet('Configs!A:I');
  const rows = data.values || [];
  const configs = {};
  rows.slice(1).forEach(r => {
    if (!r[0] || r[2] !== String(projectId)) return;
    if (!configs[r[0]]) configs[r[0]] = { id: r[0], type: r[1], projectId: r[2], projectName: r[3], components: [] };
    configs[r[0]].components.push({ component: r[4]||'', value: r[5]||'', price: r[6]||'', link: r[7]||'', status: r[8]||'' });
  });
  return Object.values(configs);
}


async function getConfigsByProject(projectId) {
  await ensureConfigsSheet('Configs');
  const data = await configsGet('Configs!A:I');
  const rows = data.values || [];
  if (rows.length < 2) return [];
  const configs = {};
  rows.slice(1).forEach(r => {
    if (r[2] !== String(projectId)) return;
    const id = r[0];
    if (!configs[id]) configs[id] = { id, type: r[1], projectId: r[2], projectName: r[3], components: [] };
    configs[id].components.push({ component: r[4], value: r[5], price: r[6], link: r[7], status: r[8] });
  });
  return Object.values(configs);
}

async function deleteConfig(configId) {
  const data = await configsGet('Configs!A:A');
  const rows = data.values || [];
  const toDelete = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0] === String(configId)) toDelete.push(i);
  }
  if (!toDelete.length) return;
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIGS_SPREADSHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const d = await r.json();
  const sheet = d.sheets.find(s => s.properties.title === 'Configs');
  const sheetId = sheet ? sheet.properties.sheetId : 0;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIGS_SPREADSHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: toDelete.map(idx => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx+1 } } })) })
    }
  );
}
