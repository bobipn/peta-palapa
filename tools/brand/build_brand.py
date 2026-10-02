#!/usr/bin/env python3
"""
C-Ring (Connex-Ring) — generator aset brand.

Semua bentuk huruf wordmark & orbit digambar secara geometris di sini (tanpa
font), sehingga file SVG hasilnya mandiri. Hanya tagline yang memakai font
Sora Regular (SIL Open Font License) dan dikonversi menjadi outline path.

Keluaran:
  brand/*.svg, brand/*.png        logo, wordmark, mark, ikon aplikasi, OG image
  favicon.ico, favicon.svg,        di root situs (dipakai semua halaman)
  apple-touch-icon.png, site.webmanifest

Kebutuhan: python3 + fonttools, node + playwright (Chromium), ImageMagick.
Jalankan dari root repo:  python3 tools/brand/build_brand.py
"""
import math, os, subprocess, sys, urllib.request, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'brand')
HERE = os.path.dirname(os.path.abspath(__file__))

TAGLINE = 'BACKBONE TO BUSINESS'
NAVY = '#0A1B3D'      # tinta untuk latar terang (navy portal LTI)
WHITE = '#FFFFFF'     # tinta untuk latar gelap
BG_TOP, BG_BOT = '#0E2452', '#050B1A'   # gradasi latar ikon aplikasi


def f(v):
    s = f"{v:.2f}".rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


# ---------------------------------------------------------------- geometri huruf
class Glyphs:
    """Huruf C-RING. Tinggi huruf kapital = 100 unit, ketebalan garis = W."""

    def __init__(self, W=13.0, a=54.0, uid='c'):
        self.W, self.h, self.a, self.uid = W, W / 2, a, uid
        self.els, self.clips, self.n, self.x = [], [], 0, 0.0

    def _clip(self, x0, x1, body, shape=None):
        self.n += 1
        cid = f'{self.uid}k{self.n}'
        shape = shape or f'<rect x="{f(x0)}" y="0" width="{f(x1 - x0)}" height="100"/>'
        self.clips.append(f'<clipPath id="{cid}">{shape}</clipPath>')
        self.els.append(f'<g clip-path="url(#{cid})">{body}</g>')

    @staticmethod
    def _ell(cx, cy, a, b, deg):
        t = math.radians(deg)
        return cx + a * math.cos(t), cy - b * math.sin(t)

    def c_arc(self, cx, gap=36):
        a, b = self.a, 50 - self.h
        x1, y1 = self._ell(cx, 50, a, b, gap)
        x2, y2 = self._ell(cx, 50, a, b, -gap)
        return f'M{f(x1)} {f(y1)}A{f(a)} {f(b)} 0 1 0 {f(x2)} {f(y2)}'

    def C(self):
        cx = self.x + self.a + self.h
        self.els.append(f'<path d="{self.c_arc(cx)}"/>')
        self.x += 2 * self.a + self.W
        return cx

    def G(self, gap=36):
        a, b, h, W = self.a, 50 - self.h, self.h, self.W
        cx = self.x + a + h
        x1, y1 = self._ell(cx, 50, a, b, gap)
        x2, y2 = self._ell(cx, 50, a, b, 0)
        self.els.append(f'<path d="M{f(x1)} {f(y1)}A{f(a)} {f(b)} 0 1 0 {f(x2)} {f(y2)}"/>')
        # palang G dipotong mengikuti kontur luar elips agar ujungnya rata dengan lengkung
        bar = f'<rect x="{f(cx + a * 0.16)}" y="50" width="{f(a * 0.84 + h + 2)}" height="{f(W)}" fill="currentColor" stroke="none"/>'
        self._clip(0, 0, bar, f'<ellipse cx="{f(cx)}" cy="50" rx="{f(a + h)}" ry="50"/>')
        self.x += 2 * a + W

    def hyphen(self, L=24):
        self.els.append(f'<rect x="{f(self.x)}" y="{f(50 - self.h)}" width="{f(L)}" height="{f(self.W)}" fill="currentColor" stroke="none"/>')
        self.x += L

    def _stem(self, x):
        return f'<line x1="{f(x)}" y1="-10" x2="{f(x)}" y2="110"/>'

    @staticmethod
    def _poly(pts):
        return '<polygon fill="currentColor" stroke="none" points="' + ' '.join(f'{f(x)},{f(y)}' for x, y in pts) + '"/>'

    def I(self):
        self._clip(self.x, self.x + self.W, self._stem(self.x + self.h))
        self.x += self.W

    def R(self, bw=54, yb=55):
        h, W = self.h, self.W
        x0 = self.x + h
        rb = (yb - h) / 2
        xb = x0 + bw
        right = xb + rb + h + 1
        bowl = f'<path d="M{f(x0)} {f(h)}H{f(xb)}A{f(rb)} {f(rb)} 0 0 1 {f(xb)} {f(yb)}H{f(x0)}"/>'
        xl = xb - 10
        ang = math.atan2(right - (xl + W), 100 - (yb - h))
        lw = W / math.cos(ang)
        leg = self._poly([(xl, yb - h), (xl + lw, yb - h), (right, 100), (right - lw, 100)])
        self._clip(self.x, right, self._stem(x0) + bowl + leg)
        self.x = right

    def N(self, w=92):
        h, W = self.h, self.W
        x0, x1 = self.x + h, self.x + w - h
        ang = math.atan2(w - W, 100)
        lw = W / math.cos(ang)
        diag = self._poly([(self.x, 0), (self.x + lw, 0), (self.x + w, 100), (self.x + w - lw, 100)])
        self._clip(self.x, self.x + w, self._stem(x0) + self._stem(x1) + diag)
        self.x += w

    def svg(self, ink):
        return (f'<g fill="none" stroke="{ink}" color="{ink}" stroke-width="{f(self.W)}" stroke-linecap="butt">'
                + ''.join(self.els) + '</g>')


