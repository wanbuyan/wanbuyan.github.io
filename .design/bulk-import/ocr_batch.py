from pathlib import Path
import sys,json,time
sys.path.insert(0,r'C:/Users/杨忠豪/AppData/Local/Temp/wanbuyan-ocr-tools')
from rapidocr_onnxruntime import RapidOCR
from PIL import Image,ImageOps
import numpy as np

root=Path(__file__).resolve().parents[2]
source=Path(r'C:/Users/杨忠豪/Desktop/水浒插图')
output=root/'.design/bulk-import'
engine=RapidOCR(text_score=0.15,box_thresh=0.25)
start=time.time()
def horizontalize(crop):
    gray=np.asarray(crop.convert('L'))
    ink=(gray<170).sum(axis=1)
    active=np.flatnonzero(ink>0)
    if not len(active): return None
    boundaries=[int(active[0])]
    last=int(active[0])
    for y in active[1:]:
        if int(y)-last>max(2,crop.width*.12) and last-boundaries[-1]>crop.width*.5:
            boundaries.extend([last+1,int(y)])
        last=int(y)
    boundaries.append(last+1)
    glyphs=[]
    for begin,end in zip(boundaries[::2],boundaries[1::2]):
        if end-begin<2:continue
        glyph=crop.crop((0,begin,crop.width,end))
        mask=ImageOps.invert(glyph.convert('L')).point(lambda v:255 if v>80 else 0)
        box=mask.getbbox()
        if box:glyph=glyph.crop(box)
        glyph=ImageOps.contain(glyph,(40,42))
        glyphs.append(glyph)
    if not glyphs:return None
    row=Image.new('RGB',(48*len(glyphs)+8,48),'white')
    for i,glyph in enumerate(glyphs):row.paste(glyph,(i*48+4+(40-glyph.width)//2,(48-glyph.height)//2))
    return row

records=[]
output_file=output/'ocr-raw.jsonl'
completed={}
if output_file.exists():
    for line in output_file.read_text(encoding='utf-8').splitlines():
        row=json.loads(line);completed[row['id']]=row
for number in range(1,182):
    if number in completed:continue
    file=source/f'{number:03d}.jpeg'
    image=Image.open(file).convert('RGB')
    enlarged=image.resize((image.width*2,image.height*2))
    boxes,_=engine.text_detector(np.asarray(enlarged))
    lines=[]
    if boxes is not None:
      for box in boxes:
        xs=box[:,0];ys=box[:,1]
        x1,y1,x2,y2=int(xs.min()/2),int(ys.min()/2),int(xs.max()/2)+1,int(ys.max()/2)+1
        if not (x2<image.width*.23 or x1>image.width*.76):continue
        if y2-y1<5 or x2-x1<3:continue
        crop=image.crop((max(0,x1-2),max(0,y1-2),min(image.width,x2+2),min(image.height,y2+2)))
        horizontal=horizontalize(crop) if crop.height>crop.width*1.5 else crop
        if horizontal is None:continue
        result,_=engine.text_recognizer([np.asarray(horizontal)])
        if result:
          text,score=result[0]
          lines.append({'box':[x1,y1,x2,y2],'text':text,'score':round(float(score),3)})
    row={'id':number,'lines':lines,'text':'\n'.join(line['text'] for line in sorted(lines,key=lambda item:(-item['box'][0],item['box'][1])))}
    with output_file.open('a',encoding='utf-8') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
    if number%20==0:print(f'{number}/181; {time.time()-start:.1f}s',flush=True)
print('seconds',time.time()-start)
