# Theme pack: VinUni-inspired campus

Data-only theme pack (manifest, CSS tokens, fonts, images). The game code never refers to
this pack by name; it is listed in `../index.json` and loaded at runtime.

## Sources and permissions

- Palette, typography and radius follow an unofficial VinUni-inspired token set derived from
  the public website (blue `#134D8B`, red `#C72127`, Montserrat). It is **not** an official
  VinUniversity brand guide.
- `images/campus-*.webp` and `images/skyline.webp` are resized copies of images published on
  vinuni.edu.vn. VinUniversity and the respective owners retain all rights. They are used here
  for an internal learning prototype only.
- **Before any public deployment**, obtain written permission from the brand owner, or remove
  this pack (delete this folder and its entry in `../index.json`).
- Montserrat: SIL Open Font License 1.1 (`fonts/OFL.txt`).

## Removing the pack

1. Delete this folder.
2. Remove the `vinuni` entry from `../index.json`.
3. Set `VITE_DEFAULT_THEME` to another pack (or leave it unset to use the first entry).

No code changes are required.
