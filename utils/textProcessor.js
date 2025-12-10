/**
 * AI 생성 텍스트 후처리 유틸리티
 * - 한글 기준 공백 포함 500자 절대 초과 불가
 * - 100자 같은 극소 글자수도 완전한 문장으로 마무리
 */

// 절대 상한선: 500자 (1500 bytes)
const MAX_CHARS = 500;

/**
 * 글자수에 따른 동적 버퍼 비율 계산
 */
function getBufferRatio(targetChars) {
    if (targetChars <= 100) return 0.70;
    if (targetChars <= 150) return 0.75;
    if (targetChars <= 200) return 0.80;
    if (targetChars <= 300) return 0.85;
    return 0.90;
}

/**
 * AI에게 보낼 프롬프트용 글자수 계산
 */
export function getPromptCharLimit(userRequestedChars) {
    const targetChars = Math.min(userRequestedChars, MAX_CHARS);
    const bufferRatio = getBufferRatio(targetChars);
    return Math.floor(targetChars * bufferRatio);
}

/**
 * 글자수별 프롬프트 지침 생성
 */
export function getCharacterGuideline(targetChars) {
    const promptLimit = getPromptCharLimit(targetChars);
    const maxAllowed = Math.min(targetChars, MAX_CHARS);

    if (targetChars <= 100) {
        return `
###### [글자 수 제한 조건 - 최우선 준수 사항] ######
** 절대 규칙: 공백 포함 전체 글자 수가 ${maxAllowed}자를 절대로! 초과해서는 안 됩니다. **

1. 정확히 ${promptLimit}자 내외로 작성하세요.
2. 반드시 2~3개의 짧은 문장으로만 구성하세요.
3. 각 문장은 15자 이내로 매우 짧게 작성하세요.
4. 모든 문장은 반드시 '~함.', '~음.', '~임.' 등 완전한 종결어미로 끝내세요.
5. 마지막 문장도 반드시 마침표(.)로 완결되어야 합니다.

** 최종 출력은 반드시 ${maxAllowed}자 이하이고, 완전한 문장으로 끝나야 합니다. **
`;
    } else if (targetChars <= 200) {
        return `
###### [글자 수 제한 조건 - 최우선 준수 사항] ######
** 절대 규칙: 공백 포함 전체 글자 수가 ${maxAllowed}자를 절대로! 초과해서는 안 됩니다. **

1. ${promptLimit}자 내외로 작성하세요.
2. 4~5개의 짧은 문장으로 구성하세요.
3. 각 문장은 20자 이내로 간결하게 작성하세요.
4. 모든 문장은 완전한 종결어미(~함, ~음, ~임, ~됨)와 마침표로 끝내세요.
5. 마지막 문장이 중간에 끊기지 않도록 주의하세요.

** 최종 출력은 반드시 ${maxAllowed}자 이하이고, 완전한 문장으로 끝나야 합니다. **
`;
    } else {
        return `
###### [글자 수 제한 조건 - 최우선 준수 사항] ######
** 절대 규칙: 공백 포함 전체 글자 수가 ${maxAllowed}자를 절대로! 초과해서는 안 됩니다. **

1. 작성 전 ${maxAllowed}자 제한을 먼저 인지하고 계획적으로 작성하세요.
2. 목표 범위: ${promptLimit}자 이상 ~ ${maxAllowed}자 이하 (초과 절대 불가)
3. 작성 후 반드시 글자 수를 세어보고, ${maxAllowed}자를 초과하면 문장을 줄여서 다시 작성하세요.
4. 차라리 내용을 줄이더라도 ${maxAllowed}자 제한을 반드시 준수하세요.
5. 모든 문장은 완전한 종결어미로 끝나야 합니다. 마지막 문장이 중간에 끊기면 안 됩니다.

** 최종 출력은 반드시 ${maxAllowed}자 이하이고, 완전한 문장으로 끝나야 합니다. **
`;
    }
}

/**
 * AI 출력에서 메타 정보 제거
 */
export function cleanMetaInfo(text) {
    if (!text) return text;
    let cleaned = text.replace(/\s*\([^)]*\d+자[^)]*\)/g, '');
    cleaned = cleaned.replace(/\s*\([^)]*글자[^)]*\)/g, '');
    cleaned = cleaned.replace(/\s*\([^)]*자세한[^)]*\)/g, '');
    cleaned = cleaned.replace(/\s*\([^)]*내용\s*포함[^)]*\)/g, '');
    cleaned = cleaned.replace(/\s*[-─]+\s*\d+자\s*$/g, '');
    cleaned = cleaned.replace(/\s*\[\d+자\]\s*$/g, '');
    cleaned = cleaned.replace(/\s*\d+자\s*$/g, '');
    cleaned = cleaned.replace(/\s*\[분석[^\]]*\]/g, '');
    cleaned = cleaned.replace(/\s*\[검증[^\]]*\]/g, '');
    return cleaned.trim();
}

function isCompleteSentence(text) {
    if (!text) return false;
    const trimmed = text.trim();
    return /[함음임됨봄옴줌춤움늠름다요까니][.!?]\s*$/.test(trimmed);
}

function splitIntoSentences(text) {
    if (!text) return [];
    return text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
}

/**
 * 글자수 초과시 마지막 완전한 문장까지만 잘라내는 후처리 함수
 */
export function truncateToCompleteSentence(text, targetChars) {
    let cleaned = cleanMetaInfo(text);
    if (!cleaned) return '';

    const maxAllowed = Math.min(targetChars, MAX_CHARS);

    if (cleaned.length <= maxAllowed && isCompleteSentence(cleaned)) {
        return cleaned.trim();
    }

    const sentences = splitIntoSentences(cleaned);
    if (sentences.length === 0) {
        return cleaned.length <= maxAllowed ? cleaned.trim() : '';
    }

    let result = '';
    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        const completeSentence = trimmedSentence.endsWith('.') ||
            trimmedSentence.endsWith('!') ||
            trimmedSentence.endsWith('?')
            ? trimmedSentence
            : trimmedSentence + '.';
        const candidate = result + (result ? ' ' : '') + completeSentence;
        if (candidate.length <= maxAllowed) {
            result = candidate;
        } else {
            break;
        }
    }

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

    if (!result && cleaned.length > 0) {
        let truncated = cleaned.substring(0, maxAllowed);
        const lastPeriodIndex = truncated.lastIndexOf('.');
        if (lastPeriodIndex > truncated.length * 0.5) {
            result = truncated.substring(0, lastPeriodIndex + 1);
        } else {
            const match = truncated.match(/.*[함음임됨봄옴줌춤움늠름다요까니]/);
            if (match) {
                result = match[0] + '.';
            } else {
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

export function truncateToCharLimit(text, maxChars) {
    return truncateToCompleteSentence(text, maxChars);
}
