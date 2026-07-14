#!/usr/bin/env python3
"""Build sprite-gallery.html — all characters + gear at 8x with regen-marking UI.

Usage: python3 gallery.py   (from tools/pixelart/; reads app manifest, embeds PNGs)
Marking: click card = flag for regen, shift-click = flag + note; marks persist in
localStorage; Copy/Download buttons export [{id, note}] for feeding back to Claude.
"""
import json, base64
from pathlib import Path

HERE = Path(__file__).parent
DEST = HERE / '../../life-gamification/public/assets/characters'

def cell(img_path, cid, title, sub):
    b64 = base64.b64encode(img_path.read_bytes()).decode()
    return (f'<div class="c" data-id="{cid}" title="click: mark for regen &middot; shift-click: add note">'
            f'<img src="data:image/png;base64,{b64}"><div class="t">{title}</div>'
            f'<div class="s">{sub}</div><div class="note"></div></div>')

def main():
    m = json.loads((DEST / 'manifest.json').read_text())
    groups = {}
    for ch in m['characters']:
        groups.setdefault(ch['series'], []).append(ch)
    html = ['<meta charset="utf-8"><title>Sprite Library</title><style>',
    'body{background:#0d0d14;color:#eee;font-family:system-ui;padding:24px}',
    'h1{color:#8f86ff}h2{color:#8f86ff;border-bottom:1px solid #333;padding-bottom:4px;margin-top:32px}',
    '.g{display:flex;flex-wrap:wrap;gap:16px}',
    '.c{background:#16161f;border:2px solid #2a2a38;border-radius:8px;padding:12px;text-align:center;width:200px;cursor:pointer;user-select:none}',
    '.c.sel{border-color:#ff4757;box-shadow:0 0 12px #ff475766}',
    '.c.sel .t::after{content:" \\1F504";}',
    'img{width:192px;height:288px;image-rendering:pixelated;pointer-events:none}',
    '.t{font-weight:600;margin-top:6px}.s{color:#888;font-size:12px}.note{color:#ffa502;font-size:12px;margin-top:4px;white-space:pre-wrap}',
    '#bar{position:sticky;top:0;background:#0d0d14ee;padding:12px 0;z-index:9;display:flex;gap:12px;align-items:center}',
    'button{background:#4b3ac2;color:#fff;border:0;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:14px}',
    'button:hover{background:#5b48ff}#count{color:#ff4757;font-weight:600}</style>',
    f'<h1>Sprite Library &mdash; {len(m["characters"])} characters, {len(m.get("gear",[]))} gear</h1>',
    '<div id="bar"><span id="count">0 marked</span>',
    '<button onclick="copyList()">Copy regen list</button>',
    '<button onclick="downloadList()">Download regen-list.json</button>',
    '<button onclick="clearAll()">Clear all</button>',
    '<span style="color:#888;font-size:13px">click = mark &middot; shift-click = mark + note</span></div>']
    for series in sorted(groups):
        html.append(f'<h2>{series}</h2><div class="g">')
        for ch in groups[series]:
            html.append(cell(DEST / f"{ch['id']}.png", ch['id'], ch['displayName'], ch.get('form') or ''))
        html.append('</div>')
    html.append('<h2>Gear</h2><div class="g">')
    for g in m.get('gear', []):
        html.append(cell(DEST / 'gear' / f"{g['id']}.png", 'gear:' + g['id'], g['displayName'], f"{g['slot']} &middot; {g['zIndex']}"))
    html.append("""</div><script>
const KEY='regen-marks';
let marks=JSON.parse(localStorage.getItem(KEY)||'{}');
function save(){localStorage.setItem(KEY,JSON.stringify(marks));render();}
function render(){
  document.querySelectorAll('.c').forEach(el=>{
    const id=el.dataset.id;
    el.classList.toggle('sel',id in marks);
    el.querySelector('.note').textContent=marks[id]||'';
  });
  document.getElementById('count').textContent=Object.keys(marks).length+' marked';
}
document.querySelectorAll('.c').forEach(el=>el.addEventListener('click',e=>{
  const id=el.dataset.id;
  if(e.shiftKey){
    const n=prompt('What should be fixed for '+id+'?',marks[id]||'');
    if(n===null)return;
    marks[id]=n;
  } else if(id in marks){delete marks[id];}
  else{marks[id]='';}
  save();
}));
function payload(){return JSON.stringify(Object.entries(marks).map(([id,note])=>({id,note})),null,2);}
function copyList(){navigator.clipboard.writeText(payload()).then(()=>alert('Copied '+Object.keys(marks).length+' entries — paste to Claude'));}
function downloadList(){
  const a=document.createElement('a');
  a.href='data:application/json,'+encodeURIComponent(payload());
  a.download='regen-list.json';a.click();
}
function clearAll(){if(confirm('Clear all marks?')){marks={};save();}}
render();
</script>""")
    out = HERE / 'out' / 'sprite-gallery.html'
    out.write_text(''.join(html))
    print(out, out.stat().st_size // 1024, 'KB')

if __name__ == '__main__':
    main()
