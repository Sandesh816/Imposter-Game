import { cp, mkdir, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'public', 'legacy');

const legacyIndexSource = path.join(root, 'legacy-src', 'app-shell.txt');

const requiredFiles = [
  'index.css',
  'index.js',
  'categories.js',
  'questionCategories.js',
  'multiplayer.js',
  'multiplayerLogic.js',
  'league.js',
  'customCategories.js',
  'auth.js',
  'aiGenerate.js',
  'gameEngine.js',
  'firebase-config.example.js',
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: false });
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  if (!(await exists(legacyIndexSource))) {
    throw new Error(`Missing legacy shell at ${legacyIndexSource}`);
  }

  await copyFile(legacyIndexSource, path.join(outputDir, 'index.html'));

  for (const fileName of requiredFiles) {
    const source = path.join(root, fileName);
    if (!(await exists(source))) {
      throw new Error(`Required legacy file missing: ${source}`);
    }
    await copyFile(source, path.join(outputDir, fileName));
  }

  const optionalSecrets = ['firebase-config.js', 'ai-config.js'];
  for (const fileName of optionalSecrets) {
    const source = path.join(root, fileName);
    if (await exists(source)) {
      await copyFile(source, path.join(outputDir, fileName));
    }
  }

  // Fallback: keep imports working even if firebase-config.js is not present locally.
  const firebaseConfigDest = path.join(outputDir, 'firebase-config.js');
  if (!(await exists(firebaseConfigDest))) {
    await copyFile(
      path.join(root, 'firebase-config.example.js'),
      firebaseConfigDest,
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
