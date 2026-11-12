"""카톡 미리보기 이미지(og/*.png, 1200x630)를 만든다.
준비: pip install playwright && python3 -m playwright install chromium
실행: python3 tools/og/render_og.py"""
import asyncio,json,os,urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
TPL='file://'+os.path.join(HERE,'og-template.html')
from playwright.async_api import async_playwright
G=json.load(open(os.path.join(HERE,'grades.json'),encoding='utf-8'))
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(**({'executable_path':os.environ['CHROME']} if os.environ.get('CHROME') else {}))
    pg=await b.new_page(viewport={'width':1200,'height':630},device_scale_factor=1)
    for g in G:
      q=urllib.parse.urlencode({'badge':g['badge'],'c':g['c'],'grade':g['grade'],'tag':g['tag'],'ra':g['ra'],'gs':g['gs']})
      await pg.goto(TPL+'?'+q); await pg.wait_for_timeout(300)
      await pg.screenshot(path=os.path.join(ROOT,'og',g['slug']+'.png'))
    q=urllib.parse.urlencode({'nobadge':'1','lead':'사고 영상을 보고','grade':'몇 대 몇인지 맞혀보세요','tag':'신호위반, 비보호 좌회전, 유턴, 꼬리물기까지 내 과실 판단력 테스트','gs':'60px','ra':'?:?'})
    await pg.goto(TPL+'?'+q); await pg.wait_for_timeout(300)
    await pg.screenshot(path=os.path.join(ROOT,'og','main.png'))
    # 문제 하나 공유 카드 (og/q/*.png). 정답 대신 ?:?
    import sys; sys.path.insert(0,HERE); from questions import load
    os.makedirs(os.path.join(ROOT,'og','q'),exist_ok=True)
    for x in load():
      q=urllib.parse.urlencode({'nobadge':'1','lead':'이 사고, 몇 대 몇?','grade':x['t'],'tag':x['s'],'cta':'너는 맞힐 수 있어? →',
                                'gs':'50px' if len(x['t'])>13 else '58px','ts':'22px','ra':'?:?'})
      await pg.goto(TPL+'?'+q); await pg.wait_for_timeout(200)
      await pg.screenshot(path=os.path.join(ROOT,'og','q',x['id']+'.png'))
    await b.close()
asyncio.run(main())
