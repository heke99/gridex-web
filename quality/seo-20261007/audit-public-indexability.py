import urllib.request, urllib.error, xml.etree.ElementTree as ET, json, concurrent.futures, re
from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit
from collections import Counter
BASE='https://gridex.se'
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.title='';self.h1=[];self.canonical=[];self.robots=[];self.links=set();self.active=None;self.skip=0
 def handle_starttag(self,t,a):
  a=dict(a)
  if t in ('title','h1'):self.active=t;self.buf=''
  if t=='meta' and a.get('name','').lower() in ('robots','googlebot'):self.robots.append(a.get('content',''))
  if t=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href',''))
  if t=='a' and a.get('href'):self.links.add(urljoin(BASE,a['href']))
 def handle_data(self,d):
  if self.active:self.buf+=d
 def handle_endtag(self,t):
  if t==self.active:
   if t=='title':self.title=self.buf
   if t=='h1':self.h1.append(self.buf)
   self.active=None

def get(url):
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'GridexSEOAudit/1.0'}),timeout=30) as r:
   html=r.read().decode('utf-8','replace');p=Parser();p.feed(html)
   return dict(url=url,status=r.status,final_url=r.url,title=p.title,h1=p.h1,canonical=p.canonical,robots=p.robots,x_robots=r.headers.get('X-Robots-Tag'),links=sorted(x for x in p.links if urlsplit(x).hostname=='gridex.se'),html_bytes=len(html.encode()))
 except Exception as e:return dict(url=url,error=str(e))
with urllib.request.urlopen(BASE+'/sitemap.xml',timeout=30) as r: xml=r.read()
root=ET.fromstring(xml);urls=[e.text for e in root.iter() if e.tag.endswith('}loc')]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:rows=list(pool.map(get,urls))
report=dict(base=BASE,sitemap_url_count=len(urls),sitemap_duplicate_urls=[u for u,n in Counter(urls).items() if n>1],rows=rows)
open('/tmp/gridex-index-audit.json','w').write(json.dumps(report,ensure_ascii=False,indent=2))
print('Pages',len(rows),'errors',sum('error' in r for r in rows))
for r in rows:
 problems=[]
 if 'error' in r:problems.append(r['error'])
 else:
  if r['url'].rstrip('/')!=r['final_url'].rstrip('/'):problems.append('redirect '+r['final_url'])
  if len(r['canonical'])!=1 or r['canonical'][0].rstrip('/')!=r['url'].rstrip('/'):problems.append('canonical '+str(r['canonical']))
  if any('noindex' in v.lower() for v in r['robots']+[r.get('x_robots') or '']):problems.append('noindex')
  if len(r['h1'])!=1:problems.append('h1 count '+str(len(r['h1'])))
 if problems:print(r['url'],':','; '.join(problems))
print('Duplicate titles',[(t,n) for t,n in Counter(r.get('title') for r in rows if 'error' not in r).items() if n>1])
