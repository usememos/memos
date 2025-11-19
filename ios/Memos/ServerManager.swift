import Foundation
import Combine
import Mobile // This will be the gomobile framework

class ServerManager: ObservableObject {
    static let shared = ServerManager()

    @Published var isRunning = false
    @Published var serverURL: String?
    @Published var error: String?
    @Published var allowNetworkAccess = false {
        didSet {
            if oldValue != allowNetworkAccess && isRunning {
                // Restart server with new settings
                stopServer()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.startServer()
                }
            }
        }
    }

    private let port: Int = 5230

    private init() {}

    func startServer() {
        guard !isRunning else { return }

        do {
            // Get the documents directory
            let documentsPath = try FileManager.default.url(
                for: .documentDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            ).path

            let dataDir = MobileGetDataDirectory(documentsPath)

            // Determine bind address based on network access setting
            let addr = allowNetworkAccess ? "0.0.0.0" : ""

            var serverError: NSError?
            let url = MobileNewServer(dataDir, port, addr, "prod", &serverError)

            if let error = serverError {
                throw error
            }

            DispatchQueue.main.async {
                self.serverURL = url
                self.isRunning = true
                self.error = nil
            }

            print("Server started at: \(url ?? "unknown")")

        } catch {
            DispatchQueue.main.async {
                self.error = error.localizedDescription
                self.isRunning = false
            }
            print("Failed to start server: \(error)")
        }
    }

    func stopServer() {
        guard isRunning else { return }

        do {
            var stopError: NSError?
            MobileStopServer(&stopError)

            if let error = stopError {
                throw error
            }

            DispatchQueue.main.async {
                self.isRunning = false
                self.serverURL = nil
            }

            print("Server stopped")

        } catch {
            DispatchQueue.main.async {
                self.error = error.localizedDescription
            }
            print("Failed to stop server: \(error)")
        }
    }

    func getLocalIPAddress() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?

        guard getifaddrs(&ifaddr) == 0 else { return nil }
        guard let firstAddr = ifaddr else { return nil }

        for ifptr in sequence(first: firstAddr, next: { $0.pointee.ifa_next }) {
            let interface = ifptr.pointee
            let addrFamily = interface.ifa_addr.pointee.sa_family

            if addrFamily == UInt8(AF_INET) {
                let name = String(cString: interface.ifa_name)
                if name == "en0" { // WiFi interface
                    var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                              &hostname, socklen_t(hostname.count),
                              nil, socklen_t(0), NI_NUMERICHOST)
                    address = String(cString: hostname)
                }
            }
        }

        freeifaddrs(ifaddr)
        return address
    }
}
