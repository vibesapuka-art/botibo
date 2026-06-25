const express = require('express');

const router = express.Router();

console.log('========================');
console.log('PAINEL TESTE INICIANDO');
console.log('========================');

const testeRoute = require('./routes/teste');
const tutorialRoute = require('./routes/tutorial');

console.log('testeRoute:', typeof testeRoute);
console.log('testeRoute keys:', Object.keys(testeRoute));

console.log('tutorialRoute:', typeof tutorialRoute);
console.log('tutorialRoute keys:', Object.keys(tutorialRoute));

router.use('/teste', testeRoute);
router.use('/tutorial', tutorialRoute);

router.get('/health', (req, res) => {
    res.json({
        success: true,
        mensagem: 'Painel Teste carregado com sucesso.'
    });
});

module.exports = router;
