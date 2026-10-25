# BioToolkit

BioToolkit is a browser-based learning app for exploring DNA sequences. It combines a Flask and Biopython backend with a responsive HTML, CSS, and JavaScript dashboard. Students can paste DNA, load teaching samples, or fetch NCBI records, then inspect sequence statistics, transcription, translation, six-frame open reading frames, and restriction enzyme cuts.

This guide explains how to install and run the project on Windows, how each feature works, and how to present the workflow during a biology or bioinformatics evaluation.

## 1. What you need

- Windows 10 or Windows 11.
- Python 3.10 or newer. During installation from [python.org](https://www.python.org/downloads/windows/), select **Add python.exe to PATH**.
- PowerShell or Windows Terminal.
- Internet access for NCBI sequence fetching, Google Fonts, and the Chart.js library. Pasted sequences, sample fallback sequences, tables, and local calculations can still work when NCBI is unavailable.

Check Python from PowerShell:

```powershell
py --version
```

If `py` is not recognized, install Python and reopen PowerShell. You can also use `python --version` if that command is configured on your computer.

## 2. Install on Windows

Open PowerShell and change directory to the folder containing `app.py` and `requirements.txt`. For example:

```powershell
cd "$HOME\BioToolKit"
```

Create a private Python environment for this project and activate it:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation scripts, allow activation for this PowerShell window only, then activate the environment again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The requirements file installs:

- **Flask** — serves the dashboard and JSON API.
- **Biopython** — sequence operations, NCBI Entrez access, and restriction enzyme analysis.

Chart.js and the Inter/DM Mono fonts are loaded by the page from public CDNs; they are not Python packages.

## 3. Configure NCBI and start BioToolkit

Set a contact email for NCBI requests. Replace the example with an email address you can be contacted at:

```powershell
$env:NCBI_EMAIL = "your.name@example.edu"
```

An optional NCBI API key can be supplied if you have one:

```powershell
$env:NCBI_API_KEY = "your_ncbi_api_key"
```

These environment variables apply to the current PowerShell window. Set them again in a new window before starting the app. BioToolkit has a development fallback email, but setting your own contact email is recommended for Entrez use.

Start the server:

```powershell
python app.py
```

When Flask reports that it is running, open this address in a browser:

<http://127.0.0.1:5000>

Keep the PowerShell window open while using the site. To stop the server, press **Ctrl+C** in that window. After changing Python code, stop and restart the server so Flask loads the updated code.

### Run without activating the environment

If activation is inconvenient, use the environment's Python executable directly:

```powershell
cd "$HOME\BioToolKit"
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:NCBI_EMAIL = "your.name@example.edu"
.\.venv\Scripts\python.exe app.py
```

## 4. Project files

```text
BioToolKit/
├── app.py                 Flask routes and Biopython analysis
├── requirements.txt       Python dependencies
├── README.md              Installation, feature guide, and viva notes
├── templates/
│   └── index.html         Dashboard layout and accessible controls
└── static/
    ├── script.js          Fetch requests, rendering, chart, copy/export, themes
    └── style.css          Responsive dark/light dashboard styles
```

## 5. How to use the dashboard

### Analyze a sequence you already have

1. Paste a DNA sequence into the sequence editor. FASTA headers beginning with `>` and whitespace are accepted.
2. Click **Analyze sequence**.
3. Read the summary cards, base composition chart, transcript and protein, ORF table, and restriction digest table.
4. Use the copy buttons for RNA or protein, or choose **Export FASTA** to download the input sequence.

Only `A`, `T`, `C`, `G`, and `N` are accepted as sequence characters. Input is converted to uppercase and limited to 200,000 bases. `N` means an unknown or ambiguous base.

### Load one of the teaching samples

Use **Human HBB**, **Human INS**, or **E. coli 16S**. The app attempts to fetch the corresponding versioned NCBI record. If NCBI cannot be reached, an embedded teaching fragment is loaded so local analysis remains available. Click **Analyze sequence** after the sample loads.

### Fetch a record from NCBI

Enter an accession or numeric UID in the NCBI field and choose **Fetch record**. For example:

```text
NM_000518.5
```

BioToolkit fetches the nucleotide record, displays its description and available annotations, loads its sequence, and starts the analysis. Nucleotide accessions such as `NM_`, `NR_`, and `NC_` are supported. Protein RefSeq accessions such as `NP_` are resolved through NCBI to a linked mRNA nucleotide record when one is available. For example, `NP_001191615.1` resolves to the linked mRNA `NM_001204686.1`.

An invalid identifier returns a readable not-found message. NCBI network or service problems return a temporary-unavailable message; try again after checking the network and contact email.

## 6. Feature explanations for a presentation

### Sequence validation and normalization

Before calculation, the backend removes FASTA header lines and whitespace, converts letters to uppercase, checks that all remaining symbols are in the DNA alphabet `A`, `T`, `C`, `G`, `N`, and enforces the 200,000-base limit. This prevents invalid input from being passed into the biology calculations.

### Sequence length and nucleotide counts

Length is the number of sequence symbols, including `N`. The count chart reports A, T, G, C, and N separately. These counts let us describe the sequence composition without hiding ambiguous bases.

### GC content

GC content is the percentage of known canonical bases that are G or C:

```text
GC% = 100 × (count(G) + count(C)) / (count(A) + count(T) + count(G) + count(C))
```

Unknown `N` bases are excluded from the denominator because their identity is not known. If the sequence contains only `N`, GC content is reported as 0%.

### Transcription

The app creates an RNA transcript by replacing thymine (`T`) with uracil (`U`). This is a simplified sequence transformation for study; it does not model promoters, splicing, or other cellular processing.

### Translation

The primary protein output translates complete codons from the first base in forward frame 1 using Biopython's standard genetic code. An incomplete final codon is ignored. Translation continues through the sequence, so stop codons appear as `*`; this display is not limited to a single ORF.

### Six-frame open reading frames

The ORF scan checks all three reading frames on the submitted strand and all three on the reverse complement. A reported ORF starts with `ATG` and ends at the first in-frame stop codon (`TAA`, `TAG`, or `TGA`). Results include strand, frame, 1-based inclusive coordinates, nucleotide length, and translated amino acid sequence. No complete ORFs is a valid result and is shown as an empty state rather than an error.

### Restriction enzyme digestion

The digest searches for recognition sites of EcoRI, BamHI, HindIII, and TaqI in a linear DNA molecule. For each enzyme, the table shows the recognition sequence, number and positions of cuts, and the lengths of the resulting fragments, including terminal fragments.

### NCBI record details

The app uses Biopython Entrez to retrieve GenBank records from NCBI's nucleotide collection. The detail card shows the accession, description, organism, molecule type, and available gene/CDS annotations such as gene name, protein ID, CDS location, and product. Some records do not contain every annotation; those fields are shown as **Not annotated**. For protein accessions, BioToolkit follows NCBI's linked mRNA record so that the sequence remains DNA and can be analyzed by the DNA tools.

### Chart, copy, export, and themes

- **Base composition chart:** a color-coded Chart.js bar chart plots A, T, G, C, and N counts.
- **Copy buttons:** copy the RNA transcript or translated protein to the clipboard.
- **Export FASTA:** downloads the analyzed DNA sequence with a FASTA header.
- **Dark/light theme:** switches the dashboard appearance and remembers the selection in the browser.

## 7. Viva walkthrough

Here is a concise demonstration sequence:

1. **Introduce the input:** “BioToolkit accepts raw DNA or FASTA text and validates the sequence alphabet before analysis.”
2. **Fetch a known record:** enter `NM_000518.5` and click **Fetch record**. Explain that the backend uses NCBI Entrez and the response includes sequence and record annotations.
3. **Explain composition:** point to the length and base-count chart, then explain the GC formula and why `N` is excluded from its denominator.
4. **Explain the central dogma outputs:** show transcription (`T` becomes `U`) and translation by codons in forward frame 1.
5. **Explain ORFs:** show that the scanner examines six frames and reports start-to-stop regions with coordinates and strand.
6. **Explain restriction analysis:** choose an enzyme row and describe how recognition sites define cuts and fragment sizes.
7. **Close with outputs:** demonstrate copying a transcript, exporting FASTA, and switching themes.

### Short presentation script

> “This application accepts a DNA sequence or retrieves a nucleotide record from NCBI using Entrez. The backend validates the bases and uses Biopython to calculate length, nucleotide counts, GC content, transcription, translation, six-frame ORFs, and restriction enzyme cuts. The frontend displays the results as summary cards, a composition chart, and tables. Unknown bases are counted but left out of the GC denominator. The NCBI detail card also reports annotation fields when they are present in the GenBank record.”

## 8. API reference

### Analyze a sequence

```http
POST /api/analyze
Content-Type: application/json
```

Request body:

```json
{"sequence": ">sample description\nATGGCCTAA"}
```

The JSON response includes `length`, `gc_content`, `counts`, `rna`, `protein`, `orfs`, and `restriction_analysis`, along with the normalized sequence. Invalid input returns a JSON error with HTTP 400.

### Fetch an NCBI record

```http
GET /api/fetch?id=NM_000518.5
```

The `/fetch_ncbi` route is an alias. Successful JSON includes the fetched accession, description, organism, molecule type, available gene/CDS annotations, sequence, and NCBI record link. Invalid or missing records return a JSON error; upstream NCBI/network failures return HTTP 502.

## 9. Troubleshooting

### `py` or `python` is not recognized

Install Python 3.10+ and enable **Add python.exe to PATH**, then close and reopen PowerShell.

### PowerShell says scripts are disabled

Use the process-only execution policy command in the installation section. It affects only the current PowerShell window; it does not change the machine-wide policy.

### `ModuleNotFoundError: flask` or `Bio`

Activate `.venv` and install the requirements again:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

### Port 5000 is already in use

Stop the other Flask process with **Ctrl+C** in its terminal. Alternatively, choose another port in PowerShell and restart:

```powershell
$env:PORT = "5001"
python app.py
```

Then visit <http://127.0.0.1:5001>.

### NCBI fetch fails

Check that the computer has internet access, set `NCBI_EMAIL` to a contact email, verify the accession belongs to a nucleotide record (or a protein with a linked mRNA), and retry. NCBI may throttle requests or be temporarily unavailable. A numeric identifier must be an NCBI UID, not an arbitrary number.

### The chart is missing

Chart.js is loaded from jsDelivr. Check internet access and reload the page. Sequence analysis and its tables are served locally and do not rely on Chart.js.

## 10. Notes and responsible use

BioToolkit is a student learning tool, not a clinical or research-grade interpretation system. ORF detection uses the simple `ATG` start and three standard stop codons; it does not identify biological coding genes by itself. Always compare fetched records with the linked NCBI source and describe limitations during an evaluation.

The included Flask server is for local development and classroom demonstrations. Do not expose it directly to the public internet as a production service. NCBI requests should use an accurate contact email and follow NCBI's current usage guidance.
