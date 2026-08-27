# One-time, throwaway OCR script for ingesting the "Dosh Mukti" reference book.
#
# The source PDF (https://r2.sagarteotia.in/Dosh%20Mukti%20Book.pdf) is scanned/image-based
# (no text layer) and written in Hindi, so it can't be read with a normal PDF text extractor.
# This script rasterizes each page with PyMuPDF (fitz) and OCRs the resulting image with
# Tesseract (Hindi + English trained data) via pytesseract, concatenating all page text into
# one plain .txt file for Backend/scripts/ingest-book.ts to chunk + embed.
#
# This is intentionally a one-off Python artifact per the owner's constraint: no paid OCR
# API, free local Tesseract instead. It is NOT part of the running app and is safe to delete
# once the book text has been ingested.
#
# Usage:
#   python ocr-book.py <path-to-pdf> <output-txt-path>
#
# Requires: pymupdf, pytesseract (both pip-installed), and the Tesseract binary (installed
# via `winget install --id UB-Mannheim.TesseractOCR -e`). Hindi trained data is loaded from
# the local ./tessdata folder next to this script (TESSDATA_PREFIX below) rather than the
# system Tesseract install dir, since writing into Program Files\Tesseract-OCR\tessdata
# requires admin rights this machine doesn't have for this session.

import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TESSDATA_DIR = os.path.join(SCRIPT_DIR, "tessdata")
TESSERACT_EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

os.environ["TESSDATA_PREFIX"] = TESSDATA_DIR

import fitz  # pymupdf
import pytesseract
from PIL import Image
import io

pytesseract.pytesseract.tesseract_cmd = TESSERACT_EXE

ZOOM = 2.0  # ~144 DPI upscale — better OCR accuracy than the default 72 DPI raster


def ocr_pdf(pdf_path: str, out_path: str) -> None:
    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    print(f"Opened {pdf_path}: {total_pages} page(s)")

    mat = fitz.Matrix(ZOOM, ZOOM)
    all_text = []

    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat)
        img = Image.open(io.BytesIO(pix.tobytes("png")))

        text = pytesseract.image_to_string(img, lang="hin+eng")
        all_text.append(text)

        print(f"  page {i + 1}/{total_pages}: {len(text)} chars")

        # Flush progress periodically so a crash mid-run doesn't lose everything.
        if (i + 1) % 10 == 0 or (i + 1) == total_pages:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write("\n\n".join(all_text))

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n\n".join(all_text))

    print(f"Done. Wrote {len(all_text)} page(s) of OCR text to {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python ocr-book.py <path-to-pdf> <output-txt-path>")
        sys.exit(1)

    ocr_pdf(sys.argv[1], sys.argv[2])
