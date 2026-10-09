# Credits

Third-party art and data in V-Game. Every art asset below is **CC0 1.0** (public domain): credit is not
required, we give it anyway. Nothing is credited inside the game; no logo of any author is used
anywhere (Kenney's support page, <https://kenney.nl/support>, asks that its logo is not used).

| What                                    | Author     | Source                                                                                                | Licence                                                                        | Used as                                                                                             |
| --------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Mini Characters 1.0 (6 models)          | Kenney     | <https://kenney.nl/assets/mini-characters>                                                            | CC0 1.0, [text](frontend/public/models/LICENSE-kenney-mini-characters.txt)     | `frontend/public/models/cast.json`: recoloured, body and head merged, crutch removed from one model |
| Nature Kit 2.1 (13 models)              | Kenney     | <https://kenney.nl/assets/nature-kit>                                                                 | CC0 1.0, [text](frontend/public/models/LICENSE-kenney-nature-kit.txt)          | `frontend/public/models/props.json`                                                                 |
| City Kit Commercial 2.1 (parasol table) | Kenney     | <https://kenney.nl/assets/city-kit-commercial>                                                        | CC0 1.0, [text](frontend/public/models/LICENSE-kenney-city-kit-commercial.txt) | `frontend/public/models/props.json`: palette texture baked to vertex colours                        |
| 7 single models on Poly Pizza           | Quaternius | <https://quaternius.com>, pages listed in [the notice](frontend/public/models/LICENSE-quaternius.txt) | CC0 1.0                                                                        | `frontend/public/models/props.json`                                                                 |

Where each prop stands on the campus: `frontend/app/features/campus/dressing.ts`.

All files were downloaded on 2026-10-09. The raw downloads are not in the repository:
`tools/assets-sources.json` lists every source file with its URL and SHA-256. To re-bake, use one
directory per baker holding the files of every pack it lists (its `bake` command) under their
`as` names: the Mini Characters pack for `bake-cast`; the Nature Kit, City Kit Commercial and
Quaternius files for `bake-props`. Then run (the output path defaults to frontend/public/models/):

```sh
node tools/characters/bake-cast.mjs <dir>
node tools/props/bake-props.mjs <dir>
```

Add `--check` to prove the committed JSON is byte-identical to a fresh bake.

The characters are fictional and appear only under role ids (`player`, `lan`, `guard`,
`registrar`, `operator`, `examiner`).

## Data

The campus weather comes from [Open-Meteo](https://open-meteo.com/) under **CC BY 4.0**. The
viewer's browser fetches it directly; the weather popover on `/play` names the source and links
to it.
