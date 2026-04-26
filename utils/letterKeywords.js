const DEFAULT_LETTER_KEYWORDS = "학업, 건강, 친구관계, 가족관계";

export function parseKeywordList(keywords) {
    return String(keywords || DEFAULT_LETTER_KEYWORDS)
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean);
}

export function shuffleKeywordList(keywords, random = Math.random) {
    const shuffled = [...keywords];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function buildShuffledKeywordContext(keywords, random = Math.random) {
    const parsedKeywords = parseKeywordList(keywords);
    const shuffledKeywords = shuffleKeywordList(parsedKeywords, random);
    return `입력된 키워드: ${shuffledKeywords.join(", ")}`;
}
