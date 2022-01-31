import os,re
from urllib import parse

def covert_path(path:str) -> str:
    return re.sub(r'[:*?\'"<>|]','_',path)

def crawl_one(url:str):
    s = parse.urlsplit(url)
    t = [s.netloc]
    if s.path:
        t.extend(s.path.split('/'))
    if len(t) == 1:
        t.append('index.html')
    path = os.path.join(*t)
    dn,fn = os.path.split(path)
    os.makedirs(dn,exist_ok=True)
    if s.query:
        q = s.query
        try:
            t1,t2 = fn.rsplit('.',1)
            fn = f'{t1}_{q}{t2}'
        except ValueError:
            fn = f'{fn}_{q}'
        path = os.path.join(dn,fn)
    path = covert_path(path)
    cmd = f"axel -o '{path}' '{url}'"
    print(cmd)
    os.system(cmd)

def main():
    while 1:
        url = input()
        if not url:break
        crawl_one(url)

if __name__ == '__main__':
    main()