def build_word(uid, W=13.0):
    g = Glyphs(W=W, uid=uid)
    cx = g.C(); g.x += 16.5
    g.hyphen(); g.x += 24
    g.R(); g.x += 30
    g.I(); g.x += 30
    g.N(); g.x += 30
    g.G()
    return g, cx


# ---------------------------------------------------------------- orbit
class Arc:
    """Busur lingkaran (cabang atas) yang melewati tiga titik pandu."""

    def __init__(self, p1, p2, p3, x0, x1):
        (ax, ay), (bx, by), (cx, cy) = p1, p2, p3
        d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
        self.ux = ((ax*ax + ay*ay) * (by - cy) + (bx*bx + by*by) * (cy - ay) + (cx*cx + cy*cy) * (ay - by)) / d
        self.uy = ((ax*ax + ay*ay) * (cx - bx) + (bx*bx + by*by) * (ax - cx) + (cx*cx + cy*cy) * (bx - ax)) / d
        self.r = math.hypot(ax - self.ux, ay - self.uy)
        self.t0 = math.atan2(self.y(x0) - self.uy, x0 - self.ux)
        self.t1 = math.atan2(self.y(x1) - self.uy, x1 - self.ux)

    def y(self, x):
        return self.uy - math.sqrt(self.r ** 2 - (x - self.ux) ** 2)

    def taper(self, tmax, extra=0.0, pk=0.42, pw=0.85, n=180):
        """Garis orbit meruncing di kedua ujung, paling tebal di t=pk."""
        top, bot = [], []
        for i in range(n + 1):
            t = i / n
            th = self.t0 + (self.t1 - self.t0) * t
            x, y = self.ux + self.r * math.cos(th), self.uy + self.r * math.sin(th)
            nx, ny = math.cos(th), math.sin(th)          # normal = arah radial
            s = t / pk if t < pk else (1 - t) / (1 - pk)
            tk = tmax * math.sin(s * math.pi / 2) ** pw / 2 + extra
            top.append((x - nx * tk, y - ny * tk)); bot.append((x + nx * tk, y + ny * tk))
        return 'M' + 'L'.join(f'{f(x)} {f(y)}' for x, y in top + bot[::-1]) + 'Z'


