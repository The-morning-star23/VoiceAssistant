// src/app/page.tsx (HELLO WORLD TEST)
'use client';

import { useEffect } from 'react';

export default function Home() {

    useEffect(() => {
        // This code should run as soon as the page loads.
        console.log("HELLO WORLD: The page JavaScript is running!");
        alert("HELLO WORLD: If you see this, the page is working.");
    }, []); // Empty dependency array ensures this runs only once.


    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <h1 className="text-4xl font-bold text-gray-200">Hello World Test</h1>
            <p className="text-lg text-gray-400 mt-2">
                Please check your console and look for an alert box.
            </p>
        </div>
    );
}
