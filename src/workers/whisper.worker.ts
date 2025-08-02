import { pipeline, AutomaticSpeechRecognitionPipeline, PipelineType } from '@xenova/transformers';

class WhisperPipeline {
    static task: PipelineType = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-base';
    static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

    static async getInstance() {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model) as unknown as Promise<AutomaticSpeechRecognitionPipeline>;
        }
        return this.instance;
    }
}

self.onmessage = async (event) => {
    try {
        const transcriber = await WhisperPipeline.getInstance();
        
        // The library can process the raw ArrayBuffer directly.
        // This avoids the Float32Array byte length error.
        const audioData = event.data;

        const transcript = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
        });

        const resultText = (transcript as { text: string }).text;
        
        self.postMessage({
            type: 'transcription_result',
            text: resultText || "Transcription was empty.",
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred in the whisper worker.';
        self.postMessage({ type: 'error', message });
    }
};