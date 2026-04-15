import { describe, expect, test } from "bun:test";
import { transformCodexRequestBody } from "./fetch";

describe("transformCodexRequestBody", () => {
  test("normalizes GPT-5.4 requests to a Codex-supported model and injects instructions", () => {
    const result = transformCodexRequestBody({
      model: "gpt-5.4",
      input: [
        {
          id: "msg_1",
          type: "message",
          role: "developer",
          content: [{ type: "input_text", text: "Follow the repo rules." }],
        },
        {
          id: "msg_2",
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Fix the bug." }],
        },
      ],
      include: [],
      store: true,
    });

    expect(result.normalizedModel).toBe("gpt-5.1");
    expect(result.body.model).toBe("gpt-5.1");
    expect(result.body.instructions).toBe("Follow the repo rules.");
    expect(result.body.store).toBe(false);
    expect(result.body.include).toEqual(["reasoning.encrypted_content"]);
    expect(result.body.input?.[0]).not.toHaveProperty("id");
    expect(result.body.input?.[1]).not.toHaveProperty("id");
  });

  test("maps codex-flavored models to codex backends", () => {
    const result = transformCodexRequestBody({
      model: "openai/gpt-5-codex",
      input: [],
    });

    expect(result.normalizedModel).toBe("gpt-5.1-codex");
    expect(result.body.model).toBe("gpt-5.1-codex");
  });
});
