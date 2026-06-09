const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/ping', async (req, res) => {
  try {

    if (!process.env.EVOLUTION_URL) {
      return res.json({
        success: false,
        mensagem: 'Evolution não configurada.'
      });
    }

    await axios.get(process.env.EVOLUTION_URL, {
      timeout: 45000
    });

    return res.json({
      success: true,
      mensagem: 'Evolution acordada.'
    });

  } catch (error) {

    console.error(
      'Erro ao acordar Evolution:',
      error.response?.data || error.message
    );

    return res.json({
      success: false,
      mensagem: 'Evolution demorou para responder.'
    });
  }
});

module.exports = router;
