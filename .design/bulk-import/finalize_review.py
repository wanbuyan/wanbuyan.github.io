from pathlib import Path
import json,re

work=Path(__file__).resolve().parent
records=json.loads((work/'manual.json').read_text(encoding='utf-8'))
excerpts={}
for file in sorted(work.glob('reviewed-excerpts*.json')):
    excerpts.update(json.loads(file.read_text(encoding='utf-8')))
# Avoid publishing uncertain readings of cursive sentences.
excerpts['39']='花和尚鲁智深。见《水浒传》第四回。'
excerpts['111']='济州太守张叔夜。见《水浒传》第八十二回。'
excerpts['114']='王都尉。见《水浒传》第二回。'
corrections={
    27:('苏东坡','苏学士东坡'),
    53:('凌振','轰天雷凌振'),
    70:('孙立','病尉迟孙立'),
    71:('邓飞','火眼狻猊邓飞'),
    163:('宋庭官军士卒','宋庭官军士卒'),
    164:('宋庭官军将卒','宋庭官军将卒'),
    167:('衙役差拨','衙役差拨'),
    174:('渔夫艄童','渔夫艄童')
}
expanded={}
for file in sorted(work.glob('expanded-*.json')):
    expanded.update(json.loads(file.read_text(encoding='utf-8')))
if expanded:assert set(expanded)=={str(number) for number in range(1,182)}
for row in records:
    if row['id'] in corrections:row['name'],row['title']=corrections[row['id']]
    if str(row['id']) in excerpts:
        row['description']=excerpts[str(row['id'])]
        row['description_status']='verified_inscription_excerpt'
    row['full_inscription_status']='excerpt_reviewed_full_cursive_not_transcribed'
    if str(row['id']) in expanded:
        annotated=expanded[str(row['id'])]
        row['transcription_notes']=re.findall(r'〔([^〕]*)〕',annotated)
        row['description']=re.sub(r'〔[^〕]*〕','〔未辨〕',annotated)
        row['description_status']='transcribed_with_gaps' if '〔' in row['description'] else 'readable_side_text_transcribed'
        row['full_inscription_status']=row['description_status']
(work/'manual.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(records)} records; {len(expanded)} expanded descriptions; {sum("〔" in r["description"] for r in records)} with explicit gaps.')
