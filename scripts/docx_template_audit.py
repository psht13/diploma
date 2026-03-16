from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from zipfile import ZipFile
import xml.etree.ElementTree as ET


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dc": "http://purl.org/dc/elements/1.1/",
    "dcterms": "http://purl.org/dc/terms/",
}

W = "{%s}" % NS["w"]
R = "{%s}" % NS["r"]

FORBIDDEN_META_PATTERNS = [
    r"\bmanual\b",
    r"вручну",
    r"\bручн(е|ий|ого|ому|им|их)\b",
    r"workflow",
    r"dev-log",
    r"автентичн(і|ий|ого) фрагмент",
    r"не вигадувал",
    r"не вигадує",
]

TRACKED_STYLE_NAMES = [
    "Normal",
    "Heading 1",
    "Heading 2",
    "Heading 3",
    "Caption",
    "ListingCaption",
    "SourceNote",
    "PromptBlock",
    "CodeBlock",
    "DialogueBlock",
    "AppendixFigureLabel",
]


def ns_attr(name: str) -> str:
    prefix, local = name.split(":")
    return "{%s}%s" % (NS[prefix], local)


def get_val(el: ET.Element | None) -> str | None:
    if el is None:
        return None
    return el.get(ns_attr("w:val")) or el.get("val")


def to_bool(el: ET.Element | None) -> bool | None:
    if el is None:
        return None
    value = get_val(el)
    if value is None:
        return True
    return value not in {"0", "false", "False", "off"}


def twips_to_pt(value: str | None) -> float | None:
    if value is None:
        return None
    return round(int(value) / 20, 2)


def twips_to_mm(value: str | None) -> float | None:
    if value is None:
        return None
    return round(int(value) * 25.4 / 1440, 3)


def half_points_to_pt(value: str | None) -> float | None:
    if value is None:
        return None
    return round(int(value) / 2, 2)


def normalize_text(text: str) -> str:
    return " ".join(text.replace("\u00a0", " ").split())


def read_xml(archive: ZipFile, part_name: str) -> ET.Element | None:
    try:
        return ET.fromstring(archive.read(part_name))
    except KeyError:
        return None


def parse_core_props(archive: ZipFile) -> dict[str, Any]:
    root = read_xml(archive, "docProps/core.xml")
    if root is None:
        return {}
    data: dict[str, Any] = {}
    for tag in ("title", "subject", "creator", "description"):
        el = root.find(f"dc:{tag}", NS)
        if el is not None and el.text:
            data[tag] = el.text
    created = root.find("dcterms:created", NS)
    modified = root.find("dcterms:modified", NS)
    if created is not None and created.text:
        data["created"] = created.text
    if modified is not None and modified.text:
        data["modified"] = modified.text
    return data


def parse_fonts(rpr: ET.Element | None) -> dict[str, Any]:
    if rpr is None:
        return {}
    fonts = rpr.find("w:rFonts", NS)
    data: dict[str, Any] = {
        "ascii": fonts.get(ns_attr("w:ascii")) if fonts is not None else None,
        "hAnsi": fonts.get(ns_attr("w:hAnsi")) if fonts is not None else None,
        "eastAsia": fonts.get(ns_attr("w:eastAsia")) if fonts is not None else None,
        "cs": fonts.get(ns_attr("w:cs")) if fonts is not None else None,
        "size_pt": half_points_to_pt(get_val(rpr.find("w:sz", NS))),
        "size_cs_pt": half_points_to_pt(get_val(rpr.find("w:szCs", NS))),
        "bold": to_bool(rpr.find("w:b", NS)),
        "italic": to_bool(rpr.find("w:i", NS)),
        "underline": get_val(rpr.find("w:u", NS)),
        "color": get_val(rpr.find("w:color", NS)),
        "highlight": get_val(rpr.find("w:highlight", NS)),
        "vert_align": get_val(rpr.find("w:vertAlign", NS)),
        "lang": {
            "val": None,
            "eastAsia": None,
            "bidi": None,
        },
    }
    lang = rpr.find("w:lang", NS)
    if lang is not None:
        data["lang"] = {
            "val": lang.get(ns_attr("w:val")),
            "eastAsia": lang.get(ns_attr("w:eastAsia")),
            "bidi": lang.get(ns_attr("w:bidi")),
        }
    if not any(v not in (None, {}, {"val": None, "eastAsia": None, "bidi": None}) for v in data.values()):
        return {}
    return data


def parse_ind(ind: ET.Element | None) -> dict[str, Any]:
    if ind is None:
        return {}
    return {
        "left_twips": ind.get(ns_attr("w:left")),
        "left_mm": twips_to_mm(ind.get(ns_attr("w:left"))),
        "right_twips": ind.get(ns_attr("w:right")),
        "right_mm": twips_to_mm(ind.get(ns_attr("w:right"))),
        "firstLine_twips": ind.get(ns_attr("w:firstLine")),
        "firstLine_mm": twips_to_mm(ind.get(ns_attr("w:firstLine"))),
        "hanging_twips": ind.get(ns_attr("w:hanging")),
        "hanging_mm": twips_to_mm(ind.get(ns_attr("w:hanging"))),
    }


def parse_spacing(spacing: ET.Element | None) -> dict[str, Any]:
    if spacing is None:
        return {}
    line = spacing.get(ns_attr("w:line"))
    return {
        "before_twips": spacing.get(ns_attr("w:before")),
        "before_pt": twips_to_pt(spacing.get(ns_attr("w:before"))),
        "after_twips": spacing.get(ns_attr("w:after")),
        "after_pt": twips_to_pt(spacing.get(ns_attr("w:after"))),
        "line_raw": line,
        "line_rule": spacing.get(ns_attr("w:lineRule")),
        "line_pt": twips_to_pt(line),
    }


