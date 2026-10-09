# Credits

Third-party art in V-Game. Every asset below is **CC0 1.0** (public domain): credit is not
required, we give it anyway. Nothing is credited inside the game; no logo of any author is used
anywhere (the Kenney FAQ only asks that its logo is not used).

| What                                    | Author     | Source                                                                                                | Licence                                                                        | Used as                                                                                             |
| --------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Mini Characters 1.0 (6 models)          | Kenney     | <https://kenney.nl/assets/mini-characters>                                                            | CC0 1.0, [text](frontend/public/models/LICENSE-kenney-mini-characters.txt)     | `frontend/public/models/cast.json`: recoloured, body and head merged, crutch removed from one model |
| Nature Kit 2.1 (13 models)              | Kenney     | <https://kenney.nl/assets/nature-kit>                                                                 | CC0 1.0, [text](frontend/public/models/LICENSE-kenney-nature-kit.txt)          | `frontend/public/models/props.json`                                                                 |
| City Kit Commercial 2.1 (parasol table) | Kenney     | <https://kenney.nl/assets/city-kit-commercial>                                                        | CC0 1.0, [text](frontend/public/models/LICENSE-kenney-city-kit-commercial.txt) | `frontend/public/models/props.json`: palette texture baked to vertex colours                        |
| 7 single models on Poly Pizza           | Quaternius | <https://quaternius.com>, pages listed in [the notice](frontend/public/models/LICENSE-quaternius.txt) | CC0 1.0                                                                        | `frontend/public/models/props.json`                                                                 |

All files were downloaded on 2026-10-09. The raw downloads are not in the repository:
`tools/assets-sources.json` lists every source file with its URL and SHA-256. To re-bake, put the
files of a pack in one directory under their `as` names, then run from the repo root:

```sh
node tools/characters/bake-cast.mjs <dir> frontend/public/models/cast.json
node tools/props/bake-props.mjs <dir> frontend/public/models/props.json
```

Add `--check` to prove the committed JSON is byte-identical to a fresh bake.

The characters are fictional and appear only under role ids (`player`, `lan`, `guard`,
`registrar`, `operator`, `examiner`).
