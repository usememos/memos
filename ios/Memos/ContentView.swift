import SwiftUI
import WebKit

struct ContentView: View {
    @EnvironmentObject var serverManager: ServerManager
    @State private var showSettings = false

    var body: some View {
        NavigationView {
            ZStack {
                if serverManager.isRunning, let url = serverManager.serverURL {
                    WebView(url: URL(string: url)!)
                        .edgesIgnoringSafeArea(.bottom)
                } else if let error = serverManager.error {
                    VStack(spacing: 20) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 60))
                            .foregroundColor(.red)
                        Text("Server Error")
                            .font(.title)
                        Text(error)
                            .multilineTextAlignment(.center)
                            .padding()
                        Button("Retry") {
                            serverManager.startServer()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                } else {
                    VStack(spacing: 20) {
                        ProgressView()
                            .scaleEffect(1.5)
                        Text("Starting Memos Server...")
                            .font(.title2)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Text("Memos")
                        .font(.headline)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showSettings = true }) {
                        Image(systemName: "gear")
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
                    .environmentObject(serverManager)
            }
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
        webView.load(request)
    }
}

struct SettingsView: View {
    @EnvironmentObject var serverManager: ServerManager
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section {
                    HStack {
                        Text("Server Status")
                        Spacer()
                        Circle()
                            .fill(serverManager.isRunning ? Color.green : Color.red)
                            .frame(width: 10, height: 10)
                        Text(serverManager.isRunning ? "Running" : "Stopped")
                            .foregroundColor(serverManager.isRunning ? .green : .red)
                    }

                    if serverManager.isRunning, let url = serverManager.serverURL {
                        VStack(alignment: .leading) {
                            Text("Local URL")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(url)
                                .font(.footnote)
                                .textSelection(.enabled)
                        }
                    }
                } header: {
                    Text("Server")
                }

                Section {
                    Toggle("Allow Network Access", isOn: $serverManager.allowNetworkAccess)

                    if serverManager.allowNetworkAccess {
                        if let ipAddress = serverManager.getLocalIPAddress() {
                            VStack(alignment: .leading) {
                                Text("Network Address")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("http://\(ipAddress):\(5230)")
                                    .font(.footnote)
                                    .textSelection(.enabled)
                            }

                            Text("Other devices on your network can access Memos at the address above.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    } else {
                        Text("Server is only accessible from this device.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("Network")
                } footer: {
                    Text("Enable network access to allow other devices on your local network to connect to your Memos instance.")
                }

                Section {
                    Button("Restart Server") {
                        serverManager.stopServer()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            serverManager.startServer()
                        }
                    }

                    Button("Stop Server", role: .destructive) {
                        serverManager.stopServer()
                        dismiss()
                    }
                    .disabled(!serverManager.isRunning)
                } header: {
                    Text("Actions")
                }

                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Port: 5230")
                        Text("Database: SQLite")
                        Text("Mode: Production")
                    }
                    .font(.footnote)
                    .foregroundColor(.secondary)
                } header: {
                    Text("Configuration")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(ServerManager.shared)
}
