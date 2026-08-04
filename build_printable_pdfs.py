import sys
import os
from reportlab.lib.pagesizes import letter, A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.pdfgen import canvas

# Custom Dark Canvas Background
class DarkCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pages = []

    def showPage(self):
        self.pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self.pages)
        for page in self.pages:
            self.__dict__.update(page)
            self.draw_background()
            super().showPage()
        super().save()

    def draw_background(self):
        self.saveState()
        self.setFillColor(colors.HexColor('#0B0F17'))
        self.rect(0, 0, self._pagesize[0], self._pagesize[1], fill=1, stroke=0)
        
        # Header Accent Line
        self.setFillColor(colors.HexColor('#2563EB'))
        self.rect(0, self._pagesize[1] - 6, self._pagesize[0], 6, fill=1, stroke=0)
        
        # Footer text
        self.setFont('Helvetica-Bold', 8)
        self.setFillColor(colors.HexColor('#64748B'))
        self.drawString(36, 20, 'HOTSHOTS CHAMPIONSHIP — OPTION 1 | OFFICIAL PRINTABLE DOCUMENT')
        self.drawRightString(self._pagesize[0] - 36, 20, f'PAGE {self._pageNumber} OF {len(self.pages)}')
        self.restoreState()

def build_rosters_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#FFFFFF'),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#3B82F6'),
        spaceAfter=15
    )

    section_header_h1 = ParagraphStyle(
        'SectionHeaderH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#F87171'),
        spaceAfter=8
    )

    section_header_h2 = ParagraphStyle(
        'SectionHeaderH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#60A5FA'),
        spaceAfter=8
    )

    court_title_style = ParagraphStyle(
        'CourtTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#EAB308'),
        spaceAfter=4
    )

    player_cell_style = ParagraphStyle(
        'PlayerCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#F8FAFC')
    )

    story = []

    # Title Banner
    story.append(Paragraph('🏓 HOTSHOTS CHAMPIONSHIP', title_style))
    story.append(Paragraph('OFFICIAL COURT ALLOCATION & PLAYER ROSTERS (HIGH-RES PRINTABLE)', subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1E293B'), spaceAfter=15))

    # HOUR 1 SECTION
    story.append(Paragraph('⏱️ HOUR 1 COURT ALLOCATION (08:00 PM – 08:50 PM)', section_header_h1))
    
    h1_data = [
        [
            Paragraph('COURT 1 (GROUP 1)', court_title_style),
            Paragraph('COURT 2 (GROUP 2)', court_title_style),
            Paragraph('COURT 3 (GROUP 3)', court_title_style)
        ],
        [
            Paragraph('• Deep<br/>• Shaan<br/>• Priyesh<br/>• Hemal<br/>• Ankit<br/>• Yule', player_cell_style),
            Paragraph('• Nadeem<br/>• Sid<br/>• Gopal<br/>• Gulshan<br/>• Anosh<br/>• Miten', player_cell_style),
            Paragraph('• Viki<br/>• Sumit<br/>• Amresh<br/>• PK<br/>• Shrinath<br/>• Karan', player_cell_style)
        ]
    ]

    t_h1 = Table(h1_data, colWidths=[175, 175, 175])
    t_h1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#161F30')),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#3B82F6')),
        ('INNERGRID', (0,0), (-1,-1), 1, colors.HexColor('#1E293B')),
        ('PADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_h1)
    story.append(Spacer(1, 20))

    # HOUR 2 SECTION
    story.append(Paragraph('⏱️ HOUR 2 COURT ALLOCATION (09:00 PM – 09:50 PM)', section_header_h2))

    h2_data = [
        [
            Paragraph('COURT 1 (GROUP 1)', court_title_style),
            Paragraph('COURT 2 (GROUP 2)', court_title_style),
            Paragraph('COURT 3 (GROUP 3)', court_title_style)
        ],
        [
            Paragraph('• Nadeem<br/>• Anosh<br/>• Sumit<br/>• Amresh<br/>• Karan<br/>• Gopal', player_cell_style),
            Paragraph('• Viki<br/>• Sid<br/>• Miten<br/>• Gulshan<br/>• Yule<br/>• Priyesh', player_cell_style),
            Paragraph('• Deep<br/>• Shaan<br/>• Ankit<br/>• PK<br/>• Shrinath<br/>• Hemal', player_cell_style)
        ]
    ]

    t_h2 = Table(h2_data, colWidths=[175, 175, 175])
    t_h2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#161F30')),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#3B82F6')),
        ('INNERGRID', (0,0), (-1,-1), 1, colors.HexColor('#1E293B')),
        ('PADDING', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_h2)
    story.append(Spacer(1, 20))

    # GUARANTEE CARD
    guarantee_style = ParagraphStyle(
        'GuaranteeStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#10B981')
    )
    guarantee_p = Paragraph('✅ 100% STRICT COURT POD ISOLATION: Every court operates as an isolated 6-player pod per hour. Zero crossovers during play. Every player plays 8 matches & rests 4 rounds.', guarantee_style)
    
    t_guarantee = Table([[guarantee_p]], colWidths=[525])
    t_guarantee.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#064E3B')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#10B981')),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_guarantee)

    doc.build(story, canvasmaker=DarkCanvas)
    print(f'Rosters PDF built: {filename}')

def build_schedule_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#FFFFFF'),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#3B82F6'),
        spaceAfter=12
    )

    th_style = ParagraphStyle(
        'THStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#94A3B8'),
        alignment=1
    )

    td_round = ParagraphStyle(
        'TDRound',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.HexColor('#3B82F6'),
        alignment=1
    )

    td_time = ParagraphStyle(
        'TDTime',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#94A3B8'),
        alignment=1
    )

    td_match = ParagraphStyle(
        'TDMatch',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#FFFFFF')
    )

    story = []

    story.append(Paragraph('🏓 HOTSHOTS CHAMPIONSHIP — OPTION 1', title_style))
    story.append(Paragraph('OFFICIAL 12-ROUND MATCH FIXTURES & COURT SCHEDULE (HIGH-RES PRINTABLE)', subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1E293B'), spaceAfter=10))

    # TABLE DATA
    table_data = [
        [
            Paragraph('ROUND', th_style),
            Paragraph('TIME', th_style),
            Paragraph('COURT 1 (GROUP 1)', th_style),
            Paragraph('COURT 2 (GROUP 2)', th_style),
            Paragraph('COURT 3 (GROUP 3)', th_style)
        ]
    ]

    schedule_data = [
        ('R1', '08:00 PM', 'Deep & Shaan vs Priyesh & Hemal', 'Nadeem & Sid vs Gopal & Anosh', 'Viki & Sumit vs Amresh & PK', 'Rest: Ankit/Yule', 'Rest: Gulshan/Miten', 'Rest: Shrinath/Karan'),
        ('R2', '08:10 PM', 'Ankit & Yule vs Deep & Priyesh', 'Nadeem & Gopal vs Sid & Miten', 'Shrinath & Karan vs Viki & Amresh', 'Rest: Shaan/Hemal', 'Rest: Gulshan/Anosh', 'Rest: Sumit/PK'),
        ('R3', '08:20 PM', 'Shaan & Hemal vs Ankit & Deep', 'Nadeem & Anosh vs Gulshan & Miten', 'Sumit & PK vs Shrinath & Viki', 'Rest: Priyesh/Yule', 'Rest: Sid/Gopal', 'Rest: Amresh/Karan'),
        ('R4', '08:30 PM', 'Priyesh & Yule vs Shaan & Ankit', 'Sid & Gulshan vs Gopal & Anosh', 'Amresh & Karan vs Sumit & Shrinath', 'Rest: Deep/Hemal', 'Rest: Nadeem/Miten', 'Rest: Viki/PK'),
        ('R5', '08:40 PM', 'Deep & Hemal vs Yule & Shaan', 'Nadeem & Miten vs Sid & Gulshan', 'Viki & PK vs Karan & Sumit', 'Rest: Priyesh/Ankit', 'Rest: Gopal/Anosh', 'Rest: Amresh/Shrinath'),
        ('R6', '08:50 PM', 'Priyesh & Ankit vs Hemal & Yule', 'Gopal & Miten vs Anosh & Gulshan', 'Amresh & Shrinath vs PK & Karan', 'Rest: Deep/Shaan', 'Rest: Nadeem/Sid', 'Rest: Viki/Sumit'),
        ('R7', '09:00 PM', 'Nadeem & Anosh vs Sumit & Amresh', 'Viki & Sid vs Miten & Gulshan', 'Deep & Shaan vs Ankit & PK', 'Rest: Karan/Gopal', 'Rest: Yule/Priyesh', 'Rest: Shrinath/Hemal'),
        ('R8', '09:10 PM', 'Karan & Gopal vs Nadeem & Sumit', 'Yule & Priyesh vs Viki & Miten', 'Shrinath & Hemal vs Deep & Ankit', 'Rest: Anosh/Amresh', 'Rest: Sid/Gulshan', 'Rest: Shaan/PK'),
        ('R9', '09:20 PM', 'Anosh & Amresh vs Karan & Nadeem', 'Sid & Gulshan vs Yule & Viki', 'Shaan & PK vs Shrinath & Deep', 'Rest: Sumit/Gopal', 'Rest: Miten/Priyesh', 'Rest: Ankit/Hemal'),
        ('R10', '09:30 PM', 'Sumit & Gopal vs Anosh & Karan', 'Miten & Priyesh vs Sid & Yule', 'Ankit & Hemal vs Shaan & Shrinath', 'Rest: Nadeem/Amresh', 'Rest: Viki/Gulshan', 'Rest: Deep/PK'),
        ('R11', '09:40 PM', 'Nadeem & Amresh vs Gopal & Anosh', 'Viki & Gulshan vs Priyesh & Sid', 'Deep & PK vs Hemal & Shaan', 'Rest: Sumit/Karan', 'Rest: Miten/Yule', 'Rest: Ankit/Shrinath'),
        ('R12', '09:50 PM', 'Sumit & Karan vs Amresh & Gopal', 'Miten & Yule vs Gulshan & Priyesh', 'Ankit & Shrinath vs PK & Hemal', 'Rest: Nadeem/Anosh', 'Rest: Viki/Sid', 'Rest: Deep/Shaan'),
    ]

    for row in schedule_data:
        r, t, c1, c2, c3, r1, r2, r3 = row
        cell_c1 = Paragraph(f'{c1}<br/><font color="#64748B" size=7.5>{r1}</font>', td_match)
        cell_c2 = Paragraph(f'{c2}<br/><font color="#64748B" size=7.5>{r2}</font>', td_match)
        cell_c3 = Paragraph(f'{c3}<br/><font color="#64748B" size=7.5>{r3}</font>', td_match)

        table_data.append([
            Paragraph(r, td_round),
            Paragraph(t, td_time),
            cell_c1,
            cell_c2,
            cell_c3
        ])

    t_sched = Table(table_data, colWidths=[50, 65, 200, 200, 205])
    t_sched.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#161F30')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#0F172A')),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#3B82F6')),
        ('INNERGRID', (0,0), (-1,-1), 0.75, colors.HexColor('#1E293B')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,6), (-1,6), 2, colors.HexColor('#EAB308')), # Hour 1 / Hour 2 divider
    ]))
    story.append(t_sched)

    doc.build(story, canvasmaker=DarkCanvas)
    print(f'Schedule PDF built: {filename}')

if __name__ == '__main__':
    desktop_dir = r'C:\Users\Nadeem\Desktop'
    roster_path = os.path.join(desktop_dir, 'Hotshots_Court_Allocation_Rosters.pdf')
    sched_path = os.path.join(desktop_dir, 'Hotshots_12_Round_Match_Schedule.pdf')
    
    build_rosters_pdf(roster_path)
    build_schedule_pdf(sched_path)

    # Also build local workspace copies
    build_rosters_pdf('Hotshots_Court_Allocation_Rosters.pdf')
    build_schedule_pdf('Hotshots_12_Round_Match_Schedule.pdf')
