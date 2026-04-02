import { execSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import fs from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const SELF_HOST_CONFIG_DIR = `${homedir()}/.affine/config`;

function generatePrivateKey() {
  const key = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  }).privateKey.export({
    type: 'sec1',
    format: 'pem',
  });

  if (key instanceof Buffer) {
    return key.toString('utf-8');
  }

  return key;
}

/**
 * @type {Array<{ to: string; generator: () => string }>}
 */
const files = [{ to: 'private.key', generator: generatePrivateKey }];

function prepare() {
  fs.mkdirSync(SELF_HOST_CONFIG_DIR, { recursive: true });

  for (const { to, generator } of files) {
    const targetFilePath = path.join(SELF_HOST_CONFIG_DIR, to);
    if (!fs.existsSync(targetFilePath)) {
      console.log(`creating config file [${targetFilePath}].`);
      fs.writeFileSync(targetFilePath, generator(), 'utf-8');
    }
  }
}

function runPredeployScript() {
  console.log('Running predeploy script.');
  // Use npx if yarn fails or is unavailable in the minimal environment, 
  // but preferably stick to node calls for core functionality to avoid PATH issues.
  try {
    console.log('Attempting prisma migrate deploy...');
    // We point directly to the binary or use npx if available. 
    // Since we copied node_modules, we can try running it via node.
    execSync('npx prisma migrate deploy', {
      encoding: 'utf-8',
      env: process.env,
      stdio: 'inherit',
    });

    console.log('Attempting cli run...');
    execSync('node ./dist/main.js run', {
      encoding: 'utf-8',
      env: { ...process.env, SERVER_FLAVOR: 'script' },
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('Predeploy script failed:', err.message);
    process.exit(1);
  }
}

function fixFailedMigrations() {
  console.log('fixing failed migrations.');
  const maybeFailedMigrations = [
    '20250521083048_fix_workspace_embedding_chunk_primary_key',
  ];
  for (const migration of maybeFailedMigrations) {
    try {
      execSync(`npx prisma migrate resolve --rolled-back ${migration}`, {
        encoding: 'utf-8',
        env: process.env,
        stdio: 'pipe',
      });
      console.log(`migration [${migration}] has been rolled back.`);
    } catch (err) {
      if (
        err.message.includes(
          'cannot be rolled back because it is not in a failed state'
        ) ||
        err.message.includes(
          'cannot be rolled back because it was never applied'
        ) ||
        err.message.includes(
          'called markMigrationRolledBack on a database without migrations table'
        )
      ) {
        // migration has been rolled back, skip it
        continue;
      }
      // ignore other errors
      console.log(
        `migration [${migration}] rolled back failed. ${err.message}`
      );
    }
  }
}

async function main() {
  // Wait for database to be ready (simple retry loop)
  let retries = 5;
  while (retries > 0) {
    try {
      prepare();
      fixFailedMigrations();
      runPredeployScript();
      break;
    } catch (err) {
      console.log(`Predeploy attempt failed. Retries left: ${retries-1}. Error: ${err.message}`);
      retries--;
      if (retries === 0) {
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    }
  }
}

main();
