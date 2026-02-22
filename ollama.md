# Ollama 로컬 LLM 연동 가이드

이 문서는 Next.js 프로젝트에서 Ollama(또는 OpenAI 호환 API 서비스)를 연동하여 로컬 LLM(`llama3.1:8b`)을 사용하는 방법을 정리한 가이드입니다.

## 1. 환경 변수 설정 (`.env`)

프로젝트 루트의 `.env` 파일에 다음과 같이 설정을 추가합니다.

```env
# 로컬 LLM 또는 Ollama API 주소 및 키
OLLAMA_API_URL=https://api.alluser.site
OLLAMA_API_KEY=your_api_key_here
```

## 2. API 라우트 구현 (`app/api/generate/route.js`)

`openai` 라이브러리를 그대로 사용하되, `baseURL`과 `defaultHeaders`를 조정하여 Ollama(또는 프록시 서버)와 통신합니다.

```javascript
import { NextResponse } from 'next/server';
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
                // 특정 프록시는 Authorization 대신 x-api-key를 요구할 수 있음
                defaultHeaders: {
                    'x-api-key': ollamaKey 
                }
            };
            model = "llama3.1:8b";
            console.log(`[API] Ollama 모드 사용: ${ollamaUrl}, 모델: ${model}`);
        } else {
            // OpenAI 모드 (Fallback)
            clientSettings = { apiKey: process.env.OPENAI_API_KEY };
            const hasAdditionalInstructions = additionalInstructions && additionalInstructions.trim();
            model = hasAdditionalInstructions ? "gpt-4o" : "gpt-4o-mini";
        }

        const openai = new OpenAI(clientSettings);

        // 2. 메시지 구성
        let systemMessage = "선생님을 돕는 전문가로서 학생들의 학교생활기록부 작성을 도와줍니다.";
        if (additionalInstructions) {
            systemMessage += `\n\n【🚨 최우선 지침】\n${additionalInstructions}`;
        }

        // 3. 생성 요청
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content;
        return NextResponse.json({ result: content });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json(
            { error: error.message || "생성 실패" },
            { status: 500 }
        );
    }
}
```

## 3. 핵심 체크포인트

-   **OpenAI SDK 호환성**: Ollama는 `/v1` 엔드포인트를 통해 OpenAI 규격을 지원하므로 `baseURL: "${URL}/v1"`로 설정하면 기존 코드를 거의 그대로 쓸 수 있습니다.
-   **Header 탐색**: 일부 보안 프록시 서버(예: `api.alluser.site`)는 표준 `Authorization: Bearer` 대신 `x-api-key` 헤더를 요구할 수 있습니다. `defaultHeaders` 옵션을 활용하여 해결했습니다.
-   **동적 모델 선택**: `OLLAMA_API_URL` 존재 여부에 따라 로컬 LLM(`llama3.1:8b`)과 OpenAI 모델 사이를 유연하게 스위칭할 수 있도록 구성했습니다.
