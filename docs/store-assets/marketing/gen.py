# Generates translated Daily Close flyers (es / ar-RTL / hi) from one template.
TEMPLATE = r"""<!doctype html><html dir="@@DIR@@"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Arabic:wght@400;500;700;800;900&family=Noto+Sans+Devanagari:wght@400;500;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{--green:#0e3b34;--gold:#c2872b;--ink:#18221d;--bg:#f8f7f3;--border:#e5e0d6}
html,body{width:850px;height:1100px}
.page{width:850px;height:1100px;background:var(--bg);font-family:@@BODYFONT@@;color:var(--ink);display:flex;flex-direction:column;overflow:hidden}
.head{background:var(--green);padding:44px 56px 38px;color:#fff;position:relative}
.head::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 85% 8%,rgba(255,255,255,.07),transparent 55%)}
.brandrow{display:flex;align-items:center;gap:18px;position:relative;z-index:1}
.brandrow img{width:72px;height:72px;border-radius:18px;box-shadow:0 12px 30px rgba(0,0,0,.35)}
.brandrow .name{font-family:Fraunces,serif;font-weight:600;font-size:38px;letter-spacing:-.01em}
.brandrow .tag{font-size:17px;font-weight:600;color:rgba(255,255,255,.7);margin-top:2px}
.headline{font-family:@@HEADFONT@@;font-weight:600;font-size:58px;line-height:1.05;margin-top:28px;position:relative;z-index:1;letter-spacing:-.01em}
.headline .gold{color:var(--gold)}
.sub{font-size:22px;font-weight:500;line-height:1.45;color:rgba(255,255,255,.82);margin-top:16px;max-width:700px;position:relative;z-index:1}
.body{padding:38px 56px 0;flex:1}
.benefits{display:flex;flex-direction:column;gap:18px}
.benefit{display:flex;gap:20px;align-items:flex-start}
.benefit .ic{width:58px;height:58px;border-radius:16px;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;flex:none}
.benefit .t{font-size:25px;font-weight:900}
.benefit .d{font-size:18px;font-weight:500;color:rgba(24,34,29,.62);margin-top:3px;line-height:1.4}
.langs{margin-top:26px;font-size:19px;font-weight:700;color:rgba(24,34,29,.55);text-align:center}
.langs b{color:var(--green)}
.lar{font-family:'Noto Sans Arabic'}
.lhi{font-family:'Noto Sans Devanagari'}
.offer{margin:24px 56px 0;background:var(--gold);border-radius:24px;padding:28px 34px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:24px;box-shadow:0 18px 40px rgba(194,135,43,.3)}
.offer .big{font-family:@@HEADFONT@@;font-weight:600;font-size:28px;line-height:1.14}
.offer .small{font-size:17px;font-weight:600;color:rgba(255,255,255,.92);margin-top:6px}
.offer .code{background:#fff;color:var(--green);border-radius:14px;padding:12px 22px;font-weight:900;font-size:30px;letter-spacing:.04em;text-align:center;font-family:Inter}
.offer .code small{display:block;font-size:11px;font-weight:800;letter-spacing:.16em;color:rgba(14,59,52,.5);margin-bottom:2px}
.foot{margin-top:auto;padding:26px 56px 38px;display:flex;align-items:center;gap:26px}
.foot .qr{width:138px;height:138px;border-radius:14px;background:#fff;border:2px solid var(--border);padding:9px;flex:none}
.foot .qr img{width:100%;height:100%;display:block}
.foot .cta .h{font-size:24px;font-weight:900}
.foot .cta .p{font-size:17px;font-weight:600;color:rgba(24,34,29,.6);margin-top:4px;max-width:440px;line-height:1.35}
.foot .cta .web{font-size:21px;font-weight:900;color:var(--green);margin-top:8px;font-family:Inter}
@@EXTRACSS@@
</style></head><body>
<div class="page">
  <div class="head">
    <div class="brandrow"><img src="../play/icon-512.png" alt=""><div><div class="name">Daily Close</div><div class="tag">@@TAG@@</div></div></div>
    <div class="headline">@@HEADLINE@@</div>
    <div class="sub">@@SUB@@</div>
  </div>
  <div class="body">
    <div class="benefits">
      <div class="benefit"><div class="ic">&#9201;</div><div><div class="t">@@B1T@@</div><div class="d">@@B1D@@</div></div></div>
      <div class="benefit"><div class="ic">&#128202;</div><div><div class="t">@@B2T@@</div><div class="d">@@B2D@@</div></div></div>
      <div class="benefit"><div class="ic">&#128737;</div><div><div class="t">@@B3T@@</div><div class="d">@@B3D@@</div></div></div>
    </div>
    <div class="langs"><b>English</b> &middot; <b>Espa&ntilde;ol</b> &middot; <b class="lar">&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</b> &middot; <b class="lhi">&#2361;&#2367;&#2344;&#2381;&#2342;&#2368;</b></div>
  </div>
  <div class="offer"><div><div class="big">@@OFFER1@@</div><div class="small">@@OFFER2@@</div></div><div class="code"><small>@@USECODE@@</small>STORE50</div></div>
  <div class="foot"><div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?data=https%3A%2F%2Fdailyclose.us&size=400x400&margin=0&color=0e3b34&bgcolor=ffffff" alt="QR"></div><div class="cta"><div class="h">@@SCAN@@</div><div class="p">@@ORSEARCH@@</div><div class="web">dailyclose.us</div></div></div>
</div>
</body></html>"""