def parse_tabs(ppr: ET.Element | None) -> list[dict[str, Any]]:
    tabs_el = ppr.find("w:tabs", NS) if ppr is not None else None
    if tabs_el is None:
        return []
    items = []
    for tab in tabs_el.findall("w:tab", NS):
        pos = tab.get(ns_attr("w:pos"))
        items.append(
            {
                "val": tab.get(ns_attr("w:val")),
                "leader": tab.get(ns_attr("w:leader")),
                "pos_twips": pos,
                "pos_mm": twips_to_mm(pos),
            }
        )
    return items


def parse_num_pr(ppr: ET.Element | None) -> dict[str, Any]:
    numpr = ppr.find("w:numPr", NS) if ppr is not None else None
    if numpr is None:
        return {}
    ilvl = numpr.find("w:ilvl", NS)
    num_id = numpr.find("w:numId", NS)
    return {"ilvl": get_val(ilvl), "numId": get_val(num_id)}


def parse_paragraph_props(ppr: ET.Element | None) -> dict[str, Any]:
    if ppr is None:
        return {}
    data = {
        "style_id": get_val(ppr.find("w:pStyle", NS)),
        "align": get_val(ppr.find("w:jc", NS)),
        "indent": parse_ind(ppr.find("w:ind", NS)),
        "spacing": parse_spacing(ppr.find("w:spacing", NS)),
        "keep_next": to_bool(ppr.find("w:keepNext", NS)),
        "keep_lines": to_bool(ppr.find("w:keepLines", NS)),
        "page_break_before": to_bool(ppr.find("w:pageBreakBefore", NS)),
        "contextual_spacing": to_bool(ppr.find("w:contextualSpacing", NS)),
        "tabs": parse_tabs(ppr),
        "num_pr": parse_num_pr(ppr),
    }
    if not any(value not in (None, {}, []) for value in data.values()):
        return {}
    return data


def paragraph_text(paragraph_el: ET.Element) -> str:
    parts: list[str] = []
    for node in paragraph_el.iter():
        if node.tag == f"{W}t":
            parts.append(node.text or "")
        elif node.tag == f"{W}tab":
            parts.append("\t")
        elif node.tag == f"{W}br":
            parts.append("\n")
        elif node.tag == f"{W}cr":
            parts.append("\n")
        elif node.tag == f"{W}noBreakHyphen":
            parts.append("-")
    return "".join(parts)


def run_text(run_el: ET.Element) -> str:
    return paragraph_text(run_el)


def parse_run(run_el: ET.Element, style_name_by_id: dict[str, str]) -> dict[str, Any]:
    rpr = run_el.find("w:rPr", NS)
    style_id = get_val(rpr.find("w:rStyle", NS)) if rpr is not None else None
    instr = "".join(node.text or "" for node in run_el.findall("w:instrText", NS))
    fld_chars = [node.get(ns_attr("w:fldCharType")) for node in run_el.findall("w:fldChar", NS)]
    return {
        "text": run_text(run_el),
        "style_id": style_id,
        "style_name": style_name_by_id.get(style_id),
        "props": parse_fonts(rpr),
        "field_instruction": instr or None,
        "field_chars": fld_chars,
    }


def parse_sect_pr(sect_pr: ET.Element | None, rels: dict[str, str]) -> dict[str, Any]:
    if sect_pr is None:
        return {}
    pg_sz = sect_pr.find("w:pgSz", NS)
    pg_mar = sect_pr.find("w:pgMar", NS)
    pg_num = sect_pr.find("w:pgNumType", NS)
    refs = []
    for kind in ("headerReference", "footerReference"):
        for ref in sect_pr.findall(f"w:{kind}", NS):
            rel_id = ref.get(ns_attr("r:id"))
            refs.append(
                {
                    "kind": kind,
                    "type": ref.get(ns_attr("w:type")),
                    "rId": rel_id,
                    "target": rels.get(rel_id),
                }
            )
    return {
        "page_size": {
            "w_twips": pg_sz.get(ns_attr("w:w")) if pg_sz is not None else None,
            "h_twips": pg_sz.get(ns_attr("w:h")) if pg_sz is not None else None,
            "w_mm": twips_to_mm(pg_sz.get(ns_attr("w:w")) if pg_sz is not None else None),
            "h_mm": twips_to_mm(pg_sz.get(ns_attr("w:h")) if pg_sz is not None else None),
            "orient": pg_sz.get(ns_attr("w:orient")) if pg_sz is not None else None,
        },
        "page_margins": {
            "top_twips": pg_mar.get(ns_attr("w:top")) if pg_mar is not None else None,
            "right_twips": pg_mar.get(ns_attr("w:right")) if pg_mar is not None else None,
            "bottom_twips": pg_mar.get(ns_attr("w:bottom")) if pg_mar is not None else None,
            "left_twips": pg_mar.get(ns_attr("w:left")) if pg_mar is not None else None,
            "header_twips": pg_mar.get(ns_attr("w:header")) if pg_mar is not None else None,
            "footer_twips": pg_mar.get(ns_attr("w:footer")) if pg_mar is not None else None,
            "gutter_twips": pg_mar.get(ns_attr("w:gutter")) if pg_mar is not None else None,
            "top_mm": twips_to_mm(pg_mar.get(ns_attr("w:top")) if pg_mar is not None else None),
            "right_mm": twips_to_mm(pg_mar.get(ns_attr("w:right")) if pg_mar is not None else None),
            "bottom_mm": twips_to_mm(pg_mar.get(ns_attr("w:bottom")) if pg_mar is not None else None),
            "left_mm": twips_to_mm(pg_mar.get(ns_attr("w:left")) if pg_mar is not None else None),
            "header_mm": twips_to_mm(pg_mar.get(ns_attr("w:header")) if pg_mar is not None else None),
            "footer_mm": twips_to_mm(pg_mar.get(ns_attr("w:footer")) if pg_mar is not None else None),
            "gutter_mm": twips_to_mm(pg_mar.get(ns_attr("w:gutter")) if pg_mar is not None else None),
        },
        "title_page": to_bool(sect_pr.find("w:titlePg", NS)),
        "page_numbering_start": get_val(pg_num),
        "header_footer_refs": refs,
        "columns": get_val(sect_pr.find("w:cols", NS)),
        "doc_grid_line_pitch": sect_pr.find("w:docGrid", NS).get(ns_attr("w:linePitch"))
        if sect_pr.find("w:docGrid", NS) is not None
        else None,
    }


