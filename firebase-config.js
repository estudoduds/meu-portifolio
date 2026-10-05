export const firebaseConfig = {
	apiKey: 'AIzaSyBECrxBLxeEscWU2qD9emO845tC-T18G3s',
	authDomain: 'meu-laboratorio-dudu-2026.firebaseapp.com',
	projectId: 'meu-laboratorio-dudu-2026',
	appId: '1:970431158417:web:bb04683199a8d5190b4730',
	messagingSenderId: '970431158417',
};

export const firebaseConfigured = Object.values(firebaseConfig)
	.every((value) => value && !value.startsWith('COLE_'));
