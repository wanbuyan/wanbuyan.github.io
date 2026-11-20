from pathlib import Path
import json,hashlib,shutil,csv

root=Path(__file__).resolve().parents[2]
source=Path(r'C:/Users/杨忠豪/Desktop/水浒插图').resolve()
assert source==Path(r'C:/Users/杨忠豪/Desktop/水浒插图').resolve()
destination=(root/'资料/水浒人物').resolve()
assert destination.parent==(root/'资料').resolve()
records=json.loads((root/'.design/bulk-import/catalog.json').read_text(encoding='utf-8'))
assert len(records)==181
def digest(file):return hashlib.sha256(file.read_bytes()).hexdigest()
# Validate every rename before changing the first file; never overwrite an unrelated file.
for row in records:
    original=source/row['original'];named=source/row['fileName']
    assert original.parent==source and named.parent==source
    existing=original if original.exists() else named
    assert existing.is_file() and not existing.is_symlink(),str(existing)
    assert digest(existing)==row['sha256'],str(existing)
    if original.exists() and named.exists() and original!=named:raise RuntimeError(f'Name collision: {named}')
    target=destination/row['fileName']
    if target.exists():assert digest(target)==row['sha256'],str(target)
destination.mkdir(parents=True,exist_ok=True)
shutil.copy2(root/'.design/bulk-import/命名与描述对照.csv',source/'命名与描述对照.csv')
for row in records:
    original=source/row['original'];named=source/row['fileName']
    if original.exists() and original!=named:original.rename(named)
    target=destination/row['fileName']
    if not target.exists():shutil.copy2(named,target)
    assert digest(named)==digest(target)==row['sha256']
web=[{'id':row['id'],'character':row['name'],'fileName':row['fileName'],'path':row['path'],
    'src':row['src'],'size':row['bytes'],'width':row['width'],'height':row['height'],
    'description':row['description'],'descriptionStatus':row['description_status']} for row in records]
(root/'assets/artworks.js').write_text('/* 本地水浒人物图集。描述仅使用人工确认的题字摘录；完整草书校对记录另存 .design/bulk-import。 */\nwindow.BLOG_ARTWORKS = '+json.dumps(web,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(root/'.design/bulk-import/import-result.json').write_text(json.dumps({'images':181,'source':str(source),'destination':str(destination),'sha256_verified':181,'source_renamed':True},ensure_ascii=False,indent=2),encoding='utf-8')
print('181 source files renamed, 181 static images copied, SHA-256 verified for every pair.')
