"""Optional docs build: pip install pymupdf; run after render-walkthrough.mjs.

MuPDF does not reproduce Canvas alpha-gradient glows accurately. Omit radial
glow/vignette layers from PNG documentation replays; SVG keeps those layers.
These are explanatory practice-state renders, not browser screenshots.
"""
from pathlib import Path
import xml.etree.ElementTree as ET
import fitz

root = Path(__file__).resolve().parents[1] / 'docs' / 'images'
for source in sorted(root.glob('0*.svg')):
    tree = ET.fromstring(source.read_text(encoding='utf-8'))
    namespace = '{http://www.w3.org/2000/svg}'
    radial = {g.get('id') for g in tree.iter(namespace + 'radialGradient')}
    linear = {g.get('id'): list(g)[0].attrib for g in tree.iter(namespace + 'linearGradient')}
    for element in tree.iter():
        if element.get('fill', '') in {f'url(#{gid})' for gid in radial}:
            element.set('fill', 'none')
        for gid, stop in linear.items():
            if element.get('fill') == f'url(#{gid})':
                element.set('fill', stop['stop-color'])
                element.set('fill-opacity', stop.get('stop-opacity', '1'))
    with fitz.open(stream=ET.tostring(tree), filetype='svg') as doc:
        doc[0].get_pixmap(alpha=False).save(source.with_suffix('.png'))
print('Rendered walkthrough PNGs. SVG originals retain gradient effects.')
