/**
 * AI 생성 텍스트 후처리 유틸리티
 * - 한글 기준 공백 포함 500자 절대 초과 불가
 * - 100자 같은 극소 글자수도 완전한 문장으로 마무리
 */

// 절대 상한선: 500자 (1500 bytes)
const MAX_CHARS = 500;

/**
 * 글자수에 따른 동적 버퍼 비율 계산
 * 짧은 글자수일수록 더 많은 여유 공간 확보
 */
function getBufferRatio(targetChars) {
    if (targetChars <= 100) return 0.70;      // 70자 요청 → 30자 여유
    if (targetChars <= 150) return 0.75;      // 112자 요청
    if (targetChars <= 200) return 0.80;      // 160자 요청
    if (targetChars <= 300) return 0.85;      // 255자 요청
    return 0.90;                               // 기본 90%
}

/**
 * AI에게 보낼 프롬프트용 글자수 계산
 * @param {number} userRequestedChars - 사용자가 요청한 글자수
 * @returns {number} AI에게 요청할 글자수
 */
export function getPromptCharLimit(userRequestedChars) {
    const targetChars = Math.min(userRequestedChars, MAX_CHARS);
    const bufferRatio = getBufferRatio(targetChars);
    return Math.floor(targetChars * bufferRatio);
}

/**
 * 글자수별 프롬프트 지침 생성
 * @param {number} targetChars - 목표 글자수
 * @returns {string} 프롬프트에 추가할 글자수 지침
 */
export function getCharacterGuideline(targetChars) {
    const promptLimit = getPromptCharLimit(targetChars);
    const maxAllowed = Math.min(targetChars, MAX_CHARS);

    if (targetChars <= 100) {
        return `
<글자수 제한>
전체 글자수: ${maxAllowed}자 이하 (공백 포함, 초과 불가)
목표: ${promptLimit}자 내외

작성 방법:
1. 2~3개의 온전한 문장으로 작성
2. 각 문장에 구체적인 활동 내용을 포함 (예: "~활동에서 ~하여 ~함.")
3. "깊이 있게 읽음." 같은 내용 없는 짧은 문장은 사용하지 않음
4. 모든 문장은 '~함.', '~음.', '~임.' 등 완전한 종결어미로 끝냄
5. 최종 출력은 ${maxAllowed}자 이하, 완전한 문장으로 끝냄
`;
    } else if (targetChars <= 200) {
        return `
<글자수 제한>
전체 글자수: ${maxAllowed}자 이하 (공백 포함, 초과 불가)
목표: ${promptLimit}자 ~ ${maxAllowed}자

작성 방법:
1. 3~4개의 온전한 문장으로 작성
2. 각 문장에 구체적인 활동, 과정, 결과를 포함하여 의미 있게 서술
3. "깊이 있게 읽음.", "논리적으로 글을 씀." 같은 내용 없는 짧은 문장은 사용하지 않음
4. 문장 예시: "환경 문제에 대한 조사 활동에서 미세먼지의 원인과 대책을 분석하고 발표 자료를 체계적으로 구성함."
5. 모든 문장은 완전한 종결어미(~함, ~음, ~임)와 마침표로 끝냄
6. 최종 출력은 ${maxAllowed}자 이하, 완전한 문장으로 끝냄
`;
    } else {
        return `
<글자수 제한>
전체 글자수: ${maxAllowed}자 이하 (공백 포함, 초과 불가)
목표: ${promptLimit}자 ~ ${maxAllowed}자

작성 방법:
1. ${maxAllowed}자 제한을 인지하고 계획적으로 작성
2. 초과하면 문장을 줄여서 다시 작성
3. 각 문장에 구체적인 활동, 과정, 결과를 포함하여 의미 있게 서술
4. 모든 문장은 완전한 종결어미로 끝냄. 마지막 문장이 중간에 끊기지 않도록 함
5. 최종 출력은 ${maxAllowed}자 이하, 완전한 문장으로 끝냄
`;
    }
}

/**
 * AI 출력에서 메타 정보(글자수, 분석 내용 등) 제거
 * @param {string} text - AI 생성 텍스트
 * @returns {string} 정제된 텍스트
 */
export function cleanMetaInfo(text) {
    if (!text) return text;

    // 괄호 안의 메타 정보 제거: (자세한 내용 포함, 330자), (약 500자), (글자수: 330) 등
    let cleaned = text.replace(/\s*\([^)]*\d+자[^)]*\)/g, '');
    cleaned = cleaned.replace(/\s*\([^)]*글자[^)]*\)/g, '');
    cleaned = cleaned.replace(/\s*\([^)]*자세한[^)]*\)/g, '');
    cleaned = cleaned.replace(/\s*\([^)]*내용\s*포함[^)]*\)/g, '');

    // 끝부분의 메타 정보 제거: "--- 330자" 또는 "[330자]" 등
    cleaned = cleaned.replace(/\s*[-─]+\s*\d+자\s*$/g, '');
    cleaned = cleaned.replace(/\s*\[\d+자\]\s*$/g, '');
    cleaned = cleaned.replace(/\s*\d+자\s*$/g, '');

    // 분석/검증 관련 문구 제거
    cleaned = cleaned.replace(/\s*\[분석[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\s*\[검증[^\]]*\]/g, '');

    return cleaned.trim();
}

