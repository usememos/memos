import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isCI } from 'std-env';

// If we make significant changes to how telemetry is collected in the future, bump this version.
const TELEMETRY_NOTICE_VERSION = '1';

function telemetryNotice() {
  console.log(`Attention: Clerk now collects telemetry data from its SDKs when connected to development instances.`);
  console.log(`The data collected is used to inform Clerk's product roadmap.`);
  console.log(
    `To learn more, including how to opt-out from the telemetry program, visit: https://clerk.com/docs/telemetry.`,
  );
  console.log('');
}

// Adapted from https://github.com/sindresorhus/env-paths
function getConfigDir(name) {
  const homedir = os.homedir();
  const macos = () => path.join(homedir, 'Library', 'Preferences', name);
  const win = () => {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const { APPDATA = path.join(homedir, 'AppData', 'Roaming') } = process.env;
    return path.join(APPDATA, name, 'Config');
  };
  const linux = () => {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const { XDG_CONFIG_HOME = path.join(homedir, '.config') } = process.env;
    return path.join(XDG_CONFIG_HOME, name);
  };
  switch (process.platform) {
    case 'darwin':
      return macos();
    case 'win32':
      return win();
    default:
      return linux();
  }
}

async function notifyAboutTelemetry() {
  const configDir = getConfigDir('clerk');
  const configFile = path.join(configDir, 'config.json');

  await fs.mkdir(configDir, { recursive: true });

  let config = {};
  try {
    config = JSON.parse(await fs.readFile(configFile, 'utf8'));
  } catch (err) {
    // File can't be read and parsed, continue
  }

  if (parseInt(config.telemetryNoticeVersion, 10) >= TELEMETRY_NOTICE_VERSION) {
    return;
  }

  config.telemetryNoticeVersion = TELEMETRY_NOTICE_VERSION;

  if (!isCI) {
    telemetryNotice();
  }

  await fs.writeFile(configFile, JSON.stringify(config, null, '\t'));
}

async function main() {
  try {
    await notifyAboutTelemetry();
  } catch {
    // Do nothing, we _really_ don't want to log errors during install.
  }
}

main();
