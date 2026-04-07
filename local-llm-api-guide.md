# Local LLM API Guide

이 문서는 [`utils/streamFetch.js`](./utils/streamFetch.js)의 현재 로컬 LLM 모델 설정을 재사용할 때 참고하는 간단 가이드입니다. 상세 운영 설명은 [`ollama.md`](./ollama.md)를 확인합니다.

## 현재 모델 목록

```javascript
export const AVAILABLE_MODELS = [
    { id: "gemma4:e4b", name: "Gemma 4 E4B", description: "기본 모델, 기준 속도·기준 품질" },
    { id: "gemma4:e2b", name: "Gemma 4 E2B", description: "기본 모델보다 빠름, 품질은 약간 낮음" },
    { id: "qwen3:4b", name: "Qwen 3 4B", description: "기본 모델보다 많이 빠름, 품질은 더 낮음" },
    { id: "gemma3:4b-it-q4_K_M", name: "Gemma 3 4B Q4", description: "기본 모델보다 많이 빠름, 품질은 더 낮음" },
    { id: "qwen3:8b", name: "Qwen 3 8B", description: "기본 모델보다 약간 느림, 품질은 비슷하거나 약간 높음" },
    { id: "gemma3:12b-it-q8_0", name: "Gemma 3 12B Q8", description: "기본 모델보다 느림, 품질은 높음" },
];

export const DEFAULT_MODEL = "gemma4:e4b";
```

## 드롭다운 라벨 규칙

```javascript
export function getModelOptionLabel(model) {
    return `${model.name} - ${model.description}`;
}
```

모든 모델 선택 드롭다운은 위 라벨 규칙을 그대로 사용합니다.

## 예시 요청

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma4:e4b","messages":[{"role":"user","content":"hi"}]}'
```

```bash
curl https://api.alluser.site/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"model":"gemma4:e4b","messages":[{"role":"user","content":"hi"}]}'
```
