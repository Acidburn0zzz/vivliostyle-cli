import chokidar from 'chokidar';
import upath from 'upath';
import {
  checkBrowserAvailability,
  downloadBrowser,
  isPlaywrightExecutable,
  launchBrowser,
} from './browser.js';
import {
  cleanupWorkspace,
  compile,
  copyAssets,
  prepareThemeDirectory,
} from './builder.js';
import {
  CliFlags,
  collectVivliostyleConfig,
  mergeConfig,
  ManuscriptEntry,
} from './config.js';
import { prepareServer } from './server.js';
import {
  cwd,
  debug,
  isUrlString,
  logSuccess,
  pathContains,
  pathEquals,
  startLogging,
  stopLogging,
} from './util.js';

let timer: NodeJS.Timeout;

export interface PreviewCliFlags extends CliFlags {}

export async function preview(cliFlags: PreviewCliFlags) {
  startLogging('Collecting preview config');

  const loadedConf = await collectVivliostyleConfig(cliFlags);
  const { vivliostyleConfig, vivliostyleConfigPath } = loadedConf;
  cliFlags = loadedConf.cliFlags;

  const context = vivliostyleConfig
    ? upath.dirname(vivliostyleConfigPath)
    : cwd;

  if (!cliFlags.input && !vivliostyleConfig) {
    // Empty input, open Viewer start page
    cliFlags.input = 'data:,';
  }

  let config = await mergeConfig(
    cliFlags,
    // Only show preview of first entry
    vivliostyleConfig?.[0],
    context,
  );

  startLogging('Preparing preview');

  // build artifacts
  if (config.manifestPath) {
    await cleanupWorkspace(config);
    await prepareThemeDirectory(config);
    await compile(config);
    await copyAssets(config);
  }

  const { viewerFullUrl } = await prepareServer({
    input: (config.manifestPath ??
      config.webbookEntryPath ??
      config.epubOpfPath) as string,
    workspaceDir: config.workspaceDir,
    httpServer: config.httpServer,
    viewer: config.viewer,
    viewerParam: config.viewerParam,
    size: config.size,
    cropMarks: config.cropMarks,
    bleed: config.bleed,
    cropOffset: config.cropOffset,
    css: config.css,
    style: config.customStyle,
    userStyle: config.customUserStyle,
    singleDoc: config.singleDoc,
    quick: config.quick,
  });

  const { browserType, executableBrowser } = config;
  debug(`Executing browser path: ${executableBrowser}`);
  if (!checkBrowserAvailability(executableBrowser)) {
    if (isPlaywrightExecutable(executableBrowser)) {
      // The browser isn't downloaded first time starting CLI so try to download it
      await downloadBrowser(browserType);
    } else {
      // executableBrowser seems to be specified explicitly
      throw new Error(
        `Cannot find the browser. Please check the executable browser path: ${executableBrowser}`,
      );
    }
  }
  const browser = await launchBrowser({
    browserType,
    executablePath: executableBrowser,
    headless: false,
    noSandbox: !config.sandbox,
    disableWebSecurity: !config.viewer,
  });
  const page = await browser.newPage({ viewport: null });

  // Vivliostyle Viewer uses `i18nextLng` in localStorage for UI language
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  await page.addInitScript(
    `window.localStorage.setItem('i18nextLng', '${locale}');`,
  );

  // Prevent confirm dialog from being auto-dismissed
  page.on('dialog', () => {});

  await page.goto(viewerFullUrl);

  // Move focus from the address bar to the page
  await page.bringToFront();
  // Focus to the URL input box if available
  await page.locator('#vivliostyle-input-url').focus();

  stopLogging('Up and running ([ctrl+c] to quit)', '🚀');

  function reloadConfig(path: string) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      startLogging(`Config file change detected. Reloading ${path}`);
      // reload vivliostyle config
      const loadedConf = await collectVivliostyleConfig(cliFlags);
      const { vivliostyleConfig } = loadedConf;
      config = await mergeConfig(cliFlags, vivliostyleConfig?.[0], context);
      // build artifacts
      if (config.manifestPath) {
        await prepareThemeDirectory(config);
        await compile(config);
        await copyAssets(config);
      }
      page.reload();
      logSuccess(`Reloaded ${path}`);
    }, 2000);
  }

  function handleChangeEvent(path: string) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      startLogging(`Rebuilding ${path}`);
      // build artifacts
      if (config.manifestPath) {
        await prepareThemeDirectory(config);
        await compile(config);
        await copyAssets(config);
      }
      page.reload();
      logSuccess(`Built ${path}`);
    }, 2000);
  }

  if (isUrlString(config.input.entry)) {
    return;
  }

  chokidar
    .watch('**', {
      ignored: (path: string) => {
        if (/^node_modules$|^\.git/.test(upath.basename(path))) {
          return true;
        }
        if (
          !pathEquals(config.entryContextDir, config.workspaceDir) &&
          pathContains(config.workspaceDir, path)
        ) {
          return true; // ignore saved intermediate files
        }
        if (
          config.manifestAutoGenerate &&
          pathEquals(path, config.manifestPath)
        ) {
          return true; // ignore generated pub-manifest
        }
        if (
          config.entries.length &&
          /\.(md|markdown|html?|xhtml|xht)$/i.test(path) &&
          !config.entries.some(
            (entry) =>
              entry.rel !== 'contents' &&
              pathEquals(path, (entry as ManuscriptEntry).source),
          )
        ) {
          return true; // ignore md or html files not in entries source
        }
        if (pathContains(config.themesDir, path)) {
          return true; // ignore theme packages
        }
        return false;
      },
      cwd: config.entries.length ? context : config.entryContextDir,
      ignoreInitial: true,
    })
    .on('all', (event, path) => {
      if (
        pathEquals(
          upath.join(config.entryContextDir, path),
          config.input.entry,
        ) ||
        /\.(md|markdown|html?|xhtml|xht|css|jpe?g|png|gif|svg)$/i.test(path)
      ) {
        handleChangeEvent(path);
      } else if (
        vivliostyleConfigPath &&
        pathEquals(path, upath.basename(vivliostyleConfigPath))
      ) {
        reloadConfig(path);
      }
    });
}
