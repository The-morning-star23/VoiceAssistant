import { pipeline, AutomaticSpeechRecognitionPipeline, PipelineType } from '@xenova/transformers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProgressCallback = (progress: any) => void;

class WhisperPipeline {
    static task: PipelineType = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-base';
    static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

    static async getInstance(progress_callback?: ProgressCallback) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { 
                quantized: false, // This is the critical fix
                progress_callback 
            }) as unknown as Promise<AutomaticSpeechRecognitionPipeline>;
        }
        return this.instance;
    }
}

self.onmessage = async (event) => {
    const { type, buffer } = event.data;
    try {
        const transcriber = await WhisperPipeline.getInstance((progress) => {
            self.postMessage({ type: 'model_loading', message: progress });
        });

        if (type === 'load') {
            self.postMessage({ type: 'model_loading', message: { status: 'ready' } });
            return;
        }

        if (type === 'transcribe') {
            const audioData = new Float32Array(buffer);
            const transcript = await transcriber(audioData, {
                chunk_length_s: 30,
                stride_length_s: 5,
            });
            const resultText = (transcript as { text: string }).text;
            self.postMessage({ type: 'transcription_result', text: resultText || "Transcription was empty." });
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred in the whisper worker.';
        self.postMessage({ type: 'error', message });
    }
};