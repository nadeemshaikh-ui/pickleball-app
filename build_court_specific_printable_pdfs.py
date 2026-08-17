import os
from reportlab.lib.pagesizes import letter, portrait, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def draw_light_bg(canvas, doc):
    canvas.saveState()
    # Crisp white background for high-DPI paper printing
    canvas.setFillColor(colors.HexColor('#FFFFFF'))
    canvas.rect(0, 0, doc.pagesize[0], doc.pagesize[1], fill=1, stroke=0)
    # Accent top bar
    canvas.setFillColor(colors.HexColor('#2563EB'))
    canvas.rect(0, doc.pagesize[1] - 6, doc.pagesize[0], 6, fill=1, stroke=0)
    # Footer
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(colors.HexColor('#64748B'))
    canvas.drawString(36, 18, 'WHO IS THE HOT SHOT — TOURNAMENT OFFICIAL PRINTABLE DOCUMENT')
    canvas.drawRightString(doc.pagesize[0] - 36, 18, f'PAGE {doc.page} OF 1')
    canvas.restoreState()

def build_court_allocations_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    
    text_color = colors.HexColor('#0F172A')
    sub_color = colors.HexColor('#1D4ED8')
    card_bg = colors.HexColor('#F8FAFC')
    border_color = colors.HexColor('#CBD5E1')
    court_title_color = colors.HexColor('#B45309')

    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=text_color)
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=sub_color)
    section_h1 = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=colors.HexColor('#DC2626'))
    section_h2 = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=sub_color)
    court_title = ParagraphStyle('CT', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=court_title_color)
    player_style = ParagraphStyle('PS', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=text_color)

    story = [
        Paragraph('🔥 WHO IS THE HOT SHOT', title_style),
        Paragraph('OFFICIAL COURT ALLOCATIONS & PLAYER ROSTERS', subtitle_style),
        HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=12),
        Paragraph('⏱️ HOUR 1 COURT ALLOCATION (08:00 PM – 08:50 PM)', section_h1),
        Spacer(1, 6)
    ]

    h1_table = Table([
        [Paragraph('COURT 1 (GROUP 1)', court_title), Paragraph('COURT 2 (GROUP 2)', court_title), Paragraph('COURT 3 (GROUP 3)', court_title)],
        [
            Paragraph('• Deep<br/>• Shaan<br/>• Priyesh<br/>• Hemal<br/>• Ankit<br/>• Yule', player_style),
            Paragraph('• Nadeem<br/>• Sid<br/>• Gopal<br/>• Gulshan<br/>• Anosh<br/>• Miten', player_style),
            Paragraph('• Viki<br/>• Sumit<br/>• Amresh<br/>• PK<br/>• Shrinath<br/>• Karan', player_style)
        ]
    ], colWidths=[175, 175, 175])

    h1_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), card_bg),
        ('BOX', (0,0), (-1,-1), 1.5, sub_color),
        ('INNERGRID', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP')
    ]))
    story.append(h1_table)
    story.append(Spacer(1, 16))

    story.append(Paragraph('⏱️ HOUR 2 COURT ALLOCATION (09:00 PM – 09:50 PM)', section_h2))
    story.append(Spacer(1, 6))

    h2_table = Table([
        [Paragraph('COURT 1 (GROUP 1)', court_title), Paragraph('COURT 2 (GROUP 2)', court_title), Paragraph('COURT 3 (GROUP 3)', court_title)],
        [
            Paragraph('• Nadeem<br/>• Anosh<br/>• Sumit<br/>• Amresh<br/>• Karan<br/>• Gopal', player_style),
            Paragraph('• Viki<br/>• Sid<br/>• Miten<br/>• Gulshan<br/>• Yule<br/>• Priyesh', player_style),
            Paragraph('• Deep<br/>• Shaan<br/>• Ankit<br/>• PK<br/>• Shrinath<br/>• Hemal', player_style)
        ]
    ], colWidths=[175, 175, 175])

    h2_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), card_bg),
        ('BOX', (0,0), (-1,-1), 1.5, sub_color),
        ('INNERGRID', (0,0), (-1,-1), 1, border_color),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP')
    ]))
    story.append(h2_table)
    story.append(Spacer(1, 16))

    note_bg = colors.HexColor('#DCFCE7')
    note_border = colors.HexColor('#16A34A')
    note_text = ParagraphStyle('Note', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=colors.HexColor('#15803D'))

    note_p = Paragraph('✅ 100% STRICT COURT POD ISOLATION: Every court operates as a 100% isolated 6-player pod per hour. Zero crossovers. Every player plays 8 matches & rests 4 rounds.', note_text)
    t_note = Table([[note_p]], colWidths=[525])
    t_note.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), note_bg),
        ('BOX', (0,0), (-1,-1), 1, note_border),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_note)

    doc.build(story, onFirstPage=draw_light_bg, onLaterPages=draw_light_bg)
    print(f'Rosters PDF built: {filename}')

