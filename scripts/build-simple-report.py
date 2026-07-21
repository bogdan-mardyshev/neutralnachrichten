#!/usr/bin/env python3
"""NeutralNews — что изменилось, простыми словами (для нетехнической аудитории)."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, HRFlowable, KeepTogether, PageBreak)
from reportlab.lib.styles import ParagraphStyle

CREAM = HexColor('#FFF8F0'); INK = HexColor('#1a1a1a')
MUTE = HexColor('#64748b'); FAINT = HexColor('#94a3b8'); HAIR = HexColor('#e0d8cf')
GREEN = HexColor('#15803d'); RED = HexColor('#e11d48'); AMBER = HexColor('#b45309')
SPEC = ['#e11d48', '#fb923c', '#94a3b8', '#0ea5e9', '#1d4ed8']
F = '/System/Library/Fonts/Supplemental/'
pdfmetrics.registerFont(TTFont('Georgia',   F + 'Georgia.ttf'))
pdfmetrics.registerFont(TTFont('Georgia-B', F + 'Georgia Bold.ttf'))
pdfmetrics.registerFont(TTFont('Georgia-I', F + 'Georgia Italic.ttf'))
pdfmetrics.registerFont(TTFont('Arial',     F + 'Arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-B',   F + 'Arial Bold.ttf'))
SERIF, SERIF_B, SERIF_I, SANS, SANS_B = 'Georgia', 'Georgia-B', 'Georgia-I', 'Arial', 'Arial-B'
PW, PH = A4; MX = 18 * mm

def deco(c, doc):
    c.saveState()
    c.setFillColor(CREAM); c.rect(0, 0, PW, PH, fill=1, stroke=0)
    seg = PW / 5.0
    for i, col in enumerate(SPEC): c.setFillColor(HexColor(col)); c.rect(i*seg, PH-6, seg, 6, fill=1, stroke=0)
    c.setFillColor(INK); c.rect(0, PH-30, PW, 24, fill=1, stroke=0)
    c.setFillColor(HexColor('#FFFFFF')); c.setFont(SANS_B, 8)
    c.drawCentredString(PW/2, PH-22, 'NEUTRALNEWS   ·   НОВАЯ ВЕРСИЯ ПРОСТЫМИ СЛОВАМИ')
    c.setFillColor(HAIR); c.rect(MX, 24, PW-2*MX, 0.8, fill=1, stroke=0)
    c.setFillColor(FAINT); c.setFont(SANS, 7.5)
    c.drawString(MX, 14, 'neutralnachrichten.com')
    c.drawRightString(PW-MX, 14, f'Стр. {doc.page}')
    for i, col in enumerate(SPEC): c.setFillColor(HexColor(col)); c.rect(i*seg, 0, seg, 4, fill=1, stroke=0)
    c.restoreState()

def S(n, **k): return ParagraphStyle(n, **k)
eye   = S('eye', fontName=SANS_B, fontSize=8.5, textColor=FAINT, leading=12, spaceAfter=2)
title = S('t', fontName=SERIF_B, fontSize=26, textColor=INK, leading=29, spaceAfter=3)
h2    = S('h2', fontName=SERIF_B, fontSize=16, textColor=INK, leading=19, spaceBefore=9, spaceAfter=3)
body  = S('b', fontName=SERIF, fontSize=10.5, textColor=INK, leading=15.5, spaceAfter=5, alignment=TA_LEFT)
big   = S('bg', fontName=SERIF, fontSize=12, textColor=INK, leading=17, spaceAfter=6)
small = S('s', fontName=SANS, fontSize=8.3, textColor=MUTE, leading=11.5)
cellb = S('cb', fontName=SERIF, fontSize=9.5, textColor=INK, leading=13)
cellh = S('ch', fontName=SANS_B, fontSize=7.5, textColor=FAINT, leading=10)

story = []
def sp(h): story.append(Spacer(1, h))
def rule(c=INK, w=1): story.append(HRFlowable(width='100%', thickness=w, color=c, spaceBefore=3, spaceAfter=6))
def P(t, st=body): return Paragraph(t, st)
CW = PW - 2*MX

# ══════════════════ PAGE 1 ══════════════════
sp(12)
story.append(P('ОБЪЯСНЕНИЕ ДЛЯ ВСЕЙ КОМАНДЫ · БЕЗ ТЕХНИЧЕСКИХ ТЕРМИНОВ', eye))
story.append(P('Что мы улучшили — простыми словами', title))
story.append(P('Коротко: чем новая версия лучше той, что сейчас работает, и почему ей можно доверять.', big))
sp(4); rule(INK, 1.4)

story.append(P('Что вообще делает наш продукт', h2)); rule(HAIR, 0.8)
story.append(P('NeutralNews берёт одну новость и показывает, <b>как её освещают разные политические лагеря</b> — '
   'левые, центристы, правые. Человек за минуту видит полную картину вместо одной точки зрения. '
   'Как меню, где видно блюдо со всех сторон, а не только парадное фото.', body))

story.append(P('В чём была проблема старой версии', h2)); rule(HAIR, 0.8)
story.append(P('Старая версия (она и сейчас на проде) делала <b>красивый разбор, но «на доверии»</b>. '
   'Она просила поверить ей на слово:', body))
for t in ['не было оценки, насколько разбору можно доверять;',
          'не проверялось, что показанные статьи реальные и вообще по теме;',
          'нельзя было понять, не выдумал ли искусственный интеллект часть выводов;',
          'статьи брались из случайного интернет-поиска, а не из проверенного списка изданий.']:
    story.append(P('•&nbsp;&nbsp;' + t, body))
story.append(P('Это нормально для первой версии, но для репутации «новостей без предвзятости» — слабое место: '
   '<b>доверие нельзя просить, его нужно показывать</b>.', body))
sp(6)

story.append(P('Что изменилось в новой версии', h2)); rule(HAIR, 0.8)
rows = [
 ('Проверенные источники', 'Берём статьи из 55 известных изданий по всему спектру — а не из случайного поиска.'),
 ('Реальные ссылки', 'Каждая показанная статья настоящая, с рабочей ссылкой. Ничего «приблизительного».'),
 ('Проверка фактов', 'Система сверяет каждый вывод с источниками — подтверждён он или выдуман.'),
 ('Оценка доверия', 'У каждого разбора — понятный «уровень надёжности», как индикатор заряда.'),
 ('Честность о пробелах', 'Если какая-то сторона тему не освещала — мы прямо это показываем, а не маскируем.'),
 ('Чисто с правовой точки зрения', 'Мы не храним чужие статьи целиком — только короткую выжимку. Безопасно.'),
]
data = [[P('ЧТО ДОБАВИЛИ', cellh), P('ЧТО ЭТО ДАЁТ ЧИТАТЕЛЮ', cellh)]]
for a, b in rows: data.append([P('<b>'+a+'</b>', cellb), P(b, cellb)])
t = Table(data, colWidths=[CW*0.34, CW*0.66])
sty = [('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
       ('LEFTPADDING',(0,0),(-1,-1),4),('LINEBELOW',(0,0),(-1,0),0.9,INK)]
for r in range(1,len(data)): sty.append(('LINEBELOW',(0,r),(-1,r),0.4,HAIR))
t.setStyle(TableStyle(sty)); story.append(t)

story.append(PageBreak())
# ══════════════════ PAGE 2 ══════════════════
story.append(P('Аналогия, чтобы было понятно', h2)); rule(INK, 1.2)
story.append(P('Представьте студенческий реферат по новости.', big))
story.append(P('<b>Старая версия</b> — это студент, который красиво написал реферат и говорит: «верьте мне». '
   'Никто не проверял источники.', body))
story.append(P('<b>Новая версия</b> — это студент <i>плюс строгий научный руководитель</i>, который под каждым '
   'предложением проверяет: «А это где написано? Покажи источник. Это правда подтверждается?» И в конце ставит '
   'честную оценку — насколько работе можно доверять.', body))
story.append(P('Именно эту «оценку доверия» теперь видит каждый читатель.', body))
sp(8)

story.append(P('Был один важный сбой — и мы его починили', h2)); rule(INK, 1.2)
story.append(P('Во время тестов нашли неприятную ошибку: система <b>занижала доверие даже к хорошим разборам</b>. '
   'На отличном материале (десятки источников, все стороны освещены) она показывала всего «65 из 100 — средне».', body))
story.append(P('Причина — придирчивость проверки: если факт нельзя было подтвердить одной-единственной статьёй, '
   'система засчитывала его как «непроверенный», хотя на деле он подтверждался несколькими статьями вместе. '
   'Мы это исправили: теперь факт сверяется <b>сразу с несколькими источниками</b>, а «не знаю» больше не '
   'приравнивается к «неправда».', body))
sp(3)
# before/after trust meter
ba = [[P('БЫЛО', cellh), P('СТАЛО', cellh)],
      [P('<font name="Georgia-B" size="30" color="#b45309">65</font><br/><font name="Arial" size="9" color="#64748b">«средне» — несправедливо занижено</font>', cellb),
       P('<font name="Georgia-B" size="30" color="#15803d">95</font><br/><font name="Arial" size="9" color="#64748b">«высокая надёжность» — честная оценка</font>', cellb)]]
tba = Table(ba, colWidths=[CW/2.0, CW/2.0])
tba.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),0.9,INK),('LINEAFTER',(0,0),(0,-1),0.6,HAIR),
   ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),10),('LEFTPADDING',(0,0),(-1,-1),6)]))
story.append(tba)
sp(10)

story.append(P('Какой был уровень — и какой стал', h2)); rule(INK, 1.2)
story.append(P('Если оценить продукт по простой шкале «насколько ему можно доверять и насколько он зрелый»:', body))
lvl = [[P('', cellh), P('УРОВЕНЬ', cellh), P('ЧТО ЭТО ЗНАЧИТ', cellh)],
   [P('<b>Было (на проде)</b>', cellb), P('<font name="Georgia-B" size="13" color="#b45309">~5 / 10</font>', cellb),
    P('Красиво выглядит, но без проверки — «поверьте на слово».', cellb)],
   [P('<b>Стало (новая)</b>', cellb), P('<font name="Georgia-B" size="13" color="#15803d">9 / 10</font>', cellb),
    P('Каждый вывод проверен и подкреплён источниками, доверие — видно и измеримо.', cellb)]]
tl = Table(lvl, colWidths=[CW*0.26, CW*0.20, CW*0.54])
tl.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),0.9,INK),('LINEBELOW',(0,1),(-1,1),0.4,HAIR),
   ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LEFTPADDING',(0,0),(-1,-1),4),('ALIGN',(1,0),(1,-1),'CENTER')]))
story.append(tl)
sp(10)

story.append(P('Главное в одном предложении', h2)); rule(INK, 1.2)
story.append(P('Раньше продукт <b>просил</b> доверять ему. Теперь он это доверие <b>зарабатывает</b> — '
   'показывает источники, проверяет факты и честно говорит, насколько уверен.', big))
sp(6)
story.append(P('Важно: новая версия пока на тестовом сервере и не затрагивает то, что сейчас видят пользователи. '
   'Перед запуском мы ещё раз всё проверим на реальных новостях.', small))

OUT = os.path.join(os.path.dirname(__file__), '..', 'reports', 'NeutralNews-Prostymi-Slovami.pdf')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=MX, rightMargin=MX, topMargin=34*mm, bottomMargin=20*mm)
frame = Frame(MX, 20*mm, PW-2*MX, PH-34*mm-20*mm, id='m', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([PageTemplate(id='brand', frames=[frame], onPage=deco)])
doc.build(story)
print('WROTE', os.path.abspath(OUT))
