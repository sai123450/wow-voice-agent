from fpdf import FPDF
from prompts import SYSTEM_PROMPT

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Whispers of the Wind - System Prompt', 0, 1, 'C')
        self.ln(5)

pdf = PDF()
pdf.add_page()
pdf.set_font("Arial", size=11)

# FPDF has basic text support, replacing problematic unicode characters
safe_text = SYSTEM_PROMPT.replace('₹', 'Rs. ').replace('–', '-').replace('”', '"').replace('“', '"')
safe_text = safe_text.encode('latin-1', 'replace').decode('latin-1')

pdf.multi_cell(0, 6, safe_text)
pdf.output("System_Prompt.pdf")
print("PDF generated successfully.")
