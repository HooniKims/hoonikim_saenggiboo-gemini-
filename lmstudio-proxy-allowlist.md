# LM Studio 프록시 허용 규칙

## 결론

이 프로젝트의 정상적인 LM Studio 호출을 유지하려면 다음 요청을 반드시 허용해야 한다.

| 항목 | 허용할 값 |
|---|---|
| 호스트 | `lm.alluser.kr` |
| 경로 | `/v1/chat/completions` |
| HTTP 메서드 | `OPTIONS`, `POST` |
| 요청 헤더 | `Content-Type`, `X-API-Key` |
| 운영 Origin | `https://hoonikim-saenggibu.netlify.app` |
| 개발 Origin | `http://localhost:3000` |
| 응답 방식 | JSON, `stream: false` |
| 프록시 타임아웃 | 모델 생성 시간을 고려해 약 600초 유지 |

과세특, 동아리, 행동특성, 가정통신문 화면은 모두 `utils/streamFetch.js`를 통해 브라우저에서 다음 요청을 직접 보낸다.

```text
OPTIONS https://lm.alluser.kr/v1/chat/completions
POST    https://lm.alluser.kr/v1/chat/completions
```

생성 결과 검증에 실패하거나 응답이 불완전하면 동일한 `POST /v1/chat/completions` 요청을 다시 보낼 수 있다. 재시도 과정에서 다른 LM Studio 경로로 전환하지는 않는다.

## CORS 처리

브라우저는 `Content-Type: application/json`과 `X-API-Key` 사용자 정의 헤더를 사용하므로 실제 `POST` 전에 CORS 사전 요청을 보낸다.

```http
OPTIONS /v1/chat/completions
Origin: https://hoonikim-saenggibu.netlify.app
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type,x-api-key
```

따라서 `OPTIONS` 요청은 API 키를 검사하기 전에 `204 No Content`로 응답해야 한다. 응답에는 최소한 다음 헤더가 필요하다.

```http
Access-Control-Allow-Origin: https://hoonikim-saenggibu.netlify.app
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key
Access-Control-Max-Age: 86400
Vary: Origin
```

다른 웹서비스가 동일한 LM Studio 서버를 브라우저에서 직접 호출한다면 해당 서비스의 정확한 Origin도 CORS 허용 목록에 추가해야 한다. 자격 증명을 허용하는 구성에서는 `Access-Control-Allow-Origin: *`를 사용하지 않는다.

## 권장 프록시 정책

다음 정책이면 이 프로젝트의 호출을 유지하면서 탐색성 요청을 LM Studio까지 전달하지 않을 수 있다.

1. `/v1/chat/completions`의 `OPTIONS` 요청은 인증 검사 전에 `204`로 처리한다.
2. 같은 경로의 `POST` 요청은 `X-API-Key`를 검사한 뒤 LM Studio로 전달한다.
3. 생성 시간이 길어질 수 있으므로 프록시 읽기·전송 타임아웃을 약 600초로 유지한다.
4. `/v1/models`가 운영 점검에 필요하면 인증된 요청에 한해 별도로 허용한다.
5. `/`, `/login`, `/security.txt`, `/.well-known/security.txt`, `/favicon.ico` 및 무작위 경로에는 `404`를 반환한다.
6. 허용하지 않은 메서드에는 `405 Method Not Allowed`를 반환한다.

이 프로젝트의 정상 실행에는 다음 경로가 필요하지 않다.

```text
/
/login
/security.txt
/.well-known/security.txt
/favicon.ico
무작위 문자열 경로
```

## Cloudflare Access 주의사항

현재 구조는 사용자 브라우저가 LM Studio 프록시를 직접 호출한다. 이 호스트에 Cloudflare Access의 대화형 로그인 화면을 즉시 적용하면 API 요청이 JSON 대신 로그인 HTML이나 리다이렉트 응답을 받아 생성 기능이 실패할 수 있다.

Cloudflare Access를 도입하려면 다음 중 하나가 선행되어야 한다.

- 브라우저 호출을 애플리케이션 서버 경유 방식으로 변경한다.
- 사용 중인 모든 클라이언트가 Access 인증 헤더를 안전하게 보낼 수 있는지 별도 환경에서 검증한다.

현재 구조를 유지하는 동안에는 경로 제한, CORS 허용 목록, API 키 검사, 직접 포트 노출 차단을 우선 적용한다.

## API 키 보안 및 무중단 교체

현재 `X-API-Key`는 브라우저에서 실행되는 코드에 포함되므로 배포된 JavaScript를 확인할 수 있는 사용자에게 노출될 수 있다. 따라서 이 키는 완전한 비밀 인증 수단으로 간주할 수 없다. 진정한 비밀 키가 필요하면 브라우저가 아니라 서버 측 프록시에서 보관해야 한다.

기존 서비스를 중단하지 않고 키를 교체하려면 다음 순서를 따른다.

1. 프록시가 기존 키와 새 키를 임시로 모두 허용하게 한다.
2. 이 프로젝트와 다른 호출 서비스를 새 키로 차례대로 배포한다.
3. 키 원문을 로그에 남기지 않고 새 키 사용 여부만 확인한다.
4. 모든 서비스의 정상 호출을 확인한 뒤 기존 키를 폐기한다.

기존 키를 먼저 폐기하면 업데이트되지 않은 서비스의 모든 요청이 즉시 `401 Unauthorized`로 실패한다.

## 장애 발생 시 상태 코드별 확인

| 상태 또는 증상 | 우선 확인할 항목 |
|---|---|
| `401` | `X-API-Key` 누락, 오타 또는 폐기된 키 |
| `403` | Cloudflare 또는 Nginx 접근 정책 |
| `404` | 허용 경로 또는 프록시 경로 재작성 |
| `405` | `OPTIONS`나 `POST` 메서드 차단 |
| `502`, `504` | LM Studio 연결 상태와 프록시 타임아웃 |
| 브라우저에서만 실패 | CORS Origin, `OPTIONS`, 허용 헤더 |
| 생성 도중 연결 종료 | 프록시 읽기·전송 타임아웃 |

문제가 발생하면 가장 최근의 프록시 변경만 이전 설정으로 되돌린 뒤 상태 코드에 따라 원인을 확인한다. LM Studio 모델 설정까지 동시에 변경하면 장애 원인 구분이 어려워진다.

## 적용 전 최종 점검표

- [ ] `OPTIONS /v1/chat/completions`가 인증 없이 `204`로 응답한다.
- [ ] 응답의 `Access-Control-Allow-Origin`이 호출 서비스의 정확한 Origin과 일치한다.
- [ ] `Access-Control-Allow-Headers`에 `Content-Type`, `X-API-Key`가 포함된다.
- [ ] 올바른 키를 가진 `POST /v1/chat/completions`가 정상 응답한다.
- [ ] 잘못된 키를 가진 `POST`가 `401`로 차단된다.
- [ ] 모델 생성이 길어져도 프록시가 먼저 연결을 종료하지 않는다.
- [ ] 다른 서비스에서 사용하는 Origin도 모두 등록돼 있다.
- [ ] 이전 프록시 설정을 즉시 복구할 수 있는 백업이 있다.
