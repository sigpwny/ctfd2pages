const assert = require('node:assert');
const fs = require('node:fs');
const http = require('http'); ;
const https = require('https'); ;
const path = require('node:path');
const url = require('node:url');

const puppeteer = require('puppeteer');

const sleep = (timeout) => {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
};

// A promise with resolve & reject method on it
const deferred = () => {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  promise.resolve = resolve;
  promise.reject = reject;
  return promise;
};

class HeartBeat {
  constructor() {
    this.resolved = false;
    this.deferred = deferred();
    this.timer = undefined;
  }

  heartbeat(timeout) {
    // if (this.resolved) {
    //   throw new Error('Already timed out');
    // }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (timeout >= 0) {
      this.timer = setTimeout(() => {
        // assert(!this.resolved);
        this.deferred.resolve();
        this.resolved = true;
      }, timeout);
    }
  };

  async wait() {
    await this.deferred;
  }
}

class WaitAll {
  constructor() {
    this.waitlist = new Set();
    this.deferred = deferred();
  }

  add(promise) {
    this.waitlist.add(promise);

    promise.then(() => {
      this.waitlist.delete(promise);
      if (!this.waitlist.size) {
        this.deferred.resolve();
      }
    }, (err) => {
      this.deferred.reject(err);
    });
  }

  async wait() {
    await this.deferred;
  }
}

class PageHandler {
  constructor(parent, browser, pageUrl) {
    this.parent = parent;
    this.browser = browser;
    this.pageUrl = pageUrl;

    this.redirectedTargets = new Map();
    this.pendingRequests = new Set();
    this.browseCompleted = undefined;
  }

  setHooks(page) {
    // Sometimes static files don't get requestfinished somehow.
    // - If all requests done, timeout 250ms
    // - If only irrelevant files remaining, timeout 10s
    // - Else timeout infinity.
    const heartbeat = () => {
      let timeout;
      if (!this.pendingRequests.size) {
        timeout = 250;
      } else if (Array.from(this.pendingRequests).every((requestUrl) => {
        return !requestUrl.startsWith(this.parent.origin) ||
            this.parent.completedPaths.has(this.parent.urlToPath(requestUrl));
      })) {
        timeout = 10000;
      } else {
        timeout = -1;
      }
      this.browseCompleted.heartbeat(timeout);
    };

    page.on('request', (request) => {
      const requestUrl = request.url();

      if (requestUrl.startsWith('data:')) {
        return;
      }

      this.pendingRequests.add(requestUrl);
      heartbeat();
    });

    page.on('requestfailed', (request) => {
      const requestUrl = request.url();

      this.pendingRequests.delete(requestUrl);
      heartbeat();

      if (requestUrl.startsWith(this.parent.origin)) {
        this.parent.completedPaths.add(this.parent.urlToPath(requestUrl));
      }
    });

    page.on('requestfinished', async (request) => {
      let requestUrl = request.url();
      const response = request.response();
      const originRedirect = this.redirectedTargets.get(requestUrl);

      this.pendingRequests.delete(requestUrl);
      heartbeat();

      if (requestUrl.startsWith('https://rctf.2024.uiuc.tf/')) {
        // Pretend to be in the same domain
        assert(requestUrl.startsWith('https://rctf.2024.uiuc.tf/api/'));
        requestUrl = requestUrl.replace(/^https:\/\/rctf\.2024\.uiuc\.tf\//,
            'https://2024.uiuc.tf/');

        if (request.method().toUpperCase() === 'OPTIONS') {
          return;
        }
      }

      if (requestUrl.startsWith(this.parent.origin)) {
        this.parent.completedPaths.add(this.parent.urlToPath(requestUrl));
      }

      if (requestUrl.startsWith(this.parent.origin)) {
        requestUrl = new url.URL(requestUrl);
        if (requestUrl.pathname === '/icon1.svg') {
          requestUrl.search = '';
        }

        for (const [key, value] of Array.from(requestUrl.searchParams)) {
          if (requestUrl.pathname.startsWith('/api/')) {
            if (key === 'limit' && value === '3000') {
              requestUrl.searchParams.delete(key);
            } else if (key === 'offset' && value === '0') {
              requestUrl.searchParams.delete(key);
            } else {
              console.log(requestUrl);
              assert(false);
            }
          } else {
            if (['_rsc', 'id'].includes(key)) {
              requestUrl.searchParams.delete(key);
            } else {
              console.log(requestUrl);
              assert(false);
            }
          }
        }
        requestUrl = requestUrl.href;
        console.log(requestUrl);
      }

      if (originRedirect || requestUrl.startsWith(this.parent.origin)) {
        const status = response.status();

        if ((status >= 200 && status < 300) ||
            requestUrl === `${this.parent.origin}404`) {
          if (requestUrl === `${this.parent.origin}404`) {
            // assert(status === 404);
          }

          let filepath;
          if (!originRedirect || requestUrl.startsWith(this.parent.origin)) {
            filepath = this.parent.urlToPath(requestUrl);
          } else {
            filepath = this.parent.urlToPath(originRedirect);
          }

          // File extension added because sometimes an URL needs to be both a
          // page and a directory...
          if (!filepath.endsWith('.json') &&
            response.headers()['content-type'] === 'application/json' ||
            response.headers()['content-type'] === 'application/json; charset=utf-8') {
            filepath += '.json';
          }
          if (!filepath.endsWith('.html') && !filepath.includes('?') &&
              response.headers()['content-type'] ===
                'text/html; charset=utf-8') {
            filepath += '.html';
          }

          if (!this.parent.completedDownloads.has(filepath)) {
            this.parent.completedDownloads.add(filepath);

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
            console.log('done:', filepath);
          }

          if (originRedirect && requestUrl.startsWith(this.parent.origin)) {
            // not handling internal -> internal redirects
            assert(false);
          }
        } else if (status >= 300 && status < 400) {
          const next = new url.URL(
              response.headers()['location'], requestUrl).href;

          this.redirectedTargets.set(next, originRedirect || requestUrl);
        }
      }
    });

    // consider pages with text/event-stream failed since they never finish
    // responding and cannot be archived.
    // https://github.com/sigpwny/ctfd2pages/issues/13#issuecomment-1621129029
    page.on('response', (response) => {
      const request = response.request();
      const requestUrl = request.url();

      let contenttype = response.headers()['content-type'];
      if (!contenttype) {
        return;
      }
      if (contenttype.includes(';')) {
        contenttype = contenttype.substring(0, contenttype.indexOf(';'));
      }

      if (contenttype === 'text/event-stream') {
        if (requestUrl.startsWith(this.parent.origin)) {
          this.pendingRequests.delete(requestUrl);
          heartbeat();

          this.parent.completedPaths.add(this.parent.urlToPath(requestUrl));
        }
      }
    });
  }

