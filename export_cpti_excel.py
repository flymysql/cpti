from __future__ import annotations

import json
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent
DATA_JS = ROOT / 'data.js'
OUTPUT = ROOT / 'CPTI题库与人格导出_当前版.xlsx'
FONT_NAME = 'Arial'

NODE_SCRIPT = r"""
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(process.argv[1], 'utf8');
const context = {
  window: {},
  document: {
    documentElement: { style: { setProperty() {} } },
    querySelector: () => null,
    querySelectorAll: () => [],
    createElementNS: () => ({ setAttribute() {}, appendChild() {}, innerHTML: '', style: {} }),
    createElement: () => ({ setAttribute() {}, appendChild() {}, innerHTML: '', style: {} }),
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  },
  console,
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(code, context);
process.stdout.write(JSON.stringify(context.window.CPTI_DATA));
"""


SHEETS = [
    ('题目清单', ['题号', '阶段', '题型', '题目', '提示', '选项数', '对话上下文', '选项摘要'], {4, 5, 7, 8}),
    ('选项权重', ['题号', '阶段', '题型', '题目', '选项序号', '选项文案', '自我权重（人格名）', '适配权重（人格名）', '自我权重（原始ID）', '适配权重（原始ID）'], {4, 6, 7, 8, 9, 10}),
    ('人格类型', ['编号', '内部ID', '缩写', '名称', '标签', '简介', '长介绍', '自我一句话', '适配简介', '适配长介绍', '适配一句话', '详情文案', '强调色'], {5, 6, 7, 8, 9, 10, 11, 12}),
]


def load_cpti_data() -> dict:
    result = subprocess.run(
        ['node', '-e', NODE_SCRIPT, str(DATA_JS)],
        check=True,
        capture_output=True,
        text=True,
        encoding='utf-8',
    )
    return json.loads(result.stdout)


def format_weights(weights: dict[str, int], name_map: dict[str, str], raw: bool = False) -> str:
    if not weights:
        return ''
    items = sorted(weights.items(), key=lambda item: (-item[1], item[0]))
    if raw:
        return '；'.join(f'{key}:{value}' for key, value in items)
    return '；'.join(f"{name_map.get(key, key)}（{key}）:{value}" for key, value in items)


def col_letter(index: int) -> str:
    result = []
    while index > 0:
        index, rem = divmod(index - 1, 26)
        result.append(chr(65 + rem))
    return ''.join(reversed(result))


def cell_ref(row: int, column: int) -> str:
    return f'{col_letter(column)}{row}'


def xml_attr(value: str) -> str:
    return escape(value, {'"': '&quot;'})


def xml_text(value: object) -> str:
    return escape('' if value is None else str(value))


def calc_width(value: object) -> int:
    text = '' if value is None else str(value)
    return max((len(line) for line in text.splitlines()), default=0)


def build_cols_xml(rows: list[list[object]]) -> str:
    column_count = max((len(row) for row in rows), default=0)
    if column_count == 0:
        return ''
    pieces = ['<cols>']
    for column in range(1, column_count + 1):
        max_len = max(calc_width(row[column - 1]) if column - 1 < len(row) else 0 for row in rows)
        width = min(max(max_len + 2, 12), 48)
        pieces.append(f'<col min="{column}" max="{column}" width="{width}" customWidth="1"/>')
    pieces.append('</cols>')
    return ''.join(pieces)


def build_row_xml(row_index: int, values: list[object], wrap_columns: set[int], is_header: bool) -> str:
    cells = []
    for column_index, value in enumerate(values, start=1):
        style = 1 if is_header else (2 if column_index in wrap_columns else 0)
        cells.append(
            f'<c r="{cell_ref(row_index, column_index)}" t="inlineStr" s="{style}">' \
            f'<is><t xml:space="preserve">{xml_text(value)}</t></is></c>'
        )
    return f'<row r="{row_index}">{"".join(cells)}</row>'


def build_sheet_xml(headers: list[str], rows: list[list[object]], wrap_columns: set[int]) -> str:
    all_rows = [headers, *rows]
    end_cell = cell_ref(max(len(all_rows), 1), max(len(headers), 1))
    cols_xml = build_cols_xml(all_rows)
    row_xml = [build_row_xml(1, headers, wrap_columns, True)]
    for index, row in enumerate(rows, start=2):
        row_xml.append(build_row_xml(index, row, wrap_columns, False))
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<dimension ref="A1:{end_cell}"/>'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
        'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        '<sheetFormatPr defaultRowHeight="18"/>'
        f'{cols_xml}'
        f'<sheetData>{"".join(row_xml)}</sheetData>'
        f'<autoFilter ref="A1:{end_cell}"/>'
        '</worksheet>'
    )


def build_content_types(sheet_count: int) -> str:
    overrides = ''.join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        f'{overrides}'
        '</Types>'
    )


def build_root_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )


