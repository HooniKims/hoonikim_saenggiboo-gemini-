import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/gwasetuk/page.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("gwasetuk keeps per-student activity grades aligned with activity count", () => {
    assert.match(source, /activityGrades/);
    assert.match(source, /normalizeActivityGrades/);
    assert.match(source, /createStudent/);
    assert.match(source, /useEffect\(\(\) => \{[\s\S]*normalizeActivityGrades[\s\S]*activities\.length/);
    assert.match(source, /updateStudentActivityGrade/);
});

test("gwasetuk renders compact per-activity A B C controls only below high school", () => {
    assert.match(source, /schoolLevel !== "high"/);
    assert.match(source, /activity-grade-panel/);
    assert.match(source, /activity-grade-row/);
    assert.match(source, /btn-grade-sm/);
    assert.match(source, /활동별 성취도/);
    assert.match(source, /onClick=\{\(\) => updateStudentActivityGrade\(student\.id, activityIndex, grade\)\}/);
});

test("gwasetuk activity grade panel lays out two activities per row without overflow", () => {
    assert.match(styles, /\.activity-grade-panel\s*\{[\s\S]*display:\s*grid/);
    assert.match(styles, /\.activity-grade-panel\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(styles, /\.activity-grade-panel\s*\{[\s\S]*gap:\s*8px\s+18px/);
    assert.match(styles, /\.activity-grade-title\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
    assert.match(styles, /@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*\.activity-grade-panel\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    assert.match(styles, /\.activity-grade-row\s*\{[\s\S]*min-width:\s*0/);
    assert.match(styles, /\.activity-grade-row\s*\{[\s\S]*grid-template-columns:\s*max-content\s+max-content/);
    assert.match(styles, /\.activity-grade-row\s*\{[\s\S]*justify-content:\s*start/);
});

test("gwasetuk generated result textarea has a taller default vertical space", () => {
    assert.match(styles, /\.textarea-auto\s*\{[\s\S]*min-height:\s*160px/);
    assert.match(styles, /\.textarea-auto\s*\{[\s\S]*max-height:\s*560px/);
});

test("gwasetuk hero subtitle keeps the highlighted phrase on its own line", () => {
    assert.match(source, /특정 과목 시간에 활동한 내용을 바탕으로\s*<br\s*\/>\s*<span className="highlight hero-subtitle-emphasis">과목별\(자유학기\) 세부능력 및 특기사항<\/span>을 생성합니다\./);
    assert.match(styles, /\.hero-subtitle-emphasis\s*\{[\s\S]*display:\s*inline-block/);
    assert.match(styles, /\.hero-subtitle-emphasis\s*\{[\s\S]*white-space:\s*nowrap/);
});

test("gwasetuk prompt applies the selected grade to each matching activity", () => {
    assert.match(source, /validActivityEntries/);
    assert.match(source, /selectedActivityEntries/);
    assert.match(source, /activityGradeInstruction/);
    assert.match(source, /gradeDescriptions\[entry\.grade\]/);
    assert.match(source, /entry\.text/);
    assert.match(source, /entry\.originalIndex/);
    assert.doesNotMatch(source, /gradePrompts\[student\.grade\]/);
});

test("gwasetuk keeps randomized activity order even when individual activity exists", () => {
    assert.match(source, /selectedActivityEntries\s*=\s*shuffleArray\(validActivityEntries\)/);
    assert.doesNotMatch(source, /calculateRelevanceScore/);
    assert.doesNotMatch(source, /scoreB\s*!==\s*scoreA/);
    assert.match(source, /활동 내용 목록의 순서를 유지/);
    assert.match(source, /개별 활동 내용을 첫 문장이나 첫 활동처럼 우선 배치하지 않음/);
});

test("gwasetuk prompt defines visibly different writing strength for A B C", () => {
    assert.match(source, /A\(매우 잘함\)/);
    assert.match(source, /B\(잘함\)/);
    assert.match(source, /C\(보통\)/);
    assert.match(source, /등급별 표현 사전/);
    assert.match(source, /A 전용 권장 표현/);
    assert.match(source, /B 전용 권장 표현/);
    assert.match(source, /C 전용 권장 표현/);
    assert.match(source, /등급 간 대비 규칙/);
    assert.match(source, /B 활동에는 탁월함·돋보임·뛰어남·심화·주도적 같은 A급 표현을 쓰지 않음/);
    assert.match(source, /C 활동에는 안내에 따라|도움을 받아|기초적인 내용을/);
    assert.match(source, /잘 해냄 기조/);
    assert.match(source, /부족한 부분이 있지만 노력하고 발전하려는 과정/);
    assert.match(source, /비판하거나 비난하는 표현은 사용하지 않음/);
    assert.match(source, /B와 C 활동은 A 수준의 최상위 표현으로 과장하지 마세요/);
    assert.match(source, /선택한 A\/B\/C 등급 문구를 그대로 반복하지 말고/);
});
