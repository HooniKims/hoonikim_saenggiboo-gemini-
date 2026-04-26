import {
    cleanMetaInfo,
    getExpansionFrameworkGuideline,
    getMinimumTargetChars,
    getUtf8ByteLength,
    truncateToCompleteSentence,
} from "./textProcessor.js";

const RECORD_ENDING_PATTERN = /(?:함|음|임|됨|봄|옴|줌|춤|움|늠|름|남|냄|김|짐|님|감|보임|드러남|나타남|돋보임|지님|뛰어남)[.!?]\s*$/;
const LETTER_ENDING_PATTERN = /(?:습니다|합니다|입니다|됩니다|바랍니다|드립니다|좋겠습니다|필요합니다|응원합니다)[.!?]\s*$/;

const RECORD_SUBJECT_PATTERN = /(?:^|\s)(학생은|이 학생은|해당 학생은|학생이|OO는|OO가)\s*/;
const LETTER_SUBJECT_PATTERN = /(?:^|\s)(학생이|OO가|OO는|자녀분이|자녀가)\s*/;

const PAST_TENSE_PATTERN = /(했음|하였음|였음|되었음|보였음|수행하였음|작성하였음|참여하였음|발표하였음|조사하였음|준비하였음|하였다|했습니다|하였습니다|보였습니다|되었습니다)/;
const SUMMARY_CLOSING_PATTERN = /(^|[.!?]\s*)(이러한|이를 통해|이와 같이|앞으로|향후|결과적으로|종합적으로|요약하면|결론적으로)\s*/;
const COMMON_CLOSING_TRANSITION_PATTERN = /(^|[.!?]\s*)(마지막으로|끝으로|마무리하며|덧붙여|추가로)\s*/;
const META_TEXT_PATTERN = /(글자수\s*[:：]?|검증\s*포인트|(^|[\r\n])\s*분석\s*[:：]|다음은|작성한\s*내용|본문은)/;
const LIST_OR_TITLE_PATTERN = /(^|\n)\s*(?:[-*]|[0-9]+[.)])\s+/;
const MAX_CHARS = 650;
const NON_BLOCKING_GENERATION_ISSUE_CODES = new Set(["under_min_chars", "under_min_bytes", "incomplete_sentence"]);

const ISSUE_LABELS = {
    empty: "응답이 비어 있음",
    over_target_chars: "글자수 제한 초과",
    line_break: "줄바꿈 포함",
    forbidden_subject: "금지 주어 포함",
    forbidden_term: "출력 금지 용어 포함",
    under_min_chars: "목표 글자수 미달",
    under_min_bytes: "목표 byte 미달",
    over_target_bytes: "byte 제한 초과",
    past_tense: "과거형 표현 포함",
    summary_closing: "요약/마무리 표현 포함",
    meta_text: "메타 설명 포함",
    list_or_title: "목록/제목 형식 포함",
    incomplete_sentence: "문장 종결 불완전",
};

