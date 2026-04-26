import test from "node:test";
import assert from "node:assert/strict";

import {
    buildRepairPrompt,
    generateWithSilentValidation,
    validateGeneratedText,
} from "../utils/generationHarness.js";

test("validateGeneratedText detects strict record-rule violations", () => {
    const validation = validateGeneratedText(
        "학생은 국어시간에 발표를 하였음.\n결론적으로 성장함.",
        {
            forbiddenTerms: ["국어"],
            mode: "record",
            targetChars: 20,
        },
    );

    const codes = validation.issues.map((issue) => issue.code);

    assert.equal(validation.ok, false);
    assert.ok(codes.includes("forbidden_subject"));
    assert.ok(codes.includes("forbidden_term"));
    assert.ok(codes.includes("past_tense"));
    assert.ok(codes.includes("line_break"));
    assert.ok(codes.includes("summary_closing"));
    assert.ok(codes.includes("over_target_chars"));
});

test("validateGeneratedText accepts clean record text", () => {
    const validation = validateGeneratedText(
        "토론 활동에서 근거 자료를 정리하고 의견을 논리적으로 제시함.",
        {
            forbiddenTerms: ["국어"],
            mode: "record",
            targetChars: 100,
        },
    );

    assert.equal(validation.ok, true);
    assert.deepEqual(validation.issues, []);
});

test("validateGeneratedText accepts common noun endings used in records", () => {
    for (const text of [
        "드리블 상황에서 움직임을 예술적인 차원으로 끌어올리는 탐구 정신을 지님.",
        "공의 궤적을 예측하고 상황에 맞게 드리블을 수정하는 전술적 사고가 나타남.",
        "반복 훈련을 통해 볼 터치 정확도를 끌어올리며 기술적 숙련도를 높여감.",
    ]) {
        const validation = validateGeneratedText(text, {
            mode: "record",
            targetChars: 120,
        });
        assert.equal(validation.ok, true, `${text}: ${JSON.stringify(validation.issues)}`);
    }
});

test("validateGeneratedText does not treat content analysis phrasing as meta text", () => {
    const validation = validateGeneratedText(
        "슈팅 동작에서 신체 움직임을 관찰하고 분석 결과를 바탕으로 자세를 수정함.",
        {
            mode: "record",
            targetChars: 120,
        },
    );

    assert.equal(validation.ok, true);
    assert.deepEqual(validation.issues, []);
});

test("validateGeneratedText detects text that is far shorter than the target band", () => {
    const validation = validateGeneratedText(
        "공의 궤적을 예측하고 드리블 방향을 조절함.",
        {
            minTargetChars: 120,
            mode: "record",
            targetChars: 200,
        },
    );

    assert.equal(validation.ok, false);
    assert.ok(validation.issues.some((issue) => issue.code === "under_min_chars"));
});

test("validateGeneratedText detects text below the selected byte band", () => {
    const validation = validateGeneratedText(
        "공의 궤적을 예측하고 드리블 방향을 조절함.",
        {
            minTargetBytes: 1350,
            minTargetChars: 0,
            mode: "record",
            targetChars: 490,
        },
    );

    assert.equal(validation.ok, false);
    assert.ok(validation.issues.some((issue) => issue.code === "under_min_bytes"));
});

test("validateGeneratedText detects text above the selected byte limit", () => {
    const validation = validateGeneratedText(
        "가".repeat(501) + ".",
        {
            maxTargetBytes: 1500,
            minTargetBytes: 0,
            minTargetChars: 0,
            mode: "record",
            targetChars: 650,
        },
    );

    assert.equal(validation.ok, false);
    assert.ok(validation.issues.some((issue) => issue.code === "over_target_bytes"));
});

test("validateGeneratedText allows the expanded 1500-byte character guide", () => {
    const validation = validateGeneratedText(
        `${"a".repeat(520)}함.`,
        {
            maxTargetBytes: 1500,
            minTargetBytes: 0,
            minTargetChars: 0,
            mode: "record",
            targetChars: 589,
        },
    );

    assert.equal(validation.ok, true, JSON.stringify(validation.issues));
});

