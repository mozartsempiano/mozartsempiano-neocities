---
layout: default
title: Sistema Operacional
created: 2026-02-06T10:46
---

## Fazer pendrive bootável no Linux

Primeiro, você deve ver qual o caminho do seu pendrive:

`sudo fdisk -l`

Depois, pode criar o pendrive bootável a partir do arquivo ISO, como no seguinte comando, onde "/path/to/file.iso" é o camnho do seu arquivo e "/dev/sdX" é o caminho do seu pendrive:

`sudo dd bs=4M if=/path/to/file.iso of=/dev/sdX status=progress oflag=sync`

## Links úteis

- [Rufus](https://rufus.ie/)

### Linux

- [Arch](/arch/)
- [CachyOS](https://cachyos.org/)
- [Void](https://voidlinux.org/)

### Windows

- [W10 ISO](https://www.microsoft.com/software-download/windows10)
- [W7 ISO](https://archive.org/details/Windows7_x86-x64_ptBR_Pack_MSDN)
- [XP ISO](https://archive.org/details/windows-xp-pro-sp-3-pt-br)
- [W98 ISO](https://archive.org/details/windows-98-se-isofile)
