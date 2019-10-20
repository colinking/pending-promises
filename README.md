# pending-promises

Fetches a list of pending promises via the Node.js [Runtime](https://chromedevtools.github.io/devtools-protocol/v8/Runtime) APIs.

This is just a module-ized version of bnoordhuis's gist here: https://github.com/nodejs/node/issues/29355#issuecomment-525935873

## Background

This was built as an experiment to see if we could detect when an Ink CLI should automatically exit, but it turns out that it's very pretty much impossible to "mark" promises s.t. you can identify them in the response from the Runtime API. In that case, we can't identify if it is _only_ the `exitPromise` from Ink that is left over.

Storing this on GitHub mostly for future reference.

There's an "async" version in `async.js` that I wrote while digging through the gist above, but it creates an extra ~4 promises that you can't "mark" so I went back to callbacks, as in `index.js`.
