import SwiftUI
import UIKit

/// YouAsked: feature requests your users can vote on, inside your app.
///
/// ```swift
/// YouAsked.configure(appKey: "ya_pub_…")
///
/// ContentView().youAsked()
/// ```
@MainActor
public enum YouAsked {
    /// Starts YouAsked. Call it once, early (the `App` initialiser is a good place).
    ///
    /// - Parameters:
    ///   - appKey: Your publishable key (`ya_pub_…`). Safe to ship in the app.
    ///   - apiURL: Defaults to `https://api.youasked.dev`.
    public static func configure(appKey: String, apiURL: URL = defaultAPIURL) {
        YAModel.shared.configure(appKey: appKey, apiURL: apiURL, demo: false, appName: nil)
    }

    /// Runs entirely on the device with sample requests and a pretend team, no key and no network.
    /// Posting, voting and commenting work, and the team writes back a few seconds later.
    /// - Parameter showsNews: Set false to start without the "it's live" card and "what's new" list.
    public static func configureDemo(appName: String = "Acme", showsNews: Bool = true) {
        YAModel.shared.demoShowsNews = showsNews
        YAModel.shared.configure(appKey: "", apiURL: defaultAPIURL, demo: true, appName: appName)
    }

    /// Tells YouAsked who is signed in. `signature` is the hex HMAC-SHA256 of `user.id` with your
    /// secret key, made on your server. Pass `nil` for the user to go back to being anonymous.
    public static func identify(user: YouAskedUser?, signature: String?) {
        YAModel.shared.identify(user: user, signature: signature)
    }

    /// Opens the sheet on the home screen.
    public static func open() { YAModel.shared.open() }

    /// Opens the composer already about a topic ("What would make charts better?"). The request is
    /// saved with the topic so you can see which feature people are asking about.
    public static func open(topic: String) { YAModel.shared.open(topic: topic) }

    /// Opens the sheet somewhere specific.
    /// - Parameters:
    ///   - requestId: Opens that request, e.g. from a push notification.
    ///   - draft: Pre-fills the composer, e.g. "Export to Excel" from a locked feature.
    ///   - topic: What the request is about.
    ///   - placeholder: Replaces the composer's placeholder.
    public static func open(_ view: OpenView, requestId: String? = nil, draft: String? = nil, topic: String? = nil, placeholder: String? = nil) {
        YAModel.shared.open(view: view, requestId: requestId, draft: draft, topic: topic, placeholder: placeholder)
    }

    /// Opens one request.
    public static func open(requestId: String) { YAModel.shared.open(requestId: requestId) }

    /// Closes the sheet.
    public static func close() { YAModel.shared.close() }

    /// Colours, radius and font. Light and dark follow the phone unless `mode` says otherwise.
    public static var appearance: Appearance {
        get { YAModel.shared.appearance }
        set { YAModel.shared.appearance = newValue }
    }

    /// Your app's name in the greeting. Defaults to the name you created the app with.
    public static var appName: String? {
        get { YAModel.shared.appNameOverride }
        set { YAModel.shared.appNameOverride = newValue }
    }

    /// Your app's icon, shown in the sheet header and on team replies.
    public static var appIcon: AppIcon? {
        get { YAModel.shared.appIcon }
        set { YAModel.shared.appIcon = newValue }
    }

    /// First message on the home screen.
    public static var greeting: String? {
        get { YAModel.shared.greeting }
        set { YAModel.shared.greeting = newValue }
    }

    /// Heading of the full list. Defaults to "Feature requests".
    public static var title: String {
        get { YAModel.shared.title }
        set { YAModel.shared.title = newValue }
    }

    /// The occasional "Got an idea for <App>?" prompt. By default it follows the dashboard.
    public static var nudge: NudgeOption {
        get { YAModel.shared.nudgeOption }
        set { YAModel.shared.nudgeOption = newValue }
    }

    /// Lets people attach a screenshot ("Show us"). Return an image you captured, or nil if they cancel.
    /// Leave it out and the button doesn't show.
    public static var captureScreenshot: (@MainActor () async -> UIImage?)? {
        get { YAModel.shared.captureScreenshot }
        set { YAModel.shared.captureScreenshot = newValue }
    }

    /// How many replies and "it's live" notices are waiting. Use it for your own badge.
    public static var unseenCount: Int { YAModel.shared.unseen.count }
}
