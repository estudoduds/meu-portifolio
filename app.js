const STORAGE_KEY = 'meu-laboratorio-projetos';
const validTypes = new Set(['site', 'experimento', 'rascunho']);
const projectGrid = document.querySelector('#project-grid');
const projectForm = document.querySelector('#project-form');
const projectDialog = document.querySelector('#project-dialog');
const searchInput = document.querySelector('#project-search');
const formError = document.querySelector('#form-error');
const dialogTitle = document.querySelector('#dialog-title');
const submitButton = projectForm.querySelector('button[type="submit"]');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
let activeFilter = 'todos';
let editingProjectId = null;
let projects = loadProjects();

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
			.filter((project) => project && typeof project.name === 'string' && typeof project.url === 'string')
			.map((project) => ({
				id: String(project.id || createId()),
				name: project.name,
				url: getSafeUrl(project.url),
				type: validTypes.has(project.type) ? project.type : 'site',
				description: typeof project.description === 'string' ? project.description : '',
				date: typeof project.date === 'string' ? project.date : '',
			}))
			.filter((project) => project.url);
	} catch {
		return [];
	}
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

function removeProject(project) {
	if (!window.confirm(`Remover "${project.name}" da sua lista?`)) return;

	const nextProjects = projects.filter((item) => item.id !== project.id);
	if (!storeProjects(nextProjects)) {
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

projectDialog.addEventListener('click', (event) => {
	if (event.target === projectDialog) projectDialog.close();
});

projectDialog.addEventListener('close', () => {
	resetProjectFormState();
});

projectForm.addEventListener('submit', (event) => {
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

	if (!storeProjects(nextProjects)) {
		formError.textContent = 'Não foi possível salvar neste navegador. Verifique o espaço disponível.';
		return;
	}

	projects = nextProjects;
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
renderProjects();