test("validateGeneratedText accepts clean letter text", () => {
    const validation = validateGeneratedText(
        "학교 생활에 성실하게 참여하며 친구들의 의견을 존중하는 태도가 돋보입니다.",
        {
            forbiddenTerms: ["홍길동"],
            mode: "letter",
            targetChars: 120,
        },
    );

    assert.equal(validation.ok, true);
    assert.deepEqual(validation.issues, []);
});

test("validateGeneratedText accepts polite future endings in letters", () => {
    const validation = validateGeneratedText(
        "성실한 태도로 생활하며 스스로 성장하는 알찬 여름방학이 되기를 진심으로 응원하겠습니다.",
        {
            mode: "letter",
            targetChars: 120,
        },
    );

    assert.equal(validation.ok, true);
    assert.deepEqual(validation.issues, []);
});

test("validateGeneratedText rejects closing transition phrases in records and letters", () => {
    const recordValidation = validateGeneratedText(
        "자료 조사 과정에서 핵심 정보를 정리하고 발표함. 마지막으로 토의 내용을 바탕으로 쟁점을 정리함.",
        {
            mode: "record",
            targetChars: 120,
        },
    );
    const letterValidation = validateGeneratedText(
        "학교 생활에 성실하게 참여하며 친구들의 의견을 존중하는 태도가 돋보입니다. 마지막으로 가정에서도 꾸준한 격려를 부탁드립니다.",
        {
            mode: "letter",
            targetChars: 120,
        },
    );

    assert.equal(recordValidation.ok, false);
    assert.equal(letterValidation.ok, false);
    assert.ok(recordValidation.issues.some((issue) => issue.code === "summary_closing"));
    assert.ok(letterValidation.issues.some((issue) => issue.code === "summary_closing"));
});

test("generateWithSilentValidation silently retries with a repair prompt", async () => {
    const prompts = [];

    const result = await generateWithSilentValidation({
        prompt: "원본 프롬프트",
        minTargetChars: 0,
        targetChars: 100,
        forbiddenTerms: ["국어"],
        mode: "record",
        generateOnce: async (prompt) => {
            prompts.push(prompt);
            if (prompts.length === 1) {
                return "학생은 국어시간에 발표를 하였음.";
            }
            return "발표 활동에서 근거 자료를 정리하고 의견을 논리적으로 제시함.";
        },
    });

    assert.equal(result.text, "발표 활동에서 근거 자료를 정리하고 의견을 논리적으로 제시함.");
    assert.equal(result.attempts, 2);
    assert.equal(result.repaired, true);
    assert.match(prompts[1], /규칙 위반/);
});

test("generateWithSilentValidation accepts output below the target band without repair", async () => {
    const prompts = [];

    const result = await generateWithSilentValidation({
        prompt: "원본 프롬프트",
        minTargetChars: 80,
        targetChars: 120,
        mode: "record",
        generateOnce: async (prompt) => {
            prompts.push(prompt);
            if (prompts.length === 1) {
                return "공의 궤적을 예측하고 드리블 방향을 조절함.";
            }
            return "공의 궤적을 예측하고 상대 움직임에 따라 드리블 방향을 조절하는 과정에서 판단력을 보임. 슈팅 동작의 체중 이동을 관찰하고 자세를 수정하며 정확도를 높이려는 노력이 돋보임.";
        },
    });

    assert.equal(result.validation.ok, false);
    assert.equal(result.acceptedWithLengthWarning, true);
    assert.equal(result.attempts, 1);
    assert.equal(prompts.length, 1);
});

test("generateWithSilentValidation uses byte limit as primary length rule", async () => {
    const result = await generateWithSilentValidation({
        prompt: "원본 작성 조건",
        maxTargetBytes: 1000,
        minTargetBytes: 900,
        targetChars: 393,
        mode: "record",
        generateOnce: async () => "가".repeat(310) + "함.",
    });

    assert.equal(result.validation.ok, true);
});

