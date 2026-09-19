const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI;

// Almacena el token en memoria (o usa process.env.HACKMETRIX_TOKEN si lo configuras)
let HACKMETRIX_TOKEN = process.env.HACKMETRIX_TOKEN || '';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch(err => console.error('Error de conexión:', err));

const NoteSchema = new mongoose.Schema({
  evidenceGuid: { type: String, required: true, unique: true },
  note: { type: String, default: "" },
  applies: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', NoteSchema);

// 1. Endpoint para que el Bot actualice el token automáticamente
app.post('/api/token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Falta el token Bearer" });
  
  HACKMETRIX_TOKEN = token;
  console.log(`[${new Date().toISOString()}] Token Bearer actualizado correctamente.`);
  res.json({ success: true, message: "Token actualizado correctamente en el servidor." });
});

// 2. Endpoint proxy para consultar evidencias en Hackmetrix desde Node.js
app.get('/api/evidences', async (req, res) => {
  if (!HACKMETRIX_TOKEN) {
    return res.status(401).json({ error: "No hay un token de Hackmetrix activo en el servidor. Ejecuta la autenticación." });
  }

  try {
    let page = 1;
    let totalPages = 1;
    let allEvidences = [];

    do {
      const url = `https://multiframework.hackmetrix.com/evidence/getEvidenceListWithParams?search=%22%22&frameworkGuids=%5B%5D&activityGuids=%5B%5D&totalEvidences=133&perPage=50&page=${page}`;
      
      const response = await fetch(url, {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'authorization': `Bearer ${HACKMETRIX_TOKEN}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error en API Hackmetrix: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const evidences = result.data?.evidences || [];
      allEvidences = allEvidences.concat(evidences);
      totalPages = result.data?.pagination?.totalPages || 1;
      page++;

    } while (page <= totalPages);

    res.json(allEvidences);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoints de Notas (MongoDB)
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await Note.find();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', async (req, res) => {
  const { evidenceGuid, note, applies } = req.body;
  if (!evidenceGuid) return res.status(400).json({ error: "Falta evidenceGuid" });

  try {
    const updateFields = { updatedAt: Date.now() };
    if (note !== undefined) updateFields.note = note;
    if (applies !== undefined) updateFields.applies = applies;

    const updatedNote = await Note.findOneAndUpdate(
      { evidenceGuid },
      updateFields,
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updatedNote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/refresh-token-now', async (req, res) => {
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const REPO_OWNER = 'cesarsilva-byte';
  const REPO_NAME = 'bot-hackmetrix';
  const WORKFLOW_ID = 'daily-auth.yml';

  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_PAT}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Render-Backend'
        },
        body: JSON.stringify({ ref: 'main' })
      }
    );

    if (response.status === 204) {
      return res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #2da44e;">🚀 Bot Iniciado Exitosamente</h1>
          <p>GitHub Actions está ejecutando el bot para renovar el token de Hackmetrix en segundo plano.</p>
          <p><small>El proceso tardará entre 15 y 30 segundos.</small></p>
        </div>
      `);
    }

    const errorData = await response.text();
    return res.status(response.status).send(`<h1>Error al iniciar el Bot</h1><pre>${errorData}</pre>`);

  } catch (error) {
    return res.status(500).send(`<h1>Error Interno</h1><p>${error.message}</p>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
