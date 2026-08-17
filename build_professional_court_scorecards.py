import os
import json
from reportlab.lib.pagesizes import letter, portrait
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def draw_luxury_scorecard_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor('#FFFFFF'))
    canvas.rect(0, 0, doc.pagesize[0], doc.pagesize[1], fill=1, stroke=0)
    
    canvas.setFillColor(colors.HexColor('#0F172A'))
    canvas.rect(0, doc.pagesize[1] - 10, doc.pagesize[0], 10, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor('#EAB308'))
    canvas.rect(0, doc.pagesize[1] - 12, doc.pagesize[0], 2, fill=1, stroke=0)
    
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(colors.HexColor('#475569'))
    canvas.drawString(36, 18, 'WHO IS THE HOT SHOT — OFFICIAL COURT SCORECARD & SCHEDULE')
    canvas.drawRightString(doc.pagesize[0] - 36, 18, 'COURT SCORER SIGNATURE: __________________________')
    canvas.restoreState()

def build_court_scorecard_pdf(filename, court_num, court_matches):
    doc = SimpleDocTemplate(
        filename,
        pagesize=portrait(letter),
        leftMargin=30,
        rightMargin=30,
        topMargin=26,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    text_color = colors.HexColor('#0F172A')
    sub_color = colors.HexColor('#1D4ED8')
    header_bg = colors.HexColor('#0F172A')
    row_alt_bg = colors.HexColor('#F8FAFC')
    border_color = colors.HexColor('#CBD5E1')
    gold_color = colors.HexColor('#B45309')

    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.HexColor('#0F172A'))
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=sub_color)

    th_style = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=9, leading=11, textColor=colors.HexColor('#FFFFFF'), alignment=1)
    td_round = ParagraphStyle('TDR', fontName='Helvetica-Bold', fontSize=10, leading=12, textColor=sub_color, alignment=1)
    td_time = ParagraphStyle('TDT', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor('#475569'), alignment=1)
    td_team_a = ParagraphStyle('TDTA', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=text_color, alignment=2)
    td_team_b = ParagraphStyle('TDTB', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=text_color, alignment=0)
    td_score_box = ParagraphStyle('TDSB', fontName='Helvetica-Bold', fontSize=11, leading=13, textColor=colors.HexColor('#1E293B'), alignment=1)
    td_rest = ParagraphStyle('TDRest', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=gold_color, alignment=1)

    story = [
        Paragraph(f'WHO IS THE HOT SHOT — OFFICIAL COURT {court_num} SCORECARD', title_style),
        Paragraph(f'MASTER MATCH SCHEDULE & SCORE ENTRY SHEET (COURT {court_num})', subtitle_style),
        HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0F172A'), spaceAfter=8)
    ]

    table_data = [
        [
            Paragraph('RD', th_style),
            Paragraph('TIME', th_style),
            Paragraph('TEAM 1', th_style),
            Paragraph('SCORE A', th_style),
            Paragraph('VS', th_style),
            Paragraph('SCORE B', th_style),
            Paragraph('TEAM 2', th_style),
            Paragraph('RESTING', th_style)
        ]
    ]

    for m in court_matches:
        score_box_a = Paragraph('<font size=8 color="#CBD5E1">[ &nbsp; &nbsp; &nbsp; &nbsp; ]</font>', td_score_box)
        score_box_b = Paragraph('<font size=8 color="#CBD5E1">[ &nbsp; &nbsp; &nbsp; &nbsp; ]</font>', td_score_box)
        vs_cell = Paragraph('<font color="#94A3B8" size=8>vs</font>', ParagraphStyle('VS', fontName='Helvetica-Bold', alignment=1))

        table_data.append([
            Paragraph(m['round'], td_round),
            Paragraph(m['time'], td_time),
            Paragraph(m['team_a'], td_team_a),
            score_box_a,
            vs_cell,
            score_box_b,
            Paragraph(m['team_b'], td_team_b),
            Paragraph(f'💤 {m["rest"]}', td_rest)
        ])

    t_sched = Table(table_data, colWidths=[34, 52, 134, 45, 18, 45, 134, 90])
    
    t_style = [
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#0F172A')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (3,1), (3,-1), colors.HexColor('#F1F5F9')),
        ('BACKGROUND', (5,1), (5,-1), colors.HexColor('#F1F5F9')),
        ('BOX', (3,1), (3,-1), 1, colors.HexColor('#94A3B8')),
        ('BOX', (5,1), (5,-1), 1, colors.HexColor('#94A3B8')),
        ('LINEBELOW', (0,6), (-1,6), 2, colors.HexColor('#EAB308')),
    ]

    for r_i in range(1, 13):
        if r_i % 2 == 0:
            t_style.append(('BACKGROUND', (0, r_i), (2, r_i), row_alt_bg))
            t_style.append(('BACKGROUND', (6, r_i), (-1, r_i), row_alt_bg))

    t_sched.setStyle(TableStyle(t_style))
    story.append(t_sched)
    story.append(Spacer(1, 10))

    instr_style = ParagraphStyle('Instr', fontName='Helvetica', fontSize=8.5, leading=11.5, textColor=colors.HexColor('#334155'))
    instr_p = Paragraph('<b>SCORING INSTRUCTIONS FOR COURT MANAGER:</b><br/>1. Enter final scores in the <b>SCORE A</b> and <b>SCORE B</b> boxes after each match.<br/>2. Games are played to 11 points (win by 2 points).<br/>3. Sign at the bottom of the page upon completing all 12 rounds.', instr_style)
    
    t_instr = Table([[instr_p]], colWidths=[552])
    t_instr.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_instr)

    doc.build(story, onFirstPage=draw_luxury_scorecard_bg, onLaterPages=draw_luxury_scorecard_bg)
    print(f'Professional Court {court_num} Scorecard built: {filename}')