def parse_style(style_el: ET.Element) -> dict[str, Any]:
    name_el = style_el.find("w:name", NS)
    style_id = style_el.get(ns_attr("w:styleId"))
    ppr = style_el.find("w:pPr", NS)
    rpr = style_el.find("w:rPr", NS)
    return {
        "style_id": style_id,
        "name": name_el.get(ns_attr("w:val")) if name_el is not None else style_id,
        "type": style_el.get(ns_attr("w:type")),
        "default": style_el.get(ns_attr("w:default")) == "1",
        "custom_style": style_el.get(ns_attr("w:customStyle")) == "1",
        "based_on": get_val(style_el.find("w:basedOn", NS)),
        "next": get_val(style_el.find("w:next", NS)),
        "ui_priority": get_val(style_el.find("w:uiPriority", NS)),
        "qformat": style_el.find("w:qFormat", NS) is not None,
        "hidden": style_el.find("w:hidden", NS) is not None,
        "semi_hidden": style_el.find("w:semiHidden", NS) is not None,
        "unhide_when_used": style_el.find("w:unhideWhenUsed", NS) is not None,
        "paragraph_props": parse_paragraph_props(ppr),
        "run_props": parse_fonts(rpr),
    }


def parse_styles(archive: ZipFile) -> tuple[dict[str, Any], dict[str, str]]:
    root = read_xml(archive, "word/styles.xml")
    if root is None:
        return {}, {}
    styles: dict[str, Any] = {}
    by_name: dict[str, str] = {}
    for style_el in root.findall("w:style", NS):
        data = parse_style(style_el)
        styles[data["style_id"]] = data
        by_name[data["name"]] = data["style_id"]
    return styles, by_name


def parse_numbering(archive: ZipFile, style_name_by_id: dict[str, str]) -> dict[str, Any]:
    root = read_xml(archive, "word/numbering.xml")
    if root is None:
        return {}
    abstract_nums = []
    for abstract in root.findall("w:abstractNum", NS):
        levels = []
        for lvl in abstract.findall("w:lvl", NS):
            ppr = lvl.find("w:pPr", NS)
            levels.append(
                {
                    "ilvl": lvl.get(ns_attr("w:ilvl")),
                    "start": get_val(lvl.find("w:start", NS)),
                    "num_fmt": get_val(lvl.find("w:numFmt", NS)),
                    "lvl_text": get_val(lvl.find("w:lvlText", NS)),
                    "suff": get_val(lvl.find("w:suff", NS)),
                    "p_style_id": get_val(lvl.find("w:pStyle", NS)),
                    "p_style_name": style_name_by_id.get(get_val(lvl.find("w:pStyle", NS))),
                    "align": get_val(lvl.find("w:lvlJc", NS)),
                    "indent": parse_ind(ppr.find("w:ind", NS) if ppr is not None else None),
                    "tabs": parse_tabs(ppr),
                }
            )
        abstract_nums.append({"abstractNumId": abstract.get(ns_attr("w:abstractNumId")), "levels": levels})
    nums = []
    for num in root.findall("w:num", NS):
        nums.append({"numId": num.get(ns_attr("w:numId")), "abstractNumId": get_val(num.find("w:abstractNumId", NS))})
    return {"abstract_nums": abstract_nums, "nums": nums}


def parse_settings(archive: ZipFile) -> dict[str, Any]:
    root = read_xml(archive, "word/settings.xml")
    if root is None:
        return {}
    zoom = root.find("w:zoom", NS)
    default_tab = root.find("w:defaultTabStop", NS)
    return {
        "default_tab_stop_twips": get_val(default_tab),
        "default_tab_stop_mm": twips_to_mm(get_val(default_tab)),
        "zoom_percent": zoom.get(ns_attr("w:percent")) if zoom is not None else None,
        "update_fields": to_bool(root.find("w:updateFields", NS)),
        "even_and_odd_headers": to_bool(root.find("w:evenAndOddHeaders", NS)),
        "track_revisions": to_bool(root.find("w:trackRevisions", NS)),
        "compat": [child.tag.split("}")[-1] for child in root.findall("w:compat/*", NS)],
    }


def parse_theme(archive: ZipFile) -> dict[str, Any]:
    root = read_xml(archive, "word/theme/theme1.xml")
    if root is None:
        return {}
    font_scheme = root.find(".//a:fontScheme", NS)
    color_scheme = root.find(".//a:clrScheme", NS)
    data: dict[str, Any] = {}
    if font_scheme is not None:
        data["font_scheme"] = {
            "name": font_scheme.get("name"),
            "major_latin": (font_scheme.find("a:majorFont/a:latin", NS) or {}).get("typeface") if font_scheme.find("a:majorFont/a:latin", NS) is not None else None,
            "minor_latin": (font_scheme.find("a:minorFont/a:latin", NS) or {}).get("typeface") if font_scheme.find("a:minorFont/a:latin", NS) is not None else None,
            "major_ea": (font_scheme.find("a:majorFont/a:ea", NS) or {}).get("typeface") if font_scheme.find("a:majorFont/a:ea", NS) is not None else None,
            "minor_ea": (font_scheme.find("a:minorFont/a:ea", NS) or {}).get("typeface") if font_scheme.find("a:minorFont/a:ea", NS) is not None else None,
        }
    if color_scheme is not None:
        colors = {}
        for child in color_scheme:
            sub = next(iter(child), None)
            if sub is None:
                continue
            colors[child.tag.split("}")[-1]] = sub.get("val") or sub.get("lastClr") or sub.get("sysClr")
        data["color_scheme"] = {"name": color_scheme.get("name"), "colors": colors}
    return data