def orbit_for(word_w):
    # masuk di depan batang kiri C, lewat di belakang lengan kanan-atas C, lalu melengkung di atas RING
    return lambda x0, x1: Arc((2, 58), (185, -24), (word_w + 30, -50), x0, x1)


def thread(glyph_svg, c_path, W, arc, tmax, halo, uid, ink, split=34):
    """Gabungkan huruf + orbit dengan efek 'tembus': depan di kiri-bawah, belakang di kanan-atas."""
    sw, sh = arc.taper(tmax), arc.taper(tmax, extra=halo)
    big = 'x="-2000" y="-2000" width="5000" height="5000"'
    defs = (f'<clipPath id="{uid}lo"><rect x="-2000" y="{split}" width="2100" height="2000"/></clipPath>'
            f'<clipPath id="{uid}hi"><rect x="-2000" y="-2000" width="5000" height="{2000 + split}"/></clipPath>'
            f'<mask id="{uid}kL" maskUnits="userSpaceOnUse" {big}><rect {big} fill="#fff"/>'
            f'<path d="{sh}" fill="#000" clip-path="url(#{uid}lo)"/></mask>'
            f'<mask id="{uid}kO" maskUnits="userSpaceOnUse" {big}><rect {big} fill="#fff"/>'
            f'<path d="{c_path}" fill="none" stroke="#000" stroke-width="{f(W + 2 * halo)}" clip-path="url(#{uid}hi)"/></mask>')
    body = f'<g mask="url(#{uid}kL)">{glyph_svg}</g><path d="{sw}" fill="{ink}" mask="url(#{uid}kO)"/>'
    return defs, body


# ---------------------------------------------------------------- tagline (Sora → path)
def sora_path():
    p = os.path.join(HERE, '.cache', 'Sora-Regular.ttf')
    if not os.path.exists(p):
        os.makedirs(os.path.dirname(p), exist_ok=True)
        css = urllib.request.urlopen('https://fonts.googleapis.com/css2?family=Sora:wght@400').read().decode()
        url = re.search(r'url\((https://[^)]+\.ttf)\)', css).group(1)
        urllib.request.urlretrieve(url, p)
    return p


def text_path(text, cap_h, tracking_em, ink):
    """Kembalikan (svg_path, lebar) untuk teks kapital; baseline y=0, x mulai 0."""
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    font = TTFont(sora_path())
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    upm, caph = font['head'].unitsPerEm, font['OS/2'].sCapHeight
    k = cap_h / caph
    size = upm * k
    x, parts = 0.0, []
    for i, ch in enumerate(text):
        gname = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[gname].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
        d = pen.getCommands()
        if d:
            parts.append(d)
        x += gs[gname].width * k
        if i < len(text) - 1:
            x += tracking_em * size
    return f'<path fill="{ink}" d="{" ".join(parts)}"/>', x


# ---------------------------------------------------------------- komposisi
def svg_doc(vb, defs, body, bg=None, title=None):
    x, y, w, h = vb
    t = f'<title>{title}</title>' if title else ''
    bgr = f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="{bg}"/>' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(x)} {f(y)} {f(w)} {f(h)}">{t}'
            f'<defs>{defs}</defs>{bgr}{body}</svg>\n')


