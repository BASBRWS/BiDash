"""Publiceer alleen de openbare NDW-feed in het Pages-artifact, nooit gebruikersdata."""
import argparse
import gzip
import hashlib
import io
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

SOURCE = 'https://opendata.ndw.nu/snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz'
MAX_BYTES = 25 * 1024 * 1024
MAX_XML_BYTES = 256 * 1024 * 1024
MAX_AGE = timedelta(minutes=30)


def iso(value):
    return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def date(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'BiDash NDW public feed', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req, timeout=45) as response:
        data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError('NDW-bestand overschrijdt de downloadlimiet.')
        return data


def validate(data, now):
    if not data.startswith(b'\x1f\x8b'):
        raise ValueError('NDW-bron is geen gzipbestand.')
    with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
        xml = stream.read(MAX_XML_BYTES + 1)
    if len(xml) > MAX_XML_BYTES or b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():
        raise ValueError('NDW XML overschrijdt de limiet of bevat een documenttype.')
    config = traffic = False
    publications = []
    for _, elem in ET.iterparse(io.BytesIO(xml), events=['end']):
        tag = elem.tag.split('}')[-1]
        if tag == 'publicationTime' and elem.text:
            publications.append(date(elem.text.strip()))
        if tag in ('measurementSite', 'measurementSiteRecord'):
            config = True
            elem.clear()
        elif tag == 'siteMeasurements':
            traffic = True
            elem.clear()
    if not config or not traffic or not publications:
        raise ValueError('Gecombineerde NDW-bron mist configuratie, meetgegevens of publicatietijd.')
    publication = max(publications)
    if now - publication > MAX_AGE or publication - now > timedelta(minutes=5):
        raise ValueError('NDW-publicatie is te oud of ligt in de toekomst.')
    return iso(publication)


def write(output, data, publication, downloaded, attempt, retained=False):
    sha = hashlib.sha256(data).hexdigest()
    filename = 'snapshot-' + sha + '.xml.gz'
    output.mkdir(parents=True, exist_ok=True)
    (output / filename).write_bytes(data)
    manifest = {'schema': 1, 'status': 'ready', 'source': SOURCE, 'file': filename,
                'sha256': sha, 'bytes': len(data), 'publication': publication,
                'downloadedAt': downloaded, 'attemptedAt': attempt,
                'retained': retained, 'refreshMinutes': 5}
    (output / 'latest.json').write_text(json.dumps(manifest, ensure_ascii=False) + '\n')
    return manifest


def refresh(output, previous_base='', now=None, fetch=fetch_bytes):
    now = now or datetime.now(timezone.utc)
    attempt = iso(now)
    try:
        data = fetch(SOURCE)
        return write(output, data, validate(data, now), attempt, attempt)
    except Exception:
        # Een mislukte NDW-download mag een gewone site-publicatie niet blokkeren.
        # De vorige kopie wordt alleen behouden na dezelfde inhoud- en leeftijdscontrole.
        if previous_base:
            try:
                manifest = json.loads(fetch(previous_base.rstrip('/') + '/ndw/latest.json'))
                filename = manifest.get('file', '')
                if manifest.get('source') != SOURCE or manifest.get('schema') != 1 or not re.fullmatch(r'snapshot-[a-f0-9]{64}\.xml\.gz', filename):
                    raise ValueError('Ongeldig vorig manifest.')
                data = fetch(previous_base.rstrip('/') + '/ndw/' + filename)
                sha = hashlib.sha256(data).hexdigest()
                if manifest.get('sha256') != sha or filename != 'snapshot-' + sha + '.xml.gz':
                    raise ValueError('Vorige kopie heeft een afwijkende vingerafdruk.')
                publication = validate(data, now)
                if date(manifest['downloadedAt']) > now + timedelta(minutes=5):
                    raise ValueError('Ongeldige ophaaltijd.')
                return write(output, data, publication, manifest['downloadedAt'], attempt, True)
            except Exception:
                pass
        output.mkdir(parents=True, exist_ok=True)
        manifest = {'schema': 1, 'status': 'unavailable', 'source': SOURCE,
                    'attemptedAt': attempt, 'refreshMinutes': 5}
        (output / 'latest.json').write_text(json.dumps(manifest) + '\n')
        return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--previous-base', default='')
    args = parser.parse_args()
    result = refresh(args.output, args.previous_base)
    print('Openbare NDW-kopie voorbereid.' if result['status'] == 'ready' else 'NDW nu niet beschikbaar; website blijft beschikbaar.')
