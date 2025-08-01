import { NextRequest, NextResponse } from 'next/server';

// This function handles POST requests to the /api/chat endpoint
export async function POST(req: NextRequest) {
    try {
        // Extract the user's prompt from the request body
        const { prompt } = await req.json();

        // Get the API key from environment variables
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
        }

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }
        
        // Construct the request payload for the Gemini API
        // We use 'gemini-1.5-flash' which is fast and has a great free tier.
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

        // Make the API call to Google
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: body,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Google API Error:', errorBody);
            return NextResponse.json({ error: `Google API error: ${response.statusText}` }, { status: response.status });
        }

        const data = await response.json();

        // Extract the AI's response text
        // The response structure can be complex, so we safely navigate it.
        const assistantResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!assistantResponse) {
            console.error('Could not extract text from Google API response:', data);
            return NextResponse.json({ error: 'Failed to get a valid response from the AI.' }, { status: 500 });
        }

        // Send the response back to our frontend application
        return NextResponse.json({ response: assistantResponse.trim() });

    } catch (error) {
        console.error('API Route Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}