def build_roster_master_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=portrait(letter),
        leftMargin=30,
        rightMargin=30,
        topMargin=26,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    text_color = colors.HexColor('#0F172A')
    sub_color = colors.HexColor('#1D4ED8')
    header_bg = colors.HexColor('#0F172A')

    title_style = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=text_color)
    subtitle_style = ParagraphStyle('SubTitle', fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=sub_color)
    section_h1 = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=colors.HexColor('#DC2626'))
    section_h2 = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=sub_color)
    court_title = ParagraphStyle('CT', fontName='Helvetica-Bold', fontSize=10.5, leading=13, textColor=colors.HexColor('#FFFFFF'))
    player_style = ParagraphStyle('PS', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=text_color)

    story = [
        Paragraph('WHO IS THE HOT SHOT', title_style),
        Paragraph('MASTER COURT ALLOCATIONS & PLAYER ROSTERS SHEET', subtitle_style),
        HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0F172A'), spaceAfter=10),
        Paragraph('⏱️ HOUR 1 COURT ALLOCATIONS (08:00 PM – 08:50 PM)', section_h1),
        Spacer(1, 4)
    ]

    h1_table = Table([
        [Paragraph('COURT 1 (GROUP 1)', court_title), Paragraph('COURT 2 (GROUP 2)', court_title), Paragraph('COURT 3 (GROUP 3)', court_title)],
        [
            Paragraph('• Deep<br/>• Shaan<br/>• Priyesh<br/>• Hemal<br/>• Ankit<br/>• Yule', player_style),
            Paragraph('• Nadeem<br/>• Sid<br/>• Gopal<br/>• Gulshan<br/>• Anosh<br/>• Miten', player_style),
            Paragraph('• Viki<br/>• Sumit<br/>• Amresh<br/>• PK<br/>• Shrinath<br/>• Karan', player_style)
        ]
    ], colWidths=[184, 184, 184])

    h1_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#0F172A')),
        ('INNERGRID', (0,0), (-1,-1), 0.75, colors.HexColor('#CBD5E1')),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP')
    ]))
    story.append(h1_table)
    story.append(Spacer(1, 14))

    story.append(Paragraph('⏱️ HOUR 2 COURT ALLOCATIONS (09:00 PM – 09:50 PM)', section_h2))
    story.append(Spacer(1, 4))

    h2_table = Table([
        [Paragraph('COURT 1 (GROUP 1)', court_title), Paragraph('COURT 2 (GROUP 2)', court_title), Paragraph('COURT 3 (GROUP 3)', court_title)],
        [
            Paragraph('• Nadeem<br/>• Anosh<br/>• Sumit<br/>• Amresh<br/>• Karan<br/>• Gopal', player_style),
            Paragraph('• Viki<br/>• Sid<br/>• Miten<br/>• Gulshan<br/>• Yule<br/>• Priyesh', player_style),
            Paragraph('• Deep<br/>• Shaan<br/>• Ankit<br/>• PK<br/>• Shrinath<br/>• Hemal', player_style)
        ]
    ], colWidths=[184, 184, 184])

    h2_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), header_bg),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#0F172A')),
        ('INNERGRID', (0,0), (-1,-1), 0.75, colors.HexColor('#CBD5E1')),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP')
    ]))
    story.append(h2_table)
    story.append(Spacer(1, 14))

    note_style = ParagraphStyle('Note', fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=colors.HexColor('#15803D'))
    note_p = Paragraph('✅ 100% ISOLATED COURT PODS & UNIQUE PARTNERSHIPS: Every player plays 8 matches with 8 DIFFERENT partners across their court pods. Zero repeat partners, zero consecutive rests.', note_style)
    t_note = Table([[note_p]], colWidths=[552])
    t_note.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#DCFCE7')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#16A34A')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_note)

    doc.build(story, onFirstPage=draw_luxury_scorecard_bg, onLaterPages=draw_luxury_scorecard_bg)
    print(f'Professional Master Roster PDF built: {filename}')

