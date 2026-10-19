"""Parseo de horarios: OpenTable (es/en), OpenStreetMap opening_hours y texto de Time Out.
Devuelve {'oh': [abre, cierra], 'dias': [0..6] (0=domingo), 'txt': resumen} o None."""
import re, unicodedata
DIA_ES = {'dom':0,'lun':1,'mar':2,'mie':3,'jue':4,'vie':5,'sab':6}
DIA_EN = {'su':0,'mo':1,'tu':2,'we':3,'th':4,'fr':5,'sa':6, 'sun':0,'mon':1,'tue':2,'wed':3,'thu':4,'fri':5,'sat':6}
def _n(s): return unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode().lower()
def _rango_dias(a, b):
    out = [a]; x = a
    while x != b: x = (x + 1) % 7; out.append(x)
    return out
def _hora(t, ampm=None):
    t = t.strip().lower().replace('.', '')
    m = re.match(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m)?', t)
    if not m: return None
    h = int(m.group(1)); mi = int(m.group(2) or 0); ap = (m.group(3) or ampm or '').replace(' ', '')
    if ap == 'pm' and h < 12: h += 12
    if ap == 'am' and h == 12: h = 0
    return h + mi / 60
ES = r'(lun|mar|mie|jue|vie|sab|dom)'
EN = r'(mon|tue|wed|thu|fri|sat|sun|mo|tu|we|th|fr|sa|su)'
def _dias_gen(txt, pat, tabla):
    t = _n(txt.replace('–', '-').replace('—', '-').replace(' a ', '-'))
    if re.search(r'todos los dias|diario|daily|every day', t): return list(range(7))
    dias = set()
    for m in re.finditer(pat + r'[a-z]*\.?\s*-\s*' + pat + r'[a-z]*', t):
        dias.update(_rango_dias(tabla[m.group(1)], tabla[m.group(2)]))
    t2 = re.sub(pat + r'[a-z]*\.?\s*-\s*' + pat + r'[a-z]*', ' ', t)
    for m in re.finditer(r'\b' + pat + r'[a-z]*\b', t2):
        dias.add(tabla[m.group(1)])
    return sorted(dias)
def _dias_es(txt): return _dias_gen(txt, ES, DIA_ES)
def _dias_en(txt): return _dias_gen(txt, EN, DIA_EN)
def _cierre(a, b):
    if b is None: return None
    if b <= a: b += 24
    return b
def _resumir(tramos):
    """tramos: lista de (dias, abre, cierra)."""
    tramos = [t for t in tramos if t[0] and t[1] is not None and t[2] is not None]
    if not tramos: return None
    dias = sorted(set(d for t in tramos for d in t[0]))
    abre = min(t[1] for t in tramos); cierra = max(t[2] for t in tramos)
    if cierra - abre > 20: cierra = abre + 20
    return {'oh': [round(abre, 2), round(cierra, 2)], 'dias': dias}
HR = r'(\d{1,2}(?::\d{2})?)\s*(a\.?\s?m\.?|p\.?\s?m\.?)?'
def _tramo(linea, ingles=False):
    m = re.search(HR + r'\s*[–—-]\s*' + HR, linea, re.I)
    if not m: return None
    ap1 = (m.group(2) or '').lower().replace('.', '').replace(' ', '')
    ap2 = (m.group(4) or '').lower().replace('.', '').replace(' ', '')
    a = _hora(m.group(1), ap1 or None); b = _hora(m.group(3), ap2 or None)
    if a is None or b is None: return None
    if not ap1 and ap2 == 'pm' and a < 12 and a + 12 <= b + 12 and ':' not in m.group(1) and a <= 11 and _hora(m.group(3), 'pm') > a + 12 - 0.01: a += 12
    if not ap1 and ap2 == 'am' and 1 <= a < 12 and ':' not in m.group(1): a += 12   # '5-2am' = 17:00 a 02:00
    dtxt = linea[:m.start()]
    dias = _dias_en(dtxt) if ingles else _dias_es(dtxt)
    if not dias and not re.search(r'[a-zA-Z]{3}', _n(dtxt)): dias = list(range(7))
    return (dias, a, _cierre(a, b))
def ot(txt):
    if not txt: return None
    ingles = bool(re.search(r'\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Daily)\b', txt))
    tramos = [t for t in (_tramo(l, ingles) for l in re.split(r'\n|;', txt)) if t]
    return _resumir(tramos)
def osm(txt):
    """'Mo-Th 12:00-22:00; Fr-Sa 12:00-22:30; Su 12:00-21:00'"""
    if not txt: return None
    if txt.strip() == '24/7': return {'oh': [0, 24], 'dias': list(range(7))}
    tramos = []
    for regla in txt.split(';'):
        regla = regla.strip()
        if not regla or re.search(r'\boff\b|closed', regla): continue
        m = re.match(r'((?:[A-Z][a-z](?:-[A-Z][a-z])?,?)*)\s*(.*)', regla)
        dtxt, htxt = m.group(1), m.group(2)
        dias = set()
        if not dtxt: dias = set(range(7))
        for parte in dtxt.split(','):
            if not parte: continue
            if '-' in parte:
                a, b = parte.split('-'); dias.update(_rango_dias(DIA_EN[a.lower()], DIA_EN[b.lower()]))
            elif parte.lower() in DIA_EN: dias.add(DIA_EN[parte.lower()])
        for hm in re.finditer(r'(\d{1,2}:\d{2})-(\d{1,2}:\d{2})', htxt):
            a = _hora(hm.group(1)); b = _cierre(a, _hora(hm.group(2)))
            tramos.append((sorted(dias), a, b))
    return _resumir(tramos)
def timeout(txt):
    if not txt or txt.strip() in ('-', ''): return None
    if '24 h' in _n(txt): return {'oh': [0, 24], 'dias': list(range(7))}
    partes = re.split(r';|,(?=\s*(?:lun|mar|mi|jue|vie|s[aá]b|dom|todos))', txt, flags=re.I)
    return _resumir([t for t in (_tramo(p) for p in partes) if t])
if __name__ == '__main__':
    print(ot('Lun, Mar 13:00–01:00\nMié–Sáb 13:00–02:00\nDom 13:00–00:00'))
    print(ot('Desayuno\nLun–Vie 07:00–11:30\nSáb, Dom 07:00–12:30\nCena\nDiario 18:30–22:30'))
    print(ot('Comida: Diario: 13:00pm – 18:00pm; Cena: Domingo: 18:00pm – 21:00pm'))
    print(ot('Mon–Thu 1:00 pm–11:00 pm\nFri, Sat 1:00 pm–12:00 am'))
    print(osm('Mo-Th 12:00-22:00; Fr-Sa 12:00-22:30; Su 12:00-21:00'))
    print(timeout('Mar-dom 1pm-12am')); print(timeout('Lun-vie 7am-11pm, Sáb 8am-11pm, dom 8am-10pm'))
    print(timeout('Mié-lun 6pm-2am')); print(timeout('Lun-dom 7-2am')); print(timeout('Lun-sáb 18:30-2am'))
