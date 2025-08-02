// src/workers/whisper.worker.ts (BULLETPROOF DEBUG VERSION 2)

import { pipeline, AutomaticSpeechRecognitionPipeline, PipelineType } from '@xenova/transformers';

console.log("WHISPER WORKER: Script loaded.");

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

        const transcript = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
        });
        console.log("WHISPER WORKER: Transcription complete.", transcript);

        const resultText = (transcript as { text: string }).text;
        
        console.log("WHISPER WORKER: Sending result back to main thread.");
        self.postMessage({
            type: 'transcription_result',
            text: resultText || "...", // Send something back even if text is empty
        });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("WHISPER WORKER: CATCH BLOCK - An error occurred:", error);
        self.postMessage({ type: 'error', message: error.message || 'An unknown error occurred in the whisper worker.' });
    }
};

console.log("WHISPER WORKER: Event listener attached.");