def parse_relationships(archive: ZipFile, part_name: str) -> dict[str, str]:
    rel_path = f"{part_name.rsplit('/', 1)[0]}/_rels/{part_name.rsplit('/', 1)[1]}.rels"
    root = read_xml(archive, rel_path)
    if root is None:
        return {}
    rels = {}
    for rel in root:
        rels[rel.get("Id")] = rel.get("Target")
    return rels


def paragraph_kind(text: str, style_name: str | None, in_table: bool, paragraph_index: int, first_heading_index: int | None) -> str:
    normalized = normalize_text(text)
    if in_table:
        return "table_cell"
    if style_name in {"CodeBlock", "PromptBlock", "DialogueBlock", "SourceNote", "ListingCaption", "AppendixFigureLabel", "Caption"}:
        return style_name
    if style_name and style_name.startswith("Heading"):
        return style_name
    if first_heading_index is not None and paragraph_index < first_heading_index:
        return "title_page"
    if normalized == "ЗМІСТ" or "\t" in text:
        return "toc"
    if normalized.startswith("Рисунок "):
        return "figure_caption"
    if normalized.startswith("Таблиця "):
        return "table_caption"
    return "body"


def parse_paragraph(
    paragraph_el: ET.Element,
    style_name_by_id: dict[str, str],
    rels: dict[str, str],
    paragraph_index: int,
    first_heading_index: int | None,
    *,
    in_table: bool = False,
) -> dict[str, Any]:
    ppr = paragraph_el.find("w:pPr", NS)
    props = parse_paragraph_props(ppr)
    style_id = props.get("style_id")
    style_name = style_name_by_id.get(style_id, style_id)
    text = paragraph_text(paragraph_el)
    runs = [parse_run(run_el, style_name_by_id) for run_el in paragraph_el.findall("w:r", NS)]
    sect_pr = parse_sect_pr(ppr.find("w:sectPr", NS) if ppr is not None else None, rels)
    return {
        "index": paragraph_index,
        "text": text,
        "normalized_text": normalize_text(text),
        "style_id": style_id,
        "style_name": style_name,
        "kind": paragraph_kind(text, style_name, in_table, paragraph_index, first_heading_index),
        "props": props,
        "runs": runs,
        "section_override": sect_pr,
    }


def parse_table(
    table_el: ET.Element,
    style_name_by_id: dict[str, str],
    rels: dict[str, str],
    paragraph_index_start: int,
    first_heading_index: int | None,
    table_index: int,
) -> tuple[dict[str, Any], int]:
    tbl_pr = table_el.find("w:tblPr", NS)
    tbl_style_id = get_val(tbl_pr.find("w:tblStyle", NS) if tbl_pr is not None else None)
    rows = []
    paragraph_index = paragraph_index_start
    for row_idx, row_el in enumerate(table_el.findall("w:tr", NS)):
        tr_pr = row_el.find("w:trPr", NS)
        row_data = {
            "index": row_idx,
            "is_header": tr_pr.find("w:tblHeader", NS) is not None if tr_pr is not None else False,
            "cant_split": tr_pr.find("w:cantSplit", NS) is not None if tr_pr is not None else False,
            "cells": [],
        }
        for cell_el in row_el.findall("w:tc", NS):
            cell_text_parts = []
            cell_paragraphs = []
            for para_el in cell_el.findall("w:p", NS):
                paragraph = parse_paragraph(
                    para_el,
                    style_name_by_id,
                    rels,
                    paragraph_index,
                    first_heading_index,
                    in_table=True,
                )
                paragraph_index += 1
                cell_paragraphs.append(paragraph)
                if paragraph["text"]:
                    cell_text_parts.append(paragraph["text"])
            tc_pr = cell_el.find("w:tcPr", NS)
            row_data["cells"].append(
                {
                    "text": "\n".join(cell_text_parts),
                    "width_twips": tc_pr.find("w:tcW", NS).get(ns_attr("w:w"))
                    if tc_pr is not None and tc_pr.find("w:tcW", NS) is not None
                    else None,
                    "paragraphs": cell_paragraphs,
                }
            )
        rows.append(row_data)
    return (
        {
            "index": table_index,
            "style_id": tbl_style_id,
            "style_name": style_name_by_id.get(tbl_style_id, tbl_style_id),
            "align": get_val(tbl_pr.find("w:jc", NS) if tbl_pr is not None else None),
            "layout": get_val(tbl_pr.find("w:tblLayout", NS) if tbl_pr is not None else None),
            "look": get_val(tbl_pr.find("w:tblLook", NS) if tbl_pr is not None else None),
            "rows": rows,
            "row_count": len(rows),
            "cell_count_first_row": len(rows[0]["cells"]) if rows else 0,
        },
        paragraph_index,
    )


def parse_header_footer_parts(archive: ZipFile) -> dict[str, Any]:
    parts = {"headers": [], "footers": []}
    for part_name in sorted(archive.namelist()):
        if not re.match(r"word/(header|footer)\d+\.xml$", part_name):
            continue
        root = read_xml(archive, part_name)
        if root is None:
            continue
        text = " ".join(
            normalize_text(paragraph_text(p))
            for p in root.findall(".//w:p", NS)
            if normalize_text(paragraph_text(p))
        )
        instr = " ".join(
            normalize_text(node.text or "")
            for node in root.findall(".//w:instrText", NS)
            if normalize_text(node.text or "")
        )
        entry = {
            "part": part_name,
            "text": text,
            "field_instructions": instr,
            "contains_page_field": "PAGE" in instr,
            "contains_numpages_field": "NUMPAGES" in instr,
        }
        bucket = "headers" if "header" in part_name else "footers"
        parts[bucket].append(entry)
    return parts


