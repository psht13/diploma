# Layout Repair Notes

## Root cause

- Поломка `output/coursework_draft_ua_submission_ready_v2.docx` не була проблемою окремих абзацних tab/indent.
- Точна причина: у `scripts/create_submission_ready_doc_v2.py` функція `rebuild_appendices()` видаляла весь хвіст документа після `Додаток Г`, включно з фінальним `body/w:sectPr`.
- Через втрату `w:sectPr` документ фактично втратив:
  - `pgSz`;
  - `pgMar`;
  - `titlePg`;
  - прив'язку до `header/footer`;
  - коректне застосування поля `PAGE`.
- Саме це спричинило симптоми:
  - весь текстовий блок зсунувся вправо;
  - ширина тексту стала ненормально вузькою;
  - зникли page numbers;
  - сторінки почали рендеритися з поламаною геометрією.

## Як відновлено layout

- За еталон узято `assets/coursework_draft_ua_submission_ready.docx`.
- Патчено генератор `scripts/create_submission_ready_doc_v2.py`:
  - збереження `w:sectPr` під час перебудови додатків;
  - guard-перевірка, що документ не втратив sections;
  - параметризація генерації для окремого випуску `v3`.
- Згенеровано `output/coursework_draft_ua_submission_ready_v3.docx`.
- Після генерації технічно підтверджено:
  - `sectPr count = 1`;
  - `body sectPr = 1`;
  - `pgMar = top 1134 / right 567 / bottom 1134 / left 1134`;
  - `headerReference` і `footerReference` присутні;
  - у `word/header1.xml` присутнє поле `PAGE`;
  - у фінальному PNG-рендері page numbers відображаються на сторінках після титулу.

## Діаграми

- Створено окремий генератор `scripts/regenerate_submission_diagrams.py`.
- Повністю перевипущено:
  - рисунок 3.1 - компонентна архітектура;
  - рисунок 3.2 - структура `UserState` / `SessionMemory`;
  - рисунок 3.3 - sequence diagram;
  - рисунок 4.1 - runtime diagram.
- Нові assets вбудовано і в основний текст, і в додаток А:
  - основний текст через заміну embedded `word/media/image1..image4`;
  - додаток А через окремі вставки у фінальному генераторі.
- Додаток А рознесено по окремих сторінках, щоб зменшені копії діаграм залишалися читабельними.

## Таблиці

- Для таблиць увімкнено:
  - repeat header row;
  - row-level `cantSplit`.
- Таблицю 3.2 окремо стиснуто за шрифтом/міжрядковим інтервалом, щоб прибрати невдалий розрив.
- У клітинках зафіксовано:
  - `first line indent = 0`;
  - `left indent = 0`;
  - без прихованого глобального зсуву вправо.

## Підсумок

- Нормальну геометрію сторінки відновлено.
- Page numbering відновлено.
- Головний візуальний дефект `v2` був секційним, а не абзацним.
