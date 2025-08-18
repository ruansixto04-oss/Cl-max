const axios = require('axios');

async function fetchApiData(requestConfig) {
    try {
        const response = await axios(requestConfig);
        return response.data;
    } catch (error) {
        console.error(`Falha controlada em: ${requestConfig.url}. Status: ${error.response?.status}. Detalhes: ${error.message}`);
        return { error: true, status: error.response?.status };
    }
}

module.exports = async (req, res) => {
    try {
        console.log("--- INICIANDO /api/login ---");

        if (req.method !== 'POST') { return res.status(405).json({ error: 'Método não permitido.' }); }
        const { user, senha } = req.body;
        if (!user || !senha) { return res.status(400).json({ error: 'RA e Senha são obrigatórios.' }); }
        
        // Fase 1: Autenticação
        const loginResponse = await axios.post("https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken", { user, senha }, { headers: { "Ocp-Apim-Subscription-Key": "2b03c1db3884488795f79c37c069381a" } });
        if (!loginResponse.data || !loginResponse.data.token) { return res.status(401).json({ error: 'Credenciais inválidas ou resposta inesperada da SED.' }); }
        const tokenA = loginResponse.data.token;
        const userInfo = loginResponse.data.DadosUsuario;
        
        // Fase 2: Troca de Token
        const exchangeResponse = await axios.post("https://edusp-api.ip.tv/registration/edusp/token", { token: tokenA }, { headers: { "Content-Type": "application/json", "x-api-realm": "edusp", "x-api-platform": "webclient" } });
        if (!exchangeResponse.data || !exchangeResponse.data.auth_token) { return res.status(500).json({ error: 'Falha ao obter o token secundário (Token B).' }); }
        const tokenB = exchangeResponse.data.auth_token;
        
        console.log("Fase 3: Buscando dados em paralelo...");

        // **MUDANÇA AQUI:** A busca de turmas (rooms) é crucial, então a fazemos primeiro e de forma separada.
        const roomUserData = await fetchApiData({
            method: 'get',
            url: 'https://edusp-api.ip.tv/room/user?list_all=true&with_cards=true',
            headers: { "x-api-key": tokenB, "Referer": "https://saladofuturo.educacao.sp.gov.br/" }
        });

        let publicationTargetsQuery = '';
        if (roomUserData && !roomUserData.error && roomUserData.rooms) {
            const targets = roomUserData.rooms.flatMap(room => [room.publication_target, room.name, ...(room.group_categories?.map(g => g.id) || [])]);
            publicationTargetsQuery = [...new Set(targets)].map(target => `publication_target[]=${encodeURIComponent(target)}`).join('&');
        }
        
        const baseTaskUrl = `https://edusp-api.ip.tv/tms/task/todo?limit=100&with_answer=true&${publicationTargetsQuery}`;
        const pendingTasksUrl = `${baseTaskUrl}&expired_only=false&answer_statuses=pending&answer_statuses=draft`;
        const expiredTasksUrl = `${baseTaskUrl}&expired_only=true&answer_statuses=pending&answer_statuses=draft`;
        
        const anoLetivo = new Date().getFullYear();

        const requests = [
            // **MUDANÇA CRÍTICA AQUI:** Usando o endpoint do Diário de Classe, que é mais confiável para faltas.
            fetchApiData({
                method: 'GET',
                url: `https://sed.educacao.sp.gov.br/DiarioClasse/api/Frequencia/FaltasAluno?anoLetivo=${anoLetivo}&cdAluno=${userInfo.CD_USUARIO}`,
                headers: { "Authorization": `Bearer ${tokenA}` }
            }),
            fetchApiData({ method: 'get', url: pendingTasksUrl, headers: { "x-api-key": tokenB } }),
            fetchApiData({ method: 'get', url: expiredTasksUrl, headers: { "x-api-key": tokenB } }),
        ];

        const [faltasData, pendingTasks, expiredTasks] = await Promise.all(requests);
        console.log("Fase 3: Dados em paralelo concluídos.");
        
        // Processamento Aprimorado de Faltas
        let faltasFormatado = [];
        let totalFaltasCalculado = 0;
        if (faltasData && !faltasData.error && Array.isArray(faltasData)) {
            // A nova API retorna um array, e somamos o campo `NumeroFaltas` de cada entrada
            faltasData.forEach(falta => {
                totalFaltasCalculado += (falta.NumeroFaltas || 0);
            });
        }
        faltasFormatado.push({ totalFaltasBimestre: totalFaltasCalculado });
        
        // Unificação das tarefas
        const allTasksRaw = (Array.isArray(pendingTasks) ? pendingTasks : []).concat(Array.isArray(expiredTasks) ? expiredTasks : []);
        const allTasks = [...new Map(allTasksRaw.map(task => [task.id, task])).values()];

        const dashboardData = {
            userInfo,
            roomUserData, // **MUDANÇA AQUI:** Garantindo que os dados das turmas sejam enviados ao frontend
            faltas: faltasFormatado,
            tarefas: allTasks
        };
        
        console.log("--- FIM /api/login: Sucesso ---");
        res.status(200).json(dashboardData);

    } catch (error) {
        console.error("--- ERRO FATAL NA FUNÇÃO /api/login ---", error.response?.data || error.message);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || 'Ocorreu um erro fatal no servidor.';
        res.status(status).json({ error: message, details: error.message });
    }
};
            
