import unittest
from urllib.parse import parse_qs, urlsplit

from server import fetch_comparison, make_compare_request, validate_compare_params


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self.body


class GroceryApiTests(unittest.TestCase):
    def test_validates_and_defaults_result_limit(self):
        self.assertEqual(validate_compare_params(["  oats  "], []), ("oats", 5))
        self.assertEqual(validate_compare_params(["milk"], ["10"]), ("milk", 10))

    def test_rejects_empty_or_oversized_query(self):
        for value in ([], ["  "], ["x" * 121]):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    validate_compare_params(value, [])

    def test_rejects_out_of_range_limit(self):
        for value in (["0"], ["11"], ["many"]):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    validate_compare_params(["bread"], value)

    def test_request_uses_bearer_auth_and_encoded_query(self):
        request = make_compare_request("milk & oats", 3, "sk-test-only")
        self.assertEqual(request.get_header("Authorization"), "Bearer sk-test-only")
        self.assertEqual(parse_qs(urlsplit(request.full_url).query), {"q": ["milk & oats"], "limit": ["3"]})

    def test_fetches_and_decodes_provider_json(self):
        seen = {}

        def opener(request, timeout):
            seen["authorization"] = request.get_header("Authorization")
            seen["timeout"] = timeout
            return FakeResponse(b'{"query":"bread","matches":[]}')

        result = fetch_comparison("bread", 5, "sk-test-only", opener=opener)
        self.assertEqual(result, {"query": "bread", "matches": []})
        self.assertEqual(seen, {"authorization": "Bearer sk-test-only", "timeout": 25})

    def test_missing_key_fails_before_network_request(self):
        called = False

        def opener(*args, **kwargs):
            nonlocal called
            called = True

        with self.assertRaisesRegex(RuntimeError, "not configured"):
            fetch_comparison("bread", 5, "", opener=opener)
        self.assertFalse(called)


if __name__ == "__main__":
    unittest.main()