function clampTargetChars(targetChars) {
    const numeric = Number(targetChars);
    if (!Number.isFinite(numeric)) return MAX_CHARS;
    return Math.min(Math.max(Math.floor(numeric), 1), MAX_CHARS);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpaces(text) {
    return String(text || "")
        .replace(/\s*\r?\n+\s*/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim();
}

function addIssue(issues, code, detail = "") {
    issues.push({
        code,
        message: ISSUE_LABELS[code] || code,
        detail,
    });
}

function hasCompleteEnding(text, mode) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return false;
    if (mode === "letter") {
        return LETTER_ENDING_PATTERN.test(trimmed);
    }
    return RECORD_ENDING_PATTERN.test(trimmed);
}

function hasOnlyNonBlockingGenerationIssues(issues) {
    return issues.length > 0 && issues.every((issue) => NON_BLOCKING_GENERATION_ISSUE_CODES.has(issue.code));
}

function getForbiddenTerms(forbiddenTerms) {
    return (forbiddenTerms || [])
        .map((term) => String(term || "").trim())
        .filter((term) => term.length >= 2);
}

export function validateGeneratedText(text, options = {}) {
    const {
        forbiddenTerms = [],
        maxTargetBytes = 0,
        minTargetBytes = 0,
        minTargetChars = 0,
        mode = "record",
        targetChars = 490,
    } = options;
    const source = String(text || "");
    const trimmed = source.trim();
    const issues = [];
    const maxAllowed = clampTargetChars(targetChars);

    if (!trimmed) {
        addIssue(issues, "empty");
        return { ok: false, issues };
    }

    if (trimmed.length > maxAllowed) {
        addIssue(issues, "over_target_chars", `${trimmed.length}/${maxAllowed}자`);
    }

    const minAllowed = Math.max(0, Math.min(Math.floor(Number(minTargetChars) || 0), maxAllowed));
    if (minAllowed > 0 && trimmed.length < minAllowed) {
        addIssue(issues, "under_min_chars", `${trimmed.length}/${minAllowed}자`);
    }

    const minAllowedBytes = Math.max(0, Math.floor(Number(minTargetBytes) || 0));
    const maxAllowedBytes = Math.max(0, Math.floor(Number(maxTargetBytes) || 0));
    const byteLength = getUtf8ByteLength(trimmed);
    if (maxAllowedBytes > 0 && byteLength > maxAllowedBytes) {
        addIssue(issues, "over_target_bytes", `${byteLength}/${maxAllowedBytes}byte`);
    }
    if (minAllowedBytes > 0 && byteLength < minAllowedBytes) {
        addIssue(issues, "under_min_bytes", `${byteLength}/${minAllowedBytes}byte`);
    }

    if (/[\r\n]/.test(source)) {
        addIssue(issues, "line_break");
    }

    const subjectPattern = mode === "letter" ? LETTER_SUBJECT_PATTERN : RECORD_SUBJECT_PATTERN;
    if (subjectPattern.test(trimmed)) {
        addIssue(issues, "forbidden_subject");
    }

    for (const term of getForbiddenTerms(forbiddenTerms)) {
        if (trimmed.includes(term)) {
            addIssue(issues, "forbidden_term", term);
        }
    }

    if (mode === "record" && PAST_TENSE_PATTERN.test(trimmed)) {
        addIssue(issues, "past_tense");
    }

    if ((mode === "record" && SUMMARY_CLOSING_PATTERN.test(trimmed)) || COMMON_CLOSING_TRANSITION_PATTERN.test(trimmed)) {
        addIssue(issues, "summary_closing");
    }

    if (META_TEXT_PATTERN.test(trimmed)) {
        addIssue(issues, "meta_text");
    }

    if (LIST_OR_TITLE_PATTERN.test(source)) {
        addIssue(issues, "list_or_title");
    }

    if (!hasCompleteEnding(trimmed, mode)) {
        addIssue(issues, "incomplete_sentence");
    }

    return {
        ok: issues.length === 0,
        issues,
    };
}

export function buildRepairPrompt({ text, issues, sourcePrompt = "", targetChars, maxTargetBytes = 0, minTargetBytes = 0, minTargetChars = 0, mode = "record", forbiddenTerms = [] }) {
    const maxAllowed = clampTargetChars(targetChars);
    const minAllowed = Math.max(0, Math.min(Math.floor(Number(minTargetChars) || 0), maxAllowed));
    const minAllowedBytes = Math.max(0, Math.floor(Number(minTargetBytes) || 0));
    const maxAllowedBytes = Math.max(0, Math.floor(Number(maxTargetBytes) || 0));
    const issueText = (issues || [])
        .map((issue) => `- ${issue.message}${issue.detail ? `: ${issue.detail}` : ""}`)
        .join("\n");
    const forbiddenText = getForbiddenTerms(forbiddenTerms).length
        ? `\n- 다음 용어는 출력하지 않음: ${getForbiddenTerms(forbiddenTerms).join(", ")}`
        : "";
    const expansionFramework = getExpansionFrameworkGuideline();
    const endingInstruction = mode === "letter"
        ? "- 경어체 문장으로 작성하고 '~습니다.', '~합니다.', '~바랍니다.'처럼 완전한 문장으로 끝냄"
        : "- 현재형 명사 종결어미(~함, ~음, ~임, ~보임, ~드러남)와 마침표로 끝냄";

    return `아래 글은 내부 규칙 검증에서 실패했습니다. 의미는 유지하되 규칙에 맞게 다시 작성하세요.

[규칙 위반]
${issueText || "- 규칙 위반"}

[수정 규칙]
- ${minAllowed > 0 ? `${minAllowed}자 이상 ${maxAllowed}자 이하로 작성` : `${maxAllowed}자 이하로 작성`}
- ${maxAllowedBytes > 0 && minAllowedBytes > 0 ? `${minAllowedBytes}byte 이상 ${maxAllowedBytes}byte 이하를 반드시 맞춤` : minAllowedBytes > 0 ? `${minAllowedBytes}byte 이상을 반드시 채움` : "선택한 글자수 제한에 충분히 가깝게 작성"}
- 분량이 부족하면 입력 활동의 과정, 근거, 태도, 변화, 구체적 수행 장면을 더 촘촘하게 풀어 씀
- Why(동기)-How(과정)-What(결과)-Learn(성장) 흐름으로 입력된 활동의 동기, 수행 과정, 결과, 성장 단서를 확장함
- 새 사실, 새 활동, 새 작품, 새 수상, 새 기관, 새 실험 결과를 지어내지 않음
- 줄바꿈 없이 하나의 문단으로만 작성
- 제목, 번호, 분석, 글자수 설명 없이 본문만 출력
- '마지막으로', '끝으로', '마무리하며', '덧붙여', '추가로' 같은 마무리 접속어를 사용하지 않음
${endingInstruction}${forbiddenText}

${expansionFramework}

[원래 작성 조건]
${sourcePrompt || "(원래 작성 조건 없음)"}

[수정할 글]
${text}`;
}

function truncateToMaxBytes(text, maxTargetBytes) {
    const maxAllowedBytes = Math.max(0, Math.floor(Number(maxTargetBytes) || 0));
    if (!maxAllowedBytes || getUtf8ByteLength(text) <= maxAllowedBytes) return text;

    const sentences = String(text || "")
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
    let result = "";
    for (const sentence of sentences) {
        const candidate = result ? `${result} ${sentence}` : sentence;
        if (getUtf8ByteLength(candidate) <= maxAllowedBytes) {
            result = candidate;
        } else {
            break;
        }
    }
    if (result) return result.trim();

    let truncated = String(text || "").trim();
    while (truncated && getUtf8ByteLength(truncated) > maxAllowedBytes) {
        truncated = truncated.slice(0, -1).trimEnd();
    }
    const lastSpaceIndex = truncated.lastIndexOf(" ");
    if (lastSpaceIndex > truncated.length * 0.7) {
        truncated = truncated.slice(0, lastSpaceIndex).replace(/[,\s]+$/, "");
    }
    return truncated.replace(/[.!?,\s]+$/, "") + ".";
}

function finalizeGeneratedText(text, targetChars, maxTargetBytes = 0) {
    const cleaned = normalizeSpaces(cleanMetaInfo(text || ""));
    return truncateToMaxBytes(truncateToCompleteSentence(cleaned, targetChars), maxTargetBytes);
}

function sanitizeByRules(text, options = {}) {
    const { forbiddenTerms = [], mode = "record" } = options;
    let result = normalizeSpaces(text);

    const subjectPattern = mode === "letter"
        ? /^(학생이|OO가|OO는|자녀분이|자녀가)\s*/
        : /^(학생은|이 학생은|해당 학생은|학생이|OO는|OO가)\s*/;
    result = result.replace(subjectPattern, "");

    for (const term of getForbiddenTerms(forbiddenTerms)) {
        result = result.replace(new RegExp(escapeRegExp(term), "g"), "").replace(/\s{2,}/g, " ");
    }

    if (mode === "record") {
        result = result
            .replace(/하였음|했음|했습니다|하였습니다/g, "함")
            .replace(/되었음|되었습니다/g, "됨")
            .replace(/보였음|보였습니다/g, "보임")
            .replace(/였음/g, "임")
            .replace(SUMMARY_CLOSING_PATTERN, "$1");
    }

    result = result.replace(COMMON_CLOSING_TRANSITION_PATTERN, "$1");

    return result.trim();
}

export async function generateWithSilentValidation({
    prompt,
    generateOnce,
    acceptLengthOnlyResult = true,
    maxTargetBytes,
    minTargetBytes,
    minTargetChars,
    targetChars = 490,
    forbiddenTerms = [],
    mode = "record",
    maxRepairAttempts = 1,
}) {
    if (typeof generateOnce !== "function") {
        throw new Error("generateOnce 함수가 필요합니다.");
    }

    let nextPrompt = prompt;
    let lastText = "";
    let lastValidation = null;
    const hasByteTarget = Number(minTargetBytes) > 0 || Number(maxTargetBytes) > 0;
    const effectiveMinTargetChars = minTargetChars ?? (hasByteTarget ? 0 : getMinimumTargetChars(targetChars));

    for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
        const rawText = await generateOnce(nextPrompt, { attempt, previousValidation: lastValidation });
        const text = finalizeGeneratedText(rawText, targetChars, maxTargetBytes);
        const validation = validateGeneratedText(text, {
            forbiddenTerms,
            maxTargetBytes,
            minTargetBytes,
            minTargetChars: effectiveMinTargetChars,
            mode,
            targetChars,
        });

        if (validation.ok) {
            return {
                text,
                attempts: attempt + 1,
                repaired: attempt > 0,
                validation,
            };
        }

        if (acceptLengthOnlyResult && hasOnlyNonBlockingGenerationIssues(validation.issues)) {
            return {
                text,
                attempts: attempt + 1,
                repaired: attempt > 0,
                validation,
                acceptedWithLengthWarning: true,
            };
        }

        lastText = text;
        lastValidation = validation;
        nextPrompt = buildRepairPrompt({
            text,
            issues: validation.issues,
            sourcePrompt: prompt,
            maxTargetBytes,
            minTargetBytes,
            minTargetChars: effectiveMinTargetChars,
            targetChars,
            mode,
            forbiddenTerms,
        });
    }

    const sanitized = finalizeGeneratedText(
        sanitizeByRules(lastText, { forbiddenTerms, mode }),
        targetChars,
        maxTargetBytes,
    );
    const validation = validateGeneratedText(sanitized, {
        forbiddenTerms,
        maxTargetBytes,
        minTargetBytes,
        minTargetChars: effectiveMinTargetChars,
        mode,
        targetChars,
    });

    if (validation.ok) {
        return {
            text: sanitized,
            attempts: maxRepairAttempts + 1,
            repaired: maxRepairAttempts > 0,
            validation,
        };
    }

    const issueText = validation.issues
        .map((issue) => `${issue.message}${issue.detail ? `(${issue.detail})` : ""}`)
        .join(", ");
    if (acceptLengthOnlyResult && hasOnlyNonBlockingGenerationIssues(validation.issues)) {
        return {
            text: sanitized,
            attempts: maxRepairAttempts + 1,
            repaired: maxRepairAttempts > 0,
            validation,
            acceptedWithLengthWarning: true,
        };
    }

    const error = new Error(`내부 검증 실패: ${issueText || "규칙 미충족"}`);
    error.validation = validation;
    error.text = sanitized;
    error.attempts = maxRepairAttempts + 1;
    throw error;
}
