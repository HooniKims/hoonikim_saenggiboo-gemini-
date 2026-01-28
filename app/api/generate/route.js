import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt, apiKey } = body;

        // Use provided API key or fallback to server env
        const finalApiKey = apiKey || process.env.GEMINI_API_KEY;

        if (!finalApiKey) {
            return NextResponse.json(
                { error: "Gemini API Key is missing. Please provide it in settings or environment variables." },
                { status: 400 }
            );
        }

        // Gemini API endpoint with model gemini-2.5-flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${finalApiKey}`;

        // Prepare the request payload for Gemini API
        const payload = {
            contents: [
                {
                    parts: [
                        {
                            text: `You are a helpful assistant for Korean teachers.\n\n${prompt}`
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API 오류 (코드: ${response.status})\n응답: ${errorText}`);
        }

        const responseData = await response.json();

        // Parse Gemini API response
        if (!responseData.candidates || !responseData.candidates[0] ||
            !responseData.candidates[0].content || !responseData.candidates[0].content.parts ||
            !responseData.candidates[0].content.parts[0] || !responseData.candidates[0].content.parts[0].text) {
            throw new Error('Gemini API 응답 형식 오류');
        }

        const content = responseData.candidates[0].content.parts[0].text.trim();

        return NextResponse.json({ result: content });
    } catch (error) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate response." },
            { status: 500 }
        );
    }
}
