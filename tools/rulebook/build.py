"""Build the in-app rulebook from the official rulebook PDFs.

usage: python3 tools/rulebook/build.py [book ...]

Reads the word-for-word text in tools/rulebook/<book>.txt and the crop list
in crops.txt, then writes rulebook/<book>.html, the illustrations in
images/rulebook/ (cropped from the PDFs in pdfs/, rendered with poppler's
pdftoppm and cut with ImageMagick) and rulebook/precache.js for sw.js.

Markup, one block per line or paragraph:
  # Chapter                 == Letter heading
  ## Entry | page | id      ### Subheading      #### Minor heading
  - bullet  (- – sub-bullet)    (1) / 1. / a. numbered item
  ex: example (blue)   note: note (italic)   > indented   | table | row |
  img: crop-name | alt text | side or full     --- clear floats
  [[Entry]] or [[label|Entry]] links to an entry (the book's ✷ marker)
  **bold**  *italic*    // comment    aka: Other Name -> Entry
"""
import hashlib
import html
import os
import re
import subprocess
import sys
import tempfile

here = os.path.dirname(os.path.abspath(__file__))
src_dir = here
repo = os.path.dirname(os.path.dirname(here))
render_dir = os.path.join(tempfile.gettempdir(), "catan-rulebook-renders")
img_out = os.path.join(repo, "images", "rulebook")
os.makedirs(img_out, exist_ok=True)
os.makedirs(os.path.join(repo, "rulebook"), exist_ok=True)
os.makedirs(render_dir, exist_ok=True)

PDFS = {
    "base": "pdfs/catan-base-rules.pdf",
    "b56": "pdfs/catan-base-5-6-players.pdf",
    "ck": "pdfs/cities-and-knights-rules.pdf",
    "ck56": "pdfs/cities-and-knights-5-6-players.pdf",
}

# ----- Crops -----
# crops.txt lines: name pdfkey page x0 y0 x1 y1   (pixels at 100 dpi)
sizes = {}
versions = {}
for line in open(os.path.join(src_dir, "crops.txt")):
    # A comment starts a line or follows a space, so bg=#fff48a stays a color
    line = re.split(r"(?:^|\s)#", line)[0].strip()
    if not line:
        continue
    fields = line.split()
    name, key, page, x0, y0, x1, y1 = fields[:7]
    # Optional mask: keep only this polygon (and keep= rectangles), painting
    # the rest in the page color. Points are in the crop's 100 dpi pixels.
    opts = dict(f.split("=", 1) for f in fields[7:])
    page = int(page)
    x0, y0, x1, y1 = (int(v) * 2 for v in (x0, y0, x1, y1))
    render = os.path.join(render_dir, f"{key}-{page:02d}.png")
    if not os.path.exists(render):
        base = os.path.join(render_dir, f"tmp-{key}")
        subprocess.run(["pdftoppm", "-r", "200", "-f", str(page), "-l", str(page),
                        "-png", "-singlefile", os.path.join(repo, PDFS[key]), base], check=True)
        os.rename(base + ".png", render)
    out = os.path.join(img_out, name + ".webp")
    subprocess.run(["magick", render, "-crop", f"{x1 - x0}x{y1 - y0}+{x0}+{y0}", "+repage",
                    "-quality", "80", out], check=True)
    if "poly" in opts:
        pts = " ".join(f"{int(a) * 2},{int(b) * 2}" for a, b in
                       (pt.split(",") for pt in opts["poly"].split(";")))
        draws = ["-draw", f"polygon {pts}"]
        for rect in opts.get("keep", "").split(";"):
            if rect:
                a, b, c, d = (int(v) * 2 for v in rect.split(","))
                draws += ["-draw", f"rectangle {a},{b},{c},{d}"]
        w, h = x1 - x0, y1 - y0
        color = opts.get("bg", "#fef8b4")
        subprocess.run(["magick", out, "(", "-size", f"{w}x{h}", "xc:black", "-fill", "white",
                        *draws, ")", "-alpha", "off", "-compose", "copy-opacity", "-composite",
                        "-background", color, "-compose", "over", "-flatten", "-quality", "80", out], check=True)
    sizes[name] = (x1 - x0, y1 - y0)
    # A changed illustration gets a new address (?v=), so the app's
    # offline cache can't keep showing the old one
    versions[name] = hashlib.sha1(open(out, "rb").read()).hexdigest()[:8]


