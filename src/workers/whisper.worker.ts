// src/workers/whisper.worker.ts

import { pipeline, AutomaticSpeechRecognitionPipeline, PipelineType } from '@xenova/transformers';

// Define a more specific type for the progress callback data
interface ProgressData {
    status: string;
    file: string;
    progress: number;
    loaded: number;
    total: number;
}

/**
 * This class is a Singleton. This is a design pattern that ensures we only have one instance
 * of this resource-intensive class, preventing us from loading the same AI model into memory multiple times.
 */
class WhisperPipeline {
    // Define the task and model for this pipeline
    static task: PipelineType = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-base';

    // The 'instance' will hold the promise that resolves to our pipeline
    static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

    // The 'getInstance' method is the public entry point for accessing the singleton instance.
    static async getInstance(progress_callback?: (progress: ProgressData) => void) {
        if (this.instance === null) {
            // If the instance doesn't exist, we create it.
            // We use a type assertion 'as Promise<...>' to tell TypeScript we are certain
            // that the pipeline created will be for automatic speech recognition.
            // This resolves several of the errors you saw.
            this.instance = pipeline(this.task, this.model, { progress_callback }) as Promise<AutomaticSpeechRecognitionPipeline>;
        }
        return this.instance;
    }
}

// This is the main event listener for the worker. It listens for messages from the main UI thread.
self.onmessage = async (event) => {
    try {
        // 1. Retrieve the singleton instance of the pipeline.
        //    On the first call, this will download and load the model.
        //    We pass a function to report progress back to the UI.
        const transcriber = await WhisperPipeline.getInstance((progress) => {
            // Post a message back to the main thread to update the UI with the download progress.
            self.postMessage({ type: 'download_progress', data: progress });
        });

        // 2. Extract the audio data from the event message.
        //    The main thread sends the audio as a Float32Array.
        const audioData = new Float32Array(event.data);

        // 3. Perform the transcription.
        //    The 'transcriber' function takes the audio data and returns the transcribed text.
        const transcript = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: 'english',
            task: 'transcribe',
        });

        // 4. Send the result back to the main thread.
        //    We perform a check to ensure the transcript and its text property exist.
        //    The result from the library is an object like { text: "..." }, so we cast it
        //    to that type to satisfy TypeScript.
        const resultText = (transcript as { text: string }).text;
        if (resultText) {
            self.postMessage({
                type: 'transcription_result',
                text: resultText,
            });
        }
    } catch (error) {
        // If anything goes wrong, send an error message back to the main thread.
        self.postMessage({ type: 'error', message: 'Transcription failed', error });
    }
};