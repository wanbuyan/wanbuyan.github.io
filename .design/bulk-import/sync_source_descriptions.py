from pathlib import Path
import json,hashlib,shutil

root=Path(__file__).resolve().parents[2]
work=root/'.design/bulk-import'
source=Path(r'C:/Users/杨忠豪/Desktop/水浒插图').resolve()
assert source==Path(r'C:/Users/杨忠豪/Desktop/水浒插图').resolve()
old={r['id']:r for r in json.loads((work/'description-before-expansion.json').read_text(encoding='utf-8'))}
new=json.loads((work/'catalog.json').read_text(encoding='utf-8'))
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
renames=[]
for row in new:
    previous=old[row['id']]
    if row['fileName']==previous['fileName']:continue
    for folder in [source,(root/'资料/水浒人物').resolve()]:
        before=folder/previous['fileName'];after=folder/row['fileName']
        assert before.parent==after.parent==folder
        current=before if before.exists() else after
        assert current.is_file() and not current.is_symlink() and sha(current)==row['sha256']
        if before.exists():assert not after.exists();renames.append((before,after))
for before,after in renames:before.rename(after)
shutil.copy2(work/'命名与描述对照.csv',source/'命名与描述对照.csv')
print(f'{len(renames)} filename corrections synced; source description table updated.')
