import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { firebaseConfig } from './firebase-config.js';
import { resolveFirebaseEnvironment } from './firebase-environment.js';

const environment = resolveFirebaseEnvironment(import.meta.env || {}, firebaseConfig);
export const app = getApps().length ? getApp() : initializeApp(environment.config);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const functions = getFunctions(app);
if (environment.emulators) {
    connectAuthEmulator(auth, `http://${environment.host}:9099`, { disableWarnings: true });
    connectDatabaseEmulator(database, environment.host, 9002);
    connectFunctionsEmulator(functions, environment.host, 5001);
}