def build_single_court_schedule_pdf(filename, court_num, court_matches):
    doc = SimpleDocTemplate(
        filename,
        pagesize=portrait(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    
    text_color = colors.HexColor('#0F172A')
    sub_color = colors.HexColor('#1D4ED8')
    header_bg = colors.HexColor('#F1F5F9')
    row_bg = colors.HexColor('#FFFFFF')
    border_color = colors.HexColor('#CBD5E1')
    rest_color = colors.HexColor('#64748B')
    gold_color = colors.HexColor('#B45309')

    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=text_color)
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=sub_color)

    th_style = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=colors.HexColor('#475569'), alignment=1)
    td_round = ParagraphStyle('TDR', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=sub_color, alignment=1)
    td_time = ParagraphStyle('TDT', fontName='Helvetica-Bold', fontSize=10, leading=12, textColor=colors.HexColor('#475569'), alignment=1)
    td_match = ParagraphStyle('TDM', fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=text_color)
    td_rest = ParagraphStyle('TDRest', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=gold_color)

    story = [
        Paragraph(f'🔥 WHO IS THE HOT SHOT — COURT {court_num}', title_style),
        Paragraph(f'OFFICIAL 12-ROUND MATCH SCHEDULE & RESTING PLAYERS FOR COURT {court_num}', subtitle_style),
        HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=12)
    ]

    table_data = [
        [
            Paragraph('ROUND', th_style),
            Paragraph('TIME', th_style),
            Paragraph(f'COURT {court_num} MATCH FIXTURE', th_style),
            Paragraph('RESTING PLAYERS', th_style)
        ]
    ]

    for m in court_matches:
        cell_match = Paragraph(f'<b>{m["match"]}</b>', td_match)
        cell_rest = Paragraph(f'💤 {m["rest"]}', td_rest)

        table_data.append([
            Paragraph(m['round'], td_round),
            Paragraph(m['time'], td_time),
            cell_match,
            cell_rest
        ])

    t_sched = Table(table_data, colWidths=[65, 75, 235, 150])
    t_sched.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('BACKGROUND', (0,1), (-1,-1), row_bg),
        ('BOX', (0,0), (-1,-1), 1.5, sub_color),
        ('INNERGRID', (0,0), (-1,-1), 0.75, border_color),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,6), (-1,6), 2, colors.HexColor('#EAB308')), # Hour 1 / Hour 2 divider
    ]))
    story.append(t_sched)

    doc.build(story, onFirstPage=draw_light_bg, onLaterPages=draw_light_bg)
    print(f'Court {court_num} PDF built: {filename}')

