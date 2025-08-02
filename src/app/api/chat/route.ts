import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    console.log("API ROUTE: Function started.");
    try {
        const { prompt } = await req.json();
        console.log("API ROUTE: Received prompt:", prompt);

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.error("API ROUTE ERROR: GOOGLE_API_KEY is not set in environment variables!");
            return NextResponse.json({ error: 'Google API key not configured on server' }, { status: 500 });
        }
        console.log("API ROUTE: API key found.");

        if (!prompt) {
            console.error("API ROUTE ERROR: Prompt is missing from request.");
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }
        
        const body = JSON.stringify({
            contents: [{
                parts: [{
                    text: `You are a helpful, brief, and conversational voice assistant. Please respond to this prompt in a single, short paragraph: "${prompt}"`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 150,
            }
        });

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        console.log("API ROUTE: Sending request to Google Gemini...");
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
        });

        console.log("API ROUTE: Received response from Google Gemini. Status:", response.status);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('API ROUTE ERROR: Google API Error:', errorBody);
            throw new Error(`Google API error: ${response.statusText}`);
        }

        const data = await response.json();
        const assistantResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!assistantResponse) {
            console.error('API ROUTE ERROR: Could not extract text from Google API response:', data);
            throw new Error('Failed to get a valid response from the AI.');
        }

        console.log("API ROUTE: Successfully got response from AI. Sending back to client.");
        return NextResponse.json({ response: assistantResponse.trim() });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('API ROUTE CATCH BLOCK: An error occurred:', error.message);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
