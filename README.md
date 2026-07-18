# PoliSpace

PoliSpace is a Laragon-based facility booking system for Politeknik Besut. It uses HTML, CSS, JavaScript, PHP APIs, and MySQL.

## Documentation

- [Project Documentation](documentation/README.md)
- [Developer Handoff](documentation/HANDOFF.md)

## Quick Start

```text
C:\laragon\www\PoliSpace
http://localhost/PoliSpace/
```

Run verification after changes:

```powershell
node --check resources/js/script.js
Get-ChildItem -Recurse backend -Filter *.php | ForEach-Object { php -l $_.FullName }
```