def parse_document(archive: ZipFile, styles: dict[str, Any], by_name: dict[str, str]) -> dict[str, Any]:
    document_root = read_xml(archive, "word/document.xml")
    if document_root is None:
        return {}
    rels = parse_relationships(archive, "word/document.xml")
    style_name_by_id = {style_id: data["name"] for style_id, data in styles.items()}
    body = document_root.find("w:body", NS)
    if body is None:
        return {}

    paragraphs_simple = body.findall("w:p", NS)
    first_heading_index = None
    for index, para_el in enumerate(paragraphs_simple):
        ppr = para_el.find("w:pPr", NS)
        style_id = get_val(ppr.find("w:pStyle", NS) if ppr is not None else None)
        style_name = style_name_by_id.get(style_id, style_id)
        if style_name == "Heading 1":
            first_heading_index = index
            break

    paragraph_index = 0
    table_index = 0
    blocks = []
    paragraphs = []
    tables = []
    sections = []

    for child in list(body):
        if child.tag == f"{W}p":
            paragraph = parse_paragraph(child, style_name_by_id, rels, paragraph_index, first_heading_index)
            blocks.append({"type": "paragraph", "index": paragraph_index, "style_name": paragraph["style_name"], "text": paragraph["text"]})
            paragraphs.append(paragraph)
            if paragraph["section_override"]:
                sections.append({"source": "paragraph", "paragraph_index": paragraph_index, **paragraph["section_override"]})
            paragraph_index += 1
        elif child.tag == f"{W}tbl":
            table, paragraph_index = parse_table(child, style_name_by_id, rels, paragraph_index, first_heading_index, table_index)
            table_index += 1
            blocks.append({"type": "table", "index": table["index"], "style_name": table["style_name"], "row_count": table["row_count"]})
            tables.append(table)
        elif child.tag == f"{W}sectPr":
            sections.append({"source": "body", **parse_sect_pr(child, rels)})

    used_styles = Counter()
    for paragraph in paragraphs:
        if paragraph["style_name"]:
            used_styles[paragraph["style_name"]] += 1
    for table in tables:
        if table["style_name"]:
            used_styles[table["style_name"]] += 1

    meta_hits = []
    for paragraph in paragraphs:
        if paragraph["kind"] in {"CodeBlock", "PromptBlock"}:
            continue
        text = paragraph["normalized_text"]
        if not text:
            continue
        for pattern in FORBIDDEN_META_PATTERNS:
            if re.search(pattern, text, flags=re.IGNORECASE):
                meta_hits.append({"paragraph_index": paragraph["index"], "style_name": paragraph["style_name"], "text": text, "pattern": pattern})
                break

    return {
        "paragraphs": paragraphs,
        "tables": tables,
        "blocks": blocks,
        "sections": sections,
        "used_styles": dict(used_styles),
        "meta_hits": meta_hits,
        "document_rels": rels,
    }


def substantive_table_count(parsed: dict[str, Any]) -> int:
    document = parsed.get("document", parsed)
    tables = document.get("tables", [])
    if not tables:
        return 0
    first_heading_index = next(
        (paragraph["index"] for paragraph in document["paragraphs"] if paragraph["style_name"] == "Heading 1"),
        None,
    )
    count = 0
    for table in tables:
        first_para_index = None
        for row in table["rows"]:
            for cell in row["cells"]:
                if cell["paragraphs"]:
                    first_para_index = cell["paragraphs"][0]["index"]
                    break
            if first_para_index is not None:
                break
        if first_heading_index is not None and first_para_index is not None and first_para_index < first_heading_index:
            continue
        count += 1
    return count


def parse_docx(path: Path) -> dict[str, Any]:
    with ZipFile(path) as archive:
        styles, styles_by_name = parse_styles(archive)
        document = parse_document(archive, styles, styles_by_name)
        numbering = parse_numbering(archive, {style_id: data["name"] for style_id, data in styles.items()})
        settings = parse_settings(archive)
        theme = parse_theme(archive)
        header_footer = parse_header_footer_parts(archive)
        package_files = sorted(archive.namelist())
        core_properties = parse_core_props(archive)

    style_names = sorted(data["name"] for data in styles.values())
    custom_styles = sorted(data["name"] for data in styles.values() if data["custom_style"])
    full_text = "\n".join(paragraph["text"] for paragraph in document["paragraphs"])

    parsed = {
        "docx_path": str(path),
        "core_properties": core_properties,
        "package_files": package_files,
        "summary": {
            "paragraph_count": len(document["paragraphs"]),
            "table_count_total": len(document["tables"]),
            "table_count_substantive": substantive_table_count({"document": document}),
            "section_count": len(document["sections"]),
            "style_count": len(styles),
            "style_names_used_count": len(document["used_styles"]),
            "custom_style_names": custom_styles,
        },
        "style_names": style_names,
        "styles": styles,
        "styles_by_name": styles_by_name,
        "numbering": numbering,
        "settings": settings,
        "theme": theme,
        "header_footer_parts": header_footer,
        "document": document,
        "text": {"full_text": full_text},
    }
    return parsed


def style_brief(style: dict[str, Any]) -> str:
    run = style.get("run_props", {})
    ppr = style.get("paragraph_props", {})
    indent = ppr.get("indent", {})
    spacing = ppr.get("spacing", {})
    items = [
        f"font {run.get('ascii') or run.get('hAnsi')}" if (run.get("ascii") or run.get("hAnsi")) else None,
        f"{run.get('size_pt')} pt" if run.get("size_pt") else None,
        "bold" if run.get("bold") else None,
        "italic" if run.get("italic") else None,
        f"first-line {indent.get('firstLine_mm')} mm" if indent.get("firstLine_mm") is not None else None,
        f"left {indent.get('left_mm')} mm" if indent.get("left_mm") is not None else None,
        f"before {spacing.get('before_pt')} pt" if spacing.get("before_pt") is not None else None,
        f"after {spacing.get('after_pt')} pt" if spacing.get("after_pt") is not None else None,
        f"align {ppr.get('align')}" if ppr.get("align") else None,
    ]
    return ", ".join(item for item in items if item)


