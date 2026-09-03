import test from "node:test";
import assert from "node:assert/strict";

function restoreEnv(name, value) {
    if (value === undefined) {
        delete process.env[name];
        return;
    }
    process.env[name] = value;
}

test("local LLM configuration honors Netlify public environment variables", async () => {
    // Given
    const originalUrl = process.env.NEXT_PUBLIC_LMSTUDIO_API_URL;
    const originalApiKey = process.env.NEXT_PUBLIC_LMSTUDIO_API_KEY;
    process.env.NEXT_PUBLIC_LMSTUDIO_API_URL = "https://configured.example";
    process.env.NEXT_PUBLIC_LMSTUDIO_API_KEY = "configured-key";

    try {
        // When
        const { getLocalModelConfig } = await import("../utils/streamFetch.js?netlify-env-test");
        const config = getLocalModelConfig("lmstudio:gemma-4-12b-it");

        // Then
        assert.equal(config.apiUrl, "https://configured.example");
        assert.equal(config.apiKey, "configured-key");
    } finally {
        restoreEnv("NEXT_PUBLIC_LMSTUDIO_API_URL", originalUrl);
        restoreEnv("NEXT_PUBLIC_LMSTUDIO_API_KEY", originalApiKey);
    }
});
