import { interpolatePlaceholders } from "../placeholderInterpolation";

describe("interpolatePlaceholders", () => {
    it("returns empty string when message is undefined", () => {
        expect(interpolatePlaceholders(undefined, { Name: "York" })).toBe("");
    });

    it("returns message as-is when placeholders are missing", () => {
        expect(interpolatePlaceholders("Hello {Name}")).toBe("Hello {Name}");
    });

    it("replaces placeholders with values", () => {
        const result = interpolatePlaceholders("Hello {Name}", { Name: "York" });
        expect(result).toBe("Hello York");
    });

    it("replaces multiple occurrences of the same placeholder", () => {
        const result = interpolatePlaceholders("{Name} and {Name}", { Name: "York" });
        expect(result).toBe("York and York");
    });

    it("leaves unknown placeholders intact", () => {
        const result = interpolatePlaceholders("Hello {Name} {Town}", { Name: "York" });
        expect(result).toBe("Hello York {Town}");
    });
});
