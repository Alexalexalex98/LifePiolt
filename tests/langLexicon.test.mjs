import test from 'node:test';
import assert from 'node:assert/strict';
import { understand, detectLang, scriptOf } from '../src/lib/langLexicon/index.ts';
import { Assistant } from '../src/lib/assistant/engine.ts';

/**
 * Tabella {lingua, frase, comando canonico atteso}. Il lessico traduce in un comando INGLESE che l'assistente esegue senza modifiche.
 * `null` = non capito (nessun indovinello); 'confirm' = capito in parte: si chiede conferma.
 * È un lessico, non una comprensione generale: i casi `null` sono voluti.
 */
const CASES = [
  ["es", "agrega reunión con Ana al plan mañana a las 3 de la tarde", "add \"Reunión con Ana\" to my plan tomorrow at 3pm"],
  ["es", "añade una tarea comprar leche", "add task \"Comprar leche\""],
  ["es", "agrega la tarea preparar el informe para el viernes", "add task \"Preparar el informe\" by Friday"],
  ["es", "¿qué tengo mañana?", "show my agenda tomorrow"],
  ["es", "cuándo estoy libre el viernes", "when am I free Friday?"],
  ["es", "qué debo hacer ahora", "what should I do now?"],
  ["es", "planifica el mes", "plan my month"],
  ["es", "cada martes a las 6 de la tarde gimnasio", "every Tuesday at 6pm \"Gimnasio\""],
  ["es", "deshacer", "undo"],
  ["es", "abre finanzas", "open finance"],
  ["es", "estoy cansada", "I feel tired"],
  ["es", "mueve el dentista al viernes a las 11", "move \"Dentista\" to Friday at 11am"],
  ["es", "elimina la cita con el dentista del plan", "delete \"Cita con el dentista\" from my plan"],
  ["es", "terminé comprar leche", "I finished \"Comprar leche\""],
  ["es", "escribe una nota: ideas para AURA", "write a note: Ideas para AURA"],
  ["es", "nuevo objetivo correr 10 km", "new goal \"Correr 10 km\""],
  ["es", "activa el modo oscuro", "dark mode"],
  ["es", "activa las notificaciones", "turn on notifications"],
  ["es", "haz mi perfil privado", "make my profile private"],
  ["es", "¿cuánto he gastado este mes?", "how much did I spend"],
  ["es", "¿cómo he dormido?", "how did I sleep"],
  ["es", "sí", "yes"],
  ["es", "no", "no"],
  ["es", "elige tú", "you choose"],
  ["es", "comparte mi agenda con Marco", "share my agenda with Marco"],
  ["es", "mi horario de trabajo es de 9 a 17", "set my working hours from 9am to 5pm"],
  ["es", "marca comprar leche como urgente", "mark \"Comprar leche\" as urgent"],
  ["es", "resumen del día", "daily summary"],
  ["es", "pasado mañana a las 10 de la mañana reunión de equipo", "add \"Reunión de equipo\" to my plan the day after tomorrow at 10am"],
  ["es", "agrega llamar a mamá dentro de 3 días", "add \"Llamar a mamá\" to my plan in 3 days"],
  ["es", "el 12 de octubre a las 20:30 cena con la familia", "add \"Cena con la familia\" to my plan 12 October at 8:30pm"],
  ["es", "quiero ir al gimnasio hoy a las 7 de la tarde por 2 horas", "add \"Ir al gimnasio\" to my plan today at 7pm for 2 hours", 'confirm'],
  ["es", "blablabla qwerty", null],
  ["fr", "ajoute réunion avec Anne au planning demain à 15h", "add \"Réunion avec Anne\" to my plan tomorrow at 3pm"],
  ["fr", "ajoute une tâche acheter du lait", "add task \"Acheter du lait\""],
  ["fr", "ajoute la tâche préparer le rapport pour vendredi", "add task \"Préparer le rapport\" by Friday"],
  ["fr", "qu'est-ce que j'ai demain ?", "show my agenda tomorrow"],
  ["fr", "quand suis-je libre vendredi ?", "when am I free Friday?"],
  ["fr", "que dois-je faire maintenant ?", "what should I do now?"],
  ["fr", "planifie le mois", "plan my month"],
  ["fr", "chaque mardi à 18h salle de sport", "every Tuesday at 6pm \"Salle de sport\""],
  ["fr", "annule", "undo"],
  ["fr", "ouvre les finances", "open finance"],
  ["fr", "je suis fatigué", "I feel tired"],
  ["fr", "déplace le dentiste à vendredi à 11h", "move \"Dentiste\" to Friday at 11am"],
  ["fr", "supprime le rendez-vous chez le dentiste du planning", "delete \"Rendez-vous chez le dentiste\" from my plan"],
  ["fr", "j'ai terminé acheter du lait", "I finished \"Acheter du lait\""],
  ["fr", "écris une note : idées pour AURA", "write a note: Idées pour AURA"],
  ["fr", "nouvel objectif courir 10 km", "new goal \"Courir 10 km\""],
  ["fr", "active le mode sombre", "dark mode"],
  ["fr", "active les notifications", "turn on notifications"],
  ["fr", "rends mon profil privé", "make my profile private"],
  ["fr", "combien ai-je dépensé ce mois-ci ?", "how much did I spend"],
  ["fr", "comment j'ai dormi ?", "how did I sleep"],
  ["fr", "oui", "yes"],
  ["fr", "non", "no"],
  ["fr", "choisis toi", "you choose"],
  ["fr", "partage mon agenda avec Marco", "share my agenda with Marco"],
  ["fr", "mes horaires de travail sont de 9h à 17h", "set my working hours from 9am to 5pm"],
  ["fr", "marque acheter du lait comme urgent", "mark \"Acheter du lait\" as urgent"],
  ["fr", "résumé de la journée", "daily summary"],
  ["fr", "après-demain à 10h réunion équipe", "add \"Réunion équipe\" to my plan the day after tomorrow at 10am"],
  ["fr", "ajoute appeler maman dans 3 jours", "add \"Appeler maman\" to my plan in 3 days"],
  ["fr", "le 12 octobre à 20h30 dîner en famille", "add \"Dîner en famille\" to my plan 12 October at 8:30pm"],
  ["fr", "ajoute yoga demain à 7h30 pendant 1 heure", "add \"Yoga\" to my plan tomorrow at 7:30am for 1 hour"],
  ["fr", "blablabla qwerty", null],
  ["de", "füge Meeting mit Anna morgen um 15 Uhr zum Plan hinzu", "add \"Meeting mit Anna\" to my plan tomorrow at 3pm"],
  ["de", "füge die Aufgabe Milch kaufen hinzu", "add task \"Milch kaufen\""],
  ["de", "neue Aufgabe Bericht vorbereiten bis Freitag", "add task \"Bericht vorbereiten\" by Friday"],
  ["de", "was habe ich morgen?", "show my agenda tomorrow"],
  ["de", "wann bin ich am Freitag frei?", "when am I free Friday?"],
  ["de", "was soll ich jetzt tun?", "what should I do now?"],
  ["de", "plane den Monat", "plan my month"],
  ["de", "jeden Dienstag um 18 Uhr Fitnessstudio", "every Tuesday at 6pm \"Fitnessstudio\""],
  ["de", "rückgängig", "undo"],
  ["de", "öffne Finanzen", "open finance"],
  ["de", "ich bin müde", "I feel tired"],
  ["de", "verschiebe den Zahnarzt auf Freitag um 11 Uhr", "move \"Zahnarzt\" to Friday at 11am"],
  ["de", "lösche den Zahnarzttermin aus dem Plan", "delete \"Zahnarzttermin\" from my plan"],
  ["de", "ich habe Milch kaufen erledigt", "I finished \"Milch kaufen\""],
  ["de", "schreibe eine Notiz: Ideen für AURA", "write a note: Ideen für AURA"],
  ["de", "neues Ziel 10 km laufen", "new goal \"10 km laufen\""],
  ["de", "schalte den dunklen Modus ein", "dark mode"],
  ["de", "schalte die Benachrichtigungen ein", "turn on notifications"],
  ["de", "mach mein Profil privat", "make my profile private"],
  ["de", "wie viel habe ich diesen Monat ausgegeben?", "how much did I spend"],
  ["de", "wie habe ich geschlafen?", "how did I sleep"],
  ["de", "ja", "yes"],
  ["de", "nein", "no"],
  ["de", "entscheide du", "you choose"],
  ["de", "teile meinen Kalender mit Marco", "share my agenda with Marco"],
  ["de", "meine Arbeitszeit ist von 9 bis 17 Uhr", "set my working hours from 9am to 5pm"],
  ["de", "markiere Milch kaufen als dringend", "mark \"Milch kaufen\" as urgent"],
  ["de", "Tagesübersicht", "daily summary"],
  ["de", "übermorgen um 10 Uhr Teammeeting", "add \"Teammeeting\" to my plan the day after tomorrow at 10am"],
  ["de", "füge Mama anrufen in 3 Tagen hinzu", "add \"Mama anrufen\" to my plan in 3 days"],
  ["de", "am 12. Oktober um 20:30 Uhr Abendessen mit der Familie", "add \"Abendessen mit der Familie\" to my plan 12 October at 8:30pm"],
  ["de", "heute Abend um halb acht Yoga", "add \"Yoga\" to my plan today at 7:30pm", 'confirm'],
  ["de", "blablabla qwerty", null],
  ["pt", "adiciona reunião com Ana ao plano amanhã às 15h", "add \"Reunião com Ana\" to my plan tomorrow at 3pm"],
  ["pt", "adiciona tarefa comprar leite", "add task \"Comprar leite\""],
  ["pt", "adiciona a tarefa preparar relatório para sexta-feira", "add task \"Preparar relatório\" by Friday"],
  ["pt", "o que eu tenho amanhã?", "show my agenda tomorrow"],
  ["pt", "quando estou livre na sexta?", "when am I free Friday?"],
  ["pt", "o que devo fazer agora?", "what should I do now?"],
  ["pt", "planeja o mês", "plan my month"],
  ["pt", "toda terça às 18h academia", "every Tuesday at 6pm \"Academia\""],
  ["pt", "desfazer", "undo"],
  ["pt", "abre finanças", "open finance"],
  ["pt", "estou cansado", "I feel tired"],
  ["pt", "move o dentista para sexta às 11h", "move \"Dentista\" to Friday at 11am"],
  ["pt", "apaga a consulta do dentista do plano", "delete \"Consulta do dentista\" from my plan"],
  ["pt", "terminei comprar leite", "I finished \"Comprar leite\""],
  ["pt", "escreve uma nota: ideias para AURA", "write a note: Ideias para AURA"],
  ["pt", "novo objetivo correr 10 km", "new goal \"Correr 10 km\""],
  ["pt", "ativa o modo escuro", "dark mode"],
  ["pt", "ativa as notificações", "turn on notifications"],
  ["pt", "deixa meu perfil privado", "make my profile private"],
  ["pt", "quanto gastei este mês?", "how much did I spend"],
  ["pt", "como eu dormi?", "how did I sleep"],
  ["pt", "sim", "yes"],
  ["pt", "não", "no"],
  ["pt", "escolhe você", "you choose"],
  ["pt", "compartilha minha agenda com Marco", "share my agenda with Marco"],
  ["pt", "meu horário de trabalho é das 9 às 17", "set my working hours from 9am to 5pm"],
  ["pt", "marca comprar leite como urgente", "mark \"Comprar leite\" as urgent"],
  ["pt", "resumo do dia", "daily summary"],
  ["pt", "depois de amanhã às 10h da manhã reunião da equipe", "add \"Reunião da equipe\" to my plan the day after tomorrow at 10am"],
  ["pt", "adiciona ligar para mamãe daqui a 3 dias", "add \"Ligar para mamãe\" to my plan in 3 days"],
  ["pt", "dia 12 de outubro às 20:30 jantar em família", "add \"Jantar em família\" to my plan 12 October at 8:30pm"],
  ["pt", "agende yoga hoje às 19h por 1 hora", "add \"Yoga\" to my plan today at 7pm for 1 hour"],
  ["pt", "blablabla qwerty", null],
  ["id", "tambahkan rapat dengan Ani ke jadwal besok jam 3 sore", "add \"Rapat dengan Ani\" to my plan tomorrow at 3pm"],
  ["id", "tambahkan tugas beli susu", "add task \"Beli susu\""],
  ["id", "tambahkan tugas siapkan laporan hari Jumat", "add task \"Siapkan laporan\" by Friday"],
  ["id", "apa jadwal saya besok?", "show my agenda tomorrow"],
  ["id", "kapan saya kosong hari Jumat?", "when am I free Friday?"],
  ["id", "apa yang harus saya lakukan sekarang?", "what should I do now?"],
  ["id", "rencanakan bulan ini", "plan my month"],
  ["id", "setiap Selasa jam 6 sore olahraga", "every Tuesday at 6pm \"Olahraga\""],
  ["id", "batalkan", "undo"],
  ["id", "buka keuangan", "open finance"],
  ["id", "saya lelah", "I feel tired"],
  ["id", "pindahkan dokter gigi ke hari Jumat jam 11", "move \"Dokter gigi\" to Friday at 11am"],
  ["id", "hapus janji dokter gigi dari jadwal", "delete \"Janji dokter gigi\" from my plan"],
  ["id", "saya sudah selesai beli susu", "I finished \"Beli susu\""],
  ["id", "tulis catatan: ide untuk AURA", "write a note: Ide untuk AURA"],
  ["id", "tujuan baru lari 10 km", "new goal \"Lari 10 km\""],
  ["id", "aktifkan mode gelap", "dark mode"],
  ["id", "aktifkan notifikasi", "turn on notifications"],
  ["id", "jadikan profil saya privat", "make my profile private"],
  ["id", "berapa yang saya habiskan bulan ini?", "how much did I spend"],
  ["id", "bagaimana tidur saya?", "how did I sleep"],
  ["id", "ya", "yes"],
  ["id", "tidak", "no"],
  ["id", "pilih saja", "you choose"],
  ["id", "bagikan jadwal saya dengan Marco", "share my agenda with Marco"],
  ["id", "jam kerja saya dari jam 9 sampai jam 17", "set my working hours from 9am to 5pm"],
  ["id", "tandai beli susu sebagai mendesak", "mark \"Beli susu\" as urgent"],
  ["id", "ringkasan hari ini", "daily summary"],
  ["id", "lusa jam 10 pagi rapat tim", "add \"Rapat tim\" to my plan the day after tomorrow at 10am"],
  ["id", "tambahkan telepon ibu 3 hari lagi", "add \"Telepon ibu\" to my plan in 3 days"],
  ["id", "tanggal 12 Oktober jam 20.30 makan malam keluarga", "add \"Makan malam keluarga\" to my plan 12 October at 8:30pm"],
  ["id", "tambahkan yoga besok jam setengah 8 selama 1 jam", "add \"Yoga\" to my plan tomorrow at 7:30am for 1 hour"],
  ["id", "blablabla qwerty", null],
  ["ru", "добавь встречу с Анной в план завтра в 15:00", "add \"Встречу с Анной\" to my plan tomorrow at 3pm"],
  ["ru", "добавь задачу купить молоко", "add task \"Купить молоко\""],
  ["ru", "добавь задачу подготовить отчет до пятницы", "add task \"Подготовить отчет\" by Friday"],
  ["ru", "что у меня завтра?", "show my agenda tomorrow"],
  ["ru", "когда я свободен в пятницу?", "when am I free Friday?"],
  ["ru", "что мне делать сейчас?", "what should I do now?"],
  ["ru", "спланируй месяц", "plan my month"],
  ["ru", "каждый вторник в 18:00 спортзал", "every Tuesday at 6pm \"Спортзал\""],
  ["ru", "отмени", "undo"],
  ["ru", "открой финансы", "open finance"],
  ["ru", "я устал", "I feel tired"],
  ["ru", "перенеси стоматолога на пятницу на 11 утра", "move \"Стоматолога\" to Friday at 11am"],
  ["ru", "удали прием у стоматолога из плана", "delete \"Прием у стоматолога\" from my plan"],
  ["ru", "я сделал купить молоко", "I finished \"Купить молоко\""],
  ["ru", "напиши заметку: идеи для AURA", "write a note: Идеи для AURA"],
  ["ru", "новая цель пробежать 10 км", "new goal \"Пробежать 10 км\""],
  ["ru", "включи темную тему", "dark mode"],
  ["ru", "включи уведомления", "turn on notifications"],
  ["ru", "сделай мой профиль приватным", "make my profile private"],
  ["ru", "сколько я потратил в этом месяце?", "how much did I spend"],
  ["ru", "как я спал?", "how did I sleep"],
  ["ru", "да", "yes"],
  ["ru", "нет", "no"],
  ["ru", "решай сам", "you choose"],
  ["ru", "поделись расписанием с Марком", "share my agenda with Марком"],
  ["ru", "мои рабочие часы с 9 до 17", "set my working hours from 9am to 5pm"],
  ["ru", "отметь купить молоко как срочное", "mark \"Купить молоко\" as urgent"],
  ["ru", "сводка дня", "daily summary"],
  ["ru", "послезавтра в 10 утра встреча команды", "add \"Встреча команды\" to my plan the day after tomorrow at 10am"],
  ["ru", "добавь позвонить маме через 3 дня", "add \"Позвонить маме\" to my plan in 3 days"],
  ["ru", "12 октября в 20:30 ужин с семьей", "add \"Ужин с семьей\" to my plan 12 October at 8:30pm"],
  ["ru", "добавь йога сегодня в 7 вечера на 1 час", "add \"Йога\" to my plan today at 7pm for 1 hour"],
  ["ru", "бла бла qwerty", null],
  ["ar", "أضف اجتماع مع أحمد إلى خطتي غدا الساعة 3 مساء", "add \"اجتماع مع أحمد\" to my plan tomorrow at 3pm"],
  ["ar", "أضف مهمة شراء الحليب", "add task \"شراء الحليب\""],
  ["ar", "أضف مهمة تحضير التقرير يوم الجمعة", "add task \"تحضير التقرير\" by Friday"],
  ["ar", "ماذا لدي غدا", "show my agenda tomorrow"],
  ["ar", "متى أكون فارغا يوم الجمعة", "when am I free Friday?"],
  ["ar", "ماذا أفعل الآن", "what should I do now?"],
  ["ar", "خطط الشهر", "plan my month"],
  ["ar", "كل ثلاثاء الساعة 6 مساء النادي الرياضي", "every Tuesday at 6pm \"النادي الرياضي\""],
  ["ar", "تراجع", "undo"],
  ["ar", "افتح المالية", "open finance"],
  ["ar", "أنا متعب", "I feel tired"],
  ["ar", "انقل طبيب الأسنان إلى يوم الجمعة الساعة 11", "move \"طبيب الأسنان\" to Friday at 11am"],
  ["ar", "احذف موعد طبيب الأسنان من الجدول", "delete \"موعد طبيب الأسنان\" from my plan"],
  ["ar", "انتهيت من شراء الحليب", "I finished \"شراء الحليب\""],
  ["ar", "اكتب ملاحظة: أفكار لمشروع AURA", "write a note: أفكار لمشروع AURA"],
  ["ar", "هدف جديد الجري 10 كم", "new goal \"الجري 10 كم\""],
  ["ar", "فعل الوضع الداكن", "dark mode"],
  ["ar", "فعل الإشعارات", "turn on notifications"],
  ["ar", "اجعل ملفي الشخصي خاصا", "make my profile private"],
  ["ar", "كم أنفقت هذا الشهر", "how much did I spend"],
  ["ar", "كيف نمت", "how did I sleep"],
  ["ar", "نعم", "yes"],
  ["ar", "لا", "no"],
  ["ar", "اختر أنت", "you choose"],
  ["ar", "شارك جدولي مع مروان", "share my agenda with مروان"],
  ["ar", "ساعات العمل من 9 إلى 17", "set my working hours from 9am to 5pm"],
  ["ar", "علم شراء الحليب عاجل", "mark \"شراء الحليب\" as urgent"],
  ["ar", "ملخص اليوم", "daily summary"],
  ["ar", "بعد غد الساعة 10 صباحا اجتماع الفريق", "add \"اجتماع الفريق\" to my plan the day after tomorrow at 10am"],
  ["ar", "أضف الاتصال بأمي بعد 3 أيام", "add \"الاتصال بأمي\" to my plan in 3 days"],
  ["ar", "12 أكتوبر الساعة 8:30 مساء عشاء العائلة", "add \"عشاء العائلة\" to my plan 12 October at 8:30pm"],
  ["ar", "أضف يوغا اليوم الساعة 7 مساء لمدة ساعتين", "add \"يوغا\" to my plan today at 7pm for 2 hours"],
  ["ar", "بلا بلا qwerty", null],
  ["hi", "कल दोपहर 3 बजे अन्ना के साथ मीटिंग प्लान में जोड़ो", "add \"अन्ना के साथ मीटिंग\" to my plan tomorrow at 3pm"],
  ["hi", "टास्क जोड़ो दूध खरीदना", "add task \"दूध खरीदना\""],
  ["hi", "रिपोर्ट तैयार करना टास्क जोड़ो शुक्रवार तक", "add task \"रिपोर्ट तैयार करना\" by Friday"],
  ["hi", "कल मेरे पास क्या है", "show my agenda tomorrow"],
  ["hi", "शुक्रवार को मैं कब खाली हूँ", "when am I free Friday?"],
  ["hi", "अब मुझे क्या करना चाहिए", "what should I do now?"],
  ["hi", "इस महीने की योजना बनाओ", "plan my month"],
  ["hi", "हर मंगलवार शाम 6 बजे जिम", "every Tuesday at 6pm \"जिम\""],
  ["hi", "पूर्ववत", "undo"],
  ["hi", "वित्त खोलो", "open finance"],
  ["hi", "मैं थका हुआ हूँ", "I feel tired"],
  ["hi", "दंत चिकित्सक की मीटिंग शुक्रवार सुबह 11 बजे पर शिफ्ट करो", "move \"दंत चिकित्सक की मीटिंग\" to Friday at 11am"],
  ["hi", "प्लान से डॉक्टर की अपॉइंटमेंट हटाओ", "delete \"डॉक्टर की अपॉइंटमेंट\" from my plan"],
  ["hi", "दूध खरीदना पूरा हो गया", "I finished \"दूध खरीदना\""],
  ["hi", "नोट लिखो: AURA के लिए आइडिया", "write a note: AURA के लिए आइडिया"],
  ["hi", "नया लक्ष्य 10 किमी दौड़ना", "new goal \"10 किमी दौड़ना\""],
  ["hi", "डार्क मोड चालू करो", "dark mode"],
  ["hi", "नोटिफिकेशन चालू करो", "turn on notifications"],
  ["hi", "मेरी प्रोफ़ाइल प्राइवेट करो", "make my profile private"],
  ["hi", "इस महीने मैंने कितना खर्च किया", "how much did I spend"],
  ["hi", "मेरी नींद कैसी रही", "how did I sleep"],
  ["hi", "हाँ", "yes"],
  ["hi", "नहीं", "no"],
  ["hi", "तुम चुनो", "you choose"],
  ["hi", "अपना एजेंडा राहुल को शेयर करो", "share my agenda with राहुल"],
  ["hi", "मेरे काम के घंटे 9 से 17 बजे", "set my working hours from 9am to 5pm"],
  ["hi", "दूध खरीदना को अर्जेंट मार्क करो", "mark \"दूध खरीदना\" as urgent"],
  ["hi", "आज का सारांश", "daily summary"],
  ["hi", "परसों सुबह 10 बजे टीम मीटिंग", "add \"टीम मीटिंग\" to my plan the day after tomorrow at 10am"],
  ["hi", "मम्मी को फोन करना 3 दिन में जोड़ो", "add \"मम्मी को फोन करना\" to my plan in 3 days"],
  ["hi", "12 अक्टूबर को रात 8:30 बजे परिवार के साथ डिनर", "add \"परिवार के साथ डिनर\" to my plan 12 October at 8:30pm"],
  ["hi", "आज शाम 7 बजे योग 2 घंटे के लिए जोड़ो", "add \"योग\" to my plan today at 7pm for 2 hours"],
  ["hi", "ब्ला ब्ला qwerty", null],
  ["zh", "明天下午三点添加和安娜的会议到日程", "add \"和安娜的会议\" to my plan tomorrow at 3pm"],
  ["zh", "添加任务买牛奶", "add task \"买牛奶\""],
  ["zh", "添加任务：周五之前准备报告", "add task \"准备报告\" by Friday"],
  ["zh", "明天有什么安排", "show my agenda tomorrow"],
  ["zh", "周五我什么时候有空", "when am I free Friday?"],
  ["zh", "我现在该做什么", "what should I do now?"],
  ["zh", "规划这个月", "plan my month"],
  ["zh", "每周二下午6点健身", "every Tuesday at 6pm \"健身\""],
  ["zh", "撤销", "undo"],
  ["zh", "打开财务", "open finance"],
  ["zh", "我很累", "I feel tired"],
  ["zh", "把牙医改到周五上午11点", "move \"牙医\" to Friday at 11am"],
  ["zh", "删除日程里的牙医预约", "delete \"牙医预约\" from my plan"],
  ["zh", "我买牛奶做完了", "I finished \"买牛奶\""],
  ["zh", "写一条笔记：AURA的想法", "write a note: AURA的想法"],
  ["zh", "新目标跑步十公里", "new goal \"跑步十公里\""],
  ["zh", "开启深色模式", "dark mode"],
  ["zh", "打开通知", "turn on notifications"],
  ["zh", "把我的资料设为私密", "make my profile private"],
  ["zh", "这个月我花了多少钱", "how much did I spend"],
  ["zh", "我睡得怎么样", "how did I sleep"],
  ["zh", "是的", "yes"],
  ["zh", "不用", "no"],
  ["zh", "你来选", "you choose"],
  ["zh", "把我的日程分享给小明", "share my agenda with 小明"],
  ["zh", "我的工作时间是9点到17点", "set my working hours from 9am to 5pm"],
  ["zh", "把买牛奶标记为紧急", "mark \"买牛奶\" as urgent"],
  ["zh", "今日简报", "daily summary"],
  ["zh", "后天上午十点团队会议", "add \"团队会议\" to my plan the day after tomorrow at 10am"],
  ["zh", "三天后提醒我给妈妈打电话", "add \"给妈妈打电话\" to my plan in 3 days"],
  ["zh", "10月12日晚上8点半家庭聚餐", "add \"家庭聚餐\" to my plan 12 October at 8:30pm"],
  ["zh", "今天晚上7点添加瑜伽，持续2小时", "add \"瑜伽\" to my plan today at 7pm for 2 hours"],
  ["zh", "啦啦啦 qwerty", null],
  ["ja", "明日の午後3時にアンナとの打ち合わせを予定に追加して", "add \"アンナとの打ち合わせ\" to my plan tomorrow at 3pm"],
  ["ja", "牛乳を買うタスクを追加して", "add task \"牛乳を買う\""],
  ["ja", "金曜日までに報告書を準備するタスクを追加", "add task \"報告書を準備する\" by Friday"],
  ["ja", "明日の予定を教えて", "show my agenda tomorrow"],
  ["ja", "金曜日はいつ空いてる？", "when am I free Friday?"],
  ["ja", "今何をすべき？", "what should I do now?"],
  ["ja", "今月の計画を立てて", "plan my month"],
  ["ja", "毎週火曜日の午後6時にジム", "every Tuesday at 6pm \"ジム\""],
  ["ja", "元に戻して", "undo"],
  ["ja", "家計を開いて", "open finance"],
  ["ja", "疲れた", "I feel tired"],
  ["ja", "歯医者を金曜日の11時に移動して", "move \"歯医者\" to Friday at 11am"],
  ["ja", "予定から歯医者の予約を削除して", "delete \"歯医者の予約\" from my plan"],
  ["ja", "牛乳を買うのが終わった", "I finished \"牛乳を買う\""],
  ["ja", "メモ：AURAのアイデア", "write a note: AURAのアイデア"],
  ["ja", "新しい目標：10キロ走る", "new goal \"10キロ走る\""],
  ["ja", "ダークモードをオンにして", "dark mode"],
  ["ja", "通知をオンにして", "turn on notifications"],
  ["ja", "プロフィールを非公開にして", "make my profile private"],
  ["ja", "今月いくら使った？", "how much did I spend"],
  ["ja", "昨夜はよく眠れた？", "how did I sleep"],
  ["ja", "はい", "yes"],
  ["ja", "いいえ", "no"],
  ["ja", "おまかせ", "you choose"],
  ["ja", "田中さんに予定を共有して", "share my agenda with 田中"],
  ["ja", "勤務時間は9時から17時", "set my working hours from 9am to 5pm"],
  ["ja", "牛乳を買うのを緊急にして", "mark \"牛乳を買う\" as urgent"],
  ["ja", "今日のまとめ", "daily summary"],
  ["ja", "明後日の午前10時にチームミーティング", "add \"チームミーティング\" to my plan the day after tomorrow at 10am"],
  ["ja", "3日後に母に電話する予定を入れて", "add \"母に電話する\" to my plan in 3 days"],
  ["ja", "10月12日の午後8時半に家族で夕食", "add \"家族で夕食\" to my plan 12 October at 8:30pm"],
  ["ja", "今日の夜7時にヨガを2時間追加して", "add \"ヨガ\" to my plan today at 7pm for 2 hours"],
  ["ja", "ららら qwerty", null],
];

