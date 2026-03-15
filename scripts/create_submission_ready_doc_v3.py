from __future__ import annotations

import os
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


os.environ["COURSEWORK_DOC_VERSION"] = "v3"

import create_submission_ready_doc_v2 as generator  # noqa: E402
from regenerate_submission_diagrams import render_all  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]
TARGET_DOC = ROOT / "output" / "coursework_draft_ua_submission_ready_v3.docx"


def replace_embedded_media(docx_path: Path, media_map: dict[str, Path]) -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        unpacked = tmp_path / "docx"
        unpacked.mkdir(parents=True, exist_ok=True)

        with ZipFile(docx_path) as archive:
            archive.extractall(unpacked)

        media_dir = unpacked / "word" / "media"
        for media_name, source_path in media_map.items():
            target_path = media_dir / media_name
            if not target_path.exists():
                raise FileNotFoundError(f"Embedded media not found in DOCX package: {media_name}")
            target_path.write_bytes(source_path.read_bytes())

        rebuilt = tmp_path / docx_path.name
        with ZipFile(rebuilt, "w", ZIP_DEFLATED) as archive:
            for file_path in sorted(unpacked.rglob("*")):
                if file_path.is_file():
                    archive.write(file_path, file_path.relative_to(unpacked))

        docx_path.write_bytes(rebuilt.read_bytes())


def main() -> None:
    media_outputs = render_all()
    generator.main()
    replace_embedded_media(TARGET_DOC, media_outputs)
    generator.render_pdf(generator.TARGET_DOC, generator.PDF_PATH)
    generator.export_pngs(generator.PDF_PATH)


if __name__ == "__main__":
    main()
