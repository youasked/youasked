// swift-tools-version:5.9
import PackageDescription

// SwiftPM only reads a Package.swift at the repo root, so this one points into packages/swift.
// Install: File > Add Package Dependencies… > https://github.com/youasked/youasked
let package = Package(
    name: "YouAsked",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "YouAsked", targets: ["YouAsked"]),
    ],
    targets: [
        .target(name: "YouAsked", path: "packages/swift/Sources/YouAsked"),
        .testTarget(name: "YouAskedTests", dependencies: ["YouAsked"], path: "packages/swift/Tests/YouAskedTests"),
    ]
)
