"""BioToolkit: small, teaching-oriented DNA analysis API and web app."""
from __future__ import annotations

import os
import re
from urllib.error import HTTPError, URLError
from typing import Any

from Bio import Entrez, SeqIO
from Bio.Restriction import BamHI, EcoRI, HindIII, TaqI
from Bio.Seq import Seq
from flask import Flask, jsonify, render_template, request
from werkzeug.exceptions import HTTPException

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1_000_000
MAX_SEQUENCE_LENGTH = 200_000
MAX_ORFS = 10_000
try:
    ENTREZ_TIMEOUT_SECONDS = int(os.getenv("NCBI_TIMEOUT_SECONDS", "12"))
except ValueError:
    ENTREZ_TIMEOUT_SECONDS = 12
ENTREZ_TIMEOUT_SECONDS = min(60, max(1, ENTREZ_TIMEOUT_SECONDS))
VALID_DNA = re.compile(r"^[ATCGN]+$")
ENZYMES = {enzyme.__name__: enzyme for enzyme in (EcoRI, BamHI, HindIII, TaqI)}
STOP_CODONS = {"TAA", "TAG", "TGA"}
NCBI_EMAIL = os.environ.get("NCBI_EMAIL", "student@example.com").strip() or "student@example.com"
NCBI_NUCLEOTIDE_DB = "nuccore"  # NCBI's E-Utilities identifier for the Nucleotide collection.

Entrez.email = NCBI_EMAIL
Entrez.timeout = ENTREZ_TIMEOUT_SECONDS
Entrez.max_tries = 2
Entrez.sleep_between_tries = 1
Entrez.tool = "BioToolkit"
if os.getenv("NCBI_API_KEY"):
    Entrez.api_key = os.environ["NCBI_API_KEY"].strip()


class InputError(ValueError):
    """An expected, user-correctable input error."""


def normalize_sequence(raw: Any) -> str:
    """Remove FASTA headers/whitespace and validate an unambiguous DNA alphabet."""
    if not isinstance(raw, str) or not raw.strip():
        raise InputError("Enter a DNA sequence to analyze.")
    # Accept pasted FASTA, but only treat lines beginning with > as headers.
    lines = [line.strip() for line in raw.splitlines() if line.strip() and not line.lstrip().startswith(">")]
    sequence = "".join("".join(lines).split()).upper()
    if not sequence:
        raise InputError("No sequence bases were found.")
    if len(sequence) > MAX_SEQUENCE_LENGTH:
        raise InputError(f"Sequence exceeds the {MAX_SEQUENCE_LENGTH:,}-base limit.")
    if not VALID_DNA.fullmatch(sequence):
        bad = sorted(set(sequence) - set("ATCGN"))
        raise InputError("Invalid DNA character(s): " + ", ".join(bad))
    return sequence


def analyze_sequence(sequence: str) -> dict[str, Any]:
    """Calculate sequence metrics. Callers should pass a normalized DNA string."""
    seq = Seq(sequence)
    length = len(sequence)
    counts = {base: sequence.count(base) for base in "ATGCN"}
    called_bases = length - counts["N"]
    # Exclude unknown bases from the denominator so N does not dilute GC content.
    gc = ((counts["G"] + counts["C"]) / called_bases * 100) if called_bases else 0.0
    rna = str(seq.transcribe())
    # Ignore a terminal partial codon explicitly; Biopython otherwise warns even
    # though dropping that incomplete codon is the intended display behavior.
    complete_coding_length = length - (length % 3)
    protein = str(seq[:complete_coding_length].translate(to_stop=False))
    orfs = find_orfs(seq)
    restriction_analysis = digest(sequence)
    return {
        "sequence": sequence,
        "length": length,
        "gc_content": round(gc, 2),
        "counts": counts,
        "rna": rna,
        "transcript": rna,
        "protein": protein,
        "orfs": orfs,
        "orfs_truncated": len(orfs) >= MAX_ORFS,
        "restriction_analysis": restriction_analysis,
        "restriction": restriction_analysis,
    }


