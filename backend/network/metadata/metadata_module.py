"""
File Metadata Extraction Module

Extracts EXIF data from images (GPS, camera info), PDF metadata, and DOCX metadata.
Uses HTTP POST file upload instead of socket.io for the initial request.
"""

import hashlib
import io
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

from flask import Blueprint, jsonify, request

from core.base_module import OsintModule

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp"}
PDF_EXTENSIONS = {".pdf"}
DOCX_EXTENSIONS = {".docx"}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | PDF_EXTENSIONS | DOCX_EXTENSIONS

metadata_bp = Blueprint("metadata", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _safe_value(val: Any) -> Any:
    """Convert a value to a JSON-serializable type."""
    if val is None:
        return None
    if isinstance(val, bytes):
        try:
            return val.decode("utf-8", errors="replace")
        except Exception:
            return repr(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, (int, float, str, bool)):
        return val
    # PIL IFDRational or similar rational types
    if hasattr(val, "numerator") and hasattr(val, "denominator"):
        try:
            return float(val)
        except Exception:
            return str(val)
    if isinstance(val, tuple):
        return [_safe_value(v) for v in val]
    if isinstance(val, list):
        return [_safe_value(v) for v in val]
    if isinstance(val, dict):
        return {str(k): _safe_value(v) for k, v in val.items()}
    return str(val)


def _compute_hashes(file_bytes: bytes) -> Dict[str, str]:
    """Compute MD5 and SHA256 hashes for file bytes."""
    return {
        "md5": hashlib.md5(file_bytes).hexdigest(),
        "sha256": hashlib.sha256(file_bytes).hexdigest(),
    }


def _allowed_extension(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def _get_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


# ---------------------------------------------------------------------------
# Image metadata extraction
# ---------------------------------------------------------------------------
def _dms_to_decimal(dms_tuple, ref: str) -> Optional[float]:
    """Convert GPS DMS (degrees, minutes, seconds) to decimal degrees."""
    try:
        degrees = float(dms_tuple[0])
        minutes = float(dms_tuple[1])
        seconds = float(dms_tuple[2])
        decimal = degrees + minutes / 60.0 + seconds / 3600.0
        if ref in ("S", "W"):
            decimal = -decimal
        return round(decimal, 7)
    except Exception:
        return None


def _extract_gps(gps_info: dict) -> Optional[Dict[str, Any]]:
    """Parse GPS data from EXIF GPSInfo tag."""
    try:
        from PIL.ExifTags import GPSTAGS

        gps_data = {}
        for tag_id, value in gps_info.items():
            tag_name = GPSTAGS.get(tag_id, tag_id)
            gps_data[tag_name] = value

        lat_dms = gps_data.get("GPSLatitude")
        lat_ref = gps_data.get("GPSLatitudeRef", "N")
        lon_dms = gps_data.get("GPSLongitude")
        lon_ref = gps_data.get("GPSLongitudeRef", "E")

        if lat_dms is None or lon_dms is None:
            return None

        lat = _dms_to_decimal(lat_dms, lat_ref)
        lon = _dms_to_decimal(lon_dms, lon_ref)

        if lat is None or lon is None:
            return None

        result = {
            "latitude": lat,
            "longitude": lon,
            "google_maps_url": f"https://www.google.com/maps?q={lat},{lon}",
        }

        if "GPSAltitude" in gps_data:
            try:
                alt = float(gps_data["GPSAltitude"])
                alt_ref = gps_data.get("GPSAltitudeRef", 0)
                if isinstance(alt_ref, bytes):
                    alt_ref = int.from_bytes(alt_ref, "big")
                if alt_ref == 1:
                    alt = -alt
                result["altitude"] = round(alt, 2)
            except Exception:
                pass

        return result

    except Exception as exc:
        logger.debug(f"GPS extraction failed: {exc}")
        return None


def extract_image_metadata(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Extract EXIF and image metadata from an image file."""
    from PIL import Image
    from PIL.ExifTags import TAGS

    img = Image.open(io.BytesIO(file_bytes))
    result: Dict[str, Any] = {
        "file_type": "image",
        "format": img.format,
        "width": img.size[0],
        "height": img.size[1],
        "mode": img.mode,
    }

    exif_data = {}
    gps_info = None
    camera_info: Dict[str, Any] = {}

    raw_exif = img.getexif()
    if raw_exif:
        for tag_id, value in raw_exif.items():
            tag_name = TAGS.get(tag_id, str(tag_id))

            if tag_name == "GPSInfo":
                # GPSInfo needs special handling
                gps_info = value
                continue

            safe_val = _safe_value(value)

            # Collect camera-related fields
            if tag_name == "Make":
                camera_info["make"] = safe_val
            elif tag_name == "Model":
                camera_info["model"] = safe_val
            elif tag_name == "LensModel":
                camera_info["lens"] = safe_val
            elif tag_name == "DateTimeOriginal":
                camera_info["datetime_original"] = safe_val
            elif tag_name == "DateTime":
                camera_info["datetime"] = safe_val
            elif tag_name == "Software":
                camera_info["software"] = safe_val
            elif tag_name == "Orientation":
                camera_info["orientation"] = safe_val
            elif tag_name == "FocalLength":
                camera_info["focal_length"] = safe_val
            elif tag_name == "FNumber":
                camera_info["aperture"] = safe_val
            elif tag_name == "ISOSpeedRatings":
                camera_info["iso"] = safe_val
            elif tag_name == "ExposureTime":
                camera_info["exposure_time"] = safe_val

            exif_data[tag_name] = safe_val

        # Try to get GPSInfo from IFD if not found directly
        if gps_info is None:
            try:
                ifd_data = raw_exif.get_ifd(0x8825)
                if ifd_data:
                    gps_info = ifd_data
            except Exception:
                pass

    result["camera_info"] = camera_info if camera_info else None

    gps_result = _extract_gps(gps_info) if gps_info else None
    result["gps"] = gps_result

    result["exif"] = exif_data if exif_data else None
    result["hashes"] = _compute_hashes(file_bytes)
    result["file_size"] = len(file_bytes)
    result["filename"] = filename

    return result


# ---------------------------------------------------------------------------
# PDF metadata extraction
# ---------------------------------------------------------------------------
def extract_pdf_metadata(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Extract metadata from a PDF file."""
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(file_bytes))
    meta = reader.metadata

    result: Dict[str, Any] = {
        "file_type": "pdf",
        "filename": filename,
        "page_count": len(reader.pages),
    }

    pdf_meta: Dict[str, Any] = {}
    if meta:
        field_map = {
            "/Author": "author",
            "/Creator": "creator",
            "/Producer": "producer",
            "/Title": "title",
            "/Subject": "subject",
            "/Keywords": "keywords",
            "/CreationDate": "creation_date",
            "/ModDate": "modification_date",
        }
        for pdf_key, friendly_key in field_map.items():
            val = meta.get(pdf_key)
            if val is not None:
                pdf_meta[friendly_key] = _safe_value(val)

    result["metadata"] = pdf_meta if pdf_meta else None
    result["hashes"] = _compute_hashes(file_bytes)
    result["file_size"] = len(file_bytes)

    return result


# ---------------------------------------------------------------------------
# DOCX metadata extraction
# ---------------------------------------------------------------------------
def extract_docx_metadata(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Extract metadata from a DOCX file."""
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    props = doc.core_properties

    result: Dict[str, Any] = {
        "file_type": "docx",
        "filename": filename,
    }

    docx_meta: Dict[str, Any] = {}
    prop_fields = [
        ("author", "author"),
        ("last_modified_by", "last_modified_by"),
        ("created", "created"),
        ("modified", "modified"),
        ("title", "title"),
        ("subject", "subject"),
        ("keywords", "keywords"),
        ("category", "category"),
        ("comments", "comments"),
        ("revision", "revision"),
        ("language", "language"),
    ]
    for attr, key in prop_fields:
        val = getattr(props, attr, None)
        if val is not None and val != "":
            docx_meta[key] = _safe_value(val)

    result["metadata"] = docx_meta if docx_meta else None
    result["hashes"] = _compute_hashes(file_bytes)
    result["file_size"] = len(file_bytes)

    return result


# ---------------------------------------------------------------------------
# OsintModule class (standard pattern, but main work is via blueprint)
# ---------------------------------------------------------------------------
class MetadataModule(OsintModule):
    """OSINT module for file metadata extraction.

    Primary functionality is exposed via the ``metadata_bp`` Flask blueprint
    (HTTP POST), but this class is provided for consistency with the rest of
    the codebase.
    """

    def __init__(self):
        super().__init__("metadata")

    async def search(self, query: str, socketio, namespace: str, **kwargs) -> Dict[str, Any]:
        """Not used for metadata extraction (uses HTTP upload instead)."""
        return {
            "result": {
                "module": "metadata",
                "message": "Use POST /api/metadata/extract to upload files for metadata extraction.",
            }
        }


metadata_module = MetadataModule()


# ---------------------------------------------------------------------------
# Flask blueprint route
# ---------------------------------------------------------------------------
@metadata_bp.route("/api/metadata/extract", methods=["POST"])
def extract_metadata():
    """Accept a multipart file upload and return extracted metadata as JSON."""

    if "file" not in request.files:
        return jsonify({"error": "No file provided. Include a 'file' field in the multipart form data."}), 400

    uploaded = request.files["file"]

    if not uploaded.filename:
        return jsonify({"error": "Empty filename."}), 400

    if not _allowed_extension(uploaded.filename):
        ext = _get_extension(uploaded.filename)
        supported = ", ".join(sorted(ALLOWED_EXTENSIONS))
        return jsonify({
            "error": f"Unsupported file type '{ext}'. Supported formats: {supported}"
        }), 400

    # Read file bytes and enforce size limit
    file_bytes = uploaded.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify({
            "error": f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)} MB."
        }), 413

    ext = _get_extension(uploaded.filename)

    try:
        if ext in IMAGE_EXTENSIONS:
            data = extract_image_metadata(file_bytes, uploaded.filename)
        elif ext in PDF_EXTENSIONS:
            data = extract_pdf_metadata(file_bytes, uploaded.filename)
        elif ext in DOCX_EXTENSIONS:
            data = extract_docx_metadata(file_bytes, uploaded.filename)
        else:
            return jsonify({"error": "Unsupported file type."}), 400

        return jsonify({
            "result": {
                "module": "metadata",
                "results": data,
            }
        })

    except Exception as exc:
        logger.exception(f"Metadata extraction failed: {exc}")
        return jsonify({"error": f"Failed to extract metadata: {str(exc)}"}), 500
