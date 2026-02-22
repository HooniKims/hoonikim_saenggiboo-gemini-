/**
 * 스트리밍 방식으로 /api/generate를 호출하고 전체 텍스트를 반환합니다.
 * Ollama /api/chat 스트리밍 형식 (JSON lines)을 파싱합니다.
 * 
 * @param {Object} bodyData - POST body ({ prompt, additionalInstructions? })
 * @returns {Promise<string>} - 생성된 전체 텍스트
 */
export async function fetchStream(bodyData) {
    const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
    });

    // 에러 응답인 경우
    if (!res.ok) {
        let errorMessage = `서버 오류 (${res.status})`;
        try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
        } catch {
            // JSON 파싱 실패 시 기본 에러 메시지 사용
        }
        throw new Error(errorMessage);
    }

    // 스트리밍 응답 읽기 (Ollama JSON lines 형식)
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 줄 단위로 파싱
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 마지막 미완성 줄은 버퍼에 유지

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
                const parsed = JSON.parse(trimmed);
                // Ollama /api/chat 형식: { message: { content: "..." }, done: false }
                if (parsed.message && parsed.message.content) {
                    result += parsed.message.content;
                }
            } catch {
                // JSON이 아닌 줄은 무시
            }
        }
    }

    // 버퍼에 남은 데이터 처리
    if (buffer.trim()) {
        try {
            const parsed = JSON.parse(buffer.trim());
            if (parsed.message && parsed.message.content) {
                result += parsed.message.content;
            }
        } catch {
            // 무시
        }
    }

    if (!result.trim()) {
        throw new Error("AI 응답이 비어있습니다.");
    }

    return result;
}
