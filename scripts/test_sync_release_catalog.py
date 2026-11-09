"""버전 계획과 실제 태그를 혼동하지 않도록 수집 경계를 검사한다."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("catalog", Path(__file__).with_name("sync-release-catalog.py"))
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)


class CatalogTests(unittest.TestCase):
    def collect(self, tags, releases=(), target="v1.1.0"):
        import base64
        policy = base64.b64encode(json.dumps({"next_version": target}).encode()).decode()
        replies = [[{"ref": "refs/tags/" + version} for version in tags], list(releases), {"content": policy}]
        with patch.object(catalog, "api", side_effect=replies):
            return catalog.collect("spine")

    def test_runtime_http_platforms_are_in_catalog(self):
        self.assertIn("spine-echo-platform", catalog.REPOSITORIES)
        self.assertIn("spine-nethttp-platform", catalog.REPOSITORIES)

    def test_versions_sort_numerically_and_by_channel(self):
        versions = ["v1.0.0-preview.2", "v1.0.0-rc.1", "v1.0.0-preview.10", "v1.0.0", "v1.0.0-preview.1"]
        result = self.collect(versions)
        self.assertEqual([tag["version"] for tag in result["tags"]], ["v1.0.0", "v1.0.0-rc.1", "v1.0.0-preview.10", "v1.0.0-preview.2", "v1.0.0-preview.1"])
        self.assertEqual([tag["channel"] for tag in result["tags"]], ["stable", "rc", "preview", "preview", "preview"])

    def test_planned_version_does_not_become_a_published_tag(self):
        result = self.collect(["v1.0.0"], target="v1.1.0")
        self.assertEqual(result["target_version"], "v1.1.0")
        self.assertEqual([tag["version"] for tag in result["tags"]], ["v1.0.0"])

    def test_only_public_releases_provide_dates_and_notes(self):
        releases = [
            {"tag_name": "v1.0.0", "draft": False, "published_at": "2026-11-01T00:00:00Z", "assets": []},
            {"tag_name": "v1.0.0-rc.1", "draft": True, "published_at": None, "assets": []},
        ]
        tags = self.collect(["v1.0.0", "v1.0.0-rc.1", "v1.0.0-preview.1"], releases)["tags"]
        self.assertEqual(tags[0]["published_at"], "2026-11-01T00:00:00Z")
        self.assertTrue(tags[0]["notes_url"].endswith("/releases/tag/v1.0.0"))
        for tag in tags[1:]:
            self.assertIsNone(tag["published_at"])
            self.assertIsNone(tag["notes_url"])

    def test_unpublished_channel_and_nonrelease_refs_stay_empty(self):
        self.assertEqual(self.collect(["preview", "v1.0.0-preview.0", "v1.0.0-rc.01", "v01.0.0"])["tags"], [])

    def test_invalid_target_fails_instead_of_displaying_a_prerelease_base(self):
        with self.assertRaises(ValueError):
            self.collect([], target="v1.1.0-preview.1")

    def test_collection_failure_preserves_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "catalog.json"
            output.write_text("previous snapshot\n")
            with patch.object(catalog, "OUTPUT", output), patch.object(catalog, "collect", side_effect=RuntimeError("조회 실패")), patch("sys.argv", ["sync-release-catalog.py"]):
                with self.assertRaises(RuntimeError):
                    catalog.main()
            self.assertEqual(output.read_text(), "previous snapshot\n")


if __name__ == "__main__":
    unittest.main()
