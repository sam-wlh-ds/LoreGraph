import pytesseract
from PIL import Image
import fitz  # PyMuPDF
import io

def extract_text_from_pdf(pdf_file):
    try:
        pdf_data = pdf_file.read()
        doc = fitz.open(stream=pdf_data, filetype="pdf")
        full_text = ""

        # First, try to extract digital text directly
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            full_text += page.get_text() + "\n"

        full_text = full_text.strip()

        # If direct extraction returns no text (e.g. scanned PDF), try OCR fallback
        if not full_text:
            print("[INFO] PDF has no digital text. Falling back to OCR...")
            try:
                for page_num in range(len(doc)):
                    page = doc.load_page(page_num)
                    pix = page.get_pixmap(dpi=300)
                    img = Image.open(io.BytesIO(pix.tobytes("png")))
                    text = pytesseract.image_to_string(img)
                    full_text += text + "\n"
                full_text = full_text.strip()
            except pytesseract.TesseractNotFoundError:
                return "Error processing PDF: The PDF appears to be a scanned document, and Tesseract OCR is not installed/configured on this system. Please install Tesseract or upload a digitally generated PDF."
            except Exception as ocr_err:
                return f"Error processing PDF with OCR: {ocr_err}"

        return full_text

    except Exception as e:
        return f"Error processing PDF: {e}"