def table_rules_summary(parsed: dict[str, Any]) -> list[str]:
    tables = parsed["document"]["tables"]
    if not tables:
        return ["Template does not contain tables."]
    first_content_table = None
    for table in tables:
        if table["index"] != 0:
            first_content_table = table
            break
    if first_content_table is None:
        first_content_table = tables[0]
    lines = [
        f"Observed table style: `{first_content_table.get('style_name') or 'none'}`; alignment `{first_content_table.get('align') or 'default'}`; layout `{first_content_table.get('layout') or 'default'}`.",
    ]
    header_rows = sum(1 for row in first_content_table["rows"] if row["is_header"])
    cant_split_rows = sum(1 for row in first_content_table["rows"] if row["cant_split"])
    lines.append(f"Header rows flagged with `tblHeader`: {header_rows}. Rows with `cantSplit`: {cant_split_rows}.")
    sample_paragraphs = []
    for row in first_content_table["rows"][:2]:
        for cell in row["cells"][:2]:
            sample_paragraphs.extend(cell["paragraphs"][:1])
    if sample_paragraphs:
        alignments = Counter(p["props"].get("align") or "default" for p in sample_paragraphs)
        indent_samples = Counter(
            (
                p["props"].get("indent", {}).get("left_mm"),
                p["props"].get("indent", {}).get("firstLine_mm"),
            )
            for p in sample_paragraphs
        )
        lines.append(f"Sample cell paragraph alignment distribution: {dict(alignments)}.")
        lines.append(f"Sample cell paragraph indent tuples `(left_mm, firstLine_mm)`: {dict(indent_samples)}.")
    return lines


def list_rules_summary(parsed: dict[str, Any]) -> list[str]:
    numbering = parsed.get("numbering", {})
    abstract_nums = numbering.get("abstract_nums", [])
    if not abstract_nums:
        return ["No numbering rules detected."]
    bullets = []
    numbers = []
    for abstract in abstract_nums:
        for level in abstract["levels"]:
            item = {
                "num_fmt": level["num_fmt"],
                "lvl_text": level["lvl_text"],
                "p_style_name": level["p_style_name"],
                "indent_mm": level["indent"].get("left_mm"),
            }
            if level["num_fmt"] == "bullet":
                bullets.append(item)
            elif level["num_fmt"]:
                numbers.append(item)
    lines = []
    if numbers:
        lines.append(f"Numbered list levels observed: {numbers[:3]}.")
    if bullets:
        lines.append(f"Bulleted list levels observed: {bullets[:3]}.")
    return lines or ["Numbering present but no explicit levels were summarized."]


def generate_manifest(parsed: dict[str, Any], output_path: Path) -> None:
    section = parsed["document"]["sections"][0] if parsed["document"]["sections"] else {}
    page_size = section.get("page_size", {})
    margins = section.get("page_margins", {})
    styles = parsed["styles"]

    heading_samples = defaultdict(list)
    for paragraph in parsed["document"]["paragraphs"]:
        if paragraph["style_name"] in {"Heading 1", "Heading 2", "Heading 3"} and len(heading_samples[paragraph["style_name"]]) < 2:
            heading_samples[paragraph["style_name"]].append(paragraph["text"])

    lines = [
        "# Template Style Manifest",
        "",
        "## Source",
        f"- Template: `{parsed['docx_path']}`",
        "",
        "## Page Format",
        f"- Size: {page_size.get('w_mm')} x {page_size.get('h_mm')} mm.",
        f"- Orientation: `{page_size.get('orient') or 'portrait/default'}`.",
        f"- Margins: top {margins.get('top_mm')} mm, right {margins.get('right_mm')} mm, bottom {margins.get('bottom_mm')} mm, left {margins.get('left_mm')} mm.",
        f"- Header/footer distances: header {margins.get('header_mm')} mm, footer {margins.get('footer_mm')} mm.",
        f"- Title page enabled: `{section.get('title_page')}`.",
        "",
        "## Base Body Style",
        f"- `Normal`: {style_brief(styles[parsed['styles_by_name']['Normal']])}.",
        "- Expected body text model: `Times New Roman`, 14 pt, justified, 1.5 line spacing, first-line indent about 12.5 mm.",
        "",
        "## Heading Hierarchy",
    ]

    for style_name in ["Heading 1", "Heading 2", "Heading 3"]:
        style_id = parsed["styles_by_name"].get(style_name)
        if not style_id:
            continue
        samples = "; ".join(repr(item) for item in heading_samples.get(style_name, []))
        lines.append(f"- `{style_name}`: {style_brief(styles[style_id])}. Samples: {samples or 'n/a'}.")

    lines.extend(
        [
            "",
            "## Caption Styles",
            f"- `Caption`: {style_brief(styles[parsed['styles_by_name']['Caption']]) if parsed['styles_by_name'].get('Caption') else 'not present'}.",
            f"- `ListingCaption`: {style_brief(styles[parsed['styles_by_name']['ListingCaption']])}.",
            f"- `AppendixFigureLabel`: {style_brief(styles[parsed['styles_by_name']['AppendixFigureLabel']])}.",
            "",
            "## Special Styles",
            f"- `SourceNote`: {style_brief(styles[parsed['styles_by_name']['SourceNote']])}.",
            f"- `DialogueBlock`: {style_brief(styles[parsed['styles_by_name']['DialogueBlock']])}.",
            f"- `CodeBlock`: {style_brief(styles[parsed['styles_by_name']['CodeBlock']])}.",
            f"- `PromptBlock`: {style_brief(styles[parsed['styles_by_name']['PromptBlock']])}.",
            "",
            "## Table Rules",
        ]
    )
    lines.extend(f"- {item}" for item in table_rules_summary(parsed))
    lines.extend(
        [
            "",
            "## List Rules",
        ]
    )
    lines.extend(f"- {item}" for item in list_rules_summary(parsed))
    lines.extend(
        [
            "",
            "## Page Numbering",
            f"- Headers with PAGE field: {sum(1 for item in parsed['header_footer_parts']['headers'] if item['contains_page_field'])}.",
            f"- Footers with PAGE field: {sum(1 for item in parsed['header_footer_parts']['footers'] if item['contains_page_field'])}.",
            "",
            "## Allowed Style Exceptions",
            "- Title-page typography and spacing may differ from body text if they match the template title block.",
            "- The title-page layout table is structural and must not be counted as a substantive table in annotation metrics.",
            "- English abstract text is allowed where the template already uses English content.",
            "- Monospaced `CodeBlock` and `PromptBlock` content must remain exempt from language-normalization passes.",
        ]
    )
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def expected_run_model(style_name: str | None, kind: str, in_table: bool, row_is_header: bool | None = None) -> dict[str, Any] | None:
    if in_table:
        return {
            "font": "Times New Roman",
            "size_pt": 12.0,
            "bold": bool(row_is_header),
            "italic": False,
        }
    if style_name == "Normal" and kind == "body":
        return {"font": "Times New Roman", "size_pt": 14.0, "bold": False, "italic": False}
    if style_name in {"Heading 1", "Heading 2", "Heading 3"}:
        return {"font": "Times New Roman", "size_pt": 14.0, "bold": True}
    if style_name in {"ListingCaption", "AppendixFigureLabel"}:
        return {"font": "Times New Roman", "size_pt": 12.0, "bold": True}
    if style_name == "SourceNote":
        return {"font": "Times New Roman", "size_pt": 11.0, "italic": True}
    if style_name == "DialogueBlock":
        return {"font": "Times New Roman", "size_pt": 14.0}
    if style_name == "CodeBlock":
        return {"font": "Courier New", "size_pt": 9.5}
    if style_name == "PromptBlock":
        return {"font": "Courier New", "size_pt": 10.5}
    return None


