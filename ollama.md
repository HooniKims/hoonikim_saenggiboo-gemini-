# Ollama 로컬 LLM 연동 가이드 (최종 확정판)

이 문서는 Next.js(Netlify 배포) 프로젝트에서 Ollama 로컬 LLM을 `api.alluser.site` 프록시를 통해 사용하는 최종 연동 가이드입니다.

---

## 아키텍처 (최종)

```
[사용자 브라우저 (한국)] ──직접 호출──▶ [api.alluser.site (Nginx 프록시)] ──▶ [Ollama (192.168.0.182:11434)]
```

### ⚠️ 왜 서버리스 프록시를 쓰지 않는가?

Netlify 서버리스 함수는 **해외 서버(미국/유럽)**에서 실행됩니다.
`api.alluser.site`는 한국 가정 네트워크에 있어 해외에서의 연결이 **방화벽/ISP에 의해 차단**됩니다.
따라서 **브라우저에서 직접 API를 호출**하는 방식을 사용합니다.

시도했지만 실패한 방법들:
- ❌ `runtime = "edge"` → Edge 함수에서 OpenAI SDK 호환 문제 (502)
- ❌ `runtime = "nodejs"` → Netlify 서버 → api.alluser.site 연결 타임아웃 (ConnectTimeoutError)
- ❌ 스트리밍 + 서버리스 → Netlify 10초 하드 타임아웃으로 504 발생

---

## 1. Nginx 설정 (api.alluser.site)

```nginx
location / {
    # ===== CORS 설정 =====
    set $cors_origin "";
    if ($http_origin = "https://hoonikim-saenggibu.netlify.app") { set $cors_origin $http_origin; }
    if ($http_origin = "http://localhost:3000") { set $cors_origin $http_origin; }

    if ($request_method = OPTIONS) {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, X-API-Key' always;
        add_header 'Access-Control-Max-Age' 86400 always;
        add_header 'Content-Length' 0;
        return 204;
    }

    add_header 'Access-Control-Allow-Origin' $cors_origin always;

    # ===== API Key 인증 =====
    if ($http_x_api_key != "gudgns0411skaluv2018tjdbs130429") {
        return 401 '{"error":"Unauthorized"}';
    }

    # ===== Proxy to Ollama =====
    proxy_pass http://192.168.0.182:11434;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # ===== Ollama 기본 CORS 헤더 제거 (충돌 방지) =====
    proxy_hide_header 'Access-Control-Allow-Origin';
    proxy_hide_header 'Access-Control-Allow-Methods';
    proxy_hide_header 'Access-Control-Allow-Headers';

    # ===== Streaming / 성능 최적화 =====
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    add_header X-Accel-Buffering no;

    proxy_http_version 1.1;
    proxy_set_header Connection "";

    # ===== 타임아웃 =====
    proxy_read_timeout 600s;
    proxy_connect_timeout 30s;
    proxy_send_timeout 600s;

    gzip off;
}
```

### 다른 프로젝트 추가 시
`if ($http_origin = "https://새도메인.netlify.app") { set $cors_origin $http_origin; }` 한 줄만 추가하면 됩니다.

---

## 2. 클라이언트 코드 (`utils/streamFetch.js`)

브라우저에서 Ollama API를 **직접** 호출합니다. 서버리스 함수를 거치지 않습니다.

```javascript
const OLLAMA_API_URL = "https://api.alluser.site";
const OLLAMA_API_KEY = "gudgns0411skaluv2018tjdbs130429";

export async function fetchStream(bodyData) {
    const { prompt, additionalInstructions } = bodyData;

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
            model: "gemma3:12b-it-q4_K_M",
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
        } catch {}
        throw new Error(errorMessage);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    if (!content.trim()) throw new Error("AI 응답이 비어있습니다.");
    return content;
}
```

### 핵심 포인트
- **OpenAI 호환 엔드포인트** (`/v1/chat/completions`) 사용 → `messages` 배열 지원
- **`X-API-Key` 헤더**로 인증 (Nginx에서 확인)
- **`stream: false`** → 비스트리밍 (안정성 우선)

---

## 3. 각 페이지에서의 사용법

4개 페이지(gwasetuk, club, behavior, letter)에서 `fetchStream`을 import하여 사용:

```javascript
import { fetchStream } from "../../utils/streamFetch";

// 사용 예시
const rawResult = await fetchStream({ prompt, additionalInstructions });
```

각 페이지는 서버 API 라우트(`/api/generate`)를 호출하지 않고, `fetchStream`이 직접 `api.alluser.site`를 호출합니다.

---

## 4. Ollama 서버 관리 (Mac mini)

### 모델 예열 (필수)
```bash
# 모델을 24시간 동안 메모리에 유지
ollama run gemma3:12b-it-q4_K_M "안녕" --keepalive 24h
```

### 모델 상태 확인
```bash
ollama ps        # 현재 로드된 모델 확인
ollama list      # 설치된 모델 목록
```

### 모델 상시 유지 (cron 자동화)
```bash
# crontab -e 로 추가 → 4분마다 ping하여 모델 유지
*/4 * * * * curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma3:12b-it-q4_K_M","messages":[{"role":"user","content":"ping"}]}' \
  > /dev/null 2>&1
```

---

## 5. 환경 변수 (.env)

로컬 개발용 `.env` 파일 (배포 시에는 사용되지 않음):
```env
OLLAMA_API_URL=https://api.alluser.site
OLLAMA_API_KEY=gudgns0411skaluv2018tjdbs130429
```

> ⚠️ 현재 브라우저 직접 호출 방식이므로 Netlify 환경 변수는 사실상 불필요합니다.
> API 키와 URL은 `utils/streamFetch.js`에 직접 포함되어 있습니다.

---

## 6. 디버깅 체크리스트

문제 발생 시 순서대로 확인:

| 순서 | 확인 사항 | 명령어 |
|------|-----------|--------|
| 1 | Ollama 실행 중? | `ollama ps` |
| 2 | 모델 로드됨? | `ollama ps` (모델명 표시 확인) |
| 3 | 로컬 API 응답? | `curl http://localhost:11434/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"llama3.1:8b","messages":[{"role":"user","content":"hi"}]}'` |
| 4 | 프록시 경유 응답? | `curl https://api.alluser.site/v1/chat/completions -H "Content-Type: application/json" -H "X-API-Key: gudgns0411skaluv2018tjdbs130429" -d '{"model":"llama3.1:8b","messages":[{"role":"user","content":"hi"}]}'` |
| 5 | Nginx 상태? | `sudo nginx -t` |
| 6 | CORS 에러? | 브라우저 콘솔에서 `Access-Control-Allow-Origin` 관련 에러 확인 |
| 7 | 모델 cold start? | `ollama run llama3.1:8b "test" --keepalive 24h` |
