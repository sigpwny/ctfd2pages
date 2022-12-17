/* global CTFd */

const hooks = require('./hooks.js');
const MarkdownIt = require('markdown-it');

// source: https://github.com/CTFd/CTFd.js/commit/2c0db5b355dad9ebfdeb6dea66df0633c4946b94
const markdown = function(config) {
  const mdConfig = {...{html: true, linkify: true}, ...config};
  const md = new MarkdownIt(mdConfig);
  md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
    tokens[idx].attrPush(['target', '_blank']);
    return self.renderToken(tokens, idx, options);
  };
  return md;
};

CTFd.pages.challenge.submitChallenge = hooks.submitChallenge();
CTFd.pages.challenge.loadHint = hooks.loadHint(markdown(),
    () => CTFd._internal.challenge.data.hints);
