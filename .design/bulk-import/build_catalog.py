from pathlib import Path
from collections import Counter,defaultdict
import json,csv

root=Path(__file__).resolve().parents[2]
work=root/'.design/bulk-import'
inventory=json.loads((work/'inventory.json').read_text(encoding='utf-8'))
manual=json.loads((work/'manual.json').read_text(encoding='utf-8'))
assert len(inventory)==len(manual)==181
labels={row['id']:row for row in manual}
counts=Counter(row['name'] for row in manual)
order=defaultdict(int)
records=[]
for item in inventory:
    row=labels[item['id']]
    name=row['name']
    assert name and '待核' not in name
    assert not any(character in name for character in '<>:"/\\|?*')
    order[name]+=1
    filename=f'{name}-{order[name]:02d}.jpeg' if counts[name]>1 else f'{name}.jpeg'
    records.append({**item,**row,'fileName':filename,'variant':order[name],'variants':counts[name],
        'path':f'水浒人物/{filename}','src':f'资料/水浒人物/{filename}'})
assert len({row['fileName'].casefold() for row in records})==181
(work/'catalog.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
with (work/'命名与描述对照.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.writer(f);writer.writerow(['原编号','原文件名','新文件名','人物或群像','已确认题字描述','完整小字状态','SHA256'])
    for row in records:writer.writerow([row['id'],row['original'],row['fileName'],row['name'],row['description'],row['full_inscription_status'],row['sha256']])
print(json.dumps({'images':len(records),'names':len(counts),'multiple_versions':{n:c for n,c in counts.items() if c>1},'title_only':sum(row['description_status']=='verified_title_excerpt' for row in records)},ensure_ascii=False))
