import { firebaseConfig, firebaseConfigured } from './firebase-config.js';

const sdkVersion = '12.4.0';
let auth;
let database;
let authSdk;
let firestoreSdk;

export { firebaseConfigured };

export async function initializeFirebase() {
	if (!firebaseConfigured) throw new Error('Firebase configuration is missing.');
	if (auth && database) return;

	const [appSdk, loadedAuthSdk, loadedFirestoreSdk] = await Promise.all([
		import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-app.js`),
		import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-auth.js`),
		import(`https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-firestore.js`),
	]);

	const app = appSdk.initializeApp(firebaseConfig);
	authSdk = loadedAuthSdk;
	firestoreSdk = loadedFirestoreSdk;
	auth = authSdk.getAuth(app);
	database = firestoreSdk.getFirestore(app);
}

export function watchAuthState(callback) {
	return authSdk.onAuthStateChanged(auth, callback);
}

export function signInWithGoogle() {
	const provider = new authSdk.GoogleAuthProvider();
	if (globalThis.location.hostname.endsWith('github.io')) {
		return authSdk.signInWithPopup(auth, provider);
	}

	return authSdk.signInWithRedirect(auth, provider);
}

export function signOutUser() {
	return authSdk.signOut(auth);
}

function projectsDocument(userId) {
	return firestoreSdk.doc(database, 'users', userId, 'workspace', 'projects');
}

export function watchProjects(userId, onProjects, onError) {
	return firestoreSdk.onSnapshot(projectsDocument(userId), (snapshot) => {
		const items = snapshot.exists() ? snapshot.data().items : [];
		onProjects(Array.isArray(items) ? items : []);
	}, onError);
}

export function saveProjectsToCloud(userId, projects) {
	return firestoreSdk.setDoc(projectsDocument(userId), {
		items: projects,
		updatedAt: firestoreSdk.serverTimestamp(),
	});
}
