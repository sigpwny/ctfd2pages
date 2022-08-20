/* global CTFd */

const FLAGS = require('./flags.json');
const md = CTFd.lib.markdown();

const sha256sum = async (string) => {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
  return Array.from(new Uint8Array(hashBuffer))
      .map((bytes) => bytes.toString(16).padStart(2, '0'))
      .join('');
};

CTFd.api.post_challenge_attempt = async function(parameters, body) {
  const {challenge_id: chalId, submission: flag} = body;
  const expectedSHA = FLAGS[chalId];
  const submittedSHA = await sha256sum(flag);

  if (!expectedSHA?.length) {
    return {
      status: 200,
      success: true,
      data: {
        status: 'paused',
        message: 'Flag not archived',
      },
    };
  } else if (expectedSHA.includes(submittedSHA)) {
    return {
      status: 200,
      success: true,
      data: {
        status: 'correct',
        message: 'Correct',
      },
    };
  } else {
    return {
      status: 200,
      success: true,
      data: {
        status: 'incorrect',
        message: 'Incorrect',
      },
    };
  }
};

CTFd.api.get_hint = async function(parameters) {
  const hintId = parameters.hintId;

  for (const hintOrig of CTFd._internal.challenge.data.hints) {
    if (hintOrig.id !== hintId) {
      continue;
    }

    const hint = Object.assign({}, hintOrig);
    if (hint.html === undefined) {
      hint.html = md.render(hint.content);
    }

    return {
      status: 200,
      success: true,
      data: hint,
    };
  }

  throw new Error('Hint not found');
};