def find_orfs(seq: Seq) -> list[dict[str, Any]]:
    """Find ATG-to-stop ORFs in six frames; coordinates are 1-based inclusive."""
    original = str(seq)
    n = len(original)
    results: list[dict[str, Any]] = []
    for strand, strand_seq in (("+", original), ("-", str(seq.reverse_complement()))):
        for frame in range(3):
            starts: list[int] = []
            for pos in range(frame, len(strand_seq) - 2, 3):
                codon = strand_seq[pos:pos + 3]
                if codon == "ATG":
                    starts.append(pos)
                elif codon in STOP_CODONS and starts:
                    for start in starts:
                        coding = strand_seq[start:pos + 3]
                        if strand == "+":
                            start_coord, end_coord = start + 1, pos + 3
                        else:
                            start_coord, end_coord = n - (pos + 3) + 1, n - start
                        results.append({
                            "start": start_coord, "end": end_coord, "strand": strand,
                            "frame": frame + 1, "length": len(coding),
                            "protein": str(Seq(coding).translate(to_stop=True)),
                        })
                        if len(results) >= MAX_ORFS:
                            results.sort(key=lambda item: (item["start"], item["strand"], item["frame"]))
                            return results
                    starts = []
    results.sort(key=lambda item: (item["start"], item["strand"], item["frame"]))
    return results


def digest(sequence: str) -> list[dict[str, Any]]:
    """Return Biopython cut positions and accurate fragment sizes for linear DNA.

    Bio.Restriction reports the 1-based position of the first base downstream of
    each cut. Convert that to a 0-based Python slice boundary for fragment lengths.
    """
    if not sequence:
        return [{"enzyme": name, "recognition_site": str(enzyme.site), "cuts": [],
                 "cut_count": 0, "fragment_sizes": []} for name, enzyme in ENZYMES.items()]
    seq = Seq(sequence)
    output = []
    for name, enzyme in ENZYMES.items():
        cuts = sorted(set(int(p) for p in enzyme.search(seq, linear=True)))
        # Example: EcoRI cuts GAATTC between bases 1 and 2 and reports position 2.
        boundaries = [0] + [p - 1 for p in cuts if 1 < p <= len(sequence)] + [len(sequence)]
        fragments = [boundaries[i + 1] - boundaries[i] for i in range(len(boundaries) - 1)]
        output.append({"enzyme": name, "recognition_site": str(enzyme.site), "cuts": cuts,
                       "cut_count": len(cuts), "fragment_sizes": fragments})
    return output


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/analyze")
@app.post("/api/analyze")
def analyze():
    if request.is_json:
        payload = request.get_json(silent=True)
        if payload is None:
            raise InputError("Send valid JSON containing a sequence field.")
        if not isinstance(payload, dict):
            raise InputError("Send a JSON object containing a sequence field.")
    elif request.form:
        payload = request.form
    else:
        raise InputError("Send the sequence as JSON or form data.")
    sequence = normalize_sequence(payload.get("sequence"))
    return jsonify(analyze_sequence(sequence))