if __name__ == '__main__':
    desktop_dir = r'C:\Users\Nadeem\Desktop'

    # 1. Build Court Allocations PDF
    allocations_file = os.path.join(desktop_dir, 'Hotshots_Court_Allocations_Print.pdf')
    build_court_allocations_pdf(allocations_file)

    # Schedule data per court
    court_1_data = [
        {'round': 'R1', 'time': '08:00 PM', 'match': 'Deep & Shaan vs Priyesh & Hemal', 'rest': 'Ankit, Yule'},
        {'round': 'R2', 'time': '08:10 PM', 'match': 'Deep & Shaan vs Ankit & Yule', 'rest': 'Priyesh, Hemal'},
        {'round': 'R3', 'time': '08:20 PM', 'match': 'Deep & Shaan vs Priyesh & Hemal', 'rest': 'Ankit, Yule'},
        {'round': 'R4', 'time': '08:30 PM', 'match': 'Priyesh & Hemal vs Ankit & Yule', 'rest': 'Deep, Shaan'},
        {'round': 'R5', 'time': '08:40 PM', 'match': 'Deep & Shaan vs Ankit & Yule', 'rest': 'Priyesh, Hemal'},
        {'round': 'R6', 'time': '08:50 PM', 'match': 'Priyesh & Hemal vs Ankit & Yule', 'rest': 'Deep, Shaan'},
        {'round': 'R7', 'time': '09:00 PM', 'match': 'Nadeem & Anosh vs Sumit & Gopal', 'rest': 'Amresh, Karan'},
        {'round': 'R8', 'time': '09:10 PM', 'match': 'Nadeem & Anosh vs Amresh & Karan', 'rest': 'Sumit, Gopal'},
        {'round': 'R9', 'time': '09:20 PM', 'match': 'Nadeem & Anosh vs Sumit & Gopal', 'rest': 'Amresh, Karan'},
        {'round': 'R10', 'time': '09:30 PM', 'match': 'Sumit & Amresh vs Karan & Gopal', 'rest': 'Nadeem, Anosh'},
        {'round': 'R11', 'time': '09:40 PM', 'match': 'Nadeem & Anosh vs Amresh & Karan', 'rest': 'Sumit, Gopal'},
        {'round': 'R12', 'time': '09:50 PM', 'match': 'Sumit & Amresh vs Karan & Gopal', 'rest': 'Nadeem, Anosh'},
    ]

    court_2_data = [
        {'round': 'R1', 'time': '08:00 PM', 'match': 'Nadeem & Sid vs Gopal & Gulshan', 'rest': 'Anosh, Miten'},
        {'round': 'R2', 'time': '08:10 PM', 'match': 'Nadeem & Gopal vs Anosh & Miten', 'rest': 'Sid, Gulshan'},
        {'round': 'R3', 'time': '08:20 PM', 'match': 'Nadeem & Gulshan vs Sid & Gopal', 'rest': 'Anosh, Miten'},
        {'round': 'R4', 'time': '08:30 PM', 'match': 'Sid & Gulshan vs Anosh & Miten', 'rest': 'Nadeem, Gopal'},
        {'round': 'R5', 'time': '08:40 PM', 'match': 'Nadeem & Anosh vs Gopal & Miten', 'rest': 'Sid, Gulshan'},
        {'round': 'R6', 'time': '08:50 PM', 'match': 'Sid & Gulshan vs Anosh & Miten', 'rest': 'Nadeem, Gopal'},
        {'round': 'R7', 'time': '09:00 PM', 'match': 'Viki & Sid vs Miten & Gulshan', 'rest': 'Yule, Priyesh'},
        {'round': 'R8', 'time': '09:10 PM', 'match': 'Viki & Sid vs Yule & Priyesh', 'rest': 'Miten, Gulshan'},
        {'round': 'R9', 'time': '09:20 PM', 'match': 'Viki & Sid vs Miten & Gulshan', 'rest': 'Yule, Priyesh'},
        {'round': 'R10', 'time': '09:30 PM', 'match': 'Miten & Gulshan vs Yule & Priyesh', 'rest': 'Viki, Sid'},
        {'round': 'R11', 'time': '09:40 PM', 'match': 'Viki & Sid vs Yule & Priyesh', 'rest': 'Miten, Gulshan'},
        {'round': 'R12', 'time': '09:50 PM', 'match': 'Miten & Gulshan vs Yule & Priyesh', 'rest': 'Viki, Sid'},
    ]

    court_3_data = [
        {'round': 'R1', 'time': '08:00 PM', 'match': 'Viki & Sumit vs Amresh & PK', 'rest': 'Shrinath, Karan'},
        {'round': 'R2', 'time': '08:10 PM', 'match': 'Viki & Sumit vs Shrinath & Karan', 'rest': 'Amresh, PK'},
        {'round': 'R3', 'time': '08:20 PM', 'match': 'Viki & Sumit vs Amresh & PK', 'rest': 'Shrinath, Karan'},
        {'round': 'R4', 'time': '08:30 PM', 'match': 'Amresh & PK vs Shrinath & Karan', 'rest': 'Viki, Sumit'},
        {'round': 'R5', 'time': '08:40 PM', 'match': 'Viki & Sumit vs Shrinath & Karan', 'rest': 'Amresh, PK'},
        {'round': 'R6', 'time': '08:50 PM', 'match': 'Amresh & PK vs Shrinath & Karan', 'rest': 'Viki, Sumit'},
        {'round': 'R7', 'time': '09:00 PM', 'match': 'Deep & Shaan vs Ankit & PK', 'rest': 'Shrinath, Hemal'},
        {'round': 'R8', 'time': '09:10 PM', 'match': 'Deep & Shaan vs Shrinath & Hemal', 'rest': 'Ankit, PK'},
        {'round': 'R9', 'time': '09:20 PM', 'match': 'Deep & Shaan vs Ankit & PK', 'rest': 'Shrinath, Hemal'},
        {'round': 'R10', 'time': '09:30 PM', 'match': 'Ankit & PK vs Shrinath & Hemal', 'rest': 'Deep, Shaan'},
        {'round': 'R11', 'time': '09:40 PM', 'match': 'Deep & Shaan vs Shrinath & Hemal', 'rest': 'Ankit, PK'},
        {'round': 'R12', 'time': '09:50 PM', 'match': 'Ankit & PK vs Shrinath & Hemal', 'rest': 'Deep, Shaan'},
    ]

    # 2. Build Court 1 Schedule PDF
    build_single_court_schedule_pdf(os.path.join(desktop_dir, 'Hotshots_Court_1_Schedule_Print.pdf'), 1, court_1_data)

    # 3. Build Court 2 Schedule PDF
    build_single_court_schedule_pdf(os.path.join(desktop_dir, 'Hotshots_Court_2_Schedule_Print.pdf'), 2, court_2_data)

    # 4. Build Court 3 Schedule PDF
    build_single_court_schedule_pdf(os.path.join(desktop_dir, 'Hotshots_Court_3_Schedule_Print.pdf'), 3, court_3_data)

    print('ALL 4 SEPARATE PRINTABLE PDFs CREATED SUCCESSFULLY!')
