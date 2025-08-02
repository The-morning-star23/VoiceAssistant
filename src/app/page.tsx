'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
    const [status, setStatus] = useState('idle'); // idle, listening, transcribing
    const [transcribedText, setTranscribedText] = useState('');
    const [isRecording, setIsRecording] = useState(false);

    const whisperWorkerRef = useRef<Worker | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        console.log("MINIMAL TEST: Initializing worker...");
        if (!whisperWorkerRef.current) {
            const worker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (event) => {
                const { type, text, message } = event.data;
                console.log("MINIMAL TEST: Message from worker:", event.data);
                if (type === 'transcription_result') {
                    setTranscribedText(text);
                    setStatus('idle');
                } else if (type === 'error') {
                    console.error('MINIMAL TEST: Worker Error:', message);
                    alert(`Speech-to-text failed: ${message}`);
                    setStatus('idle');
                }
            };
            whisperWorkerRef.current = worker;
        }
        
        return () => {
            whisperWorkerRef.current?.terminate();
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];
            setTranscribedText('');

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                setStatus('transcribing'); 
                try {
                    const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    
                    whisperWorkerRef.current?.postMessage(arrayBuffer, [arrayBuffer]);
                } catch (error) {
                    console.error("Error processing audio:", error);
                    alert("There was an error processing the audio.");
                    setStatus('idle');
                } finally {
                    stream.getTracks().forEach(track => track.stop());
                }
            };

            recorder.start();
            setIsRecording(true);
            setStatus('listening');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert("Microphone access denied.");
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

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <div className="w-full max-w-2xl flex flex-col items-center">
                <header className="text-center p-4">
                    <h1 className="text-4xl font-bold text-gray-200">Minimal STT Test</h1>
                    <p className="text-lg text-gray-400 mt-2">Status: {status}</p>
                </header>

                <div className="w-full h-48 p-4 my-4 bg-gray-800 rounded-lg flex items-center justify-center">
                    <p className="text-xl text-gray-300">{transcribedText || "Transcription will appear here..."}</p>
                </div>

                <footer className="p-4 flex justify-center items-center">
                    <button
                        onClick={handleToggleConversation}
                        disabled={status !== 'idle' && status !== 'listening'}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
                            ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}
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