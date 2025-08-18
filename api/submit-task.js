const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    const { taskId, tokenB, payload } = req.body;

    if (!taskId || !tokenB || !payload) {
        return res.status(400).json({ error: 'Payload de submissão inválido. Faltam taskId, tokenB ou payload.' });
    }

    const submitUrl = `https://edusp-api.ip.tv/tms/task/${taskId}/answer`;

    const headers = {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'x-api-realm': 'edusp',
        'x-api-platform': 'webclient',
        'x-api-key': tokenB,
        'origin': 'https://saladofuturo.educacao.sp.gov.br',
        'referer': 'https://saladofuturo.educacao.sp.gov.br/'
    };

    try {
        console.log(`Enviando respostas para a tarefa ${taskId}...`);
        const submitResponse = await axios.post(submitUrl, payload, { headers });

        console.log(`Tarefa ${taskId} enviada com sucesso!`);
        res.status(200).json(submitResponse.data);

    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`Falha ao submeter a tarefa ${taskId}. Detalhes: ${errorDetails}`);
        res.status(error.response?.status || 500).json({ 
            error: `Falha ao submeter a tarefa.`, 
            details: error.response?.data || error.message
        });
    }
};
