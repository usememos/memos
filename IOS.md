# Memos iOS App Guide

This guide explains how to build and run Memos as a native iOS application on your iPhone or iPad.

## Quick Start

```bash
# 1. Build the iOS framework
./scripts/build-ios.sh

# 2. Open in Xcode
open ios/Memos.xcodeproj

# 3. Select your device and run (Cmd+R)
```

## What is the iOS App?

The Memos iOS app runs the **full Memos backend server** directly on your iOS device, packaged as a native app. This means:

- ✅ All your data stays on your device
- ✅ No internet connection required
- ✅ Complete feature parity with desktop
- ✅ Optional network access for other devices
- ✅ Native iOS interface with SwiftUI

## How It Works

We use **gomobile** to compile the Go backend into an iOS framework that runs natively on iOS devices. The app displays the React web UI in a WKWebView, communicating with the local Go server.

```
┌────────────────────────────┐
│     iOS Device             │
│  ┌──────────────────────┐  │
│  │  SwiftUI App         │  │
│  │  ├─ WKWebView (UI)   │  │
│  │  └─ Go Server        │  │
│  │     └─ SQLite DB     │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

## Features

### Local-First

All data is stored in SQLite on your device in the app's Documents directory. No cloud required.

### Network Access (Optional)

Enable "Allow Network Access" in settings to let other devices on your local network connect to your Memos instance:

1. Open Settings (⚙️ icon)
2. Toggle "Allow Network Access"
3. Share the displayed network URL with other devices

**Example**: If your iPhone's IP is `192.168.1.50`, other devices can access Memos at `http://192.168.1.50:5230`

### Full Feature Support

The iOS app runs the complete Memos backend, so all features work:

- ✅ Memo creation and editing
- ✅ Markdown support
- ✅ File attachments
- ✅ Tags and search
- ✅ User management
- ✅ API access
- ✅ RSS feeds

## Building from Source

### Prerequisites

- macOS with Xcode 15+
- Go 1.21+
- iOS device or simulator

### Step 1: Build the Framework

```bash
./scripts/build-ios.sh
```

This compiles the Go backend to `ios/Frameworks/Mobile.xcframework`. First build takes 5-10 minutes.

### Step 2: Configure Xcode

1. Open `ios/Memos.xcodeproj`
2. Select the "Memos" project → "Signing & Capabilities"
3. Choose your Apple Developer team
4. Xcode will handle provisioning automatically

### Step 3: Build and Run

- Select your target device (iPhone/iPad or Simulator)
- Press `Cmd+R` or click the Play button
- App will install and launch automatically

## Development Workflow

### Making Backend Changes

After modifying Go code:

```bash
# Rebuild the framework
./scripts/build-ios.sh

# Rebuild in Xcode
# (Cmd+B or Cmd+R)
```

### Making iOS UI Changes

Edit Swift files in `ios/Memos/`:
- `MemosApp.swift` - App entry point
- `ContentView.swift` - Main UI and WebView
- `ServerManager.swift` - Server control logic

Changes are reflected immediately on rebuild (Cmd+R).

### Debugging

View Go server logs in Xcode's debug console. To enable verbose logging, edit `ServerManager.swift`:

```swift
// Change "prod" to "dev"
let url = MobileNewServer(dataDir, port, addr, "dev", &serverError)
```

## Architecture Details

### File Structure

```
ios/
├── Memos/                      # iOS app source
│   ├── MemosApp.swift         # SwiftUI app definition
│   ├── ContentView.swift      # Main view with WebView
│   ├── ServerManager.swift    # Go server interface
│   ├── Assets.xcassets/       # Icons and images
│   └── Info.plist            # App configuration
├── Memos.xcodeproj/          # Xcode project
└── Frameworks/               # Generated (gitignored)
    └── Mobile.xcframework    # Compiled Go backend

mobile/
└── server.go                  # Go → iOS binding layer
```

### How the Binding Works

The `mobile/server.go` package exposes a simple interface for iOS:

```go
// Start server, returns URL
func NewServer(dataDir, port, addr, mode string) (string, error)

// Stop server
func StopServer() error

// Check if running
func IsServerRunning() bool
```

Swift code in `ServerManager.swift` calls these functions via the gomobile-generated framework.

### Data Storage

App data location: `Documents/memos-data/`

