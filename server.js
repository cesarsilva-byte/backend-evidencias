const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Conectado a MongoDB Atlas'))
  .catch(err => console.error('Error de conexión:', err));

// Se agrega el campo 'applies' al esquema con valor por defecto 'true'
const NoteSchema = new mongoose.Schema({
  evidenceGuid: { type: String, required: true, unique: true },
  note: { type: String, default: "" },
  applies: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', NoteSchema);

// Obtener todas las notas y estados de auditoría
app.get('/api/notes', async (req, res) => {
  try {
    const notes = await Note.find();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Guardar o actualizar la nota y/o el check de auditoría
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
