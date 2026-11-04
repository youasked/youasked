package dev.youasked

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal const val DEFAULT_API_URL: String = "https://api.youasked.dev"

/** The HTTP contract of the YouAsked API (see packages/react-native/src/client.ts). */
internal interface Client {
    suspend fun config(): Config
    suspend fun list(sort: String, status: String): List<FeatureRequest>
    suspend fun similar(q: String): List<FeatureRequest>
    suspend fun get(id: String): RequestDetail
    suspend fun create(input: NewRequest): Pair<FeatureRequest, List<Attachment>>
    suspend fun upload(image: ByteArray, mime: String = "image/png"): Attachment
    suspend fun remove(id: String)
    suspend fun earlyAccess(id: String): Boolean
    suspend fun whatsNewSeen()
    suspend fun vote(id: String): VoteResult
    suspend fun comment(id: String, body: String): RequestComment
    suspend fun mine(): List<FeatureRequest>
    suspend fun seen(ids: List<String>)
}

internal fun interface Transport {
    /** Returns the HTTP status and the raw body text. Throws [IOException] when the network fails. */
    fun send(method: String, url: String, headers: Map<String, String>, body: ByteArray?): Pair<Int, String>
}

internal object UrlConnectionTransport : Transport {
    override fun send(method: String, url: String, headers: Map<String, String>, body: ByteArray?): Pair<Int, String> {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 15_000
            conn.readTimeout = 20_000
            headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            if (body != null) {
                conn.doOutput = true
                conn.outputStream.use { it.write(body) }
            }
            val status = conn.responseCode
            val stream = if (status >= 400) conn.errorStream else conn.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            return status to text
        } finally {
            conn.disconnect()
        }
    }
}

/** base64url without padding, the way the server decodes `x-youasked-user`. Hand-rolled so it also runs in plain JVM tests. */
internal fun base64Url(text: String): String {
    val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    val bytes = text.toByteArray(Charsets.UTF_8)
    val out = StringBuilder()
    var i = 0
    while (i < bytes.size) {
        val b0 = bytes[i].toInt() and 0xff
        val b1 = if (i + 1 < bytes.size) bytes[i + 1].toInt() and 0xff else 0
        val b2 = if (i + 2 < bytes.size) bytes[i + 2].toInt() and 0xff else 0
        val n = (b0 shl 16) or (b1 shl 8) or b2
        out.append(alphabet[(n shr 18) and 63]).append(alphabet[(n shr 12) and 63])
        if (i + 1 < bytes.size) out.append(alphabet[(n shr 6) and 63])
        if (i + 2 < bytes.size) out.append(alphabet[n and 63])
        i += 3
    }
    return out.toString()
}

internal fun userHeaderJson(user: YouAskedUser): String {
    val o = JSONObject()
    o.put("id", user.id)
    user.email?.let { o.put("email", it) }
    user.name?.let { o.put("name", it) }
    return o.toString()
}

internal class HttpClient(
    private val appKey: String,
    apiUrl: String,
    private val user: YouAskedUser?,
    private val signature: String?,
    private val anonId: () -> String,
    private val debuggable: Boolean,
    private val transport: Transport = UrlConnectionTransport,
) : Client {
    private val base = apiUrl.trimEnd('/') + "/v1"

    fun headers(json: Boolean): Map<String, String> {
        val h = linkedMapOf(
            "x-youasked-key" to appKey,
            "x-youasked-anon" to anonId(),
            // Native apps send no Origin header, so say who is calling (and whether it's a dev build).
            "x-youasked-platform" to "android",
        )
        if (debuggable) h["x-youasked-dev"] = "1"
        if (user != null && user.id.isNotEmpty()) {
            h["x-youasked-user"] = base64Url(userHeaderJson(user))
            if (!signature.isNullOrEmpty()) h["x-youasked-sig"] = signature
        }
        if (json) h["content-type"] = "application/json"
        return h
    }

    private suspend fun call(path: String, body: JSONObject? = null, raw: ByteArray? = null, mime: String? = null, method: String? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val h = headers(json = body != null && raw == null).toMutableMap()
            if (raw != null) h["content-type"] = mime ?: "image/png"
            val verb = method ?: if (body == null && raw == null) "GET" else "POST"
            val payload = raw ?: body?.toString()?.toByteArray(Charsets.UTF_8)
            val (status, text) = try {
                transport.send(verb, base + path, h, payload)
            } catch (e: IOException) {
                throw YouAskedException("network")
            }
            val data = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            if (status !in 200..299) {
                val code = data.optString("error").ifEmpty { null }
                throw YouAskedException(
                    if (status == 402 && code == "test_mode") "test_mode" else code ?: "http_$status",
                    data.optString("message").ifEmpty { null },
                )
            }
            data
        }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    override suspend fun config(): Config = Parse.config(call("/config"))
    override suspend fun list(sort: String, status: String): List<FeatureRequest> =
        Parse.requests(call("/requests?sort=$sort&status=$status").optJSONArray("requests"))
    override suspend fun similar(q: String): List<FeatureRequest> =
        Parse.requests(call("/requests/similar?q=${enc(q)}").optJSONArray("requests"))
    override suspend fun get(id: String): RequestDetail = Parse.detail(call("/requests/${enc(id)}"))
    override suspend fun create(input: NewRequest): Pair<FeatureRequest, List<Attachment>> {
        val body = JSONObject()
            .put("title", input.title)
            .put("body", input.body)
            .put("attachments", JSONArray(input.attachments))
            .put("credit", input.credit)
        if (input.topic != null) body.put("context", JSONObject().put("topic", input.topic))
        val d = call("/requests", body)
        return Parse.request(d.getJSONObject("request")) to Parse.attachments(d.optJSONArray("attachments"))
    }
    override suspend fun upload(image: ByteArray, mime: String): Attachment =
        Parse.attachment(call("/uploads", raw = image, mime = mime))
    override suspend fun remove(id: String) {
        call("/requests/${enc(id)}", method = "DELETE")
    }
    override suspend fun earlyAccess(id: String): Boolean =
        call("/requests/${enc(id)}/early-access", JSONObject()).optBoolean("earlyAccess")
    override suspend fun whatsNewSeen() {
        call("/whats-new/seen", JSONObject())
    }
    override suspend fun vote(id: String): VoteResult {
        val d = call("/requests/${enc(id)}/vote", JSONObject())
        return VoteResult(d.optBoolean("voted"), d.optInt("votes"))
    }
    override suspend fun comment(id: String, body: String): RequestComment =
        Parse.comment(call("/requests/${enc(id)}/comments", JSONObject().put("body", body)).getJSONObject("comment"))
    override suspend fun mine(): List<FeatureRequest> = Parse.requests(call("/me/requests").optJSONArray("requests"))
    override suspend fun seen(ids: List<String>) {
        call("/notifications/seen", JSONObject().put("ids", JSONArray(ids)))
    }
}

