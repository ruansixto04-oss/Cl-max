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
        
        const loginResponse = await axios.post("https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken", { user, senha }, { headers: { "Ocp-Apim-Subscription-Key": "2b03c1db3884488795f79c37c069381a" } });
        if (!loginResponse.data || !loginResponse.data.token) { return res.status(401).json({ error: 'Credenciais inválidas.' }); }
        const tokenA = loginResponse.data.token;
        const userInfo = loginResponse.data.DadosUsuario;
        
        const exchangeResponse = await axios.post("https://edusp-api.ip.tv/registration/edusp/token", { token: tokenA }, { headers: { "Content-Type": "application/json", "x-api-realm": "edusp", "x-api-platform": "webclient" } });
        if (!exchangeResponse.data || !exchangeResponse.data.auth_token) { return res.status(500).json({ error: 'Falha ao obter o token secundário (Token B).' }); }
        const tokenB = exchangeResponse.data.auth_token;
        
        // **MUDANÇA CRÍTICA AQUI**
        // Capturamos o `nick` correto da resposta da troca de token e o adicionamos ao `userInfo`.
        userInfo.EDUSP_NICK = exchangeResponse.data.nick;
        
        console.log("Fase 3: Buscando dados...");
        const roomUserData = await fetchApiData({
            method: 'get', url: 'https://edusp-api.ip.tv/room/user?list_all=true&with_cards=true',
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
            fetchApiData({ method: 'GET', url: `https://sed.educacao.sp.gov.br/DiarioClasse/api/Frequencia/FaltasAluno?anoLetivo=${anoLetivo}&cdAluno=${userInfo.CD_USUARIO}`, headers: { "Authorization": `Bearer ${tokenA}` } }),
            fetchApiData({ method: 'get', url: pendingTasksUrl, headers: { "x-api-key": tokenB } }),
            fetchApiData({ method: 'get', url: expiredTasksUrl, headers: { "x-api-key": tokenB } }),
        ];

        const [faltasData, pendingTasks, expiredTasks] = await Promise.all(requests);
        
        let faltasFormatado = [];
        let totalFaltasCalculado = 0;
        if (faltasData && !faltasData.error && Array.isArray(faltasData)) {
            faltasData.forEach(falta => { totalFaltasCalculado += (falta.NumeroFaltas || 0); });
        }
        faltasFormatado.push({ totalFaltasBimestre: totalFaltasCalculado });
        
        const allTasksRaw = (Array.isArray(pendingTasks) ? pendingTasks : []).concat(Array.isArray(expiredTasks) ? expiredTasks : []);
        const allTasks = [...new Map(allTasksRaw.map(task => [task.id, task])).values()];

        const dashboardData = { tokenB, userInfo, roomUserData, faltas: faltasFormatado, tarefas: allTasks };
        
        console.log("--- FIM /api/login: Sucesso ---");
        res.status(200).json(dashboardData);
    } catch (error) {
        console.error("--- ERRO FATAL NA FUNÇÃO /api/login ---", error.response?.data || error.message);
        const status = error.response?.status || 500;
        const message = error.response?.data?.error || 'Ocorreu um erro fatal no servidor.';
        res.status(status).json({ error: message, details: error.message });
    }
};
    
