require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const testeRoute = require('./routes/teste');
const tutorialRoute = require('./routes/tutorial');
const evolutionRoute = require('./routes/evolution');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/teste', testeRoute);
app.use('/api/tutorial', tutorialRoute);
app.use('/api/evolution', evolutionRoute);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
