from pathlib import Path
import sys,json,time
sys.path.insert(0,r'C:/Users/杨忠豪/AppData/Local/Temp/wanbuyan-ocr-tools')
from rapidocr import RapidOCR,OCRVersion,ModelType
from PIL import Image
import numpy as np

root=Path(__file__).resolve().parents[2]
work=root/'.design/bulk-import'
records={r['id']:r for r in json.loads((work/'catalog.json').read_text(encoding='utf-8'))}
# Models run locally. Only model weights may be downloaded; no pictures are uploaded.
engine=RapidOCR(params={'Global.text_score':0.15,'Det.box_thresh':0.25,
    'Rec.ocr_version':OCRVersion.PPOCRV5,'Rec.model_type':ModelType.SERVER})
output=work/'ocr-server-review.jsonl'
completed={json.loads(line)['id'] for line in output.read_text(encoding='utf-8').splitlines()} if output.exists() else set()
for n in [10,11,12,13,16,19,27,31,35,39,40,48,58,61,75,77,79,83,84,91,100,101,103,106,111,114,118,121,126,128,129,137,139,140,141,142,143,146,147,148,150,153,154,155,156,157,161,162,167]:
    if n in completed:continue
    img=Image.open(root/records[n]['src']).convert('RGB')
    out=engine(np.asarray(img.resize((img.width*2,img.height*2))))
    row={'id':n,'texts':out.txts,'scores':[round(float(s),3) for s in out.scores] if out.scores is not None else []}
    with output.open('a',encoding='utf-8') as file:file.write(json.dumps(row,ensure_ascii=False)+'\n')
    print(json.dumps(row,ensure_ascii=False),flush=True)
