/**
 * Parole chiave per riconoscere il compito, in 12 lingue (it,en,es,fr,de,pt,zh,hi,ar,ru,ja,id).
 * Scritte in forma naturale: classify.ts le normalizza (minuscole, senza accenti latini/cirillici) prima del confronto.
 * Per le lingue con spazi si confronta l'inizio di parola (cosi' "disegna" copre "disegnami"); per cinese/giapponese/arabo/hindi basta la presenza.
 */
export type Lang = 'it' | 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'hi' | 'ar' | 'ru' | 'ja' | 'id';
export const LANGS: Lang[] = ['it', 'en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ar', 'ru', 'ja', 'id'];
export type KW = Record<Lang, string[]>;

/** verbi generici "crea / genera / fai" */
export const MAKE: KW = {
  it: ['crea', 'creami', 'genera', 'generami', 'fai', 'fammi', 'realizza', 'produci', 'preparami', 'prepara', 'scrivi', 'scrivimi', 'componi'],
  en: ['create', 'generate', 'make', 'produce', 'write', 'compose', 'prepare', 'build', 'give me'],
  es: ['crea', 'genera', 'haz', 'hazme', 'realiza', 'produce', 'escribe', 'compon', 'prepara'],
  fr: ['cree', 'genere', 'fais', 'fabrique', 'realise', 'produis', 'ecris', 'compose', 'prepare'],
  de: ['erstelle', 'erzeuge', 'generiere', 'mach', 'mache', 'produziere', 'schreibe', 'komponiere', 'bereite'],
  pt: ['cria', 'crie', 'gera', 'gere', 'faz', 'faca', 'produz', 'escreve', 'escreva', 'compoe', 'componha', 'prepara'],
  zh: ['生成', '创建', '制作', '做一', '做个', '做张', '写一', '写个', '创作', '编写', '帮我做'],
  hi: ['बनाओ', 'बनाइए', 'बनाएं', 'बना दो', 'तैयार करो', 'लिखो', 'जनरेट'],
  ar: ['انشئ', 'أنشئ', 'انشيء', 'ولد', 'ولّد', 'اصنع', 'اعمل', 'اكتب', 'لحن', 'حضر', 'جهز', 'انتج'],
  ru: ['создай', 'сгенерируй', 'сделай', 'сотвори', 'напиши', 'составь', 'подготовь', 'придумай'],
  ja: ['作って', '作成', '生成', '作る', '書いて', '作曲', '制作', 'つくって'],
  id: ['buat', 'buatkan', 'bikin', 'bikinkan', 'hasilkan', 'ciptakan', 'tulis', 'tuliskan', 'gubah', 'siapkan'],
};

/** verbi che da soli significano "disegna" */
export const DRAW: KW = {
  it: ['disegna', 'disegnami', 'disegnare', 'dipingi', 'dipingimi', 'illustrami', 'illustra'],
  en: ['draw me', 'draw a', 'draw an', 'draw the', 'draw some', 'draw my', 'sketch', 'paint a', 'paint me', 'paint an', 'illustrate'],
  es: ['dibuja', 'dibujame', 'pinta un', 'pinta una', 'ilustra'],
  fr: ['dessine', 'peins', 'illustre'],
  de: ['zeichne', 'male ein', 'male mir', 'male eine', 'male einen'],
  pt: ['desenha', 'desenhe', 'pinta um', 'pinta uma', 'pinte um', 'pinte uma', 'ilustra', 'ilustre'],
  zh: ['画一', '画个', '画张', '画出', '绘制', '帮我画', '给我画'],
  hi: ['ड्रॉ', 'पेंट करो', 'स्केच'],
  ar: ['ارسم'],
  ru: ['нарисуй', 'изобрази', 'набросай', 'нарисовать'],
  ja: ['描いて', '描く', '描画'],
  id: ['gambarkan', 'lukis', 'lukiskan'],
};

