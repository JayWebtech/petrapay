# PetraPay POS for Android

Download: [petrapay-pos-v1.0.apk](https://github.com/JayWebtech/petrapay/raw/main/apk/petrapay-pos-v1.0.apk) (27 MB)

SHA-256: `1fb3d211e568e5122e208ab4ec065ffa60455aa0b65b54dc0f5f374bd41fcfbc`

The point-of-sale app for Android payment terminals with a built-in 58 mm printer (tested on the Senraise H10). It also runs on other Android phones and tablets; without a printer, receipts are skipped.

## Install

1. Download the APK on the terminal (or copy it over USB).
2. Open it and allow installing from this source when Android asks.
3. In the PetraPay dashboard, go to **Point of sale → Get pairing code**, and enter the code on the terminal.

With a USB cable and developer mode on:

```bash
adb install -r petrapay-pos-v1.0.apk
```

The app connects to `https://api.petrapay.xyz`. To point it at a self-hosted instance, build it yourself; see [apps/pos/README.md](../apps/pos/README.md).
