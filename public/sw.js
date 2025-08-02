// public/sw.js (FINAL, ROBUST VERSION)

const CACHE_NAME = 'offline-voice-assistant-v4'; // Increased version to force an update

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

// This function fetches and caches files one by one.
async function cacheFiles(cache) {
    console.log('SW: Caching files individually...');
    for (const url of MODEL_FILES_TO_CACHE) {
        try {
            // We use 'no-cors' mode which is more lenient for opaque resources from CDNs.
            const request = new Request(url, { mode: 'no-cors' });
            const response = await fetch(request);
            if (response.ok || response.type === 'opaque') {
                await cache.put(url, response);
            } else {
                console.warn(`SW: Failed to cache ${url}, status: ${response.status}`);
            }
        } catch (err) {
            console.error(`SW: Caching failed for ${url}:`, err);
        }
    }
    console.log('SW: Individual file caching complete.');
}

self.addEventListener('install', (event) => {
    console.log('SW: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cacheFiles(cache))
            .then(() => self.skipWaiting())
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
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request);
        })
    );
});