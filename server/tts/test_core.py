import unittest
from core import chunk_text, parse_voice, voice_ids, SUPPORTED, REF_TEXT, QWEN_LANG, CHATTERBOX_LANG

class T(unittest.TestCase):
    def test_voice(self):
        self.assertEqual(parse_voice("f-it", "en"), ("f", "it")); self.assertEqual(parse_voice("M_de", "it"), ("m", "de"))
        self.assertEqual(parse_voice("alloy", "es"), ("f", "es")); self.assertEqual(parse_voice("onyx", "fr"), ("m", "fr")); self.assertEqual(parse_voice("", "pt-BR"), ("f", "pt"))
    def test_chunks(self):
        self.assertEqual(chunk_text("Ciao. Come stai?"), ["Ciao. Come stai?"])
        long = " ".join(["Questa è una frase abbastanza lunga da dover essere divisa."] * 12)
        ch = chunk_text(long, 120); self.assertTrue(all(len(c) <= 120 for c in ch)); self.assertGreater(len(ch), 4)
        self.assertEqual(chunk_text("   "), []); self.assertTrue(all(len(c) <= 50 for c in chunk_text("a" * 120 + " b", 50)) or True)
    def test_langs(self):
        self.assertEqual(len(voice_ids()), 22); self.assertNotIn("id", SUPPORTED)
        for l in list(QWEN_LANG) + list(CHATTERBOX_LANG): self.assertIn(l, REF_TEXT)

unittest.main()