/** sostantivi "immagine" */
export const IMG: KW = {
  it: ['immagine', 'immagini', 'foto', 'fotografia', 'illustrazione', 'logo', 'poster', 'locandina', 'wallpaper', 'sfondo per'],
  en: ['image', 'picture', 'photo', 'illustration', 'logo', 'poster', 'wallpaper', 'artwork'],
  es: ['imagen', 'imagenes', 'foto', 'fotografia', 'ilustracion', 'logo', 'cartel', 'fondo de pantalla'],
  fr: ['image', 'photo', 'illustration', 'logo', 'affiche', "fond d'ecran"],
  de: ['bild', 'bilder', 'foto', 'illustration', 'logo', 'poster', 'hintergrundbild'],
  pt: ['imagem', 'imagens', 'foto', 'fotografia', 'ilustracao', 'logo', 'logotipo', 'cartaz', 'papel de parede'],
  zh: ['图片', '图像', '照片', '插图', '插画', '标志', '海报', '壁纸'],
  hi: ['चित्र', 'तस्वीर', 'फोटो', 'इमेज', 'छवि', 'लोगो', 'पोस्टर', 'वॉलपेपर'],
  ar: ['صورة', 'صور', 'رسمة', 'شعار', 'ملصق', 'خلفية'],
  ru: ['изображени', 'картинк', 'картин', 'фото', 'фотографи', 'иллюстраци', 'логотип', 'постер', 'обои'],
  ja: ['画像', '写真', 'イラスト', '絵', 'ロゴ', 'ポスター', '壁紙'],
  id: ['gambar', 'foto', 'ilustrasi', 'logo', 'poster', 'wallpaper'],
};

/** sostantivi "canzone / musica" */
export const SONG: KW = {
  it: ['canzone', 'canzoni', 'brano', 'jingle', 'melodia', 'musica', 'inno', 'ritornello'],
  en: ['song', 'track', 'tune', 'jingle', 'melody', 'music', 'lyrics'],
  es: ['cancion', 'canciones', 'melodia', 'jingle', 'musica', 'tema musical'],
  fr: ['chanson', 'chansons', 'morceau', 'jingle', 'melodie', 'musique'],
  de: ['lied', 'song', 'musikstuck', 'melodie', 'jingle', 'musik'],
  pt: ['cancao', 'cancoes', 'musica', 'melodia', 'jingle'],
  zh: ['歌曲', '歌', '曲子', '音乐', '旋律'],
  hi: ['गाना', 'गीत', 'संगीत', 'धुन', 'जिंगल'],
  ar: ['اغنية', 'أغنية', 'اغاني', 'لحن', 'موسيقى', 'مقطوعة'],
  ru: ['песн', 'трек', 'мелоди', 'джингл', 'музык'],
  ja: ['曲', '歌', '歌詞', '音楽', 'ソング', 'メロディ', 'ジングル'],
  id: ['lagu', 'musik', 'melodi', 'jingle', 'lirik'],
};

/** "metti / ascolta / riproduci": ascoltare musica non e' crearla */
export const PLAY: KW = {
  it: ['metti', 'ascolta', 'riproduci', 'suona', 'fammi sentire'],
  en: ['play', 'listen', 'put on'],
  es: ['pon ', 'escucha', 'reproduce'],
  fr: ['joue', 'ecoute', 'mets'],
  de: ['spiel', 'hore', 'spiele'],
  pt: ['toca', 'ouve', 'poe'],
  zh: ['播放', '听', '放一'],
  hi: ['बजाओ', 'सुनाओ'],
  ar: ['شغل لي', 'استمع', 'اسمع'],
  ru: ['включи', 'послушай', 'сыграй'],
  ja: ['再生', '流して', '聴かせ'],
  id: ['putar', 'dengarkan', 'mainkan'],
};

/** "scatta una foto": fotografare non e' generare */
export const TAKE_PHOTO: KW = {
  it: ['scatta', 'fotografa'],
  en: ['take a photo', 'take a picture', 'take photo', 'snap a'],
  es: ['toma una foto', 'saca una foto', 'tomar una foto'],
  fr: ['prends une photo', 'prendre une photo'],
  de: ['nimm ein foto', 'fotografiere', 'nimm ein bild'],
  pt: ['tira uma foto', 'tire uma foto'],
  zh: ['拍照', '拍一张', '拍张'],
  hi: ['फोटो खींच', 'तस्वीर खींच'],
  ar: ['التقط صورة'],
  ru: ['сфотографируй'],
  ja: ['撮って', '撮影'],
  id: ['ambil foto'],
};

