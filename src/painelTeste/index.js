const express = require('express');

const testeRoute = require('./routes/teste');
const tutorialRoute = require('./routes/tutorial');

const router = express.Router();

router.use('/teste', testeRoute);
router.use('/tutorial', tutorialRoute);

module.exports = router;