  async handleSpecials(page) {
    const softclick = (handle) => handle.evaluate((el) => el.click());

    if (this.pageUrl === `${this.parent.origin}`) {
      // Login... RCTF moment
      await page.evaluate(() => {
        localStorage.setItem('token', 'vM26tmDaOhrEQFzShyLPh9MVDnoi/ceFE0u1O6+5/kYDLZf1QHkSDkV+r7nBaS2KjnLgfyolimOMe4HTHf4QfgKCNTGhLYVAxctpo55ZYkF4Fi5WpNHaI8fWriPx');
      });

      // Puppeteer headless don't fetch favicon
      const favicon = await page.$eval('link[rel*=\'icon\']',
          (e) => e.href);
      this.parent.allHandouts.add(favicon);
    } else if (this.pageUrl === `${this.parent.origin}challenges`) {
      // const chals = await page.$$('.challenge-button');
      const chals = await page.$$('button.group');

      for (const chal of chals) {
        // Challenge Tab
        this.browseCompleted = new HeartBeat();
        await softclick(chal);
        await this.browseCompleted.wait();

        const els = await page.$$('div.fixed[role=document] p');
        let handouts = undefined;
        for (const el of els) {
          let content = await el.getProperty('textContent');
          content = await content.jsonValue();
          if (content === 'Downloads') {
            handouts = el;
            break;
          }
        }

        if (handouts !== undefined) {
          handouts = await handouts.getProperty('parentNode');
          handouts = await handouts.$$eval('a', (l) => l.map((e) => e.href));

          for (const handout of handouts) {
            // assert(handout.startsWith(this.parent.origin));
            assert(handout.startsWith('https://uiuctf-2024-rctf-challenge-uploads.storage.googleapis.com/uploads/'));
            this.parent.allHandouts.add(handout);
          }
        }

        // Solves Tab
        // this.browseCompleted = new HeartBeat();
        // await softclick(await page.$('.challenge-solves'));
        // await this.browseCompleted.wait();
        //
        // await sleep(500);
        await page.keyboard.press('Escape');
        await sleep(500);
      }
    }
  }