L = {
 "es": dict(DIR="ltr", HEADFONT="Fraunces,serif", BODYFONT="Inter,sans-serif", EXTRACSS="",
   TAG="Cierre de caja diario para dueños de tienda",
   HEADLINE="Cierra tu tienda<br/>en <span class='gold'>2 minutos.</span>",
   SUB="Mira el efectivo y las ventas de cada tienda desde tu teléfono, y detecta una caja corta esa misma noche, no el mes que viene.",
   B1T="Cierra en 2 minutos", B1D="Fotografía el reporte, cuenta la caja, envía. Sin capacitación, en cualquier teléfono.",
   B2T="El dueño lo ve todo", B2D="Ventas de hoy, sobrante o faltante de caja y ganancia neta de cada tienda, en una sola pantalla.",
   B3T="Detecta el dinero faltante", B3D="Detecta un faltante en el momento del cierre. Exporta CSV y PDF para tu contador.",
   OFFER1="Empieza GRATIS, sin tarjeta.", OFFER2="Luego 50% de descuento los primeros 3 meses.",
   USECODE="USA EL CÓDIGO", SCAN="Escanea para empezar gratis", ORSEARCH="o busca “Daily Close” en App Store y Google Play"),
 "ar": dict(DIR="rtl", HEADFONT="'Noto Sans Arabic',sans-serif", BODYFONT="'Noto Sans Arabic',sans-serif",
   EXTRACSS=".headline{font-size:50px;line-height:1.1;margin-top:22px}.sub{font-size:20px;line-height:1.5;margin-top:12px}.head{padding:38px 56px 30px}.benefits{gap:13px}.benefit .t{font-size:23px}.benefit .d{font-size:16px}.langs{margin-top:18px;font-size:18px}.offer{margin-top:18px;padding:24px 34px}.offer .big{font-size:26px}.foot{padding:22px 56px 32px}",
   TAG="إقفال الصندوق اليومي لأصحاب المتاجر",
   HEADLINE="أقفل متجرك<br/>في <span class='gold'>دقيقتين.</span>",
   SUB="تابع نقد ومبيعات كل متجر من هاتفك، واكتشف أي عجز في الصندوق في نفس الليلة — لا الشهر القادم.",
   B1T="أقفل في دقيقتين", B1D="صوّر تقرير المبيعات، عدّ النقود، أرسل. بدون تدريب، على أي هاتف.",
   B2T="المالك يرى كل شيء", B2D="مبيعات اليوم، الزيادة أو العجز في النقد، وصافي الربح لكل متجر في شاشة واحدة.",
   B3T="اكتشف النقد المفقود", B3D="اكتشف أي عجز لحظة الإقفال. صدّر ملفات CSV و PDF لمحاسبك.",
   OFFER1="ابدأ مجاناً، بدون بطاقة.", OFFER2="ثم خصم 50% لأول 3 أشهر.",
   USECODE="استخدم الرمز", SCAN="امسح للبدء مجاناً", ORSEARCH="أو ابحث عن “Daily Close” في App Store و Google Play"),
 "hi": dict(DIR="ltr", HEADFONT="'Noto Sans Devanagari',sans-serif", BODYFONT="'Noto Sans Devanagari',sans-serif", EXTRACSS="",
   TAG="दुकान मालिकों के लिए रोज़ाना कैश-अप",
   HEADLINE="अपनी दुकान <span class='gold'>2 मिनट</span><br/>में बंद करें।",
   SUB="हर दुकान का कैश और बिक्री अपने फ़ोन से देखें, और कैश की कमी उसी रात पकड़ें, अगले महीने नहीं।",
   B1T="2 मिनट में बंद करें", B1D="POS रिपोर्ट की फ़ोटो लें, गल्ला गिनें, सबमिट करें। कोई ट्रेनिंग नहीं।",
   B2T="मालिक सब कुछ देखे", B2D="आज की बिक्री, कैश ज़्यादा/कम, और हर दुकान का शुद्ध मुनाफ़ा एक स्क्रीन पर।",
   B3T="गायब कैश पकड़ें", B3D="दुकान बंद होते ही कमी पकड़ें। अपने अकाउंटेंट के लिए साफ़ CSV और PDF एक्सपोर्ट करें।",
   OFFER1="मुफ़्त शुरू करें, कोई कार्ड नहीं।", OFFER2="फिर पहले 3 महीने 50% छूट।",
   USECODE="कोड डालें", SCAN="मुफ़्त शुरू करने के लिए स्कैन करें", ORSEARCH="या App Store और Google Play पर “Daily Close” खोजें"),
}

for code, d in L.items():
    html = TEMPLATE
    for k, v in d.items():
        html = html.replace("@@%s@@" % k, v)
    open("flyer-%s.html" % code, "w", encoding="utf-8").write(html)
    print("wrote flyer-%s.html" % code)
