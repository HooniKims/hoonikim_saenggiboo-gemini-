/**
 * 스트리밍 방식으로 /api/generate를 호출하고 전체 텍스트를 반환합니다.
 * Netlify 서버리스 함수 타임아웃(10초)을 회피하기 위해 사용합니다.
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

    // 에러 응답인 경우 (JSON 에러 메시지)
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

    // 스트리밍 응답 읽기
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
    }

    // 남은 바이트 flush
    result += decoder.decode();

    if (!result.trim()) {
        throw new Error("AI 응답이 비어있습니다.");
    }

    return result;
}
