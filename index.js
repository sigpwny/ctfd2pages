const assert = require('node:assert');
const fs = require('node:fs');
const https = require('https'); ;
const path = require('node:path');
const url = require('node:url');

const puppeteer = require('puppeteer');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} [origin] [path]`);
  console.error(`Example: ${process.argv[0]} ${process.argv[1]} https://2022.uiuc.tf 2022/`);
  process.exit(1);
}

let [origin, basepath] = args;
if (!origin.endsWith('/')) {
  origin += '/';
}

const completedDownloads = new Set();
const completedURLs = new Set();
const visitedPages = new Set();
const redirectedTargets = new Map();
const toVisit = [];
const allHandouts = new Set();

const downloadFile = async (requestUrl, filepath) =>{
  return new Promise((resolve, reject) => {
    https.get(requestUrl, (response) => {
      const status = response.statusCode;

      if (status >= 200 && status < 300) {
        response.on('data', (chunk) => {
          fs.appendFileSync(filepath, chunk);
        });
        response.on('end', () => {
          resolve();
        });
      } else if (status >= 300 && status < 400) {
        downloadFile(new url.URL(response.headers.location, requestUrl).href,
            filepath).then(resolve, reject);
      } else {
        reject(new Error(status));
      }
    }).on('error', (err) => {
      reject(err);
    });
  });
};

(async () => {
  const browser = await puppeteer.launch();

  const firstPage = origin;
  toVisit.push(firstPage);
  visitedPages.add(firstPage);

  const urlToPath = (requestUrl) => {
    assert(requestUrl.startsWith(origin));
    let filepath = requestUrl.substring(origin.length);
    filepath = filepath.replace(/\?d=[0-9a-f]{8}$/, '');
    filepath = filepath.replace(/\?_=[0-9]+$/, '');
    // if (filepath == '/teams') {
    //   // /teams have subpages
    //   filepath = '/teams/';
    // }
    if (filepath.endsWith('/')) {
      filepath += 'index.html';
    }
    filepath = path.join(basepath, `./${filepath}`);
    return filepath;
  };

  while (toVisit.length) {
    let deathTimer; let browseCompleted;

    const regenBrowseCompleted = () => {
      browseCompleted = (() => {
        let resolve;
        const promise = new Promise((res) => {
          resolve = res;
        });

        promise.resolve = resolve;
        return promise;
      })();
    };

    const pendingRequests = new Set();
    regenBrowseCompleted();

    const page = await browser.newPage();

    const heartbeat = () => {
      if (deathTimer) {
        clearTimeout(deathTimer);
        deathTimer = undefined;
      }
      if (!pendingRequests.size) {
        deathTimer = setTimeout(() => {
          if (!pendingRequests.size) {
            browseCompleted.resolve();
          }
        }, 250);
      }
    };

    page.on('request', (request) => {
      // Sometimes static files don't get requestfinished somehow
      const requestUrl = request.url();
      if (!(requestUrl.startsWith(origin) &&
          completedURLs.has(urlToPath(requestUrl)))) {
        if (!requestUrl.startsWith('https://discord.com/widget') &&
            !requestUrl.startsWith('data:')) {
          pendingRequests.add(requestUrl);
        }
      }
      heartbeat();
    });

    page.on('requestfailed', (request) => {
      const requestUrl = request.url();

      if (requestUrl.startsWith(origin)) {
        completedURLs.add(urlToPath(requestUrl));
      }
      pendingRequests.delete(requestUrl);
      heartbeat();
    });

    page.on('requestfinished', async (request) => {
      const response = request.response();
      const requestUrl = request.url();
      const originRedirect = redirectedTargets.get(requestUrl);

      if (requestUrl.startsWith(origin.length)) {
        completedURLs.add(urlToPath(requestUrl));
      }

      if (originRedirect || requestUrl.startsWith(origin)) {
        const status = response.status();

        if (status >= 200 && status < 300) {
          let filepath;
          if (!originRedirect || requestUrl.startsWith(origin)) {
            filepath = urlToPath(requestUrl);
          } else {
            filepath = urlToPath(originRedirect);
          }

          if (!filepath.endsWith('.json') &&
              response.headers()['content-type'] == 'application/json') {
            filepath += '.json';
          }
          if (!filepath.endsWith('.html') && !filepath.includes('?') &&
              response.headers()['content-type'] == 'text/html; charset=utf-8') {
            filepath += '.html';
          }

          if (!completedDownloads.has(filepath)) {
            await fs.promises.mkdir(path.dirname(filepath), {recursive: true});

            let buffer;
            try {
              buffer = await response.buffer();
            } catch (err) {
              console.log(requestUrl, filepath);
              console.log(err);
              throw err;
            }

            await fs.promises.writeFile(filepath, buffer);
            completedDownloads.add(filepath);
            console.log('done:', filepath);
          }

          if (originRedirect && requestUrl.startsWith(origin)) {
            const symlinkPath = urlToPath(originRedirect);
            if (!completedDownloads.has(symlinkPath)) {
              await fs.promises.symlink(path.relative(
                  path.dirname(symlinkPath), filepath), symlinkPath);
              completedDownloads.add(symlinkPath);
              console.log('done:', symlinkPath);
            }
          }
        } else if (status >= 300 && status < 400) {
          const target = new url.URL(
              response.headers()['location'], requestUrl).href;

          redirectedTargets.set(target, originRedirect || requestUrl);
        }
      }

      pendingRequests.delete(requestUrl);
      heartbeat();
    });

    const visiting = toVisit.pop();
    console.log('visiting:', visiting);
    await page.goto(visiting);

    while (true) {
      await browseCompleted;

      if (!pendingRequests.size) {
        console.log('browseCompleted');
        break;
      }

      regenBrowseCompleted();
      heartbeat();
    }

    if (visiting == `${origin}challenges`) {
      // Puppeteer headless don't fetch favicon
      const favicon = await page.evaluate(() => {
        return document.querySelector('link[rel*=\'icon\']').href;
      });
      allHandouts.add(favicon);

      const chals = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(
            '.challenge-button')).map((e) => e.parentElement.id);
      });

      for (const chal of chals) {
        regenBrowseCompleted();
        heartbeat();

        await page.evaluate((chal) => {
          document.getElementById(chal).querySelector(
              '.challenge-button').click();
        }, chal);

        await browseCompleted;

        const handouts = await page.evaluate(() => {
          return Array.from(document.querySelectorAll(
              '.challenge-files a')).map((e) => e.href);
        });

        for (const handout of handouts) {
          if (!handout.startsWith(origin)) {
            continue;
          }

          allHandouts.add(handout);
        }

        regenBrowseCompleted();
        heartbeat();

        await page.evaluate(() => {
          document.querySelector('.nav-link.challenge-solves').click();
        }, chal);

        await browseCompleted;

        await page.keyboard.press('Escape');
      }
    }

    setTimeout(() => {
      try {
        page.close();
      } catch (e) {}
    }, 10000);

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map((e) => e.href);
    });

    for (let link of links) {
      if (!link.startsWith(origin)) {
        continue;
      }

      link = new url.URL(link);
      link.hash = '';
      link = link.href;

      if (!visitedPages.has(link)) {
        toVisit.push(link);
        visitedPages.add(link);
      }
    }
  }

  for (const handout of allHandouts) {
    const filepath = urlToPath(handout);
    if (!completedDownloads.has(filepath)) {
      await fs.promises.mkdir(path.dirname(filepath), {recursive: true});
      await downloadFile(handout, filepath);
      console.log('done:', filepath);
    }
  }

  browser.close();
})();