/** documenti per formato */
export const DOC_DOCX: KW = {
  it: ['documento', 'relazione', 'lettera', 'contratto', 'curriculum', 'verbale', 'word', 'docx', 'report'],
  en: ['document', 'report', 'letter', 'contract', 'resume', 'cv', 'word doc', 'docx'],
  es: ['documento', 'informe', 'carta', 'contrato', 'curriculum', 'word', 'docx'],
  fr: ['document', 'rapport', 'lettre', 'contrat', 'cv', 'word', 'docx'],
  de: ['dokument', 'bericht', 'brief', 'vertrag', 'lebenslauf', 'word', 'docx'],
  pt: ['documento', 'relatorio', 'carta', 'contrato', 'curriculo', 'word', 'docx'],
  zh: ['文档', '报告', '信件', '合同', '简历', 'word'],
  hi: ['दस्तावेज़', 'दस्तावेज', 'रिपोर्ट', 'पत्र', 'अनुबंध', 'रिज्यूमे', 'वर्ड'],
  ar: ['مستند', 'وثيقة', 'تقرير', 'رسالة', 'عقد', 'سيرة ذاتية', 'وورد'],
  ru: ['документ', 'отчет', 'письм', 'договор', 'резюме', 'ворд', 'docx'],
  ja: ['文書', 'ドキュメント', 'レポート', '手紙', '契約書', '履歴書', 'ワード'],
  id: ['dokumen', 'laporan', 'surat', 'kontrak', 'cv', 'word', 'docx'],
};
export const DOC_PDF: KW = {
  it: ['pdf'], en: ['pdf'], es: ['pdf'], fr: ['pdf'], de: ['pdf'], pt: ['pdf'], zh: ['pdf'], hi: ['pdf', 'पीडीएफ'], ar: ['pdf', 'بي دي اف'], ru: ['pdf', 'пдф'], ja: ['pdf'], id: ['pdf'],
};
export const DOC_SLIDES: KW = {
  it: ['presentazione', 'slide', 'diapositive', 'powerpoint', 'pptx', 'keynote'],
  en: ['presentation', 'slides', 'slide deck', 'powerpoint', 'pptx', 'keynote', 'deck'],
  es: ['presentacion', 'diapositivas', 'powerpoint', 'pptx'],
  fr: ['presentation', 'diapositives', 'powerpoint', 'pptx', 'diaporama'],
  de: ['prasentation', 'folien', 'powerpoint', 'pptx'],
  pt: ['apresentacao', 'slides', 'powerpoint', 'pptx'],
  zh: ['演示文稿', '幻灯片', 'ppt', 'powerpoint'],
  hi: ['प्रेजेंटेशन', 'स्लाइड', 'पावरपॉइंट'],
  ar: ['عرض تقديمي', 'شرائح', 'باوربوينت'],
  ru: ['презентаци', 'слайд', 'powerpoint', 'пауэрпоинт', 'pptx'],
  ja: ['プレゼン', 'スライド', 'パワーポイント', 'pptx'],
  id: ['presentasi', 'slide', 'powerpoint', 'pptx'],
};
export const DOC_SHEET: KW = {
  it: ['foglio di calcolo', 'foglio excel', 'excel', 'xlsx', 'spreadsheet', 'csv'],
  en: ['spreadsheet', 'excel', 'xlsx', 'csv'],
  es: ['hoja de calculo', 'excel', 'xlsx', 'csv'],
  fr: ['feuille de calcul', 'tableur', 'excel', 'xlsx', 'csv'],
  de: ['tabellenkalkulation', 'excel', 'xlsx', 'csv', 'tabelle'],
  pt: ['planilha', 'folha de calculo', 'excel', 'xlsx', 'csv'],
  zh: ['电子表格', '表格', 'excel'],
  hi: ['स्प्रेडशीट', 'एक्सेल', 'तालिका'],
  ar: ['جدول بيانات', 'اكسل', 'إكسل'],
  ru: ['таблиц', 'эксель', 'excel', 'xlsx', 'csv'],
  ja: ['スプレッドシート', '表計算', 'エクセル', 'excel', 'csv'],
  id: ['spreadsheet', 'lembar kerja', 'excel', 'xlsx', 'csv'],
};

export const WEB: KW = {
  it: ['cerca sul web', 'cerca su internet', 'cerca online', 'ricerca sul web', 'ricerca online', 'cerca in rete', 'cerca in internet'],
  en: ['search the web', 'search online', 'search the internet', 'google it', 'look it up online', 'web search'],
  es: ['busca en la web', 'busca en internet', 'busca en linea', 'buscar en la web'],
  fr: ['cherche sur le web', 'cherche sur internet', 'recherche sur le web', 'recherche en ligne', 'cherche en ligne'],
  de: ['suche im internet', 'suche im web', 'internetsuche', 'recherchiere im web', 'such im netz', 'suche online'],
  pt: ['pesquisa na web', 'pesquisa na internet', 'pesquise na web', 'pesquise na internet', 'procura na web', 'busca na internet'],
  zh: ['上网搜索', '联网搜索', '网上搜索', '搜索网络', '在网上查'],
  hi: ['वेब पर खोज', 'इंटरनेट पर खोज', 'ऑनलाइन खोज', 'वेब पर सर्च', 'इंटरनेट पर सर्च'],
  ar: ['ابحث في الانترنت', 'ابحث في الإنترنت', 'ابحث على الويب', 'ابحث في الويب', 'ابحث على الانترنت', 'بحث على الويب'],
  ru: ['найди в интернете', 'поищи в интернете', 'поиск в интернете', 'найди в сети', 'поищи в сети', 'поиск в сети', 'ищи в интернете', 'найди в вебе'],
  ja: ['ウェブで検索', 'ネットで検索', 'インターネットで検索', 'ウェブ検索', 'ネットで調べて', 'ウェブで調べて'],
  id: ['cari di web', 'cari di internet', 'cari online', 'pencarian web', 'telusuri web', 'telusuri internet'],
};

