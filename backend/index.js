const express = require('express');
const app = express();
const {Worker} = require('worker_threads');
// const WebSocket = require('ws');

// const wss = new WebSocket.Server({ port: 8080 });
// let _ws;
// wss.on('connection', (ws) => {
//   _ws = ws;

//   // Message event handler
//   _ws.on('message', (message) => {
    
//   });

//   // Close event handler
//   _ws.on('close', () => {
//     console.log('Client disconnected');
//   });
// });

const worker = new Worker('./backend/worker.js');
worker.on('message', (result) => {
  console.log('file path :', result);
})
worker.on("error", (msg) => {
  console.log(msg);
});

// GET - dependencies
app.get('/', async (req, res) => {
  console.log(process.cwd());
  res.status(200).json({ project: process.cwd() });
});

app.listen(3000, async () => {
  console.log('Server is running on http://localhost:3000');
});
