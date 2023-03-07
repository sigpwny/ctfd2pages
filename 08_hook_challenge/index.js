const assert = require('node:assert');
const crypto = require('node:crypto');
const realfs = require('node:fs');
const path = require('node:path');

const glob = require('glob');
const {JSDOM} = require('jsdom');
const {Volume} = require('memfs');
const {Union} = require('unionfs');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const yaml = require('js-yaml');

const util = require('../util.js');

const {PAGES_REPO, CHAL_REPO, EXPORT_PATH, IS_CORE_BETA} = process.env;

const INJECTED_JS_PATH = '/ctfd2pages/hooks/challenges.min.js';

const makeFlagsJson = async () => {
  const chalname2id = {};
  for (const chalJsonPath of await glob(
      `${PAGES_REPO}/api/v1/challenges/*/index.json`)) {
    const chalJson = JSON.parse(await realfs.promises.readFile(chalJsonPath));
    chalname2id[chalJson.data.name] = chalJson.data.id;
  }

  const flags = {};
  if (EXPORT_PATH?.length) {
    const chalIds = Object.values(chalname2id);
    const flagsJson = JSON.parse(await realfs.promises.readFile(
        `${EXPORT_PATH}/db/flags.json`));
    for (const entry of flagsJson.results) {
      const {challenge_id: id, content: flag} = entry;
      if (!chalIds.includes(id)) {
        console.log(`Unknown challenge id ${id} with flag "${flag}"`);
        continue;
      }

      const hash = crypto.createHash('sha256').update(flag).digest('hex');

      if (flags[id] === undefined) {
        flags[id] = [];
      }
      flags[id].push(hash);
    }
  } else {
    for (const chalYmlPath of await glob(
        `${CHAL_REPO}/**/challenge.yml`)) {
      yaml.loadAll(await realfs.promises.readFile(chalYmlPath), (doc) => {
        const name = doc.name;
        if (!(name in chalname2id)) {
          console.log(`Unknown challenge "${name}"`);
          return;
        }
        const id = chalname2id[name];

        for (const flag of doc.flags) {
          const hash = crypto.createHash('sha256').update(flag).digest('hex');

          if (flags[id] === undefined) {
            flags[id] = [];
          }
          flags[id].push(hash);
        }
      });
    }
  }

  for (const [name, id] of Object.entries(chalname2id)) {
    if (flags[id] === undefined) {
      console.log(`No flag found for challenge ${name}`);
    }
  }

  return flags;
};

const makeWebpack = async (flags, isBetaTheme) => {
  const memfs = Volume.fromJSON({'./flags.json': JSON.stringify(flags)});

  const ufs = new Union();
  ufs.use(realfs).use(memfs);

  await new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: 'production',
      devtool: 'hidden-cheap-source-map',
      entry: isBetaTheme ?
        './webpack/index-core-beta.js' : './webpack/index-core.js',
      output: {
        filename: 'challenges.min.js',
      },
      optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
          extractComments: {
            condition: 'all',
            banner: () => 'SPDX-License-Identifier: Apache-2.0',
          },
        })],
      },
    });

    compiler.inputFileSystem = compiler.outputFileSystem = ufs;

    compiler.run((err, stats) => {
      console.log(stats.toString({
        colors: true,
      }));

      if (err || stats.hasErrors()) {
        reject(err);
      }
      resolve();
    });
  });

  return await memfs.promises.readFile('dist/challenges.min.js');
};

const detectBetaTheme = function(document) {
  if (IS_CORE_BETA === '1') {
    console.log('$IS_CORE_BETA=1, assuming theme is based on core-beta');
    return true;
  } else if (IS_CORE_BETA === '0') {
    console.log('$IS_CORE_BETA=0, assuming theme is based on core');
    return false;
  } else if (document.querySelector('template')) {
    console.log('Theme seems to be based on core-beta intead of core.');
    console.log('If this is wrong set $IS_CORE_BETA=0');
    return true;
  } else {
    console.log('Theme seems to be based on core intead of core-beta.');
    console.log('If this is wrong set $IS_CORE_BETA=1');
    return false;
  }
};

const main = async function() {
  const challengesHtml = PAGES_REPO + '/challenges.html';
  const challengesJs = PAGES_REPO + INJECTED_JS_PATH;

  const inputhtml = realfs.readFileSync(challengesHtml, 'utf8');
  const {window} = new JSDOM(inputhtml);
  const {document} = window;

  const isBetaTheme = detectBetaTheme(document);

  const flags = await makeFlagsJson();
  const chalBundled = await makeWebpack(flags, isBetaTheme);
  await realfs.promises.mkdir(
      path.dirname(challengesJs), {recursive: true});
  await realfs.promises.writeFile(challengesJs, chalBundled);

  let targetNode = Array.from(document.querySelectorAll('script'))
      .filter((node) => node.attributes.src?.value?.length &&
          node.attributes.defer);

  assert(targetNode.length);
  targetNode = targetNode.at(-1);

  const nodehtml = await util.findWithFixup(
      inputhtml, targetNode.outerHTML, {});

  const [nodehtmlline] = inputhtml.match(
      new RegExp(util.makeRegexForLine(nodehtml)));
  assert(nodehtmlline);

  const duphtml = util.replaceOnce(
      nodehtmlline, targetNode.attributes.src.value, INJECTED_JS_PATH);

  const outputhtml = util.replaceOnce(
      inputhtml, nodehtmlline, nodehtmlline + duphtml);

  realfs.writeFileSync(challengesHtml, outputhtml);

  return 0;
};

if (require.main === module) {
  main().then(process.exit);
}
