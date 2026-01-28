"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Upload, Download, Wand2, FileSpreadsheet, Users, UserX } from "lucide-react";
import * as XLSX from "xlsx";
import { writeExcel } from "../../utils/excel";

export default function GwasetukPage() {
    // State
    const [studentCount, setStudentCount] = useState(1);
    const [isManualInput, setIsManualInput] = useState(false);
    const [manualCountValue, setManualCountValue] = useState("");

    const [subjectName, setSubjectName] = useState("");
    const [schoolLevel, setSchoolLevel] = useState("middle"); // elementary, middle, high

    const [students, setStudents] = useState([{ id: 1, name: "", grade: "A", individualActivity: "", result: "", status: "idle" }]);
    const [activities, setActivities] = useState([""]);
    const [additionalInstructions, setAdditionalInstructions] = useState("");
    const [textLength, setTextLength] = useState("1500"); // 1500, 1000, 600, manual
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

            // 1. Find the header row and columns
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                for (let j = 0; j < row.length; j++) {
                    const cellValue = String(row[j]).trim().replace(/\s/g, ""); // Remove spaces
                    if (cellValue === "성명" || cellValue === "이름") {
                        nameColIndex = j;
                        headerRowIndex = i;
                    }
                    // 활동 내용 열 인식 (세부능력 및 특기사항 포함)
                    if (cellValue.includes("활동") || cellValue.includes("내용") ||
                        cellValue.includes("관찰내용") || cellValue.includes("관찰기록") ||
                        cellValue.includes("세부능력") || cellValue.includes("특기사항") ||
                        cellValue.includes("세특") || cellValue.includes("개별활동")) {
                        activityColIndex = j;
                    }
                }
                if (nameColIndex !== -1) break;
            }

            const newStudents = [];
            let idCounter = 1;

            // 2. Extract names and activities if column found
            if (nameColIndex !== -1) {
                console.log(`[엑셀 파싱] nameColIndex: ${nameColIndex} activityColIndex: ${activityColIndex} headerRowIndex: ${headerRowIndex}`);

                for (let i = headerRowIndex + 1; i < data.length; i++) {
                    const row = data[i];
                    const name = row[nameColIndex];
                    const activity = activityColIndex !== -1 ? row[activityColIndex] : "";

                    if (name && typeof name === 'string' && name.trim() !== "") {
                        const activityText = activity ? String(activity).trim() : "";
                        console.log(`[엑셀 파싱] 학생: ${name.trim()} 활동내용: ${activityText}`);

                        newStudents.push({
                            id: idCounter++,
                            name: name.trim(),
                            grade: "A",
                            individualActivity: activityText,
                            result: "",
                            status: "idle"
                        });
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

    };

    // 클립보드 복사 함수
    const copyToClipboard = async (studentId, text) => {
        if (!text) return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for non-secure contexts
                const textArea = document.createElement("textarea");
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            // 피드백 표시
            updateStudent(studentId, "copyFeedback", true);
            setTimeout(() => {
                updateStudent(studentId, "copyFeedback", false);
            }, 1500);
        } catch (err) {
            console.error('복사 실패:', err);
            alert('복사에 실패했습니다.');
        }
    };

    // 키워드 매칭으로 유사도 계산 (학생别 활동과 공통 활동 간의 관련성 점수)
    const calculateRelevanceScore = (commonActivity, individualActivity) => {
        if (!individualActivity || !commonActivity) return 0;

        const individualKeywords = individualActivity.toLowerCase().split(/[\s,]+/);
        const commonKeywords = commonActivity.toLowerCase().split(/[\s,]+/);

        let score = 0;
        for (const keyword of individualKeywords) {
            if (keyword.length > 1 && commonKeywords.some(ck => ck.includes(keyword) || keyword.includes(ck))) {
                score++;
            }
        }
        return score;
    };

    const generatePrompt = (student, selectedActivities, targetChars, individualActivity, additionalInstructions) => {
        const gradePrompts = {
            A: `// A등급 프롬프트\n등급: A (탁월함)\n이 학생은 학업 역량과 자기주도성이 매우 뛰어난 학생입니다.\n활동의 깊이와 수준이 높으며, 심화된 탐구와 융합적 사고가 잘 드러나도록 작성하세요.`,
            B: `// B등급 프롬프트\n등급: B (우수함)\n이 학생은 주어진 과제를 성실히 수행하고 우수한 학업 역량을 보여주는 학생입니다.\nA등급보다는 최상급 표현(탁월함, 매우 뛰어남 등)을 줄이고, 과제를 잘 완수하고 성실히 참여했다는 점을 중심으로 작성하세요.`,
            C: `// C등급 프롬프트\n등급: C (노력요함/발전가능성)\n학생의 활동 중 잘한 점과 다소 아쉬운 점을 균형 있게 서술하세요.\n참여도나 흥미를 보인 부분은 칭찬하고, 부족한 부분은 구체적인 조언이나 향후 노력 방향을 제시하는 방식으로 작성하세요.\n단순히 부족함을 지적하기보다, 긍정적인 변화 가능성을 열어두는 어조를 유지하세요.`
        };

        let minChar, maxChar;

        if (targetChars === 200) {
            // 600byte (approx 200 chars) specific logic
            if (student.grade === 'A') { minChar = 190; maxChar = 200; }
            else if (student.grade === 'B') { minChar = 170; maxChar = 189; }
            else { minChar = 150; maxChar = 169; }
        } else if (targetChars === 500) {
            // 1500byte (approx 500 chars) specific logic
            if (student.grade === 'A') { minChar = 480; maxChar = 500; }
            else if (student.grade === 'B') { minChar = 430; maxChar = 479; }
            else { minChar = 350; maxChar = 429; }
        } else {
            // Dynamic scaling for other lengths
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

        const schoolLevelMap = {
            elementary: "초등학생",
            middle: "중학생",
            high: "고등학생"
        };
        const targetLevel = schoolLevelMap[schoolLevel] || "중학생";
        const subjectContext = subjectName ? `과목/프로그램명: ${subjectName}` : "과목/프로그램명: 미지정 (일반적인 교과 또는 창체 활동으로 간주)";

        // 공통 활동과 학생별 개별 활동 조합
        let activitiesText = selectedActivities.map(a => `- ${a}`).join("\n");
        const individualActivityText = individualActivity && individualActivity.trim() !== ""
            ? `\n\n## 이 학생의 개별 활동 (특히 강조해서 작성할 것):\n- ${individualActivity}`
            : "";

        return `
당신은 이제 최고 수준의 교육학 전문관 및 진로 교사입니다.
학생들의 과목별 세부능력 및 특기사항(과세특)을 작성하는 업무를 맡고 있습니다.
제공된 활동 내용과 학생의 성취도 등급을 바탕으로, 학교생활기록부에 기재될 전문적이고 구체적인 평가 내용을 작성해야 합니다.

대상 학교급: ${targetLevel}
${subjectContext}

## 핵심 원칙
- 오직 활동 내용만 서술하고, 마무리/요약/정리 문장은 절대 작성하지 않음
- 자기주도성, 심화 및 융합 역량, 과정 중심 서술
- 역량 평가 기준: 학업 역량, 진로 역량, 공동체 역량

## 작성 주의사항
1. '학생은', '이 학생은' 등의 주어 사용 금지. 문장은 주어 없이 서술어로 시작하거나 활동을 주어로 할 것.
2. 과목명이나 프로그램명을 서두에 직접 언급하지 말고, 바로 활동 내용에 대한 서술로 시작할 것.
3. 개별적 관찰 기록, 반드시 명사형 종결어미(~함, ~임 등) 사용, ${targetLevel} 수준에 맞는 어휘와 표현 사용.
4. 입력된 활동 내용 외 절대 날조 금지.

## ⛔ 절대 금지 (마무리 문장)
다음 표현들은 절대 사용하지 마세요: '이러한', '이를 통해', '이와 같이', '이런', '앞으로', '향후', '결과적으로', '종합적으로'
**마지막 문장도 반드시 구체적인 활동 내용이나 학습 과정에 대한 서술이어야 합니다.**

입력된 공통 활동 내용:
${activitiesText}
${individualActivityText}

${gradePrompts[student.grade]}
${lengthInstruction}

**절대 분석 내용이나 검증 포인트를 출력하지 마세요. 오직 세특 본문만 출력하세요.**
**절대로 "(자세한 내용 포함, 330자)", "(약 500자)", "--- 330자" 같은 글자수나 메타 정보를 출력하지 마세요.**
**오직 순수한 세특 본문 텍스트만 출력하세요. 어떤 부가 설명도 없이 본문만 출력합니다.**
${additionalInstructions && additionalInstructions.trim() !== "" ? `
【🚨 특별 지시 - 반드시 적용 🚨】
→ "${additionalInstructions}"
위 지침은 다른 모든 규칙보다 우선하여 반드시 엄격히 준수해야 합니다.
` : ""}
    `;
    };

    const generateForStudent = async (student) => {
        const validActivities = activities.filter(a => a.trim() !== "");
        if (validActivities.length === 0) return;

        // Calculate Target Chars
        let targetChars = 500;
        if (textLength === "1500") targetChars = 500;
        else if (textLength === "1000") targetChars = 330;
        else if (textLength === "600") targetChars = 200;
        else if (textLength === "manual") targetChars = parseInt(manualLength) || 500;

        // 학생별 개별 활동이 있으면 관련성 점수를 계산하여 공통 활동 정렬
        const individualActivity = student.individualActivity || "";
        let sortedActivities;

        // 추가 지침에 '랜덤' 또는 '무작위' 키워드가 있으면 활동 셔플
        const shouldShuffle = additionalInstructions &&
            (additionalInstructions.includes('랜덤') || additionalInstructions.includes('무작위'));

        if (shouldShuffle) {
            // 랜덤 셔플 - AI가 위에서부터 선택해도 결과적으로 랜덤 효과
            sortedActivities = [...validActivities].sort(() => 0.5 - Math.random());
        } else if (individualActivity.trim() !== "") {
            // 학생별 활동과 관련성이 높은 공통 활동을 우선 선택
            sortedActivities = [...validActivities].sort((a, b) => {
                const scoreA = calculateRelevanceScore(a, individualActivity);
                const scoreB = calculateRelevanceScore(b, individualActivity);
                return scoreB - scoreA; // 높은 점수가 먼저 오도록
            });
        } else {
            // 개별 활동이 없으면 입력 순서 유지
            sortedActivities = [...validActivities];
        }

        let selectedActivities = sortedActivities;

        // Activity Selection Logic based on Target Chars - 강화된 로직
        if (targetChars < 80) {
            // 매우 짧으면 1개만 선택
            selectedActivities = sortedActivities.slice(0, 1);
        } else if (targetChars <= 150) {
            // 150자 이하: 최대 2개
            selectedActivities = sortedActivities.slice(0, Math.min(2, sortedActivities.length));
        } else if (targetChars <= 250) {
            // 250자 이하: 최대 3개
            selectedActivities = sortedActivities.slice(0, Math.min(3, sortedActivities.length));
        } else if (targetChars <= 350) {
            // 350자 이하 (1000byte): 최대 4개
            selectedActivities = sortedActivities.slice(0, Math.min(4, sortedActivities.length));
        }
        // 350자 초과: 모든 활동 사용

        const prompt = generatePrompt(student, selectedActivities, targetChars, individualActivity, additionalInstructions);

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
                        <hr className="border-gray-200 my-2" />
                        <div className="form-group mb-0">
                            <label className="form-label" style={{ color: '#dc2626' }}>⚠️ 추가 지침 사항 (최우선 적용)</label>
                            <textarea
                                value={additionalInstructions}
                                onChange={(e) => setAdditionalInstructions(e.target.value)}
                                placeholder="예: 축구는 단체 경기가 아닌 개인별 수행 내용을 기준으로 작성해 주세요."
                                className="form-input"
                                style={{
                                    fontSize: '0.9rem',
                                    minHeight: '60px',
                                    resize: 'vertical',
                                    borderColor: '#fecaca',
                                    backgroundColor: '#fef2f2'
                                }}
                                rows={2}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
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

                                    {/* Individual Activity Textarea */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-500 ml-1">학생별 개별 활동</label>
                                        <textarea
                                            value={student.individualActivity}
                                            onChange={(e) => updateStudent(student.id, "individualActivity", e.target.value)}
                                            placeholder="학생별 개별적으로 활동한 내용을 입력해주세요."
                                            className="form-input"
                                            style={{ fontSize: '0.9rem', minHeight: '60px', resize: 'vertical' }}
                                            rows={2}
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

                                        {/* Copy Button */}
                                        {student.result && (
                                            <button
                                                onClick={() => copyToClipboard(student.id, student.result)}
                                                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-md text-xs font-bold transition-all"
                                                style={{
                                                    backgroundColor: student.copyFeedback ? '#10b981' : '#f3f4f6',
                                                    color: student.copyFeedback ? 'white' : '#4b5563',
                                                    border: '1px solid',
                                                    borderColor: student.copyFeedback ? '#10b981' : '#d1d5db',
                                                    zIndex: 10
                                                }}
                                            >
                                                {student.copyFeedback ? '복사됨!' : '복사'}
                                            </button>
                                        )}

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
