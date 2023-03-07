const assert = require('node:assert');
const fs = require('node:fs');
const glob = require('glob');
const {JSDOM} = require('jsdom');

const util = require('../util.js');

const {PAGES_REPO} = process.env;

const main = async function() {
  const lastFixup = {};

  for (const file of [
    ...await glob(`${PAGES_REPO}/teams*.html`),
    ...await glob(`${PAGES_REPO}/users*.html`),
  ]) {
    console.log(file);

    const inputhtml = fs.readFileSync(file, 'utf8');
    const {window} = new JSDOM(inputhtml);
    const {document} = window;

    let targetNode = Array.from(document.querySelectorAll('input'))
        .filter((node) => node.attributes.placeholder
            ?.value?.startsWith('Search for matching '));

    assert(targetNode.length === 1);
    [targetNode] = targetNode;

    targetNode = targetNode.closest('div.row');
    const deletionRaw = util.expandHTMLs(
        targetNode, 'next', (node) => node.tagName === 'HR');
    const deletion = await util.findWithFixup(
        inputhtml, deletionRaw, lastFixup);

    const outputhtml = inputhtml.replace(
        new RegExp(util.makeRegexForLine(deletion)), '');
    assert(outputhtml !== inputhtml);

    fs.writeFileSync(file, outputhtml);
  }

  return 0;
};

if (require.main === module) {
  main().then(process.exit);
}
