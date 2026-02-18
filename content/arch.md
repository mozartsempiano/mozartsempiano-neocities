---
layout: default
title: Arch Linux
---

## Guia rápido de instalação do Arch Linux

- [Arch Wiki - Installation Guide](https://wiki.archlinux.org/title/Installation_guide)
- [Reddit - Recomendações de apps](https://www.reddit.com/r/archlinux/comments/14dmm24/what_basic_applications_do_you_recommend_for_a/)

### Outros comandos úteis

#### Atualizar sistema

```
sudo pacman -Syu
```

#### Listar hardware

```
lspci -k
lsusb
```

#### Instalar YAY (AUR)

```
git clone https://aur.archlinux.org/yay.git
cd yay
makepkg -si
```

#### Drivers NVIDIA (com Vulkan)

```
sudo pacman -Syu nvidia nvidia-utils nvidia-settings vulkan-icd-loader lib32-vulkan-icd-loader
```

#### Verificar se foi instalado:

```
nvidia-smi
```

### Resumo passo a passo

1. Mudar teclado para português no ambiente live:

```
loadkeys br-abnt2
```

2. Verificar conexão com internet:

```
ping archlinux.org
```

(Ctrl + C para sair)

3. Verificar partições:

```
lsblk -f
```

4. Criar partições:

```
cfdisk /dev/sdX
```

5. Formatar partição root:

```
mkfs.ext4 /dev/sdXY
```

6. Montar partição root:

```
mount /dev/sdXY /mnt
```

7. Montar partição EFI (sem formatar):

```
mkdir -p /mnt/boot/efi
mount /dev/sdXZ /mnt/boot/efi
```

8. Instalar sistema base, rede, bootloader e sudo:

```
pacstrap /mnt base linux linux-firmware networkmanager grub efibootmgr sudo
```

9. Gerar arquivo fstab:

```
genfstab -U /mnt >> /mnt/etc/fstab
cat /mnt/etc/fstab
```

10. Entrar no chroot:

```
arch-chroot /mnt
```

11. Configurar fuso horário:

```
ln -sf /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime
hwclock --systohc
```

12. Configurar localidade:

```
nano /etc/locale.gen
```

Descomente a linha: pt_BR.UTF-8 UTF-8

```
locale-gen
echo "LANG=pt_BR.UTF-8" > /etc/locale.conf
```

13. Configurar senha root:

```
passwd
```

14. Criar usuário comum com permissões sudo:

```
useradd -m -G wheel -s /bin/bash nome_do_usuario
passwd nome_do_usuario
```

15. Permitir sudo para grupo wheel:

```
EDITOR=vim visudo
```

Descomente a linha:

```
%wheel ALL=(ALL) ALL
```

16. Ativar NetworkManager para iniciar automaticamente:

```
systemctl enable NetworkManager
```

17. Instalar e configurar GRUB para UEFI:

```
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=GRUB
grub-mkconfig -o /boot/grub/grub.cfg
```

18. Instalar Wayland e compositor Sway:

```
pacman -S sway xorg-xwayland wayland wayland-protocols foot wl-clipboard grim slurp
```

19. Sair, desmontar, reiniciar:

```
exit
umount -R /mnt
reboot
```

### Instalar drivers NVIDIA:

```
sudo pacman -Syu nvidia nvidia-utils nvidia-settings vulkan-icd-loader lib32-vulkan-icd-loader
```
