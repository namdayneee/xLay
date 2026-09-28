// Small terminal renderer: never strip Markdown markers from code or literal text.
export function renderMarkdown(text, color = Boolean(process.stdout.isTTY)) {
    const style = (value, open, close) => color ? `\u001b[${open}m${value}\u001b[${close}m` : value;
    function inline(value) {
        let result = "";
        for (let i = 0; i < value.length;) {
            const rest = value.slice(i);
            const escaped = /^\\([\\`*_{}\[\]()#+.!>~-])/.exec(rest);
            if (escaped) {
                result += escaped[1];
                i += escaped[0].length;
                continue;
            }
            const ticks = /^`+/.exec(rest)?.[0];
            if (ticks) {
                const end = value.indexOf(ticks, i + ticks.length);
                if (end !== -1) {
                    result += style(value.slice(i + ticks.length, end), 36, 39);
                    i = end + ticks.length;
                    continue;
                }
            }
            const link = /^\[([^\]]+)\]\(([^\s]+?)\)/.exec(rest);
            if (link) {
                result += `${inline(link[1])} (${link[2]})`;
                i += link[0].length;
                continue;
            }
            let matched = false;
            for (const [marker, open, close] of [
                ["***", 1, 22], ["**", 1, 22], ["__", 1, 22],
                ["~~", 9, 29], ["*", 3, 23], ["_", 3, 23],
            ]) {
                if (!rest.startsWith(marker) || /\s/.test(rest[marker.length] || " "))
                    continue;
                // Underscores inside identifiers and paths are literal.
                if (marker.includes("_") && i > 0 && /[\p{L}\p{N}_]/u.test(value[i - 1]))
                    continue;
                const end = value.indexOf(marker, i + marker.length);
                if (end <= i + marker.length || /\s/.test(value[end - 1]))
                    continue;
                if (marker.includes("_") && /[\p{L}\p{N}_]/u.test(value[end + marker.length] || ""))
                    continue;
                const content = inline(value.slice(i + marker.length, end));
                result += marker === "***" ? style(style(content, 3, 23), 1, 22) : style(content, open, close);
                i = end + marker.length;
                matched = true;
                break;
            }
            if (!matched)
                result += value[i++];
        }
        return result;
    }
    let fence;
    const lines = [];
    for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
        if (fence) {
            const closing = /^ {0,3}(`+|~+)\s*$/.exec(line);
            if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
                fence = undefined;
            }
            else {
                lines.push(style(line, 36, 39));
            }
            continue;
        }
        const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (opening) {
            fence = { marker: opening[1][0], length: opening[1].length };
            continue;
        }
        // Indented code is also literal, including indentation.
        if (/^( {4}|\t)/.test(line)) {
            lines.push(line);
            continue;
        }
        const heading = /^ {0,3}#{1,6}\s+(.+?)(?:\s+#+\s*)?$/.exec(line);
        if (heading) {
            lines.push(style(inline(heading[1]), 1, 22));
            continue;
        }
        if (/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) {
            lines.push(style("─".repeat(24), 2, 22));
            continue;
        }
        const bullet = /^( {0,3})[-*+]\s+(.*)$/.exec(line);
        if (bullet) {
            lines.push(`${bullet[1]}• ${inline(bullet[2])}`);
            continue;
        }
        const quote = /^ {0,3}>\s?(.*)$/.exec(line);
        lines.push(quote ? `│ ${inline(quote[1])}` : inline(line));
    }
    return lines.join("\n");
}
export function printResponse(text) {
    const rendered = renderMarkdown(text);
    process.stdout.write(rendered.endsWith("\n") ? rendered : `${rendered}\n`);
}
//# sourceMappingURL=markdown.js.map