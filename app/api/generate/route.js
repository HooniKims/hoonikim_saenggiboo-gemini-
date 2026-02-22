// Edge Runtime: Netlify 서버리스 10초 타임아웃 회피
export const runtime = 'edge';

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt, additionalInstructions } = body;

        const ollamaUrl = process.env.OLLAMA_API_URL;
        const ollamaKey = process.env.OLLAMA_API_KEY;

        if (!ollamaUrl) {
            return new Response(
                JSON.stringify({ error: "OLLAMA_API_URL 환경 변수가 설정되지 않았습니다." }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 메시지 구성
        let systemMessage = "선생님을 돕는 전문가로서 학생들의 학교생활기록부 작성을 도와줍니다.";
        if (additionalInstructions) {
            systemMessage += `\n\n【🚨 최우선 지침】\n${additionalInstructions}`;
        }

        // Ollama API 직접 호출 (OpenAI 호환 /v1/chat/completions)
        const headers = {
            'Content-Type': 'application/json',
        };
        if (ollamaKey) {
            headers['x-api-key'] = ollamaKey;
        }

        const apiResponse = await fetch(`${ollamaUrl}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: 'llama3.1:8b',
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                stream: true,
            }),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            return new Response(
                JSON.stringify({ error: `Ollama API 오류 (${apiResponse.status}): ${errorText}` }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // SSE 스트림을 일반 텍스트 스트림으로 변환
        const reader = apiResponse.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith('data: ')) continue;

                            const data = trimmed.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content || '';
                                if (content) {
                                    controller.enqueue(encoder.encode(content));
                                }
                            } catch {
                                // JSON 파싱 실패 시 무시
                            }
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
            },
        });

    } catch (error) {
        console.error("API Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "생성 실패" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
