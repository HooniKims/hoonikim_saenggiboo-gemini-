"use client";

import { useState, useRef } from "react";
import { Trash2, Download, Wand2, Users, UserX } from "lucide-react";
import * as XLSX from "xlsx";
import { writeExcel } from "../../utils/excel";

export default function BehaviorPage() {
    // State
    const [studentCount, setStudentCount] = useState(1);
    const [isManualInput, setIsManualInput] = useState(false);
    const [manualCountValue, setManualCountValue] = useState("");

    // Students state now includes 'observation' instead of 'grade'
    const [students, setStudents] = useState([{ id: 1, name: "", observation: "", result: "", status: "idle" }]);
    const [textLength, setTextLength] = useState("1500");
    const [manualLength, setManualLength] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef(null);

    // Auto-resize textarea
    const adjustTextareaHeight = (element) => {
        if (element) {
            element.style.height = "auto";
            element.style.height = element.scrollHeight + "px";
        }
    };

    // Handlers
    const updateStudentList = (count) => {
        const newStudents = [...students];
        if (count > newStudents.length) {
            for (let i = newStudents.length + 1; i <= count; i++) {
                newStudents.push({ id: i, name: "", observation: "", result: "", status: "idle" });
            }
        } else {
            newStudents.splice(count);
        }
        setStudents(newStudents);
        setStudentCount(count);
    };

    const handleStudentCountChange = (e) => {
        const value = e.target.value;
        if (value === "manual") {
            setIsManualInput(true);
            setManualCountValue("");
        } else {
            setIsManualInput(false);
            updateStudentList(parseInt(value));
        }
    };

    const handleManualCountSubmit = () => {
        const count = parseInt(manualCountValue);
        if (count > 0 && count <= 100) {
            updateStudentList(count);
            setIsManualInput(false);
        } else {
            alert("1에서 100 사이의 숫자를 입력해주세요.");
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            let nameColIndex = -1;
            let observationColIndex = -1;
            let headerRowIndex = -1;

            for (let i = 0; i < data.length; i++) {
                const row = data[i];

                // 헤더 행의 모든 열 이름 출력 (디버깅용)
                if (i === 0) {
                    console.log("[엑셀 파싱] 헤더 행:", row.map((cell, idx) => `[${idx}]${String(cell).trim()}`).join(" | "));
                }

                for (let j = 0; j < row.length; j++) {
                    const cellValue = String(row[j]).trim().replace(/\s/g, "");

                    if (cellValue === "성명" || cellValue === "이름") {
                        nameColIndex = j;
                        headerRowIndex = i;
                    }

                    // 행동 관찰 결과 열 인식: 다양한 키워드 지원
                    // cellValue는 공백이 제거된 상태이므로 공백 없는 키워드로 비교
                    if (cellValue.includes("관찰결과") || cellValue.includes("행동관찰") ||
                        cellValue.includes("행발") || cellValue.includes("행동") ||
                        cellValue.includes("관찰") || cellValue.includes("결과") ||
                        cellValue.includes("특성") || cellValue.includes("종합의견") ||
                        cellValue.includes("세부능력") || cellValue.includes("특기사항") || cellValue.includes("세특")) {
                        observationColIndex = j;
                    }
                }
                if (nameColIndex !== -1) break;
            }

            const newStudents = [];
            let idCounter = 1;

            if (nameColIndex !== -1) {
                console.log(`[엑셀 파싱] nameColIndex: ${nameColIndex} observationColIndex: ${observationColIndex} headerRowIndex: ${headerRowIndex}`);

                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    const name = row[nameColIndex];
                    const observation = observationColIndex !== -1 ? row[observationColIndex] : "";

                    if (name && typeof name === 'string' && name.trim() !== "") {
                        const observationText = observation ? String(observation).trim() : "";
                        console.log(`[엑셀 파싱] 학생: ${name.trim()} 관찰결과: ${observationText}`);

                        newStudents.push({
                            id: idCounter++,
                            name: name.trim(),
                            observation: observationText,
                            result: "",
                            status: "idle"
                        });
                    }
                }
            } else {
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    for (let j = 0; j < Math.min(row.length, 3); j++) {
                        const val = row[j];
                        if (typeof val === 'string' && val.length > 1 && val.length < 10) {
                            if (val !== "성명" && val !== "이름") {
                                newStudents.push({ id: idCounter++, name: val.trim(), observation: "", result: "", status: "idle" });
                                break;
                            }
                        }
                    }
                }
            }

            if (newStudents.length > 0) {
                setStudents(newStudents);
                setStudentCount(newStudents.length);
                setIsManualInput(false);
            } else {
                alert("엑셀 파일에서 '성명' 또는 '이름' 열을 찾을 수 없거나, 유효한 학생 데이터가 없습니다.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const updateStudent = (id, field, value) => {
        setStudents(prevStudents => prevStudents.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const removeStudent = (id) => {
        if (students.length <= 1) {
            alert("최소 1명의 학생은 있어야 합니다.");
            return;
        }
        setStudents(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, id: i + 1 })));
        setStudentCount(prev => prev - 1);
    };

    // AI 출력에서 메타 정보(글자수, 분석 내용 등) 제거
    const cleanMetaInfo = (text) => {
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
    };

    // 글자수 초과시 마지막 완전한 문장까지만 잘라내는 후처리 함수
    const truncateToCharLimit = (text, maxChars) => {
        // 먼저 메타 정보 제거
        let cleaned = cleanMetaInfo(text);

        if (!cleaned || cleaned.length <= maxChars) return cleaned;

        // 최대 글자수까지 자르기
        let truncated = cleaned.substring(0, maxChars);

        // 마지막 완전한 문장(마침표)까지 찾기
        const lastPeriodIndex = truncated.lastIndexOf('.');
        const lastCommaIndex = truncated.lastIndexOf(',');

        if (lastPeriodIndex > truncated.length * 0.7) {
            // 마지막 마침표가 70% 이후에 있으면 그 위치까지 자르기
            truncated = truncated.substring(0, lastPeriodIndex + 1);
        } else if (lastCommaIndex > truncated.length * 0.8) {
            // 마침표가 너무 앞에 있으면 마지막 쉼표까지 자르고 마침표 추가
            truncated = truncated.substring(0, lastCommaIndex) + '.';
        } else {
            // 둘 다 적절하지 않으면 마지막 완전한 단어까지 자르고 마침표 추가
            const lastSpaceIndex = truncated.lastIndexOf(' ');
            if (lastSpaceIndex > truncated.length * 0.8) {
                truncated = truncated.substring(0, lastSpaceIndex);
            }
            // '~함', '~임', '~음' 등으로 끝나면 마침표 추가
            if (!truncated.endsWith('.')) {
                truncated = truncated.replace(/[,\s]+$/, '') + '.';
            }
        }

        return truncated.trim();
    };

    const generatePrompt = (student, targetChars) => {
        let minChar, maxChar;
        if (targetChars === 200) {
            minChar = 150; maxChar = 200;
        } else if (targetChars === 500) {
            minChar = 400; maxChar = 500;
        } else {
            minChar = Math.floor(targetChars * 0.8);
            maxChar = targetChars;
        }

        const lengthInstruction = `
###### [글자 수 제한 조건 - 최우선 준수 사항] ######
이것은 가장 중요한 제약 조건입니다. 반드시 지켜야 합니다.

** 절대 규칙: 공백 포함 전체 글자 수가 ${maxChar}자를 절대로! 초과해서는 안 됩니다. **

1. 작성 전 ${maxChar}자 제한을 먼저 인지하고 계획적으로 작성하세요.
2. 목표 범위: ${minChar}자 이상 ~ ${maxChar}자 이하 (초과 절대 불가)
3. 작성 후 반드시 글자 수를 세어보고, ${maxChar}자를 초과하면 문장을 줄여서 다시 작성하세요.
4. 차라리 내용을 줄이더라도 ${maxChar}자 제한을 반드시 준수하세요.
5. 절대로 ${maxChar}자를 넘기지 마세요. 이 규칙을 어기면 출력이 무효화됩니다.

** 최종 출력은 반드시 ${maxChar}자 이하여야 합니다. **
`;
        const observationText = student.observation ? `학생 행동 관찰 내용: ${student.observation}` : "학생 행동 관찰 내용: 일반적인 모범 학생의 특성 (구체적인 입력 없음)";

        return `
당신은 대한민국 고등학교 교사로서 학생의 학교생활기록부 행동특성 및 종합의견(행발)을 작성하는 전문가입니다.

## 작성 목표
교사가 입력한 학생의 행동 특성을 바탕으로, 학생의 인성, 잠재력, 공동체 역량 등을 종합적으로 관찰하여 구체적이고 긍정적인 변화와 성장을 드러내는 행발을 작성하세요.

## 작성 가이드
1. **핵심 역량 강조**: 배려, 나눔, 협력, 타인 존중, 갈등 관리, 관계 지향성, 규칙 준수 등 인성 요소와 리더십, 자기주도성 등 잠재력을 중심으로 서술하세요.
2. **구체적 사례 중심**: 추상적인 칭찬보다는 구체적인 행동 사례나 에피소드를 통해 학생의 특성이 잘 드러나도록 하세요.
3. **성장과 변화**: 단순한 나열이 아니라, 일년 동안의 긍정적인 변화와 성장의 모습을 보여주세요.
4. **긍정적 재구성 (매우 중요)**: 부정적으로 보일 수 있는 특성도 반드시 긍정적이고 발전 가능성이 느껴지는 표현으로 전환하세요.
   - 내성적 → 신중함, 사려 깊음, 차분함, 성찰적임, 깊이 있는 사고
   - 소극적 → 신중하게 접근함, 관찰력이 뛰어남, 계획적임
   - 느림 → 꼼꼼함, 세심함, 정확성을 추구함
   - 고집이 셈 → 소신이 있음, 주관이 뚜렷함, 신념이 확고함
   - 산만함 → 다양한 관심사, 호기심이 많음, 활발한 탐구심
   - 말이 적음 → 경청을 잘함, 신중하게 발언함, 깊이 있는 대화를 선호함
5. **문체**: 명사형 종결어미(~함, ~임, ~음)를 사용하여 간결하고 명확하게 작성하세요.
6. **마침표 준수**: **모든 문장은 반드시 마침표(.)로 끝나야 합니다.**

## 절대 금지사항
- **부정적 표현 금지**: "~하지만", "~에도 불구하고", "부족하다", "미흡하다" 등 부정적 뉘앙스의 표현을 절대 사용하지 마세요.
- **특정 성명, 기관명, 상호명 등은 기재 불가**
- **"학생은", "OO는", "위 학생은" 등 주어를 절대 사용하지 마세요.**
- **분석 내용, 검증 포인트, 글자 수 표기 등을 절대 출력하지 마세요.**
- **오직 행발 본문만 출력하세요.**
- **줄바꿈 없이 하나의 문단으로 작성하세요.**

${observationText}

${lengthInstruction}

**절대 분석 내용이나 검증 포인트를 출력하지 마세요. 오직 행발 본문만 출력하세요.**
**절대로 "(자세한 내용 포함, 330자)", "(약 500자)", "--- 330자" 같은 글자수나 메타 정보를 출력하지 마세요.**
**오직 순수한 행발 본문 텍스트만 출력하세요. 어떤 부가 설명도 없이 본문만 출력합니다.**
    `;
    };

    const generateForStudent = async (student) => {
        // For behavior, we allow generation even if observation is empty (using default prompt)
        // But let's require at least some input if the user wants specific results.
        // However, to be consistent with "AI generation", we can generate generic good behavior if empty.
        // Let's stick to the prompt logic which handles empty observation.

        let targetChars = 500;
        if (textLength === "1500") targetChars = 500;
        else if (textLength === "1000") targetChars = 330;
        else if (textLength === "600") targetChars = 200;
        else if (textLength === "manual") targetChars = parseInt(manualLength) || 500;

        const prompt = generatePrompt(student, targetChars);

        try {
            updateStudent(student.id, "status", "loading");
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // 글자수 초과시 후처리: 설정된 글자수 이하로 자르기
            let result = data.result;
            if (result && result.length > targetChars) {
                console.log(`[글자수 초과] 원본: ${result.length}자 → ${targetChars}자로 자르기`);
                result = truncateToCharLimit(result, targetChars);
            }

            updateStudent(student.id, "result", result);
            updateStudent(student.id, "status", "success");
        } catch (error) {
            console.error(error);
            updateStudent(student.id, "status", "error");
            alert(`학생 ${student.id} 생성 실패: ${error.message}`);
        }
    };

    const generateAll = async () => {
        const allCompleted = students.every(s => s.status === "success");
        let forceRegenerate = false;

        if (allCompleted) {
            if (window.confirm("이미 모든 학생의 생성이 완료되었습니다.\n전체를 다시 작성하시겠습니까? (기존 내용은 덮어씌워집니다)")) {
                forceRegenerate = true;
            } else {
                return;
            }
        }

        setIsGenerating(true);
        for (const student of students) {
            if (forceRegenerate || student.status !== "success") {
                await generateForStudent(student);
            }
        }
        setIsGenerating(false);
        alert("모든 학생의 생성이 완료되었습니다.");
    };

    const downloadExcel = () => {
        const hasContent = students.some(s => s.result && s.result.trim() !== "");
        if (!hasContent) {
            alert("생성된 내용이 없습니다.");
            return;
        }

        const data = students.map(s => ({
            "번호": s.id,
            "성명": s.name,
            "행동특성 및 종합의견": s.result
        }));
        writeExcel(data, "행발_결과.xlsx");
    };

    return (
        <div className="container py-12">
            <div className="hero-section animate-fade-in">
                <h1 className="hero-title">행동특성 및 종합의견 (행발)</h1>
                <p className="hero-subtitle">
                    학생의 행동 관찰 내용을 바탕으로 <span className="highlight">행동특성 및 종합의견</span>을 생성합니다.
                </p>
            </div>

            {/* Top Section: Settings & Options (No Activity Input) */}
            <div className="grid-2-cols mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>

                {/* Student Settings */}
                <div className="section-card card-blue h-full">
                    <div className="card-header">
                        <div className="card-header-icon">
                            <Users size={20} />
                        </div>
                        <h2>학생 설정</h2>
                    </div>
                    <div className="flex flex-col gap-6">
                        <div className="form-group">
                            <label className="form-label">학생 수</label>
                            {!isManualInput ? (
                                <select
                                    value={studentCount}
                                    onChange={handleStudentCountChange}
                                    className="form-select"
                                >
                                    {[...Array(30)].map((_, i) => (
                                        <option key={i} value={i + 1}>{i + 1}명</option>
                                    ))}
                                    <option value="manual">직접 입력...</option>
                                </select>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={manualCountValue}
                                        onChange={(e) => setManualCountValue(e.target.value)}
                                        placeholder="명수 입력"
                                        className="form-input"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleManualCountSubmit}
                                        className="btn-primary"
                                        style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                    >
                                        확인
                                    </button>
                                    <button
                                        onClick={() => setIsManualInput(false)}
                                        className="btn-secondary"
                                        style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                    >
                                        취소
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">명렬표 업로드 (엑셀)</label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn-secondary flex-1 justify-center"
                                >
                                    엑셀 파일 선택
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Generation Options (Replaces Activity Input) */}
                <div className="section-card card-orange h-full">
                    <div className="card-header">
                        <div className="card-header-icon">
                            <Wand2 size={20} />
                        </div>
                        <h2>생성 옵션</h2>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="form-group">
                            <label className="form-label">글자수 제한</label>
                            <select
                                value={textLength}
                                onChange={(e) => setTextLength(e.target.value)}
                                className="form-select"
                            >
                                <option value="1500">1500byte (한글 약 500자)</option>
                                <option value="1000">1000byte (한글 약 333자)</option>
                                <option value="600">600byte (한글 약 200자)</option>
                                <option value="manual">직접 입력</option>
                            </select>
                            {textLength === "manual" && (
                                <input
                                    type="number"
                                    value={manualLength}
                                    onChange={(e) => setManualLength(e.target.value)}
                                    placeholder="글자수 입력"
                                    className="form-input mt-2"
                                />
                            )}
                        </div>

                        <div className="flex gap-4 flex-col sm:flex-row">
                            <button
                                onClick={generateAll}
                                disabled={isGenerating}
                                className="btn-primary flex-1"
                                style={{ padding: '16px', fontSize: '1.1rem' }}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        생성 중...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={20} /> 전체 학생 AI 생성
                                    </>
                                )}
                            </button>
                            <button
                                onClick={downloadExcel}
                                className="btn-secondary"
                                style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Download size={20} /> 엑셀 다운로드
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Student List */}
            <div className="animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <div className="flex justify-between items-center mb-4" style={{ padding: '0 8px' }}>
                    <h2 className="text-2xl font-bold" style={{ color: '#1f2937' }}>
                        학생 목록 <span style={{ color: '#2563eb' }}>({students.length}명)</span>
                    </h2>
                </div>

                <div className="flex flex-col gap-6">
                    {students.map((student) => (
                        <div key={student.id} className="section-card p-6 relative" style={{ overflow: 'visible' }}>
                            <div className="student-card-grid">
                                {/* Student Info (Left) */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3">
                                        <span style={{
                                            width: '40px', height: '40px', borderRadius: '50%',
                                            backgroundColor: '#dbeafe', color: '#2563eb',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 'bold', fontSize: '1.1rem', flexShrink: 0
                                        }}>
                                            {student.id}
                                        </span>
                                        <input
                                            type="text"
                                            value={student.name}
                                            onChange={(e) => updateStudent(student.id, "name", e.target.value)}
                                            placeholder="이름"
                                            className="form-input"
                                        />
                                    </div>

                                    {/* Observation Input */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-500 ml-1">행동 관찰 결과</label>
                                        <input
                                            type="text"
                                            value={student.observation}
                                            onChange={(e) => updateStudent(student.id, "observation", e.target.value)}
                                            placeholder="예: 배려심이 깊고 친화력이 있음"
                                            className="form-input"
                                            style={{ fontSize: '0.9rem' }}
                                        />
                                    </div>

                                    {/* Action Buttons (Generate & Clear) */}
                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={() => generateForStudent(student)}
                                            className="flex-1 btn-secondary"
                                            style={{
                                                padding: '8px',
                                                fontSize: '0.85rem',
                                                justifyContent: 'center',
                                                borderColor: '#dbeafe',
                                                color: '#2563eb'
                                            }}
                                            title="이 학생만 다시 생성"
                                        >
                                            <Wand2 size={16} /> 개별 생성
                                        </button>
                                        <button
                                            onClick={() => updateStudent(student.id, "result", "")}
                                            className="flex-1 btn-secondary"
                                            style={{
                                                padding: '8px',
                                                fontSize: '0.85rem',
                                                justifyContent: 'center',
                                                color: '#ef4444',
                                                borderColor: '#fee2e2'
                                            }}
                                            title="생성된 내용 지우기"
                                        >
                                            <Trash2 size={16} /> 내용 지우기
                                        </button>
                                    </div>
                                </div>

                                {/* Result Area (Center) */}
                                <div className="flex flex-col gap-2 relative flex-1">
                                    {/* Delete Button Row (Above Textarea) */}
                                    <div className="flex justify-end" style={{ height: '24px' }}>
                                        {students.length > 1 && (
                                            <button
                                                onClick={() => removeStudent(student.id)}
                                                className="btn-icon danger"
                                                title="해당 학생 정보를 삭제합니다"
                                                style={{ padding: '4px' }}
                                            >
                                                <UserX size={20} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="relative w-full">
                                        <textarea
                                            value={student.result}
                                            onChange={(e) => {
                                                updateStudent(student.id, "result", e.target.value);
                                                adjustTextareaHeight(e.target);
                                            }}
                                            onInput={(e) => adjustTextareaHeight(e.target)}
                                            placeholder="AI 생성 결과가 여기에 표시됩니다."
                                            className="form-textarea textarea-auto w-full"
                                        />

                                        {/* Loading Overlay */}
                                        {student.status === "loading" && (
                                            <div className="loading-overlay">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#2563eb' }}>생성 중...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
