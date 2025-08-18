const axios = require('axios');

module.exports = async (req, res) => {
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Método não permitido.' }); }
    
    // Agora recebemos também o answerId e o novo submitType
    const { taskId, tokenB, payload, answerId, submitType } = req.body;
    
    if (!taskId || !tokenB || !payload || !answerId) {
        return res.status(400).json({ error: 'Payload de submissão inválido.' });
    }

    const submitUrl = `https://edusp-api.ip.tv/tms/task/${taskId}/answer/${answerId}`;
    
    // Se o tipo for 'draft', mantemos o status, senão, mudamos para 'finished'
    if (submitType !== 'draft') {
        payload.status = 'finished';
    }

    const headers = {
        'Content-Type': 'application/json', 'x-api-key': tokenB, 'x-api-realm': 'edusp',
        'x-api-platform': 'webclient', 'origin': 'https://saladofuturo.educacao.sp.gov.br',
        'referer': 'https://saladofuturo.educacao.sp.gov.br/'
    };
    
    try {
        console.log(`Atualizando (PUT) a tarefa ${taskId} com status: ${payload.status}`);
        const submitResponse = await axios.put(submitUrl, payload, { headers });
        
        console.log(`Tarefa ${taskId} atualizada com sucesso!`);
        res.status(200).json(submitResponse.data);
    } catch (error) {
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`Falha ao submeter a tarefa ${taskId}. Detalhes: ${errorDetails}`);
        res.status(error.response?.status || 500).json({ 
            error: `Falha ao submeter a tarefa.`, 
            details: error.response?.data || "Erro desconhecido"
        });
    }
};
                                                       