test("generateWithSilentValidation gives repair prompts the original source prompt for expansion", async () => {
    const prompts = [];

    await generateWithSilentValidation({
        prompt: "토의하기, 연설하기, 독서감상문 작성 내용을 모두 반영",
        acceptLengthOnlyResult: false,
        maxTargetBytes: 1000,
        minTargetBytes: 900,
        targetChars: 393,
        mode: "record",
        generateOnce: async (prompt) => {
            prompts.push(prompt);
            if (prompts.length === 1) return "토의 내용을 정리함.";
            return "가".repeat(310) + "함.";
        },
    });

    assert.match(prompts[1], /원래 작성 조건/);
    assert.match(prompts[1], /토의하기, 연설하기, 독서감상문 작성 내용을 모두 반영/);
});

test("buildRepairPrompt preserves source facts and expands with Why-How-What-Learn", () => {
    const prompt = buildRepairPrompt({
        text: "토의 내용을 정리함.",
        issues: [{ code: "under_min_bytes", message: "목표 byte 미달", detail: "100/900byte" }],
        sourcePrompt: "토의하기, 연설하기, 독서감상문 작성 내용을 모두 반영",
        maxTargetBytes: 1000,
        minTargetBytes: 900,
        targetChars: 393,
        mode: "record",
    });

    assert.match(prompt, /Why\(동기\)/);
    assert.match(prompt, /How\(과정\)/);
    assert.match(prompt, /What\(결과\)/);
    assert.match(prompt, /Learn\(성장\)/);
    assert.match(prompt, /입력된 활동/);
    assert.match(prompt, /새 사실.*지어내지/);
});

test("generateWithSilentValidation can reject final output when length-only acceptance is disabled", async () => {
    await assert.rejects(
        () => generateWithSilentValidation({
            prompt: "원본 프롬프트",
            acceptLengthOnlyResult: false,
            minTargetBytes: 1350,
            minTargetChars: 0,
            targetChars: 490,
            mode: "record",
            maxRepairAttempts: 1,
            generateOnce: async () => "공의 궤적을 예측하고 드리블 방향을 조절함.",
        }),
        /목표 byte 미달/,
    );
});

test("generateWithSilentValidation returns sanitized final text when final validation passes", async () => {
    const result = await generateWithSilentValidation({
        prompt: "원본 프롬프트",
        acceptLengthOnlyResult: false,
        targetChars: 120,
        minTargetChars: 0,
        mode: "record",
        maxRepairAttempts: 0,
        forbiddenTerms: ["학생은"],
        generateOnce: async () => "학생은 발표 활동에서 근거 자료를 정리하고 의견을 논리적으로 제시함.",
    });

    assert.equal(result.text, "발표 활동에서 근거 자료를 정리하고 의견을 논리적으로 제시함.");
    assert.equal(result.validation.ok, true);
});

test("generateWithSilentValidation can accept generation before length-only repair", async () => {
    let calls = 0;

    const result = await generateWithSilentValidation({
        prompt: "원본 프롬프트",
        minTargetBytes: 900,
        minTargetChars: 0,
        targetChars: 490,
        mode: "record",
        maxRepairAttempts: 1,
        generateOnce: async () => {
            calls += 1;
            return "공의 궤적을 예측하고 드리블 방향을 조절함.";
        },
    });

    assert.equal(calls, 1);
    assert.equal(result.acceptedWithLengthWarning, true);
    assert.equal(result.validation.ok, false);
    assert.ok(result.validation.issues.every((issue) => issue.code === "under_min_bytes"));
});

test("generateWithSilentValidation can accept short incomplete output", async () => {
    let calls = 0;

    const result = await generateWithSilentValidation({
        prompt: "원본 프롬프트",
        minTargetBytes: 900,
        minTargetChars: 0,
        targetChars: 490,
        mode: "record",
        maxRepairAttempts: 1,
        generateOnce: async () => {
            calls += 1;
            return "공의 궤적을 예측하고 드리블 방향을 조절하는 태도";
        },
    });

    const codes = result.validation.issues.map((issue) => issue.code);
    assert.equal(calls, 1);
    assert.equal(result.acceptedWithLengthWarning, true);
    assert.ok(codes.includes("under_min_bytes"));
    assert.ok(codes.includes("incomplete_sentence"));
});
