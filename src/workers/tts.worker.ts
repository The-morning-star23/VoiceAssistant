import { pipeline, PipelineType } from '@xenova/transformers';

// Define the expected output structure from the TTS model
interface TTSOutput {
    audio: Float32Array;
    sampling_rate: number;
}

// Define the expected input options for the TTS function call
interface TTSCallOptions {
    speaker_embeddings: Float32Array | null;
}

// Define the type for the TTS pipeline instance itself, which is a function.
type TTSPipelineInstance = (text: string, options: TTSCallOptions) => Promise<TTSOutput>;

class TTSPipeline {
    static task: PipelineType = 'text-to-speech';
    static model = 'Xenova/speecht5_tts';
    static vocoder = 'Xenova/speecht5_vocoder';
    static embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';

    static instance: Promise<TTSPipelineInstance> | null = null;
    static speaker_embeddings_data: Float32Array | null = null;

    static async getInstance() {
        if (this.speaker_embeddings_data === null) {
            const response = await fetch(this.embeddings);
            if (!response.ok) {
                throw new Error(`Failed to fetch speaker embeddings: ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            this.speaker_embeddings_data = new Float32Array(buffer);
        }

        if (this.instance === null) {
            const pipelineOptions: Record<string, unknown> = { vocoder: this.vocoder };
            this.instance = pipeline(this.task, this.model, pipelineOptions) as unknown as Promise<TTSPipelineInstance>;
        }
        return this.instance;
    }
}

function pcmToWav(pcm: Float32Array, sampleRate: number): Blob {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const pcmInt16 = new Int16Array(pcm.length);

    for (let i = 0; i < pcm.length; i++) {
        pcmInt16[i] = Math.max(-1, Math.min(1, pcm[i])) * 32767;
    }

    view.setUint32(0, 1380533830, false); // "RIFF"
    view.setUint32(4, 36 + pcmInt16.byteLength, true);
    view.setUint32(8, 1463899717, false); // "WAVE"
    view.setUint32(12, 1718449184, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 1684108385, false); // "data"
    view.setUint32(40, pcmInt16.byteLength, true);

    return new Blob([header, pcmInt16], { type: 'audio/wav' });
}

self.onmessage = async (event) => {
    try {
        const { text } = event.data;
        const synthesizer = await TTSPipeline.getInstance();
        const wav = await synthesizer(text, {
            speaker_embeddings: TTSPipeline.speaker_embeddings_data,
        });
        const wavBlob = pcmToWav(wav.audio, wav.sampling_rate);
        self.postMessage({
            type: 'synthesis_result',
            audio: wavBlob,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred in the tts worker.';
        self.postMessage({ type: 'error', message });
    }
};