// Keep emulator selection explicit: a test build must never use a real project.
export function resolveFirebaseEnvironment(env = {}, productionConfig) {
    if (env.VITE_USE_EMULATORS !== '1') return { config: productionConfig, emulators: false };
    if (env.VITE_FIREBASE_PROJECT_ID !== 'demo-imposter-review') {
        throw new Error('Emulator builds require demo-imposter-review');
    }
    return {
        emulators: true,
        host: '127.0.0.1',
        config: {
            apiKey: 'demo-key', projectId: 'demo-imposter-review',
            authDomain: 'demo-imposter-review.firebaseapp.com',
            databaseURL: 'https://demo-imposter-review.firebaseio.com',
            appId: 'demo-imposter-review'
        }
    };
}
