const express = require('express');

const router = express.Router();

console.log('========================');
console.log('PAINEL TESTE INICIANDO');
console.log('========================');

const testeRoute = require('./routes/teste');

console.log('testeRoute:', typeof testeRoute);
console.log('testeRoute keys:', Object.keys(testeRoute));

router.use('/teste', testeRoute);

module.exports = router;
