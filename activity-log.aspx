<%@ Page Language="C#" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.Collections.Specialized" %>
<%@ Import Namespace="System.IO" %>
<%@ Import Namespace="System.Text" %>
<%@ Import Namespace="System.Web" %>
<%@ Import Namespace="System.Web.Script.Serialization" %>

<script runat="server">
    private static readonly object _logLock = new object();
    private static readonly string _logDir = @"D:\PROD_REPO_DATA\IIS\DeployJsonGenerator";
    private static readonly string _logFile = Path.Combine(_logDir, "userActivity.log");
    private readonly JavaScriptSerializer _serializer = new JavaScriptSerializer();

    protected void Page_Load(object sender, EventArgs e)
    {
        Response.ContentType = "application/json";
        Response.Cache.SetCacheability(HttpCacheability.NoCache);
        Response.TrySkipIisCustomErrors = true;

        try
        {
            var user = "anonymous";
            if (HttpContext.Current != null &&
                HttpContext.Current.User != null &&
                HttpContext.Current.User.Identity != null &&
                !string.IsNullOrWhiteSpace(HttpContext.Current.User.Identity.Name))
            {
                user = HttpContext.Current.User.Identity.Name;
            }

            var payload = ReadRequestPayload();
            var server = GetPayloadValue(payload, "server", "").Trim();
            var eventType = GetPayloadValue(payload, "eventType", "").Trim();
            if (string.IsNullOrWhiteSpace(eventType))
            {
                eventType = GetPayloadValue(payload, "event", "").Trim();
            }
            if (string.IsNullOrWhiteSpace(eventType))
            {
                eventType = GetPayloadValue(payload, "action", "UNKNOWN").Trim();
            }

            var eventData = GetPayloadValue(payload, "data", "")
                .Replace(Environment.NewLine, " ")
                .Replace("\t", " ")
                .Trim();

            if (!Directory.Exists(_logDir))
            {
                Directory.CreateDirectory(_logDir);
            }

            var logLine = string.Format(
                "{0}\t{1}\t{2}\t{3}\t{4}",
                DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff"),
                user,
                server,
                string.IsNullOrWhiteSpace(eventType) ? "UNKNOWN" : eventType,
                eventData
            );

            lock (_logLock)
            {
                File.AppendAllText(_logFile, logLine + Environment.NewLine, Encoding.UTF8);
            }

            Response.Write("{\"status\":\"ok\"}");
        }
        catch (Exception ex)
        {
            Response.StatusCode = 500;
            Response.Write("{\"status\":\"error\",\"message\":\"" + (ex.Message ?? "").Replace("\"", "'") + "\"}");
        }
    }

    private NameValueCollection ReadRequestPayload()
    {
        var payload = new NameValueCollection(StringComparer.OrdinalIgnoreCase);

        if (Request.QueryString != null)
        {
            foreach (string key in Request.QueryString.Keys)
            {
                if (string.IsNullOrWhiteSpace(key)) continue;
                payload[key] = Request.QueryString[key] ?? "";
            }
        }

        if (Request.Form != null)
        {
            foreach (string key in Request.Form.Keys)
            {
                if (string.IsNullOrWhiteSpace(key)) continue;
                payload[key] = Request.Form[key] ?? "";
            }
        }

        var rawBody = ReadRawBody();
        if (string.IsNullOrWhiteSpace(rawBody))
        {
            return payload;
        }

        if (rawBody.TrimStart().StartsWith("{", StringComparison.Ordinal))
        {
            try
            {
                var jsonPayload = _serializer.DeserializeObject(rawBody) as System.Collections.Generic.Dictionary<string, object>;
                if (jsonPayload != null)
                {
                    foreach (var entry in jsonPayload)
                    {
                        if (string.IsNullOrWhiteSpace(entry.Key)) continue;
                        payload[entry.Key] = entry.Value == null ? "" : Convert.ToString(entry.Value) ?? "";
                    }
                }
            }
            catch
            {
                // Ignore JSON parse failures and keep values already collected.
            }

            return payload;
        }

        var parsed = HttpUtility.ParseQueryString(rawBody);
        foreach (string key in parsed.Keys)
        {
            if (string.IsNullOrWhiteSpace(key)) continue;
            payload[key] = parsed[key] ?? "";
        }

        return payload;
    }

    private string ReadRawBody()
    {
        if (Request.InputStream == null || !Request.InputStream.CanRead)
        {
            return "";
        }

        if (Request.InputStream.CanSeek)
        {
            Request.InputStream.Position = 0;
        }

        using (var reader = new StreamReader(Request.InputStream, Request.ContentEncoding ?? Encoding.UTF8, true, 1024, true))
        {
            var body = reader.ReadToEnd();
            if (Request.InputStream.CanSeek)
            {
                Request.InputStream.Position = 0;
            }
            return body ?? "";
        }
    }

    private string GetPayloadValue(NameValueCollection payload, string key, string fallback)
    {
        var value = payload[key] ?? "";
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        return fallback ?? "";
    }
</script>
