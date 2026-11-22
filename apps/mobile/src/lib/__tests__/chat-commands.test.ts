import { describe, expect, it } from "vitest";

import { matchCommandSuggestions, parseChatCommand } from "../chat-commands";

describe("parseChatCommand", () => {
  it("strips a known leading command and marks the message silent", () => {
    const parsed = parseChatCommand("/imlang xin chào");

    expect(parsed.body).toBe("xin chào");
    expect(parsed.effects.silent).toBe(true);
    expect(parsed.command?.name).toBe("imlang");
  });

  it("is case-insensitive and handles a bare command", () => {
    expect(parseChatCommand("/IMLANG").command?.name).toBe("imlang");
    expect(parseChatCommand("/imlang").body).toBe("");
  });

  it("leaves unknown commands and mid-text slashes as plain text", () => {
    expect(parseChatCommand("/unknown hi")).toEqual({ body: "/unknown hi", command: null, effects: {} });
    expect(parseChatCommand("hi /imlang")).toEqual({ body: "hi /imlang", command: null, effects: {} });
    expect(parseChatCommand("/imlangx hi").command).toBeNull();
  });
});

describe("matchCommandSuggestions", () => {
  it("suggests by prefix only while the name is being typed", () => {
    expect(matchCommandSuggestions("/")).toHaveLength(1);
    expect(matchCommandSuggestions("/im")[0]?.name).toBe("imlang");
    expect(matchCommandSuggestions("/x")).toEqual([]);
    expect(matchCommandSuggestions("/imlang hi")).toEqual([]);
    expect(matchCommandSuggestions("hello")).toEqual([]);
  });
});
