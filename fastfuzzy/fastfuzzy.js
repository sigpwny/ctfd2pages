const native = require('./fastfuzzy_native.js');

const initAllocate = new Promise((resolve, reject) => {
  native.onRuntimeInitialized = () => {
    const startBuf = native._malloc(4);
    const endBuf = native._malloc(4);

    resolve([startBuf, endBuf]);
  };
});

exports.fastfuzzy = async (haystack, needle) => {
  const [startBuf, endBuf] = await initAllocate;

  native.ccall(
      'fastfuzzy', null,
      ['string', 'string', 'number', 'number'],
      [haystack, needle, startBuf, endBuf]);

  return [native.getValue(startBuf, 'i32'), native.getValue(endBuf, 'i32')];
};

exports.fastfuzzySlice = async (haystack, needle) => {
  const [start, end] = await exports.fastfuzzy(haystack, needle);
  return haystack.slice(start, end);
};
