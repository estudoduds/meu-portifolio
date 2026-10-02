const STORAGE_KEY = 'meu-laboratorio-projetos';
const MIGRATION_KEY = 'meu-laboratorio-migracao';
const validTypes = new Set(['site', 'experimento', 'rascunho']);
const supabaseConfig = window.APP_CONFIG || {};
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey);
const supabaseClient = hasSupabaseConfig && window.supabase?.createClient
	? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
	: null;
const projectGrid = document.querySelector('#project-grid');
const projectForm = document.querySelector('#project-form');
const projectDialog = document.querySelector('#project-dialog');
const authDialog = document.querySelector('#auth-dialog');
const authForm = document.querySelector('#auth-form');
const authError = document.querySelector('#auth-error');
const authHint = document.querySelector('#auth-hint');
const accountButton = document.querySelector('#account-button');
const syncStatus = document.querySelector('#sync-status');
const searchInput = document.querySelector('#project-search');
const formError = document.querySelector('#form-error');
const dialogTitle = document.querySelector('#dialog-title');
const submitButton = projectForm.querySelector('button[type="submit"]');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
let activeFilter = 'todos';
let editingProjectId = null;
let currentUser = null;
const legacyProjects = loadProjects();
let projects = legacyProjects;

function getSafeUrl(value) {
	const url = value.trim();
	if (!url) return null;

	if (/^https?:\/\//i.test(url) || /^file:\/\//i.test(url)) {
		try {
			const parsedUrl = new URL(url);
			return ['http:', 'https:', 'file:'].includes(parsedUrl.protocol) ? parsedUrl.href : null;
		} catch {
			return null;
		}
	}

	if (/^[A-Za-z]:[\\/]/.test(url)) {
		const normalizedPath = url.replace(/\\/g, '/');
		return `file:///${normalizedPath}`;
	}

	return /^(\.\.\/|\.\/|\/)[^\s]*$/.test(url) ? url : null;
}

function loadProjects() {
	try {
		const storedProjects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
		if (!Array.isArray(storedProjects)) return [];

		return storedProjects
			.map(normalizeProject)
			.filter(Boolean);
	} catch {
		return [];
	}
}

function normalizeProject(project) {
	if (!project || typeof project.name !== 'string' || typeof project.url !== 'string') return null;
	const url = getSafeUrl(project.url);
	if (!url) return null;

	return {
		id: String(project.id || createId()),
		name: project.name,
		url,
		type: validTypes.has(project.type) ? project.type : 'site',
		description: typeof project.description === 'string' ? project.description : '',
		date: typeof project.date === 'string' ? project.date : '',
	};
}

function createId() {
	return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function storeProjects(nextProjects) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProjects));
		return true;
	} catch {
		return false;
	}
}

function setSyncStatus(message) {
	syncStatus.textContent = message;
}

function updateAccountButton() {
	accountButton.textContent = currentUser ? 'Sair da conta' : 'Entrar para sincronizar';
}

function projectForSupabase(project) {
	return { ...project, user_id: currentUser.id };
}

async function syncFromSupabase(user) {
	if (!supabaseClient || !user) return;
	setSyncStatus('Sincronizando...');
	try {
		const { data, error } = await supabaseClient
			.from('projects')
			.select('id, name, url, type, description, date')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });
		if (error) throw error;

		let remoteProjects = (data || []).map(normalizeProject).filter(Boolean);
		let migrationWasAsked = false;
		try {
			migrationWasAsked = localStorage.getItem(`${MIGRATION_KEY}:${user.id}`) === 'true';
		} catch {}
		if (remoteProjects.length === 0 && legacyProjects.length > 0 && !migrationWasAsked) {
			const shouldImport = window.confirm(`Sua conta ainda não tem projetos. Importar os ${legacyProjects.length} projeto(s) salvos neste navegador?`);
			if (shouldImport) {
				const { error: importError } = await supabaseClient
					.from('projects')
					.insert(legacyProjects.map(projectForSupabase));
				if (importError) throw importError;
				remoteProjects = [...legacyProjects];
			}
			try {
				localStorage.setItem(`${MIGRATION_KEY}:${user.id}`, 'true');
			} catch {}
		}
		projects = remoteProjects;
		setSyncStatus('Sincronizado com sua conta');
		renderProjects();
	} catch (error) {
		setSyncStatus('Falha ao sincronizar');
		window.alert(`Não foi possível carregar os projetos: ${error.message}`);
	}
}

