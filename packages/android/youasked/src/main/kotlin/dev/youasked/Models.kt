package dev.youasked

public enum class Status(internal val wire: String, internal val label: String) {
    Open("open", "Open"),
    Planned("planned", "Planned"),
    InProgress("in_progress", "In progress"),
    Shipped("shipped", "Shipped"),
    Declined("declined", "Not planned");

    internal companion object {
        fun from(wire: String?): Status = entries.firstOrNull { it.wire == wire } ?: Open
    }
}

public data class FeatureRequest(
    val id: String,
    /** Shown as YA-12; commits and PRs that say "closes YA-12" ship it. */
    val number: Int,
    val title: String,
    val body: String,
    val status: Status,
    val votes: Int,
    val comments: Int,
    val shipNote: String?,
    val shippedAt: Long?,
    /** Where it was asked from: a topic like "charts". */
    val topic: String?,
    /** First name of the person who asked, when they opted in to being thanked and it has shipped. */
    val creditName: String?,
    val createdAt: Long,
    val voted: Boolean,
    val mine: Boolean,
)

public data class Attachment(val id: String, val url: String)

public data class WhatsNewItem(
    val id: String,
    val title: String,
    val shipNote: String?,
    val shippedAt: Long,
    val mine: Boolean,
)

/** What shipped since this person was last shown the list. */
public data class WhatsNew(val items: List<WhatsNewItem>, val total: Int)

public data class RequestComment(
    val id: String,
    val body: String,
    val team: Boolean,
    val author: String?,
    val mine: Boolean,
    val createdAt: Long,
)

/** An in-app card: [kind] is "shipped", or "reply" when the team answered. */
public data class Notice(
    val id: String,
    val kind: String,
    val requestId: String,
    val title: String,
    val shipNote: String?,
    val reply: String?,
)

/** The server's settings for the occasional "Got an idea?" prompt. */
public data class NudgeSettings(
    val everyDays: Int = 7,
    val activeSeconds: Int = 30,
    val skipVisits: Int = 1,
    val message: String? = null,
    val position: NudgePosition = NudgePosition.Bottom,
)

public enum class NudgePosition { Bottom, Top }

public data class Config(
    val appName: String,
    val watermark: Boolean,
    val identified: Boolean,
    /** Identified with a name, so "Credit me when it ships" makes sense. */
    val canCredit: Boolean,
    val unseen: List<Notice>,
    val whatsNew: WhatsNew?,
    val nudge: NudgeSettings?,
)

public data class NewRequest(
    val title: String,
    val body: String,
    /** Ids from `upload()`. */
    val attachments: List<String> = emptyList(),
    val topic: String? = null,
    val credit: Boolean = false,
)

public data class RequestDetail(
    val request: FeatureRequest?,
    val comments: List<RequestComment>,
    val attachments: List<Attachment>,
    /** Whether this person asked to try it before it ships. */
    val earlyAccess: Boolean,
    /** The person wrote it and nobody else has joined in yet, so they can take it back. */
    val canDelete: Boolean,
    val redirect: String?,
)

public data class VoteResult(val voted: Boolean, val votes: Int)

/** Who is asking. Sign the id on your server and pass the signature to [YouAsked.identify]. */
public data class YouAskedUser(val id: String, val email: String? = null, val name: String? = null) {
    public constructor(id: Long, email: String? = null, name: String? = null) : this(id.toString(), email, name)
}

public class YouAskedException(
    /** "network", "test_mode", "not_found", "slow_down", "bad_signature", ... or "http_NNN". */
    public val code: String,
    /** A ready-to-show sentence from the server, when it sent one (spam, rate limits, delete). */
    public val detail: String? = null,
) : Exception(code)