def slug(text):
    text = text.lower().replace("&", "and")
    text = re.sub(r"[“”\"'’‘()]", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def norm(text):
    return slug(text)


# ----- Markup -----
def build(book):
    lines = open(os.path.join(src_dir, book + ".txt")).read().split("\n")
    titles = {}      # normalized title -> id
    for line in lines:
        m = re.match(r"^## (.+?)\s*\|\s*([^|]*?)(?:\s*\|\s*(\S+))?\s*$", line)
        if m:
            eid = f"{book}-" + (m.group(3) or slug(m.group(1)))
            # An entry with its own id only claims its title if nothing else
            # has; a plain entry always does (the Almanac's, say, over the
            # Game Rules' section of the same name)
            if not m.group(3) or norm(m.group(1)) not in titles:
                titles[norm(m.group(1))] = eid
    # aliases: "aka: Text -> Title"
    for line in lines:
        m = re.match(r"^aka: (.+?) -> (.+)$", line)
        if m:
            target = titles.get(norm(m.group(2)))
            if not target:
                sys.exit(f"{book}: alias target not found: {m.group(2)}")
            titles[norm(m.group(1))] = target

    errors = []

    def inline(text):
        text = html.escape(text, quote=False)

        def xref(m):
            label, target = m.group(1), m.group(2) or m.group(1)
            eid = titles.get(norm(target))
            if not eid:
                errors.append(target)
                return label
            return f'<a class="rulebook-xref" href="#{eid}">{label}</a>'

        text = re.sub(r"\[\[(.+?)(?:\|(.+?))?\]\]", xref, text)
        text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
        text = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", text)
        return text

    out = []
    contents = []    # (chapter title, chapter id, [(title, id)])
    in_entry = False
    in_chapter = False
    para = []
    list_kind = None

    def flush():
        nonlocal para
        if para:
            text = " ".join(para)
            cls = ""
            for prefix, c in (("ex: ", "rulebook-example"), ("note: ", "rulebook-note"),
                              ("> ", "rulebook-indent"), ("center: ", "rulebook-center")):
                if text.startswith(prefix):
                    text, cls = text[len(prefix):], c
                    break
            attr = f' class="{cls}"' if cls else ""
            out.append(f"<p{attr}>{inline(text)}</p>")
            para = []

    def end_list():
        nonlocal list_kind
        if out and out[-1].endswith("</tr>"):
            out.append("</table></div>")
        if list_kind:
            out.append("</ul>" if list_kind == "ul" else "</ol>")
            list_kind = None

    def end_entry():
        nonlocal in_entry
        flush()
        end_list()
        if in_entry:
            out.append("</article>")
            in_entry = False

    def end_chapter():
        nonlocal in_chapter
        end_entry()
        if in_chapter:
            out.append("</section>")
            in_chapter = False

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("aka: ") or line.startswith("//"):
            continue
        if line.startswith("# "):
            end_chapter()
            title = line[2:].strip()
            cid = f"{book}-ch-{slug(title)}"
            contents.append((title, cid, []))
            out.append(f'<section class="rulebook-chapter" id="{cid}">')
            out.append(f'<h3 class="rulebook-chapter-title">{inline(title)}</h3>')
            in_chapter = True
            continue
        if line.startswith("== "):
            end_entry()
            out.append(f'<div class="rulebook-letter">{line[3:].strip()}</div>')
            continue
        m = re.match(r"^## (.+?)\s*\|\s*([^|]*?)(?:\s*\|\s*(\S+))?\s*(?:\|.*)?$", line)
        if line.startswith("## ") and m:
            end_entry()
            title, page = m.group(1), m.group(2)
            eid = f"{book}-" + (m.group(3) or slug(title))
            contents[-1][2].append((title, eid))
            out.append(f'<article class="rulebook-entry" id="{eid}" data-title="{html.escape(title)}">')
            chip = f'<span class="rulebook-page">p. {page}</span>' if page else ""
            out.append(f'<div class="rulebook-entry-head"><h4>{inline(title)}</h4>{chip}</div>')
            in_entry = True
            continue
        if line.startswith("### "):
            flush(); end_list()
            out.append(f"<h5>{inline(line[4:].strip())}</h5>")
            continue
        if line.startswith("#### "):
            flush(); end_list()
            out.append(f"<h6>{inline(line[5:].strip())}</h6>")
            continue
        if line.startswith("img: "):
            flush(); end_list()
            parts = [p.strip() for p in line[5:].split("|")]
            name, alt = parts[0], parts[1]
            mode = parts[2] if len(parts) > 2 else "full"
            if name not in sizes:
                sys.exit(f"{book}: no crop named {name}")
            w, h = sizes[name]
            out.append(
                f'<figure class="rulebook-figure is-{mode}"><button class="rulebook-zoom" type="button" '
                f'aria-label="Enlarge: {html.escape(alt)}"><img src="images/rulebook/{name}.webp?v={versions[name]}" '
                f'alt="{html.escape(alt)}" width="{w // 2}" height="{h // 2}" loading="lazy" /></button></figure>')
            continue
        if line == "---":
            flush(); end_list()
            out.append('<div class="rulebook-clear"></div>')
            continue
        if line.startswith("|"):
            flush()
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if not out or not out[-1].endswith("</tr>"):
                out.append('<div class="rulebook-table"><table>')
                out.append("<tr>" + "".join(f"<th>{inline(c)}</th>" for c in cells) + "</tr>")
            else:
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in cells) + "</tr>")
            continue
        if line.startswith("- "):
            flush()
            if list_kind != "ul":
                end_list()
                out.append('<ul>')
                list_kind = "ul"
            if line.startswith("- – "):
                out.append(f'<li class="rulebook-sub">{inline(line[4:])}</li>')
            else:
                out.append(f"<li>{inline(line[2:])}</li>")
            continue
        m = re.match(r"^(\(\d+\)|\d+\.|[a-z]\.)\s+(.*)$", line)
        if m:
            flush()
            if list_kind != "ol":
                end_list()
                out.append('<ol>')
                list_kind = "ol"
            out.append(f'<li><span class="rulebook-num">{m.group(1)}</span> {inline(m.group(2))}</li>')
            continue
        if line.startswith("  ") and list_kind and line.strip():
            # continuation of the last list item
            last = out.pop()
            out.append(last[:-5] + " " + inline(line.strip()) + "</li>")
            continue
        if not line.strip():
            flush()
            end_list()
            continue
        if list_kind:
            end_list()
        para.append(line.strip())
    end_chapter()

    if errors:
        sys.exit(f"{book}: unresolved cross-references: {sorted(set(errors))}")


    path = os.path.join(repo, "rulebook", book + ".html")
    with open(path, "w") as f:
        f.write("<!-- Generated from the official rulebook PDFs: the text word for word,\n"
                "     the illustrations cropped from the pages. -->\n")
        f.write("\n".join(out) + "\n")
    print(f"{book}: {sum(len(i) for _, _, i in contents)} entries -> {path}")


for book in sys.argv[1:] or ["base", "ck"]:
    build(book)

# The service worker precaches these so the rulebook works offline
files = sorted(f"rulebook/{f}" for f in os.listdir(os.path.join(repo, "rulebook")) if f.endswith(".html"))
files += sorted(f"images/rulebook/{name}.webp?v={v}" for name, v in versions.items())
with open(os.path.join(repo, "rulebook", "precache.js"), "w") as f:
    f.write("// Generated with the rulebook: every file it needs, for sw.js to precache.\n")
    f.write("self.RULEBOOK_FILES = [\n" + ",\n".join(f'  "{x}"' for x in files) + "\n];\n")
