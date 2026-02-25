---
layout: default
title: Regex
created: 2026-02-14T19:45
draft: true
---

## Buscas

### code

Busca por tags `<code>` em markdown, que começam e terminam com uma única crase simples

```
(?<!`)`(?!`)
```

Substituir por três crases e pulando linha antes e depois:

````
\n```\n
````

### Filtrar links

Busca por palavras em markdown que não sejam links `[neste](/formato/)`:

```
(?<![\[/])\bpalavra\b(?![\]/])
```

## Links úteis

- [Regex para Last.fm](https://github.com/mozartsempiano/lastfm-regexes/blob/main/regex-edits.json)
