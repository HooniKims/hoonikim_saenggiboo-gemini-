import test from "node:test";
import assert from "node:assert/strict";

import {
    getBehaviorHighSchoolQualityGuidance,
    getClubHighSchoolQualityGuidance,
} from "../utils/recordQualityGuidance.js";

test("club high school guidance is only returned for high school", () => {
    assert.equal(getClubHighSchoolQualityGuidance("elementary"), "");
    assert.equal(getClubHighSchoolQualityGuidance("middle"), "");

    const guidance = getClubHighSchoolQualityGuidance("high");
    assert.match(guidance, /문제의식/);
    assert.match(guidance, /교과·전공/);
    assert.match(guidance, /구체적 역할/);
    assert.match(guidance, /시행착오/);
    assert.match(guidance, /팀 활동 속 기여/);
    assert.match(guidance, /후속 탐구/);
    assert.match(guidance, /전공적 사고/);
});

test("behavior high school guidance is only returned for high school", () => {
    assert.equal(getBehaviorHighSchoolQualityGuidance("elementary"), "");
    assert.equal(getBehaviorHighSchoolQualityGuidance("middle"), "");

    const guidance = getBehaviorHighSchoolQualityGuidance("high");
    assert.match(guidance, /지속적으로 관찰되는 태도/);
    assert.match(guidance, /성실성과 책임감의 행동 근거/);
    assert.match(guidance, /배려와 관계 형성 방식/);
    assert.match(guidance, /공동체에 미친 긍정적 영향/);
    assert.match(guidance, /성장과 변화/);
    assert.match(guidance, /학생만의 이미지/);
    assert.match(guidance, /학교생활 전반/);
});
