import os
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def draw_dark_bg(canvas, doc):
    canvas.saveState()
    # Dark background
    canvas.setFillColor(colors.HexColor('#0F172A'))
    canvas.rect(0, 0, doc.pagesize[0], doc.pagesize[1], fill=1, stroke=0)
    # Accent top bar
    canvas.setFillColor(colors.HexColor('#2563EB'))
    canvas.rect(0, doc.pagesize[1] - 6, doc.pagesize[0], 6, fill=1, stroke=0)
    # Footer
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(colors.HexColor('#94A3B8'))
    canvas.drawString(36, 18, 'HOTSHOTS CHAMPIONSHIP — OPTION 1 | OFFICIAL DOCUMENT')
    canvas.drawRightString(doc.pagesize[0] - 36, 18, f'PAGE {doc.page} OF 1')
    canvas.restoreState()

def draw_light_bg(canvas, doc):
    canvas.saveState()
    # Crisp white background for printing
    canvas.setFillColor(colors.HexColor('#FFFFFF'))
    canvas.rect(0, 0, doc.pagesize[0], doc.pagesize[1], fill=1, stroke=0)
    # Accent top bar
    canvas.setFillColor(colors.HexColor('#2563EB'))
    canvas.rect(0, doc.pagesize[1] - 6, doc.pagesize[0], 6, fill=1, stroke=0)
    # Footer
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(colors.HexColor('#64748B'))
    canvas.drawString(36, 18, 'HOTSHOTS CHAMPIONSHIP — OPTION 1 | PRINTABLE DOCUMENT')
    canvas.drawRightString(doc.pagesize[0] - 36, 18, f'PAGE {doc.page} OF 1')
    canvas.restoreState()

def generate_rosters(filename, dark_mode=False):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    
    text_color = colors.HexColor('#FFFFFF') if dark_mode else colors.HexColor('#0F172A')
    sub_color = colors.HexColor('#3B82F6') if dark_mode else colors.HexColor('#1D4ED8')
    card_bg = colors.HexColor('#1E293B') if dark_mode else colors.HexColor('#F8FAFC')
    border_color = colors.HexColor('#334155') if dark_mode else colors.HexColor('#CBD5E1')
    court_title_color = colors.HexColor('#EAB308') if dark_mode else colors.HexColor('#B45309')

    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=text_color)
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=sub_color)
    section_h1 = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=colors.HexColor('#EF4444') if dark_mode else colors.HexColor('#DC2626'))
    section_h2 = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=sub_color)
    court_title = ParagraphStyle('CT', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=court_title_color)
    player_style = ParagraphStyle('PS', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=text_color)

    story = [
        Paragraph('🏓 HOTSHOTS CHAMPIONSHIP', title_style),
        Paragraph('OFFICIAL COURT ALLOCATION & PLAYER ROSTERS', subtitle_style),
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

    note_bg = colors.HexColor('#064E3B') if dark_mode else colors.HexColor('#DCFCE7')
    note_border = colors.HexColor('#10B981') if dark_mode else colors.HexColor('#16A34A')
    note_text = ParagraphStyle('Note', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=colors.HexColor('#10B981') if dark_mode else colors.HexColor('#15803D'))

    note_p = Paragraph('✅ GUARANTEE: Every court operates as a 100% isolated 6-player pod per hour. Zero crossovers during play. Every player plays 8 matches & rests 4 rounds.', note_text)
    t_note = Table([[note_p]], colWidths=[525])
    t_note.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), note_bg),
        ('BOX', (0,0), (-1,-1), 1, note_border),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_note)

    bg_func = draw_dark_bg if dark_mode else draw_light_bg
    doc.build(story, onFirstPage=bg_func, onLaterPages=bg_func)
    print(f'Rosters PDF generated successfully: {filename}')

