'use client';

import { useState, useEffect, useRef } from 'react';

// Define the structure for a single turn in our conversation
interface ConversationTurn {
    speaker: 'user' | 'assistant';
    text: string;
    audioUrl?: string; // URL for the assistant's spoken response
    perf?: PerformanceMetrics; // Performance metrics for the assistant's turn
}

// Define the structure for our performance measurements
interface PerformanceMetrics {
    stt: number | null; // Speech-to-Text latency
    llm: number | null; // Large Language Model API latency
    tts: number | null; // Text-to-Speech latency
    total: number | null; // Total time from user finishing speaking to assistant starting to speak
}

export default function Home() {
    // State management
    const [status, setStatus] = useState('loading_models');
    const [conversation, setConversation] = useState<ConversationTurn[]>([]);
    const [isRecording, setIsRecording] = useState(false);

    // Refs for managing workers, media recorder, and performance timers
    const whisperWorkerRef = useRef<Worker | null>(null);
    const ttsWorkerRef = useRef<Worker | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const perfRef = useRef<{ start: number, stt_end?: number, llm_end?: number, tts_end?: number }>({ start: 0 });

    // This useEffect runs only ONCE to initialize the workers.
    useEffect(() => {
        if (!whisperWorkerRef.current) {
            const worker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (event) => {
                const { type, text, message } = event.data;
                switch (type) {
                    case 'model_loading':
                        setStatus(`loading_stt_${message.status}`);
                        if (message.status === 'ready') {
                            // Once STT is ready, trigger TTS model load
                            ttsWorkerRef.current?.postMessage({ type: 'load' });
                        }
                        break;
                    case 'transcription_result':
                        handleTranscription(text);
                        break;
                    case 'error':
                        console.error('Whisper Worker Error:', message);
                        alert(`Speech-to-text failed: ${message}`);
                        setStatus('idle');
                        break;
                }
            };
            whisperWorkerRef.current = worker;
        }

        if (!ttsWorkerRef.current) {
            const worker = new Worker(new URL('../workers/tts.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (event) => {
                const { type, audio, message } = event.data;
                switch (type) {
                    case 'model_loading':
                        setStatus(`loading_tts_${message.status}`);
                        if (message.status === 'ready') {
                            setStatus('idle'); // Both models are now ready
                        }
                        break;
                    case 'synthesis_result':
                        handleSynthesis(audio);
                        break;
                    case 'error':
                        console.error('TTS Worker Error:', message);
                        alert(`Text-to-speech failed: ${message}`);
                        setStatus('idle');
                        break;
                }
            };
            ttsWorkerRef.current = worker;
        }
        
        // Trigger initial STT model loading. TTS will be triggered after.
        whisperWorkerRef.current?.postMessage({ type: 'load' });

        return () => {
            whisperWorkerRef.current?.terminate();
            ttsWorkerRef.current?.terminate();
        };
    }, []); // Empty dependency array ensures this runs only once.

    const handleTranscription = (text: string) => {
        if (!text || text.trim() === 'Transcription was empty.') {
            setStatus('idle');
            alert("Could not understand audio. Please try speaking again.");
            return;
        }
        perfRef.current.stt_end = performance.now();
        setConversation(prev => [...prev, { speaker: 'user', text }]);
        
        setStatus('llm_thinking');
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text }),
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(errBody => {
                    throw new Error(errBody.error || `API responded with status ${res.status}`);
                });
            }
            return res.json();
        })
        .then(data => {
            perfRef.current.llm_end = performance.now();
            const assistantResponse = data.response;
            if (assistantResponse && ttsWorkerRef.current) {
                setConversation(prev => [...prev, { speaker: 'assistant', text: assistantResponse }]);
                setStatus('tts_synthesizing');
                ttsWorkerRef.current.postMessage({ type: 'synthesize', text: assistantResponse });
            } else {
                throw new Error(data.error || 'No valid response text from API');
            }
        })
        .catch(err => {
            console.error("API Error:", err.message);
            setConversation(prev => [...prev, { speaker: 'assistant', text: `Sorry, an error occurred: ${err.message}` }]);
            setStatus('idle');
        });
    };

    const handleSynthesis = (audioBlob: Blob) => {
        perfRef.current.tts_end = performance.now();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        setStatus('speaking');
        audio.play();
        audio.onended = () => setStatus('idle');

        const sttLatency = perfRef.current.stt_end ? perfRef.current.stt_end - perfRef.current.start : null;
        const llmLatency = perfRef.current.llm_end && perfRef.current.stt_end ? perfRef.current.llm_end - perfRef.current.stt_end : null;
        const ttsLatency = perfRef.current.tts_end && perfRef.current.llm_end ? perfRef.current.tts_end - perfRef.current.llm_end : null;
        const totalLatency = perfRef.current.tts_end ? perfRef.current.tts_end - perfRef.current.start : null;

        setConversation(prev => {
            const newConversation = [...prev];
            const lastTurnIndex = newConversation.findLastIndex(turn => turn.speaker === 'assistant');
            if (lastTurnIndex !== -1) {
                newConversation[lastTurnIndex] = {
                    ...newConversation[lastTurnIndex],
                    audioUrl: audioUrl,
                    perf: { stt: sttLatency, llm: llmLatency, tts: ttsLatency, total: totalLatency }
                };
            }
            return newConversation;
        });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                setStatus('stt_transcribing'); 
                try {
                    const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    whisperWorkerRef.current?.postMessage({ type: 'transcribe', buffer: arrayBuffer }, [arrayBuffer]);
                } catch (error) {
                    console.error("Error processing audio:", error);
                    alert("There was an error processing the audio. Please try again.");
                    setStatus('idle');
                } finally {
                    stream.getTracks().forEach(track => track.stop());
                }
            };

            recorder.start();
            setIsRecording(true);
            setStatus('listening');
            perfRef.current = { start: performance.now() };
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert("Microphone access denied. Please allow microphone access in your browser settings.");
            setStatus('idle');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleToggleConversation = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const getStatusText = () => {
        if (status.startsWith('loading_stt')) return 'Loading speech-to-text model...';
        if (status.startsWith('loading_tts')) return 'Loading text-to-speech model...';
        if (status === 'loading_models') return 'Initializing AI models...';
        if (status === 'idle') return 'Press the button and start speaking';
        if (status === 'listening') return 'Listening...';
        if (status === 'stt_transcribing') return 'Transcribing audio...';
        if (status === 'llm_thinking') return 'Thinking...';
        if (status === 'tts_synthesizing') return 'Synthesizing audio...';
        if (status === 'speaking') return 'Speaking...';
        return '...';
    };

    const isButtonDisabled = status !== 'idle' && status !== 'listening';

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <div className="w-full max-w-2xl flex flex-col h-[90vh]">
                <header className="text-center p-4">
                    <h1 className="text-4xl font-bold text-gray-200">Offline Voice Assistant</h1>
                    <p className="text-lg text-gray-400 mt-2">{getStatusText()}</p>
                </header>

                <main className="flex-grow overflow-y-auto p-4 bg-gray-800 rounded-lg shadow-lg space-y-4">
                    {conversation.map((turn, index) => (
                        <div key={index} className={`flex ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg max-w-md ${turn.speaker === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                                <p>{turn.text}</p>
                                {turn.perf && (
                                    <div className="text-xs text-gray-400 mt-2 border-t border-gray-600 pt-1">
                                        <span>STT: {turn.perf.stt?.toFixed(0)}ms</span> | 
                                        <span> LLM: {turn.perf.llm?.toFixed(0)}ms</span> | 
                                        <span> TTS: {turn.perf.tts?.toFixed(0)}ms</span> |
                                        <span className="font-bold"> Total: {turn.perf.total?.toFixed(0)}ms</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                     {conversation.length === 0 && (
                        <div className="text-center text-gray-500 pt-8">
                            Your conversation will appear here.
                        </div>
                    )}
                </main>

                <footer className="p-4 flex justify-center items-center">
                    <button
                        onClick={handleToggleConversation}
                        disabled={isButtonDisabled}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
                            ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}
                            ${isButtonDisabled ? 'bg-gray-500 cursor-not-allowed' : 'hover:bg-green-600'}
                            focus:outline-none focus:ring-4 focus:ring-green-300`}
                    >
                        <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                           <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zM4 4a1 1 0 00-1 1v6a5 5 0 0010 0V5a1 1 0 00-1-1H4z" />
                        </svg>
                    </button>
                </footer>
            </div>
        </div>
    );
}