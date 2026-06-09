const express = require('express');

const router = express.Router();

const testeRoute = require('./routes/teste');
const tutorialRoute = require('./routes/tutorial');

router.use('/teste', testeRoute);
router.use('/tutorial', tutorialRoute);

module.exports = router;
