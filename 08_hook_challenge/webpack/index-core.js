/* global CTFd */

const hooks = require('./hooks.js');

CTFd.api.post_challenge_attempt = ((submitChallenge) =>
  async function(parameters, body) {
    const {challenge_id: chalId, submission: flag} = body;
    return submitChallenge(chalId, flag);
  }
)(hooks.submitChallenge());

CTFd.api.get_hint = ((loadHint) =>
  async function(parameters) {
    const hintId = parameters.hintId;
    return loadHint(hintId);
  }
)(hooks.loadHint(CTFd.lib.markdown(),
    () => CTFd._internal.challenge.data.hints));
