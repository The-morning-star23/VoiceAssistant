'use client';

import { useEffect, useRef } from 'react';

export default function Home() {
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        console.log("PAGE.TSX (PING TEST): useEffect running. Initializing worker...");

        if (!workerRef.current) {
            try {
                const worker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });
                workerRef.current = worker;
                console.log("PAGE.TSX (PING TEST): Worker created.");

                worker.onmessage = (event) => {
                    console.log("PAGE.TSX (PING TEST): Message received from worker!", event.data);
                    if (event.data === 'pong') {
                        alert('SUCCESS: Worker communication is working!');
                    }
                };

                worker.onerror = (error) => {
                    console.error("PAGE.TSX (PING TEST): A critical worker error occurred.", error);
                    alert(`A critical worker error occurred: ${error.message}`);
                };

                // Send the ping message
                setTimeout(() => {
                    console.log("PAGE.TSX (PING TEST): Sending 'ping' to worker...");
                    worker.postMessage('ping');
                }, 2000); // Wait 2 seconds for worker to be ready

            } catch (e) {
                console.error("PAGE.TSX (PING TEST): Failed to create worker.", e);
                alert("Failed to create the web worker. Check the console for errors.");
            }
        }

        return () => {
            workerRef.current?.terminate();
        };
    }, []); // Empty dependency array ensures this runs only once.


    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <div className="w-full max-w-2xl flex flex-col h-[90vh]">
                <header className="text-center p-4">
                    <h1 className="text-4xl font-bold text-gray-200">Worker Communication Test</h1>
                    <p className="text-lg text-gray-400 mt-2">
                        Testing worker communication... Check the console and look for an alert box.
                    </p>
                </header>
            </div>
        </div>
    );
}