def wordmark(ink, uid, tagline=True):
    g, cx = build_word(uid)
    w = g.x
    arc = orbit_for(w)(-70, w + 40)
    defs, body = thread(g.svg(ink), g.c_arc(cx), g.W, arc, 4.6, 4.0, uid, ink)
    defs = ''.join(g.clips) + defs
    top, bottom = -84, 112
    if tagline:
        tp, tw = text_path(TAGLINE, 14.5, 0.62, ink)
        ty = 100 + 38 + 14.5
        body += f'<g transform="translate({f((w - tw) / 2)} {f(ty)})">{tp}</g>'
        bottom = ty + 22
    vb = (-84, top, w + 84 + 70, bottom - top)
    return defs, body, vb, w


def mark(ink, uid, bold=False):
    """Simbol C + orbit untuk ikon. bold=True untuk ukuran kecil (16–48 px)."""
    W = 19.0 if bold else 14.0
    g = Glyphs(W=W, uid=uid)
    cx = g.C()
    word_w = build_word('tmp')[0].x                   # lebar wordmark → busur yang sama
    x0, x1 = (-30, 152) if bold else (-40, 162)
    arc = orbit_for(word_w)(x0, x1)
    tmax, halo = (11.0, 7.0) if bold else (7.2, 5.0)
    defs, body = thread(g.svg(ink), g.c_arc(cx), W, arc, tmax, halo, uid, ink)
    # pusat visual: tengah antara pusat huruf C dan pusat kotak-batas (C + orbit)
    ytop = arc.y(x1) - tmax
    bx, by = (x0 + x1) / 2, (ytop + 100) / 2
    vcx, vcy = (cx + bx) / 2, (50 + by) / 2
    return ''.join(g.clips) + defs, body, (vcx, vcy), (x1 - x0, 100 - ytop)


def app_icon(size_px, uid, bold=False, rounded=True, maskable=False):
    S = 512
    defs, body, (vcx, vcy), (mw, mh) = mark(WHITE, uid, bold)
    # lebar mark (C + orbit) terhadap kanvas; maskable dijaga di dalam safe-zone lingkaran 80%
    target = (0.58 if maskable else 0.90 if bold else 0.78) * S
    sc = target / mw
    r = 112 if rounded else 0
    grad = (f'<linearGradient id="{uid}bg" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{BG_TOP}"/><stop offset="1" stop-color="{BG_BOT}"/></linearGradient>')
    glow = (f'<radialGradient id="{uid}gl" cx="0.3" cy="0.15" r="0.75">'
            f'<stop offset="0" stop-color="#1FA2FF" stop-opacity="0.16"/><stop offset="1" stop-color="#1FA2FF" stop-opacity="0"/></radialGradient>')
    bg = (f'<rect width="{S}" height="{S}" rx="{r}" fill="url(#{uid}bg)"/>'
          f'<rect width="{S}" height="{S}" rx="{r}" fill="url(#{uid}gl)"/>')
    g = f'<g transform="translate({f(S / 2)} {f(S / 2 + 6)}) scale({f(sc)}) translate({f(-vcx)} {f(-vcy)})">{body}</g>'
    return svg_doc((0, 0, S, S), grad + glow + defs, bg + g, title='C-Ring')


def og_image(uid):
    Wd, Hd = 1200, 630
    defs, body, vb, w = wordmark(WHITE, uid, tagline=True)
    sc = 760 / vb[2]
    grad = (f'<radialGradient id="{uid}bg" cx="0.5" cy="0.38" r="0.9">'
            f'<stop offset="0" stop-color="#0E2452"/><stop offset="1" stop-color="#040915"/></radialGradient>')
    ox = (Wd - vb[2] * sc) / 2 - vb[0] * sc
    oy = (Hd - vb[3] * sc) / 2 - vb[1] * sc - 14
    url, uw = text_path('KOMERSIALLTI.MY.ID', 11, 0.5, '#8FA3C4')
    g = (f'<rect width="{Wd}" height="{Hd}" fill="url(#{uid}bg)"/>'
         f'<g transform="translate({f(ox)} {f(oy)}) scale({f(sc)})">{body}</g>'
         f'<g transform="translate({f((Wd - uw) / 2)} 580)">{url}</g>')
    return svg_doc((0, 0, Wd, Hd), grad + defs, g)