for (const [lang, text, expected, kind] of CASES) {
  test(`[${lang}] ${text}`, () => {
    const u = understand(text, lang, { forced: true });
    if (expected === null) { assert.equal(u.status, 'unknown'); return; }
    assert.equal(u.text, expected);
    assert.equal(u.status, kind === 'confirm' ? 'confirm' : 'translated');
    assert.equal(u.lang, lang);
  });
}

test('copertura: almeno 25 comandi riconosciuti per ciascuna delle 10 lingue', () => {
  for (const lang of ['es', 'fr', 'de', 'pt', 'id', 'ru', 'ar', 'hi', 'zh', 'ja']) {
    const ok = CASES.filter((c) => c[0] === lang && c[2] !== null && c[3] !== 'confirm').length;
    assert.ok(ok >= 25, `${lang}: ${ok}`);
  }
});

test('italiano e inglese passano com’è all’assistente locale', () => {
  assert.deepEqual(understand('aggiungi riunione al piano domani alle 15', 'it'), { status: 'passthrough', text: 'aggiungi riunione al piano domani alle 15', lang: 'it' });
  assert.equal(understand('add task buy milk', 'en').status, 'passthrough');
  // lingua dell'app spagnola ma frase inglese: rilevata e passata
  const u = understand('add task buy milk', 'es', { appLang: 'es' });
  assert.equal(u.status, 'passthrough');
  assert.equal(u.lang, 'en');
});