/**
 * 문장이 완전한 한국어 종결어미로 끝나는지 확인
 * @param {string} text - 텍스트
 * @returns {boolean}
 */
function isCompleteSentence(text) {
    if (!text) return false;
    const trimmed = text.trim();
    // 한국어 종결 패턴: ~함, ~음, ~임, ~됨, ~봄, ~옴, ~다, ~요 + 마침표/느낌표/물음표
    return /[함음임됨봄옴줌춤움늠름다요까니][.!?]\s*$/.test(trimmed);
}

/**
 * 텍스트를 문장 단위로 분리
 * @param {string} text - 텍스트
 * @returns {string[]} 문장 배열
 */
function splitIntoSentences(text) {
    if (!text) return [];
    // 마침표, 느낌표, 물음표 뒤에서 분리 (단, 뒤에 공백이나 문자열 끝이 있을 때)
    return text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
}

/**
 * 글자수 초과시 마지막 완전한 문장까지만 잘라내는 후처리 함수
 * @param {string} text - AI 생성 텍스트
 * @param {number} targetChars - 목표 글자수
 * @returns {string} 처리된 텍스트
 */
export function truncateToCompleteSentence(text, targetChars) {
    // 먼저 메타 정보 제거
    let cleaned = cleanMetaInfo(text);

    if (!cleaned) return '';

    // 절대 상한선 적용
    const maxAllowed = Math.min(targetChars, MAX_CHARS);

    // 이미 제한 내이고 완전한 문장으로 끝나면 그대로 반환
    if (cleaned.length <= maxAllowed && isCompleteSentence(cleaned)) {
        return cleaned.trim();
    }

    // 문장 단위로 분리
    const sentences = splitIntoSentences(cleaned);

    if (sentences.length === 0) {
        return cleaned.length <= maxAllowed ? cleaned.trim() : '';
    }

    let result = '';

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();

        // 문장이 마침표로 끝나지 않으면 추가
        const completeSentence = trimmedSentence.endsWith('.') ||
            trimmedSentence.endsWith('!') ||
            trimmedSentence.endsWith('?')
            ? trimmedSentence
            : trimmedSentence + '.';

        const candidate = result + (result ? ' ' : '') + completeSentence;

        if (candidate.length <= maxAllowed) {
            result = candidate;
        } else {
            // 더 추가하면 초과 → 여기서 중단
            break;
        }
    }

    // 결과가 너무 짧으면 (목표의 50% 미만) 첫 문장이라도 확보
    const minAcceptable = maxAllowed * 0.5;
    if (result.length < minAcceptable && sentences.length > 0) {
        const firstSentence = sentences[0].trim();
        const completeFirst = firstSentence.endsWith('.') ||
            firstSentence.endsWith('!') ||
            firstSentence.endsWith('?')
            ? firstSentence
            : firstSentence + '.';

        if (completeFirst.length <= maxAllowed) {
            result = completeFirst;
        }
    }

    // 결과가 여전히 비어있으면 강제로 마지막 마침표까지만 자르기
    if (!result && cleaned.length > 0) {
        let truncated = cleaned.substring(0, maxAllowed);

        // 마지막 완전한 문장(마침표)까지 찾기
        const lastPeriodIndex = truncated.lastIndexOf('.');

        if (lastPeriodIndex > truncated.length * 0.5) {
            result = truncated.substring(0, lastPeriodIndex + 1);
        } else {
            // 마침표가 너무 앞에 있으면 종결어미 패턴으로 자르기
            const match = truncated.match(/.*[함음임됨봄옴줌춤움늠름다요까니]/);
            if (match) {
                result = match[0] + '.';
            } else {
                // 최후의 수단: 그냥 자르고 마침표 추가
                const lastSpaceIndex = truncated.lastIndexOf(' ');
                if (lastSpaceIndex > truncated.length * 0.7) {
                    result = truncated.substring(0, lastSpaceIndex).replace(/[,\s]+$/, '') + '.';
                } else {
                    result = truncated.replace(/[,\s]+$/, '') + '.';
                }
            }
        }
    }

    return result.trim();
}

/**
 * 레거시 호환용: 기존 truncateToCharLimit 함수와 동일한 인터페이스 제공
 * @param {string} text - AI 생성 텍스트
 * @param {number} maxChars - 최대 글자수
 * @returns {string} 처리된 텍스트
 */
export function truncateToCharLimit(text, maxChars) {
    return truncateToCompleteSentence(text, maxChars);
}
