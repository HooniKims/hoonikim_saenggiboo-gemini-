import test from "node:test";
import assert from "node:assert/strict";

import {
    buildShuffledKeywordContext,
    parseKeywordList,
    shuffleKeywordList,
} from "../utils/letterKeywords.js";

test("parseKeywordList trims comma-separated letter keywords", () => {
    assert.deepEqual(
        parseKeywordList("학업, 건강,, 친구관계, 가족관계 "),
        ["학업", "건강", "친구관계", "가족관계"],
    );
});

test("shuffleKeywordList can change letter keyword order without adding terms", () => {
    const keywords = ["학업", "건강", "친구관계", "가족관계"];
    const shuffled = shuffleKeywordList(keywords, () => 0);

    assert.deepEqual(shuffled, ["건강", "친구관계", "가족관계", "학업"]);
    assert.deepEqual([...shuffled].sort(), [...keywords].sort());
});

test("buildShuffledKeywordContext formats shuffled letter keywords", () => {
    assert.equal(
        buildShuffledKeywordContext("학업, 건강, 친구관계, 가족관계", () => 0),
        "입력된 키워드: 건강, 친구관계, 가족관계, 학업",
    );
});

test("buildShuffledKeywordContext falls back to default letter keywords", () => {
    assert.equal(
        buildShuffledKeywordContext("", () => 0),
        "입력된 키워드: 건강, 친구관계, 가족관계, 학업",
    );
});