test('rilevamento della lingua: script e parole funzione', () => {
  assert.equal(scriptOf('明天开会'), 'zh');
  assert.equal(scriptOf('明日会議です'), 'ja');
  assert.equal(scriptOf('कल मीटिंग'), 'hi');
  assert.equal(scriptOf('غدا اجتماع'), 'ar');
  assert.equal(scriptOf('завтра встреча'), 'ru');
  assert.equal(detectLang('agrega una tarea para mañana').lang, 'es');
  assert.equal(detectLang('ajoute une tâche pour demain').lang, 'fr');
  assert.equal(detectLang('füge morgen einen Termin hinzu').lang, 'de');
  assert.equal(detectLang('adiciona uma tarefa para amanhã').lang, 'pt');
  assert.equal(detectLang('tambahkan tugas besok tolong').lang, 'id');
  assert.equal(detectLang('aggiungi un impegno domani').lang, 'it');
  assert.equal(detectLang('add a task for tomorrow please').lang, 'en');
  // incerto: vince la lingua dell'app
  assert.equal(detectLang('ok', 'de').lang, 'de');
  // cinese vs giapponese: solo caratteri Han + lingua scelta ja
  assert.equal(detectLang('会議', 'ja').lang, 'ja');
});

test('rilevamento automatico: la lingua del messaggio decide, non quella dell’app', () => {
  const u = understand('agrega una tarea comprar leche', 'it', { appLang: 'it' });
  assert.equal(u.status, 'translated');
  assert.equal(u.lang, 'es');
  assert.equal(u.text, 'add task "Comprar leche"');
});

