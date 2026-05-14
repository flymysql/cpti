import json
from pathlib import Path
import quickjs
from openpyxl import Workbook

root = Path('/Users/jimmy/Downloads/cpti')
code = (root / 'data.js').read_text(encoding='utf-8')
ctx = quickjs.Context()
ctx.eval('var window = {};')
ctx.eval(code)
questions_json = ctx.eval('JSON.stringify(window.CPTI_DATA.questions)')
questions = json.loads(questions_json)

max_options = max(len(q.get('options', [])) for q in questions)

headers = ['id', 'kind', 'category', 'prompt', 'hint']
for i in range(1, max_options + 1):
    headers += [f'option{i}_label', f'option{i}_self', f'option{i}_need']

wb = Workbook()
ws = wb.active
ws.title = 'questions'
ws.append(headers)

for q in questions:
    row = [q.get('id', ''), q.get('kind', ''), q.get('category', ''), q.get('prompt', ''), q.get('hint', '')]
    options = q.get('options', [])
    for idx in range(max_options):
        if idx < len(options):
            opt = options[idx]
            row.append(opt.get('label', ''))
            row.append(json.dumps(opt.get('self', {}), ensure_ascii=False))
            row.append(json.dumps(opt.get('need', {}), ensure_ascii=False))
        else:
            row.extend(['', '', ''])
    ws.append(row)

output = root / 'cpti_question_bank.xlsx'
wb.save(output)
print(output)