def expected_paragraph_model(style_name: str | None, kind: str, in_table: bool) -> dict[str, Any] | None:
    if in_table:
        return {"left_mm": 0.0, "first_line_mm": 0.0}
    if style_name == "Normal" and kind == "body":
        return {"align": "both", "first_line_mm": 12.5}
    if style_name == "Heading 1":
        return {"align": "center", "first_line_mm": 0.0}
    if style_name in {"Heading 2", "Heading 3"}:
        return {"align": "left", "first_line_mm": 0.0}
    if style_name in {"ListingCaption", "AppendixFigureLabel", "Caption"}:
        return {"first_line_mm": 0.0}
    if style_name in {"SourceNote", "PromptBlock", "CodeBlock", "DialogueBlock"}:
        return {"first_line_mm": 0.0}
    return None


def font_matches(actual: dict[str, Any], expected_font: str) -> bool:
    actual_font = actual.get("ascii") or actual.get("hAnsi") or actual.get("eastAsia")
    return actual_font in {None, expected_font}


def size_matches(actual: dict[str, Any], expected_size: float) -> bool:
    actual_size = actual.get("size_pt")
    return actual_size in {None, expected_size}


def bool_matches(actual_value: bool | None, expected_value: bool | None) -> bool:
    return actual_value in {None, expected_value}


