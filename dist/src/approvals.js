export const denyApproval = async () => false;
export function approvalPreview(request) {
    const details = request.details;
    const input = details?.input;
    if (input && typeof input === "object") {
        const lines = [];
        if (details?.reason)
            lines.push(`Lý do: ${details.reason}`);
        if (typeof input.file_path === "string")
            lines.push(`File: ${input.file_path}`);
        if (typeof input.command === "string")
            lines.push(`Lệnh: ${input.command}`);
        if (typeof input.content === "string")
            lines.push(`Nội dung sẽ ghi:\n${input.content}`);
        if (typeof input.old_string === "string")
            lines.push(`Thay đoạn:\n${input.old_string}`);
        if (typeof input.new_string === "string")
            lines.push(`Bằng:\n${input.new_string}`);
        // Include additional arguments: an approval must never hide action parameters.
        const remaining = Object.fromEntries(Object.entries(input).filter(([key]) => !["file_path", "command", "content", "old_string", "new_string"].includes(key)));
        if (Object.keys(remaining).length)
            lines.push(JSON.stringify(remaining, null, 2));
        return lines.join("\n");
    }
    return JSON.stringify(request.details, null, 2) ?? "";
}
//# sourceMappingURL=approvals.js.map