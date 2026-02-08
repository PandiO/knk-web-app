export const interpolatePlaceholders = (
    message: string | undefined,
    placeholders?: Record<string, string>
): string => {
    if (!message) {
        return "";
    }

    if (!placeholders) {
        return message;
    }

    let result = message;
    Object.entries(placeholders).forEach(([key, value]) => {
        const safeValue = value ?? "";
        result = result.replace(new RegExp(`\\{${key}\\}`, "g"), safeValue);
    });

    return result;
};