def build_workbook_xml(sheet_names: list[str]) -> str:
    sheets_xml = ''.join(
        f'<sheet name="{xml_attr(name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, name in enumerate(sheet_names, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<bookViews><workbookView activeTab="0"/></bookViews>'
        f'<sheets>{sheets_xml}</sheets>'
        '</workbook>'
    )


def build_workbook_rels(sheet_count: int) -> str:
    rels = ''.join(
        f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, sheet_count + 1)
    )
    rels += f'<Relationship Id="rId{sheet_count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'{rels}'
        '</Relationships>'
    )


def build_styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2">'
        f'<font><sz val="11"/><name val="{FONT_NAME}"/><family val="2"/></font>'
        f'<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="{FONT_NAME}"/><family val="2"/></font>'
        '</fonts>'
        '<fills count="3">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>'
        '</fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="3">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
        '</cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>'
    )


def build_app_xml(sheet_names: list[str]) -> str:
    titles = ''.join(f'<vt:lpstr>{xml_text(name)}</vt:lpstr>' for name in sheet_names)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<Application>Microsoft Excel</Application>'
        f'<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>{len(sheet_names)}</vt:i4></vt:variant></vt:vector></HeadingPairs>'
        f'<TitlesOfParts><vt:vector size="{len(sheet_names)}" baseType="lpstr">{titles}</vt:vector></TitlesOfParts>'
        '</Properties>'
    )


def build_core_xml() -> str:
    created = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        '<dc:title>CPTI题库与人格导出</dc:title>'
        '<dc:creator>CodeBuddy</dc:creator>'
        '<cp:lastModifiedBy>CodeBuddy</cp:lastModifiedBy>'
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>'
        '</cp:coreProperties>'
    )


def write_workbook(sheet_payloads: list[tuple[str, list[str], list[list[object]], set[int]]]) -> None:
    sheet_names = [payload[0] for payload in sheet_payloads]
    with zipfile.ZipFile(OUTPUT, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('[Content_Types].xml', build_content_types(len(sheet_payloads)))
        zf.writestr('_rels/.rels', build_root_rels())
        zf.writestr('docProps/app.xml', build_app_xml(sheet_names))
        zf.writestr('docProps/core.xml', build_core_xml())
        zf.writestr('xl/workbook.xml', build_workbook_xml(sheet_names))
        zf.writestr('xl/_rels/workbook.xml.rels', build_workbook_rels(len(sheet_payloads)))
        zf.writestr('xl/styles.xml', build_styles_xml())
        for index, (_, headers, rows, wrap_columns) in enumerate(sheet_payloads, start=1):
            zf.writestr(f'xl/worksheets/sheet{index}.xml', build_sheet_xml(headers, rows, wrap_columns))


def main() -> None:
    data = load_cpti_data()
    questions = data['questions']
    profiles = sorted(data['profiles'].values(), key=lambda item: item['code'])
    name_map = {profile['id']: profile['name'] for profile in profiles}

    question_rows: list[list[object]] = []
    option_rows: list[list[object]] = []
    profile_rows: list[list[object]] = []

    for question in questions:
        dialogue = '\n'.join(f"{entry.get('role', '')}: {entry.get('text', '')}" for entry in question.get('dialogue', []))
        option_summary = '\n'.join(
            f"{index}. {option['label']}" for index, option in enumerate(question.get('options', []), start=1)
        )
        question_rows.append([
            question['id'],
            question['category'],
            question['kind'],
            question['prompt'],
            question.get('hint', ''),
            len(question.get('options', [])),
            dialogue,
            option_summary,
        ])

        for index, option in enumerate(question.get('options', []), start=1):
            option_rows.append([
                question['id'],
                question['category'],
                question['kind'],
                question['prompt'],
                index,
                option['label'],
                format_weights(option.get('self', {}), name_map, raw=False),
                format_weights(option.get('need', {}), name_map, raw=False),
                format_weights(option.get('self', {}), name_map, raw=True),
                format_weights(option.get('need', {}), name_map, raw=True),
            ])

    for profile in profiles:
        profile_rows.append([
            profile['code'],
            profile['id'],
            profile.get('abbr', ''),
            profile['name'],
            '、'.join(profile.get('tags', [])),
            profile.get('description', ''),
            profile.get('longDescription', ''),
            profile.get('note', ''),
            profile.get('needDescription', ''),
            profile.get('needLongDescription', ''),
            profile.get('needNote', ''),
            profile.get('detailEssay', ''),
            profile.get('accent', ''),
        ])

    payloads = [
        (SHEETS[0][0], SHEETS[0][1], question_rows, SHEETS[0][2]),
        (SHEETS[1][0], SHEETS[1][1], option_rows, SHEETS[1][2]),
        (SHEETS[2][0], SHEETS[2][1], profile_rows, SHEETS[2][2]),
    ]
    write_workbook(payloads)
    print(str(OUTPUT))
    print(json.dumps({'questions': len(question_rows), 'options': len(option_rows), 'profiles': len(profile_rows)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
