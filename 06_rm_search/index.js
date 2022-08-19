const assert = require('node:assert');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

const util = require('../util.js');
const {fastfuzzySlice} = require('../fastfuzzy/fastfuzzy.js');

const main = async function() {
  const files = process.argv.slice(2);
  let lastFixup = undefined;

  for (const file of files) {
    console.log(file);

    const inputhtml = fs.readFileSync(file, 'utf8');
    const {window} = new JSDOM(inputhtml);
    const {document} = window;

    let outputhtml = inputhtml;

    let deleteNode = Array.from(document.querySelectorAll('input'))
        .filter((node) => node.attributes.placeholder
            ?.value?.startsWith('Search for matching '));

    assert(deleteNode.length === 1);
    [deleteNode] = deleteNode;

    deleteNode = deleteNode.closest('div.row');
    const deletion = deleteNode.outerHTML;

    // outputhtml = document.documentElement.outerHTML;
    if (util.countSubstring(outputhtml, deletion) === 1) {
      // Simple case
      outputhtml = outputhtml.replace(
          new RegExp(util.regexEscape(deletion) +
              '(?:\n|\r\n)?(?:\s*<hr[^>]*>(?:\n|\r\n)?)?'), '');
      assert(outputhtml !== inputhtml);
    } else if (lastFixup && deletion === lastFixup[0] &&
               util.countSubstring(outputhtml, lastFixup[1]) === 1) {
      // Use cached fixup
      outputhtml = outputhtml.replace(
          new RegExp(util.regexEscape(lastFixup[1]) +
              '(?:\n|\r\n)?(?:\s*<hr[^>]*>(?:\n|\r\n)?)?'), '');
      assert(outputhtml !== inputhtml);
    } else {
      // Fuzzy search this
      const fixup = await fastfuzzySlice(outputhtml, deletion);
      assert(util.countSubstring(outputhtml, fixup) === 1);
      lastFixup = [deletion, fixup];

      outputhtml = outputhtml.replace(
          new RegExp(util.regexEscape(fixup) +
              '(?:\n|\r\n)?(?:\s*<hr[^>]*>(?:\n|\r\n)?)?'), '');
      assert(outputhtml !== inputhtml);
    }

    fs.writeFileSync(file, outputhtml);
  }

  return 0;
};

if (require.main === module) {
  main().then(process.exit);
}
