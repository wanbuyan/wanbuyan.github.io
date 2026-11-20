from pathlib import Path
import json,re,hashlib,csv,html

root=Path(__file__).resolve().parents[2]
work=root/'.design/bulk-import'
records=json.loads((work/'catalog.json').read_text(encoding='utf-8'))
before=json.loads((work/'description-before-expansion.json').read_text(encoding='utf-8'))
old={r['id']:r for r in before}
assert len(records)==181
for row in records:
    file=(root/row['src']).resolve()
    assert file.parent==(root/'资料/水浒人物').resolve()
    assert hashlib.sha256(file.read_bytes()).hexdigest()==row['sha256']
web=[{'id':r['id'],'character':r['name'],'fileName':r['fileName'],'path':r['path'],
      'src':r['src'],'size':r['bytes'],'width':r['width'],'height':r['height'],
      'description':r['description'],'descriptionStatus':r['description_status']} for r in records]
(root/'assets/artworks.js').write_text('/* 本地水浒图集。描述按原图题字整理，〔〕内标记仍待核对的缺字；繁体转简体并补标点。 */\nwindow.BLOG_ARTWORKS = '+json.dumps(web,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
by_id={r['id']:r for r in records}
fallback=iter([by_id[5]['description'],by_id[40]['description']])
index=root/'index.html'
index.write_text(re.sub(r'<p class="art-description">.*?</p>',lambda _: '<p class="art-description">'+html.escape(next(fallback))+'</p>',index.read_text(encoding='utf-8')),encoding='utf-8')
lines=['# 水浒插图题字整理','',
    '按图片左右侧题字录入，繁体转简体，补标点和书名号。〔〕表示尚未确认的缺字或句段。图中文字较少的图片保留其原有题名、回目、创作日期及署款，不另外编写人物故事。','']
for r in records:
    lines.extend([f'## {r["id"]:03d} · {r["fileName"]}','',r['description'],''])
    if r.get('transcription_notes'):lines.extend(['待核位置：'+'；'.join(r['transcription_notes'])+'。',''])
(work/'题字整理.md').write_text('\n'.join(lines),encoding='utf-8')
with (work/'描述补充对照.csv').open('w',encoding='utf-8-sig',newline='') as file:
    writer=csv.writer(file);writer.writerow(['编号','图片','原描述','补充后描述','缺字状态'])
    for r in records:writer.writerow([r['id'],r['fileName'],old[r['id']]['description'],r['description'],'有待核字句' if '〔' in r['description'] else '可辨侧栏文字已录'])
length=lambda s:len(re.sub(r'〔.*?〕','',s))
stats={'images':181,'beforeCharacters':sum(length(r['description']) for r in before),
       'afterCharacters':sum(length(r['description']) for r in records),
       'withExplicitGaps':sum('〔' in r['description'] for r in records),
       'over100Characters':sum(length(r['description'])>100 for r in records)}
(work/'description-expansion-result.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(stats,ensure_ascii=False))
