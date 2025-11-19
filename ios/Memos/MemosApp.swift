import SwiftUI

@main
struct MemosApp: App {
    @StateObject private var serverManager = ServerManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(serverManager)
                .onAppear {
                    serverManager.startServer()
                }
                .onDisappear {
                    serverManager.stopServer()
                }
        }
    }
}