test('cifre arabo-indic, devanagari e a larghezza piena', () => {
  assert.equal(understand('أضف اجتماع مع أحمد غدا الساعة ٣ مساء', 'ar', { forced: true }).text, 'add "اجتماع مع أحمد" to my plan tomorrow at 3pm');
  assert.equal(understand('कल शाम ६ बजे जिम जोड़ो', 'hi', { forced: true }).text, 'add "जिम" to my plan tomorrow at 6pm');
  assert.equal(understand('明天下午３点开会', 'zh', { forced: true }).text, 'add "开会" to my plan tomorrow at 3pm');
});

test('formati orari locali', () => {
  const t = (lang, s) => understand(s, lang, { forced: true }).text;
  assert.match(t('es', 'agrega reunión mañana a las 3 y media de la tarde'), /tomorrow at 3:30pm$/);
  assert.match(t('es', 'agrega reunión mañana a las 9 de la noche'), /tomorrow at 9pm$/);
  assert.match(t('fr', 'ajoute réunion demain à 3 heures et quart de l’après-midi'), /tomorrow at 3:15pm$/);
  assert.match(t('de', 'füge Meeting morgen um halb vier hinzu'), /tomorrow at 3:30pm$/);
  assert.match(t('de', 'füge Meeting morgen um Viertel vor vier hinzu'), /tomorrow at 3:45pm$/);
  assert.match(t('pt', 'adiciona reunião amanhã às 3 e meia da tarde'), /tomorrow at 3:30pm$/);
  assert.match(t('id', 'tambahkan rapat besok jam setengah 4 sore'), /tomorrow at 3:30pm$/);
  assert.match(t('ru', 'добавь встречу завтра в 3 часа дня'), /tomorrow at 3pm$/);
  assert.match(t('ru', 'добавь встречу завтра в половине четвертого'), /tomorrow at 3:30pm$/);
  assert.match(t('ar', 'أضف اجتماع غدا الساعة 3 مساء'), /tomorrow at 3pm$/);
  assert.match(t('hi', 'कल दोपहर 3 बजे मीटिंग जोड़ो'), /tomorrow at 3pm$/);
  assert.match(t('hi', 'कल साढ़े तीन बजे मीटिंग जोड़ो'), /tomorrow at 3:30pm$/);
  assert.match(t('hi', 'कल पौने चार बजे मीटिंग जोड़ो'), /tomorrow at 3:45pm$/);
  assert.match(t('zh', '明天下午3点半添加会议'), /tomorrow at 3:30pm$/);
  assert.match(t('zh', '明天晚上八点添加会议'), /tomorrow at 8pm$/);
  assert.match(t('ja', '明日の午後3時15分に会議を追加して'), /tomorrow at 3:15pm$/);
  assert.match(t('ja', '明日の15時に会議を追加して'), /tomorrow at 3pm$/);
  assert.match(t('es', 'agrega reunión de 9 a 11 mañana'), /tomorrow from 9am to 11am$/);
});