```
Documents/
  └── memos-data/
      ├── memos_prod.db      # SQLite database
      └── assets/            # Uploaded files
```

This directory is:
- Persistent across app launches
- Backed up to iCloud (if enabled)
- Accessible via Files app (if configured)

## Network Access Details

### Localhost Mode (Default)

Server binds to `""` (empty string), accessible only from the device:
- URL: `http://localhost:5230`
- Only the iOS app can connect
- No firewall or network configuration needed

### Network Mode (Optional)

Server binds to `0.0.0.0`, accessible from any device on the network:
- URL: `http://<device-ip>:5230`
- Any device on the same WiFi can connect
- Requires local network permission (iOS 14+)

**Security Considerations:**
- Only enable on trusted networks
- Set a strong password in Memos
- iOS will show "Local Network" permission prompt
- Server stops when app is backgrounded

## Limitations

### Background Execution

iOS suspends apps in the background. The Memos server **stops** when you switch apps or lock your device.

**Workaround**: Keep the app in foreground or use Split View on iPad.

**Future**: Could use Background Modes for limited background execution.

### Network Availability

Other devices can only connect when:
- App is in foreground
- Device is awake
- Network access is enabled
- Both devices on same network

### Performance

Mobile hardware is less powerful than desktop. Expect:
- Slower initial database migrations
- Slightly slower search on large datasets
- Limited by iOS memory constraints

## Troubleshooting

### "gomobile: command not found"

Install gomobile:
```bash
go install golang.org/x/mobile/cmd/gomobile@latest
gomobile init
```

### Framework Build Fails

Ensure you have Go 1.21+ installed:
```bash
go version  # Should show 1.21 or higher
```

### Xcode Can't Find Framework

Make sure you ran `./scripts/build-ios.sh` first to generate `Mobile.xcframework`.

### Server Won't Start

Check Xcode console for errors. Common issues:
- Data directory permissions
- Database corruption (delete app and reinstall)
- Insufficient storage

### Can't Connect from Other Devices

1. Verify "Allow Network Access" is ON
2. Check both devices are on same WiFi network
3. Try disabling VPN on client device
4. Check firewall settings on client
5. Verify iOS granted "Local Network" permission

### Blank WebView

- Wait 5-10 seconds for server startup
- Check Xcode console for "Server started" message
- Force quit and restart app
- Clear app data (delete and reinstall)

## Frequently Asked Questions

**Q: Does this require an internet connection?**
A: No, everything runs locally on your device.

**Q: Is my data uploaded to any cloud?**
A: No, all data stays on your device unless you enable iCloud backup.

**Q: Can I use this with the desktop version?**
A: They use separate databases. To sync, you'd need to set up manual export/import.

**Q: Does it work on iPad?**
A: Yes, universal app supports iPhone and iPad.

**Q: Can multiple devices connect simultaneously?**
A: Yes, when network access is enabled, any number of devices can connect.

**Q: What happens to the server when I background the app?**
A: iOS suspends the app and server stops. It restarts when you return to the app.

**Q: Can I change the port number?**
A: Currently hardcoded to 5230 for consistency. You can modify `ServerManager.swift` to change it.

**Q: How much storage does it use?**
A: Base app is ~50MB. Database grows with your memos and attachments.

## Future Enhancements

Potential improvements:

- [ ] Background execution using Background Tasks framework
- [ ] Bonjour/mDNS service discovery
- [ ] Share extension for quick memo creation
- [ ] Siri shortcuts integration
- [ ] Home screen widgets
- [ ] Apple Watch companion app
- [ ] iCloud sync between multiple iOS devices
- [ ] Export/import database backups
- [ ] Face ID/Touch ID app lock

## Contributing

To contribute to iOS app development:

1. Make your changes to `mobile/*.go` or `ios/Memos/*`
2. Test on both iPhone and iPad simulators
3. Test on physical device
4. Submit PR with description of changes

## More Information

- Full iOS README: [ios/README.md](ios/README.md)
- Main Memos docs: [CLAUDE.md](CLAUDE.md)
- Build script: [scripts/build-ios.sh](scripts/build-ios.sh)
- Mobile binding: [mobile/server.go](mobile/server.go)

## Support

For iOS-specific issues, please include:
- iOS version
- Device model
- Xcode version
- Go version
- Error messages from Xcode console

File issues at: https://github.com/usememos/memos/issues
