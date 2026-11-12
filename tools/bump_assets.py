"""index.html의 css, js 주소 뒤에 내용 해시(?v=)를 붙인다. 실행: python3 tools/bump_assets.py
GitHub Pages는 파일을 10분 캐시해서, 해시가 없으면 새 index.html과 예전 app.js가 섞일 수 있다.
css나 js를 고친 뒤 커밋 전에 돌릴 것."""
import hashlib,os,re
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
p=os.path.join(ROOT,'index.html');s=open(p,encoding='utf-8').read()
def ver(m):
    path=m.group(2)
    h=hashlib.sha1(open(os.path.join(ROOT,path),'rb').read()).hexdigest()[:8]
    return f'{m.group(1)}{path}?v={h}"'
s2=re.sub(r'((?:href|src)=")((?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=\w+)?"',ver,s)
open(p,'w',encoding='utf-8').write(s2)
print('\n'.join(l for l in s2.splitlines() if '?v=' in l))