test('titoli tra virgolette restano identici', () => {
  assert.equal(understand('agrega «Cena con la tía Mª» mañana a las 8 de la noche', 'es', { forced: true }).text, 'add "Cena con la tía Mª" to my plan tomorrow at 8pm');
  assert.equal(understand('明天下午三点添加“和 Anna 的 Q4 会议”', 'zh', { forced: true }).text, 'add "和 Anna 的 Q4 会议" to my plan tomorrow at 3pm');
  assert.equal(understand('「田中さんとランチ」を明日の12時に追加して', 'ja', { forced: true }).text, 'add "田中さんとランチ" to my plan tomorrow at 12pm');
});

test('onestà: frasi libere e domande aperte non vengono tradotte a caso', () => {
  for (const [lang, s] of [
    ['es', '¿cuál es la capital de Australia?'], ['fr', 'écris-moi un poème sur la mer'], ['de', 'erkläre mir die Relativitätstheorie'],
    ['ru', 'расскажи анекдот про кота'], ['zh', '帮我写一首关于春天的诗'], ['ja', '東京の天気はどうですか'], ['ar', 'ما هي عاصمة فرنسا'],
  ]) {
    const u = understand(s, lang, { forced: true });
    assert.notEqual(u.status, 'translated', `${lang}: ${s} -> ${u.text}`);
  }
});