internal object Parse {
    private fun JSONObject.str(key: String): String? = if (isNull(key) || !has(key)) null else optString(key).ifEmpty { null }
    private fun JSONObject.lng(key: String): Long? = if (isNull(key) || !has(key)) null else optLong(key)

    fun request(o: JSONObject): FeatureRequest = FeatureRequest(
        id = o.getString("id"),
        number = o.optInt("number"),
        title = o.optString("title"),
        body = o.optString("body"),
        status = Status.from(o.str("status")),
        votes = o.optInt("votes"),
        comments = o.optInt("comments"),
        shipNote = o.str("shipNote"),
        shippedAt = o.lng("shippedAt"),
        topic = o.optJSONObject("context")?.str("topic"),
        creditName = o.str("creditName"),
        createdAt = o.optLong("createdAt"),
        voted = o.optBoolean("voted"),
        mine = o.optBoolean("mine"),
    )

    fun requests(a: JSONArray?): List<FeatureRequest> = (0 until (a?.length() ?: 0)).map { request(a!!.getJSONObject(it)) }

    fun attachment(o: JSONObject) = Attachment(o.getString("id"), o.optString("url"))
    fun attachments(a: JSONArray?): List<Attachment> = (0 until (a?.length() ?: 0)).map { attachment(a!!.getJSONObject(it)) }

    fun comment(o: JSONObject) = RequestComment(
        id = o.getString("id"),
        body = o.optString("body"),
        team = o.optBoolean("team"),
        author = o.str("author"),
        mine = o.optBoolean("mine"),
        createdAt = o.optLong("createdAt"),
    )

    fun detail(o: JSONObject): RequestDetail = RequestDetail(
        request = o.optJSONObject("request")?.let(::request),
        comments = o.optJSONArray("comments")?.let { a -> (0 until a.length()).map { comment(a.getJSONObject(it)) } } ?: emptyList(),
        attachments = attachments(o.optJSONArray("attachments")),
        earlyAccess = o.optBoolean("earlyAccess"),
        canDelete = o.optBoolean("canDelete"),
        redirect = o.str("redirect"),
    )

    fun notice(o: JSONObject) = Notice(
        id = o.getString("id"),
        kind = o.optString("kind"),
        requestId = o.optString("requestId"),
        title = o.optString("title"),
        shipNote = o.str("shipNote"),
        reply = o.str("reply"),
    )

    fun nudge(o: JSONObject?): NudgeSettings? {
        if (o == null) return null
        val d = NudgeSettings()
        return NudgeSettings(
            everyDays = o.optInt("everyDays", d.everyDays),
            activeSeconds = o.optInt("activeSeconds", d.activeSeconds),
            skipVisits = o.optInt("skipVisits", d.skipVisits),
            message = o.str("message"),
            position = if (o.optString("position") == "top") NudgePosition.Top else NudgePosition.Bottom,
        )
    }

    fun config(o: JSONObject): Config {
        val news = o.optJSONObject("whatsNew")?.let { w ->
            val items = w.optJSONArray("items")
            val list = (0 until (items?.length() ?: 0)).map {
                val i = items!!.getJSONObject(it)
                WhatsNewItem(i.getString("id"), i.optString("title"), i.str("shipNote"), i.optLong("shippedAt"), i.optBoolean("mine"))
            }
            WhatsNew(list, w.optInt("total", list.size))
        }
        val unseen = o.optJSONArray("unseen")
        return Config(
            appName = o.optJSONObject("app")?.optString("name").orEmpty(),
            watermark = o.optBoolean("watermark"),
            identified = o.optBoolean("identified"),
            canCredit = o.optBoolean("canCredit"),
            unseen = (0 until (unseen?.length() ?: 0)).map { notice(unseen!!.getJSONObject(it)) },
            whatsNew = news,
            nudge = nudge(o.optJSONObject("nudge")),
        )
    }
}
