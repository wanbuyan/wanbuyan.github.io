from pathlib import Path
import sys,json,time
sys.path.insert(0,r'C:/Users/杨忠豪/AppData/Local/Temp/wanbuyan-ocr-tools')
from rapidocr import RapidOCR
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parents[2]
source=Path(r'C:/Users/杨忠豪/Desktop/水浒插图')
engine=RapidOCR(params={'Global.text_score':0.15,'Global.log_level':'error','Det.box_thresh':0.25})
output=root/'.design/bulk-import/ocr-modern.jsonl'
completed={json.loads(line)['id'] for line in output.read_text(encoding='utf-8').splitlines()} if output.exists() else set()
for n in range(1,182):
    if n in completed:continue
    img=Image.open(source/f'{n:03d}.jpeg').convert('RGB')
    out=engine(np.asarray(img.resize((img.width*2,img.height*2))))
    row={'id':n,'texts':out.txts,'scores':[round(float(s),3) for s in out.scores] if out.scores is not None else []}
    with output.open('a',encoding='utf-8') as file:file.write(json.dumps(row,ensure_ascii=False)+'\n')
    if n%20==0:print(n,flush=True)
