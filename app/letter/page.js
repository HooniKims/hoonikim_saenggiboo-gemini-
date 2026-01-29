"use client";

import { useState, useRef } from "react";
import { Trash2, Download, Wand2, Users, UserX } from "lucide-react";
import * as XLSX from "xlsx";
import { writeExcel } from "../../utils/excel";
import { cleanMetaInfo, truncateToCompleteSentence, getCharacterGuideline, getPromptCharLimit } from "../../utils/textProcessor";

export default function LetterPage() {
    // State
    const [studentCount, setStudentCount] = useState(1);
    const [isManualInput, setIsManualInput] = useState(false);
    const [manualCountValue, setManualCountValue] = useState("");

    const [students, setStudents] = useState([{ id: 1, name: "", result: "", status: "idle" }]);
    const [textLength, setTextLength] = useState("1500");
    const [manualLength, setManualLength] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef(null);

    // Letter Specific State
    const [season, setSeason] = useState("summer"); // summer, winter
    const [keywords, setKeywords] = useState("학업, 건강, 친구관계, 가족관계");

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
                newStudents.push({ id: i, name: "", result: "", status: "idle" });
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
            let headerRowIndex = -1;

            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                for (let j = 0; j < row.length; j++) {
                    const cellValue = String(row[j]).trim().replace(/\s/g, "");
                    if (cellValue === "성명" || cellValue === "이름") {
                        nameColIndex = j;
                        headerRowIndex = i;
                        break;
                    }
                }
                if (nameColIndex !== -1) break;
            }

            const newStudents = [];
            let idCounter = 1;

            if (nameColIndex !== -1) {
                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    const name = row[nameColIndex];
                    if (name && typeof name === 'string' && name.trim() !== "") {
                        newStudents.push({ id: idCounter++, name: name.trim(), result: "", status: "idle" });
                    }
                }
            } else {
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    for (let j = 0; j < Math.min(row.length, 3); j++) {
                        const val = row[j];
                        if (typeof val === 'string' && val.length > 1 && val.length < 10) {
                            if (val !== "성명" && val !== "이름") {
                                newStudents.push({ id: idCounter++, name: val.trim(), result: "", status: "idle" });
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


    // cleanMetaInfo, truncateToCompleteSentence는 textProcessor에서 import됨

    const generatePrompt = (targetChars) => {
        let minChar, maxChar;
        if (targetChars === 200) {
            minChar = 150; maxChar = 200;
        } else if (targetChars === 500) {
            minChar = 400; maxChar = 500;
        } else {
            minChar = Math.floor(targetChars * 0.8);
            maxChar = targetChars;
        }

        // 글자수 지침은 공통 유틸에서 생성
        const lengthInstruction = getCharacterGuideline(targetChars);

        const keywordContext = keywords ? `입력된 키워드: ${keywords}` : "입력된 키워드: 학업, 건강, 친구관계, 가족관계";

        let promptContent = "";

        if (season === "summer") {
            promptContent = `
당신은 학생의 학교생활을 관찰하고 평가하는 교사입니다. 학기말 통지표에 들어갈 '가정통신문(종합의견)'을 작성해주세요.

## 작성 목표
편지 형식이 아닌, 학생의 한 학기 동안의 성장과 노력을 객관적이면서도 따뜻하게 기술하고, 여름방학 동안 가정에서 지도해야 할 점을 당부하는 내용을 작성하세요.

${keywordContext}

## 작성 가이드
1. **학생의 성장과 노력**: 입력된 키워드를 바탕으로 학생이 학교에서 보여준 긍정적인 모습과 노력을 구체적으로 서술하세요.
2. **가정 연계 지도 당부**: 방학 동안 가정에서 학생을 위해 신경 써주어야 할 부분이나 지도가 필요한 부분을 조언하세요.
3. **마침표 준수**: **모든 문장은 반드시 마침표(.)로 끝나야 합니다.**

## 절대 금지사항
- **특정 과목명(국어, 수학 등) 및 점수/등수 언급 금지.**
- **주어 생략: "OO가", "자녀분이", "학생이" 등 주어를 절대 사용하지 마세요.**
- **줄바꿈 없이 하나의 문단으로 작성하세요.**
- **오직 본문 내용만 출력하세요.**
            `;
        } else {
            promptContent = `
당신은 학생의 학교생활을 관찰하고 평가하는 교사입니다. 학기말 통지표에 들어갈 '가정통신문(종합의견)'을 작성해주세요.

## 작성 목표
편지 형식이 아닌, 학생의 일년 동안의 성장과 노력을 객관적이면서도 따뜻하게 기술하고, 겨울방학 및 새 학기 준비를 위해 가정에서 지도해야 할 점을 당부하는 내용을 작성하세요.

${keywordContext}

## 작성 가이드
1. **학생의 성장과 노력**: 입력된 키워드를 바탕으로 학생이 일년 동안 보여준 성취와 긍정적인 변화를 구체적으로 서술하세요.
2. **가정 연계 지도 당부**: 겨울방학 동안의 생활 습관 관리와 새 학기 준비를 위해 가정에서 신경 써주어야 할 부분을 조언하세요.
3. **마침표 준수**: **모든 문장은 반드시 마침표(.)로 끝나야 합니다.**

## 절대 금지사항
- **특정 과목명(국어, 수학 등) 및 점수/등수 언급 금지.**
- **주어 생략: "OO가", "자녀분이", "학생이" 등 주어를 절대 사용하지 마세요.**
- **줄바꿈 없이 하나의 문단으로 작성하세요.**
- **오직 본문 내용만 출력하세요.**
            `;
        }

        return `
${promptContent}

${lengthInstruction}

**절대 분석 내용이나 검증 포인트를 출력하지 마세요. 오직 가정통신문 본문만 출력하세요.**
**절대로 "(자세한 내용 포함, 330자)", "(약 500자)", "--- 330자" 같은 글자수나 메타 정보를 출력하지 마세요.**
**오직 순수한 가정통신문 본문 텍스트만 출력하세요. 어떤 부가 설명도 없이 본문만 출력합니다.**
    `;
    };

    const generateForStudent = async (student) => {
        let targetChars = 500;
        if (textLength === "1500") targetChars = 500;
        else if (textLength === "1000") targetChars = 330;
        else if (textLength === "600") targetChars = 200;
        else if (textLength === "manual") targetChars = parseInt(manualLength) || 500;

        const prompt = generatePrompt(targetChars);

        try {
            updateStudent(student.id, "status", "loading");
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // 글자수 초과시 후처리: 완전한 문장으로 자르기
            let result = data.result;
            result = truncateToCompleteSentence(result, targetChars);
            if (data.result && result.length < data.result.length) {
                console.log(`[글자수 조정] 원본: ${data.result.length}자 → ${result.length}자 (완전한 문장으로)`);
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
            "가정통신문": s.result
        }));
        writeExcel(data, "가정통신문_결과.xlsx");
    };

    return (
        <div className="container py-12">
            <div className="hero-section animate-fade-in">
                <h1 className="hero-title">가정통신문 작성</h1>
                <p className="hero-subtitle">
                    학기말 통지표에 들어갈 <span className="highlight">가정통신문(종합의견)</span>을 생성합니다.
                </p>
            </div>

            {/* Top Section: Settings & Options */}
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

                {/* Generation Options */}
                <div className="section-card card-orange h-full">
                    <div className="card-header">
                        <div className="card-header-icon">
                            <Wand2 size={20} />
                        </div>
                        <h2>생성 옵션</h2>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="grid-2-cols gap-4">
                            <div className="form-group mb-0">
                                <label className="form-label">학기 구분</label>
                                <select
                                    value={season}
                                    onChange={(e) => setSeason(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="summer">여름방학 (1학기)</option>
                                    <option value="winter">겨울방학 (학년말)</option>
                                </select>
                            </div>
                            <div className="form-group mb-0">
                                <label className="form-label">글자수 제한</label>
                                <select
                                    value={textLength}
                                    onChange={(e) => setTextLength(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="1500">1500byte (약 500자)</option>
                                    <option value="1000">1000byte (약 333자)</option>
                                    <option value="600">600byte (약 200자)</option>
                                    <option value="manual">직접 입력</option>
                                </select>
                            </div>
                        </div>

                        {textLength === "manual" && (
                            <div className="form-group">
                                <input
                                    type="number"
                                    value={manualLength}
                                    onChange={(e) => setManualLength(e.target.value)}
                                    placeholder="글자수 입력"
                                    className="form-input"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">강조 키워드 (공통 적용)</label>
                            <input
                                type="text"
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                placeholder="예: 학업, 건강, 친구관계, 가족관계"
                                className="form-input"
                            />
                        </div>

                        <div className="flex gap-4 flex-col sm:flex-row mt-auto">
                            <button
                                onClick={generateAll}
                                disabled={isGenerating}
                                className="btn-primary flex-1"
                                style={{ padding: '12px', fontSize: '1.1rem' }}
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
                                style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
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