def generate_schedule(filename, dark_mode=False):
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()
    
    text_color = colors.HexColor('#FFFFFF') if dark_mode else colors.HexColor('#0F172A')
    sub_color = colors.HexColor('#3B82F6') if dark_mode else colors.HexColor('#1D4ED8')
    header_bg = colors.HexColor('#1E293B') if dark_mode else colors.HexColor('#F1F5F9')
    row_bg = colors.HexColor('#0F172A') if dark_mode else colors.HexColor('#FFFFFF')
    border_color = colors.HexColor('#334155') if dark_mode else colors.HexColor('#CBD5E1')
    rest_color = colors.HexColor('#94A3B8') if dark_mode else colors.HexColor('#64748B')

    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=text_color)
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=sub_color)

    th_style = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=colors.HexColor('#64748B') if not dark_mode else colors.HexColor('#94A3B8'), alignment=1)
    td_round = ParagraphStyle('TDR', fontName='Helvetica-Bold', fontSize=10, leading=12, textColor=sub_color, alignment=1)
    td_time = ParagraphStyle('TDT', fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=colors.HexColor('#475569') if not dark_mode else colors.HexColor('#94A3B8'), alignment=1)
    td_match = ParagraphStyle('TDM', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=text_color)

    story = [
        Paragraph('🏓 HOTSHOTS CHAMPIONSHIP — OPTION 1', title_style),
        Paragraph('OFFICIAL 12-ROUND MATCH FIXTURES & RESTING PLAYERS SCHEDULE', subtitle_style),
        HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=10)
    ]

    table_data = [
        [
            Paragraph('ROUND', th_style),
            Paragraph('TIME', th_style),
            Paragraph('COURT 1 (GROUP 1)', th_style),
            Paragraph('COURT 2 (GROUP 2)', th_style),
            Paragraph('COURT 3 (GROUP 3)', th_style)
        ]
    ]

    schedule_rows = [
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

    for row in schedule_rows:
        r, t, c1, c2, c3, r1, r2, r3 = row
        cell_c1 = Paragraph(f'<b>{c1}</b><br/><font color="{rest_color.hexval()}">{r1}</font>', td_match)
        cell_c2 = Paragraph(f'<b>{c2}</b><br/><font color="{rest_color.hexval()}">{r2}</font>', td_match)
        cell_c3 = Paragraph(f'<b>{c3}</b><br/><font color="{rest_color.hexval()}">{r3}</font>', td_match)

        table_data.append([
            Paragraph(r, td_round),
            Paragraph(t, td_time),
            cell_c1,
            cell_c2,
            cell_c3
        ])

    t_sched = Table(table_data, colWidths=[50, 65, 200, 200, 205])
    t_sched.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('BACKGROUND', (0,1), (-1,-1), row_bg),
        ('BOX', (0,0), (-1,-1), 1.5, sub_color),
        ('INNERGRID', (0,0), (-1,-1), 0.75, border_color),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,6), (-1,6), 2, colors.HexColor('#EAB308')),
    ]))
    story.append(t_sched)

    bg_func = draw_dark_bg if dark_mode else draw_light_bg
    doc.build(story, onFirstPage=bg_func, onLaterPages=bg_func)
    print(f'Schedule PDF generated successfully: {filename}')

if __name__ == '__main__':
    desktop_dir = r'C:\Users\Nadeem\Desktop'
    
    # Generate Printable Light Theme PDFs (High-Contrast White Background for Printing)
    generate_rosters(os.path.join(desktop_dir, 'Hotshots_Court_Allocation_Rosters_v2.pdf'), dark_mode=False)
    generate_schedule(os.path.join(desktop_dir, 'Hotshots_12_Round_Match_Schedule_v2.pdf'), dark_mode=False)

    # Generate Digital Dark Theme PDFs (App Style for Phones)
    generate_rosters(os.path.join(desktop_dir, 'Hotshots_Court_Allocation_Rosters_Dark_v2.pdf'), dark_mode=True)
    generate_schedule(os.path.join(desktop_dir, 'Hotshots_12_Round_Match_Schedule_Dark_v2.pdf'), dark_mode=True)

    # Also build local workspace copies
    generate_rosters('Hotshots_Court_Allocation_Rosters_v2.pdf', dark_mode=False)
    generate_schedule('Hotshots_12_Round_Match_Schedule_v2.pdf', dark_mode=False)
    generate_rosters('Hotshots_Court_Allocation_Rosters_Dark_v2.pdf', dark_mode=True)
    generate_schedule('Hotshots_12_Round_Match_Schedule_Dark_v2.pdf', dark_mode=True)