export const AGENT_NOUN: KW = {
  it: ['agente', 'agenti'], en: ['agent', 'agents'], es: ['agente', 'agentes'], fr: ['agent', 'agents'], de: ['agent', 'agenten'], pt: ['agente', 'agentes'],
  zh: ['智能体', '代理'], hi: ['एजेंट'], ar: ['وكيل'], ru: ['агент'], ja: ['エージェント'], id: ['agen'],
};
export const AGENT_VERB: KW = {
  it: ['usa', 'lancia', 'affida', 'delega', 'avvia', 'fai fare'], en: ['use', 'run', 'launch', 'start', 'delegate', 'hand to', 'let'],
  es: ['usa', 'lanza', 'delega', 'inicia', 'utiliza'], fr: ['utilise', 'lance', 'delegue', 'demarre', 'confie'], de: ['nutze', 'benutze', 'starte', 'delegiere', 'verwende'],
  pt: ['usa', 'use', 'lanca', 'lance', 'delega', 'delegue', 'inicia', 'inicie'], zh: ['使用', '启动', '让', '交给', '运行'], hi: ['इस्तेमाल', 'उपयोग', 'चलाओ', 'शुरू', 'सौंप'],
  ar: ['استخدم', 'ابدأ', 'كلف', 'اطلق'], ru: ['используй', 'запусти', 'поручи', 'задействуй', 'делегируй'], ja: ['使って', '使用', '起動', '任せ', '実行'],
  id: ['gunakan', 'jalankan', 'mulai', 'delegasikan', 'serahkan'],
};

