const CLIENT_ID = '673039541518-jurnkvne074u3ib66u52skjoru204rn5.apps.googleusercontent.com';
const SPREADSHEET_ID = '1FZ5Y4ukKpUs0LmrC8e02am2pN3rc9QuG6ePNKb51mfw';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive';

let tokenClient, accessToken = null;

const FIELD_LABELS = {
  client_name: 'Company / Client name',
  client_name_c: 'Company / Client name — Comments',
  event_name: 'Event name',
  event_name_c: 'Event name — Comments',
  client_contact: 'Client contact',
  client_contact_c: 'Client contact — Comments',
  address: 'Address of installation / event',
  address_c: 'Address — Comments',
  install_start: 'Installation start time-date',
  install_start_c: 'Installation start — Comments',
  walkthrough: 'Client walk-through time',
  walkthrough_c: 'Client walk-through — Comments',
  breakdown: 'Event break-down time',
  breakdown_c: 'Event break-down — Comments',
  sale_rental: 'Sale or Rental',
  sale_rental_c: 'Sale or Rental — Comments',
  dome_size: 'Dome size',
  dome_size_c: 'Dome size — Comments',
  dome_origin: 'Dome origin',
  dome_origin_c: 'Dome origin — Comments',
  blackout: 'Blackout / Open dome',
  blackout_c: 'Blackout — Comments',
  indoor: 'Indoor / Outdoor',
  indoor_c: 'Indoor / Outdoor — Comments',
  outer_cover: 'Outer cover',
  outer_cover_c: 'Outer cover — Comments',
  screen_type: 'Screen type',
  screen_type_c: 'Screen type — Comments',
  decor_cover: 'Inflatable decor cover',
  decor_cover_c: 'Inflatable decor cover — Comments',
  fans: 'Are we shipping fans',
  fans_c: 'Are we shipping fans — Comments',
  duct_size: 'Duct size',
  duct_size_c: 'Duct size — Comments',
  assembly_link: 'Assembly scheme link',
  assembly_link_c: 'Assembly scheme link — Comments',
  truss_link: 'Truss drawing link',
  truss_link_c: 'Truss drawing link — Comments',
  server: 'Server',
  server_c: 'Server — Comments',
  capture_card: 'Capture card',
  capture_card_c: 'Capture card — Comments',
  server_location: 'Location of the server',
  server_location_c: 'Location of the server — Comments',
  projectors: 'Projectors, number and brand',
  projectors_c: 'Projectors — Comments',
  sound: 'Sound system brand',
  sound_c: 'Sound system brand — Comments',
  hvac: 'HVACs',
  hvac_c: 'HVACs — Comments',
  hvac_location: 'Location of HVACs',
  hvac_location_c: 'Location of HVACs — Comments',
  content_list: 'Content for the event list',
  content_list_c: 'Content for the event list — Comments',
  content_server: 'Content on the server',
  content_server_c: 'Content on the server — Comments',
  encoder: 'Encoder needed',
  encoder_c: 'Encoder needed — Comments',
  promo: 'Promo materials',
  promo_c: 'Promo materials — Comments',
  event_specifics: 'Any event specifics',
  event_specifics_c: 'Any event specifics — Comments',
  budget_shipping: 'Budget for shipping',
  budget_shipping_c: 'Budget for shipping — Comments',
  budget_travel: 'Budget for travelling expenses',
  budget_travel_c: 'Budget for travelling expenses — Comments',
  training: 'Training for local team',
  training_c: 'Training for local team — Comments',
  construction_start: 'Construction start time-date',
  construction_start_c: 'Construction start — Comments',
  setup_walkthrough: 'Client walk-through time (setup)',
  setup_walkthrough_c: 'Client walk-through (setup) — Comments',
  setup_breakdown: 'Event break-down time (setup)',
  setup_breakdown_c: 'Event break-down (setup) — Comments',
  ceiling: 'Ceiling height and obstructions',
  ceiling_c: 'Ceiling — Comments',
  crane: 'Crane, boom, etc.',
  crane_c: 'Crane — Comments',
  labour: 'Local labour / union, contact person',
  labour_c: 'Local labour — Comments',
  certificates: 'Certificates (fire)',
  certificates_c: 'Certificates — Comments',
  permits: 'Permits (we provide info only)',
  permits_c: 'Permits — Comments',
  coi: 'COI if needed',
  coi_c: 'COI — Comments',
  flooring: 'Flooring type',
  flooring_c: 'Flooring — Comments',
  furniture: 'Furniture (tables, chairs, bean bags)',
  furniture_c: 'Furniture — Comments',
  electricity: 'Electricity required',
  electricity_c: 'Electricity — Comments',
  safety: 'Safety signs (fire extinguisher, exit)',
  safety_c: 'Safety — Comments',
  packing: 'Packing / flight cases type',
  packing_c: 'Packing — Comments'
};

