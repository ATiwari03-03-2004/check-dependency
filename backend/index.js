const express = require('express');
const app = express();
const {Worker} = require('worker_threads');
const path = require('path');
const generateHierarchy = require('./src/normarlizeAndGenerateHierarchy');

const sharedArrayBuffer = new SharedArrayBuffer(1);

/**
 * if resync[0] === 0 -> no changes in files / directories of project directory.
 * else resync[0] === 1 -> change occured within files / directories of project directory, 
 *                         needs resyncing of dependency graph.
 */
const resync = new Uint8Array(sharedArrayBuffer);

const worker = new Worker('./backend/worker.js', { workerData: sharedArrayBuffer });
worker.on('message', (msg) => {});
worker.on("error", (msg) => console.log(msg));

/** 
 * GET - project name, third-party dependency(optionally includes devDependencies & nodejs built-in dependencies) 
 *       including the dependency usage information.
*/
app.get('/dep', async (req, res) => {
  let result = await generateHierarchy(path.basename(process.cwd()));
  res.send(result);
});

/**
 *  GET - dependency information needs to be re-synchronized due to changes within project files.
 */
app.get('/resync', (req, res) => {
  let flag = Atomics.load(resync, 0);
  Atomics.compareExchange(resync, 0, 1, 0);
  res.send({'resync': flag});
});

app.listen(3000, async () => {
  console.log('Server is running on http://localhost:3000');
});
