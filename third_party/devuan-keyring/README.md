# Devuan Keyring

Bu dizin, Ankora Linux'un tabanı olan Devuan GNU/Linux (Daedalus) için resmi
GPG anahtarlıklarını ve `devuan-keyring` paketini içerir. `scripts/build-iso.sh`
debootstrap sırasında bu anahtarları kullanarak Devuan depo imzalarını doğrular.

Kaynak: https://pkgmaster.devuan.org/devuan/pool/main/d/devuan-keyring/

- `devuan-keyring_2022.09.04_all.deb`: Resmi Devuan keyring paketi (sürüm 2022.09.04).
- `gpg/`: Pakedin içinden çıkarılmış GPG anahtarlık dosyaları
  (`devuan-archive-keyring.gpg`, `devuan-keyring.gpg`,
  `devuan-keyring-2016-archive.gpg`, `devuan-keyring-2016-cdimage.gpg`,
  `devuan-keyring-2022-archive.gpg`).
