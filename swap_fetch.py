import pathlib, re
p = pathlib.Path('D:/AIAGENT/AgentForAppling/apps/web/src/App.tsx')
t = p.read_text(encoding='utf-8')

# 1) Template-literal fetches: fetch(`${API_URL}/x`  -> api('/x`
t = re.sub(r"fetch\(`\$\{API_URL\}([^`]*)`", r"api(\1", t)
# 2) Single-quoted fetches: fetch('${API_URL}/x'  -> api('/x'
t = re.sub(r"fetch\('\$\{API_URL\}([^']*)'", r"api('\1", t)
# 3) fetch('${API_URL}' with no path
t = t.replace("fetch('${API_URL}')", "api('')")

# 4) href links to documents should keep absolute URL (browser downloads) — leave as is.
p.write_text(t, encoding='utf-8')
left = [l.strip() for l in t.split('\n') if 'localhost:4000' in l]
print('remaining localhost lines:', left)
print('api( calls:', t.count('api('))
