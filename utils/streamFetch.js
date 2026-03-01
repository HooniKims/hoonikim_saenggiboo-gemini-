const OLLAMA_API_URL = "https://api.alluser.site";
const OLLAMA_API_KEY = "gudgns0411skaluv2018tjdbs130429";

/**
 * 사용 가능한 모델 목록
 * 새 모델 추가 시 여기에만 추가하면 모든 페이지에 반영됩니다.
 */
export const AVAILABLE_MODELS = [
    { id: "gemma3:4b-it-q4_K_M", name: "Gemma 3 4B Q4 (기본) ⚡속도", description: "경량 빠른 응답 (3.3GB)", isLightweight: true },
    { id: "qwen3:4b", name: "Qwen 3 4B ⚡속도", description: "경량 빠른 응답", isLightweight: true },
    { id: "qwen3:8b", name: "Qwen 3 8B 🔵보통", description: "균형 잡힌 성능", isLightweight: false },
    { id: "llama3.1:8b", name: "Llama 3.1 8B 🔵보통", description: "범용 모델", isLightweight: false },
    { id: "gemma3:12b-it-q4_K_M", name: "Gemma 3 12B Q4 ✨품질", description: "고품질 (8GB)", isLightweight: false },
    { id: "gemma3:12b-it-q8_0", name: "Gemma 3 12B Q8 💎고품질 🐢느림", description: "최고 품질 (13GB)", isLightweight: false },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].id;

/**
 * 모델이 경량 모델인지 확인
 */
export function isLightweightModel(modelId) {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId);
    return model ? model.isLightweight : modelId.includes("4b") || modelId.includes("1b") || modelId.includes("2b");
}

/**
 * 텍스트가 완전한 한국어 문장으로 끝나는지 확인
 */
function endsWithCompleteSentence(text) {
    if (!text || !text.trim()) return false;
    const trimmed = text.trim();
    return /[함음임됨봄옴줌춤움늠름다요까니][.!?]\s*$/.test(trimmed);
}

/**
 * Ollama API 1회 호출
 */
async function callOllamaAPI(systemMessage, userPrompt, model) {
    // 경량 모델은 temperature를 약간 올려 다양성 확보
    const isLightweight = isLightweightModel(model || DEFAULT_MODEL);
    const temperature = isLightweight ? 0.8 : 0.7;

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
                { role: "user", content: userPrompt },
            ],
            temperature,
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
    return data.choices?.[0]?.message?.content || "";
}

/**
 * 경량 모델용 시스템 메시지 (간결하고 명확한 지시)
 */
function getLightweightSystemMessage() {
    return `학교생활기록부 세특 작성 전문가.

[절대금지 규칙]
1. 과목명/동아리명 출력 금지 (예: "국어시간에", "과학 수업에서", "봉사동아리에서" → 전부 금지)
2. 과거형 금지 (예: ~했음, ~였음, ~되었음, ~보였음 → 전부 금지)
3. '학생은', '이 학생은' 등 주어 금지

[필수 규칙]
4. 반드시 현재형 명사 종결어미만 사용: ~함, ~임, ~음, ~보임, ~드러남
5. 입력된 활동 내용을 모두 빠짐없이 반영
6. 줄바꿈 없이 하나의 문단
7. 요약/마무리 문장 금지
8. 오직 본문만 출력 (메타정보 출력 금지)

❌ 잘못된 예: "국어 시간에 토론 활동을 했음." "과학실험을 수행하였음."
✅ 올바른 예: "토론 활동에서 찬반 입장을 논리적으로 정리하여 발표함." "실험 과정에서 변인을 통제하며 데이터를 분석함."`;
}

/**
 * 일반 모델용 시스템 메시지
 */
function getStandardSystemMessage() {
    return `학교생활기록부 작성 전문가. 반드시 지킬 규칙:
1. 현재형 명사 종결어미(~함, ~임, ~음, ~보임, ~드러남)만 사용. 과거형(~했음, ~였음, ~되었음, ~하였음, ~보였음) 절대 금지
2. '학생은', '이 학생은' 등 주어 없이 활동부터 서술
3. 과목명/프로그램명/동아리명을 출력에 절대 포함하지 않음 (예: "국어시간에", "수학 수업에서" 등 금지)
4. 줄바꿈 없이 하나의 문단으로 작성
5. 마지막 문장도 반드시 구체적 활동 서술로 끝냄
6. 요약, 정리, 결론 문장 작성하지 않음
7. 입력된 활동 외에 사실을 지어내지 않음
8. 입력된 모든 활동 내용을 빠짐없이 반영하여 서술
9. 오직 본문 텍스트만 출력 (글자수, 분석 등 메타정보 출력하지 않음)`;
}

export async function fetchStream(bodyData) {
    const { prompt, additionalInstructions, model } = bodyData;
    const isLightweight = isLightweightModel(model || DEFAULT_MODEL);

    // 모델 유형에 따른 시스템 메시지 선택
    let systemMessage = isLightweight ? getLightweightSystemMessage() : getStandardSystemMessage();

    // 추가 지침은 시스템 메시지에도, user 프롬프트의 앞뒤에도 삽입 (Sandwich 기법)
    if (additionalInstructions) {
        systemMessage += `\n\n사용자 추가 규칙 (최우선 준수):\n${additionalInstructions}`;
    }

    // user 프롬프트에 추가 지침을 앞뒤로 감싸기
    let finalPrompt = prompt;
    if (additionalInstructions && additionalInstructions.trim()) {
        const prefix = `[최우선 규칙] 다음 규칙을 반드시 지켜서 작성하라: ${additionalInstructions}\n\n`;
        const suffix = `\n\n[다시 한번 강조] 위 본문 작성 시 반드시 적용할 규칙: ${additionalInstructions}`;
        finalPrompt = prefix + prompt + suffix;
    }

    // 1차 시도
    let content = await callOllamaAPI(systemMessage, finalPrompt, model);

    if (!content.trim()) {
        throw new Error("AI 응답이 비어있습니다.");
    }

    // 완전한 문장으로 끝나는지 확인 → 아니면 재시도 (최대 2회)
    const MAX_RETRIES = 2;
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
        if (endsWithCompleteSentence(content)) {
            break; // 완전한 문장으로 끝남 → OK
        }

        console.log(`[재시도 ${retry + 1}/${MAX_RETRIES}] 문장이 불완전하게 끝남: "...${content.slice(-30)}"`);

        // 재시도: 이전 결과를 보여주고 완전한 문장으로 끝내도록 요청
        const retryPrompt = `다음 텍스트는 문장이 중간에 끊겼습니다. 이 텍스트를 기반으로, 같은 내용을 완전한 문장으로 끝나도록 다시 작성하세요. 반드시 '~함.', '~음.', '~임.' 등 종결어미와 마침표로 끝내세요. 오직 본문만 출력하세요.\n\n불완전한 텍스트:\n${content}`;

        const retryContent = await callOllamaAPI(systemMessage, retryPrompt, model);

        if (retryContent.trim() && endsWithCompleteSentence(retryContent)) {
            content = retryContent;
            console.log(`[재시도 성공] 완전한 문장으로 수정됨`);
            break;
        } else if (retryContent.trim()) {
            content = retryContent;
        }
    }

    return content;
}
