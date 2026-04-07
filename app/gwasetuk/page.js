"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Upload, Download, Wand2, FileSpreadsheet, Users, UserX, Copy, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { writeExcel } from "../../utils/excel";
import { cleanMetaInfo, truncateToCompleteSentence, getCharacterGuideline, getPromptCharLimit } from "../../utils/textProcessor";
import { fetchStream, AVAILABLE_MODELS, DEFAULT_MODEL, getModelOptionLabel, isLightweightModel } from "../../utils/streamFetch";

export default function GwasetukPage() {
    // State
    const [studentCount, setStudentCount] = useState(1);
    const [isManualInput, setIsManualInput] = useState(false);
    const [manualCountValue, setManualCountValue] = useState("");

    const [subjectName, setSubjectName] = useState("");
    const [schoolLevel, setSchoolLevel] = useState("middle"); // elementary, middle, high

    const [students, setStudents] = useState([{ id: 1, name: "", grade: "A", individualActivity: "", result: "", status: "idle" }]);
    const [activities, setActivities] = useState([""]);
    const [additionalInstructions, setAdditionalInstructions] = useState(""); // 추가 지침 사항
    const [textLength, setTextLength] = useState("1500"); // 1500, 1000, 600, manual
    const [manualLength, setManualLength] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
    const [copiedId, setCopiedId] = useState(null);
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
                newStudents.push({ id: i, name: "", grade: "A", individualActivity: "", result: "", status: "idle" });
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
        if (count > 0 && count <= 100) { // Reasonable limit
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
                    // 활동 내용 열 인식: 다양한 키워드 지원 (세부능력 및 특기사항 포함)
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
                        newStudents.push({ id: idCounter++, name: name.trim(), grade: "A", individualActivity, result: "", status: "idle" });
                        if (individualActivity) {
                            console.log(`[엑셀 파싱] 학생: ${name.trim()} 활동내용: ${individualActivity}`);
                        }
                    }
                }
            } else {
                // Fallback: Try to find names in the first few columns if no header found
                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    // Check first 3 columns
                    for (let j = 0; j < Math.min(row.length, 3); j++) {
                        const val = row[j];
                        if (typeof val === 'string' && val.length > 1 && val.length < 10) {
                            if (val !== "성명" && val !== "이름") {
                                newStudents.push({ id: idCounter++, name: val.trim(), grade: "A", individualActivity: "", result: "", status: "idle" });
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

    const generatePrompt = (student, selectedActivities, targetChars, individualActivity = "", model = "") => {
        const gradePrompts = {
            A: `등급: A (탁월함)\n활동의 깊이와 수준이 높으며, 심화된 탐구와 융합적 사고가 잘 드러나도록 작성하세요.`,
            B: `등급: B (우수함)\n과제를 잘 완수하고 성실히 참여했다는 점을 중심으로 작성하세요.`,
            C: `등급: C (노력요함/발전가능성)\n잘한 점과 아쉬운 점을 균형 있게 서술하고, 긍정적인 변화 가능성을 열어두세요.`
        };

        let minChar, maxChar;

        if (targetChars === 200) {
            if (student.grade === 'A') { minChar = 190; maxChar = 200; }
            else if (student.grade === 'B') { minChar = 170; maxChar = 189; }
            else { minChar = 150; maxChar = 169; }
        } else if (targetChars === 490) {
            if (student.grade === 'A') { minChar = 470; maxChar = 490; }
            else if (student.grade === 'B') { minChar = 430; maxChar = 479; }
            else { minChar = 350; maxChar = 429; }
        } else {
            if (student.grade === 'A') {
                minChar = Math.floor(targetChars * 0.95);
                maxChar = targetChars;
            } else if (student.grade === 'B') {
                minChar = Math.floor(targetChars * 0.85);
                maxChar = Math.floor(targetChars * 0.94);
            } else {
                minChar = Math.floor(targetChars * 0.70);
                maxChar = Math.floor(targetChars * 0.84);
            }
        }

        const lengthInstruction = getCharacterGuideline(targetChars);

        const schoolLevelMap = {
            elementary: "초등학생",
            middle: "중학생",
            high: "고등학생"
        };
        const targetLevel = schoolLevelMap[schoolLevel] || "중학생";
        // 과목명은 시스템 참고용으로만 전달 (출력에 절대 포함 금지)
        const subjectContext = subjectName ? `[시스템 참고 - 출력에 절대 포함 금지] 과목: ${subjectName}` : "";

        const totalActivities = selectedActivities.length;
        const activitiesText = selectedActivities.map((a, i) => `- 활동${i + 1}: ${a}`).join("\n");

        // 활동별 글자수 할당량 계산 (경량 모델용)
        const charsPerActivity = totalActivities > 0 ? Math.floor(targetChars / totalActivities) : targetChars;
        const activityAllocation = selectedActivities.map((a, i) =>
            `활동${i + 1}("${a.substring(0, 15)}${a.length > 15 ? '...' : ''}"): 약 ${charsPerActivity}자`
        ).join(", ");

        const individualActivityText = individualActivity.trim()
            ? `\n\n[이 학생의 개별 활동 내용]\n${individualActivity}\n(위 개별 활동 내용과 공통 활동 내용을 연결하여 통합적으로 서술해 주세요.)`
            : "";

        const isLightweight_ = isLightweightModel(model || selectedModel);

        if (isLightweight_) {
            // 경량 모델용: 간결하고 명확한 프롬프트
            return `과세특 본문을 작성하세요.

대상: ${targetLevel}
${subjectContext}
${gradePrompts[student.grade]}

[활동 내용 - 총 ${totalActivities}개, 모두 반영 필수]
${activitiesText}${individualActivityText}

[활동별 할당량] ${activityAllocation}

[절대금지]
❌ 과목명 출력 금지 ("국어시간에", "수학 활동에서", "과학 수업" 등 전부 금지)
❌ 과거형 금지 (~했음, ~였음, ~되었음, ~하였음, ~보였음 전부 금지)
❌ 주어 금지 ("학생은", "이 학생은" 금지)
❌ 요약/마무리 문장 금지

[필수]
✅ 현재형 종결어미만 사용: ~함, ~임, ~음, ~보임, ~드러남
✅ 위 ${totalActivities}개 활동을 모두 다양한 표현으로 서술
✅ 줄바꿈 없이 하나의 문단
✅ 오직 본문만 출력

${lengthInstruction}

[좋은 예시]
"토론 활동에서 찬반 입장을 논리적으로 정리하고 근거 자료를 조사하여 발표함. 발표 과정에서 상대 측 논거를 파악하고 재반박하는 능력을 보임."
`;
        }

        return `당신은 학교생활기록부 과세특(과목별 세부능력 및 특기사항)을 작성하는 교사입니다.
아래 ${totalActivities}개의 활동 내용과 등급을 바탕으로 과세특 본문을 작성하세요.
모든 활동을 빠짐없이 반영하되, 각 활동마다 다양한 표현과 구체적인 서술을 사용하세요.

<입력 정보>
대상: ${targetLevel}
${subjectContext}
${gradePrompts[student.grade]}

<활동 내용 - 총 ${totalActivities}개, 반드시 모두 반영>
${activitiesText}${individualActivityText}

<작성 규칙>
1. '학생은', '이 학생은' 등 주어를 사용하지 않고, 활동 내용부터 바로 서술
2. [절대금지] 과목명/프로그램명을 출력에 절대 포함하지 않음 (예: "국어시간에", "수학 수업에서", "과학 활동에서" 등 전부 금지). 바로 활동 서술로 시작
3. [절대금지] 과거형 표현 금지 (~했음, ~였음, ~되었음, ~하였음, ~보였음). 반드시 현재형 명사 종결어미(~함, ~임, ~음, ~보임, ~드러남)만 사용
4. ${targetLevel} 수준에 맞는 어휘 사용
5. 줄바꿈 없이 하나의 문단으로 작성
6. 입력된 ${totalActivities}개 활동 내용을 모두 빠짐없이 서술하고, 입력에 없는 사실은 추가하지 않음
7. 마지막 문장도 반드시 구체적인 활동 내용이나 학습 과정 서술로 끝냄
8. '이러한', '이를 통해', '이와 같이', '앞으로', '향후', '결과적으로', '종합적으로'로 시작하는 요약/정리/마무리 문장 대신, 활동의 세부 과정이나 탐구 내용을 추가 서술

${lengthInstruction}

<출력 형식>
- 오직 세특 본문 텍스트만 출력
- 글자수 표기, 분석, 검증 포인트, 부가 설명 등 메타 정보는 출력하지 않음

<좋은 예시>
"토론 활동에서 '인공지능의 윤리'를 주제로 찬성 측 토론자로 참여하여 다양한 근거 자료를 조사하고 논리적으로 주장을 전개함. 특히 반론 과정에서 상대 측의 논거를 정확히 파악하고 재반박하는 능력이 돋보이며, 팀원들과 역할을 분담하여 자료 수집과 발표 준비를 체계적으로 진행함."
    `;
    };

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

    // Fisher-Yates 셔플 알고리즘 (강력한 랜덤)
    const shuffleArray = (arr) => {
        const shuffled = [...arr];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    const generateForStudent = async (student) => {
        const validActivities = activities.filter(a => a.trim() !== "");
        if (validActivities.length === 0 && !student.individualActivity?.trim()) {
            alert("활동 내용을 입력해주세요.");
            return;
        }

        // Calculate Target Chars
        let targetChars = 490;
        if (textLength === "1500") targetChars = 490;
        else if (textLength === "1000") targetChars = 330;
        else if (textLength === "600") targetChars = 200;
        else if (textLength === "manual") targetChars = parseInt(manualLength) || 490;

        let selectedActivities = [...validActivities];

        // 과세특: 항상 랜덤 셔플 (학생마다 다른 순서로 생성)
        if (student.individualActivity?.trim() && validActivities.length > 0) {
            // 개별 활동이 있으면 관련성 높은 활동 우선 + 나머지 랜덤
            selectedActivities = [...validActivities].sort((a, b) => {
                const scoreA = calculateRelevanceScore(a, student.individualActivity);
                const scoreB = calculateRelevanceScore(b, student.individualActivity);
                if (scoreB !== scoreA) return scoreB - scoreA;
                return Math.random() - 0.5;
            });
        } else {
            // 항상 Fisher-Yates 셔플로 랜덤화
            selectedActivities = shuffleArray(validActivities);
        }

        // Activity Selection Logic based on Target Chars
        if (targetChars < 80) {
            selectedActivities = selectedActivities.slice(0, 1);
        } else if (targetChars <= 150) {
            selectedActivities = selectedActivities.slice(0, Math.min(2, selectedActivities.length));
        } else if (targetChars <= 250) {
            selectedActivities = selectedActivities.slice(0, Math.min(3, selectedActivities.length));
        } else if (targetChars <= 350) {
            selectedActivities = selectedActivities.slice(0, Math.min(4, selectedActivities.length));
        }
        // 350자 초과: 모든 활동 사용

        const prompt = generatePrompt(student, selectedActivities, targetChars, student.individualActivity || "", selectedModel);

        try {
            updateStudent(student.id, "status", "loading");
            const rawResult = await fetchStream({ prompt, additionalInstructions, model: selectedModel, targetChars });

            let result = rawResult;
            result = truncateToCompleteSentence(result, targetChars);
            if (rawResult && result.length < rawResult.length) {
                console.log(`[글자수 조정] 원본: ${rawResult.length}자 → ${result.length}자 (완전한 문장으로)`);
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
            "성취도": s.grade,
            "세부능력 및 특기사항": s.result
        }));
        writeExcel(data, "과세특_결과.xlsx");
    };

    return (
        <div className="container py-12">
            <div className="hero-section animate-fade-in">
                <h1 className="hero-title">과세특(자유학기 세특)</h1>
                <p className="hero-subtitle">
                    특정 과목 시간에 활동한 내용을 바탕으로 <span className="highlight">과목별(자유학기) 세부능력 및 특기사항</span>을 생성합니다.
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
                                <label className="form-label">과목/프로그램명</label>
                                <input
                                    type="text"
                                    value={subjectName}
                                    onChange={(e) => setSubjectName(e.target.value)}
                                    placeholder="예: 국어, 진로캠프"
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
                                placeholder="예: 축구는 단체 경기가 아닌 개인별 수행 내용을 기준으로 작성해 주세요."
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
                                <option value="1500">1500byte (한글 약 490자)</option>
                                <option value="1000">1000byte (한글 약 333자)</option>
                                <option value="600">600byte (한글 약 200자)</option>
                                <option value="manual">직접 입력</option>
                            </select>
                            {textLength === "manual" && (
                                <input
                                    type="number"
                                    value={manualLength}
                                    onChange={(e) => setManualLength(e.target.value)}
                                    placeholder="byte 단위 입력 (예: 800)"
                                    className="form-input mt-2"
                                />
                            )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">AI 모델</label>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="form-select"
                            >
                                {AVAILABLE_MODELS.map((m) => (
                                    <option key={m.id} value={m.id}>{getModelOptionLabel(m)}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2">
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
                                        <Wand2 size={20} /> AI 생성
                                    </>
                                )}
                            </button>
                            <button
                                onClick={downloadExcel}
                                className="btn-secondary"
                                style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Download size={20} /> 엑셀
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

                                    <div className="flex gap-2 justify-center" style={{ marginTop: 'auto' }}>
                                        {["A", "B", "C"].map((grade) => (
                                            <button
                                                key={grade}
                                                onClick={() => updateStudent(student.id, "grade", grade)}
                                                className={`btn-grade ${student.grade === grade ? `selected grade-${grade}` : ''}`}
                                            >
                                                {grade}
                                            </button>
                                        ))}
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
                                                    setCopiedId(student.id);
                                                    setTimeout(() => setCopiedId(null), 1500);
                                                }}
                                                className={`btn-copy ${copiedId === student.id ? 'copied' : ''}`}
                                                title="클립보드에 복사"
                                            >
                                                {copiedId === student.id ? (
                                                    <><Check size={14} /> 복사됨!</>
                                                ) : (
                                                    <><Copy size={14} /> 복사</>
                                                )}
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
