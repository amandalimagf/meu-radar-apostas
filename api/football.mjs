const API_BASE_URL = 'https://v3.football.api-sports.io';

function respostaJson(conteudo, status = 200, cacheSeconds = 0) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (status >= 200 && status < 300 && cacheSeconds > 0) {
    headers['Vercel-CDN-Cache-Control'] = `s-maxage=${cacheSeconds}, stale-while-revalidate=60`;
  }

  return new Response(JSON.stringify(conteudo), { status, headers });
}

function inteiroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function possuiErrosDaApi(errors) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors).length > 0;
  return Boolean(errors);
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return respostaJson({ erro: 'Método não permitido.' }, 405);
    }

    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return respostaJson(
        {
          erro: 'A variável API_FOOTBALL_KEY não está configurada na Vercel.',
        },
        500,
      );
    }

    try {
      const urlRecebida = new URL(request.url);
      const acao = urlRecebida.searchParams.get('action');

      let endpoint = '';
      let cacheSeconds = 0;

      if (acao === 'fixtures') {
        const liga = inteiroPositivo(urlRecebida.searchParams.get('league'));
        const limiteSolicitado = inteiroPositivo(
          urlRecebida.searchParams.get('limit') || '15',
        );
        const limite = limiteSolicitado
          ? Math.min(Math.max(limiteSolicitado, 1), 20)
          : 15;

        if (!liga) {
          return respostaJson({ erro: 'ID da liga inválido.' }, 400);
        }

        const parametros = new URLSearchParams({
          league: String(liga),
          next: String(limite),
          timezone: 'America/Fortaleza',
        });

        endpoint = `/fixtures?${parametros.toString()}`;
        cacheSeconds = 180;
      } else if (acao === 'standings') {
        const liga = inteiroPositivo(urlRecebida.searchParams.get('league'));
        const temporada = inteiroPositivo(
          urlRecebida.searchParams.get('season'),
        );

        const anoLimite = new Date().getUTCFullYear() + 1;

        if (!liga) {
          return respostaJson({ erro: 'ID da liga inválido.' }, 400);
        }

        if (!temporada || temporada < 1900 || temporada > anoLimite) {
          return respostaJson({ erro: 'Temporada inválida.' }, 400);
        }

        const parametros = new URLSearchParams({
          league: String(liga),
          season: String(temporada),
        });

        endpoint = `/standings?${parametros.toString()}`;
        cacheSeconds = 3600;
      } else {
        return respostaJson(
          { erro: 'Ação inválida. Use fixtures ou standings.' },
          400,
        );
      }

      const respostaApi = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey,
          Accept: 'application/json',
        },
      });

      const texto = await respostaApi.text();
      let dados;

      try {
        dados = texto ? JSON.parse(texto) : {};
      } catch {
        return respostaJson(
          {
            erro: 'A API-Football devolveu uma resposta inválida.',
            statusApi: respostaApi.status,
          },
          502,
        );
      }

      if (!respostaApi.ok || possuiErrosDaApi(dados.errors)) {
        return respostaJson(
          {
            erro: 'A API-Football recusou a solicitação.',
            statusApi: respostaApi.status,
            detalhes: dados.errors || dados.message || 'Erro não informado.',
          },
          respostaApi.ok ? 502 : respostaApi.status,
        );
      }

      return respostaJson(dados, 200, cacheSeconds);
    } catch (erro) {
      console.error('Erro na função football:', erro);

      return respostaJson(
        {
          erro: 'Não foi possível consultar a API-Football.',
          detalhes: erro instanceof Error ? erro.message : String(erro),
        },
        500,
      );
    }
  },
};
