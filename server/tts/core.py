"""Parte pura del server vocale (nessuna dipendenza da torch): voci, lingue, frasi di riferimento, divisione del testo."""
import re

# Lingue dell'app -> nome per Qwen3-TTS (10 lingue; qui le 9 che coincidono con quelle dell'app)
QWEN_LANG = {"it": "Italian", "en": "English", "es": "Spanish", "fr": "French", "de": "German", "pt": "Portuguese", "ru": "Russian", "zh": "Chinese", "ja": "Japanese"}
# Lingue servite da Chatterbox Multilingual (non coperte da Qwen3-TTS)
CHATTERBOX_LANG = {"ar": "ar", "hi": "hi"}
# Indonesiano: nessun modello open source di qualità -> 501, l'app ripiega sulla voce del telefono
SUPPORTED = {**{k: "qwen" for k in QWEN_LANG}, **{k: "chatterbox" for k in CHATTERBOX_LANG}}

# Il testo letto per creare la voce di riferimento in ogni lingua (due frasi calme).
REF_TEXT = {
    "it": "Ciao, sono Theia. Mettiti comodo, respira lentamente e seguimi: ti guido io, un passo alla volta.",
    "en": "Hi, I'm Theia. Get comfortable, breathe slowly and follow me: I'll guide you, one step at a time.",
    "es": "Hola, soy Theia. Ponte cómodo, respira despacio y sígueme: yo te guío, paso a paso.",
    "fr": "Bonjour, je suis Theia. Installe-toi confortablement, respire lentement et suis-moi : je te guide, pas à pas.",
    "de": "Hallo, ich bin Theia. Mach es dir bequem, atme langsam und folge mir: Ich führe dich Schritt für Schritt.",
    "pt": "Olá, sou a Theia. Fique à vontade, respire devagar e siga-me: eu guio você, passo a passo.",
    "ru": "Привет, я Тея. Устройтесь поудобнее, дышите медленно и следуйте за мной: я проведу вас шаг за шагом.",
    "zh": "你好，我是Theia。请坐得舒服一些，慢慢地呼吸，跟着我：我会一步一步地带你。",
    "ja": "こんにちは、テイアです。楽な姿勢で、ゆっくり呼吸して、私についてきてください。一歩ずつご案内します。",
    "ar": "مرحبًا، أنا ثيا. اجلس بارتياح، وتنفس ببطء، وتابعني: سأرشدك خطوة بخطوة.",
    "hi": "नमस्ते, मैं थेया हूँ। आराम से बैठिए, धीरे-धीरे साँस लीजिए और मेरे साथ चलिए: मैं एक-एक कदम पर आपका साथ दूँगी।",
}

# Descrizioni delle voci (Voice Design): nessuna persona reale viene clonata.
INSTRUCT = {
    "f": "Adult woman, warm and reassuring, calm and gentle, medium-low pitch, slow unhurried pace, close and intimate, very clear articulation, natural native {lang} speaker, like a kind meditation and cooking guide.",
    "m": "Adult man, warm and reassuring, calm and gentle, low-medium pitch, slow unhurried pace, close and intimate, very clear articulation, natural native {lang} speaker, like a kind meditation and cooking guide.",
}
OPENAI_ALIASES = {"alloy": "f", "nova": "f", "shimmer": "f", "coral": "f", "sage": "f", "echo": "m", "onyx": "m", "fable": "m", "ash": "m", "verse": "m"}


def parse_voice(voice: str, language: str) -> tuple[str, str]:
    """«f-it», «m-de», «female», «alloy»… -> (genere 'f'|'m', lingua). La lingua della voce vince su quella della richiesta."""
    v = (voice or "").strip().lower()
    m = re.fullmatch(r"([fm])[-_]([a-z]{2})", v)
    if m:
        return m.group(1), m.group(2)
    lang = (language or "it").strip().lower()[:2]
    if v in ("m", "male", "man", "uomo", "maschile"):
        return "m", lang
    if v in ("f", "female", "woman", "donna", "femminile", ""):
        return "f", lang
    return OPENAI_ALIASES.get(v, "f"), lang


def chunk_text(text: str, limit: int = 260) -> list[str]:
    """Divide il testo in pezzi di al massimo `limit` caratteri, alla fine delle frasi (poi alle virgole, poi agli spazi)."""
    t = re.sub(r"\s+", " ", text or "").strip()
    if not t:
        return []
    sentences = re.split(r"(?<=[.!?…。！？])\s+", t)
    out: list[str] = []
    cur = ""
    for s in sentences:
        while len(s) > limit:
            cut = max(s.rfind(", ", 0, limit), s.rfind("; ", 0, limit), s.rfind(" ", 0, limit))
            cut = cut if cut > limit // 3 else limit
            part, s = s[:cut + 1].strip(), s[cut + 1:].strip()
            if cur:
                out.append(cur); cur = ""
            out.append(part)
        if cur and len(cur) + 1 + len(s) > limit:
            out.append(cur); cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return [c for c in out if c]


LANG_NAME = {"it": "Italian", "en": "English", "es": "Spanish", "fr": "French", "de": "German", "pt": "Portuguese", "ru": "Russian", "zh": "Chinese", "ja": "Japanese", "ar": "Arabic", "hi": "Hindi"}
def voice_ids() -> list[str]:
    return [f"{g}-{l}" for l in SUPPORTED for g in ("f", "m")]
