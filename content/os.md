---
layout: default
title: Sistema Operacional
created: 2026-02-06T10:46
---

## Windows

# Reparar arquivos de sistema corrompidos no Windows

Abrir Powershell como Admin e digitar:

`DISM.exe /Online /Cleanup-image /Restorehealth`

Quando terminar, digitar:

`sfc /scannow`

Depois:

`chkdsk /f /r /b`

E aceitar digitando "y".

Reiniciar.

### Ativar Windows 10

Abrir o CMD e colar o seguinte código, com o código do serial:

`cscript slmgr.vbs /ipk \[SERIAL\]`

`cscript slmgr.vbs /skms kms.lotro.cc`

`cscript slmgr.vbs /ato`

---

Home/Core

`TX9XD-98N7V-6WMQ6-BX7FG-H8Q99`

Home/Core (Country Specific)

`PVMJN-6DFY6-9CCP6-7BKTT-D3WVR`

Home/Core (Single Language)

`7HNRX-D7KGG-3K4RQ-4WPJ4-YTDFH`

Home/Core N

`3KHY7-WNT83-DGQKR-F7HPR-844BM`

Professional

`W269N-WFGWX-YVC9B-4J6C9-T83GX`

Professional N

`MH37W-N47XK-V7XM9-C7227-GCQG9`

Enterprise

`NPPR9-FWDCX-D2C8J-H872K-2YT43`

Enterprise N

`DPH2V-TTNVB-4X9Q3-TJR4H-KHJW4`

Education

`NW6C2-QMPVW-D7KKK-3GKT6-VCFB2`

Education N

`2WH4N-8QGBV-H22JP-CT43Q-MDWWJ`

Enterprise 2015 LTSB

`WNMTR-4C88C-JK8YV-HQ7T2-76DF9`

Enterprise 2015 LTSB N

`2F77B-TNFGY-69QQF-B8YKP-D69TJ`

Enterprise 2016 LTSB

`DCPHK-NFMTC-H88MJ-PFHPY-QJ4BJ`

Enterprise 2016 LTSB N

`QFFDN-GRT3P-VKWWX-X7T3R-8B639`

---

Para resetar a ativação:

`slmgr -upk`

## Linux

### Fazer pendrive bootável no Linux

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
