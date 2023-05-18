# Installing memos as a service on Windows

While memos first-class support is for Docker, you may also install memos as a Windows service. It will run under SYSTEM account and start automatically at system boot.

❗ All service management methods requires admin privileges. Use [gsudo](https://gerardog.github.io/gsudo/docs/install), or open a new PowerShell terminal as admin:

```powershell
Start-Process powershell -Verb RunAs
```

## Choose one of the following methods

### 1. Using [NSSM](https://nssm.cc/download)

NSSM is a lightweight service wrapper.

You may put `nssm.exe` in the same directory as `memos.exe`, or add its directory to your system PATH. Prefer the latest 64-bit version of `nssm.exe`.

```powershell
# Install memos as a service
nssm install memos "C:\path\to\memos.exe" --mode prod --port 5230

# Delay auto start
nssm set memos DisplayName "memos service"

# Configure extra service parameters
nssm set memos Description "A lightweight, self-hosted memo hub. https://usememos.com/"

# Delay auto start
nssm set memos Start SERVICE_DELAYED_AUTO_START

# Edit service using NSSM GUI
nssm edit memos

# Start the service
nssm start memos

# Remove the service, if ever needed
nssm remove memos confirm
```

### 2. Using [WinSW](https://github.com/winsw/winsw)

Find the latest release tag and download the asset `WinSW-net46x.exe`. Then, put it in the same directory as `memos.exe` and rename it to `memos-service.exe`.

Now, in the same directory, create the service configuration file `memos-service.xml`:

```xml
<service>
    <id>memos</id>
    <name>memos service</name>
    <description>A lightweight, self-hosted memo hub. https://usememos.com/</description>
    <onfailure action="restart" delay="10 sec"/>
    <executable>%BASE%\memos.exe</executable>
    <arguments>--mode prod --port 5230</arguments>
    <delayedAutoStart>true</delayedAutoStart>
    <log mode="none" />
</service>
```

Then, install the service:

```powershell
# Install the service
.\memos-service.exe install

# Start the service
.\memos-service.exe start

# Remove the service, if ever needed
.\memos-service.exe uninstall
```

### Manage the service

You may use the `net` command to manage the service:

```powershell
net start memos
net stop memos
```

Also, by using one of the provided methods, the service will appear in the Windows Services Manager `services.msc`.

## Notes

- On Windows, memos store its data in the following directory:

  ```powershell
  $env:ProgramData\memos
  # Typically, this will resolve to C:\ProgramData\memos
  ```

  You may specify a custom directory by appending `--data <path>` to the service command line.

- If the service fails to start, you should inspect the Windows Event Viewer `eventvwr.msc`.

- Memos will be accessible at [http://localhost:5230](http://localhost:5230) by default.
