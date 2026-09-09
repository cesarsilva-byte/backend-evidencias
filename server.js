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

const NoteSchema = new mongoose.Schema({
  evidenceGuid: { type: String, required: true, unique: true },
  note: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const Note = mongoose.model('Note', NoteSchema);

app.get('/api/notes', async (req, res) => {
  try {
    const notes = await Note.find();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', async (req, res) => {
  const { evidenceGuid, note } = req.body;
  if (!evidenceGuid) return res.status(400).json({ error: "Falta evidenceGuid" });

  try {
    const updatedNote = await Note.findOneAndUpdate(
      { evidenceGuid },
      { note, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: updatedNote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));