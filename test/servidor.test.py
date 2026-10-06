# Pruebas del lado servidor: que el contexto de un plan SOBREVIVA al guardado.
# El defecto reportado ("5 personas llegan como 4, $1,500 se lee como ≤$600")
# no estaba en el frontend: lib/sobres.py descartaba esos campos al guardar.
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))
import sobres as S

fallos = []
def check(cond, msg):
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: fallos.append(msg)

PLAN = {
    'id': 'plan-qa-1', 'name': 'Plan: Rosetta → Traspatio', 'meta': '2 paradas',
    'stops': ['cdmx-2012', 'cdmx-2142'], 'times': [18, 21.5],
    'from': 18, 'to': 26, 'spent': 1280, 'date': '2026-10-07',
    'transport': 'uber', 'people': 5, 'who': 'amigos',
    'zone': 'roma', 'zonesSel': ['roma', 'romasur'], 'vibes': ['foodie', 'nightlife'],
    'budget': 'b1k', 'budgetCustom': 1500,
    'costo': {'conocido': 1408, 'consumo': 1280, 'propina': 128, 'seguro': False,
              'faltan': ['transporte en Uber'], 'estimados': ['2 precios estimados']},
    'ext': {}
}

print('\nServidor · el contexto del plan sobrevive al guardado')
S.STATE = S.blank_state()
err = S.apply_op('proposePlan', {'user': 'QA-Emisor', 'plan': PLAN})
check(err is None, 'proposePlan acepta el plan (err=%r)' % err)
g = S.find_plan('plan-qa-1')
check(g is not None, 'el plan quedó guardado')
if g:
    for k, esperado in [('people', 5), ('who', 'amigos'), ('zone', 'roma'),
                        ('budget', 'b1k'), ('budgetCustom', 1500), ('transport', 'uber'),
                        ('date', '2026-10-07')]:
        check(g.get(k) == esperado, '%s se guarda como %r (llegó %r)' % (k, esperado, g.get(k)))
    check(g.get('zonesSel') == ['roma', 'romasur'], 'zonesSel se guarda completo')
    check(g.get('vibes') == ['foodie', 'nightlife'], 'vibes se guarda completo')
    c = g.get('costo') or {}
    check(c.get('conocido') == 1408 and c.get('propina') == 128,
          'los componentes de costo viajan etiquetados')
    check(c.get('faltan') == ['transporte en Uber'], 'lo que falta del costo viaja')
    check(g.get('spent') == 1280, 'el consumo viaja')

print('\nServidor · tamaños de grupo distintos no se pisan con el defecto 4')
for n in (1, 2, 5, 7):
    S.STATE = S.blank_state()
    pl = dict(PLAN); pl['people'] = n; pl['id'] = 'plan-qa-%d' % n
    S.apply_op('proposePlan', {'user': 'QA', 'plan': pl})
    g2 = S.find_plan(pl['id'])
    check(g2 and g2.get('people') == n, '%d personas se guardan como %r' % (n, g2 and g2.get('people')))

print('\nServidor · un plan sin contexto no inventa números')
S.STATE = S.blank_state()
S.apply_op('proposePlan', {'user': 'QA', 'plan': {'id': 'p2', 'name': 'x', 'stops': ['a']}})
g3 = S.find_plan('p2')
check(g3.get('people') == 0, 'sin personas declaradas queda en 0, no en 4')
check(g3.get('budgetCustom') is None, 'sin tope declarado queda en None')

print('\n' + ('✗ %d fallaron' % len(fallos) if fallos else '✓ todas pasaron'))
sys.exit(1 if fallos else 0)
