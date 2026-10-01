"""Streaming DNS master-file reader for direct-child NS delegations.

Fail closed on unsupported directives or malformed relevant records. This is
not an authoritative DNS validator; it deliberately ignores non-NS RDATA.
"""
import re


LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z")
TTL = re.compile(r"(?:[0-9]+[WDHMSwdhms]?)+\Z")


class ZoneError(ValueError):
    pass


def tld_name(value):
    value = value.lower().removeprefix(".")
    if not LABEL.fullmatch(value):
        raise ZoneError("Use one ASCII extension (punycode for IDNs).")
    return value


def records(lines):
    """Keep at most one bounded logical record; preserve leading whitespace."""
    tokens, token = [], []
    depth = 0
    quoted = False
    omitted = False
    size = 0
    for number, line in enumerate(lines, 1):
        if not tokens and not token and not depth:
            omitted = bool(line[:1].isspace())
        size += len(line)
        if size > 65536:
            raise ZoneError(f"Record exceeds 64 KiB near line {number}.")
        i = 0
        while i < len(line):
            char = line[i]
            if char == "\\":
                if i + 1 >= len(line) or line[i + 1] in "\r\n":
                    raise ZoneError(f"Incomplete escape at line {number}.")
                token.extend(line[i:i + 2])
                i += 2
                continue
            if char == '"':
                quoted = not quoted
                token.append(char)
            elif char == ";" and not quoted:
                break
            elif not quoted and (char.isspace() or char in "()"):
                if token:
                    tokens.append("".join(token))
                    token = []
                if char == "(":
                    depth += 1
                elif char == ")":
                    depth -= 1
                if depth not in (0, 1):
                    raise ZoneError(f"Invalid parentheses at line {number}.")
            else:
                token.append(char)
            i += 1
        if token and not quoted:
            tokens.append("".join(token))
            token = []
        if quoted:
            raise ZoneError(f"Unclosed quote at line {number}.")
        if not depth:
            if tokens:
                yield omitted, tokens
            tokens = []
            size = 0
    if depth or quoted or token:
        raise ZoneError("Zone ended inside a record.")


def absolute_name(value, origin):
    if value == "@":
        return origin
    # Escaped dots/non-hostname octets are unsupported, rather than silently
    # turning a single DNS label into several labels.
    def unescape(match):
        text = match.group(1)
        char = chr(int(text)) if len(text) == 3 and text.isdigit() else text
        if not re.fullmatch(r"[A-Za-z0-9_-]", char):
            raise ZoneError("Unsupported escape in a DNS owner name.")
        return char
    value = re.sub(r"\\([0-9]{3}|.)", unescape, value).lower()
    if not re.fullmatch(r"[a-z0-9_.*-]+", value):
        raise ZoneError("Unsupported DNS owner name.")
    name = value if value.endswith(".") else value + "." + origin
    if len(name) > 254 or any(not p or len(p) > 63 for p in name[:-1].split(".")):
        raise ZoneError("Invalid DNS owner length.")
    return name


class ZoneReader:
    def __init__(self, tld):
        self.tld = tld_name(tld)
        self.serial = None
        self.ns_records = 0

    def labels(self, lines):
        apex = self.tld + "."
        origin, previous = apex, None
        for omitted, fields in records(lines):
            directive = fields[0].upper()
            if directive.startswith("$"):
                if directive == "$ORIGIN" and len(fields) == 2:
                    origin = absolute_name(fields[1], origin)
                    if origin != apex and not origin.endswith("." + apex):
                        raise ZoneError("$ORIGIN leaves the selected zone.")
                elif directive == "$TTL" and len(fields) == 2 and TTL.fullmatch(fields[1]):
                    pass
                else:
                    raise ZoneError("Unsupported or malformed zone directive.")
                continue
            if omitted:
                if previous is None:
                    raise ZoneError("Omitted owner before first DNS record.")
                owner = previous
            else:
                owner = absolute_name(fields.pop(0), origin)
                previous = owner
            rrclass = "IN"
            saw_class = saw_ttl = False
            while fields:
                if fields[0].upper() in {"IN", "CH", "HS"} and not saw_class:
                    rrclass = fields.pop(0).upper()
                    saw_class = True
                elif TTL.fullmatch(fields[0]) and not saw_ttl:
                    fields.pop(0)
                    saw_ttl = True
                else:
                    break
            if len(fields) < 2 or rrclass != "IN":
                raise ZoneError("Missing record type/data or non-IN record.")
            kind, *data = fields
            kind = kind.upper()
            if not re.fullmatch(r"[A-Z][A-Z0-9-]*", kind):
                raise ZoneError("Invalid record type.")
            if kind == "SOA":
                if owner != apex or len(data) != 7 or not data[2].isdigit():
                    raise ZoneError("Invalid zone apex SOA.")
                serial = int(data[2])
                if not 0 <= serial < 2**32 or any(not TTL.fullmatch(s) for s in data[3:]):
                    raise ZoneError("Invalid SOA values.")
                if self.serial is not None and self.serial != serial:
                    raise ZoneError("Conflicting SOA serials in one file.")
                self.serial = serial
            elif kind == "NS":
                if len(data) != 1:
                    raise ZoneError("Invalid NS record.")
                absolute_name(data[0], origin)
                if owner == apex:
                    continue
                if not owner.endswith("." + apex):
                    raise ZoneError("NS owner outside selected zone.")
                label = owner[:-(len(apex) + 1)]
                if "." in label:
                    continue  # A nameserver/subdelegation is not a TLD child.
                if not LABEL.fullmatch(label):
                    raise ZoneError("Unsupported delegation label.")
                self.ns_records += 1
                yield label
        if self.serial is None:
            raise ZoneError("No apex SOA found; refusing this file.")
        if not self.ns_records:
            raise ZoneError("No delegations found; empty-zone review required.")