def write(name, s):
    p = os.path.join(OUT, name) if not name.startswith('/') else name
    with open(p, 'w') as fh:
        fh.write(s)
    return p


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {}
    for ink, tag in ((NAVY, 'on-light'), (WHITE, 'on-dark')):
        d, b, vb, _ = wordmark(ink, 'l' + tag[3])
        files[f'c-ring-logo-{tag}.svg'] = svg_doc(vb, d, b, title='C-Ring — Backbone to Business')
        d, b, vb, _ = wordmark(ink, 'w' + tag[3], tagline=False)
        vb = (vb[0], vb[1], vb[2], 112 - vb[1])
        files[f'c-ring-wordmark-{tag}.svg'] = svg_doc(vb, d, b, title='C-Ring')
        d, b, (vcx, vcy), (mw, mh) = mark(ink, 'm' + tag[3])
        side = max(mw, mh) * 1.12
        files[f'c-ring-mark-{tag}.svg'] = svg_doc((vcx - side / 2, vcy - side / 2, side, side), d, b, title='C-Ring')
    files['c-ring-app-icon.svg'] = app_icon(512, 'ai')
    files['c-ring-app-icon-small.svg'] = app_icon(512, 'as', bold=True)
    files['c-ring-maskable.svg'] = app_icon(512, 'am', rounded=False, maskable=True)
    files['c-ring-apple-touch.svg'] = app_icon(512, 'at', rounded=False)
    files['c-ring-og.svg'] = og_image('og')
    for n, s in files.items():
        write(n, s)
    # favicon.svg di root situs = versi tebal (terbaca di tab browser)
    write(os.path.join(ROOT, 'favicon.svg'), files['c-ring-app-icon-small.svg'])

    # ---- PNG via Chromium
    R = lambda src, dst, w: subprocess.run(['node', os.path.join(HERE, 'render.js'), src, dst, str(w)], check=True)
    o = lambda n: os.path.join(OUT, n)
    R(o('c-ring-logo-on-light.svg'), o('c-ring-logo-on-light.png'), 2400)
    R(o('c-ring-logo-on-dark.svg'), o('c-ring-logo-on-dark.png'), 2400)
    R(o('c-ring-wordmark-on-light.svg'), o('c-ring-wordmark-on-light.png'), 2400)
    R(o('c-ring-wordmark-on-dark.svg'), o('c-ring-wordmark-on-dark.png'), 2400)
    R(o('c-ring-mark-on-light.svg'), o('c-ring-mark-on-light.png'), 1024)
    R(o('c-ring-mark-on-dark.svg'), o('c-ring-mark-on-dark.png'), 1024)
    R(o('c-ring-og.svg'), o('c-ring-og.png'), 1200)
    for s in (192, 512, 1024):
        R(o('c-ring-app-icon.svg'), o(f'icon-{s}.png'), s)
    # persegi penuh tanpa sudut membulat: foto profil WhatsApp/LinkedIn (dipotong lingkaran oleh aplikasinya)
    R(o('c-ring-apple-touch.svg'), o('c-ring-avatar-1024.png'), 1024)
    R(o('c-ring-maskable.svg'), o('icon-maskable-512.png'), 512)
    R(o('c-ring-apple-touch.svg'), os.path.join(ROOT, 'apple-touch-icon.png'), 180)
    for s in (16, 32, 48):
        R(o('c-ring-app-icon-small.svg'), o(f'favicon-{s}.png'), s)
    subprocess.run(['convert', o('favicon-16.png'), o('favicon-32.png'), o('favicon-48.png'),
                    os.path.join(ROOT, 'favicon.ico')], check=True)
    print('OK —', len(files), 'SVG +', 'PNG/ICO ditulis ke', OUT)


if __name__ == '__main__':
    main()