def compare_docs(template: dict[str, Any], target: dict[str, Any], report_path: Path) -> None:
    template_style_names = set(template["style_names"])
    target_style_names = set(target["style_names"])

    section_mismatch = []
    template_section = template["document"]["sections"][0] if template["document"]["sections"] else {}
    target_section = target["document"]["sections"][0] if target["document"]["sections"] else {}
    for label, key in [
        ("page width", ("page_size", "w_mm")),
        ("page height", ("page_size", "h_mm")),
        ("margin top", ("page_margins", "top_mm")),
        ("margin right", ("page_margins", "right_mm")),
        ("margin bottom", ("page_margins", "bottom_mm")),
        ("margin left", ("page_margins", "left_mm")),
    ]:
        template_value = template_section.get(key[0], {}).get(key[1])
        target_value = target_section.get(key[0], {}).get(key[1])
        if template_value != target_value:
            section_mismatch.append(f"{label}: template {template_value}, target {target_value}")

    run_deviations = []
    paragraph_deviations = []
    meta_hits = list(target["document"]["meta_hits"])

    for paragraph in target["document"]["paragraphs"]:
        kind = paragraph["kind"]
        style_name = paragraph["style_name"]
        in_table = kind == "table_cell"
        expected_paragraph = expected_paragraph_model(style_name, kind, in_table)
        if expected_paragraph:
            actual_align = paragraph["props"].get("align")
            actual_indent = paragraph["props"].get("indent", {})
            if expected_paragraph.get("align") and actual_align not in {None, expected_paragraph["align"]}:
                paragraph_deviations.append(
                    {
                        "paragraph_index": paragraph["index"],
                        "style_name": style_name,
                        "issue": f"alignment `{actual_align}` vs expected `{expected_paragraph['align']}`",
                        "text": paragraph["normalized_text"][:160],
                    }
                )
            expected_first = expected_paragraph.get("first_line_mm")
            actual_first = actual_indent.get("firstLine_mm")
            if expected_first is not None and actual_first not in {None, expected_first}:
                paragraph_deviations.append(
                    {
                        "paragraph_index": paragraph["index"],
                        "style_name": style_name,
                        "issue": f"first-line indent {actual_first} mm vs expected {expected_first} mm",
                        "text": paragraph["normalized_text"][:160],
                    }
                )
            expected_left = expected_paragraph.get("left_mm")
            actual_left = actual_indent.get("left_mm")
            if expected_left is not None and actual_left not in {None, expected_left}:
                paragraph_deviations.append(
                    {
                        "paragraph_index": paragraph["index"],
                        "style_name": style_name,
                        "issue": f"left indent {actual_left} mm vs expected {expected_left} mm",
                        "text": paragraph["normalized_text"][:160],
                    }
                )

        expected_run = expected_run_model(style_name, kind, in_table)
        if expected_run is None:
            continue
        for run_idx, run in enumerate(paragraph["runs"]):
            if not normalize_text(run["text"]):
                continue
            props = run["props"]
            problems = []
            if expected_run.get("font") and not font_matches(props, expected_run["font"]):
                actual_font = props.get("ascii") or props.get("hAnsi") or props.get("eastAsia")
                problems.append(f"font `{actual_font}` vs `{expected_run['font']}`")
            if expected_run.get("size_pt") is not None and not size_matches(props, expected_run["size_pt"]):
                problems.append(f"size {props.get('size_pt')} pt vs {expected_run['size_pt']} pt")
            if "bold" in expected_run and not bool_matches(props.get("bold"), expected_run["bold"]):
                problems.append(f"bold {props.get('bold')} vs {expected_run['bold']}")
            if "italic" in expected_run and not bool_matches(props.get("italic"), expected_run["italic"]):
                problems.append(f"italic {props.get('italic')} vs {expected_run['italic']}")
            if problems:
                run_deviations.append(
                    {
                        "paragraph_index": paragraph["index"],
                        "run_index": run_idx,
                        "style_name": style_name,
                        "issues": problems,
                        "text": normalize_text(run["text"])[:120],
                    }
                )

    text_diffs = []
    if target["summary"]["table_count_substantive"] != template["summary"]["table_count_substantive"]:
        text_diffs.append(
            f"Substantive table count differs: template {template['summary']['table_count_substantive']}, target {target['summary']['table_count_substantive']}."
        )
    if "Модель стану студента" in target["text"]["full_text"]:
        text_diffs.append("Abbreviations section still contains `Модель стану студента`, which is not a classical abbreviation.")
    if meta_hits:
        text_diffs.append(f"Meta-lexicon hits outside code/prompt blocks: {len(meta_hits)}.")

    lines = [
        "# Format Deviation Report",
        "",
        "## Inputs",
        f"- Template: `{template['docx_path']}`",
        f"- Working DOCX: `{target['docx_path']}`",
        "",
        "## Summary",
        f"- Template paragraphs/tables/sections: {template['summary']['paragraph_count']} / {template['summary']['table_count_total']} total ({template['summary']['table_count_substantive']} substantive) / {template['summary']['section_count']}.",
        f"- Working paragraphs/tables/sections: {target['summary']['paragraph_count']} / {target['summary']['table_count_total']} total ({target['summary']['table_count_substantive']} substantive) / {target['summary']['section_count']}.",
        f"- Styles missing in working DOCX: {sorted(template_style_names - target_style_names)}.",
        f"- Extra styles in working DOCX: {sorted(target_style_names - template_style_names)}.",
        "",
        "## Text-Level Differences",
    ]
    if text_diffs:
        lines.extend(f"- {item}" for item in text_diffs)
    else:
        lines.append("- No coarse text-level deviations were flagged by the automated scan.")

    lines.extend(["", "## Section and Page-Setup Deviations"])
    if section_mismatch:
        lines.extend(f"- {item}" for item in section_mismatch)
    else:
        lines.append("- Section geometry matches the template baseline.")

    lines.extend(["", "## Paragraph-Level Anomalies"])
    if paragraph_deviations:
        for item in paragraph_deviations[:40]:
            lines.append(
                f"- Paragraph {item['paragraph_index']} [{item['style_name']}]: {item['issue']}. Text: `{item['text']}`"
            )
        if len(paragraph_deviations) > 40:
            lines.append(f"- ... and {len(paragraph_deviations) - 40} more paragraph anomalies.")
    else:
        lines.append("- No paragraph-level anomalies were detected against the template style model.")

    lines.extend(["", "## Run-Level Deviations"])
    if run_deviations:
        for item in run_deviations[:60]:
            lines.append(
                f"- Paragraph {item['paragraph_index']}, run {item['run_index']} [{item['style_name']}]: {'; '.join(item['issues'])}. Text: `{item['text']}`"
            )
        if len(run_deviations) > 60:
            lines.append(f"- ... and {len(run_deviations) - 60} more run-level deviations.")
    else:
        lines.append("- No run-level deviations were detected against the tracked template styles.")

    lines.extend(["", "## Meta-Lexicon Hits"])
    if meta_hits:
        for item in meta_hits[:30]:
            lines.append(
                f"- Paragraph {item['paragraph_index']} [{item['style_name']}]: pattern `{item['pattern']}` in `{item['text']}`"
            )
        if len(meta_hits) > 30:
            lines.append(f"- ... and {len(meta_hits) - 30} more meta-lexicon hits.")
    else:
        lines.append("- No forbidden meta-lexicon hits were detected outside code/prompt blocks.")

    lines.extend(
        [
            "",
            "## Table Scan",
            f"- Total tables in working DOCX: {target['summary']['table_count_total']}.",
            f"- Substantive tables in working DOCX: {target['summary']['table_count_substantive']}.",
            "- Title-page layout table is excluded from the substantive count heuristic when it appears before the first Heading 1.",
        ]
    )

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    parse_parser = subparsers.add_parser("parse")
    parse_parser.add_argument("docx", type=Path)
    parse_parser.add_argument("--output", type=Path, required=True)

    manifest_parser = subparsers.add_parser("manifest")
    manifest_parser.add_argument("parse_json", type=Path)
    manifest_parser.add_argument("--output", type=Path, required=True)

    compare_parser = subparsers.add_parser("compare")
    compare_parser.add_argument("--template-json", type=Path, required=True)
    compare_parser.add_argument("--target-json", type=Path, required=True)
    compare_parser.add_argument("--output", type=Path, required=True)

    args = parser.parse_args()

    if args.command == "parse":
        parsed = parse_docx(args.docx)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
    elif args.command == "manifest":
        parsed = json.loads(args.parse_json.read_text(encoding="utf-8"))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        generate_manifest(parsed, args.output)
    elif args.command == "compare":
        template = json.loads(args.template_json.read_text(encoding="utf-8"))
        target = json.loads(args.target_json.read_text(encoding="utf-8"))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        compare_docs(template, target, args.output)


if __name__ == "__main__":
    main()
