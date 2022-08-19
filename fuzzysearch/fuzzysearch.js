const native = require('./fuzzysearch_native.js');

const initAllocate = new Promise((resolve, reject) => {
  native.onRuntimeInitialized = () => {
    const startBuf = native._malloc(4);
    const endBuf = native._malloc(4);

    resolve([startBuf, endBuf]);
  };
});

exports.fuzzysearch = async (haystack, needle) => {
  const [startBuf, endBuf] = await initAllocate;

  native.ccall(
      'fuzzysearch', null,
      ['string', 'string', 'number', 'number'],
      [haystack, needle, startBuf, endBuf]);

  return [native.getValue(startBuf, 'i32'), native.getValue(endBuf, 'i32')];
};

exports.fuzzysearchSlice = async (haystack, needle) => {
  const [start, end] = await exports.fuzzysearch(haystack, needle);
  return haystack.slice(start, end);
};
