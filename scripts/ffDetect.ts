import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

type Locator = 'which' | 'where';

const execFileAsync = promisify(execFile);

async function isExecutable(path: string | undefined): Promise<boolean> {
  if (!path) {
    return false;
  }

  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function locateViaLocator(binaryNames: string[]): Promise<string | undefined> {
  const locator: Locator = process.platform === 'win32' ? 'where' : 'which';

  for (const binaryName of binaryNames) {
    try {
      const { stdout } = await execFileAsync(locator, [binaryName]);
      const candidate = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);

      if (await isExecutable(candidate)) {
        return candidate as string;
      }
    } catch {
      // Ignore resolution errors and keep searching.
    }
  }

  return undefined;
}

function buildStaticCandidates(): string[] {
  if (process.platform === 'darwin') {
    return [
      '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
      '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox-bin',
      '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
      '/Applications/Firefox Nightly.app/Contents/MacOS/firefox-bin',
      '/Applications/Firefox.app/Contents/MacOS/firefox',
      '/Applications/Firefox.app/Contents/MacOS/firefox-bin',
    ];
  }

  if (process.platform === 'linux') {
    return [
      '/usr/bin/firefox-developer-edition',
      '/usr/local/bin/firefox-developer-edition',
      '/opt/firefox-developer-edition/firefox',
      '/usr/bin/firefox',
      '/usr/local/bin/firefox',
      '/snap/bin/firefox',
    ];
  }

  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES;
    const programFilesX86 = process.env['PROGRAMFILES(X86)'];
    const localAppData = process.env.LOCALAPPDATA;

    return [
      programFiles && `${programFiles}\\Firefox Developer Edition\\firefox.exe`,
      programFilesX86 && `${programFilesX86}\\Firefox Developer Edition\\firefox.exe`,
      programFiles && `${programFiles}\\Mozilla Firefox\\firefox.exe`,
      programFilesX86 && `${programFilesX86}\\Mozilla Firefox\\firefox.exe`,
      localAppData && `${localAppData}\\Mozilla Firefox\\firefox.exe`,
    ].filter((value): value is string => Boolean(value));
  }

  return [];
}

async function detectFirefoxBinary(): Promise<string> {
  const envOverride = process.env.FF_BIN?.trim();
  if (envOverride && (await isExecutable(envOverride))) {
    return envOverride;
  }

  if (envOverride) {
    console.warn(`FF_BIN is set to "${envOverride}" but is not executable. Falling back to auto-detection.`);
  }

  const located = await locateViaLocator(['firefox-developer-edition', 'firefox']);
  if (located) {
    return located;
  }

  for (const candidate of buildStaticCandidates()) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to find a Firefox binary automatically. Set FF_BIN manually (e.g. /Applications/Firefox Developer Edition.app/Contents/MacOS/firefox). '
      + 'web-ext requires a full binary path as documented in https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/.',
  );
}

async function runWebExt(binaryPath: string): Promise<void> {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  await new Promise<void>((resolve, reject) => {
    const child = spawn(npmCommand, ['run', '-w', 'frontend', 'ffext:run'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        FF_BIN: binaryPath,
      },
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`ffext:run exited via signal ${signal}`));
        return;
      }

      if (code !== null && code !== 0) {
        reject(new Error(`ffext:run exited with status ${code}`));
        return;
      }

      resolve();
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const printOnly = args.has('--print');

  const binaryPath = await detectFirefoxBinary();
  console.log(`Detected Firefox binary: ${binaryPath}`);

  if (printOnly) {
    console.log(`export FF_BIN="${binaryPath}"`);
    return;
  }

  await runWebExt(binaryPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
