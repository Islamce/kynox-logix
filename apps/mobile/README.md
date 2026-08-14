# KYNOX LOGIX Flutter Client

This is the first-party mobile client scaffold for the LOGIX MVP. It uses a centralized API client, secure token storage, environment-specific API configuration, and an authenticated dashboard surface. The source contains no production secrets.

## Run

```bash
flutter pub get
flutter run --dart-define=LOGIX_API_BASE_URL=http://10.0.2.2:4000
```

For UAT or production, pass the appropriate HTTPS API URL with `--dart-define=LOGIX_API_BASE_URL=...`. A signed release requires an owner-managed Android signing configuration; signing secrets must not be committed.

## Qualification status

The available execution environment does not contain the Flutter SDK, Dart CLI, Android SDK, or `adb`. Therefore `flutter pub get`, `flutter analyze`, Flutter tests, emulator journeys, and APK builds remain unverified. This scaffold is not a signed release artifact.