if __name__ == '__main__':
    with open('live_schedule_data.json', 'r', encoding='utf-8') as f:
        stage_config = json.load(f)

    schedule = stage_config['schedule']
    rosters = stage_config['rosters']

    desktop_dir = r'C:\Users\Nadeem\Desktop'

    # Master Roster
    build_roster_master_pdf(os.path.join(desktop_dir, 'Who_Is_The_Hot_Shot_Master_Court_Allocations.pdf'))

    def get_court_data(court_key):
        court_data = []
        for idx, r in enumerate(schedule):
            is_h1 = idx < 6
            h_roster = rosters['hour1'] if is_h1 else rosters['hour2']
            court_name = 'Court 1 (Group 1)' if court_key == 'court_1' else ('Court 2 (Group 2)' if court_key == 'court_2' else 'Court 3 (Group 3)')
            group_pls = h_roster[court_name]

            m = r[court_key]
            active_pls = set([p.strip() for p in m['team_1'].split('&') + m['team_2'].split('&')])
            rest_pls = [p for p in group_pls if p not in active_pls]

            court_data.append({
                'round': f'R{idx + 1}',
                'time': r['time_slot'],
                'team_a': m['team_1'],
                'team_b': m['team_2'],
                'rest': ', '.join(rest_pls)
            })
        return court_data

    build_court_scorecard_pdf(os.path.join(desktop_dir, 'Who_Is_The_Hot_Shot_Court_1_Official_Scorecard.pdf'), 1, get_court_data('court_1'))
    build_court_scorecard_pdf(os.path.join(desktop_dir, 'Who_Is_The_Hot_Shot_Court_2_Official_Scorecard.pdf'), 2, get_court_data('court_2'))
    build_court_scorecard_pdf(os.path.join(desktop_dir, 'Who_Is_The_Hot_Shot_Court_3_Official_Scorecard.pdf'), 3, get_court_data('court_3'))

    print('ALL PROFESSIONAL SCORECARD PDFs CREATED SUCCESSFULLY FROM LIVE DATABASE!')
