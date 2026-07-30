import { isUpstageModel } from "./streamFetch.js";

export async function fetchUpstageCompletion({ prompt, additionalInstructions, targetChars, model, outputType = "record" }) {
    const selectedModel = isUpstageModel(model)
        ? String(model).replace(/^upstage:/, "")
        : undefined;
    const response = await fetch("/api/upstage-generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt,
            additionalInstructions,
            targetChars,
            model: selectedModel,
            outputType,
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || `Upstage API 오류 (${response.status})`);
    }

    return data.result || "";
}
