// src/workers/whisper.worker.ts (DEBUG VERSION)

import { pipeline, AutomaticSpeechRecognitionPipeline, PipelineType } from '@xenova/transformers';

interface ProgressData {
    status: string;
    file: string;
    progress: number;
    loaded: number;
    total: number;
}

class WhisperPipeline {
    static task: PipelineType = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-base';
    static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

    static async getInstance(progress_callback?: (progress: ProgressData) => void) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback }) as unknown as Promise<AutomaticSpeechRecognitionPipeline>;
        }
        return this.instance;
    }
}

// Main event listener for the worker
self.onmessage = async (event) => {
    try {
        console.log("WHISPER WORKER: Message received. Starting process.");

        // 1. Retrieve the pipeline instance.
        console.log("WHISPER WORKER: Loading model...");
        const transcriber = await WhisperPipeline.getInstance((progress) => {
            self.postMessage({ type: 'download_progress', data: progress });
        });
        console.log("WHISPER WORKER: Model loaded successfully.");

        // 2. Extract the audio data from the event message.
        const audioData = new Float32Array(event.data);
        console.log("WHISPER WORKER: Audio data received, length:", audioData.length);

        // 3. Perform the transcription.
        console.log("WHISPER WORKER: Starting transcription...");
        const transcript = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: 'english',
            task: 'transcribe',
        });
        console.log("WHISPER WORKER: Transcription complete.", transcript);

        // 4. Send the result back to the main thread.
        const resultText = (transcript as { text: string }).text;
        if (resultText) {
            console.log("WHISPER WORKER: Sending result back to main thread.");
            self.postMessage({
                type: 'transcription_result',
                text: resultText,
            });
        } else {
            throw new Error("Transcription result text is empty.");
        }
    } catch (error) {
        // If anything goes wrong, send a detailed error message back.
        console.error("WHISPER WORKER: An error occurred:", error);
        self.postMessage({ type: 'error', message: 'Transcription failed inside worker', error });
    }
};