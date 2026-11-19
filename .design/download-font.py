from pathlib import Path
from urllib.request import urlopen
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent / 'font-tools'))
from fontTools import subset
from fontTools.ttLib import TTFont
import re

base = Path(__file__).resolve().parents[1]
content = ''.join((base / file).read_text(encoding='utf-8') for file in ('index.html', 'assets/app.js'))
chars = ''.join(sorted(set(re.findall(r'[\u3000-\u9fff\uff00-\uffef]', content))))
chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /|.%&+,-:;!?()[]©…'
url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf'
source = base / '.design' / 'fonts' / 'NotoSansSC-variable.ttf'
source.parent.mkdir(exist_ok=True)
if not source.exists():
    source.write_bytes(urlopen(url, timeout=60).read())
font = TTFont(source)
options = subset.Options()
options.flavor = 'woff2'
options.desubroutinize = True
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=chars)
subsetter.subset(font)
folder = base / 'assets' / 'fonts'
folder.mkdir(exist_ok=True)
font.flavor = 'woff2'
font.save(folder / 'blog-sans.woff2')
license_url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt'
(folder / 'OFL.txt').write_bytes(urlopen(license_url, timeout=30).read())
(folder / 'README.md').write_text('Noto Sans SC, licensed under SIL Open Font License 1.1 (OFL.txt).\nLocal variable subset covering the blog interface, with system sans-serif fallback for other characters.\n', encoding='utf-8')
print(f'Local Noto Sans SC subset: {(folder / "blog-sans.woff2").stat().st_size} bytes, {len(chars)} characters; weights 400–700.')
