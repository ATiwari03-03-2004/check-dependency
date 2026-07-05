const express = require('express');
const app = express();
const { Worker } = require('worker_threads');
const path = require('path');
const generateHierarchy = require('./src/normarlizeAndGenerateHierarchy');
const crypto = require('crypto');
const fs = require('fs/promises');

const uuidResMap = new Map();
const worker = new Worker('./backend/worker.js');
worker.on('message', (msg) => {
  if (msg.msg === 'resync-info') {
    console.log(msg.changedFilePath);
    console.log(msg.renamedFilePath);
    console.log(msg.deletedFilepath);
    const res = uuidResMap.get(msg.uuid);
    res.status(200).send({ 'msg': 'works' });
  }
});
worker.on("error", (err) => console.log(err));
worker.on('exit', (code) => (code != 0) ? console.log('Worker stopped working with status code ' + code + '.') : null)

/** 
 * GET - project name, third-party dependency(optionally includes devDependencies & nodejs built-in dependencies) 
 *       including the dependency usage information.
*/
app.get('/dep', async (req, res) => {
  let result = await generateHierarchy(path.basename(process.cwd()));
  worker.postMessage({ 'msg': 'start-monitoring' });
  res.status(200).send(result);
});

/**
 * GET - dependency information needs to be re-synchronized due to changes within project files.
 */
app.get('/resync', async (req, res) => {
  const uuid = crypto.randomUUID();
  uuidResMap.set(uuid, res);
  worker.postMessage({
    'msg': 'resync-info',
    'uuid': uuid
  });
});

/**
 * GET - contents of the filePath (best to visit /resync before getting contents).
 */
app.get('/:filePath', async (req, res) => {
  const filePath = req.params.filePath;
  let contents = fs.readFile(filePath, { encoding: 'utf8' });
  res.status(200).send({contents});
});

app.listen(3000, async () => {
  console.log('Server is running on http://localhost:3000');
});