test('risposte secche (sì/no/scegli tu) e solo data/ora', () => {
  assert.equal(understand('mañana a las 5', 'es', { forced: true }).text, 'tomorrow at 5pm');
  assert.equal(understand('demain', 'fr', { forced: true }).text, 'tomorrow');
  assert.equal(understand('sí, por favor', 'es', { forced: true }).status, 'unknown');
});

/* ---------- integrazione: il comando canonico viene eseguito davvero dall'assistente ---------- */

function mkEnv() {
  const st = { events: {}, tasks: [], notes: [], goal: null, mood: null, dark: null, notif: null, priv: false, hours: null };
  const env = {
    now: () => new Date(2026, 9, 7, 10, 0),
    events: () => st.events,
    addEvent: (d, e) => { (st.events[d] ??= []).push({ ...e }); },
    delEvent: (d, e) => { st.events[d] = (st.events[d] ?? []).filter((x) => !(x.time === e.time && x.title === e.title)); },
    tasks: () => st.tasks,
    addTask: (t) => { const id = String(st.tasks.length + 1); st.tasks.push({ id, t }); return id; },
    setTaskDone: (id, v) => { st.tasks.find((t) => t.id === id).done = v; },
    delTask: (id) => { const t = st.tasks.find((x) => x.id === id) ?? null; st.tasks = st.tasks.filter((x) => x.id !== id); return t; },
    restoreTask: (t) => { st.tasks.push(t); }, renameTask: (id, t) => { st.tasks.find((x) => x.id === id).t = t; },
    addNote: (t) => st.notes.push(t), addGoal: (g) => { st.goal = g; }, logMood: (m) => { st.mood = m; },
    workHours: () => ({ start: '09:00', end: '18:00' }), setWorkHours: (a, b) => { st.hours = [a, b]; }, setDark: (d) => { st.dark = d; }, setNotifications: (o) => { st.notif = o; },
    setPrivateProfile: (on) => { st.priv = on; }, isPrivateProfile: () => st.priv, pickProfilePhoto: async () => true,
    financeReport: () => 'fin', healthReport: () => 'sal', moodReport: () => 'umore',
    shareAgenda: (p) => `Inviata a ${p}`, people: () => ['Marco T.'],
    setTaskDue: (id, d) => { st.tasks.find((t) => t.id === id).due = d; },
    addRecurring: (day, ev, until, kind) => { st.rec = { day, ev, kind }; return 'rec:1'; }, delByRef: () => {},
    briefing: () => ({ title: 'B', body: 'b' }), setTaskUrgent: (id, v) => { st.tasks.find((t) => t.id === id).urgent = v; }, setEventImportant: () => {}, userName: () => 'Alex',
  };
  return { env, st };
}
async function say(lang, ...lines) {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  let last;
  for (const l of lines) { const u = understand(l, lang, { forced: true }); last = await a.handle(u.text ?? l); }
  return { st, last };
}

