#!/usr/bin/env python3
"""Verify localized example text without relaxing code contract checks."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("doc_translations", ROOT / "scripts/check-doc-translations.py")
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class LocalizedExamplesTest(unittest.TestCase):
    def test_mapped_strings_may_change_in_each_locale(self):
        original = '```go\nreturn httperr.NotFound("사용자를 찾을 수 없습니다")\n```\n'
        for locale in checker.LOCALES:
            translated = {
                "en": "User not found",
                "ja": "ユーザーが見つかりません",
                "zh-Hans": "未找到用户",
                "zh-Hant": "找不到使用者",
            }[locale]
            target = original.replace("사용자를 찾을 수 없습니다", translated)
            with self.subTest(locale=locale):
                self.assertTrue(checker.localized_blocks_match(original, target, locale))
                self.assertFalse(checker.localized_blocks_match(original, target.replace("NotFound", "BadRequest"), locale))
                self.assertFalse(checker.localized_blocks_match(original, target.replace(translated, "changed"), locale))

    def test_unmapped_commands_and_versions_remain_protected(self):
        original = '```sh\ngo get github.com/NARUBROWN/spine@v0.7.1\n```\n'
        self.assertTrue(checker.localized_blocks_match(original, original, "en"))
        self.assertFalse(checker.localized_blocks_match(original, original.replace("v0.7.1", "v0.7.0"), "en"))


if __name__ == "__main__":
    unittest.main()
