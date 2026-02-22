// Node.js 런타임: 스트리밍 안정 + Edge 호환 문제 회피
export const runtime = "nodejs";

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

        // Ollama 네이티브 /api/chat 엔드포인트 사용 (messages 지원)
        const upstream = `${ollamaUrl}/api/chat`;

        const headers = {
            "Content-Type": "application/json",
        };
        if (ollamaKey) {
            headers["X-API-Key"] = ollamaKey;
        }

        const r = await fetch(upstream, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: "llama3.1:8b",
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: prompt },
                ],
                stream: true,
            }),
        });

        // 에러 처리
        if (!r.ok) {
            const text = await r.text().catch(() => "");
            return new Response(
                JSON.stringify({ error: text || `Ollama API 오류: ${r.status}` }),
                { status: r.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // ✅ 스트리밍 응답을 그대로 전달 (가장 효율적)
        if (r.body) {
            return new Response(r.body, {
                status: 200,
                headers: {
                    "Content-Type": r.headers.get("content-type") || "application/json; charset=utf-8",
                    "Cache-Control": "no-cache",
                },
            });
        }

        // 비스트리밍 fallback
        const data = await r.json();
        return Response.json(data);

    } catch (error) {
        console.error("API Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "생성 실패" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