test('esecuzione: aggiungere un impegno in spagnolo, titolo identico', async () => {
  const { st } = await say('es', 'agrega «Cena con la familia» mañana a las 8 de la noche');
  assert.deepEqual(st.events['2026-10-08'], [{ time: '20:00', title: 'Cena con la familia', dur: 60 }]);
});
test('esecuzione: task in giapponese e completamento', async () => {
  const { st } = await say('ja', '牛乳を買うタスクを追加して', '牛乳を買うのが終わった');
  assert.equal(st.tasks[0].t, '牛乳を買う'); assert.equal(st.tasks[0].done, true);
});
test('esecuzione: ricorrenza in tedesco', async () => {
  const { st } = await say('de', 'jeden Dienstag um 18 Uhr Fitnessstudio');
  assert.equal(st.rec.ev.title, 'Fitnessstudio'); assert.equal(st.rec.ev.time, '18:00'); assert.equal(st.rec.kind, 'weekly');
});
test('esecuzione: impostazioni in russo e arabo', async () => {
  const r = await say('ru', 'включи темную тему'); assert.equal(r.st.dark, true);
  const a = await say('ar', 'اجعل ملفي الشخصي خاصا'); assert.equal(a.st.priv, true);
});
test('esecuzione: orario di lavoro in francese, nota in portoghese, obiettivo in indonesiano', async () => {
  assert.deepEqual((await say('fr', 'mes horaires de travail sont de 8h à 16h')).st.hours, ['08:00', '16:00']);
  assert.deepEqual((await say('pt', 'escreve uma nota: ideias para AURA')).st.notes, ['Ideias para AURA']);
  assert.equal((await say('id', 'tujuan baru lari 10 km')).st.goal, 'Lari 10 km');
});
test('esecuzione: sposta e cancella in hindi/cinese', async () => {
  const { env, st } = mkEnv(); const a = new Assistant(env);
  await a.handle(understand('明天下午三点添加牙医预约到日程', 'zh', { forced: true }).text);
  assert.equal(st.events['2026-10-08'][0].title, '牙医预约');
  await a.handle(understand('把牙医预约改到周五上午11点', 'zh', { forced: true }).text);
  assert.ok(st.events['2026-10-09']?.some((e) => e.time === '11:00'), JSON.stringify(st.events));
  const r = await a.handle(understand('删除日程里的牙医预约', 'zh', { forced: true }).text);
  assert.ok(r.handled);
  assert.equal(Object.values(st.events).flat().length, 0);
});
