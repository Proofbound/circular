const fs = require("fs");
const path = require("path");

module.exports = function () {
  const dir = path.join(__dirname, "..", "..", "assets", "authors");
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".md"))
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!match) return null;

      // Parse YAML frontmatter (simple key: value)
      const meta = {};
      match[1].split("\n").forEach(line => {
        const m = line.match(/^(\w+):\s*"?(.+?)"?\s*$/);
        if (m) meta[m[1]] = m[2];
      });

      // Extract body paragraphs (skip the # heading and **Column:** line)
      const body = match[2]
        .split("\n")
        .filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("**Column:**"))
        .join("\n\n");

      return {
        name: meta.title || "",
        role: meta.role || "",
        column: meta.column || "",
        slug: meta.slug || "",
        bio: body,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Eleanora Sefton always last; otherwise alphabetical
      const aLast = a.slug === "eleanora-sefton" ? 1 : 0;
      const bLast = b.slug === "eleanora-sefton" ? 1 : 0;
      if (aLast !== bLast) return aLast - bLast;
      return a.name.localeCompare(b.name);
    });
};
