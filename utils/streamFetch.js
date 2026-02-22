/**
 * /api/generate를 호출하고 결과를 반환합니다.
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

    const data = await res.json();

    if (!res.ok || data.error) {
        throw new Error(data.error || `서버 오류 (${res.status})`);
    }

    if (!data.result || !data.result.trim()) {
        throw new Error("AI 응답이 비어있습니다.");
    }

    return data.result;
}
