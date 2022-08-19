const assert = require('node:assert');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

const util = require('../util.js');

const main = async function() {
  const file = process.argv[2];
  const inputhtml = fs.readFileSync(file, 'utf8');
  const {window} = new JSDOM(inputhtml);
  const {document} = window;

  const textNodes = (() => {
    const walker = document.createTreeWalker(
        document.documentElement, window.NodeFilter.SHOW_TEXT);
    const result = [];

    let node;
    while (node = walker.nextNode()) {
      result.push(node);
    }
    return result;
  })();

  // We don't use `document.documentElement.outerHTML` due to sanitization.
  // Edit the HTML manually.
  let outputhtml = inputhtml;

  const findReplace = (src, dst, nodefinder) => {
    assert(nodefinder(src).length === 1);
    assert(util.countSubstring(outputhtml, src) === 1);

    outputhtml = util.replaceOnce(outputhtml, src, dst);
  };

  findReplace(
      'Sorry about that',
      // eslint-disable-next-line max-len
      'This site has been archived and is now served statically by GitHub Pages',
      (src) => textNodes.filter((node) => node.textContent === src),
  );
  findReplace(
      'Powered by CTFd',
      'Powered by <s>CTFd</s> GitHub Pages',
      (src) => textNodes.filter((node) => node.textContent === src),
  );
  findReplace(
      'https://ctfd.io',
      'https://pages.github.com/',
      (src) => Array.from(document.querySelectorAll('a'))
          .filter((node) => node.attributes.href.value === src),
  );

  fs.writeFileSync(file, outputhtml);

  return 0;
};

if (require.main === module) {
  main().then(process.exit);
}
