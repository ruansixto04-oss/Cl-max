// Em /api/get-delivered-tasks.js
const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { tokenB, nick, publicationTargets } = req.body;
    if (!tokenB || !nick || !publicationTargets) {
        return res.status(400).json({ error: 'tokenB, nick e publicationTargets são obrigatórios.' });
    }

    // Monta a URL base para buscar as respostas
    let url = `https://edusp-api.ip.tv/tms/answer?nick=${nick}&limit=100&status=finished&status=submitted`;

    // Adiciona todos os publication_targets à URL
    publicationTargets.forEach(target => {
        url += `&publication_target[]=${encodeURIComponent(target)}`;
    });

    const headers = {
        'accept': 'application/json',
        'x-api-key': tokenB,
        'x-api-platform': 'webclient',
        'x-api-realm': 'edusp',
    };

    try {
        console.log(`Buscando tarefas entregues...`);
        const { data } = await axios.get(url, { headers });
        console.log(`Encontradas ${data.length} tarefas entregues.`);
        res.status(200).json(data);
    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`Falha ao buscar tarefas entregues. Detalhes: ${errorDetails}`);
        res.status(error.response?.status || 500).json({ 
            error: 'Falha ao buscar tarefas entregues.',
            details: error.response?.data || error.message
        });
    }
};
  
