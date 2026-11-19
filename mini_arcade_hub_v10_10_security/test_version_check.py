"""Tests for the version helpers. Run from this folder with:  python -m unittest test_version_check -v"""
import unittest

from config import APP_VERSION
from version_check import (
    VERSION_HEADER,
    client_headers,
    display_version,
    fetch_client_requirements,
    is_older,
    is_update_required_error,
    parse_version,
    update_required_text,
)


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeClient:
    def __init__(self, data=None, error=None):
        self._data, self._error = data, error

    def rpc(self, name, params):
        assert name == "mini_arcade_client_requirements"
        return self

    def execute(self):
        if self._error:
            raise self._error
        return FakeResponse(self._data)


class ServerError(Exception):
    def __init__(self, code, message):
        super().__init__(f"{{'code': '{code}', 'message': '{message}'}}")
        self.code, self.message = code, message


class VersionTests(unittest.TestCase):
    def test_current_version_is_valid(self):
        self.assertIsNotNone(parse_version(APP_VERSION))

    def test_numbers_compare_one_by_one_not_alphabetically(self):
        self.assertTrue(is_older("10.9", "10.10"))
        self.assertFalse(is_older("10.10", "10.9"))
        self.assertFalse(is_older("10.10", "10.10"))
        self.assertFalse(is_older("10.10.0", "10.10"))
        self.assertTrue(is_older("10.9.9", "10.10"))
        self.assertFalse(is_older("11", "10.10"))

    def test_unreadable_versions(self):
        self.assertTrue(is_older(None, "10.10"))
        self.assertTrue(is_older("abc", "10.10"))
        self.assertFalse(is_older("1", ""))      # no minimum set
        self.assertFalse(is_older("1", None))
        self.assertFalse(is_older("1", "junk"))  # an unreadable minimum cannot be enforced

    def test_parse_rejects_junk(self):
        for bad in ("", "abc", "1.2.3.4", "-1", "10.10; drop", "99999", None):
            self.assertIsNone(parse_version(bad), bad)

    def test_display(self):
        self.assertEqual(display_version("10.10"), "10.10")
        self.assertEqual(display_version("10.10.0"), "10.10")
        self.assertEqual(display_version("10.10.2"), "10.10.2")

    def test_header_carries_our_version(self):
        self.assertEqual(client_headers(), {VERSION_HEADER: APP_VERSION})

    def test_requirements_parsing(self):
        self.assertIsNone(fetch_client_requirements(FakeClient([])))
        self.assertIsNone(fetch_client_requirements(FakeClient([{"min_client_version": None, "update_message": ""}])))
        got = fetch_client_requirements(FakeClient([{"min_client_version": "10.10", "update_message": "Get it"}]))
        self.assertEqual(got, {"min_version": "10.10", "message": "Get it"})
        got = fetch_client_requirements(FakeClient({"min_client_version": "10.10", "update_message": None}))
        self.assertEqual(got, {"min_version": "10.10", "message": ""})
        with self.assertRaises(RuntimeError):
            fetch_client_requirements(FakeClient(error=RuntimeError("offline")))

    def test_update_required_detection(self):
        self.assertTrue(is_update_required_error(ServerError("update_required", "old")))
        self.assertTrue(is_update_required_error(RuntimeError("{'code': 'update_required'}")))
        self.assertFalse(is_update_required_error(RuntimeError("network down")))
        self.assertFalse(is_update_required_error(ServerError("42501", "denied")))

    def test_message_text(self):
        text = update_required_text(minimum="10.10", message="Use the new link.")
        self.assertIn(display_version(), text)
        self.assertIn("10.10", text)
        self.assertIn("Use the new link.", text)
        self.assertIn("play offline", text)
        self.assertIn("server says hi", update_required_text(ServerError("update_required", "server says hi")))


if __name__ == "__main__":
    unittest.main()
