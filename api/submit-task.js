module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido.' });
    }
    
    const { taskId, tokenB, payload } = req.body;
    if (!taskId || !tokenB || !payload) {
        return res.status(400).json({ error: 'Payload de submissão inválido.' });
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
        const fetchResponse = await fetch(submitUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        const contentType = fetchResponse.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             console.error(`Resposta inesperada (não-JSON) da API oficial para taskId: ${taskId}`);
             return res.status(502).json({ error: "A API oficial retornou uma resposta em formato inválido (HTML/texto)." });
        }

        const data = await fetchResponse.json();

        if (!fetchResponse.ok) {
            console.error(`Resposta de erro da API oficial para taskId: ${taskId}`, data);
            return res.status(fetchResponse.status).json({ error: "A API oficial retornou um erro.", details: data });
        }
        
        res.status(200).json(data);

    } catch (error) {
        console.error(`Falha crítica em enviar-tarefa para taskId ${taskId}:`, error.message);
        res.status(500).json({ error: `Falha crítica ao submeter a tarefa.`, details: error.message });
    }
};
