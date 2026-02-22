const OLLAMA_API_URL = "https://api.alluser.site";
const OLLAMA_API_KEY = "gudgns0411skaluv2018tjdbs130429";

/**
 * 사용 가능한 모델 목록
 * 새 모델 추가 시 여기에만 추가하면 모든 페이지에 반영됩니다.
 */
export const AVAILABLE_MODELS = [
    { id: "qwen3:8b", name: "Qwen 3 8B (추천)", description: "균형 잡힌 성능" },
    { id: "gemma3:12b-it-q8_0", name: "Gemma 3 12B Q8", description: "최고 품질 (13GB)" },
    { id: "gemma3:12b-it-q4_K_M", name: "Gemma 3 12B Q4", description: "고품질 (8GB)" },
    { id: "gemma3:4b-it-q4_K_M", name: "Gemma 3 4B", description: "경량 (3.3GB)" },
    { id: "qwen3:4b", name: "Qwen 3 4B", description: "경량 빠른 응답" },
    { id: "llama3.1:8b", name: "Llama 3.1 8B", description: "범용 모델" },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].id;

/**
 * 브라우저에서 직접 Ollama API를 호출합니다.
 * 
 * @param {Object} bodyData - { prompt, additionalInstructions?, model? }
 * @returns {Promise<string>} - 생성된 전체 텍스트
 */
export async function fetchStream(bodyData) {
    const { prompt, additionalInstructions, model } = bodyData;

    // 메시지 구성
    let systemMessage = "선생님을 돕는 전문가로서 학생들의 학교생활기록부 작성을 도와줍니다.";
    if (additionalInstructions) {
        systemMessage += `\n\n【🚨 최우선 지침】\n${additionalInstructions}`;
    }

    const res = await fetch(`${OLLAMA_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": OLLAMA_API_KEY,
        },
        body: JSON.stringify({
            model: model || DEFAULT_MODEL,
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            stream: false,
        }),
    });

    if (!res.ok) {
        let errorMessage = `서버 오류 (${res.status})`;
        try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
        } catch {
            // 무시
        }
        throw new Error(errorMessage);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    if (!content.trim()) {
        throw new Error("AI 응답이 비어있습니다.");
    }

    return content;
}