function openAuthDialog() {
	authError.textContent = '';
	if (!supabaseClient) {
		authHint.textContent = hasSupabaseConfig
			? 'A biblioteca do Supabase não carregou. Confira sua conexão e recarregue a página.'
			: 'Configure a URL e a chave pública do Supabase em config.js para ativar a sincronização.';
		for (const button of authForm.querySelectorAll('button[type="submit"]')) button.disabled = true;
	} else {
		authHint.textContent = 'Use a mesma conta para acessar sua lista em outros dispositivos. Na primeira vez, crie uma conta.';
		for (const button of authForm.querySelectorAll('button[type="submit"]')) button.disabled = false;
	}
	authDialog.showModal();
}

async function saveProject(project, isEditing, nextProjects) {
	if (supabaseClient) {
		if (!currentUser) return false;
		try {
			const query = isEditing
				? supabaseClient.from('projects').update(projectForSupabase(project)).eq('id', project.id).eq('user_id', currentUser.id).select('id')
				: supabaseClient.from('projects').insert(projectForSupabase(project));
			const { data, error } = await query;
			if (error) throw error;
			if (isEditing && !data?.length) throw new Error('Projeto não encontrado na sua conta. Atualize a página e tente novamente.');
			setSyncStatus('Sincronizado com sua conta');
			return true;
		} catch (error) {
			setSyncStatus('Falha ao salvar na nuvem');
			formError.textContent = `Não foi possível salvar no Supabase: ${error.message}`;
			return false;
		}
	}

	return storeProjects(nextProjects);
}

function makeElement(tag, className, text) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

function createProjectCard(project) {
	const card = makeElement('article', 'project-card');
	card.dataset.type = project.type;

	const header = makeElement('div', 'card-top');
	const type = makeElement('span', 'project-type');
	type.append(makeElement('span', 'type-dot'));
	type.append(document.createTextNode(project.type));

	const actions = makeElement('div', 'card-actions');
	const date = makeElement('span', 'project-date', project.date || 'recente');
	const editButton = makeElement('button', 'edit-button', '✎');
	editButton.type = 'button';
	editButton.title = 'Editar projeto';
	editButton.setAttribute('aria-label', `Editar ${project.name}`);
	editButton.addEventListener('click', () => openProjectDialog(project));
	const removeButton = makeElement('button', 'remove-button', '×');
	removeButton.type = 'button';
	removeButton.title = 'Remover projeto';
	removeButton.setAttribute('aria-label', `Remover ${project.name}`);
	removeButton.addEventListener('click', () => removeProject(project));
	actions.append(date, editButton, removeButton);
	header.append(type, actions);

	const title = makeElement('h3', '', project.name);
	const description = makeElement('p', 'project-description', project.description || 'Sem descrição.');
	const link = makeElement('a', 'card-link');
	link.href = project.url;
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
	link.addEventListener('click', (event) => {
		if (project.url.startsWith('file://')) {
			event.preventDefault();
			window.open(project.url, '_blank', 'noopener,noreferrer');
		}
	});
	link.append(makeElement('span', '', 'Abrir projeto ↗'));
	link.append(makeElement('span', 'card-url', project.url));

	card.append(header, title, description, link);
	return card;
}

async function removeProject(project) {
	if (supabaseClient && !currentUser) {
		openAuthDialog();
		return;
	}
	if (!window.confirm(`Remover "${project.name}" da sua lista?`)) return;

	const nextProjects = projects.filter((item) => item.id !== project.id);
	if (supabaseClient) {
		try {
			const { error } = await supabaseClient
				.from('projects')
				.delete()
				.eq('id', project.id)
				.eq('user_id', currentUser.id);
			if (error) throw error;
			setSyncStatus('Sincronizado com sua conta');
		} catch (error) {
			setSyncStatus('Falha ao remover da nuvem');
			window.alert(`Não foi possível remover o projeto: ${error.message}`);
			return;
		}
	} else if (!storeProjects(nextProjects)) {
		window.alert('Não foi possível atualizar a lista salva neste navegador.');
		return;
	}

	projects = nextProjects;
	renderProjects();
}

