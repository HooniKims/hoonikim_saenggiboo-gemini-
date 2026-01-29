"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Upload, Download, Wand2, FileSpreadsheet, Users, UserX, Copy } from "lucide-react";
import * as XLSX from "xlsx";
import { writeExcel } from "../../utils/excel";
import { cleanMetaInfo, truncateToCompleteSentence, getCharacterGuideline, getPromptCharLimit } from "../../utils/textProcessor";

export default function ClubPage() {
    // State
    const [studentCount, setStudentCount] = useState(1);
    const [isManualInput, setIsManualInput] = useState(false);
    const [manualCountValue, setManualCountValue] = useState("");

    const [clubName, setClubName] = useState(""); // Changed from subjectName
    const [schoolLevel, setSchoolLevel] = useState("middle"); // Default to middle

    // Removed 'grade' from student object, added 'individualActivity' for per-student activities
    const [students, setStudents] = useState([{ id: 1, name: "", individualActivity: "", result: "", status: "idle" }]);
    const [activities, setActivities] = useState([""]);
    const [additionalInstructions, setAdditionalInstructions] = useState(""); // 추가 지침 사항
    const [textLength, setTextLength] = useState("1500");
    const [manualLength, setManualLength] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef(null);
    const activityInputRefs = useRef([]);
    const prevActivitiesLength = useRef(activities.length);

    useEffect(() => {
        if (activities.length > prevActivitiesLength.current) {
            const lastIndex = activities.length - 1;
            activityInputRefs.current[lastIndex]?.focus();
        }
        prevActivitiesLength.current = activities.length;
    }, [activities]);

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
                newStudents.push({ id: i, name: "", individualActivity: "", result: "", status: "idle" });
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
            let activityColIndex = -1;
            let headerRowIndex = -1;

            // 1. Find the header row, "성명" column, and "활동 내용" column
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                // 헤더 행의 모든 열 이름 출력 (디버깅용)
                if (i === 0) {
                    console.log("[엑셀 파싱] 헤더 행:", row.map((cell, idx) => `[${idx}]${String(cell).trim()}`).join(" | "));
                }
                for (let j = 0; j < row.length; j++) {
                    const cellValue = String(row[j]).trim().replace(/\s/g, ""); // Remove spaces
                    if (cellValue === "성명" || cellValue === "이름") {
                        nameColIndex = j;
                        headerRowIndex = i;
                    }
                    // 활동 내용 열 인식: 다양한 키워드 지원
                    if (cellValue.includes("활동") || cellValue.includes("내용") ||
                        cellValue.includes("관찰내용") || cellValue.includes("관찰기록") ||
                        cellValue.includes("세부능력") || cellValue.includes("특기사항") ||
                        cellValue.includes("세특") || cellValue.includes("개별활동")) {
                        activityColIndex = j;
                    }
                }
                if (nameColIndex !== -1) break;
            }

            console.log(`[엑셀 파싱] nameColIndex: ${nameColIndex} activityColIndex: ${activityColIndex} headerRowIndex: ${headerRowIndex}`);

            const newStudents = [];
            let idCounter = 1;

            // 2. Extract names and activities if columns found
            if (nameColIndex !== -1) {
                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    const name = row[nameColIndex];
                    const activity = activityColIndex !== -1 ? row[activityColIndex] : "";
                    if (name && typeof name === 'string' && name.trim() !== "") {
                        const individualActivity = activity && typeof activity === 'string' ? activity.trim() : "";
                        newStudents.push({ id: idCounter++, name: name.trim(), individualActivity, result: "", status: "idle" });
                        if (individualActivity) {
                            console.log(`[엑셀 파싱] 학생: ${name.trim()} 활동내용: ${individualActivity}`);
                        }
                    }
                }
            } else {
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    for (let j = 0; j < Math.min(row.length, 3); j++) {
                        const val = row[j];
                        if (typeof val === 'string' && val.length > 1 && val.length < 10) {
                            if (val !== "성명" && val !== "이름") {
                                newStudents.push({ id: idCounter++, name: val.trim(), individualActivity: "", result: "", status: "idle" });
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

    const addActivity = () => setActivities([...activities, ""]);
    const removeActivity = (index) => {
        const newActivities = activities.filter((_, i) => i !== index);
        setActivities(newActivities.length ? newActivities : [""]);
    };
    const updateActivity = (index, value) => {
        const newActivities = [...activities];
        newActivities[index] = value;
        setActivities(newActivities);
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

    // 학생별 개별 활동과 공통 활동 간의 관련성 점수 계산
    const calculateRelevanceScore = (commonActivity, individualActivity) => {
        if (!individualActivity || !commonActivity) return 0;
        const commonWords = commonActivity.toLowerCase().split(/\s+/);
        const individualWords = individualActivity.toLowerCase().split(/\s+/);
        let score = 0;
        for (const word of commonWords) {
            if (word.length > 1 && individualWords.some(iw => iw.includes(word) || word.includes(iw))) {
                score += 1;
            }
        }
        return score;
    };

    const generatePrompt = (student, selectedActivities, targetChars, individualActivity = "") => {
        // Perspectives for variety
        const perspectives = [
            '특히 학생의 적극성과 참여도를 중심으로',
            '특히 협업 능력과 소통 능력을 중심으로',
            '특히 리더십과 책임감을 중심으로',
            '특히 창의성과 문제 해결 능력을 중심으로',
            '특히 성실성과 지속적인 노력을 중심으로',
            '특히 성장 과정과 태도 변화를 중심으로',
            '특히 진로 연계성과 전문성 발전을 중심으로',
            '특히 자기주도성과 탐구 능력을 중심으로'
        ];

        // Select perspective based on student ID (round-robin)
        const selectedPerspective = perspectives[(student.id - 1) % perspectives.length];

        // Character limit logic (same as gwasetuk but simplified without grade)
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

        const schoolLevelMap = {
            elementary: "초등학생",
            middle: "중학생",
            high: "고등학생"
        };
        const targetLevel = schoolLevelMap[schoolLevel] || "중학생";
        const clubContext = clubName ? `동아리명: ${clubName}` : "동아리명: 미지정 (일반적인 동아리 활동으로 간주)";

        const activitiesText = selectedActivities.map(a => `- ${a}`).join("\n");

        // 학생별 개별 활동 내용이 있으면 추가
        const individualActivityText = individualActivity.trim()
            ? `\n\n[이 학생의 개별 활동 내용]\n${individualActivity}\n(위 개별 활동 내용과 공통 활동 내용을 연결하여 통합적으로 서술해 주세요. 예: '환경 캠페인' 공통 활동과 '포스터 제작'이라는 개별 활동이 있으면, 환경 캠페인에서 포스터 제작을 담당한 것으로 연결하여 서술)`
            : "";

        return `
당신은 대한민국 고등학교 교사로서 학생의 학교생활기록부 동아리 활동 특기사항을 작성하는 전문가입니다.

## 작성 목표
학생의 동아리 활동 내용을 바탕으로, 학생의 적극성, 성실성, 리더십, 협업 능력 등 개별적인 특성이 드러나도록 구체적이고 과정 중심으로 작성하세요.
**작성 관점: ${selectedPerspective} 서술하세요.**

## 핵심 원칙: 오직 활동 내용만 서술하고, 마무리/요약/정리 문장은 절대 작성하지 않음.

## 작성 가이드
1. **구체적인 활동 명시**: 참여 내용 등 구체적인 사실을 포함합니다.
2. **개인별 특성 강조**: 학생의 적극성, 성실성, 리더십, 협업 능력 등 개별적인 특성이 드러나도록 작성합니다.
3. **과정 중심 서술**: 결과만 나열하기보다 활동 과정에서 겪은 어려움, 노력, 태도 변화 등을 구체적으로 기술합니다.
4. **문체**: 반드시 명사형 종결어미(~함, ~보임, ~드러남)를 사용하여 간결하고 명확하게 작성하세요.

## 절대 금지사항 (매우 중요)
- **소논문 기재 금지**: 소논문은 절대 기재할 수 없습니다.
- **특정 성명, 기관명, 상호명 등은 기재 불가**
- **동아리명 언급 금지**: "~동아리에서", "~동아리 활동으로" 등 동아리명을 절대 언급하지 마세요. 바로 활동 내용부터 시작하세요.
- **"학생은", "OO는", "위 학생은" 등 주어를 절대 사용하지 마세요.**
- **분석 내용, 검증 포인트, 글자 수 표기 등을 절대 출력하지 마세요.**
- **오직 동아리 특기사항 본문만 출력하세요.**
- **줄바꿈 없이 하나의 문단으로 작성하세요.**
- **입력된 활동 내용에 없는 구체적인 사건, 실험 결과, 특정 도서명 등을 절대 지어내지 마세요.**

## ⛔ 절대 금지 (마무리 문장)
- 마무리, 요약, 정리, 결론 성격의 문장은 절대 작성 금지
- '이러한', '이를 통해', '이와 같이', '이런', '앞으로', '향후', '결과적으로', '종합적으로'로 시작하는 문장 금지
- 글의 마지막 문장도 반드시 구체적인 활동 내용이나 학습 과정에 대한 서술이어야 함
- 마무리 문장 대신 활동의 세부 과정, 탐구 내용, 협력 모습을 추가로 서술할 것

대상 학교급: ${targetLevel}
${clubContext}

입력된 활동 내용:
${activitiesText}${individualActivityText}

${lengthInstruction}
**절대 분석 내용이나 검증 포인트를 출력하지 마세요. 오직 동아리 특기사항 본문만 출력하세요.**
**절대로 "(자세한 내용 포함, 330자)", "(약 500자)", "--- 330자" 같은 글자수나 메타 정보를 출력하지 마세요.**
**오직 순수한 동아리 특기사항 본문 텍스트만 출력하세요. 어떤 부가 설명도 없이 본문만 출력합니다.**
${additionalInstructions.trim() ? `

【🚨 특별 지시 - 반드시 적용 🚨】
사용자가 다음과 같이 명시적으로 요청했습니다. 이 지시를 반드시 따르세요:
→ "${additionalInstructions}"
위 지시를 무시하고 생성하면 결과가 무효화됩니다. 반드시 위 내용을 반영하여 작성하세요.` : ""}
    `;
    };

    const generateForStudent = async (student) => {
        const validActivities = activities.filter(a => a.trim() !== "");
        if (validActivities.length === 0 && !student.individualActivity?.trim()) {
            alert("활동 내용을 입력해주세요.");
            return;
        }

        let targetChars = 500;
        if (textLength === "1500") targetChars = 500;
        else if (textLength === "1000") targetChars = 330;
        else if (textLength === "600") targetChars = 200;
        else if (textLength === "manual") targetChars = parseInt(manualLength) || 500;

        let selectedActivities = [...validActivities];

        // 학생별 개별 활동이 있으면 관련성 높은 활동 우선 선택
        if (student.individualActivity?.trim() && validActivities.length > 0) {
            // 관련성 점수로 정렬 (높은 점수 우선)
            selectedActivities = [...validActivities].sort((a, b) => {
                const scoreA = calculateRelevanceScore(a, student.individualActivity);
                const scoreB = calculateRelevanceScore(b, student.individualActivity);
                if (scoreB !== scoreA) return scoreB - scoreA;
                return Math.random() - 0.5; // 동점일 경우 랜덤
            });
        } else if (additionalInstructions && (additionalInstructions.includes('랜덤') || additionalInstructions.includes('무작위'))) {
            // 추가 지침에 '랜덤' 또는 '무작위' 키워드가 있으면 활동 셔플
            selectedActivities = [...validActivities].sort(() => Math.random() - 0.5);
        }
        // 그 외에는 원래 순서 유지

        // Activity Selection Logic based on Target Chars - 강화된 로직
        if (targetChars < 80) {
            // 매우 짧으면 1개만 선택
            selectedActivities = selectedActivities.slice(0, 1);
        } else if (targetChars <= 150) {
            // 150자 이하: 최대 2개
            selectedActivities = selectedActivities.slice(0, Math.min(2, selectedActivities.length));
        } else if (targetChars <= 250) {
            // 250자 이하: 최대 3개
            selectedActivities = selectedActivities.slice(0, Math.min(3, selectedActivities.length));
        } else if (targetChars <= 350) {
            // 350자 이하 (1000byte): 최대 4개
            selectedActivities = selectedActivities.slice(0, Math.min(4, selectedActivities.length));
        }
        // 350자 초과: 모든 활동 사용

        const prompt = generatePrompt(student, selectedActivities, targetChars, student.individualActivity || "");

        try {
            updateStudent(student.id, "status", "loading");
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, additionalInstructions })
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
            "동아리 활동 특기사항": s.result
        }));
        writeExcel(data, "동아리세특_결과.xlsx");
    };

    return (
        <div className="container py-12">
            <div className="hero-section animate-fade-in">
                <h1 className="hero-title">동아리 세특</h1>
                <p className="hero-subtitle">
                    동아리 활동 내용을 바탕으로 <span className="highlight">동아리 활동 특기사항</span>을 생성합니다.
                </p>
            </div>

            {/* Top Section: Settings & Activities */}
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

                {/* Activity Inputs */}
                <div className="section-card card-purple h-full">
                    <div className="card-header">
                        <div className="card-header-icon">
                            <FileSpreadsheet size={20} />
                        </div>
                        <h2>활동 내용 입력</h2>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="grid-2-cols gap-4">
                            <div className="form-group mb-0">
                                <label className="form-label">학교급</label>
                                <select
                                    value={schoolLevel}
                                    onChange={(e) => setSchoolLevel(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="elementary">초등학교</option>
                                    <option value="middle">중학교</option>
                                    <option value="high">고등학교</option>
                                </select>
                            </div>
                            <div className="form-group mb-0">
                                <label className="form-label">동아리명</label>
                                <input
                                    type="text"
                                    value={clubName}
                                    onChange={(e) => setClubName(e.target.value)}
                                    placeholder="예: 과학탐구반, 방송반"
                                    className="form-input"
                                />
                            </div>
                        </div>
                        <hr className="border-gray-200" />
                        {activities.map((activity, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    ref={el => activityInputRefs.current[index] = el}
                                    type="text"
                                    value={activity}
                                    onChange={(e) => updateActivity(index, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addActivity();
                                        }
                                    }}
                                    placeholder={`활동 내용 ${index + 1}`}
                                    className="form-input"
                                />
                                {activities.length > 1 && (
                                    <button onClick={() => removeActivity(index)} className="btn-icon danger">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={addActivity}
                            className="w-full"
                            style={{
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                backgroundColor: '#8b5cf6',
                                color: 'white',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
                        >
                            <Plus size={18} /> 활동 추가
                        </button>

                        {/* 추가 지침 사항 */}
                        <div className="form-group" style={{ marginTop: '16px', marginBottom: 0 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠</span>
                                추가 지침 사항 (선택)
                            </label>
                            <textarea
                                value={additionalInstructions}
                                onChange={(e) => setAdditionalInstructions(e.target.value)}
                                placeholder="예: 토론 활동은 주제와 본인의 입장을 중심으로 작성해 주세요."
                                className="form-textarea"
                                style={{
                                    minHeight: '70px',
                                    fontSize: '0.9rem',
                                    resize: 'vertical',
                                    borderColor: '#fecaca',
                                    backgroundColor: '#fef2f2'
                                }}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                                위 지침은 AI가 최우선으로 엄격히 준수합니다.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Section: Generation Options */}
            <div className="mb-12 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="section-card card-orange">
                    <div className="card-header">
                        <div className="card-header-icon">
                            <Wand2 size={20} />
                        </div>
                        <h2>생성 옵션</h2>
                    </div>
                    <div className="grid-2-cols items-end">
                        <div className="form-group" style={{ marginBottom: 0 }}>
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

                        <div className="flex gap-4">
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
                                style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
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

                                    {/* 학생별 개별 활동 내용 입력 */}
                                    <div className="form-group" style={{ marginBottom: 0, marginTop: '8px' }}>
                                        <textarea
                                            value={student.individualActivity}
                                            onChange={(e) => updateStudent(student.id, "individualActivity", e.target.value)}
                                            placeholder="학생별 개별적으로 활동한 내용을 입력해주세요."
                                            className="form-textarea"
                                            style={{
                                                minHeight: '60px',
                                                fontSize: '0.85rem',
                                                resize: 'vertical'
                                            }}
                                        />
                                    </div>

                                    {/* Grade Buttons Removed for Club Activity */}

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

                                    {/* 복사 버튼 */}
                                    {student.result && (
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={() => {
                                                    // Clipboard API fallback for HTTP
                                                    const copyText = (text) => {
                                                        if (navigator.clipboard && window.isSecureContext) {
                                                            navigator.clipboard.writeText(text);
                                                        } else {
                                                            const textarea = document.createElement('textarea');
                                                            textarea.value = text;
                                                            textarea.style.position = 'fixed';
                                                            textarea.style.opacity = '0';
                                                            document.body.appendChild(textarea);
                                                            textarea.select();
                                                            document.execCommand('copy');
                                                            document.body.removeChild(textarea);
                                                        }
                                                    };
                                                    copyText(student.result);
                                                    const btn = document.getElementById(`copy-btn-club-${student.id}`);
                                                    if (btn) {
                                                        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>복사됨!</span>';
                                                        setTimeout(() => {
                                                            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg><span>복사</span>';
                                                        }, 1500);
                                                    }
                                                }}
                                                id={`copy-btn-club-${student.id}`}
                                                className="btn-secondary"
                                                style={{
                                                    padding: '4px 10px',
                                                    fontSize: '0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    color: '#6b7280',
                                                    borderColor: '#e5e7eb'
                                                }}
                                                title="클립보드에 복사"
                                            >
                                                <Copy size={14} />
                                                <span>복사</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
