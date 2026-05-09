import { describe, expect, it } from "vitest";
import { formatGatewayErrorBody } from "../src/lib/format-gateway-error-body.js";

describe("formatGatewayErrorBody", () => {
  it("returns a friendly hint for an empty body", () => {
    expect(formatGatewayErrorBody("")).toBe("No error details were returned.");
    expect(formatGatewayErrorBody("  \n  ")).toBe("No error details were returned.");
  });

  it("extracts Nest-style message string", () => {
    const body = JSON.stringify({
      statusCode: 400,
      message: "Agent not found",
      error: "Bad Request",
    });
    expect(formatGatewayErrorBody(body)).toBe("Agent not found");
  });

  it("joins Nest-style message array", () => {
    const body = JSON.stringify({
      statusCode: 400,
      message: ["a is required", "b must be a string"],
      error: "Bad Request",
    });
    expect(formatGatewayErrorBody(body)).toBe("a is required; b must be a string");
  });

  it("formats class-validator style entries", () => {
    const body = JSON.stringify({
      statusCode: 400,
      message: [
        {
          property: "email",
          constraints: { isEmail: "email must be an email" },
        },
      ],
      error: "Bad Request",
    });
    expect(formatGatewayErrorBody(body)).toBe("email: email must be an email");
  });

  it("uses nested message object when present", () => {
    const body = JSON.stringify({
      message: { message: "Inner failure" },
    });
    expect(formatGatewayErrorBody(body)).toBe("Inner failure");
  });

  it("uses string error field when message is missing", () => {
    const body = JSON.stringify({ statusCode: 401, error: "Unauthorized" });
    expect(formatGatewayErrorBody(body)).toBe("Unauthorized");
  });

  it("uses RFC7807 detail when present", () => {
    const body = JSON.stringify({ type: "about:blank", title: "Conflict", detail: "Name already taken" });
    expect(formatGatewayErrorBody(body)).toBe("Name already taken");
  });

  it("collapses non-JSON text", () => {
    expect(formatGatewayErrorBody("Something went wrong.\n\nPlease retry.")).toBe(
      "Something went wrong. Please retry.",
    );
  });
});
