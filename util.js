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
