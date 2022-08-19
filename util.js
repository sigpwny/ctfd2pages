const assert = require('node:assert');

const {fuzzysearchSlice} = require('./fuzzysearch/fuzzysearch.js');

// Why is doing everything in JS so difficult?! Maybe I should write python...
exports.regexEscape = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

exports.regexEscapeReplacement = (string) => {
  return string.replace(/\$/g, '$$$$');
};

exports.countSubstring = (string, substring) => {
  const matches = string.match(new RegExp(exports.regexEscape(substring), 'g'));
  return (matches || []).length;
};

exports.replaceOnce = (string, src, dst) => {
  return string.replace(
      new RegExp(exports.regexEscape(src)),
      exports.regexEscapeReplacement(dst));
};

exports.expandHTMLs = (basenode, direction, condition) => {
  let result = basenode.outerHTML;
  let addresult;

  if (direction === 'next') {
    addresult = (html) => {
      result += html;
    };
  } else if (direction === 'previous') {
    addresult = (html) => {
      result = html + result;
    };
  } else {
    assert(false);
  }

  const endNode = basenode[`${direction}ElementSibling`];
  if (endNode && condition(endNode)) {
    let nextNode = basenode;

    while (nextNode !== endNode) {
      nextNode = nextNode[`${direction}Sibling`];
      if (nextNode.outerHTML !== undefined) {
        addresult(nextNode.outerHTML);
      } else {
        const wrap = basenode.ownerDocument.createElement('div');
        wrap.appendChild(nextNode.cloneNode(true));
        addresult(wrap.innerHTML);
      }
    }
  }

  return result;
};

exports.deleteHtmlWithFixup = async (orightml, deletion, state) => {
  const makeRegex = (string) => {
    // eslint-disable-next-line max-len
    return `(?:(?<=\n)[ \t]*)?${exports.regexEscape(string)}([ \t]*(?:\n|\r\n))?`;
  };

  let newhtml = orightml;

  if (exports.countSubstring(newhtml, deletion) === 1) {
    // Simple case
    newhtml = newhtml.replace( new RegExp(makeRegex(deletion)), '');
    assert(newhtml !== orightml);
  } else if (state.data && deletion === state.data[0] &&
             exports.countSubstring(newhtml, state.data[1]) === 1) {
    // Use cached fixup
    newhtml = newhtml.replace( new RegExp(makeRegex(state.data[1])), '');
    assert(newhtml !== orightml);
  } else {
    // Fuzzy search this
    const fixup = await fuzzysearchSlice(newhtml, deletion);
    assert(exports.countSubstring(newhtml, fixup) === 1);
    state.data = [deletion, fixup];

    newhtml = newhtml.replace( new RegExp(makeRegex(fixup)), '');
    assert(newhtml !== orightml);
  }

  return newhtml;
};