@app.get("/fetch_ncbi")
@app.get("/api/fetch")
def fetch_sequence():
    accession = (request.args.get("id") or "").strip()
    if not accession or len(accession) > 80 or not re.fullmatch(r"[A-Za-z0-9_.-]+", accession):
        raise InputError("Enter a valid NCBI accession or numeric UID.")
    requested_accession = accession
    protein_prefix = accession.upper().startswith(("NP_", "XP_", "YP_", "WP_", "AP_"))
    try:
        if protein_prefix:
            # Resolve a protein RefSeq to its linked mRNA, keeping this endpoint
            # DNA-focused so the resulting record can be analyzed immediately.
            with Entrez.esearch(db="protein", term=f"{accession}[Accession]", retmax=1) as handle:
                search_result = Entrez.read(handle)
            protein_ids = search_result.get("IdList", [])
            if not protein_ids:
                return jsonify(error=f"No protein record was found for {accession}."), 404
            with Entrez.elink(dbfrom="protein", db=NCBI_NUCLEOTIDE_DB,
                              id=protein_ids[0], linkname="protein_nuccore_mrna") as handle:
                link_sets = Entrez.read(handle)
            linked_ids = [link["Id"] for link_set in link_sets
                          for link_db in link_set.get("LinkSetDb", [])
                          if link_db.get("LinkName") == "protein_nuccore_mrna"
                          for link in link_db.get("Link", [])]
            if not linked_ids:
                return jsonify(error=f"NCBI found protein {accession}, but it has no linked mRNA nucleotide record to analyze."), 404
            accession = str(linked_ids[0])
        # NCBI's E-Utilities database name for its Nucleotide collection is `nuccore`.
        # Parse GenBank rather than FASTA so the response also includes annotations.
        with Entrez.efetch(db=NCBI_NUCLEOTIDE_DB, id=accession, rettype="gb", retmode="text") as handle:
            record = SeqIO.read(handle, "genbank")
    except HTTPError as exc:
        if exc.code not in {400, 404}:
            app.logger.warning("NCBI returned HTTP %s for %s", exc.code, accession)
            return jsonify(error="NCBI is temporarily unavailable. Please try again shortly."), 502
        app.logger.info("NCBI rejected the nucleotide ID %s: %s", accession, exc)
        return jsonify(error="No nucleotide record was found for that accession or UID."), 404
    except ValueError as exc:
        # Invalid identifiers commonly produce an empty response that SeqIO cannot parse.
        app.logger.info("NCBI returned no nucleotide record for %s: %s", accession, exc)
        return jsonify(error="No nucleotide record was found for that accession or UID."), 404
    except (URLError, TimeoutError, OSError) as exc:
        app.logger.info("Entrez fetch failed for %s: %s", accession, exc)
        return jsonify(error="NCBI is temporarily unavailable. Please try again shortly."), 502
    except RuntimeError as exc:
        app.logger.warning("NCBI fetch failed after retries for %s: %s", accession, exc)
        return jsonify(error="NCBI is temporarily unavailable. Please try again shortly."), 502
    except Exception as exc:
        # Do not expose Entrez configuration details or parser tracebacks to clients.
        app.logger.exception("Unexpected Entrez failure for %s", accession)
        return jsonify(error="NCBI could not complete the request. Check the contact email and try again."), 502
    try:
        sequence = normalize_sequence(str(record.seq))
    except InputError:
        return jsonify(error="The NCBI record was returned, but it is not a supported DNA sequence."), 422
    gene_name = ""
    protein_id = ""
    cds_location = ""
    product = ""
    for feature in record.features:
        qualifiers = feature.qualifiers
        if feature.type == "gene" and not gene_name:
            gene_name = next(iter(qualifiers.get("gene", qualifiers.get("locus_tag", []))), "")
        if feature.type == "CDS":
            protein_id = next(iter(qualifiers.get("protein_id", [])), protein_id)
            cds_location = str(feature.location)
            product = next(iter(qualifiers.get("product", [])), product)
    return jsonify({"id": record.id, "description": record.description,
                    "organism": record.annotations.get("organism", ""),
                    "molecule_type": record.annotations.get("molecule_type", ""),
                    "gene": gene_name, "protein_id": protein_id,
                    "cds_location": cds_location, "function": product,
                    "ncbi_url": f"https://www.ncbi.nlm.nih.gov/nuccore/{record.id}",
                    "length": len(sequence), "sequence": sequence,
                    "requested_id": requested_accession,
                    "resolved_from_protein": requested_accession if protein_prefix else None})


def wants_json_error() -> bool:
    """Prefer JSON for API paths and JSON callers; render the page for browsers."""
    return request.path in {"/analyze", "/fetch_ncbi"} or request.path.startswith("/api/") or request.is_json


@app.errorhandler(InputError)
def input_error(error):
    if wants_json_error():
        return jsonify(error=str(error)), 400
    return render_template("error.html", code=400, message=str(error)), 400


@app.errorhandler(HTTPException)
def http_error(error):
    if wants_json_error():
        return jsonify(error=error.description), error.code
    return render_template("error.html", code=error.code, message=error.description), error.code


@app.errorhandler(Exception)
def server_error(error):
    app.logger.exception("Unhandled request error")
    message = "An unexpected server error occurred. Please try again."
    if wants_json_error():
        return jsonify(error=message), 500
    return render_template("error.html", code=500, message=message), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