const SECTION_HEADERS = {
  client_name: 'INFORMATION ABOUT CLIENT AND VENUE',
  dome_size: 'DOME DESCRIPTION',
  server: 'PROJECTION SYSTEM DESCRIPTION',
  content_list: 'CONTENT',
  event_specifics: 'EVENT SPECIFICS',
  construction_start: 'SETUP ON SITE',
  certificates: 'ADDITIONAL INFO'
};

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
  const data = await sheetsGet('Projects!A:I');
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
  const data = await sheetsGet('Projects!A:A');
  const rows = data.values || [];
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === String(p.id)) { rowIdx = i + 1; break; }
  }
  const vals = [[p.id, p.name, p.address||'', p.start||'', p.tg1||'', p.tg2||'', p.created, p.status||'active']];
  if (rowIdx > 0) {
    await sheetsUpdate(`Projects!A${rowIdx}:H${rowIdx}`, vals);
  } else {
    await sheetsAppend('Projects!A:H', vals);
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

async function saveBrief(projectId, rows) {
  const projects = await getProjects();
  const project = projects.find(p => p.id === String(projectId));
  const projectName = project ? project.name : String(projectId);

  const safeName = projectName.replace(/[\\\/\?\*\[\]\:]/g, '').substring(0, 50);
  const sheetName = 'Brief_' + safeName;

  await ensureSheet(sheetName);
  await sheetsClear(`${sheetName}!A1:C200`);

  const vals = [['Field', 'Specification', 'Comments']];

  rows.forEach(function(r) {
    if (r.field.endsWith('_c')) return;
    if (SECTION_HEADERS[r.field]) {
      vals.push([SECTION_HEADERS[r.field], '', '']);
    }
    var label = FIELD_LABELS[r.field] || r.field;
    var commentRow = rows.find(function(x) { return x.field === r.field + '_c'; });
    var comment = commentRow ? (commentRow.value || '') : '';
    vals.push([label, r.value || '', comment]);
  });

  await sheetsUpdate(`${sheetName}!A1`, vals);
}

async function getBrief(projectId) {
  try {
    const projects = await getProjects();
    const project = projects.find(p => p.id === String(projectId));
    const projectName = project ? project.name : String(projectId);
    const safeName = projectName.replace(/[\\\/\?\*\[\]\:]/g, '').substring(0, 50);
    const sheetName = 'Brief_' + safeName;

    const data = await sheetsGet(`${sheetName}!A:C`);
    const rows = data.values || [];

    const reverseLabels = {};
    Object.keys(FIELD_LABELS).forEach(function(k) {
      reverseLabels[FIELD_LABELS[k]] = k;
    });

    const sectionValues = Object.values(SECTION_HEADERS);

    const result = [];
    rows.slice(1).forEach(function(r) {
      var label = r[0] || '';
      if (sectionValues.indexOf(label) !== -1) return;
      var field = reverseLabels[label];
      if (field) {
        result.push({ field: field, value: r[1] || '' });
        result.push({ field: field + '_c', value: r[2] || '' });
      }
    });
    return result;
  } catch(e) {
    try {
      const data = await sheetsGet('Briefs!A:D');
      const rows = data.values || [];
      return rows.filter(r => r[0] === String(projectId)).map(r => ({
        field: r[1] || '',
        value: r[2] || ''
      }));
    } catch(e2) { return []; }
  }
}

// ─── Google Drive ───────────────────────────────────────────────

async function driveFind(name, parentId) {
  var q = `name='${name.replace(/'/g,"\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const r = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)`,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const data = await r.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

async function driveCreateFolder(name, parentId) {
  const meta = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentId ? [parentId] : []
  };
  const r = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(meta)
    }
  );
  return r.json();
}

async function getOrCreateProjectFolder(projectName) {
  // 1. Найти или создать Rental_portal
  var root = await driveFind('Rental_portal', null);
  if (!root) {
    root = await driveCreateFolder('Rental_portal', null);
  }
  // 2. Найти или создать папку проекта внутри Rental_portal
  var folder = await driveFind(projectName, root.id);
  if (!folder) {
    folder = await driveCreateFolder(projectName, root.id);
  }
  return folder;
}
