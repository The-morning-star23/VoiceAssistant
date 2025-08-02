import { pipeline, AutomaticSpeechRecognitionPipeline, PipelineType } from '@xenova/transformers';

console.log("WHISPER WORKER: Script loaded.");

// This catches errors that happen outside of our main try...catch block
self.addEventListener('unhandledrejection', event => {
  console.error('WHISPER WORKER: Unhandled rejection (promise failed):', event.reason);
  self.postMessage({ type: 'error', message: 'An unhandled promise rejection occurred in the whisper worker.' });
});

class WhisperPipeline {
    static task: PipelineType = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-base';
    static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

    static async getInstance() {
        console.log("WHISPER WORKER: getInstance called.");
        if (this.instance === null) {
            console.log("WHISPER WORKER: Pipeline instance is null, creating new one.");
            this.instance = pipeline(this.task, this.model) as unknown as Promise<AutomaticSpeechRecognitionPipeline>;
        }
        return this.instance;
    }
}

self.onmessage = async (event) => {
    console.log("WHISPER WORKER: onmessage fired. Data received.");
    try {
        const transcriber = await WhisperPipeline.getInstance();
        console.log("WHISPER WORKER: Pipeline instance retrieved.");
        
        const audioData = new Float32Array(event.data);
        console.log("WHISPER WORKER: Audio data processed, length:", audioData.length);

        if (audioData.length === 0) {
            throw new Error("Received empty audio data.");
        }

        console.log("WHISPER WORKER: Starting transcription...");
        const transcript = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
        });
        console.log("WHISPER WORKER: Transcription complete.", transcript);

        const resultText = (transcript as { text: string }).text;
        
        console.log("WHISPER WORKER: Sending result back to main thread.");
        self.postMessage({
            type: 'transcription_result',
            text: resultText || "...",
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred in the whisper worker.';
        console.error("WHISPER WORKER: CATCH BLOCK - An error occurred:", message);
        self.postMessage({ type: 'error', message });
    }
};

console.log("WHISPER WORKER: Event listener attached.");
