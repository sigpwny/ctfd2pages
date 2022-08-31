const assert = require('node:assert');
const crypto = require('node:crypto');
const realfs = require('node:fs');
const path = require('node:path');

const {JSDOM} = require('jsdom');
const {Volume} = require('memfs');
const {Union} = require('unionfs');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const yaml = require('js-yaml');

const util = require('../util.js');

const {PAGES_REPO, CHAL_REPO, EXPORT_PATH} = process.env;

const INJECTED_JS_PATH = '/ctfd2pages/hooks/challenges.min.js';

const makeFlagsJson = async () => {
  const chalname2id = {};
  for (const chalJsonPath of await util.globPromise(
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
    for (const chalYmlPath of await util.globPromise(
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

const makeWebpack = async (flags) => {
  const memfs = Volume.fromJSON({'./flags.json': JSON.stringify(flags)});

  const ufs = new Union();
  ufs.use(realfs).use(memfs);

  await new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: 'development',
      devtool: 'hidden-cheap-source-map',
      entry: './webpack-index.js',
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

const main = async function() {
  const challengesHtml = PAGES_REPO + '/challenges.html';
  const challengesJs = PAGES_REPO + INJECTED_JS_PATH;

  const flags = await makeFlagsJson();
  const chalBundled = await makeWebpack(flags);
  await realfs.promises.mkdir(
      path.dirname(challengesJs), {recursive: true});
  await realfs.promises.writeFile(challengesJs, chalBundled);

  const inputhtml = realfs.readFileSync(challengesHtml, 'utf8');
  const {window} = new JSDOM(inputhtml);
  const {document} = window;

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
