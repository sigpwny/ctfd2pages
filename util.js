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

exports.makeRegexForLine = (string) => {
  // eslint-disable-next-line max-len
  return `(?:(?:(?<=\n)|^)[ \t]*)?${exports.regexEscape(string)}([ \t]*(?:\n|\r\n))?`;
};

exports.findWithFixup = async (haystack, needle, state) => {
  if (exports.countSubstring(haystack, needle) === 1) {
    // Simple case
    return needle;
  } else if (state.data && needle === state.data[0] &&
             exports.countSubstring(haystack, state.data[1]) === 1) {
    // Use cached fixup
    return state.data[1];
  } else {
    // Fuzzy search this
    const fixup = await fuzzysearchSlice(haystack, needle);
    assert(exports.countSubstring(haystack, fixup) === 1);
    state.data = [needle, fixup];

    return fixup;
  }
};
