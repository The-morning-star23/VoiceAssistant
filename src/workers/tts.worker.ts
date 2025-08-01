import { pipeline, PipelineType, RawImage } from '@xenova/transformers';

// Define a specific type for the progress callback data
interface ProgressData {
    status: string;
    file: string;
    progress: number;
    loaded: number;
    total: number;
}

// Define the expected output structure from the TTS model
interface TTSOutput {
    audio: Float32Array;
    sampling_rate: number;
}

// Define the expected input options for the TTS function call
interface TTSCallOptions {
    speaker_embeddings: Uint8Array | null;
}

// Define the type for the TTS pipeline instance itself, which is a function.
// It takes text and options, and returns a promise resolving to the audio output.
type TTSPipelineInstance = (text: string, options: TTSCallOptions) => Promise<TTSOutput>;

/**
 * Singleton class for the Text-to-Speech pipeline.
 */
class TTSPipeline {
    static task: PipelineType = 'text-to-speech';
    static model = 'Xenova/speecht5_tts';
    static vocoder = 'Xenova/speecht5_vocoder';
    static embeddings = 'https://huggingface.co/datasets/Xenova/cmu-arctic-xvectors/resolve/main/cmu_us_slt_arctic-wav-arctic_a0001.bin';

    static instance: Promise<TTSPipelineInstance> | null = null;
    static speaker_embeddings_data: Uint8Array | null = null;

    static async getInstance(progress_callback?: (progress: ProgressData) => void) {
        if (this.speaker_embeddings_data === null) {
            const speakerData = (await RawImage.fromURL(this.embeddings)).data;
            this.speaker_embeddings_data = new Uint8Array(speakerData);
        }

        if (this.instance === null) {
            // The 'vocoder' option is valid at runtime but missing from some library type definitions.
            // We create a custom options object and cast it to 'any' to bypass this specific type error cleanly.
            const pipelineOptions: Record<string, unknown> = { vocoder: this.vocoder };
            if (progress_callback) {
                pipelineOptions.progress_callback = progress_callback;
            }

            // We cast the result of pipeline() to the specific function type we defined.
            this.instance = pipeline(this.task, this.model, pipelineOptions) as Promise<TTSPipelineInstance>;
        }
        return this.instance;
    }
}

// Utility function to convert raw PCM audio data into a playable WAV file blob.
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


// Main event listener for the worker
self.onmessage = async (event) => {
    try {
        const { text } = event.data;

        const synthesizer = await TTSPipeline.getInstance((progress) => {
            self.postMessage({ type: 'download_progress', data: progress });
        });

        const wav = await synthesizer(text, {
            speaker_embeddings: TTSPipeline.speaker_embeddings_data,
        });

        const wavBlob = pcmToWav(wav.audio, wav.sampling_rate);

        self.postMessage({
            type: 'synthesis_result',
            audio: wavBlob,
        });

    } catch (error) {
        self.postMessage({ type: 'error', message: 'Synthesis failed', error });
    }
};