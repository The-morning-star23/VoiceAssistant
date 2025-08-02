// src/workers/whisper.worker.ts (PING-PONG TEST)

console.log("WHISPER WORKER (PING TEST): Script loaded.");

self.onmessage = (event) => {
  console.log("WHISPER WORKER (PING TEST): Message received!", event.data);

  if (event.data === 'ping') {
    console.log("WHISPER WORKER (PING TEST): Received 'ping', sending 'pong' back.");
    self.postMessage('pong');
  }
};

console.log("WHISPER WORKER (PING TEST): Event listener attached.");
