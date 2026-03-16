# Template Style Manifest

## Source
- Template: `assets/coursework_draft_ua_submission_ready_template.docx`

## Page Format
- Size: 210.009 x 297.004 mm.
- Orientation: `portrait`.
- Margins: top 20.002 mm, right 10.001 mm, bottom 20.002 mm, left 20.002 mm.
- Header/footer distances: header 12.7 mm, footer 12.7 mm.
- Title page enabled: `True`.

## Base Body Style
- `Normal`: font Times New Roman, 14.0 pt, first-line 12.506 mm, before 0.0 pt, after 0.0 pt.
- Expected body text model: `Times New Roman`, 14 pt, justified, 1.5 line spacing, first-line indent about 12.5 mm.

## Heading Hierarchy
- `Heading 1`: font Times New Roman, 14.0 pt, bold, before 24.0 pt, after 0.0 pt. Samples: 'АНОТАЦІЯ'; 'ABSTRACT'.
- `Heading 2`: font Times New Roman, 14.0 pt, bold, before 10.0 pt, after 0.0 pt. Samples: '1.1. Поняття та класифікація інтелектуальних навчальних систем (ITS/АІНС)'; '1.2. Архітектурні компоненти АІНС'.
- `Heading 3`: font Times New Roman, 14.0 pt, bold, before 10.0 pt, after 0.0 pt. Samples: '3.5.1. Формальне визначення агента-репетитора'; '3.5.2. Архітектура агента - компонентна модель'.

## Caption Styles
- `Caption`: 9.0 pt, bold.
- `ListingCaption`: font Times New Roman, 12.0 pt, bold, first-line 0.0 mm, before 6.0 pt, after 3.0 pt.
- `AppendixFigureLabel`: font Times New Roman, 12.0 pt, bold, first-line 0.0 mm, before 6.0 pt, after 3.0 pt.

## Special Styles
- `SourceNote`: font Times New Roman, 11.0 pt, italic, first-line 0.0 mm, before 0.0 pt, after 6.0 pt.
- `DialogueBlock`: font Times New Roman, 14.0 pt, left 10.001 mm, before 0.0 pt, after 3.0 pt.
- `CodeBlock`: font Courier New, 9.5 pt, first-line 0.0 mm, left 0.0 mm, before 0.0 pt, after 6.0 pt.
- `PromptBlock`: font Courier New, 10.5 pt, first-line 0.0 mm, left 0.0 mm, before 0.0 pt, after 6.0 pt.

## Table Rules
- Observed table style: `Table Grid`; alignment `center`; layout `default`.
- Header rows flagged with `tblHeader`: 1. Rows with `cantSplit`: 5.
- Sample cell paragraph alignment distribution: {'center': 2, 'left': 2}.
- Sample cell paragraph indent tuples `(left_mm, firstLine_mm)`: {(0.0, 0.0): 4}.

## List Rules
- Numbered list levels observed: [{'num_fmt': 'decimal', 'lvl_text': '%1.', 'p_style_name': None, 'indent_mm': 31.75}, {'num_fmt': 'decimal', 'lvl_text': '%1.', 'p_style_name': None, 'indent_mm': 25.4}, {'num_fmt': 'decimal', 'lvl_text': '%1.', 'p_style_name': 'List Number 3', 'indent_mm': 19.05}].
- Bulleted list levels observed: [{'num_fmt': 'bullet', 'lvl_text': None, 'p_style_name': None, 'indent_mm': None}, {'num_fmt': 'bullet', 'lvl_text': None, 'p_style_name': None, 'indent_mm': None}, {'num_fmt': 'bullet', 'lvl_text': None, 'p_style_name': None, 'indent_mm': None}].

## Page Numbering
- Headers with PAGE field: 1.
- Footers with PAGE field: 0.

## Allowed Style Exceptions
- Title-page typography and spacing may differ from body text if they match the template title block.
- The title-page layout table is structural and must not be counted as a substantive table in annotation metrics.
- English abstract text is allowed where the template already uses English content.
- Monospaced `CodeBlock` and `PromptBlock` content must remain exempt from language-normalization passes.
