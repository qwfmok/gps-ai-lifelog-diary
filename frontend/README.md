# lifelog-diary
GPS-based lifelog diary with behavior inference and LLM

## Android (Capacitor)

The Android app uses the same React + Vite source as the web app. Build the web assets and sync them into the native project with:

```bash
npm run android:sync
```

Open the Android project in Android Studio with `npm run android:open`, or build and launch it on a connected device/emulator with `npm run android:run`. Android Studio and an Android SDK are required for native builds and device runs.

The existing web development workflow remains `npm run dev`. Set `VITE_API_BASE_URL` to a backend address reachable from the Android device when building the app. The example `http://localhost:8000` is for local web development; `localhost` inside an Android emulator refers to the emulator itself. Android blocks cleartext HTTP by default, so use an HTTPS backend address for Android unless a debug-only cleartext policy has been configured.