function renderEmptyState(hasSearch) {
	const emptyState = makeElement('div', 'empty-state');
	const content = makeElement('div');
	const hasFilter = activeFilter !== 'todos';
	const mark = makeElement('div', 'empty-mark', hasSearch || hasFilter ? '⌕' : '+');
	const title = makeElement('h3', '', hasSearch || hasFilter ? 'Nenhum projeto encontrado' : 'Sua lista começa aqui');
	const description = makeElement(
		'p',
		'',
		hasSearch || hasFilter
			? 'Tente mudar o filtro ou buscar por outro termo.'
			: 'Adicione o primeiro site ou experimento para deixar tudo organizado num só lugar.',
	);
	content.append(mark, title, description);

	if (!hasSearch && !hasFilter) {
		const addButton = makeElement('button', 'empty-action', 'Adicionar meu primeiro projeto');
		addButton.type = 'button';
		addButton.addEventListener('click', openProjectDialog);
		content.append(addButton);
	}

	emptyState.append(content);
	projectGrid.append(emptyState);
}

function renderProjects() {
	const query = searchInput.value.trim().toLocaleLowerCase('pt-BR');
	const visibleProjects = projects.filter((project) => {
		const matchesFilter = activeFilter === 'todos' || project.type === activeFilter;
		const searchableText = `${project.name} ${project.description} ${project.url}`.toLocaleLowerCase('pt-BR');
		return matchesFilter && searchableText.includes(query);
	});

	document.querySelector('#project-count').textContent = projects.length;
	document.querySelector('#site-count').textContent = projects.filter((project) => project.type === 'site').length;
	document.querySelector('#experiment-count').textContent = projects.filter((project) => project.type === 'experimento').length;
	document.querySelector('#all-count').textContent = projects.length;
	document.querySelector('#active-filter-label').textContent = activeFilter === 'todos'
		? 'Todos os projetos'
		: activeFilter === 'site' ? 'Sites' : 'Experimentos';
	projectGrid.replaceChildren();

	if (visibleProjects.length) {
		visibleProjects.forEach((project) => projectGrid.append(createProjectCard(project)));
	} else {
		renderEmptyState(Boolean(query));
	}
}

function resetProjectFormState() {
	projectForm.reset();
	editingProjectId = null;
	dialogTitle.textContent = 'Adicionar projeto';
	submitButton.textContent = 'Salvar projeto';
	formError.textContent = '';
}

function openProjectDialog(project = null) {
	if (supabaseClient && !currentUser) {
		openAuthDialog();
		return;
	}
	formError.textContent = '';

	if (project) {
		editingProjectId = project.id;
		dialogTitle.textContent = 'Editar projeto';
		submitButton.textContent = 'Salvar alterações';
		projectForm.elements.name.value = project.name;
		projectForm.elements.url.value = project.url;
		projectForm.elements.type.value = project.type;
		projectForm.elements.description.value = project.description;
	} else {
		resetProjectFormState();
	}

	projectDialog.showModal();
	projectForm.elements.name.focus();
}

document.querySelector('#add-project').addEventListener('click', () => openProjectDialog());
document.querySelector('#close-dialog').addEventListener('click', () => projectDialog.close());
document.querySelector('#cancel-dialog').addEventListener('click', () => projectDialog.close());
document.querySelector('#close-auth-dialog').addEventListener('click', () => authDialog.close());

accountButton.addEventListener('click', async () => {
	if (!currentUser) {
		openAuthDialog();
		return;
	}

	const { error } = await supabaseClient.auth.signOut();
	if (error) {
		setSyncStatus('Não foi possível sair da conta');
		window.alert(`Não foi possível sair da conta: ${error.message}`);
		return;
	}
	currentUser = null;
	projects = [];
	updateAccountButton();
	setSyncStatus('Entre para sincronizar');
	renderProjects();
});

authForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	if (!supabaseClient) return;

	authError.textContent = '';
	const formData = new FormData(authForm);
	const credentials = {
		email: String(formData.get('email') || '').trim(),
		password: String(formData.get('password') || ''),
	};
	const isSignup = event.submitter?.dataset.authAction === 'signup';
	const result = isSignup
		? await supabaseClient.auth.signUp({
			...credentials,
			options: { emailRedirectTo: window.location.origin },
		})
		: await supabaseClient.auth.signInWithPassword(credentials);

	if (result.error) {
		authError.textContent = result.error.message;
		return;
	}
	if (isSignup && !result.data.session) {
		authHint.textContent = 'Conta criada. Confirme o e-mail enviado pelo Supabase e depois entre.';
		return;
	}

	currentUser = result.data.user;
	updateAccountButton();
	authDialog.close();
	await syncFromSupabase(currentUser);
});

