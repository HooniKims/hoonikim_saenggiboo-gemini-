export function shouldSelectRandomFourActivities(additionalInstructions = "") {
    const normalized = String(additionalInstructions || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) return false;

    const mentionsActivities = /활동/.test(normalized);
    const mentionsFour = /4\s*개/.test(normalized);
    const mentionsRandom = /(랜덤|무작위|임의)/.test(normalized);
    const mentionsSelection = /(선택|선별|추출|고르|골라|뽑)/.test(normalized);

    return mentionsActivities && mentionsFour && mentionsRandom && mentionsSelection;
}

export function limitActivitiesByTargetChars(selectedActivities, targetChars) {
    if (targetChars < 80) {
        return selectedActivities.slice(0, 1);
    }
    if (targetChars <= 150) {
        return selectedActivities.slice(0, Math.min(2, selectedActivities.length));
    }
    if (targetChars <= 250) {
        return selectedActivities.slice(0, Math.min(3, selectedActivities.length));
    }
    if (targetChars <= 350) {
        return selectedActivities.slice(0, Math.min(4, selectedActivities.length));
    }
    return selectedActivities;
}