  async run() {
    const page = await this.browser.newPage();
    this.browseCompleted = new HeartBeat();

    // Allow fetching large resources
    // https://github.com/sigpwny/ctfd2pages/issues/13#issuecomment-1621091707
    // https://github.com/puppeteer/puppeteer/issues/1599#issuecomment-355473214
    // https://github.com/puppeteer/puppeteer/issues/6647#issuecomment-1610949415
    page._client().send('Network.enable', {
      maxResourceBufferSize: 100 << 20,
      maxTotalBufferSize: 200 << 20,
    });

    this.setHooks(page);

    console.log('visiting:', this.pageUrl);
    await page.goto(this.pageUrl);

    await this.browseCompleted.wait();

    const links = await page.$$eval('a',
        (l) => l.map((e) => e.href));

    for (let link of links) {
      if (link.startsWith(this.parent.origin)) {
        link = new url.URL(link);
        link.hash = '';
        for (const [key] of Array.from(link.searchParams)) {
          if (key === '_rsc') {
            link.searchParams.delete('_rsc');
          } else if (key === 'id') {
            // Noop
          } else {
            assert(false);
          }
        }
        link = link.href;

        this.parent.pushpage(link);
      } else if (link.startsWith('https://rctf.2024.uiuc.tf/')) {
        console.log(`!!!!!!!!!API PATH LINKED!!! ${link}`);
      }
    }

    // Return this promise, then async handle special pages
    this.parent.waitallnav.add((async () => {
      await this.handleSpecials(page);

      // Give it 10 seconds to download any remaining resources
      await sleep(10000);

      page.close();
    })());
  }
}

class Ctfd2Pages {
  constructor(origin, basepath) {
    this.origin = origin;
    this.basepath = basepath;

    this.toVisit = [];
    this.visited = new Set();
    this.completedDownloads = new Set();
    this.completedPaths = new Set();
    this.allHandouts = new Set();
    this.waitallnav = new WaitAll();
  }

  urlToPath(requestUrl) {
    assert(requestUrl.startsWith(this.origin));
    let filepath = '/' + requestUrl.substring(this.origin.length);
    filepath = filepath.replace(/\?d=[0-9a-f]{8}$/, '');
    filepath = filepath.replace(/\?_=[0-9]+$/, '');
    if (filepath.endsWith('/')) {
      filepath += 'index.html';
    }
    filepath = path.join(this.basepath, `./${filepath}`);
    return filepath;
  };

  downloadFile(requestUrl, filepath) {
    const urlobj = new url.URL(requestUrl);
    let handlerModule;

    if (urlobj.protocol === 'http:') {
      handlerModule = http;
    } else if (urlobj.protocol === 'https:') {
      handlerModule = https;
    } else {
      assert(false);
    }

    return new Promise((resolve, reject) => {
      handlerModule.get(requestUrl, (response) => {
        const status = response.statusCode;

        if (status >= 200 && status < 300) {
          let fd = fs.openSync(filepath, 'w');

          response.on('data', (chunk) => {
            fs.writeSync(fd, chunk);
          });
          response.on('end', () => {
            fs.closeSync(fd);
            fd = undefined;
            resolve();
          });
        } else if (status >= 300 && status < 400) {
          const next = new url.URL(response.headers.location, requestUrl).href;
          this.downloadFile(next, filepath).then(resolve, reject);
        } else {
          reject(new Error(status));
        }
      }).on('error', (err) => {
        reject(err);
      });
    });
  };

  pushpage(pageUrl) {
    if (this.visited.has(pageUrl)) {
      return;
    }

    this.toVisit.push(pageUrl);
    this.visited.add(pageUrl);
  }

  async poppage(browser) {
    const pageUrl = this.toVisit.shift();
    await new PageHandler(this, browser, pageUrl).run();
  }

  async run() {
    const browser = await puppeteer.launch({headless: 'new'});

    this.pushpage(this.origin);
    // this.pushpage(`${this.origin}challenges`);
    this.pushpage(`${this.origin}404`);

    while (this.toVisit.length) {
      console.log(this.toVisit.length, 'pending pages');
      await this.poppage(browser);
    }

    await this.waitallnav.wait();

    for (const handout of this.allHandouts) {
      let filepath = handout.replace(/^https:\/\/uiuctf-2024-rctf-challenge-uploads\.storage\.googleapis\.com\//, 'https://2024.uiuc.tf/');
      filepath = this.urlToPath(filepath);
      if (!this.completedDownloads.has(filepath)) {
        await fs.promises.mkdir(path.dirname(filepath), {recursive: true});
        await this.downloadFile(handout, filepath);
        console.log('done:', filepath);
      }
    }

    browser.close();
  }
}

const main = async function() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error(
        `Usage: ${process.argv[0]} ${process.argv[1]} [origin] [path]`);
    console.error(
        `Example: ${process.argv[0]} ${process.argv[1]} https://2022.uiuc.tf 2022/`);
    return 1;
  }

  let [origin, basepath] = args;
  if (!origin.endsWith('/')) {
    origin += '/';
  }
  await new Ctfd2Pages(origin, basepath).run();

  return 0;
};

if (require.main === module) {
  main().then(process.exit);
}
