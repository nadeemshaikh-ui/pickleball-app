import os
import pypdf

pdf_path = r"C:\Users\Nadeem\.gemini\antigravity\brain\3d633335-c773-43f9-9a42-61b9a52d9729\Home_Team_vs_Challengers_Tournament_Report.pdf"
out_path = r"c:\Users\Nadeem\Documents\pickleball-app\scratch\home_team_pdf_text.txt"

os.makedirs(os.path.dirname(out_path), exist_ok=True)

if os.path.exists(pdf_path):
    reader = pypdf.PdfReader(pdf_path)
    lines = [f"=== PDF FOUND: {len(reader.pages)} PAGES ==="]
    for i, page in enumerate(reader.pages):
        lines.append(f"\n--- PAGE {i+1} ---")
        lines.append(page.extract_text() or '')
    
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f"SAVED TO {out_path}")
