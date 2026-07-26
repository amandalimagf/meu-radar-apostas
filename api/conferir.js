export default async function handler(req, res) {
    // 1. Configurações e Chaves
    const API_KEY = 'b9ba384b106c433686606c4dfa53261a';
    const BASE_URL = 'https://api.football-data.org/v4';
    const SUPABASE_URL = 'https://tvdwgfytguwlsppvjvkk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZHdnZnl0Z3V3bHNwcHZqdmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1Njk0OTEsImV4cCI6MjA5MjE0NTQ5MX0.mKbLRjWV3eoeAxUtMX-yY24hZQ-mN0aEtnhxk2pH5Us';

    const headersSupabase = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        // 2. Busca os jogos pendentes no banco de dados
        const respostaPendentes = await fetch(`${SUPABASE_URL}/rest/v1/partidas?resultado=is.null&id_jogo_api=not.is.null&select=*`, { headers: headersSupabase });
        const pendentes = await respostaPendentes.json();

        if (!pendentes || pendentes.length === 0) {
            return res.status(200).json({ message: 'Nenhum jogo pendente para conferir hoje.' });
        }

        let conferidos = 0;

        // 3. Verifica cada jogo na API de Futebol
        for (const aposta of pendentes) {
            const respostaJogo = await fetch(`${BASE_URL}/matches/${aposta.id_jogo_api}`, { headers: { 'X-Auth-Token': API_KEY } });
            const jogo = await respostaJogo.json();

            // 4. Se o jogo já acabou, calcula o Green ou Red
            if (jogo.status === 'FINISHED') {
                const h = jogo.score.fullTime.home;
                const a = jogo.score.fullTime.away;
                const placarString = `${h} x ${a}`;
                const totalGols = h + a;
                let deu = false;
                const s = (aposta.sugestao_aposta || '').toLowerCase();

                if (s.includes('over 2.5') && totalGols > 2.5) deu = true;
                else if (s.includes('vitória') && s.includes((aposta.time_casa || '').toLowerCase()) && h > a) deu = true;
                else if (s.includes('vitória') && s.includes((aposta.time_fora || '').toLowerCase()) && a > h) deu = true;
                else if (s.includes('ambas') && h > 0 && a > 0) deu = true;
                else if (s.includes('casa ou empate') && h >= a) deu = true;

                // 5. Salva o resultado final no Supabase
                await fetch(`${SUPABASE_URL}/rest/v1/partidas?id=eq.${aposta.id}`, {
                    method: 'PATCH',
                    headers: headersSupabase,
                    body: JSON.stringify({
                        resultado: deu ? 'green' : 'red',
                        placar: placarString
                    })
                });
                
                conferidos++;
            }
        }

        return res.status(200).json({ message: `Sucesso! ${conferidos} jogos foram atualizados no histórico.` });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}