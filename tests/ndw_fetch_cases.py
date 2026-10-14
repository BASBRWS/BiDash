import gzip
import hashlib
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location('ndw_fetch', Path(__file__).resolve().parents[1] / 'scripts/fetch-ndw.py')
ndw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ndw)


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 1, 2, 12, tzinfo=timezone.utc)
        self.temp = tempfile.TemporaryDirectory()
        self.output = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.xml = '<root><publicationTime>2026-01-02T11:59:00Z</publicationTime><measurementSite id="S"/><siteMeasurements><measurementSiteReference id="S"/></siteMeasurements></root>'
        self.data = gzip.compress(self.xml.encode())

    def test_valid(self):
        m = ndw.refresh(self.output, now=self.now, fetch=lambda u: self.data)
        self.assertEqual(m['status'], 'ready')
        self.assertEqual(m['sha256'], hashlib.sha256(self.data).hexdigest())
        self.assertEqual((self.output / m['file']).read_bytes(), self.data)
        self.assertFalse(m['retained'])
        self.assertEqual(json.loads((self.output / 'latest.json').read_text()), m)

    def test_invalid_and_stale(self):
        invalid = [b'<html>error</html>', b'\x1f\x8bbroken', gzip.compress(b'<root/>'),
                   gzip.compress(self.xml.replace('2026-01-02T11:59:00Z', '2026-01-01T11:59:00Z').encode()),
                   gzip.compress(self.xml.replace('2026-01-02T11:59:00Z', '2026-01-03T11:59:00Z').encode()),
                   gzip.compress(b'<!DOCTYPE root [<!ENTITY x "data">]>' + self.xml.encode())]
        for body in invalid:
            with self.subTest(body=body[:10]):
                m = ndw.refresh(self.output, now=self.now, fetch=lambda u: body)
                self.assertEqual(m['status'], 'unavailable')
                self.assertEqual(list(self.output.glob('*.gz')), [])

    def test_retains_valid_previous_without_changing_dates(self):
        previous = ndw.refresh(self.output, now=self.now, fetch=lambda u: self.data)
        requests = []
        def fetch(url):
            requests.append(url)
            if url == ndw.SOURCE:
                raise OSError('Offline')
            return json.dumps(previous).encode() if url.endswith('latest.json') else self.data
        m = ndw.refresh(self.output, 'https://example.github.io/Project/', self.now + timedelta(minutes=5), fetch)
        self.assertTrue(m['retained'])
        self.assertEqual(m['downloadedAt'], previous['downloadedAt'])
        self.assertEqual(m['publication'], previous['publication'])
        self.assertEqual(len(requests), 3)

    def test_rejects_previous_hash_or_external_filename(self):
        previous = ndw.refresh(self.output, now=self.now, fetch=lambda u: self.data)
        for bad in [{'file': 'https://external.invalid/feed'}, {'sha256': '0' * 64}, {'source': 'https://external.invalid'}]:
            def fetch(url):
                if url == ndw.SOURCE:
                    raise OSError('Offline')
                return json.dumps({**previous, **bad}).encode() if url.endswith('latest.json') else self.data
            m = ndw.refresh(self.output, 'https://example.github.io/Project', self.now, fetch)
            self.assertEqual(m['status'], 'unavailable')

    def test_previous_too_old(self):
        previous = ndw.refresh(self.output, now=self.now, fetch=lambda u: self.data)
        def fetch(url):
            if url == ndw.SOURCE:
                raise OSError('Offline')
            return json.dumps(previous).encode() if url.endswith('latest.json') else self.data
        m = ndw.refresh(self.output, 'https://example.github.io/Project', self.now + timedelta(hours=1), fetch)
        self.assertEqual(m['status'], 'unavailable')

    def test_limits(self):
        original = ndw.MAX_XML_BYTES
        ndw.MAX_XML_BYTES = 10
        try:
            with self.assertRaises(ValueError):
                ndw.validate(self.data, self.now)
        finally:
            ndw.MAX_XML_BYTES = original


if __name__ == '__main__':
    unittest.main()
