import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
	'https://estudoduds.github.io',
	'http://localhost:3000',
]);

function jsonResponse(body: Record<string, string>, status: number, origin: string | null) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Access-Control-Allow-Origin': origin || '*',
			'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Content-Type': 'application/json',
			'Vary': 'Origin',
		},
	});
}

Deno.serve(async (request: Request) => {
	const origin = request.headers.get('origin');
	if (origin && !allowedOrigins.has(origin)) {
		return jsonResponse({ error: 'Origem não permitida.' }, 403, null);
	}
	if (request.method === 'OPTIONS') return jsonResponse({}, 200, origin);
	if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405, origin);

	const apiUrl = Deno.env.get('SUPABASE_URL');
	const secretKey = Deno.env.get('SUPABASE_SECRET_KEY');
	const apiKey = request.headers.get('apikey');
	if (!apiUrl || !secretKey || !apiKey) {
		return jsonResponse({ error: 'Login por usuário não está configurado no servidor.' }, 503, origin);
	}

	let credentials: { username?: string; password?: string };
	try {
		credentials = await request.json();
	} catch {
		return jsonResponse({ error: 'Dados de login inválidos.' }, 400, origin);
	}

	const username = credentials.username?.trim().toLowerCase() || '';
	const password = credentials.password || '';
	if (!/^[a-z0-9_]{3,24}$/.test(username) || !password) {
		return jsonResponse({ error: 'Usuário ou senha inválidos.' }, 401, origin);
	}

	const adminClient = createClient(apiUrl, secretKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	const { data: handle, error: lookupError } = await adminClient
		.from('login_handles')
		.select('email')
		.eq('username', username)
		.maybeSingle();
	if (lookupError) {
		return jsonResponse({ error: 'Login por usuário não está configurado no banco.' }, 503, origin);
	}
	if (!handle) return jsonResponse({ error: 'Usuário ou senha inválidos.' }, 401, origin);

	const authClient = createClient(apiUrl, apiKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	const { data, error } = await authClient.auth.signInWithPassword({ email: handle.email, password });
	if (error || !data.session) {
		return jsonResponse({ error: 'Usuário ou senha inválidos.' }, 401, origin);
	}

	return new Response(JSON.stringify({ session: data.session }), {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': origin || '*',
			'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Content-Type': 'application/json',
			'Vary': 'Origin',
		},
	});
});