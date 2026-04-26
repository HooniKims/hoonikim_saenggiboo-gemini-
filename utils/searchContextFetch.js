export async function fetchSearchContext({ subjectName, commonActivities, individualActivity }) {
    if (!individualActivity?.trim()) {
        return { context: "", sources: [], query: "" };
    }

    const response = await fetch("/api/search-context", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            subjectName,
            commonActivities,
            individualActivity,
        }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `검색 보강 오류 (${response.status})`);
    }

    return {
        context: data.context || "",
        sources: data.sources || [],
        query: data.query || "",
    };
}
