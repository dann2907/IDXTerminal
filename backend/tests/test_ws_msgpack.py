import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.ws_broadcaster import decode_msgpack, encode_msgpack  # noqa: E402


class WsMsgPackTests(unittest.TestCase):
    def test_msgpack_roundtrip(self) -> None:
        payload = {
            "type": "update",
            "data": {
                "BBCA.JK": {
                    "ticker": "BBCA.JK",
                    "price": 1000.0,
                    "prev_close": 950.0,
                    "change": 50.0,
                    "change_pct": 5.26,
                    "open": 960.0,
                    "high": 1010.0,
                    "low": 955.0,
                    "volume": 123456,
                    "timestamp": "2026-04-20T09:00:00+07:00",
                    "is_live": True,
                },
            },
        }

        packed = encode_msgpack(payload)
        unpacked = decode_msgpack(packed)
        self.assertEqual(unpacked, payload)


if __name__ == "__main__":
    unittest.main()
