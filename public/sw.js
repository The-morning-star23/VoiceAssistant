// public/sw.js (FINAL, SIMPLIFIED VERSION)

const CACHE_NAME = 'offline-voice-assistant-v3'; // Increased version to force an update

// The list of files to cache remains the same.
const MODEL_FILES_TO_CACHE = [
    // Whisper Base Model
    'https://huggingface.co/Xenova/whisper-base/resolve/main/config.json',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/model.onnx',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/preprocessor_config.json',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/tokenizer.json',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/merges.txt',
    'https://huggingface.co/Xenova/whisper-base/resolve/main/vocab.json',
    // SpeechT5 TTS Model
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/config.json',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/model.onnx',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/generation_config.json',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/tokenizer.json',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/tokenizer_config.json',
    'https://huggingface.co/Xenova/speecht5_tts/resolve/main/special_tokens_map.json',
    // SpeechT5 Vocoder
    'https://huggingface.co/Xenova/speecht5_vocoder/resolve/main/config.json',
    'https://huggingface.co/Xenova/speecht5_vocoder/resolve/main/model.onnx',
    // Speaker Embeddings
    'https://huggingface.co/datasets/Xenova/cmu-arctic-xvectors/resolve/main/cmu_us_slt_arctic-wav-arctic_a0001.bin',
    // ONNX Runtime
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm.wasm',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd.wasm',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-threaded.wasm',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd-threaded.wasm',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Caching model files...');
            // We are removing the `{ mode: 'no-cors' }` part.
            // We will let the browser make standard requests.
            return cache.addAll(MODEL_FILES_TO_CACHE).catch(err => {
                // This will catch if any single file fails to cache.
                console.error("SW: Failed to cache files during install:", err);
            });
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // This strategy is called "Cache First".
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // If we have a copy in the cache, return it.
            if (cachedResponse) {
                return cachedResponse;
            }
            // Otherwise, fetch it from the network.
            return fetch(event.request).then(networkResponse => {
                // And after fetching, put a copy in the cache for next time.
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
    );
});