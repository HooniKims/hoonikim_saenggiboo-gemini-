import OpenAI from 'openai';

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt, additionalInstructions } = body;

        // 1. Ollama 설정 확인
        const ollamaUrl = process.env.OLLAMA_API_URL;
        const ollamaKey = process.env.OLLAMA_API_KEY;

        let clientSettings = {};
        let model = "";

        if (ollamaUrl) {
            // Ollama / 로컬 LLM 모드
            clientSettings = {
                apiKey: ollamaKey || 'ollama',
                baseURL: `${ollamaUrl}/v1`,
                defaultHeaders: ollamaKey ? {
                    'x-api-key': ollamaKey
                } : {}
            };
            model = "llama3.1:8b";
            console.log(`[API] Ollama 모드 사용: ${ollamaUrl}, 모델: ${model}`);
        } else {
            // OpenAI 모드 (Fallback)
            clientSettings = { apiKey: process.env.OPENAI_API_KEY };
            const hasAdditionalInstructions = additionalInstructions && additionalInstructions.trim();
            model = hasAdditionalInstructions ? "gpt-4o" : "gpt-4o-mini";
            console.log(`[API] OpenAI 모드 사용, 모델: ${model}`);
        }

        const openai = new OpenAI(clientSettings);

        // 2. 메시지 구성
        let systemMessage = "선생님을 돕는 전문가로서 학생들의 학교생활기록부 작성을 도와줍니다.";
        if (additionalInstructions) {
            systemMessage += `\n\n【🚨 최우선 지침】\n${additionalInstructions}`;
        }

        // 3. 스트리밍 생성 요청
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            stream: true,
        });

        // 4. ReadableStream으로 스트리밍 응답
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of completion) {
                        const text = chunk.choices[0]?.delta?.content || '';
                        if (text) {
                            controller.enqueue(encoder.encode(text));
                        }
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Transfer-Encoding': 'chunked',
            },
        });

    } catch (error) {
        console.error("API Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "생성 실패" }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
