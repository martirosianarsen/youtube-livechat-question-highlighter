import json,sys
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[1]) if len(sys.argv)>1 else root/'dist'
out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((root/'manifest.json').read_text())
files=['manifest.json','background.js','shared.js','panel.js','content.js','popup.html','popup.css','popup.js','settings.html','settings.css','settings.js']+[f'icons/YT_LC_QH_{n}.png' for n in (16,19,32,38,48,128)]
target=out/f'youtube-livechat-question-highlighter-{manifest["version"]}.zip'
with ZipFile(target,'w',ZIP_DEFLATED) as z:
 for name in files:z.write(root/name,name)
with ZipFile(target) as z:assert z.testzip() is None
print(f'{target} ({target.stat().st_size:,} bytes; {len(files)} runtime files)')