projectDialog.addEventListener('click', (event) => {
	if (event.target === projectDialog) projectDialog.close();
});

projectDialog.addEventListener('close', () => {
	resetProjectFormState();
});

projectForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	const formData = new FormData(projectForm);
	const url = getSafeUrl(String(formData.get('url') || ''));
	if (!url) {
		formError.textContent = 'Use um link http(s), um caminho relativo, como ./meu-site/index.html, ou um caminho local do Windows, como C:\\Users\\seu-nome\\site\\index.html.';
		projectForm.elements.url.focus();
		return;
	}

	const nextProject = {
		id: editingProjectId || createId(),
		name: String(formData.get('name') || '').trim(),
		url,
		type: String(formData.get('type') || 'site'),
		description: String(formData.get('description') || '').trim(),
		date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date()).replace(/\.$/, ''),
	};

	const nextProjects = editingProjectId
		? projects.map((project) => (project.id === editingProjectId ? { ...project, ...nextProject } : project))
		: [nextProject, ...projects];

	const saved = await saveProject(nextProject, Boolean(editingProjectId), nextProjects);
	if (!saved) {
		if (!supabaseClient) formError.textContent = 'Não foi possível salvar neste navegador. Verifique o espaço disponível.';
		return;
	}

	projects = nextProjects;
	if (supabaseClient) setSyncStatus('Sincronizado com sua conta');
	activeFilter = 'todos';
	searchInput.value = '';
	filterButtons.forEach((button) => {
		const isActive = button.dataset.filter === activeFilter;
		button.classList.toggle('is-active', isActive);
		button.setAttribute('aria-pressed', String(isActive));
	});
	renderProjects();
	resetProjectFormState();
	projectDialog.close();
});

filterButtons.forEach((button) => {
	button.addEventListener('click', () => {
		activeFilter = button.dataset.filter;
		filterButtons.forEach((item) => {
			const isActive = item === button;
			item.classList.toggle('is-active', isActive);
			item.setAttribute('aria-pressed', String(isActive));
		});
		renderProjects();
	});
});

searchInput.addEventListener('input', renderProjects);
document.querySelector('#clear-search').addEventListener('click', () => {
	searchInput.value = '';
	activeFilter = 'todos';
	filterButtons.forEach((button) => {
		const isActive = button.dataset.filter === activeFilter;
		button.classList.toggle('is-active', isActive);
		button.setAttribute('aria-pressed', String(isActive));
	});
	renderProjects();
});

const today = document.querySelector('#today');
today.textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date());
today.dateTime = new Date().toISOString().slice(0, 10);

async function initializeSupabaseSync() {
	if (!supabaseClient) {
		setSyncStatus(hasSupabaseConfig ? 'Sincronização indisponível' : 'Somente neste navegador');
		return;
	}

	projects = [];
	renderProjects();
	setSyncStatus('Verificando sua conta...');
	supabaseClient.auth.onAuthStateChange((event, session) => {
		if (event === 'INITIAL_SESSION') return;
		window.setTimeout(() => {
			if (!session) {
				currentUser = null;
				projects = [];
				updateAccountButton();
				setSyncStatus('Entre para sincronizar');
				renderProjects();
				return;
			}
			if (currentUser?.id === session.user.id) return;
			currentUser = session.user;
			updateAccountButton();
			void syncFromSupabase(currentUser);
		}, 0);
	});

	const { data, error } = await supabaseClient.auth.getSession();
	if (error) {
		setSyncStatus('Não foi possível conectar ao Supabase');
		return;
	}
	if (data.session) {
		currentUser = data.session.user;
		updateAccountButton();
		await syncFromSupabase(currentUser);
	} else {
		setSyncStatus('Entre para sincronizar');
	}
}

window.addEventListener('focus', () => {
	if (currentUser) void syncFromSupabase(currentUser);
});
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'visible' && currentUser) void syncFromSupabase(currentUser);
});

if (supabaseClient) projects = [];
renderProjects();
void initializeSupabaseSync();
