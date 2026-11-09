# PetraPay POS

An Android point-of-sale app for PetraPay. A cashier types an amount, the customer scans the QR with their phone and pays with any token (or shielded ZEC) on PetraPay's hosted checkout, and the terminal prints a receipt as soon as the payment lands. The merchant receives shielded ZEC at a fresh address for every sale.

Built for Android payment terminals with a built-in 58 mm printer (tested layout: Senraise H10). It runs on any Android device; without a printer, receipts are simply skipped.

## How it works

1. **Pair**: in the PetraPay dashboard, open **Point of sale → Get pairing code** and type the code on the terminal. The terminal gets its own token, kept in Keystore-encrypted storage. That token can only ring up and view this terminal's sales: it can't withdraw, see other invoices or change settings. Remove a terminal from the dashboard at any time.
2. **Charge**: enter the amount (USD or ZEC). The sale expires after 15 minutes.
3. **Customer pays** by scanning the QR, which opens the hosted checkout on their phone.
4. **Receipt**: when the sale is paid, the terminal shows it and prints the customer receipt (optional, on by default). A merchant copy and reprints are one tap away.

## Develop

This app is installed with npm, separately from the pnpm workspace.

```bash
cd apps/pos
npm ci
npm start                      # Metro
npm run android                # build and install on a connected device
```

The server the terminal pairs with defaults to `https://petra-pay-zcash.vercel.app/api`. Override it per build with `-PPETRAPAY_API_URL=https://your-domain/api`, or change it on the pairing screen (for self-hosted PetraPay).

## Release build

```bash
cd android
./gradlew assembleRelease -PPETRAPAY_API_URL=https://your-domain/api
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Release builds are currently signed with the debug key. Before distributing, create your own keystore and set it in `android/app/build.gradle` (`signingConfigs.release`).

## Native modules

- `PetraPrinter`: the H10's built-in thermal printer, through its printer service (`recieptservice.com.recieptservice`, vendor AAR in `android/app/libs`).
- `PetraSecureStore`: AES-GCM values with a non-exportable Android Keystore key (the terminal token).
- `PetraDevice`: device model and the build's default server.