export const TRANSLATE: KW = {
  it: ['traduci', 'traduzione di', 'tradurre'], en: ['translate', 'translation of'], es: ['traduce', 'traduccion de'], fr: ['traduis', 'traduction de'], de: ['ubersetze', 'ubersetzung von'],
  pt: ['traduz', 'traduza', 'traducao de'], zh: ['翻译'], hi: ['अनुवाद'], ar: ['ترجم', 'ترجمة'], ru: ['переведи', 'перевод'], ja: ['翻訳'], id: ['terjemahkan', 'terjemahan'],
};
export const SUMMARIZE: KW = {
  it: ['riassumi', 'riassunto', 'sintetizza'], en: ['summarize', 'summarise', 'summary of', 'tl;dr'], es: ['resume este', 'resume el', 'resume la', 'resume los', 'resumeme', 'resumen de', 'resumir'],
  fr: ['resume', 'resumer', 'synthetise'], de: ['fasse zusammen', 'zusammenfassung von', 'zusammenfassen'], pt: ['resume', 'resuma', 'resumo de', 'resumir'],
  zh: ['总结', '概括', '摘要'], hi: ['सारांश', 'संक्षेप'], ar: ['لخص', 'تلخيص', 'ملخص'], ru: ['суммируй', 'кратко перескажи', 'резюмируй', 'перескажи', 'краткое содержание'],
  ja: ['要約', 'まとめて'], id: ['ringkas', 'rangkum', 'ringkasan'],
};
export const STT: KW = {
  it: ['trascrivi', 'trascrizione'], en: ['transcribe', 'transcription'], es: ['transcribe', 'transcripcion'], fr: ['transcris', 'transcription'], de: ['transkribiere', 'transkription'],
  pt: ['transcreve', 'transcreva', 'transcricao'], zh: ['转写', '转录', '听写'], hi: ['ट्रांसक्राइब', 'लिखित रूप'], ar: ['فرغ', 'تفريغ', 'نسخ صوتي'], ru: ['транскрибируй', 'расшифруй'],
  ja: ['文字起こし'], id: ['transkripsikan', 'transkrip'],
};
export const TTS: KW = {
  it: ['leggi ad alta voce', 'leggimi ad alta voce', 'leggi a voce alta'], en: ['read aloud', 'read out loud', 'read this out'], es: ['lee en voz alta', 'leelo en voz alta'],
  fr: ['lis a voix haute', 'lis moi a voix haute'], de: ['lies vor', 'lies laut vor', 'vorlesen'], pt: ['le em voz alta', 'leia em voz alta'], zh: ['朗读', '念出来', '读出来'],
  hi: ['ज़ोर से पढ़', 'जोर से पढ़', 'पढ़कर सुनाओ'], ar: ['اقرأ بصوت عال', 'اقرأ بصوت مرتفع', 'اقرا بصوت عال'], ru: ['прочитай вслух', 'озвучь', 'зачитай'], ja: ['読み上げ', '音読'], id: ['bacakan'],
};
export const REASON: KW = {
  it: ['ragiona', 'passo per passo', 'passo dopo passo', 'risolvi', 'dimostra', 'debug', 'scrivi una funzione', 'codice', 'algoritmo'],
  en: ['step by step', 'reason through', 'prove that', 'solve', 'debug', 'write a function', 'code', 'algorithm'],
  es: ['paso a paso', 'razona', 'demuestra', 'resuelve', 'depura', 'codigo', 'algoritmo'],
  fr: ['etape par etape', 'raisonne', 'demontre', 'resous', 'debogue', 'code', 'algorithme'],
  de: ['schritt fur schritt', 'begrunde', 'beweise', 'lose', 'debugge', 'code', 'algorithmus'],
  pt: ['passo a passo', 'raciocina', 'demonstra', 'resolve', 'depura', 'codigo', 'algoritmo'],
  zh: ['一步一步', '逐步', '证明', '解决', '调试', '代码', '算法'],
  hi: ['चरण दर चरण', 'कदम दर कदम', 'सिद्ध करो', 'हल करो', 'डीबग', 'कोड', 'एल्गोरिद्म'],
  ar: ['خطوة بخطوة', 'اثبت', 'صحح الاخطاء', 'كود', 'خوارزمية'],
  ru: ['шаг за шагом', 'пошагово', 'докажи', 'реши', 'отладь', 'код', 'алгоритм'],
  ja: ['ステップバイステップ', '順を追って', '証明', '解いて', 'デバッグ', 'コード', 'アルゴリズム'],
  id: ['langkah demi langkah', 'buktikan', 'selesaikan', 'debug', 'kode', 'algoritma'],
};
/** verbi di modifica (con un'immagine allegata) */
export const EDIT: KW = {
  it: ['modifica', 'cambia', 'togli', 'rimuovi', 'elimina', 'sostituisci', 'ritocca', 'migliora', 'cancella', 'aggiungi'],
  en: ['edit', 'change', 'remove', 'replace', 'retouch', 'fix', 'improve', 'erase', 'add'],
  es: ['edita', 'modifica', 'cambia', 'quita', 'elimina', 'sustituye', 'retoca', 'mejora', 'borra'],
  fr: ['modifie', 'change', 'retire', 'supprime', 'remplace', 'retouche', 'ameliore', 'efface', 'ajoute'],
  de: ['bearbeite', 'andere', 'entferne', 'ersetze', 'retuschiere', 'verbessere', 'losche', 'fuge hinzu'],
  pt: ['edita', 'edite', 'muda', 'mude', 'remove', 'remova', 'substitui', 'retoca', 'melhora', 'apaga', 'adiciona'],
  zh: ['修改', '编辑', '去掉', '删除', '替换', '修图', '改善', '添加'],
  hi: ['संपादित', 'बदलो', 'हटाओ', 'मिटाओ', 'सुधारो', 'जोड़ो'],
  ar: ['عدل', 'غير', 'احذف', 'ازل', 'استبدل', 'حسن', 'امسح', 'اضف'],
  ru: ['измени', 'отредактируй', 'убери', 'удали', 'замени', 'отретушируй', 'улучши', 'добавь'],
  ja: ['編集', '修正', '変更', '削除', '消して', '置き換え', '補正', '加工', '追加'],
  id: ['edit', 'ubah', 'hapus', 'hilangkan', 'ganti', 'retouch', 'perbaiki', 'tambahkan'],
};
/** richieste che l'assistente locale gestisce da solo (task, promemoria...): mai verso un fornitore */
export const LOCAL_OBJECTS: string[] = ['task', 'attivita', 'promemoria', 'reminder', 'impegno', 'appuntamento', 'evento', 'to-do', 'todo', 'lista della spesa', 'sveglia'];
