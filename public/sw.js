// public/sw.js

const CACHE_NAME = 'offline-voice-assistant-v2'; // Increased version to ensure update

// These are the exact URLs the @xenova/transformers.js library fetches.
// Caching them is the key to making the app work offline.
const MODEL_FILES_TO_CACHE = [
    // --- Whisper Base Model (for Speech-to-Text) ---
    'https://huggingface.co/Xenova/whisper-base/resolve/main/config.json',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/model.onnx',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/preprocessor_config.json',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/tokenizer.json',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/merges.txt',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/vocab.json',

    // --- SpeechT5 TTS Model (for Text-to-Speech) ---
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/config.json',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/model.onnx',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/generation_config.json',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/tokenizer.json',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/tokenizer_config.json',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/special_tokens_map.json',

    // --- SpeechT5 Vocoder (works with the TTS model) ---
    'https://huggingface.co/Xenova/speecht5_vocoder/resolve/main/config.json',
    'https://huggingface.co/Xenova/speecht5_vocoder/resolve/main/model.onnx',

    // --- Speaker Embeddings (defines the voice) ---
    'https://huggingface.co/datasets/Xenova/cmu-arctic-xvectors/resolve/main/cmu_us_slt_arctic-wav-arctic_a0001.bin',

    // --- ONNX Runtime (the engine for the models) ---
    // We cache multiple versions to support different browsers/CPUs
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm.wasm',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd.wasm',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-threaded.wasm',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd-threaded.wasm',
];

// The 'install' event is fired when the service worker is first installed.
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    // waitUntil() ensures that the service worker will not install until the code inside has successfully completed.
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching model files...');
            // We fetch and cache all the large model files.
            // Using individual fetches to avoid one failure causing all to fail.
            const promises = MODEL_FILES_TO_CACHE.map(url => {
                // We use 'no-cors' mode for Hugging Face URLs to prevent potential CORS issues during caching.
                const request = new Request(url, { mode: 'no-cors' });
                return fetch(request).then(response => {
                    if (response.status === 200 || response.type === 'opaque') {
                        return cache.put(url, response);
                    }
                    console.warn(`Service Worker: Failed to cache ${url}, status: ${response.status}`);
                    return Promise.resolve();
                }).catch(err => console.error(`Service Worker: Caching failed for ${url}:`, err));
            });
            return Promise.all(promises);
        }).then(() => {
            console.log('Service Worker: All model files cached successfully.');
            // self.skipWaiting() forces the waiting service worker to become the active service worker.
            return self.skipWaiting();
        })
    );
});

// The 'activate' event is fired when the service worker becomes active.
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            // This deletes old caches to free up space.
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // self.clients.claim() allows an active service worker to set itself as the controller for all clients within its scope.
            return self.clients.claim();
        })
    );
});

// The 'fetch' event is fired for every network request made by the page.
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // We only apply the "cache-first" strategy to our model files.
    if (url.startsWith('https://huggingface.co/') || url.startsWith('https://cdn.jsdelivr.net/')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    // If we have it in the cache, serve it immediately.
                    return cachedResponse;
                }
                // If not, fetch it from the network (this should only happen during the initial caching).
                return fetch(event.request);
            })
        );
    }
    // For all other requests (like our API call to Gemini), we let them pass through to the network.
});