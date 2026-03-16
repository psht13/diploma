# Manual Actions

- Відкрити [coursework_draft_ua_submission_ready_v6.docx](/Users/pavloyurchenko/Documents/labs/diploma/output/coursework_draft_ua_submission_ready_v6.docx) у desktop Word або LibreOffice і зробити останній візуальний pass перед поданням.
- Якщо в курсовій є screenshot старого UI, вручну замінити його одним з нових артефактів із [output/playwright/ui-rewrite](/Users/pavloyurchenko/Documents/labs/diploma/output/playwright/ui-rewrite).
- Якщо демонстрація прототипу проходитиме без інтернету, окремо перевірити fallback-відображення шрифтів або за потреби self-host web-fonts.
- Якщо на demo-машині потрібен live LLM-flow, окремо перевірити локальний `ollama serve` і наявність моделі `llama3.1:8b`.
- Для мобільної презентації або запису екрана бажано ще раз вручну проглянути сценарії на вузькому viewport, хоча автоматичний browser pass помилок layout не виявив.
